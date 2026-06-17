import fs from "node:fs/promises";
import path from "node:path";
import { gigaDir } from "../config.js";
import { fileExists, normalizePath } from "../utils/path-utils.js";

const projectsFile = path.join(gigaDir, "harness-projects.json");

function projectId(projectPath) {
  return Buffer.from(projectPath.toLowerCase()).toString("base64url");
}

function projectName(projectPath) {
  return path.basename(projectPath) || projectPath;
}

function toProject(projectPath, overrides = {}) {
  const normalizedPath = normalizePath(projectPath);
  return {
    id: projectId(normalizedPath),
    name: overrides.name || projectName(normalizedPath),
    path: normalizedPath,
    source: overrides.source || "saved",
    hasGigacode: fileExists(path.join(normalizedPath, ".gigacode")),
    current: normalizedPath === process.cwd()
  };
}

async function readSavedProjects() {
  try {
    const content = await fs.readFile(projectsFile, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.projects) ? parsed.projects : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeSavedProjects(projects) {
  await fs.mkdir(gigaDir, { recursive: true });
  await fs.writeFile(projectsFile, `${JSON.stringify({ projects }, null, 2)}\n`, "utf8");
}

function mergeProjects(projects) {
  const map = new Map();
  for (const project of projects) {
    if (!project?.path) continue;
    const normalizedPath = normalizePath(project.path);
    if (!normalizedPath) continue;
    const id = projectId(normalizedPath);
    map.set(id, { ...toProject(normalizedPath, project), id });
  }

  return [...map.values()].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function listProjects(chats = []) {
  const saved = await readSavedProjects();
  const fromChats = chats
    .filter((chat) => chat.cwd)
    .map((chat) => ({
      name: chat.projectName || projectName(chat.cwd),
      path: chat.cwd,
      source: "chat"
    }));

  return mergeProjects([
    { name: projectName(process.cwd()), path: process.cwd(), source: "current" },
    ...saved,
    ...fromChats
  ]);
}

export async function addProject({ name, projectPath }) {
  const normalizedPath = normalizePath(projectPath);
  if (!normalizedPath || !fileExists(normalizedPath)) {
    throw new Error("Project directory not found");
  }

  const saved = await readSavedProjects();
  const nextProject = toProject(normalizedPath, {
    name: String(name || "").trim() || projectName(normalizedPath),
    source: "saved"
  });
  const next = mergeProjects([...saved, nextProject]).filter((project) => project.source !== "chat");
  await writeSavedProjects(next.map(({ name: itemName, path: itemPath }) => ({ name: itemName, path: itemPath })));
  return nextProject;
}
