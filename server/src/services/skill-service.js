import fs from "node:fs/promises";
import path from "node:path";
import { gigaDir } from "../config.js";
import { fileExists, isChildPath, normalizePath } from "../utils/path-utils.js";

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
    id: path.basename(skillDir),
    dirName: path.basename(skillDir),
    name: metadata.name || path.basename(skillDir),
    description: metadata.description || "Нет описания",
    scope,
    path: skillDir,
    projectPath,
    disabled: metadata["disable-model-invocation"] === "true"
  };
}

async function listSkillRoot(root) {
  if (!fileExists(root.dir)) return [];

  const entries = await fs.readdir(root.dir, { withFileTypes: true }).catch(() => []);
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(root.dir, entry.name);
    if (fileExists(path.join(skillDir, "SKILL.md"))) {
      skills.push(await parseSkill(skillDir, root.scope, root.projectPath));
    }
  }

  return skills;
}

export async function listSkills(projectPath) {
  const libraryRoot = path.join(gigaDir, "skills");
  const librarySkills = await listSkillRoot({ scope: "library", dir: libraryRoot });
  const normalizedProjectPath = normalizePath(projectPath);
  const projectRoot = normalizedProjectPath ? path.join(normalizedProjectPath, ".gigacode", "skills") : null;
  const projectSkills = projectRoot
    ? await listSkillRoot({ scope: "project", dir: projectRoot, projectPath: normalizedProjectPath })
    : [];

  if (!normalizedProjectPath) {
    return librarySkills
      .map((skill) => ({
        ...skill,
        installed: false,
        canToggle: false,
        libraryPath: skill.path,
        projectSkillPath: null
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const projectByDir = new Map(projectSkills.map((skill) => [skill.dirName, skill]));
  const libraryByDir = new Map(librarySkills.map((skill) => [skill.dirName, skill]));
  const skills = librarySkills.map((librarySkill) => {
    const projectSkill = projectByDir.get(librarySkill.dirName);
    return {
      ...librarySkill,
      scope: projectSkill ? "project" : "library",
      path: projectSkill?.path || librarySkill.path,
      installed: Boolean(projectSkill),
      canToggle: true,
      libraryPath: librarySkill.path,
      projectSkillPath: projectSkill?.path || path.join(projectRoot, librarySkill.dirName),
      projectPath: normalizedProjectPath
    };
  });

  for (const projectSkill of projectSkills) {
    if (libraryByDir.has(projectSkill.dirName)) continue;
    skills.push({
      ...projectSkill,
      installed: true,
      canToggle: true,
      libraryPath: null,
      projectSkillPath: projectSkill.path
    });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readSkillContent(skillPath) {
  return fs.readFile(path.join(skillPath, "SKILL.md"), "utf8");
}

function assertSkillDirectoryName(skillName) {
  const value = String(skillName || "").trim();
  if (!value || value !== path.basename(value) || value.includes("/") || value.includes("\\")) {
    throw new Error("Invalid skill name");
  }

  return value;
}

function assertProjectSkillPath(projectSkillRoot, skillPath) {
  const normalizedRoot = path.normalize(projectSkillRoot);
  const normalizedSkillPath = path.normalize(skillPath);
  if (normalizedSkillPath !== normalizedRoot && !isChildPath(normalizedRoot, normalizedSkillPath)) {
    throw new Error("Refusing to modify a skill outside the project");
  }
}

export async function setProjectSkillEnabled({ projectPath, skillName, enabled }) {
  const normalizedProjectPath = normalizePath(projectPath);
  if (!normalizedProjectPath || !fileExists(normalizedProjectPath)) {
    throw new Error("Project directory not found");
  }

  const directoryName = assertSkillDirectoryName(skillName);
  const librarySkillPath = path.join(gigaDir, "skills", directoryName);
  const projectSkillRoot = path.join(normalizedProjectPath, ".gigacode", "skills");
  const projectSkillPath = path.join(projectSkillRoot, directoryName);
  assertProjectSkillPath(projectSkillRoot, projectSkillPath);

  if (enabled) {
    if (!fileExists(path.join(librarySkillPath, "SKILL.md"))) {
      throw new Error("Skill not found in the library");
    }

    await fs.mkdir(projectSkillRoot, { recursive: true });
    if (!fileExists(projectSkillPath)) {
      await fs.cp(librarySkillPath, projectSkillPath, { recursive: true });
    }
  } else {
    await fs.rm(projectSkillPath, { recursive: true, force: true });
  }

  return listSkills(normalizedProjectPath);
}
