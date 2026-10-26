import { describe, expect, it } from "vitest";
import { readModelStream } from "./stream";
function streamResponse(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  }), { headers: { "content-type": "text/event-stream" } });
}
describe("model SSE", () => {
  it("handles fragmented events and UTF-8, publishing incremental content", async () => {
    const updates: string[] = [];
    const response = streamResponse(': heartbeat\r\n\r\ndata: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"世界"}}]}\r\n\r\ndata: [DONE]\r\n\r\n');
    expect(await readModelStream(response, text => updates.push(text))).toBe("你好世界");
    expect(updates).toEqual(["你好", "你好世界"]);
  });
  it("rejects incomplete streams", async () => {
    await expect(readModelStream(streamResponse('data: {"choices":[{"delta":{"content":"部分"}}]}\n\n'))).rejects.toThrow("提前结束");
  });
  it("surfaces provider errors", async () => {
    await expect(readModelStream(streamResponse('data: {"error":{"message":"upstream failed"}}\n\n'))).rejects.toThrow("upstream failed");
  });
  it("accepts JSON from providers that ignore stream mode", async () => {
    const response = new Response(JSON.stringify({ choices: [{ message: { content: "结果" } }] }));
    expect(await readModelStream(response)).toBe("结果");
  });
});