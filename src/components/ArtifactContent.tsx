import { useEffect, useId, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Mermaid uses a temporary DOM node while rendering; serialize renders so
// navigating between results cannot leave competing temporary diagrams behind.
let renderQueue: Promise<unknown> = Promise.resolve();

function Diagram({ source }: { source: string }) {
  const id = "diagram-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [result, setResult] = useState({ source: "", svg: "", failed: false });
  useEffect(() => {
    let cancelled = false;
    renderQueue = renderQueue.catch(() => undefined).then(async () => {
      if (cancelled) return;
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark", suppressErrorRendering: true, maxTextSize: 30000, flowchart: { useMaxWidth: false, htmlLabels: false } });
        const { svg } = await mermaid.render(id, source);
        if (!cancelled) setResult({ source, svg, failed: false });
      } catch {
        if (!cancelled) setResult({ source, svg: "", failed: true });
      }
    });
    return () => { cancelled = true; };
  }, [source, id]);
  const current = result.source === source;
  return <figure className="artifact-diagram">
    <figcaption>流程与关系图 <span>可左右滑动查看</span></figcaption>
    {current && result.svg ? <div className="diagram-scroll" role="img" aria-label="成果流程与关系图" tabIndex={0} dangerouslySetInnerHTML={{ __html: result.svg }} /> : <p className="diagram-status" role="status">{current && result.failed ? "图形语法暂无法解析，可展开源码查看。" : "正在绘制图形…"}</p>}
    <details open={current && result.failed}><summary>查看图形源码</summary><pre><code>{source}</code></pre></details>
  </figure>;
}

export function ArtifactContent({ content, streaming = false }: { content: string; streaming?: boolean }) {
  return <div className="artifact-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    table: ({ children }) => <div className="artifact-table-scroll" role="region" aria-label="成果表格，可左右滑动" tabIndex={0}><table>{children}</table></div>,
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    pre: ({ children }) => <div className="artifact-code-block">{children}</div>,
    code: ({ children, className }) => {
      const source = String(children).replace(/\n$/, "");
      if (className === "language-mermaid" && !streaming) return <Diagram source={source} />;
      if (className || source.includes("\n")) return <pre><code className={className}>{children}</code></pre>;
      return <code>{children}</code>;
    },
  }}>{content}</Markdown></div>;
}
