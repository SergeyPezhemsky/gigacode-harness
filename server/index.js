import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const app = express();
const port = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../client/dist");
const homeDir = os.homedir();
const gigaDir = path.join(homeDir, ".gigacode");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function normalizePath(input) {
  if (!input || typeof input !== "string") return null;
  return path.resolve(input.trim());
}

function fileExists(filePath) {
  return fsSync.existsSync(filePath);
}

function isGigacodeSkillPath(skillPath) {
  const normalized = path.normalize(skillPath).toLowerCase();
  const personalRoot = path.normalize(path.join(gigaDir, "skills")).toLowerCase();
  const projectSegment = `${path.sep}.gigacode${path.sep}skills${path.sep}`.toLowerCase();
  return normalized.startsWith(personalRoot) || normalized.includes(projectSegment);
}

async function safeReadJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function readJsonl(filePath, limit = 200) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    const parsed = [];
    const selectedLines = limit ? lines.slice(-limit) : lines;

    for (const line of selectedLines) {
      try {
        parsed.push(JSON.parse(line));
      } catch {
        parsed.push({ type: "raw", text: line });
      }
    }

    return parsed;
  } catch {
    return [];
  }
}

async function walk(dir, predicate, maxDepth = 6, depth = 0) {
  if (depth > maxDepth || !fileExists(dir)) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(fullPath, predicate, maxDepth, depth + 1)));
    } else if (predicate(fullPath, entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

function textFromMessage(message) {
  const payload = message?.message ?? message;
  return textFromPayload(payload);
}

function textFromPayload(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;

  const textParts = [];
  const collect = (value) => {
    if (!value) return;
    if (typeof value === "string") {
      textParts.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value !== "object") return;
    if (typeof value.text === "string") textParts.push(value.text);
    else if (typeof value.content === "string") textParts.push(value.content);
    else if (Array.isArray(value.content)) collect(value.content);
    else if (Array.isArray(value.parts)) collect(value.parts);
  };

  collect(payload.parts);
  collect(payload.content);
  if (!textParts.length) collect(payload.text);
  return textParts.filter(Boolean).join("\n").trim();
}

function roleFromEvent(event) {
  const role = event?.message?.role || event?.role || event?.type || "event";
  if (role === "model" || role === "assistant" || role === "result") return "assistant";
  if (role === "user") return "user";
  return role;
}

function normalizeChatMessages(messages) {
  const normalized = [];

  for (const [index, event] of messages.entries()) {
    const role = roleFromEvent(event);
    if (role !== "user" && role !== "assistant") continue;

    const text = textFromMessage(event);
    if (!text) continue;

    normalized.push({
      id: event.uuid || event.id || `${event.sessionId || "message"}-${index}`,
      role,
      text,
      timestamp: event.timestamp || null
    });
  }

  return normalized;
}

function summarizeChat(projectName, filePath, messages) {
  const stats = fsSync.statSync(filePath);
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
    preview: (lastAssistant?.text || "").replace(/\s+/g, " ").slice(0, 180)
  };
}

async function listChats() {
  const projectsRoot = path.join(gigaDir, "projects");
  const roots = fileExists(projectsRoot) ? [projectsRoot] : [gigaDir];
  const chatFiles = [];

  for (const root of roots) {
    chatFiles.push(
      ...(await walk(root, (fullPath, name) => {
        const lower = name.toLowerCase();
        return lower.endsWith(".jsonl") && fullPath.toLowerCase().includes(`${path.sep}chats${path.sep}`);
      }))
    );
  }

  const chats = [];
  for (const filePath of chatFiles) {
    const messages = await readJsonl(filePath, null);
    const parts = path.relative(projectsRoot, filePath).split(path.sep);
    chats.push(summarizeChat(parts[0] || "global", filePath, messages));
  }

  return chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function parseSkill(skillDir, scope, projectPath = null) {
  const skillFile = path.join(skillDir, "SKILL.md");
  const raw = await fs.readFile(skillFile, "utf8").catch(() => "");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter = match?.[1] ?? "";
  const metadata = {};

  for (const line of frontmatter.split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_.:-]+):\s*(.*)$/);
    if (field) metadata[field[1]] = field[2].replace(/^["']|["']$/g, "");
  }

  return {
    name: metadata.name || path.basename(skillDir),
    description: metadata.description || "Нет описания",
    scope,
    path: skillDir,
    projectPath,
    disabled: metadata["disable-model-invocation"] === "true"
  };
}

async function listSkills(projectPath) {
  const roots = [
    { scope: "personal", dir: path.join(gigaDir, "skills") }
  ];

  const normalizedProjectPath = normalizePath(projectPath);
  if (normalizedProjectPath) {
    roots.push({ scope: "project", dir: path.join(normalizedProjectPath, ".gigacode", "skills"), projectPath: normalizedProjectPath });
  }

  const skills = [];
  for (const root of roots) {
    if (!fileExists(root.dir)) continue;
    const entries = await fs.readdir(root.dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(root.dir, entry.name);
      if (fileExists(path.join(skillDir, "SKILL.md"))) {
        skills.push(await parseSkill(skillDir, root.scope, root.projectPath));
      }
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function execGit(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

async function listWorktrees(repoPath) {
  const cwd = normalizePath(repoPath);
  if (!cwd) return [];
  const output = await execGit(["worktree", "list", "--porcelain"], cwd);
  const rows = [];
  let current = null;

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      if (current) rows.push(current);
      current = null;
      continue;
    }
    const [key, ...valueParts] = line.split(" ");
    if (key === "worktree") current = { path: valueParts.join(" ") };
    else if (current) current[key] = valueParts.join(" ");
  }
  if (current) rows.push(current);
  return rows;
}

function streamAgentRun({ prompt, cwd, sessionId }, res) {
  const args = [];
  const normalizedCwd = normalizePath(cwd);
  const runCwd = normalizedCwd && fileExists(normalizedCwd) ? normalizedCwd : process.cwd();

  if (sessionId) args.push("--resume", sessionId);
  args.push("--prompt", prompt, "--output-format", "stream-json", "--include-partial-messages");

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  const child = spawn("gigacode", args, { cwd: runCwd, windowsHide: true });
  const runId = randomUUID();

  child.stdout.on("data", (chunk) => {
    for (const line of chunk.toString("utf8").split(/\r?\n/).filter(Boolean)) {
      res.write(`event: message\ndata: ${line}\n\n`);
    }
  });

  child.stderr.on("data", (chunk) => {
    res.write(`event: stderr\ndata: ${JSON.stringify({ runId, text: chunk.toString("utf8") })}\n\n`);
  });

  child.on("error", (error) => {
    res.write(`event: error\ndata: ${JSON.stringify({ runId, error: error.message })}\n\n`);
    res.end();
  });

  child.on("close", (code) => {
    res.write(`event: done\ndata: ${JSON.stringify({ runId, code })}\n\n`);
    res.end();
  });
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "GigaCode-Harness",
    time: new Date().toISOString(),
    gigacodeHome: gigaDir,
    gigacodeHomeExists: fileExists(gigaDir)
  });
});

