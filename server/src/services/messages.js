export function textFromMessage(message) {
  const payload = message?.message ?? message;
  return textFromPayload(payload);
}

export function textFromPayload(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;

  const textParts = [];
  const collect = (value) => {
    if (!value) return;
    if (typeof value === "string") {
      textParts.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value !== "object") return;
    if (typeof value.text === "string") textParts.push(value.text);
    else if (typeof value.content === "string") textParts.push(value.content);
    else if (Array.isArray(value.content)) collect(value.content);
    else if (Array.isArray(value.parts)) collect(value.parts);
  };

  collect(payload.parts);
  collect(payload.content);
  if (!textParts.length) collect(payload.text);
  return textParts.filter(Boolean).join("\n").trim();
}

export function roleFromEvent(event) {
  const role = event?.message?.role || event?.role || event?.type || "event";
  if (role === "model" || role === "assistant" || role === "result") return "assistant";
  if (role === "user") return "user";
  return role;
}

export function normalizeChatMessages(messages) {
  const normalized = [];

  for (const [index, event] of messages.entries()) {
    const role = roleFromEvent(event);
    if (role !== "user" && role !== "assistant") continue;

    const text = textFromMessage(event);
    if (!text) continue;

    const item = {
      id: event.uuid || event.id || `${event.sessionId || "message"}-${index}`,
      role,
      text,
      timestamp: event.timestamp || null
    };

    const previous = normalized[normalized.length - 1];
    if (role === "assistant" && previous?.role === "assistant" && isLikelyPartialUpdate(previous.text, text)) {
      normalized[normalized.length - 1] = { ...item, text: longerText(previous.text, text) };
      continue;
    }

    normalized.push(item);
  }

  return normalized;
}

function isLikelyPartialUpdate(previousText, nextText) {
  if (!previousText || !nextText) return false;
  return previousText === nextText || nextText.startsWith(previousText) || previousText.startsWith(nextText);
}

function longerText(first, second) {
  return second.length >= first.length ? second : first;
}
