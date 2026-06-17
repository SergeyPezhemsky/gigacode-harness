import fs from "node:fs/promises";

export async function readJsonl(filePath, limit = 200) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    const selectedLines = limit ? lines.slice(-limit) : lines;

    return selectedLines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { type: "raw", text: line };
      }
    });
  } catch {
    return [];
  }
}
