import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ProjectProfile, ProjectWorkspace, SkillArtifact, SkillStatus } from "../domain/types";
import { skillManifests } from "../skills/manifests";
import { generateSkillArtifact } from "../skills/engine";
import { LocalProjectRepository } from "../storage/projectRepository";
import { calculateProgress, confirmSkill, createInitialRuns, getCurrentSkillId } from "../workflow/workflow";
import { createSampleProject } from "./sampleProject";
import { ProjectWizard } from "../components/ProjectWizard";
import { ModelSettingsModal } from "../components/ModelSettingsModal";
import { MentorChat } from "../components/MentorChat";
import { isModelConfigured } from "../ai/modelSettings";
import { createProjectDirectory, getWorkspaceDirectory, moveProjectDirectoryBinding, openProjectFromDirectory, saveProjectToDirectory, scanWorkspaceProjects, supportsProjectFolders } from "../storage/projectDirectory";

const statusLabels: Record<SkillStatus, string> = {
  locked: "未解锁", ready: "可开始", running: "生成中", reviewing: "反思中",
  needs_input: "待补充", draft: "待确认", confirmed: "已完成", skipped: "已跳过",
  stale: "需更新", failed: "失败",
};

const repository = new LocalProjectRepository();

function loadProjects() {
  const saved = repository.list();
  if (saved.length > 0) return saved;
  const sample = createSampleProject();
  repository.save(sample);
  return [sample];
}

