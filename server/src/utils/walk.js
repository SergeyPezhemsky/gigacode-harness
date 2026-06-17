import fs from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./path-utils.js";

export async function walk(dir, predicate, maxDepth = 6, depth = 0) {
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
