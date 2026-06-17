import { useEffect, useRef, useState } from "react";
import { api, readSse } from "../api.js";
import { roleLabels } from "../constants.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { formatDate } from "../utils/format.js";
import { thinkingText, toChatMessages, upsertMessage } from "../utils/messages.js";

export function ChatsView({ chats, selectedChat, setSelectedChat, chatMessages, setChatMessages, refreshBase, setError }) {
  const [chatRunEvents, setChatRunEvents] = useState([]);
  const [chatRunDone, setChatRunDone] = useState(true);
  const [continuePrompt, setContinuePrompt] = useState("");
  const [loading, setLoading] = useState("");
  const chatThreadRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!chatThreadRef.current) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!chatThreadRef.current) return;
        chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight;
      });
    });
  }, [chatMessages, selectedChat]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function openChat(chat) {
    abortRef.current?.abort();
    setSelectedChat(chat);
    setChatRunEvents([]);
    setChatRunDone(true);
    setContinuePrompt("");
    setError("");
    try {
      const data = await api(`/api/chats/${encodeURIComponent(chat.id)}`);
      setSelectedChat(data.chat);
      setChatMessages(data.displayMessages || data.messages);
    } catch (err) {
      setError(err.message);
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
        const thought = thinkingText(eventData);
        if (thought) {
          setChatRunEvents((items) => [...items, { id: `${Date.now()}-${items.length}`, text: thought }]);
        }
        if (eventData.type === "done") {
          exitCode = eventData.code ?? 0;
        }

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
      if (err.name === "AbortError") {
        setChatRunEvents((items) => [...items, { id: `stopped-${Date.now()}`, text: "Процесс остановлен пользователем" }]);
      } else {
        setError(err.message);
      }
    } finally {
      abortRef.current = null;
      setChatRunDone(true);
      setLoading("");
    }
  }

  function stopChatRun() {
    abortRef.current?.abort();
  }

  return (
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
            <div className="messages chat-thread" ref={chatThreadRef}>
              {toChatMessages(chatMessages).map((item) => (
                <article key={item.id} className={`message ${item.role}`}>
                  <span>{roleLabels[item.role] || item.role}</span>
                  <pre>{item.text}</pre>
                </article>
              ))}
            </div>
            {chatRunEvents.length ? (
              <details className="thinking-panel" open={!chatRunDone}>
                <summary>{chatRunDone ? "Ход выполнения" : "GigaCode думает..."}</summary>
                <div>
                  {chatRunEvents.map((item) => (
                    <p key={item.id}>{item.text}</p>
                  ))}
                </div>
              </details>
            ) : null}
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
    </section>
  );
}
