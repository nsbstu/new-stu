import type { SkillRun, SkillStatus } from "../domain/types";
import { skillManifests } from "../skills/manifests";

export function createInitialRuns(): SkillRun[] {
  return skillManifests.map((skill, index) => ({
    skillId: skill.id,
    status: index === 0 ? "ready" : "locked",
    revision: 0,
  }));
}

function isCompleted(status: SkillStatus) {
  return status === "confirmed" || status === "skipped";
}

export function confirmSkill(runs: SkillRun[], skillId: string, artifactId: string): SkillRun[] {
  const now = new Date().toISOString();
  const currentIndex = runs.findIndex((run) => run.skillId === skillId);
  if (currentIndex < 0) return runs;

  return runs.map((run, index) => {
    if (index === currentIndex) {
      return { ...run, status: "confirmed", revision: run.revision + 1, confirmedArtifactId: artifactId, lastUpdatedAt: now };
    }
    if (index === currentIndex + 1 && run.status === "locked") {
      return { ...run, status: "ready", lastUpdatedAt: now };
    }
    if (index > currentIndex && run.status !== "locked" && run.status !== "ready") {
      return { ...run, status: "stale", lastUpdatedAt: now };
    }
    return run;
  });
}

export function skipSkill(runs: SkillRun[], skillId: string, reason: string): SkillRun[] {
  const currentIndex = runs.findIndex((run) => run.skillId === skillId);
  if (currentIndex < 0) return runs;
  const now = new Date().toISOString();
  return runs.map((run, index) => {
    if (index === currentIndex) return { ...run, status: "skipped", skipReason: reason, lastUpdatedAt: now };
    if (index === currentIndex + 1 && run.status === "locked") return { ...run, status: "ready", lastUpdatedAt: now };
    return run;
  });
}

export function getCurrentSkillId(runs: SkillRun[]): string | undefined {
  return runs.find((run) => ["ready", "running", "reviewing", "needs_input", "draft"].includes(run.status))?.skillId;
}

export function calculateProgress(runs: SkillRun[]): number {
  return Math.round((runs.filter((run) => isCompleted(run.status)).length / runs.length) * 100);
}
