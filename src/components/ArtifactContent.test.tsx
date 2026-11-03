import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArtifactContent } from "./ArtifactContent";

describe("artifact document rendering", () => {
  it("renders headings, lists and GFM tables as readable structure", () => {
    const html = renderToStaticMarkup(<ArtifactContent content={'## 学习计划\n\n| 阶段 | 任务 |\n| --- | --- |\n| 入门 | **实践** |\n\n- 第一天\n- 第二天'} />);
    expect(html).toContain("<h2>学习计划</h2>");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>阶段</th>");
    expect(html).toContain("<strong>实践</strong>");
    expect(html).toContain("<li>第一天</li>");
    expect(html).toContain('aria-label="成果表格，可左右滑动"');
  });
  it("blocks raw HTML and unsafe link protocols", () => {
    const html = renderToStaticMarkup(<ArtifactContent content={'<script>alert(1)</script>\n\n[危险](javascript:alert)\n\n[来源](https://example.com)'} />);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("retains Mermaid source and defers rendering incomplete streaming diagrams", () => {
    const content = '```mermaid\nflowchart TD\nA["研究"] --> B["实践"]\n```';
    const complete = renderToStaticMarkup(<ArtifactContent content={content} />);
    expect(complete).toContain("正在绘制图形");
    expect(complete).toContain("查看图形源码");
    const streaming = renderToStaticMarkup(<ArtifactContent content={content} streaming />);
    expect(streaming).not.toContain("正在绘制图形");
    expect(streaming).toContain('class="language-mermaid"');
  });
});
