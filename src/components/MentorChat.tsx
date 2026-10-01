import { useState } from "react";
import { sendChat, type ChatMessage } from "../ai/chat";

export function MentorChat({ context, onClose, onOpenSettings }: { context: string; onClose: () => void; onOpenSettings: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "我是你的 AI 学习导师。你可以询问当前主题、关卡成果或下一步学习建议。" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!input.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: input.trim() }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const answer = await sendChat(next.filter((message) => message.role !== "assistant" || message !== next[0]), context);
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch (error) {
      setMessages([...next, { role: "assistant", content: error instanceof Error ? error.message : "请求失败" }]);
    } finally { setBusy(false); }
  }

  return (
    <aside className="mentor-drawer">
      <div className="modal-header"><div><p className="eyebrow">项目内对话</p><h2>AI 学习导师</h2></div><button onClick={onClose}>×</button></div>
      <div className="mentor-messages">{messages.map((message, index) => <div key={index} className={"chat-bubble " + message.role}>{message.content}</div>)}</div>
      <button className="configure-link" onClick={onOpenSettings}>配置或更换模型</button>
      <div className="chat-input-row"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} placeholder="询问当前项目…" /><button className="primary-button" onClick={submit} disabled={busy}>{busy ? "思考中" : "发送"}</button></div>
    </aside>
  );
}
