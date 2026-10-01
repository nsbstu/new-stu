import { beforeEach, describe, expect, it } from "vitest";
import { createSampleProject } from "../app/sampleProject";
import { LocalProjectRepository } from "./projectRepository";

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
});

describe("project repository migration", () => {
  it("resets legacy completed runs that have no artifacts", () => {
    const project = createSampleProject();
    project.runs[0].status = "confirmed";
    const legacy = { ...project } as Record<string, unknown>;
    delete legacy.artifacts;
    localStorage.setItem("knowledge-quest.projects.v1", JSON.stringify([legacy]));

    const loaded = new LocalProjectRepository().list()[0];
    expect(loaded.artifacts).toEqual([]);
    expect(loaded.runs[0].status).toBe("ready");
    expect(loaded.runs[1].status).toBe("locked");
  });
});
