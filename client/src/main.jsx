import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const tabs = ["Chats", "Skills", "Worktrees", "Run"];

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function messageText(item) {
  const payload = item?.message ?? item;
  const content = payload?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => part?.text || part?.content || "").filter(Boolean).join("\n");
  }
  return item?.result || item?.text || "";
}

function roleOf(item) {
  return item?.message?.role || item?.type || "event";
}

function App() {
  const [activeTab, setActiveTab] = useState("Chats");
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
      { label: "Chats", value: chats.length },
      { label: "Skills", value: skills.length },
      { label: "Worktrees", value: worktrees.length }
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
        throw new Error(data.error || "Unable to start gigacode");
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
            <small>{health?.gigacodeHomeExists ? health.gigacodeHome : ".gigacode not found"}</small>
          </div>
        </div>

        <nav>
          {tabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
              {tab}
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
            <h1>{activeTab}</h1>
            <p>Local web control surface for GigaCode sessions, skills, and isolated worktrees.</p>
          </div>
          <button onClick={refreshBase}>Refresh</button>
        </header>

        {error ? <div className="alert">{error}</div> : null}

        {activeTab === "Chats" ? (
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
                <EmptyState title="No chats found" detail="Expected .gigacode/projects/*/chats/*.jsonl." />
              )}
            </div>
            <div className="detail-pane">
              {selectedChat ? (
                <>
                  <div className="detail-header">
                    <strong>{selectedChat.title}</strong>
                    <small>{selectedChat.filePath}</small>
                  </div>
                  <div className="messages">
                    {chatMessages.map((item, index) => (
                      <article key={`${item.uuid || index}`} className={`message ${roleOf(item)}`}>
                        <span>{roleOf(item)}</span>
                        <pre>{messageText(item) || JSON.stringify(item, null, 2)}</pre>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState title="Select a chat" detail="Chat contents are loaded from JSONL on demand." />
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "Skills" ? (
          <section className="split">
            <div className="list-pane">
              <div className="inline-form">
                <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} placeholder="Project path for .gigacode/skills" />
                <button onClick={refreshSkillsForProject}>Load</button>
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
                    <small>{skill.scope}</small>
                  </button>
                ))
              ) : (
                <EmptyState title="No skills found" detail="Personal skills are expected under ~/.gigacode/skills." />
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
                <EmptyState title="Select a skill" detail="The full SKILL.md appears here." />
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "Worktrees" ? (
          <section className="worktree-layout">
            <div className="toolbar">
              <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} placeholder="Repository path" />
              <button onClick={refreshWorktrees} disabled={loading === "worktrees"}>List</button>
            </div>
            <form className="create-form" onSubmit={createWorktree}>
              <input value={worktreeForm.path} onChange={(event) => setWorktreeForm({ ...worktreeForm, path: event.target.value })} placeholder="New worktree path" />
              <input value={worktreeForm.branch} onChange={(event) => setWorktreeForm({ ...worktreeForm, branch: event.target.value })} placeholder="New branch" />
              <input value={worktreeForm.base} onChange={(event) => setWorktreeForm({ ...worktreeForm, base: event.target.value })} placeholder="Base ref" />
              <button disabled={loading === "create-worktree"}>Create</button>
            </form>
            <div className="table">
              {worktrees.map((worktree) => (
                <div key={worktree.path} className="row">
                  <strong>{worktree.branch || "detached"}</strong>
                  <span>{worktree.path}</span>
                  <small>{worktree.HEAD}</small>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "Run" ? (
          <section className="run-layout">
            <form onSubmit={runPrompt}>
              <input value={runForm.cwd} onChange={(event) => setRunForm({ ...runForm, cwd: event.target.value })} placeholder="Working directory" />
              <textarea value={runForm.prompt} onChange={(event) => setRunForm({ ...runForm, prompt: event.target.value })} placeholder="Prompt for gigacode" />
              <button>Run gigacode</button>
            </form>
            <div className="messages">
              {runEvents.map((event, index) => (
                <article key={index} className={`message ${event.type || "event"}`}>
                  <span>{event.type || event.subtype || "event"}</span>
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
