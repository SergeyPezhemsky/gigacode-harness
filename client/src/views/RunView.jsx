import { useEffect, useRef, useState } from "react";
import { readSse } from "../api.js";
import { MessageList } from "../components/MessageList.jsx";

export function RunView({ setError }) {
  const [runForm, setRunForm] = useState({ cwd: "", prompt: "" });
  const [runEvents, setRunEvents] = useState([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function runPrompt(event) {
    event.preventDefault();
    setRunEvents([]);
    setError("");
    setRunning(true);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runForm),
        signal: controller.signal
      });

      await readSse(response, (eventData) => {
        setRunEvents((items) => [...items, eventData]);
      });
    } catch (err) {
      if (err.name === "AbortError") {
        setRunEvents((items) => [...items, { type: "done", text: "Процесс остановлен пользователем" }]);
      } else {
        setError(err.message);
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  function stopRun() {
    abortRef.current?.abort();
  }

  return (
    <section className="run-layout">
      <form onSubmit={runPrompt}>
        <input value={runForm.cwd} onChange={(event) => setRunForm({ ...runForm, cwd: event.target.value })} placeholder="Рабочая директория" />
        <textarea value={runForm.prompt} onChange={(event) => setRunForm({ ...runForm, prompt: event.target.value })} placeholder="Промпт для gigacode" />
        <div className="compose-actions">
          <button disabled={running}>Запустить gigacode</button>
          {running ? (
            <button className="danger-button" type="button" onClick={stopRun}>
              Стоп
            </button>
          ) : null}
        </div>
      </form>
      <MessageList events={runEvents} />
    </section>
  );
}
