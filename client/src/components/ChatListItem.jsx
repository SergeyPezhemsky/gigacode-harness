import { formatDate } from "../utils/format.js";

export function ChatListItem({ chat, selected, onOpen }) {
  return (
    <button className={selected ? "list-item chat-list-item selected" : "list-item chat-list-item"} onClick={() => onOpen(chat)}>
      <span>{chat.title}</span>
      <small>{formatDate(chat.updatedAt)}</small>
    </button>
  );
}
