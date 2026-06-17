# GigaCode Harness Spec

## Context

GigaCode is treated as an enterprise fork of Qwen Code:

- executable: `gigacode` instead of `qwen`;
- user home directory: `~/.gigacode` instead of `~/.qwen`;
- project directory: `.gigacode` instead of `.qwen`;
- storage and command behavior should be assumed Qwen-compatible unless the fork proves otherwise.

Qwen Code documentation facts used for this design:

- Qwen Code is a terminal-first coding agent with skills and subagents.
- User settings are stored under `~/.qwen/settings.json`; project settings and project skills live under `.qwen/`.
- Skills are directories with a required `SKILL.md` file. Personal skills live under `~/.qwen/skills/`; project skills under `.qwen/skills/`.
- Headless mode supports `--prompt`, `--continue`, `--resume <session_id>`, and structured `--output-format json` / `stream-json`.
- Headless session data is project-scoped JSONL under `~/.qwen/projects/<sanitized-cwd>/chats`.
- Stream JSON plus partial messages is the preferred primitive for a web UI that needs live output.

For GigaCode Harness, every `.qwen`/`qwen` reference above maps to `.gigacode`/`gigacode`.

## Goals

1. Run a local web server and browser UI on the developer machine.
2. Show the list of existing GigaCode chats from `~/.gigacode`.
3. Show personal and project skills.
4. Create new git worktrees from the UI.
5. Provide a minimal prompt runner that invokes `gigacode` headlessly and streams events to the UI.

## Non-Goals For The First Slice

- Reimplement the full Codex terminal UI.
- Store secrets or model provider settings in the harness database.
- Modify GigaCode internal files beyond reading chats and skills.
- Replace GigaCode authentication.
- Manage remote Git hosting or PR creation.

## Requirements

### Chats

- Read from `~/.gigacode/projects/**/chats/*.jsonl`.
- If the projects layout is absent, scan `~/.gigacode/**/chats/*.jsonl` as a fallback.
- Show chat title, project identifier, update time, and preview.
- Load the selected chat JSONL on demand.
- Tolerate unknown JSONL event shapes and malformed lines.

### Skills

- Read personal skills from `~/.gigacode/skills/<skill>/SKILL.md`.
- If a project path is provided, also read project skills from `<project>/.gigacode/skills/<skill>/SKILL.md`.
- Parse YAML frontmatter fields `name`, `description`, and `disable-model-invocation`.
- Show the full `SKILL.md` for a selected skill.

### Worktrees

- Accept a repository path from the user.
- List worktrees using `git worktree list --porcelain`.
- Create worktrees using `git worktree add -b <branch> <path> <base>`.
- Use process argument arrays, not shell string interpolation.

### Agent Runner

- Accept `cwd` and prompt from UI.
- Run `gigacode --prompt <prompt> --output-format stream-json --include-partial-messages`.
- Optionally allow session resume later through `--resume <session_id>`.
- Stream stdout events to the browser using Server-Sent Events.
- Surface missing executable errors clearly.

## Architecture

### Backend

Express owns the local machine boundary:

- `GET /api/health`
- `GET /api/chats`
- `GET /api/chats/:id`
- `GET /api/skills?projectPath=...`
- `GET /api/skills/file?path=...`
- `GET /api/worktrees?repoPath=...`
- `POST /api/worktrees`
- `POST /api/agent/run`

The server performs filesystem and process work. The browser never reads local files directly.

### Frontend

React/Vite provides four primary views:

- Chats: list and inspect JSONL sessions.
- Skills: list personal/project skills and inspect `SKILL.md`.
- Worktrees: list and create isolated worktrees.
- Run: minimal streamed prompt execution.

The UI is task-first, not a marketing page.

## Open Questions

- Exact GigaCode session schema may differ from Qwen Code. Current parser intentionally handles unknown shapes.
- GigaCode may expose a local `serve` command or SDK-compatible binary. If available, the harness should prefer a stable protocol over raw CLI spawning.
- The worktree default target directory convention should be decided after real team usage. Current UI asks for explicit path to avoid guessing.

## Iteration Plan

### Phase 1: Local Read-Only Harness

- Health endpoint.
- Chat list and detail loading.
- Personal/project skill list and detail loading.
- Static production serving.

### Phase 2: Controlled Local Actions

- Worktree list/create.
- Prompt runner via headless `gigacode`.
- Better error reporting for missing Git/GigaCode.

### Phase 3: Codex-Like Workflow

- Chat continuation and resume controls.
- Per-worktree active agent runs.
- Approval/status panels for tool calls.
- Session export/import.

### Phase 4: Team Hardening

- Configurable allowed roots.
- Audit log for process actions.
- Optional auth on localhost.
- Tests around path parsing, JSONL parsing, and git command construction.
