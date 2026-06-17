# GigaCode Harness

Local web UI for working with GigaCode, an internal fork of Qwen Code.

The app runs on the developer machine and exposes:

- existing chats from `~/.gigacode`;
- personal and project skills;
- git worktree listing and creation;
- a minimal streamed prompt runner through the `gigacode` executable.

## Development

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- API health: http://localhost:3001/api/health

## Production-Style Run

```bash
npm run build
npm start
```

Open http://localhost:3001.

## GigaCode Assumptions

This harness maps Qwen Code conventions to GigaCode:

- `qwen` -> `gigacode`
- `~/.qwen` -> `~/.gigacode`
- `.qwen` -> `.gigacode`

The current implementation reads chats from `~/.gigacode/projects/**/chats/*.jsonl`, reads skills from `~/.gigacode/skills` and `<project>/.gigacode/skills`, and runs prompts with:

```bash
gigacode --prompt "<prompt>" --output-format stream-json --include-partial-messages
```

See [docs/specs/001-gigacode-harness.md](docs/specs/001-gigacode-harness.md) for the spec-driven plan and Qwen Code documentation notes.
