import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { createProjectDirectory, moveProjectDirectoryBinding, openProjectFromDirectory, saveProjectToDirectory, saveImportedProjectToWorkspace, scanWorkspaceProjects, supportsProjectFolders } from "../storage/projectDirectory";
import { parseProjectBackup, downloadProjectBackup } from "../storage/projectBackup";
import { createId } from "../utils/id";
import { ArtifactContent } from "../components/ArtifactContent";
import { MobilePanel } from "../components/MobilePanel";

const statusLabels: Record<SkillStatus, string> = {
  locked: "未解锁", ready: "可开始", running: "生成中", reviewing: "反思中",
  needs_input: "待补充", draft: "待确认", confirmed: "已完成", skipped: "已跳过",
  stale: "需更新", failed: "失败",
};

const repository = new LocalProjectRepository();

function loadProjects() {
  const saved = repository.list();
  if (saved.length > 0 || localStorage.getItem("knowledge-quest.projects.v1") !== null) return saved;
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
  const generationActive = useRef(false);
  const importInput = useRef<HTMLInputElement>(null);
  const [streaming, setStreaming] = useState<{ projectId: string; skillId: string; content: string }>();
  const [error, setError] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const importActive = useRef(false);
  const [mobilePanel, setMobilePanel] = useState<"config" | "steps">();
  const [mobileTab, setMobileTab] = useState<"task" | "result" | "review">("task");
  const skillContent = useRef<HTMLDivElement>(null);

  useEffect(() => { setMobileTab("task"); }, [activeProjectId, selectedSkillId]);
  useEffect(() => { if (skillContent.current) skillContent.current.scrollTop = 0; }, [activeProjectId, selectedSkillId, mobileTab]);

  useEffect(() => {
    void scanWorkspaceProjects().then((workspaceProjects) => {
      if (workspaceProjects.length === 0) return;
      setProjects((current) => {
        const byId = new Map(current.map((project) => [project.profile.id, project]));
        workspaceProjects.filter((project) => !repository.isDeleted(project.profile.id)).forEach((project) => { if (!byId.has(project.profile.id)) byId.set(project.profile.id, project); });
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
    void saveProjectToDirectory(updated).catch((reason) => setError("项目文件保存失败：" + (reason instanceof Error ? reason.message : String(reason))));
    setProjects((current) => current.map((item) => item.profile.id === updated.profile.id ? updated : item));
  }

  async function startProjectCreation() {
    const projectId = createId();
    setPendingProjectId(projectId);
    setShowWizard(true);
  }

  async function createProject(profile: ProjectProfile) {
    if (supportsProjectFolders() && pendingProjectId && pendingProjectId !== profile.id) await moveProjectDirectoryBinding(pendingProjectId, profile.id);
    const project: ProjectWorkspace = { profile, runs: createInitialRuns(), artifacts: [], mastery: 0 };
    if (supportsProjectFolders()) {
      try { await createProjectDirectory(project); }
      catch { setError("目录暂不可用，项目已保存在浏览器中，请导出备份。"); }
    }
    repository.save(project);
    void saveProjectToDirectory(project).catch((reason) => setError("项目文件保存失败：" + (reason instanceof Error ? reason.message : String(reason))));
    setProjects((current) => [project, ...current]);
    setActiveProjectId(project.profile.id);
    setSelectedSkillId(skillManifests[0].id);
    setShowWizard(false);
    setPendingProjectId(undefined);
    setFolderStatus("");
  }

  async function importBackup(file?: File) {
    if (!file || importActive.current) return;
    importActive.current = true;
    setImporting(true);
    setImportStatus("");
    try {
      if (generationActive.current) throw new Error("请等待当前生成结束后再导入项目");
      if (file.size > 20 * 1024 * 1024) throw new Error("备份文件不能超过 20 MB");
      const project = parseProjectBackup(await file.text());
      if (projects.some(item => item.profile.id === project.profile.id) && !window.confirm("该项目已存在，是否用备份覆盖当前学习记录？")) return;
      repository.save(project);
      setProjects(current => [project, ...current.filter(item => item.profile.id !== project.profile.id)]);
      setActiveProjectId(project.profile.id);
      setSelectedSkillId(getCurrentSkillId(project.runs) ?? skillManifests[0].id);
      setMobilePanel(undefined);
      setMobileTab("task");
      setError("");
      setImportStatus("项目已保存在浏览器，正在检查系统数据目录…");
      const saveStatus = await saveImportedProjectToWorkspace(project);
      setImportStatus(saveStatus + " PC 与手机备份通用，可继续学习后再次导出。模型 API Key 不随备份迁移，需要在本设备配置。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "导入失败"); }
    finally { importActive.current = false; setImporting(false); }
  }

  function exportBackup(project: ProjectWorkspace) {
    try {
      const filename = downloadProjectBackup(project);
      setImportStatus(`已发起备份下载：${filename}。请在浏览器下载列表或手机“文件”中确认保存，再传到另一设备，通过“导入项目备份”继续学习。备份不包含模型 API Key。`);
      setMobilePanel(undefined);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "导出失败"); }
  }

  const backupInput = <input ref={importInput} type="file" accept=".json,application/json" hidden aria-label="导入项目备份" onChange={event => { void importBackup(event.target.files?.[0]); event.target.value = ""; }} />;

  async function openProjectFolder() {
    try {
      const project = await openProjectFromDirectory();
      repository.save(project);
      setProjects((current) => [project, ...current.filter((item) => item.profile.id !== project.profile.id)]);
      setActiveProjectId(project.profile.id);
      setSelectedSkillId(getCurrentSkillId(project.runs) ?? skillManifests[0].id);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "打开项目文件夹失败");
    }
  }

  async function generateSelectedSkill() {
    if (importActive.current || generationActive.current || !activeProject || !selectedRun || selectedRun.status === "locked" || selectedRun.status === "running") return;
    setError("");
    const runningProject: ProjectWorkspace = {
      ...activeProject,
      runs: activeProject.runs.map((run) => run.skillId === selectedSkill.id ? { ...run, status: "running" } : run),
    };
    generationActive.current = true;
    setMobileTab("result");
    setStreaming({ projectId: activeProject.profile.id, skillId: selectedSkill.id, content: "" });
    persistProject(runningProject);
    try {
      const artifact = await generateSkillArtifact(runningProject, selectedSkill, (content) => {
        setStreaming({ projectId: runningProject.profile.id, skillId: selectedSkill.id, content });
      });
      persistProject({
        ...runningProject,
        artifacts: [...runningProject.artifacts, artifact],
        runs: runningProject.runs.map((run) => run.skillId === selectedSkill.id ? { ...run, status: "draft", lastUpdatedAt: new Date().toISOString() } : run),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成失败");
      persistProject({ ...runningProject, runs: runningProject.runs.map((run) => run.skillId === selectedSkill.id ? { ...run, status: "failed" } : run) });
    } finally {
      generationActive.current = false;
      setStreaming(undefined);
    }
  }

  function confirmSelectedArtifact() {
    if (importActive.current || generationActive.current || !activeProject || !selectedArtifact || selectedArtifact.status !== "draft") return;
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

  function deleteProject(project: ProjectWorkspace) {
    if (importActive.current) { setError("请等待导入保存完成后再删除项目"); return; }
    if (generationActive.current) { setError("请等待当前生成结束后再删除项目"); return; }
    if (!window.confirm(`确定删除主题“${project.profile.title}”及其在应用中的学习记录？磁盘中的项目备份仍会保留。`)) return;
    try {
      repository.remove(project.profile.id);
      const remaining = projects.filter(item => item.profile.id !== project.profile.id);
      setProjects(remaining);
      if (activeProjectId === project.profile.id) {
        setActiveProjectId(remaining[0]?.profile.id);
        setSelectedSkillId(getCurrentSkillId(remaining[0]?.runs ?? []) ?? skillManifests[0].id);
        setShowMentor(false);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "删除项目失败"); }
  }

  if (!activeProject) return <div className="app-shell"><main>
    {backupInput}<h1>开始新的学习主题</h1><p>暂无学习项目，创建一个主题开始学习。</p>
    <div className="action-row"><button className="primary-button" onClick={startProjectCreation}>创建学习项目</button>{supportsProjectFolders() && <button onClick={openProjectFolder}>打开项目目录</button>}<button onClick={() => importInput.current?.click()}>导入项目备份</button><button onClick={() => setShowSettings(true)}>模型与设置</button></div>
    {error && <p role="alert">{error}</p>}
    {showWizard && <ProjectWizard projectId={pendingProjectId} onClose={() => setShowWizard(false)} onCreate={createProject} />}
    {showSettings && <ModelSettingsModal onClose={() => setShowSettings(false)} />}
  </main></div>;
  const orbStyle = { "--progress": String(progress * 3.6) + "deg" } as CSSProperties;
  const mentorContext = activeProject.profile.topic + "；目标：" + activeProject.profile.goal + "；当前 Skill：" + selectedSkill.name;

  return (
    <div className={"app-shell project-open mobile-tab-" + mobileTab}>
      {backupInput}
      <header className="mobile-project-header">
        <select aria-label="切换学习项目" value={activeProject.profile.id} onChange={event => { const project = projects.find(item => item.profile.id === event.target.value)!; setActiveProjectId(project.profile.id); setSelectedSkillId(getCurrentSkillId(project.runs) ?? skillManifests[0].id); }}>
          {projects.map(project => <option key={project.profile.id} value={project.profile.id}>{project.profile.title}</option>)}
        </select>
        <button className="icon-button" aria-label="项目配置" onClick={() => setMobilePanel("config")}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-2Z"/><circle cx="12" cy="11" r="3"/></svg></button>
      </header>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">KQ</div><div><strong>Knowledge Quest</strong><span>知识征途</span></div></div>
        <button className="primary-button new-project" onClick={startProjectCreation}><span>＋</span> 创建学习项目</button>
        <p className="storage-hint">自动保存在当前浏览器，可导出备份后在其他设备导入。</p><p className="sidebar-label">学习项目</p>
        <nav className="project-list">
          {projects.map((project) => (
            <div className="project-list-row" key={project.profile.id}><button className={project.profile.id === activeProject.profile.id ? "project-card active" : "project-card"} key={project.profile.id} onClick={() => { setActiveProjectId(project.profile.id); setSelectedSkillId(getCurrentSkillId(project.runs) ?? skillManifests[0].id); }}>
              <span className="project-icon">{project.profile.kind === "industry" ? "⌬" : "⌁"}</span>
              <span><strong>{project.profile.title}</strong><small>{calculateProgress(project.runs)}% · {project.profile.kind === "industry" ? "行业" : "技术"}</small></span>
            </button><button className="project-delete" aria-label={"删除主题：" + project.profile.title} title="删除主题" disabled={Boolean(streaming)} onClick={() => deleteProject(project)}>×</button></div>
          ))}
        </nav>
        <div className="sidebar-footer"><button onClick={() => setShowLibrary(true)}>资料库</button><button onClick={() => exportBackup(activeProject)}>导出当前项目</button><button onClick={() => importInput.current?.click()}>导入项目备份</button>{supportsProjectFolders() && <button onClick={openProjectFolder}>打开项目目录</button>}<button onClick={() => setShowSettings(true)}>模型与设置</button></div>
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
            <div className="mobile-skill-heading"><span>第 {selectedSkill.order} / {skillManifests.length} 关 · {statusLabels[selectedRun?.status ?? "locked"]}</span><button className="secondary-button" onClick={() => setMobilePanel("steps")}>全部关卡 ▾</button></div>
            <div className="skill-title-row"><span className="large-skill-icon" style={{ color: selectedSkill.color }}>{selectedSkill.icon}</span><div><p className="eyebrow">Skill {selectedSkill.order}</p><h2>{selectedSkill.name}</h2></div><span className={"status-pill " + (selectedRun?.status ?? "locked")}>{statusLabels[selectedRun?.status ?? "locked"]}</span></div>
            <div className="mobile-workspace-tabs" role="tablist" aria-label="关卡内容">
              {([['task', '任务'], ['result', '成果'], ['review', '反思']] as const).map(([tab, label]) => <button key={tab} id={"mobile-tab-" + tab} role="tab" aria-selected={mobileTab === tab} aria-controls="skill-content" onClick={() => setMobileTab(tab)}>{label}</button>)}
            </div>
            <div ref={skillContent} id="skill-content" className="skill-content" role="tabpanel" aria-labelledby={"mobile-tab-" + mobileTab}>
            <div className="skill-task">
            <p className="skill-description">{selectedSkill.description}</p>
            <div className="input-context"><strong>本步输入</strong><span>{selectedSkill.order === 1 ? "项目访谈档案" : "前序已确认成果 " + activeProject.artifacts.filter((artifact) => artifact.status === "confirmed" && skillManifests.find((skill) => skill.id === artifact.skillId)!.order < selectedSkill.order).length + " 项"}</span></div>
            <div className="mission-block"><h3>本关预期产出</h3><div className="output-tags">{selectedSkill.outputSections.map((section) => <span key={section}>{section}</span>)}</div></div>
            </div>
            <div className="skill-result">
            {selectedRun?.status === "running" && streaming?.projectId === activeProject.profile.id && streaming.skillId === selectedSkillId ? <div className="artifact-view" aria-live="polite"><h3>正在生成…</h3><ArtifactContent content={streaming.content || "正在等待模型输出…"} streaming /></div> : selectedArtifact ? <ArtifactView artifact={selectedArtifact} /> : <div className="empty-artifact"><span>◇</span><h3>尚未生成本关成果</h3><p>生成时会结合项目档案和所有上游已确认成果，并执行反思检查。</p></div>}
            </div>
            </div>
            {error && <p className="error-message" role="alert">{error}</p>}
            {importStatus && <div className="import-status" role="status"><span>{importStatus}</span>{!importing && <button aria-label="关闭导入提示" onClick={() => setImportStatus("")}>×</button>}</div>}
            <div className="action-row"><span className={isModelConfigured() ? "model-state configured" : "model-state"}>{isModelConfigured() ? "● 已配置模型" : "○ 未配置模型，将使用本地兜底内容"}</span><button className="secondary-button" onClick={() => setShowSettings(true)}>模型配置</button><button className="secondary-button" disabled={selectedRun?.status === "locked" || selectedRun?.status === "running"} onClick={generateSelectedSkill}>{selectedRun?.status === "running" ? "生成中…" : selectedArtifact ? "重新生成" : "生成本关成果"}</button><button className="primary-button" disabled={selectedRun?.status === "running" || !selectedArtifact || selectedArtifact.status !== "draft"} onClick={confirmSelectedArtifact}>确认并进入下一关</button></div>
          </article>

          <aside className="intel-panel">
            <div className="panel-heading"><h3>成果链路</h3><span>{activeProject.artifacts.length} 个版本</span></div>
            {activeProject.artifacts.length === 0 && <p className="empty-side">完成第一步后，这里会显示每一步的成果摘要和传递关系。</p>}
            {activeProject.artifacts.slice().reverse().slice(0, 6).map((artifact) => <button className="artifact-link" key={artifact.id} onClick={() => setSelectedSkillId(artifact.skillId)}><strong>{artifact.title}</strong><small>{artifact.status === "confirmed" ? "已确认并传递" : "等待确认"} · 上游 {artifact.upstreamArtifactIds.length} 项</small></button>)}
            <div className="privacy-note"><span>⌾</span><p><strong>信息逐层传递</strong>下一步只读取上游已确认成果。重新确认上游后，相关下游结果会标记为需要更新。</p></div>
          </aside>
        </section>
      </main>

      <div className="mobile-action-dock">
        <span>{selectedRun?.status === "locked" ? "请先确认前置关卡成果" : streaming ? "正在生成，请稍候" : isModelConfigured() ? "● 已配置模型 · 本地自动保存" : "未配置模型，将使用本地兜底内容"}</span>
        <div><button className="secondary-button" onClick={() => setMobilePanel("steps")}>关卡</button>
          {selectedArtifact?.status === "draft" && <button className="secondary-button" disabled={Boolean(streaming)} onClick={generateSelectedSkill}>重新生成</button>}
          <button className="primary-button" disabled={Boolean(streaming) || selectedRun?.status === "locked" || !selectedRun} onClick={selectedArtifact?.status === "draft" ? confirmSelectedArtifact : generateSelectedSkill}>{streaming ? "生成中…" : selectedArtifact?.status === "draft" ? (selectedSkill.order === skillManifests.length ? "确认完成" : "确认并进入下一关") : selectedArtifact ? "重新生成" : "生成本关成果"}</button>
        </div>
      </div>
      {mobilePanel && <MobilePanel title={mobilePanel === "config" ? "项目与配置" : "学习关卡"} sheet={mobilePanel === "steps"} onClose={() => setMobilePanel(undefined)}>
        {mobilePanel === "config" ? <div className="mobile-config-actions">
          <button onClick={() => { setMobilePanel(undefined); void startProjectCreation(); }}>＋ 创建学习项目</button>
          <button onClick={() => { setMobilePanel(undefined); setShowLibrary(true); }}>资料库</button>
          <button onClick={() => exportBackup(activeProject)}>导出当前项目</button>
          <button disabled={Boolean(streaming)} onClick={() => { setMobilePanel(undefined); importInput.current?.click(); }}>导入项目备份</button>
          <button disabled={!supportsProjectFolders() || Boolean(streaming)} onClick={() => { setMobilePanel(undefined); void openProjectFolder(); }}>{supportsProjectFolders() ? "打开项目目录" : "打开项目目录（此浏览器不支持）"}</button>
          <button onClick={() => { setMobilePanel(undefined); setShowSettings(true); }}>模型设置</button>
          <button onClick={() => { setMobilePanel(undefined); setShowMentor(true); }}>AI 学习导师</button>
          <button disabled={Boolean(streaming)} onClick={() => { deleteProject(activeProject); setMobilePanel(undefined); }}>删除当前项目</button>
          <p className="storage-hint">记录保存在当前浏览器，请定期导出备份。</p>
        </div> : <nav className="mobile-step-list" aria-label="全部学习关卡">{skillManifests.map(skill => {
          const run = activeProject.runs.find(item => item.skillId === skill.id);
          return <button key={skill.id} aria-current={skill.id === selectedSkillId ? "step" : undefined} onClick={() => { setSelectedSkillId(skill.id); setMobilePanel(undefined); setMobileTab("task"); }}><strong>{skill.order}. {skill.name}</strong><span>{statusLabels[run?.status ?? "locked"]}</span></button>;
        })}</nav>}
      </MobilePanel>}

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
  return <div className="artifact-view"><div className="artifact-heading"><div><p className="eyebrow">生成成果 · Revision {artifact.revision}</p><h3>{artifact.title}</h3></div><span className={artifact.status === "confirmed" ? "confirmed" : "draft"}>{artifact.status === "confirmed" ? "已确认" : "草稿"}</span></div><p className="artifact-source">生成方式：{artifact.generatedBy === "configured-model" ? "已配置模型" : "本地兜底模板"} · 使用上游成果 {artifact.upstreamArtifactIds.length} 项</p>{artifact.generationWarning && <p className="fallback-warning"><strong>模型暂时不可用</strong>{artifact.generationWarning}。系统已保留本地草稿，你可以稍后重新生成。</p>}<ArtifactContent content={artifact.content} /><div className="reflection-preview"><div className="reflection-header"><span>✧</span><div><strong>反思报告 · {artifact.reflection.overallScore} 分</strong><small>{artifact.reflection.passed ? "达到质量阈值" : "尚未达到正式质量阈值"}</small></div></div><Score label="完整性" value={artifact.reflection.scores.completeness} /><Score label="证据可靠性" value={artifact.reflection.scores.evidenceReliability} /><Score label="逻辑一致性" value={artifact.reflection.scores.logicalConsistency} />{artifact.reflection.weaknesses.length > 0 && <ul>{artifact.reflection.weaknesses.map((item) => <li key={item}>{item}</li>)}</ul>}</div></div>;
}

function Score({ label, value }: { label: string; value: number }) {
  return <div className="score-row"><span>{label}</span><i><b style={{ width: value + "%" }} /></i><em>{value}</em></div>;
}
