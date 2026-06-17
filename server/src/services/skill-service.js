import fs from "node:fs/promises";
import path from "node:path";
import { gigaDir } from "../config.js";
import { fileExists, normalizePath } from "../utils/path-utils.js";

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

export async function listSkills(projectPath) {
  const roots = [{ scope: "personal", dir: path.join(gigaDir, "skills") }];
  const normalizedProjectPath = normalizePath(projectPath);

  if (normalizedProjectPath) {
    roots.push({
      scope: "project",
      dir: path.join(normalizedProjectPath, ".gigacode", "skills"),
      projectPath: normalizedProjectPath
    });
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

export async function readSkillContent(skillPath) {
  return fs.readFile(path.join(skillPath, "SKILL.md"), "utf8");
}
