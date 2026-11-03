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
    const project = schema.parse(JSON.parse(text.replace(/^\uFEFF/, "")));
    if (project.runs.length !== skillManifests.length || new Set(project.runs.map(run => run.skillId)).size !== skillManifests.length) throw new Error();
    // A request running on another device cannot be resumed from a file.
    return { ...project, runs: skillManifests.map(skill => {
      const run = project.runs.find(item => item.skillId === skill.id)!;
      return run.status === "running" ? { ...run, status: "failed" as const } : run;
    }) };
  } catch { throw new Error("无效的项目备份，请选择导出的项目 JSON 文件"); }
}

export function serializeProjectBackup(project: ProjectWorkspace) {
  const text = JSON.stringify(parseProjectBackup(JSON.stringify(project)), null, 2);
  if (new Blob([text]).size > 20 * 1024 * 1024) throw new Error("项目备份超过 20 MB，无法通过当前导入入口恢复，请减少项目内容后再导出。");
  return text;
}

export function downloadProjectBackup(project: ProjectWorkspace) {
  const url = URL.createObjectURL(new Blob([serializeProjectBackup(project)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  const filename = `${project.profile.title.replace(/[\\/:*?"<>|]/g, "-") || "project"}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return filename;
}
