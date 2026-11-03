import { afterEach, describe, expect, it, vi } from "vitest";
import { createSampleProject } from "../app/sampleProject";
import { createProjectDirectory, saveProjectToDirectory, saveImportedProjectToWorkspace } from "./projectDirectory";
import { parseProjectBackup, serializeProjectBackup } from "./projectBackup";

interface TestFolder {
  name: string;
  kind: string;
  files: Map<string, string>;
  children: Map<string, TestFolder>;
  queryPermission: ReturnType<typeof vi.fn<() => Promise<string>>>;
  getDirectoryHandle: ReturnType<typeof vi.fn<(name: string) => Promise<TestFolder>>>;
  getFileHandle: ReturnType<typeof vi.fn>;
  entries(): AsyncGenerator<[string, TestFolder]>;
}
function folder(name: string): TestFolder {
  const files = new Map<string, string>();
  const children = new Map<string, ReturnType<typeof folder>>();
  return {
    name, kind: "directory", files, children,
    queryPermission: vi.fn(async () => "granted"),
    getDirectoryHandle: vi.fn(async (child: string) => {
      if (!children.has(child)) children.set(child, folder(child));
      return children.get(child)!;
    }),
    getFileHandle: vi.fn(async (file: string, options?: { create?: boolean }) => {
      if (!files.has(file) && !options?.create) throw new Error("missing");
      return { getFile: async () => ({ text: async () => files.get(file)! }), createWritable: async () => ({ write: async (text: string) => { files.set(file, text); }, close: async () => {} }) };
    }),
    async *entries(): AsyncGenerator<[string, ReturnType<typeof folder>]> { yield* children.entries(); },
  };
}

function setup(workspace?: ReturnType<typeof folder>) {
  const handles = new Map<string, unknown>(workspace ? [["__workspace__", workspace]] : []);
  const request = (result: unknown) => {
    const req = { result, onsuccess: undefined as undefined | (() => void) };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  };
  const db = { close() {}, transaction: () => ({ objectStore: () => ({ get: (id: string) => request(handles.get(id)), put: (value: unknown, id: string) => { handles.set(id, value); return request(undefined); } }) }) };
  const indexedDB = { open: () => request(db) };
  vi.stubGlobal("indexedDB", indexedDB);
  vi.stubGlobal("window", { indexedDB, showDirectoryPicker() {} });
  return handles;
}

afterEach(() => vi.unstubAllGlobals());
describe("import directory persistence", () => {
  it("returns a mobile-edited PC project to its original PC-created directory", async () => {
    const workspace = folder("PC工作区");
    const handles = setup(workspace);
    const pc = createSampleProject();
    await createProjectDirectory(pc);
    await saveProjectToDirectory(pc);
    const original = handles.get(pc.profile.id) as TestFolder;
    const mobile = parseProjectBackup(serializeProjectBackup(pc));
    mobile.profile.goal = "手机新增的学习目标";
    mobile.mastery = 42;
    const returned = parseProjectBackup(serializeProjectBackup(mobile));
    expect(await saveImportedProjectToWorkspace(returned)).toContain("已更新");
    expect(workspace.children.get("projects")!.children.size).toBe(1);
    expect(handles.get(pc.profile.id)).toBe(original);
    expect(JSON.parse(original.files.get("project.json")!)).toEqual(returned);
    expect(JSON.parse(original.children.get("backups")!.files.get("latest.json")!)).toEqual(returned);
  });
  it("creates all project files in the configured workspace and binds the folder", async () => {
    const workspace = folder("学习数据"), handles = setup(workspace), project = createSampleProject();
    expect(await saveImportedProjectToWorkspace(project)).toContain("已创建");
    const directory = [...workspace.children.get("projects")!.children.values()][0];
    expect(JSON.parse(directory.files.get("project.json")!)).toEqual(project);
    expect(directory.files.has("artifacts.json")).toBe(true);
    expect(directory.children.get("backups")!.files.has("latest.json")).toBe(true);
    expect(handles.get(project.profile.id)).toBe(directory);
  });
  it("updates the same ID after a title change without duplicating directories", async () => {
    const workspace = folder("数据"); setup(workspace);
    const project = createSampleProject();
    await saveImportedProjectToWorkspace(project);
    project.profile.title = "改名后的项目";
    expect(await saveImportedProjectToWorkspace(project)).toContain("已更新");
    expect(workspace.children.get("projects")!.children.size).toBe(1);
  });
  it("clearly reports missing workspace, revoked permission and failed writes", async () => {
    setup();
    expect(await saveImportedProjectToWorkspace(createSampleProject())).toContain("尚未设置");
    const workspace = folder("数据"); setup(workspace);
    workspace.queryPermission.mockResolvedValue("denied");
    expect(await saveImportedProjectToWorkspace(createSampleProject())).toContain("重新授权");
    workspace.queryPermission.mockResolvedValue("granted");
    workspace.getDirectoryHandle.mockRejectedValue(new Error("disk error"));
    expect(await saveImportedProjectToWorkspace(createSampleProject())).toContain("写入未完成");
  });
  it("supports browsers without directory access", async () => {
    vi.stubGlobal("window", {});
    expect(await saveImportedProjectToWorkspace(createSampleProject())).toContain("此浏览器不支持");
  });
});
