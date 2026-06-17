import fs from "node:fs";
import path from "node:path";
import { gigaDir } from "../config.js";

export function normalizePath(input) {
  if (!input || typeof input !== "string") return null;
  return path.resolve(input.trim());
}

export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

export function isChildPath(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function isGigacodeSkillPath(skillPath) {
  const normalized = path.normalize(skillPath);
  const personalRoot = path.normalize(path.join(gigaDir, "skills"));
  const projectSegment = `${path.sep}.gigacode${path.sep}skills${path.sep}`.toLowerCase();

  return (
    normalized === personalRoot ||
    isChildPath(personalRoot, normalized) ||
    normalized.toLowerCase().includes(projectSegment)
  );
}
