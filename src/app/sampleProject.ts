import type { ProjectWorkspace } from "../domain/types";
import { createInitialRuns } from "../workflow/workflow";

export function createSampleProject(): ProjectWorkspace {
  const now = new Date().toISOString();
  return {
    profile: {
      id: crypto.randomUUID(),
      title: "储能行业探索",
      topic: "中国储能行业的价值链、商业模式与技术路线",
      kind: "industry",
      goal: "建立行业全景，并能判断不同商业模式的机会与风险。",
      currentLevel: "了解少量行业新闻，尚未形成系统框架",
      timeBudgetHours: 20,
      createdAt: now,
      updatedAt: now,
    },
    runs: createInitialRuns(),
    artifacts: [],
    mastery: 8,
  };
}
