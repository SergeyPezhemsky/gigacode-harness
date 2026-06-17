import { useState } from "react";
import { readSse } from "../api.js";
import { MessageList } from "../components/MessageList.jsx";

export function RunView({ setError }) {
  const [runForm, setRunForm] = useState({ cwd: "", prompt: "" });
  const [runEvents, setRunEvents] = useState([]);

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

      await readSse(response, (eventData) => {
        setRunEvents((items) => [...items, eventData]);
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="run-layout">
      <form onSubmit={runPrompt}>
        <input value={runForm.cwd} onChange={(event) => setRunForm({ ...runForm, cwd: event.target.value })} placeholder="Рабочая директория" />
        <textarea value={runForm.prompt} onChange={(event) => setRunForm({ ...runForm, prompt: event.target.value })} placeholder="Промпт для gigacode" />
        <button>Запустить gigacode</button>
      </form>
      <MessageList events={runEvents} />
    </section>
  );
}
