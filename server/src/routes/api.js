import express from "express";
import path from "node:path";
import { gigaDir } from "../config.js";
import { fileExists, isGigacodeSkillPath, normalizePath } from "../utils/path-utils.js";
import { getChatById, listChats } from "../services/chat-service.js";
import { listSkills, readSkillContent, setProjectSkillEnabled } from "../services/skill-service.js";
import { createWorktree, listWorktrees } from "../services/git-service.js";
import { streamAgentRun } from "../services/agent-runner.js";
import { addProject, listProjects } from "../services/project-service.js";

export function createApiRouter() {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "GigaCode-Harness",
      time: new Date().toISOString(),
      gigacodeHome: gigaDir,
      gigacodeHomeExists: fileExists(gigaDir)
    });
  });

  router.get("/chats", async (_req, res) => {
    try {
      res.json({ chats: await listChats(), root: gigaDir });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/projects", async (_req, res) => {
    try {
      const chats = await listChats();
      res.json({ projects: await listProjects(chats) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/projects", async (req, res) => {
    try {
      const project = await addProject({
        name: req.body.name,
        projectPath: req.body.path
      });
      const chats = await listChats();
      res.json({ ok: true, project, projects: await listProjects(chats) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get("/chats/:id", async (req, res) => {
    const payload = await getChatById(req.params.id);
    if (!payload) {
      res.status(404).json({ error: "Чат не найден" });
      return;
    }

    res.json(payload);
  });

  router.post("/chats/:id/continue", async (req, res) => {
    const prompt = String(req.body.prompt || "").trim();
    if (!prompt) {
      res.status(400).json({ error: "Нужно заполнить промпт" });
      return;
    }

    const payload = await getChatById(req.params.id);
    if (!payload) {
      res.status(404).json({ error: "Чат не найден" });
      return;
    }

    streamAgentRun({ prompt, cwd: payload.chat.cwd, sessionId: payload.chat.sessionId || payload.chat.id }, res);
  });

  router.get("/skills", async (req, res) => {
    try {
      res.json({ skills: await listSkills(req.query.projectPath), root: path.join(gigaDir, "skills") });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/skills/file", async (req, res) => {
    const skillPath = normalizePath(req.query.path);
    if (!skillPath || !isGigacodeSkillPath(skillPath) || !fileExists(path.join(skillPath, "SKILL.md"))) {
      res.status(404).json({ error: "Навык не найден" });
      return;
    }

    res.json({ content: await readSkillContent(skillPath) });
  });

  router.post("/skills/toggle", async (req, res) => {
    try {
      const skills = await setProjectSkillEnabled({
        projectPath: req.body.projectPath,
        skillName: req.body.skillName,
        enabled: Boolean(req.body.enabled)
      });
      res.json({ ok: true, skills });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get("/worktrees", async (req, res) => {
    try {
      res.json({ worktrees: await listWorktrees(req.query.repoPath) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post("/worktrees", async (req, res) => {
    try {
      const worktrees = await createWorktree(req.body);
      res.json({ ok: true, worktrees });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post("/agent/run", (req, res) => {
    const prompt = String(req.body.prompt || "").trim();
    const cwd = normalizePath(req.body.cwd) || process.cwd();
    const sessionId = String(req.body.sessionId || "").trim();

    if (!prompt) {
      res.status(400).json({ error: "Нужно заполнить промпт" });
      return;
    }

    streamAgentRun({ prompt, cwd, sessionId }, res);
  });

  router.use((_req, res) => {
    res.status(404).json({ error: "Не найдено" });
  });

  return router;
}
