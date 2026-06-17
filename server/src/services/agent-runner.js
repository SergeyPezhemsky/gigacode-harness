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
  let childExited = false;

  const writeEvent = (event, payload) => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  reqSafeClose(res, () => {
    if (childExited || child.killed) return;
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!childExited) child.kill("SIGKILL");
    }, 1500).unref();
  });

  child.stdout.on("data", (chunk) => {
    for (const line of chunk.toString("utf8").split(/\r?\n/).filter(Boolean)) {
      if (res.writableEnded || res.destroyed) return;
      res.write(`event: message\ndata: ${line}\n\n`);
    }
  });

  child.stderr.on("data", (chunk) => {
    writeEvent("stderr", { runId, text: chunk.toString("utf8") });
  });

  child.on("error", (error) => {
    writeEvent("error", { runId, error: error.message });
    if (!res.writableEnded && !res.destroyed) res.end();
  });

  child.on("close", (code) => {
    childExited = true;
    writeEvent("done", { runId, code });
    if (!res.writableEnded && !res.destroyed) res.end();
  });
}

function reqSafeClose(res, onClose) {
  const req = res.req;
  if (!req) return;
  req.on("close", () => {
    if (!res.writableEnded) onClose();
  });
}
