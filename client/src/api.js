export async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Запрос не выполнен");
  return data;
}

export async function readSse(response, onEvent) {
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Потоковый запрос не выполнен");
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
      const eventLine = chunk.split("\n").find((line) => line.startsWith("event: "));
      const eventName = eventLine?.slice(7) || "message";
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;

      try {
        const parsed = JSON.parse(dataLine.slice(6));
        onEvent(eventName === "message" ? parsed : { ...parsed, type: eventName });
      } catch {
        onEvent({ type: "raw", text: dataLine.slice(6) });
      }
    }
  }
}
