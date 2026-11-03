import { describe, expect, it } from "vitest";
import { createSampleProject } from "../app/sampleProject";
import { parseProjectBackup, serializeProjectBackup } from "./projectBackup";
import { confirmSkill } from "../workflow/workflow";

describe("portable project backups", () => {
  it("preserves progress and Markdown through PC to mobile and back", () => {
    const pc = createSampleProject();
    const skillId = pc.runs[0].skillId;
    pc.artifacts.push({ id: "cross-device-artifact", skillId, revision: 1, status: "confirmed", title: "跨设备成果", summary: "保留表格和图形", content: '## 计划\n\n| 阶段 | 任务 |\n| --- | --- |\n| 1 | 实践 |\n\n```mermaid\nflowchart TD\nA --> B\n```', upstreamArtifactIds: [], reflection: { overallScore: 80, scores: { completeness: 80, evidenceReliability: 80, citationCoverage: 80, logicalConsistency: 80, goalAlignment: 80, actionability: 80 }, passed: true, weaknesses: [], revisionSummary: [], needsUserInput: false }, generatedBy: "configured-model", createdAt: "2026-11-03T00:00:00Z" });
    pc.runs = confirmSkill(pc.runs, skillId, "cross-device-artifact");
    const mobile = parseProjectBackup(serializeProjectBackup(pc));
    expect(mobile).toEqual(pc);
    mobile.profile.goal = "在手机继续学习后的目标";
    mobile.mastery = 30;
    const restoredPc = parseProjectBackup(serializeProjectBackup(mobile));
    expect(restoredPc).toEqual(mobile);
    expect(restoredPc.artifacts[0].content).toBe(pc.artifacts[0].content);
    expect(restoredPc.runs[1].status).toBe("ready");
  });
  it("accepts UTF-8 BOM files and restores canonical workflow order", () => {
    const project = createSampleProject();
    const reversed = { ...project, runs: [...project.runs].reverse() };
    expect(parseProjectBackup("\uFEFF" + JSON.stringify(reversed))).toEqual(project);
  });
  it("exports only project data and converts in-flight tasks to retryable status", () => {
    const project = createSampleProject();
    project.runs[0].status = "running";
    const text = serializeProjectBackup({ ...project, apiKey: "secret", directoryHandle: {} } as typeof project);
    expect(text).not.toContain("secret");
    expect(text).not.toContain("directoryHandle");
    expect(parseProjectBackup(text).runs[0].status).toBe("failed");
  });
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
