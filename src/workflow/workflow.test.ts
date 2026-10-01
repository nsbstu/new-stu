import { describe, expect, it } from "vitest";
import { calculateProgress, confirmSkill, createInitialRuns, skipSkill } from "./workflow";

describe("workflow", () => {
  it("starts with only the first skill ready", () => {
    const runs = createInitialRuns();
    expect(runs[0].status).toBe("ready");
    expect(runs.slice(1).every((run) => run.status === "locked")).toBe(true);
  });

  it("confirms one skill and unlocks the next", () => {
    const runs = confirmSkill(createInitialRuns(), "perspective-storm", "artifact-1");
    expect(runs[0].status).toBe("confirmed");
    expect(runs[1].status).toBe("ready");
    expect(calculateProgress(runs)).toBe(13);
  });

  it("allows a skill to be skipped with a reason", () => {
    const runs = skipSkill(createInitialRuns(), "perspective-storm", "已有研究成果");
    expect(runs[0].status).toBe("skipped");
    expect(runs[0].skipReason).toBe("已有研究成果");
    expect(runs[1].status).toBe("ready");
  });
});
