import fs from "node:fs";
import path from "node:path";
import { gigaDir } from "../config.js";
import { fileExists } from "../utils/path-utils.js";
import { readJsonl } from "../utils/jsonl.js";
import { walk } from "../utils/walk.js";
import { normalizeChatMessages, textFromMessage } from "./messages.js";

function summarizeChat(projectName, filePath, messages) {
  const stats = fs.statSync(filePath);
  const normalized = normalizeChatMessages(messages);
  const firstUser = normalized.find((item) => item.role === "user");
  const lastAssistant = [...normalized].reverse().find((item) => item.role === "assistant");
  const firstEvent = messages.find((item) => item && typeof item === "object") || {};
  const cwd = messages.find((item) => typeof item?.cwd === "string")?.cwd || "";
  const sessionId = firstEvent.sessionId || path.basename(filePath, path.extname(filePath));
  const title = (firstUser?.text || normalized[0]?.text || "").replace(/\s+/g, " ").slice(0, 90);

  return {
    id: sessionId,
    sessionId,
    projectName,
    cwd,
    filePath,
    updatedAt: stats.mtime.toISOString(),
    size: stats.size,
    title: title || "Без названия",
    preview: (lastAssistant?.text || textFromMessage(firstEvent) || "").replace(/\s+/g, " ").slice(0, 180)
  };
}

function projectNameFromPath(root, filePath) {
  const [projectName] = path.relative(root, filePath).split(path.sep);
  return projectName || "global";
}

export async function listChats() {
  const projectsRoot = path.join(gigaDir, "projects");
  const roots = fileExists(projectsRoot) ? [projectsRoot] : [gigaDir];
  const chatFiles = [];

  for (const root of roots) {
    const files = await walk(root, (fullPath, name) => {
      const lower = name.toLowerCase();
      return lower.endsWith(".jsonl") && fullPath.toLowerCase().includes(`${path.sep}chats${path.sep}`);
    });

    chatFiles.push(...files.map((filePath) => ({ root, filePath })));
  }

  const chats = [];
  for (const { root, filePath } of chatFiles) {
    const messages = await readJsonl(filePath, null);
    chats.push(summarizeChat(projectNameFromPath(root, filePath), filePath, messages));
  }

  return chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function getChatById(id) {
  const chats = await listChats();
  const chat = chats.find((item) => item.id === id);
  if (!chat) return null;

  const messages = await readJsonl(chat.filePath, null);
  return {
    chat: summarizeChat(chat.projectName, chat.filePath, messages),
    messages,
    displayMessages: normalizeChatMessages(messages)
  };
}
