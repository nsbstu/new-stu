import type { QualityScores, ReflectionReport } from "../domain/types";

const keys: (keyof QualityScores)[] = [
  "completeness", "evidenceReliability", "citationCoverage",
  "logicalConsistency", "goalAlignment", "actionability",
];

export function createReflectionReport(
  scores: QualityScores,
  weaknesses: string[] = [],
  revisionSummary: string[] = [],
): ReflectionReport {
  const overallScore = Math.round(keys.reduce((sum, key) => sum + scores[key], 0) / keys.length);
  const passed = overallScore >= 75 && scores.evidenceReliability >= 70 && scores.logicalConsistency >= 70;
  return { overallScore, scores, passed, weaknesses, revisionSummary, needsUserInput: !passed && weaknesses.length > 0 };
}
