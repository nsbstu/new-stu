import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSampleProject } from "../app/sampleProject";
import { confirmSkill } from "../workflow/workflow";
import { skillManifests } from "./manifests";
import { generateSkillArtifact } from "./engine";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: memoryStorage(), configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: memoryStorage(), configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("skill engine", () => {
  it("generates a visible fallback artifact with reflection when no model is configured", async () => {
    const project = createSampleProject();
    const artifact = await generateSkillArtifact(project, skillManifests[0]);

    expect(artifact.status).toBe("draft");
    expect(artifact.generatedBy).toBe("local-fallback");
    expect(artifact.content).toContain("输入上下文");
    expect(artifact.reflection.passed).toBe(false);
    expect(artifact.reflection.weaknesses.length).toBeGreaterThan(0);
  });

  it("passes the confirmed upstream artifact into the next skill", async () => {
    const project = createSampleProject();
    const first = await generateSkillArtifact(project, skillManifests[0]);
    const confirmedFirst = { ...first, status: "confirmed" as const };
    const projectWithFirst = {
      ...project,
      artifacts: [confirmedFirst],
      runs: confirmSkill(project.runs, skillManifests[0].id, first.id),
    };

    const second = await generateSkillArtifact(projectWithFirst, skillManifests[1]);
    expect(second.upstreamArtifactIds).toEqual([first.id]);
    expect(second.content).toContain(first.title);
    expect(second.content).toContain("输入上下文");
    expect(second.content).not.toContain("风险。。");
  });

  it("keeps a local draft when the configured model returns HTTP 503", async () => {
    localStorage.setItem("knowledge-quest.model-settings.v1", JSON.stringify({
      baseUrl: "https://example.invalid/v1",
      model: "test-model",
      temperature: 0.3,
    }));
    sessionStorage.setItem("knowledge-quest.api-key.session", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const artifact = await generateSkillArtifact(createSampleProject(), skillManifests[0]);

    expect(artifact.status).toBe("draft");
    expect(artifact.generatedBy).toBe("local-fallback");
    expect(artifact.generationWarning).toContain("HTTP 503");
    expect(artifact.content).toContain("角色立场");
    expect(artifact.reflection.weaknesses[0]).toContain("已自动生成本地草稿");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
