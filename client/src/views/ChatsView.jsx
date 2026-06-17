import { useEffect, useRef, useState } from "react";
import { api, readSse } from "../api.js";
import { ChatListItem } from "../components/ChatListItem.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { StatusChip } from "../components/StatusChip.jsx";
import { roleLabels } from "../constants.js";
import { formatDate } from "../utils/format.js";
import { thinkingText, toChatMessages, upsertMessage } from "../utils/messages.js";

export function ChatsView({
  chats,
  projects,
  selectedProject,
  selectedProjectId,
  setSelectedProjectId,
  selectedChat,
  setSelectedChat,
  chatMessages,
  setChatMessages,
  refreshBase,
  setError
}) {
  const [chatRunEvents, setChatRunEvents] = useState([]);
  const [chatRunDone, setChatRunDone] = useState(true);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [newChatForm, setNewChatForm] = useState({ cwd: "", prompt: "" });
  const [projectForm, setProjectForm] = useState({ name: "", path: "" });
  const [continuePrompt, setContinuePrompt] = useState("");
  const [loading, setLoading] = useState("");
  const chatThreadRef = useRef(null);
  const abortRef = useRef(null);

  const activeProjectPath = selectedProject?.path || "";
  const visibleChats = activeProjectPath ? chats.filter((chat) => chat.cwd === activeProjectPath) : chats;
  const visibleMessages = toChatMessages(chatMessages);
  const runState = loading ? "running" : chatRunDone ? "idle" : "streaming";
  const inspectorTitle = isCreatingChat ? "Новая сессия" : selectedChat ? "Текущий чат" : "Контекст";

  useEffect(() => {
    if (!chatThreadRef.current) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!chatThreadRef.current) return;
        chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight;
      });
    });
  }, [visibleMessages.length, selectedChat, isCreatingChat]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setNewChatForm((current) => ({ ...current, cwd: selectedProject.path }));
  }, [selectedProject]);

  async function loadChatById(id) {
    const data = await api(`/api/chats/${encodeURIComponent(id)}`);
    setSelectedChat(data.chat);
    setChatMessages(data.displayMessages || data.messages);
    return data.chat;
  }

  async function openChat(chat) {
    abortRef.current?.abort();
    setSelectedChat(chat);
    setIsCreatingChat(false);
    setChatRunEvents([]);
    setChatRunDone(true);
    setContinuePrompt("");
    setError("");
    try {
      await loadChatById(chat.id);
    } catch (err) {
      setError(err.message);
    }
  }

  function startNewChat() {
    abortRef.current?.abort();
    setSelectedChat(null);
    setChatMessages([]);
    setChatRunEvents([]);
    setChatRunDone(true);
    setContinuePrompt("");
    setNewChatForm((current) => ({ ...current, cwd: activeProjectPath }));
    setIsCreatingChat(true);
    setError("");
  }

  async function addProject(event) {
    event.preventDefault();
    const projectPath = projectForm.path.trim();
    if (!projectPath) return;

    setLoading("add-project");
    setError("");
    try {
      const data = await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: projectForm.name.trim(), path: projectPath })
      });
      setProjectForm({ name: "", path: "" });
      const nextProject = data.project || data.projects.find((project) => project.path === projectPath);
      if (nextProject) setSelectedProjectId(nextProject.id);
      await refreshBase();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function createChat(event) {
    event.preventDefault();
    const prompt = newChatForm.prompt.trim();
    if (!prompt) return;

    const cwd = newChatForm.cwd.trim() || activeProjectPath;
    const knownChatIds = new Set(chats.map((chat) => chat.id));
    setLoading("create-chat");
    setError("");
    setChatRunEvents([]);
    setChatRunDone(false);
    setChatMessages([{ id: `local-${Date.now()}`, role: "user", text: prompt }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, prompt }),
        signal: controller.signal
      });

      let streamEvents = [];
      const assistantDraftId = `assistant-${Date.now()}`;
      let exitCode = 0;
      let sessionId = "";

      await readSse(response, (eventData) => {
        streamEvents = [...streamEvents, eventData];
        sessionId ||= extractSessionId(eventData);
        appendRunThought(eventData);
        if (eventData.type === "done") exitCode = eventData.code ?? 0;

        const assistantMessage = toChatMessages([eventData]).find((message) => message.role === "assistant");
        if (assistantMessage) {
          setChatMessages((items) => upsertMessage(items, assistantMessage, assistantDraftId));
        }
      });

      const refreshed = await refreshBase();
      const nextChats = refreshed?.chats || [];
      const createdChat = nextChats.find((chat) => chat.id === sessionId) || nextChats.find((chat) => !knownChatIds.has(chat.id));
      if (createdChat) {
        await loadChatById(createdChat.id);
        setIsCreatingChat(false);
        setNewChatForm({ cwd, prompt: "" });
      } else {
        setChatMessages(toChatMessages(streamEvents));
      }
      if (exitCode !== 0) {
        throw new Error(`GigaCode завершился с кодом ${exitCode}`);
      }
    } catch (err) {
      handleRunError(err);
    } finally {
      abortRef.current = null;
      setChatRunDone(true);
      setLoading("");
    }
  }

  async function continueChat(event) {
    event.preventDefault();
    const prompt = continuePrompt.trim();
    if (!selectedChat || !prompt) return;

    setLoading("continue-chat");
    setError("");
    setContinuePrompt("");
    setChatRunEvents([]);
    setChatRunDone(false);
    setChatMessages((items) => [...items, { id: `local-${Date.now()}`, role: "user", text: prompt }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch(`/api/chats/${encodeURIComponent(selectedChat.id)}/continue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal
      });

      let streamEvents = [];
      const assistantDraftId = `assistant-${Date.now()}`;
      let exitCode = 0;

      await readSse(response, (eventData) => {
        streamEvents = [...streamEvents, eventData];
        appendRunThought(eventData);
        if (eventData.type === "done") exitCode = eventData.code ?? 0;

        const assistantMessage = toChatMessages([eventData]).find((message) => message.role === "assistant");
        if (assistantMessage) {
          setChatMessages((items) => upsertMessage(items, assistantMessage, assistantDraftId));
        }
      });

      const refreshed = await api(`/api/chats/${encodeURIComponent(selectedChat.id)}`);
      setSelectedChat(refreshed.chat);
      setChatMessages(refreshed.displayMessages?.length ? refreshed.displayMessages : toChatMessages(streamEvents));
      await refreshBase();
      if (exitCode !== 0) {
        throw new Error(`GigaCode завершился с кодом ${exitCode}`);
      }
    } catch (err) {
      handleRunError(err);
    } finally {
      abortRef.current = null;
      setChatRunDone(true);
      setLoading("");
    }
  }

  function appendRunThought(eventData) {
    const thought = thinkingText(eventData);
    if (thought) {
      setChatRunEvents((items) => [...items, { id: `${Date.now()}-${items.length}`, text: thought }]);
    }
  }

  function handleRunError(err) {
    if (err.name === "AbortError") {
      setChatRunEvents((items) => [...items, { id: `stopped-${Date.now()}`, text: "Процесс остановлен пользователем" }]);
    } else {
      setError(err.message);
    }
  }

  function stopChatRun() {
    abortRef.current?.abort();
  }

  return (
    <section className="chat-dashboard">
      <div className="list-pane chat-list-pane">
        <div className="project-switcher">
          <label>
            <span>Проект</span>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <small>{activeProjectPath || "Проект не выбран"}</small>
          <form className="project-form" onSubmit={addProject}>
            <input
              value={projectForm.name}
              onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
              placeholder="Название"
            />
            <input
              value={projectForm.path}
              onChange={(event) => setProjectForm({ ...projectForm, path: event.target.value })}
              placeholder="Директория проекта"
            />
            <button disabled={loading === "add-project" || !projectForm.path.trim()}>Добавить</button>
          </form>
        </div>
        <button className="new-chat-button" onClick={startNewChat} type="button">
          Новый чат
        </button>
        {visibleChats.length ? (
          visibleChats.map((chat) => (
            <ChatListItem key={chat.filePath} chat={chat} selected={selectedChat?.id === chat.id} onOpen={openChat} />
          ))
        ) : (
          <EmptyState title="В проекте нет чатов" detail="Создайте чат, и он стартует в выбранной директории проекта." />
        )}
      </div>

      <div className="detail-pane conversation-pane">
        {isCreatingChat ? (
          <>
            <div className="detail-header">
              <strong>Новый чат</strong>
              <small>Запустит новую сессию GigaCode без resume.</small>
            </div>
            <MessageStream messages={visibleMessages} threadRef={chatThreadRef} />
            <ThinkingPanel events={chatRunEvents} done={chatRunDone} />
            <form className="chat-compose new-chat-compose" onSubmit={createChat}>
              <div className="new-chat-fields">
                <input
                  value={newChatForm.cwd}
                  onChange={(event) => setNewChatForm({ ...newChatForm, cwd: event.target.value })}
                  placeholder="Рабочая директория"
                />
                <textarea
                  value={newChatForm.prompt}
                  onChange={(event) => setNewChatForm({ ...newChatForm, prompt: event.target.value })}
                  placeholder="Первый промпт"
                />
              </div>
              <div className="compose-actions">
                <button disabled={loading === "create-chat" || !newChatForm.prompt.trim()}>Создать</button>
                {loading === "create-chat" ? (
                  <button className="danger-button" type="button" onClick={stopChatRun}>
                    Стоп
                  </button>
                ) : null}
              </div>
            </form>
          </>
        ) : selectedChat ? (
          <>
            <div className="detail-header">
              <strong>{selectedChat.title}</strong>
              <small>{selectedChat.filePath}</small>
            </div>
            <MessageStream messages={visibleMessages} threadRef={chatThreadRef} />
            <ThinkingPanel events={chatRunEvents} done={chatRunDone} />
            <form className="chat-compose" onSubmit={continueChat}>
              <textarea
                value={continuePrompt}
                onChange={(event) => setContinuePrompt(event.target.value)}
                placeholder="Продолжить диалог"
              />
              <div className="compose-actions">
                <button disabled={loading === "continue-chat" || !continuePrompt.trim()}>Отправить</button>
                {loading === "continue-chat" ? (
                  <button className="danger-button" type="button" onClick={stopChatRun}>
                    Стоп
                  </button>
                ) : null}
              </div>
            </form>
          </>
        ) : (
          <EmptyState title="Выберите чат" detail="Содержимое загружается из JSONL по запросу." />
        )}
      </div>

      <aside className="inspector-rail">
        <div className="inspector-card">
          <div className="inspector-heading">
            <span>Inspector</span>
            <strong>{inspectorTitle}</strong>
          </div>
          <div className="inspector-chips">
            <StatusChip tone={loading ? "warning" : "online"} label={runState} />
            <StatusChip tone={chatRunEvents.length ? "accent" : "neutral"} label={`${chatRunEvents.length} events`} />
          </div>
        </div>

        <div className="inspector-card">
          <span className="inspector-label">Messages</span>
          <strong className="inspector-value">{visibleMessages.length}</strong>
          <small>Visible user and assistant messages</small>
        </div>

        {selectedChat ? (
          <div className="inspector-card">
            <span className="inspector-label">Updated</span>
            <strong className="inspector-value">{formatDate(selectedChat.updatedAt)}</strong>
            <small>{selectedChat.filePath}</small>
          </div>
        ) : null}

        <div className="inspector-card event-card">
          <span className="inspector-label">Activity</span>
          {chatRunEvents.length ? (
            <div className="event-stack">
              {chatRunEvents.slice(-4).map((item) => (
                <p key={item.id}>{item.text}</p>
              ))}
            </div>
          ) : (
            <small>No stream events yet</small>
          )}
        </div>
      </aside>
    </section>
  );
}

function MessageStream({ messages, threadRef }) {
  return (
    <div className="messages chat-thread" ref={threadRef}>
      {messages.map((item) => (
        <article key={item.id} className={`message ${item.role}`}>
          <span>{roleLabels[item.role] || item.role}</span>
          <pre>{item.text}</pre>
        </article>
      ))}
    </div>
  );
}

function ThinkingPanel({ events, done }) {
  if (!events.length) return null;

  return (
    <details className="thinking-panel" open={!done}>
      <summary>{done ? "Ход выполнения" : "GigaCode думает..."}</summary>
      <div>
        {events.map((item) => (
          <p key={item.id}>{item.text}</p>
        ))}
      </div>
    </details>
  );
}

function extractSessionId(eventData) {
  if (!eventData || typeof eventData !== "object") return "";
  const candidates = [
    eventData.sessionId,
    eventData.session_id,
    eventData.session?.id,
    eventData.item?.sessionId,
    eventData.item?.session_id,
    eventData.message?.sessionId,
    eventData.message?.session_id
  ];
  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
}
