/** Decode SSE incrementally, including UTF-8 characters split across network chunks. */
export async function readModelStream(response: Response, onContent?: (content: string) => void) {
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("模型未返回有效内容");
    onContent?.(content);
    return content;
  }
  if (!response.body) throw new Error("模型响应没有可读取的数据流");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finished = false;
  function event(block: string) {
    const payload = block.split("\n").filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trimStart()).join("\n");
    if (!payload) return;
    if (payload.trim() === "[DONE]") { finished = true; return; }
    const data = JSON.parse(payload);
    if (data.error) throw new Error(data.error.message || "模型流式响应错误");
    const choice = data.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === "string") { content += delta; onContent?.(content); }
    if (choice?.finish_reason === "length") throw new Error("模型输出达到长度上限，请缩小生成范围后重试");
    if (choice?.finish_reason === "content_filter") throw new Error("模型输出被服务商内容过滤中止");
    if (choice?.finish_reason) finished = true;
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, "\n");
      let end: number;
      while (!finished && (end = buffer.indexOf("\n\n")) >= 0) {
        event(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
      }
      if (done) { if (buffer.trim()) event(buffer); break; }
      if (finished) break;
    }
    if (!finished) throw new Error("模型流式连接提前结束，生成结果不完整");
    if (!content.trim()) throw new Error("模型未返回有效内容");
    return content;
  } finally {
    void reader.cancel().catch(() => { /* connection may already be closed */ });
    reader.releaseLock();
  }
}