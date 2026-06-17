# GigaCode Harness

Локальный веб-интерфейс для работы с GigaCode, внутренним форком Qwen Code.

Приложение запускается на машине разработчика и показывает:

- существующие чаты из `~/.gigacode`;
- личные и проектные навыки;
- список git worktree и создание новых worktree;
- минимальный запуск промптов через исполняемый файл `gigacode` с потоковым выводом.

## Разработка

```bash
npm install
npm run dev
```

- Фронтенд: http://localhost:5173
- Бэкенд: http://localhost:3001
- API health: http://localhost:3001/api/health

## Запуск в режиме, близком к production

```bash
npm run build
npm start
```

Откройте http://localhost:3001.

## Допущения по GigaCode

Harness переносит соглашения Qwen Code на GigaCode:

- `qwen` -> `gigacode`
- `~/.qwen` -> `~/.gigacode`
- `.qwen` -> `.gigacode`

Текущая реализация читает чаты из `~/.gigacode/projects/**/chats/*.jsonl`, читает навыки из `~/.gigacode/skills` и `<project>/.gigacode/skills`, а промпты запускает так:

```bash
gigacode --prompt "<prompt>" --output-format stream-json --include-partial-messages
```

SDD-план и заметки по документации Qwen Code лежат в [docs/specs/001-gigacode-harness.md](docs/specs/001-gigacode-harness.md).
