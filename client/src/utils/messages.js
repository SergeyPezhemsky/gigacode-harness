import { roleLabels } from "../constants.js";

export function extractText(value, depth = 0) {
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

export function messagePartsText(item) {
  const payload = item?.message ?? item;
  if (!payload) return "";
  const parts = payload.parts || payload.content?.parts || payload.content;
  if (Array.isArray(parts)) {
    return parts
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (typeof parts === "string") return parts.trim();
  return "";
}

export function messageText(item) {
  return item?.text || messagePartsText(item) || extractText(item?.message ?? item);
}

export function roleOf(item) {
  const role = item?.message?.role || item?.role || item?.type || "event";
  if (role === "model" || role === "result") return "assistant";
  if (role === "stderr") return "stderr";
  if (role === "raw") return "raw";
  return role;
}

export function displayRole(item) {
  return roleLabels[roleOf(item)] || roleOf(item);
}

export function toChatMessages(messages) {
  return collapsePartialAssistantMessages(messages
    .map((item, index) => {
      const role = roleOf(item);
      const text = messageText(item).trim();
      return { id: item.uuid || item.id || index, role, text };
    })
    .filter((item) => item.text && ["user", "assistant"].includes(item.role)));
}

export function collapsePartialAssistantMessages(messages) {
  const collapsed = [];

  for (const item of messages) {
    const previous = collapsed[collapsed.length - 1];
    if (item.role === "assistant" && previous?.role === "assistant" && isLikelyPartialUpdate(previous.text, item.text)) {
      collapsed[collapsed.length - 1] = {
        ...item,
        text: item.text.length >= previous.text.length ? item.text : previous.text
      };
      continue;
    }

    collapsed.push(item);
  }

  return collapsed;
}

export function upsertMessage(messages, nextMessage, draftId) {
  if (!nextMessage) return messages;
  const withoutDraft = messages.filter((item) => item.id !== draftId);
  return collapsePartialAssistantMessages([...withoutDraft, { ...nextMessage, id: draftId }]);
}

function isLikelyPartialUpdate(previousText, nextText) {
  if (!previousText || !nextText) return false;
  return previousText === nextText || nextText.startsWith(previousText) || previousText.startsWith(nextText);
}

export function thinkingText(event) {
  if (!event || typeof event !== "object") return "";
  if (event.type === "stderr") return event.text ? `stderr: ${event.text.trim()}` : "stderr";
  if (event.error) return `Ошибка: ${event.error}`;
  if (event.type === "done") return `Процесс завершился с кодом ${event.code}`;

  const parts = event.message?.parts || [];
  const functionCall = parts.find((part) => part?.functionCall);
  if (functionCall) {
    return `Вызов инструмента: ${functionCall.functionCall.name || "tool"}`;
  }

  const functionResponse = parts.find((part) => part?.functionResponse);
  if (functionResponse) {
    return `Результат инструмента: ${functionResponse.functionResponse.name || "tool"}`;
  }

  if (event.subtype) return `${event.type || "event"}: ${event.subtype}`;
  if (event.type && roleOf(event) !== "user" && roleOf(event) !== "assistant") return event.type;
  return "";
}
