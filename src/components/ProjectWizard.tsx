import { useState } from "react";
import type { ProjectKind, ProjectProfile } from "../domain/types";
import { createId } from "../utils/id";

const questions = [
  { key: "topic", prompt: "你想学习哪个行业或技术？", placeholder: "例如：新能源汽车行业，或 React 性能优化" },
  { key: "goal", prompt: "完成学习后，你希望能够做什么？", placeholder: "例如：能判断商业模式，或独立完成一个项目" },
  { key: "currentLevel", prompt: "你目前对这个主题了解多少？", placeholder: "例如：完全不了解，或已有一年实践经验" },
  { key: "timeBudgetHours", prompt: "你计划投入多少小时？", placeholder: "例如：20" },
] as const;

interface Props {
  onClose: () => void;
  onCreate: (profile: ProjectProfile) => Promise<void> | void;
  projectId?: string;
}

export function ProjectWizard({ onClose, onCreate, projectId }: Props) {
  const [kind, setKind] = useState<ProjectKind>("industry");
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  async function submit() {
    if (!input.trim()) return;
    const question = questions[step];
    const nextAnswers = { ...answers, [question.key]: input.trim() };
    setAnswers(nextAnswers);
    setInput("");
    if (step < questions.length - 1) {
      setStep(step + 1);
      return;
    }
    const now = new Date().toISOString();
    await onCreate({
      id: projectId ?? createId(),
      title: nextAnswers.topic,
      topic: nextAnswers.topic,
      kind,
      goal: nextAnswers.goal,
      currentLevel: nextAnswers.currentLevel,
      timeBudgetHours: Math.max(1, Number(nextAnswers.timeBudgetHours) || 20),
      createdAt: now,
      updatedAt: now,
    });
  }

  return (
    <div className="modal-backdrop">
      <section className="modal wizard-modal">
        <div className="modal-header"><div><p className="eyebrow">AI 项目访谈</p><h2>创建学习远征</h2></div><button onClick={onClose}>×</button></div>
        <div className="kind-switch">
          <button className={kind === "industry" ? "active" : ""} onClick={() => setKind("industry")}>行业知识</button>
          <button className={kind === "technology" ? "active" : ""} onClick={() => setKind("technology")}>技术知识</button>
        </div>
        <div className="chat-transcript">
          <div className="chat-bubble assistant">你好，我会通过几个问题建立学习档案，再为你解锁八步工作流。</div>
          {questions.slice(0, step + 1).map((question, index) => (
            <div className="chat-pair" key={question.key}>
              <div className="chat-bubble assistant">{question.prompt}</div>
              {answers[question.key] && <div className="chat-bubble user">{answers[question.key]}</div>}
              {index === step && !answers[question.key] && <span className="typing-dot">等待你的回答…</span>}
            </div>
          ))}
        </div>
        <div className="chat-input-row">
          <input value={input} placeholder={questions[step].placeholder} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} autoFocus />
          <button className="primary-button" onClick={submit}>{step === questions.length - 1 ? "创建项目" : "下一步"}</button>
        </div>
      </section>
    </div>
  );
}
