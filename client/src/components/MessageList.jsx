import { displayRole, messageText } from "../utils/messages.js";

export function MessageList({ events }) {
  return (
    <div className="messages">
      {events.map((event, index) => (
        <article key={index} className={`message ${event.type || "event"}`}>
          <span>{displayRole(event)}</span>
          <pre>{messageText(event) || JSON.stringify(event, null, 2)}</pre>
        </article>
      ))}
    </div>
  );
}
