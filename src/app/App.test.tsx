import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { createSampleProject } from "./sampleProject";
const harness = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0, generate: vi.fn() }));
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
  list() { return [createSampleProject()]; }
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
beforeEach(() => { harness.states = []; harness.cursor = 0; harness.generate.mockReset(); });
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