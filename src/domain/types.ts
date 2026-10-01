export type ProjectKind = "industry" | "technology";

export type SkillStatus =
  | "locked"
  | "ready"
  | "running"
  | "reviewing"
  | "needs_input"
  | "draft"
  | "confirmed"
  | "skipped"
  | "stale"
  | "failed";

export interface ProjectProfile {
  id: string;
  title: string;
  topic: string;
  kind: ProjectKind;
  goal: string;
  currentLevel: string;
  timeBudgetHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillManifest {
  id: string;
  order: number;
  name: string;
  shortName: string;
  description: string;
  color: string;
  icon: string;
  requiredInputs: string[];
  outputSections: string[];
  qualityDimensions: string[];
}

export interface SkillRun {
  skillId: string;
  status: SkillStatus;
  revision: number;
  confirmedArtifactId?: string;
  lastUpdatedAt?: string;
  skipReason?: string;
}

export interface QualityScores {
  completeness: number;
  evidenceReliability: number;
  citationCoverage: number;
  logicalConsistency: number;
  goalAlignment: number;
  actionability: number;
}

export interface ReflectionReport {
  overallScore: number;
  scores: QualityScores;
  passed: boolean;
  weaknesses: string[];
  revisionSummary: string[];
  needsUserInput: boolean;
}

export interface SkillArtifact {
  id: string;
  skillId: string;
  revision: number;
  status: "draft" | "confirmed";
  title: string;
  summary: string;
  content: string;
  upstreamArtifactIds: string[];
  reflection: ReflectionReport;
  generatedBy: "local-fallback" | "configured-model";
  generationWarning?: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface ModelSettings {
  baseUrl: string;
  model: string;
  temperature: number;
}

export interface ProjectWorkspace {
  profile: ProjectProfile;
  runs: SkillRun[];
  artifacts: SkillArtifact[];
  mastery: number;
}
