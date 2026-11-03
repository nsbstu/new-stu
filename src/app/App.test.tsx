import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { createSampleProject } from "./sampleProject";
const harness = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0, generate: vi.fn(), empty: false }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: () => {},
  useMemo: (fn: () => unknown) => fn(),
  useRef: (value: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = { current: value };
    return harness.states[index];
  },
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = typeof initial === "function" ? initial() : initial;
    return [harness.states[index], (next: unknown) => {
      harness.states[index] = typeof next === "function" ? next(harness.states[index]) : next;
    }];
  },
}));
vi.mock("../skills/engine", () => ({ generateSkillArtifact: harness.generate }));
vi.mock("../storage/projectRepository", () => ({ LocalProjectRepository: class {
  list() { return harness.empty ? [] : [createSampleProject()]; }
  save() {}
} }));
vi.mock("../storage/projectDirectory", () => ({
  saveProjectToDirectory: vi.fn().mockResolvedValue(true),
  supportsProjectFolders: () => false,
}));
vi.mock("../ai/modelSettings", () => ({ isModelConfigured: () => true }));
import { App } from "./App";
function render() { harness.cursor = 0; return App(); }
function elements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props.children)];
}
function generateButton(tree: unknown) {
  return elements(tree).find(element => element.type === "button" && ["生成本关成果", "重新生成", "生成中…"].includes(element.props.children as string))!;
}
function hasStreamingPreview(tree: unknown) {
  return elements(tree).some(element => element.props["aria-live"] === "polite");
}
beforeEach(() => { harness.states = []; harness.cursor = 0; harness.generate.mockReset(); harness.empty = false; vi.unstubAllGlobals(); });
describe("generation UI lifecycle", () => {
  it("clears the streaming preview after completion and permits another run", async () => {
    let finish!: (value: unknown) => void;
    harness.generate.mockImplementation((_project, _skill, update) => {
      update("实时内容");
      return new Promise(resolve => { finish = resolve; });
    });
    const run = (generateButton(render()).props.onClick as () => Promise<void>)();
    expect(hasStreamingPreview(render())).toBe(true);
    finish({ id: "result", skillId: "perspective-storm", status: "draft", content: "最终内容", upstreamArtifactIds: [], reflection: { passed: false, overallScore: 70, scores: {}, weaknesses: [] } });
    await run;
    const completed = render();
    expect(hasStreamingPreview(completed)).toBe(false);
    expect(generateButton(completed).props.children).toBe("重新生成");
    expect(generateButton(completed).props.disabled).toBe(false);
  });
  it("clears the preview on failure and blocks concurrent requests", async () => {
    let fail!: (error: Error) => void;
    harness.generate.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
    const click = generateButton(render()).props.onClick as () => Promise<void>;
    const run = click();
    await click();
    expect(harness.generate).toHaveBeenCalledTimes(1);
    fail(new Error("连接中断"));
    await run;
    expect(hasStreamingPreview(render())).toBe(false);
    expect(generateButton(render()).props.disabled).toBe(false);
  });
});

describe("mobile project workspace", () => {
  it("opens configuration only on demand and switches content tabs", () => {
    let tree = render();
    expect(elements(tree).some(element => element.props.title === "项目与配置")).toBe(false);
    const config = elements(tree).find(element => element.props["aria-label"] === "项目配置")!;
    (config.props.onClick as () => void)();
    tree = render();
    expect(elements(tree).some(element => element.props.title === "项目与配置")).toBe(true);
    const review = elements(tree).find(element => element.props.id === "mobile-tab-review")!;
    (review.props.onClick as () => void)();
    expect(elements(render()).find(element => element.props.id === "mobile-tab-review")!.props["aria-selected"]).toBe(true);
  });

  it("keeps the dock available during generation and switches to results", async () => {
    let finish!: (value: unknown) => void;
    harness.generate.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const dock = elements(render()).find(element => element.props.className === "mobile-action-dock")!;
    const generate = elements(dock).find(element => element.props.children === "生成本关成果")!;
    const run = (generate.props.onClick as () => Promise<void>)();
    const tree = render();
    expect(elements(tree).find(element => element.props.id === "mobile-tab-result")!.props["aria-selected"]).toBe(true);
    const runningDock = elements(tree).find(element => element.props.className === "mobile-action-dock")!;
    expect(elements(runningDock).find(element => element.props.children === "生成中…")!.props.disabled).toBe(true);
    finish({ id: "result", skillId: "perspective-storm", status: "draft", content: "内容", upstreamArtifactIds: [], reflection: { scores: {}, weaknesses: [] } });
    await run;
    const readyDock = elements(render()).find(element => element.props.className === "mobile-action-dock")!;
    const confirm = elements(readyDock).find(element => element.props.children === "确认并进入下一关")!;
    expect(confirm.props.disabled).toBe(false);
    (confirm.props.onClick as () => void)();
    expect(elements(render()).find(element => element.props.className === "mobile-skill-heading")!.props.children).toBeDefined();
    expect(elements(render()).some(element => element.props.className === "mobile-action-dock")).toBe(true);
  });

  it("preserves the empty-project entry without project-only chrome", () => {
    harness.empty = true;
    vi.stubGlobal("localStorage", { getItem: () => "[]" });
    const tree = render();
    expect(elements(tree).some(element => element.props.children === "开始新的学习主题")).toBe(true);
    expect(elements(tree).some(element => element.props.children === "创建学习项目")).toBe(true);
    expect(elements(tree).some(element => element.props.className === "mobile-action-dock")).toBe(false);
    expect(elements(tree).some(element => element.props["aria-label"] === "项目配置")).toBe(false);
  });
});
