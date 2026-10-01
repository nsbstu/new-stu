import type { ProjectWorkspace } from "../domain/types";

const handleDbName = "knowledge-quest.directory-handles.v1";
const handleStore = "handles";
const workspaceKey = "__workspace__";

type DirectoryHandle = {
  name: string;
  kind: "directory";
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
  getDirectoryHandle?(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  entries?(): AsyncIterableIterator<[string, DirectoryHandle | FileHandleLike]>;
  queryPermission?(options: { mode: "read" | "readwrite" }): Promise<string>;
  requestPermission?(options: { mode: "read" | "readwrite" }): Promise<string>;
};
type FileHandleLike = { createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>; getFile(): Promise<File> };

function picker(): (() => Promise<DirectoryHandle>) | undefined {
  return (window as unknown as { showDirectoryPicker?: () => Promise<DirectoryHandle> }).showDirectoryPicker;
}

function openHandleDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(handleDbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(handleStore);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putHandle(projectId: string, handle: DirectoryHandle) {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(handleStore, "readwrite").objectStore(handleStore).put(handle, projectId);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
  db.close();
}

export async function moveProjectDirectoryBinding(fromProjectId: string, toProjectId: string) {
  const handle = await getHandle(fromProjectId);
  if (!handle) return false;
  await putHandle(toProjectId, handle);
  return true;
}

async function getHandle(projectId: string) {
  const db = await openHandleDb();
  const handle = await new Promise<DirectoryHandle | undefined>((resolve, reject) => {
    const request = db.transaction(handleStore, "readonly").objectStore(handleStore).get(projectId);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  db.close();
  return handle;
}

async function writeText(directory: DirectoryHandle, name: string, text: string) {
  const file = await directory.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(text);
  await writable.close();
}

export function supportsProjectFolders() {
  return typeof window !== "undefined" && Boolean(picker() && window.indexedDB);
}

export async function chooseProjectDirectory(projectId: string) {
  const choose = picker();
  if (!choose) return undefined;
  const directory = await choose();
  await putHandle(projectId, directory);
  return directory;
}

export async function getWorkspaceDirectory() { return getHandle(workspaceKey); }

export async function chooseWorkspaceDirectory() {
  const choose = picker();
  if (!choose) throw new Error("当前浏览器不支持系统数据目录，请使用 Chrome 或 Edge。 ");
  const directory = await choose();
  await putHandle(workspaceKey, directory);
  if (directory.getDirectoryHandle) await directory.getDirectoryHandle("projects", { create: true });
  return directory;
}

export async function workspaceDisplayName() {
  const directory = await getWorkspaceDirectory();
  return directory?.name ?? "未设置";
}

export async function createProjectDirectory(project: ProjectWorkspace) {
  const workspace = await getWorkspaceDirectory();
  if (!workspace?.getDirectoryHandle) return false;
  const projects = await workspace.getDirectoryHandle("projects", { create: true });
  if (!projects.getDirectoryHandle) return false;
  const safeName = project.profile.title.replace(/[\\/:*?\"<>|]/g, "-").trim() || project.profile.id;
  const directory = await projects.getDirectoryHandle(`${safeName}-${project.profile.id.slice(0, 8)}`, { create: true });
  await putHandle(project.profile.id, directory);
  return true;
}

export async function scanWorkspaceProjects() {
  const workspace = await getWorkspaceDirectory();
  if (!workspace?.getDirectoryHandle || !workspace.entries) return [];
  const projects = await workspace.getDirectoryHandle("projects", { create: true });
  if (!projects.entries) return [];
  const found: ProjectWorkspace[] = [];
  for await (const [, entry] of projects.entries()) {
    if (!("getFileHandle" in entry)) continue;
    try {
      const fileHandle = await entry.getFileHandle("project.json");
      const project = JSON.parse(await (await fileHandle.getFile()).text()) as ProjectWorkspace;
      if (project.profile?.id && Array.isArray(project.runs) && Array.isArray(project.artifacts)) {
        await putHandle(project.profile.id, entry);
        found.push(project);
      }
    } catch { /* ignore non-project folders */ }
  }
  return found;
}

export async function saveProjectToDirectory(project: ProjectWorkspace) {
  const directory = await getHandle(project.profile.id);
  if (!directory) return false;
  if (directory.queryPermission && (await directory.queryPermission({ mode: "readwrite" })) !== "granted") return false;
  await writeText(directory, "project.json", JSON.stringify(project, null, 2));
  await writeText(directory, "events.jsonl", JSON.stringify({ at: new Date().toISOString(), type: "project-saved", artifactCount: project.artifacts.length }) + "\n");
  const artifacts = await directory.getFileHandle("artifacts.json", { create: true });
  const writable = await artifacts.createWritable();
  await writable.write(JSON.stringify(project.artifacts, null, 2));
  await writable.close();
  if (directory.getDirectoryHandle) {
    const backups = await directory.getDirectoryHandle("backups", { create: true });
    await writeText(backups, "latest.json", JSON.stringify(project, null, 2));
  }
  return true;
}

export async function openProjectFromDirectory() {
  const choose = picker();
  if (!choose) throw new Error("当前浏览器不支持选择项目文件夹，请使用 Chrome 或 Edge。 ");
  const directory = await choose();
  const fileHandle = await directory.getFileHandle("project.json");
  const file = await fileHandle.getFile();
  const project = JSON.parse(await file.text()) as ProjectWorkspace;
  if (!project.profile?.id || !Array.isArray(project.runs) || !Array.isArray(project.artifacts)) throw new Error("该文件夹不是有效的 Knowledge Quest 项目。 ");
  await putHandle(project.profile.id, directory);
  return project;
}
