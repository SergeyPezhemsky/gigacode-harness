import { execFile } from "node:child_process";
import { normalizePath } from "../utils/path-utils.js";

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

export async function listWorktrees(repoPath) {
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

export async function createWorktree({ repoPath, path, branch, base }) {
  const repo = normalizePath(repoPath);
  const newPath = normalizePath(path);
  const normalizedBranch = String(branch || "").trim();
  const normalizedBase = String(base || "").trim();

  if (!repo || !newPath || !normalizedBranch) {
    throw new Error("Нужно заполнить путь к репозиторию, путь worktree и ветку");
  }

  const args = ["worktree", "add", "-b", normalizedBranch, newPath];
  if (normalizedBase) args.push(normalizedBase);

  await execGit(args, repo);
  return listWorktrees(repo);
}