app.get("/api/chats", async (_req, res) => {
  try {
    res.json({ chats: await listChats(), root: gigaDir });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/chats/:id", async (req, res) => {
  const chats = await listChats();
  const chat = chats.find((item) => item.id === req.params.id);
  if (!chat) {
    res.status(404).json({ error: "Чат не найден" });
    return;
  }

  const messages = await readJsonl(chat.filePath, null);
  res.json({ chat: summarizeChat(chat.projectName, chat.filePath, messages), messages, displayMessages: normalizeChatMessages(messages) });
});

app.post("/api/chats/:id/continue", async (req, res) => {
  const prompt = String(req.body.prompt || "").trim();
  if (!prompt) {
    res.status(400).json({ error: "Нужно заполнить промпт" });
    return;
  }

  const chats = await listChats();
  const chat = chats.find((item) => item.id === req.params.id);
  if (!chat) {
    res.status(404).json({ error: "Чат не найден" });
    return;
  }

  streamAgentRun({ prompt, cwd: chat.cwd, sessionId: chat.sessionId || chat.id }, res);
});

app.get("/api/skills", async (req, res) => {
  try {
    res.json({ skills: await listSkills(req.query.projectPath), root: path.join(gigaDir, "skills") });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/skills/file", async (req, res) => {
  const skillPath = normalizePath(req.query.path);
  if (!skillPath || !isGigacodeSkillPath(skillPath) || !fileExists(path.join(skillPath, "SKILL.md"))) {
    res.status(404).json({ error: "Навык не найден" });
    return;
  }
  res.json({ content: await fs.readFile(path.join(skillPath, "SKILL.md"), "utf8") });
});

app.get("/api/worktrees", async (req, res) => {
  try {
    res.json({ worktrees: await listWorktrees(req.query.repoPath) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/worktrees", async (req, res) => {
  const repoPath = normalizePath(req.body.repoPath);
  const newPath = normalizePath(req.body.path);
  const branch = String(req.body.branch || "").trim();
  const base = String(req.body.base || "").trim();

  if (!repoPath || !newPath || !branch) {
    res.status(400).json({ error: "Нужно заполнить путь к репозиторию, путь worktree и ветку" });
    return;
  }

  try {
    const args = ["worktree", "add", "-b", branch, newPath];
    if (base) args.push(base);
    await execGit(args, repoPath);
    res.json({ ok: true, worktrees: await listWorktrees(repoPath) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/agent/run", (req, res) => {
  const prompt = String(req.body.prompt || "").trim();
  const cwd = normalizePath(req.body.cwd) || process.cwd();
  const sessionId = String(req.body.sessionId || "").trim();
  const args = [];

  if (!prompt) {
    res.status(400).json({ error: "Нужно заполнить промпт" });
    return;
  }

  if (sessionId) args.push("--resume", sessionId);
  args.push("--prompt", prompt, "--output-format", "stream-json", "--include-partial-messages");

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  const child = spawn("gigacode", args, { cwd, windowsHide: true });
  const runId = randomUUID();

  child.stdout.on("data", (chunk) => {
    for (const line of chunk.toString("utf8").split(/\r?\n/).filter(Boolean)) {
      res.write(`event: message\ndata: ${line}\n\n`);
    }
  });

  child.stderr.on("data", (chunk) => {
    res.write(`event: stderr\ndata: ${JSON.stringify({ runId, text: chunk.toString("utf8") })}\n\n`);
  });

  child.on("error", (error) => {
    res.write(`event: error\ndata: ${JSON.stringify({ runId, error: error.message })}\n\n`);
    res.end();
  });

  child.on("close", (code) => {
    res.write(`event: done\ndata: ${JSON.stringify({ runId, code })}\n\n`);
    res.end();
  });
});

app.use(express.static(clientDist));
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ error: "Не найдено" });
    return;
  }

  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(port, () => {
  console.log(`GigaCode-Harness API listening on http://localhost:${port}`);
});
