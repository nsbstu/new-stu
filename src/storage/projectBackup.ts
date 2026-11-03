import { z } from "zod";
import type { ProjectWorkspace } from "../domain/types";
import { skillManifests } from "../skills/manifests";

const skillId = z.string().refine(id => skillManifests.some(skill => skill.id === id));
const scores = z.object({ completeness: z.number(), evidenceReliability: z.number(), citationCoverage: z.number(), logicalConsistency: z.number(), goalAlignment: z.number(), actionability: z.number() });
const schema = z.object({
  profile: z.object({ id: z.string().min(1), title: z.string().min(1), topic: z.string(), kind: z.enum(["industry", "technology"]), goal: z.string(), currentLevel: z.string(), timeBudgetHours: z.number(), createdAt: z.string(), updatedAt: z.string() }),
  runs: z.array(z.object({ skillId, status: z.enum(["locked", "ready", "running", "reviewing", "needs_input", "draft", "confirmed", "skipped", "stale", "failed"]), revision: z.number(), confirmedArtifactId: z.string().optional(), lastUpdatedAt: z.string().optional(), skipReason: z.string().optional() })),
  artifacts: z.array(z.object({ id: z.string(), skillId, revision: z.number(), status: z.enum(["draft", "confirmed"]), title: z.string(), summary: z.string(), content: z.string(), upstreamArtifactIds: z.array(z.string()), reflection: z.object({ overallScore: z.number(), scores, passed: z.boolean(), weaknesses: z.array(z.string()), revisionSummary: z.array(z.string()), needsUserInput: z.boolean() }), generatedBy: z.enum(["local-fallback", "configured-model"]), generationWarning: z.string().optional(), createdAt: z.string(), confirmedAt: z.string().optional() })),
  mastery: z.number(),
});

export function parseProjectBackup(text: string): ProjectWorkspace {
  try {
    const project = schema.parse(JSON.parse(text));
    if (project.runs.length !== skillManifests.length || new Set(project.runs.map(run => run.skillId)).size !== skillManifests.length) throw new Error();
    // A request running on another device cannot be resumed from a file.
    return { ...project, runs: project.runs.map(run => run.status === "running" ? { ...run, status: "failed" } : run) };
  } catch { throw new Error("无效的项目备份，请选择导出的项目 JSON 文件"); }
}

export function downloadProjectBackup(project: ProjectWorkspace) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.profile.title.replace(/[\\/:*?"<>|]/g, "-") || "project"}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
