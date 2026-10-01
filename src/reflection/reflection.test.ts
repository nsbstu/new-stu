import { describe, expect, it } from "vitest";
import { createReflectionReport } from "./reflection";

describe("reflection", () => {
  it("passes when overall and critical dimensions meet thresholds", () => {
    const report = createReflectionReport({
      completeness: 80, evidenceReliability: 76, citationCoverage: 74,
      logicalConsistency: 82, goalAlignment: 85, actionability: 79,
    });
    expect(report.passed).toBe(true);
    expect(report.overallScore).toBe(79);
  });

  it("fails when evidence reliability is below the critical threshold", () => {
    const report = createReflectionReport({
      completeness: 95, evidenceReliability: 60, citationCoverage: 95,
      logicalConsistency: 95, goalAlignment: 95, actionability: 95,
    }, ["关键事实缺少可靠来源"]);
    expect(report.passed).toBe(false);
    expect(report.needsUserInput).toBe(true);
  });
});
