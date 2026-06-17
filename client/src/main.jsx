import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const tabs = [
  { label: "Чаты", value: "chats" },
  { label: "Навыки", value: "skills" },
  { label: "Ворк-три", value: "worktrees" },
  { label: "Запуск", value: "run" }
];

const roleLabels = {
  assistant: "GigaCode",
  user: "Вы",
  system: "Система",
  event: "Событие",
  result: "GigaCode",
  raw: "Сырой текст",
  stderr: "Ошибка",
  done: "Готово"
};

const scopeLabels = {
  personal: "Личный",
  project: "Проектный"
};

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Запрос не выполнен");
  return data;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function extractText(value, depth = 0) {
  if (value == null || depth > 5) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((part) => extractText(part, depth + 1))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value !== "object") return "";

  const candidates = [
    value.text,
    value.content,
    value.delta,
    value.result,
    value.output,
    value.output_text,
    value.message,
    value.parts
  ];

  for (const candidate of candidates) {
    const text = extractText(candidate, depth + 1);
    if (text) return text;
  }

  return "";
}

function messageText(item) {
  return extractText(item?.message ?? item);
}

function roleOf(item) {
  const role = item?.message?.role || item?.role || item?.type || "event";
  if (role === "result") return "assistant";
  if (role === "stderr") return "stderr";
  if (role === "raw") return "raw";
  return role;
}

function displayRole(item) {
  return roleLabels[roleOf(item)] || roleOf(item);
}

function toChatMessages(messages) {
  return messages
    .map((item, index) => {
      const role = roleOf(item);
      const text = messageText(item).trim();
      return { id: item.uuid || item.id || index, role, text };
    })
    .filter((item) => item.text && ["user", "assistant", "system", "raw"].includes(item.role));
}