export function App() {
  const [projects, setProjects] = useState<ProjectWorkspace[]>(loadProjects);
  const [activeProjectId, setActiveProjectId] = useState(projects[0]?.profile.id);
  const [selectedSkillId, setSelectedSkillId] = useState(getCurrentSkillId(projects[0]?.runs ?? []) ?? skillManifests[0].id);
  const [showWizard, setShowWizard] = useState(false);
  const [pendingProjectId, setPendingProjectId] = useState<string>();
  const [folderStatus, setFolderStatus] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showMentor, setShowMentor] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void scanWorkspaceProjects().then((workspaceProjects) => {
      if (workspaceProjects.length === 0) return;
      setProjects((current) => {
        const byId = new Map(current.map((project) => [project.profile.id, project]));
        workspaceProjects.forEach((project) => byId.set(project.profile.id, project));
        return [...byId.values()];
      });
    }).catch(() => undefined);
  }, []);

  const activeProject = projects.find((item) => item.profile.id === activeProjectId) ?? projects[0];
  const selectedSkill = skillManifests.find((skill) => skill.id === selectedSkillId) ?? skillManifests[0];
  const selectedRun = activeProject?.runs.find((run) => run.skillId === selectedSkillId);
  const selectedArtifacts = activeProject?.artifacts.filter((artifact) => artifact.skillId === selectedSkillId) ?? [];
  const selectedArtifact = selectedArtifacts[selectedArtifacts.length - 1];
  const progress = activeProject ? calculateProgress(activeProject.runs) : 0;
  const completedCount = useMemo(() => activeProject?.runs.filter((run) => ["confirmed", "skipped"].includes(run.status)).length ?? 0, [activeProject]);

  function persistProject(updated: ProjectWorkspace) {
    repository.save(updated);
    void saveProjectToDirectory(updated);
    setProjects((current) => current.map((item) => item.profile.id === updated.profile.id ? updated : item));
  }

  async function startProjectCreation() {
    const projectId = crypto.randomUUID();
    if (supportsProjectFolders()) {
      const workspace = await getWorkspaceDirectory();
      if (!workspace) { setFolderStatus("请先在“模型与设置”中设置系统数据目录"); setShowSettings(true); return; }
    }
    setPendingProjectId(projectId);
    setShowWizard(true);
  }

  async function createProject(profile: ProjectProfile) {
    if (pendingProjectId && pendingProjectId !== profile.id) await moveProjectDirectoryBinding(pendingProjectId, profile.id);
    const project: ProjectWorkspace = { profile, runs: createInitialRuns(), artifacts: [], mastery: 0 };
    await createProjectDirectory(project);
    repository.save(project);
    void saveProjectToDirectory(project);
    setProjects((current) => [project, ...current]);
    setActiveProjectId(project.profile.id);
    setSelectedSkillId(skillManifests[0].id);
    setShowWizard(false);
    setPendingProjectId(undefined);
    setFolderStatus("");
  }

  async function openProjectFolder() {
    try {
      const project = await openProjectFromDirectory();
      repository.save(project);
      setProjects((current) => [project, ...current.filter((item) => item.profile.id !== project.profile.id)]);
      setActiveProjectId(project.profile.id);
      setSelectedSkillId(getCurrentSkillId(project.runs) ?? skillManifests[0].id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "打开项目文件夹失败");
    }
  }

  async function generateSelectedSkill() {
    if (!activeProject || !selectedRun || selectedRun.status === "locked" || selectedRun.status === "running") return;
    setError("");
    const runningProject: ProjectWorkspace = {
      ...activeProject,
      runs: activeProject.runs.map((run) => run.skillId === selectedSkill.id ? { ...run, status: "running" } : run),
    };
    persistProject(runningProject);
    try {
      const artifact = await generateSkillArtifact(runningProject, selectedSkill);
      persistProject({
        ...runningProject,
        artifacts: [...runningProject.artifacts, artifact],
        runs: runningProject.runs.map((run) => run.skillId === selectedSkill.id ? { ...run, status: "draft", lastUpdatedAt: new Date().toISOString() } : run),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成失败");
      persistProject({ ...runningProject, runs: runningProject.runs.map((run) => run.skillId === selectedSkill.id ? { ...run, status: "failed" } : run) });
    }
  }

  function confirmSelectedArtifact() {
    if (!activeProject || !selectedArtifact || selectedArtifact.status !== "draft") return;
    const now = new Date().toISOString();
    const artifacts = activeProject.artifacts.map((artifact) => artifact.id === selectedArtifact.id ? { ...artifact, status: "confirmed" as const, confirmedAt: now } : artifact);
    const updated: ProjectWorkspace = {
      ...activeProject,
      profile: { ...activeProject.profile, updatedAt: now },
      artifacts,
      runs: confirmSkill(activeProject.runs, selectedSkill.id, selectedArtifact.id),
    };
    persistProject(updated);
    const next = skillManifests[selectedSkill.order];
    if (next) setSelectedSkillId(next.id);
  }

  if (!activeProject) return null;
  const orbStyle = { "--progress": String(progress * 3.6) + "deg" } as CSSProperties;
  const mentorContext = activeProject.profile.topic + "；目标：" + activeProject.profile.goal + "；当前 Skill：" + selectedSkill.name;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">KQ</div><div><strong>Knowledge Quest</strong><span>知识征途</span></div></div>
        <button className="primary-button new-project" onClick={startProjectCreation}><span>＋</span> 创建学习项目</button>
        <p className="sidebar-label">学习项目</p>
        <nav className="project-list">
          {projects.map((project) => (
            <button className={project.profile.id === activeProject.profile.id ? "project-card active" : "project-card"} key={project.profile.id} onClick={() => { setActiveProjectId(project.profile.id); setSelectedSkillId(getCurrentSkillId(project.runs) ?? skillManifests[0].id); }}>
              <span className="project-icon">{project.profile.kind === "industry" ? "⌬" : "⌁"}</span>
              <span><strong>{project.profile.title}</strong><small>{calculateProgress(project.runs)}% · {project.profile.kind === "industry" ? "行业" : "技术"}</small></span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><button onClick={() => setShowLibrary(true)}>资料库</button><button onClick={openProjectFolder}>打开已有项目</button><button onClick={() => setShowSettings(true)}>模型与设置</button></div>
      </aside>

      <main>
        <header className="topbar">
          <div><p className="eyebrow">当前远征</p><h1>{activeProject.profile.title}</h1></div>
          <div className="topbar-stats"><button className="mentor-button" onClick={() => setShowMentor(true)}>✦ AI 学习导师</button><div><span>总体掌握</span><strong>{activeProject.mastery}%</strong></div><div><span>完成关卡</span><strong>{completedCount}/8</strong></div></div>
        </header>

        <section className="hero-card">
          <div className="hero-copy"><span className="quest-badge">{activeProject.profile.kind === "industry" ? "行业探索任务" : "技术学习任务"}</span><h2>{activeProject.profile.topic}</h2><p>{activeProject.profile.goal}</p></div>
          <div className="progress-orb" style={orbStyle}><div><strong>{progress}%</strong><span>远征进度</span></div></div>
        </section>

        <section className="quest-map-section">
          <div className="section-heading"><div><p className="eyebrow">八阶段工作流</p><h2>学习远征地图</h2></div><span className="autosave">● 本地自动保存</span></div>
          <div className="quest-map">
            {skillManifests.map((skill, index) => {
              const run = activeProject.runs[index];
              return <button key={skill.id} className={"quest-node " + run.status + (skill.id === selectedSkillId ? " selected" : "")} onClick={() => setSelectedSkillId(skill.id)}><span className="node-order">{String(skill.order).padStart(2, "0")}</span><span className="node-icon" style={{ background: skill.color }}>{skill.icon}</span><span className="node-copy"><strong>{skill.shortName}</strong><small>{skill.name}</small></span><span className="node-status">{statusLabels[run.status]}</span></button>;
            })}
          </div>
        </section>

        <section className="workspace-grid">
          <article className="skill-panel">
            <div className="skill-title-row"><span className="large-skill-icon" style={{ color: selectedSkill.color }}>{selectedSkill.icon}</span><div><p className="eyebrow">Skill {selectedSkill.order}</p><h2>{selectedSkill.name}</h2></div><span className={"status-pill " + (selectedRun?.status ?? "locked")}>{statusLabels[selectedRun?.status ?? "locked"]}</span></div>
            <p className="skill-description">{selectedSkill.description}</p>
            <div className="input-context"><strong>本步输入</strong><span>{selectedSkill.order === 1 ? "项目访谈档案" : "前序已确认成果 " + activeProject.artifacts.filter((artifact) => artifact.status === "confirmed" && skillManifests.find((skill) => skill.id === artifact.skillId)!.order < selectedSkill.order).length + " 项"}</span></div>
            <div className="mission-block"><h3>本关预期产出</h3><div className="output-tags">{selectedSkill.outputSections.map((section) => <span key={section}>{section}</span>)}</div></div>
            {selectedArtifact ? <ArtifactView artifact={selectedArtifact} /> : <div className="empty-artifact"><span>◇</span><h3>尚未生成本关成果</h3><p>生成时会结合项目档案和所有上游已确认成果，并执行反思检查。</p></div>}
            {error && <p className="error-message">{error}</p>}
            <div className="action-row"><span className={isModelConfigured() ? "model-state configured" : "model-state"}>{isModelConfigured() ? "● 已配置模型" : "○ 未配置模型，将使用本地兜底内容"}</span><button className="secondary-button" onClick={() => setShowSettings(true)}>模型配置</button><button className="secondary-button" disabled={selectedRun?.status === "locked" || selectedRun?.status === "running"} onClick={generateSelectedSkill}>{selectedRun?.status === "running" ? "生成中…" : selectedArtifact ? "重新生成" : "生成本关成果"}</button><button className="primary-button" disabled={!selectedArtifact || selectedArtifact.status !== "draft"} onClick={confirmSelectedArtifact}>确认并进入下一关</button></div>
          </article>

          <aside className="intel-panel">
            <div className="panel-heading"><h3>成果链路</h3><span>{activeProject.artifacts.length} 个版本</span></div>
            {activeProject.artifacts.length === 0 && <p className="empty-side">完成第一步后，这里会显示每一步的成果摘要和传递关系。</p>}
            {activeProject.artifacts.slice().reverse().slice(0, 6).map((artifact) => <button className="artifact-link" key={artifact.id} onClick={() => setSelectedSkillId(artifact.skillId)}><strong>{artifact.title}</strong><small>{artifact.status === "confirmed" ? "已确认并传递" : "等待确认"} · 上游 {artifact.upstreamArtifactIds.length} 项</small></button>)}
            <div className="privacy-note"><span>⌾</span><p><strong>信息逐层传递</strong>下一步只读取上游已确认成果。重新确认上游后，相关下游结果会标记为需要更新。</p></div>
          </aside>
        </section>
      </main>

      {folderStatus && <div className="folder-status" role="status">⌂ {folderStatus}</div>}
      {showWizard && <ProjectWizard projectId={pendingProjectId} onClose={() => { setShowWizard(false); setPendingProjectId(undefined); }} onCreate={createProject} />}
      {showLibrary && <LibraryModal projects={projects} onClose={() => setShowLibrary(false)} onOpenArtifact={(projectId, skillId) => { setActiveProjectId(projectId); setSelectedSkillId(skillId); setShowLibrary(false); }} />}
      {showSettings && <ModelSettingsModal onClose={() => setShowSettings(false)} onWorkspaceChanged={() => setFolderStatus("系统数据目录已更新")} />}
      {showMentor && <MentorChat context={mentorContext} onClose={() => setShowMentor(false)} onOpenSettings={() => { setShowMentor(false); setShowSettings(true); }} />}
    </div>
  );
}

function LibraryModal({ projects, onClose, onOpenArtifact }: { projects: ProjectWorkspace[]; onClose: () => void; onOpenArtifact: (projectId: string, skillId: string) => void }) {
  const artifactCount = projects.reduce((total, project) => total + project.artifacts.length, 0);
  return (
    <div className="modal-backdrop">
      <section className="modal library-modal">
        <div className="modal-header"><div><p className="eyebrow">Knowledge Library</p><h2>资料库</h2><p className="library-subtitle">汇总所有学习项目中生成和确认的成果版本，共 {artifactCount} 项。</p></div><button onClick={onClose}>×</button></div>
        {artifactCount === 0 && <div className="empty-artifact"><span>◇</span><h3>资料库还是空的</h3><p>在任一 Skill 中生成成果后，版本会自动收录到这里。</p></div>}
        <div className="library-projects">
          {projects.filter((project) => project.artifacts.length > 0).map((project) => (
            <section className="library-project" key={project.profile.id}>
              <div className="library-project-heading"><div><strong>{project.profile.title}</strong><span>{project.profile.topic}</span></div><em>{project.artifacts.length} 个版本</em></div>
              <div className="library-artifacts">
                {project.artifacts.slice().reverse().map((artifact) => {
                  const skill = skillManifests.find((item) => item.id === artifact.skillId);
                  return <button className="library-artifact-card" key={artifact.id} onClick={() => onOpenArtifact(project.profile.id, artifact.skillId)}><span className="library-skill-icon" style={{ color: skill?.color }}>{skill?.icon ?? "◇"}</span><span className="library-artifact-copy"><strong>{artifact.title}</strong><small>{skill?.name ?? artifact.skillId} · {new Date(artifact.createdAt).toLocaleString("zh-CN")}</small><p>{artifact.summary}</p></span><span className={artifact.status === "confirmed" ? "library-status confirmed" : "library-status"}>{artifact.status === "confirmed" ? "已确认" : "草稿"}<small>反思 {artifact.reflection.overallScore} 分</small></span></button>;
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function ArtifactView({ artifact }: { artifact: SkillArtifact }) {
  return <div className="artifact-view"><div className="artifact-heading"><div><p className="eyebrow">生成成果 · Revision {artifact.revision}</p><h3>{artifact.title}</h3></div><span className={artifact.status === "confirmed" ? "confirmed" : "draft"}>{artifact.status === "confirmed" ? "已确认" : "草稿"}</span></div><p className="artifact-source">生成方式：{artifact.generatedBy === "configured-model" ? "已配置模型" : "本地兜底模板"} · 使用上游成果 {artifact.upstreamArtifactIds.length} 项</p>{artifact.generationWarning && <p className="fallback-warning"><strong>模型暂时不可用</strong>{artifact.generationWarning}。系统已保留本地草稿，你可以稍后重新生成。</p>}<pre>{artifact.content}</pre><div className="reflection-preview"><div className="reflection-header"><span>✧</span><div><strong>反思报告 · {artifact.reflection.overallScore} 分</strong><small>{artifact.reflection.passed ? "达到质量阈值" : "尚未达到正式质量阈值"}</small></div></div><Score label="完整性" value={artifact.reflection.scores.completeness} /><Score label="证据可靠性" value={artifact.reflection.scores.evidenceReliability} /><Score label="逻辑一致性" value={artifact.reflection.scores.logicalConsistency} />{artifact.reflection.weaknesses.length > 0 && <ul>{artifact.reflection.weaknesses.map((item) => <li key={item}>{item}</li>)}</ul>}</div></div>;
}

function Score({ label, value }: { label: string; value: number }) {
  return <div className="score-row"><span>{label}</span><i><b style={{ width: value + "%" }} /></i><em>{value}</em></div>;
}
