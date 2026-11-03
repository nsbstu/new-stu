import { describe, expect, it } from "vitest";
import { createSampleProject } from "../app/sampleProject";
import { parseProjectBackup } from "./projectBackup";

describe("portable project backups", () => {
  it("preserves a complete project through JSON export and import", () => {
    const project = createSampleProject();
    expect(parseProjectBackup(JSON.stringify(project))).toEqual(project);
  });
  it("rejects malformed files and incomplete workflows", () => {
    for (const text of ["not json", "null", "{}", JSON.stringify({ ...createSampleProject(), runs: [] }), JSON.stringify({ ...createSampleProject(), artifacts: [{}] })]) {
      expect(() => parseProjectBackup(text)).toThrow("无效的项目备份");
    }
  });
  it("makes interrupted generation retryable after moving devices", () => {
    const project = createSampleProject();
    project.runs[0].status = "running";
    expect(parseProjectBackup(JSON.stringify(project)).runs[0].status).toBe("failed");
  });
});