function App() {
  const [activeTab, setActiveTab] = useState("chats");
  const [health, setHealth] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [skills, setSkills] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [skillContent, setSkillContent] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [worktrees, setWorktrees] = useState([]);
  const [worktreeForm, setWorktreeForm] = useState({ path: "", branch: "", base: "HEAD" });
  const [runForm, setRunForm] = useState({ cwd: "", prompt: "" });
  const [runEvents, setRunEvents] = useState([]);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const stats = useMemo(
    () => [
      { label: "Чаты", value: chats.length },
      { label: "Навыки", value: skills.length },
      { label: "Ворк-три", value: worktrees.length }
    ],
    [chats.length, skills.length, worktrees.length]
  );

  useEffect(() => {
    refreshBase();
  }, []);

  async function refreshBase() {
    setError("");
    try {
      const [healthData, chatsData, skillsData] = await Promise.all([
        api("/api/health"),
        api("/api/chats"),
        api("/api/skills")
      ]);
      setHealth(healthData);
      setChats(chatsData.chats);
      setSkills(skillsData.skills);
    } catch (err) {
      setError(err.message);
    }
  }

  async function openChat(chat) {
    setSelectedChat(chat);
    setError("");
    try {
      const data = await api(`/api/chats/${encodeURIComponent(chat.id)}`);
      setChatMessages(data.messages);
    } catch (err) {
      setError(err.message);
    }
  }

  async function openSkill(skill) {
    setSelectedSkill(skill);
    setError("");
    try {
      const data = await api(`/api/skills/file?path=${encodeURIComponent(skill.path)}`);
      setSkillContent(data.content);
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshSkillsForProject() {
    setError("");
    try {
      const data = await api(`/api/skills?projectPath=${encodeURIComponent(repoPath)}`);
      setSkills(data.skills);
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshWorktrees() {
    setLoading("worktrees");
    setError("");
    try {
      const data = await api(`/api/worktrees?repoPath=${encodeURIComponent(repoPath)}`);
      setWorktrees(data.worktrees);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function createWorktree(event) {
    event.preventDefault();
    setLoading("create-worktree");
    setError("");
    try {
      const data = await api("/api/worktrees", {
        method: "POST",
        body: JSON.stringify({ repoPath, ...worktreeForm })
      });
      setWorktrees(data.worktrees);
      setWorktreeForm({ path: "", branch: "", base: "HEAD" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function runPrompt(event) {
    event.preventDefault();
    setRunEvents([]);
    setError("");

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runForm)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Не удалось запустить gigacode");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          try {
            setRunEvents((items) => [...items, JSON.parse(dataLine.slice(6))]);
          } catch {
            setRunEvents((items) => [...items, { type: "raw", text: dataLine.slice(6) }]);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className={health?.ok ? "status-dot online" : "status-dot"} />
          <div>
            <strong>GigaCode Harness</strong>
            <small>{health?.gigacodeHomeExists ? health.gigacodeHome : ".gigacode не найден"}</small>
          </div>
        </div>

        <nav>
          {tabs.map((tab) => (
            <button key={tab.value} className={activeTab === tab.value ? "active" : ""} onClick={() => setActiveTab(tab.value)}>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="stat-list">
          {stats.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{tabs.find((tab) => tab.value === activeTab)?.label}</h1>
            <p>Локальная панель для сессий GigaCode, навыков и изолированных git worktree.</p>
          </div>
          <button onClick={refreshBase}>Обновить</button>
        </header>

        {error ? <div className="alert">{error}</div> : null}

        {activeTab === "chats" ? (
          <section className="split">
            <div className="list-pane">
              {chats.length ? (
                chats.map((chat) => (
                  <button
                    key={chat.filePath}
                    className={selectedChat?.id === chat.id ? "list-item selected" : "list-item"}
                    onClick={() => openChat(chat)}
                  >
                    <strong>{chat.title}</strong>
                    <span>{chat.projectName}</span>
                    <small>{formatDate(chat.updatedAt)}</small>
                  </button>
                ))
              ) : (
                <EmptyState title="Чаты не найдены" detail="Ожидаются файлы .gigacode/projects/*/chats/*.jsonl." />
              )}
            </div>
            <div className="detail-pane">
              {selectedChat ? (
                <>
                  <div className="detail-header">
                    <strong>{selectedChat.title}</strong>
                    <small>{selectedChat.filePath}</small>
                  </div>
                  <div className="messages chat-thread">
                    {toChatMessages(chatMessages).map((item) => (
                      <article key={item.id} className={`message ${item.role}`}>
                        <span>{roleLabels[item.role] || item.role}</span>
                        <pre>{item.text}</pre>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState title="Выберите чат" detail="Содержимое загружается из JSONL по запросу." />
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "skills" ? (
          <section className="split">
            <div className="list-pane">
              <div className="inline-form">
                <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} placeholder="Путь к проекту для .gigacode/skills" />
                <button onClick={refreshSkillsForProject}>Загрузить</button>
              </div>
              {skills.length ? (
                skills.map((skill) => (
                  <button
                    key={skill.path}
                    className={selectedSkill?.path === skill.path ? "list-item selected" : "list-item"}
                    onClick={() => openSkill(skill)}
                  >
                    <strong>{skill.name}</strong>
                    <span>{skill.description}</span>
                    <small>{scopeLabels[skill.scope] || skill.scope}</small>
                  </button>
                ))
              ) : (
                <EmptyState title="Навыки не найдены" detail="Личные навыки ожидаются в ~/.gigacode/skills." />
              )}
            </div>
            <div className="detail-pane">
              {selectedSkill ? (
                <>
                  <div className="detail-header">
                    <strong>{selectedSkill.name}</strong>
                    <small>{selectedSkill.path}</small>
                  </div>
                  <pre className="skill-body">{skillContent}</pre>
                </>
              ) : (
                <EmptyState title="Выберите навык" detail="Здесь появится полный SKILL.md." />
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "worktrees" ? (
          <section className="worktree-layout">
            <div className="toolbar">
              <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} placeholder="Путь к репозиторию" />
              <button onClick={refreshWorktrees} disabled={loading === "worktrees"}>Показать</button>
            </div>
            <form className="create-form" onSubmit={createWorktree}>
              <input value={worktreeForm.path} onChange={(event) => setWorktreeForm({ ...worktreeForm, path: event.target.value })} placeholder="Путь нового worktree" />
              <input value={worktreeForm.branch} onChange={(event) => setWorktreeForm({ ...worktreeForm, branch: event.target.value })} placeholder="Новая ветка" />
              <input value={worktreeForm.base} onChange={(event) => setWorktreeForm({ ...worktreeForm, base: event.target.value })} placeholder="Базовый ref" />
              <button disabled={loading === "create-worktree"}>Создать</button>
            </form>
            <div className="table">
              {worktrees.map((worktree) => (
                <div key={worktree.path} className="row">
                  <strong>{worktree.branch || "без ветки"}</strong>
                  <span>{worktree.path}</span>
                  <small>{worktree.HEAD}</small>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "run" ? (
          <section className="run-layout">
            <form onSubmit={runPrompt}>
              <input value={runForm.cwd} onChange={(event) => setRunForm({ ...runForm, cwd: event.target.value })} placeholder="Рабочая директория" />
              <textarea value={runForm.prompt} onChange={(event) => setRunForm({ ...runForm, prompt: event.target.value })} placeholder="Промпт для gigacode" />
              <button>Запустить gigacode</button>
            </form>
            <div className="messages">
              {runEvents.map((event, index) => (
                <article key={index} className={`message ${event.type || "event"}`}>
                  <span>{displayRole(event)}</span>
                  <pre>{messageText(event) || JSON.stringify(event, null, 2)}</pre>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function EmptyState({ title, detail }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
