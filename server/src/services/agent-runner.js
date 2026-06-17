import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileExists, normalizePath } from "../utils/path-utils.js";

function buildAgentArgs({ prompt, sessionId }) {
  const args = [];
  if (sessionId) args.push("--resume", sessionId);
  args.push("--prompt", prompt, "--output-format", "stream-json", "--include-partial-messages");
  return args;
}

export function streamAgentRun({ prompt, cwd, sessionId }, res) {
  const normalizedCwd = normalizePath(cwd);
  const runCwd = normalizedCwd && fileExists(normalizedCwd) ? normalizedCwd : process.cwd();
  const child = spawn("gigacode", buildAgentArgs({ prompt, sessionId }), { cwd: runCwd, windowsHide: true });
  const runId = randomUUID();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

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
