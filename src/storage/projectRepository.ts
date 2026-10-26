import type { ProjectWorkspace } from "../domain/types";
import { createInitialRuns } from "../workflow/workflow";

const storageKey = "knowledge-quest.projects.v1";

export class LocalProjectRepository {
  list(): ProjectWorkspace[] {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as ProjectWorkspace[];
      return parsed.map((project) => {
        const artifacts = project.artifacts ?? [];
        const hasLegacyProgressWithoutArtifacts = artifacts.length === 0 && project.runs.some((run) => !["ready", "locked"].includes(run.status));
        return {
          ...project,
          artifacts,
          runs: hasLegacyProgressWithoutArtifacts ? createInitialRuns() : project.runs,
        };
      });
    } catch { return []; }
  }

  save(project: ProjectWorkspace): void {
    const projects = this.list();
    const index = projects.findIndex((item) => item.profile.id === project.profile.id);
    if (index >= 0) projects[index] = project;
    else projects.unshift(project);
    localStorage.setItem(storageKey, JSON.stringify(projects));
  }

  isDeleted(projectId: string): boolean {
    return (JSON.parse(localStorage.getItem("knowledge-quest.deleted-projects.v1") || "[]") as string[]).includes(projectId);
  }

  remove(projectId: string): void {
    const deleted = JSON.parse(localStorage.getItem("knowledge-quest.deleted-projects.v1") || "[]") as string[];
    localStorage.setItem("knowledge-quest.deleted-projects.v1", JSON.stringify([...new Set([...deleted, projectId])]));
    localStorage.setItem(storageKey, JSON.stringify(this.list().filter((item) => item.profile.id !== projectId)));
  }
}
