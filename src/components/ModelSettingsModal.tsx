import { useEffect, useState } from "react";
import type { ModelSettings } from "../domain/types";
import { loadApiKey, loadModelSettings, modelEndpoint, normalizeModelBaseUrl, saveModelSettings } from "../ai/modelSettings";
import { chooseWorkspaceDirectory, supportsProjectFolders, workspaceDisplayName } from "../storage/projectDirectory";

export function ModelSettingsModal({ onClose, onWorkspaceChanged }: { onClose: () => void; onWorkspaceChanged?: () => void }) {
  const [settings, setSettings] = useState<ModelSettings>(loadModelSettings);
  const [apiKey, setApiKey] = useState(loadApiKey);
  const [status, setStatus] = useState("");
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState("读取中…");

  useEffect(() => { void workspaceDisplayName().then(setWorkspace).catch(() => setWorkspace("未设置")); }, []);

  async function chooseWorkspace() {
    try {
      const directory = await chooseWorkspaceDirectory();
      setWorkspace(directory.name + "/projects");
      setStatus("系统数据目录已设置，之后新项目会自动保存到该目录");
      onWorkspaceChanged?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "系统数据目录设置失败");
    }
  }

  function validate() {
    if (!settings.baseUrl.trim()) return "请填写接口地址";
    if (!settings.model.trim()) return "请填写准确的模型 ID，不能只填写展示名称";
    if (!apiKey.trim()) return "请填写 API Key";
    return "";
  }

  function endpoint(path: string) {
    return modelEndpoint(settings.baseUrl, path);
  }

  async function readError(response: Response) {
    try {
      const data = await response.json();
      return data?.error?.message ?? data?.message ?? "HTTP " + response.status;
    } catch {
      return "HTTP " + response.status;
    }
  }

  async function loadModels() {
    if (!settings.baseUrl.trim() || !apiKey.trim()) {
      setStatus("请先填写接口地址和 API Key");
      return;
    }
    setStatus("正在读取服务支持的模型…");
    try {
      const response = await fetch(endpoint("/models"), { headers: { Authorization: "Bearer " + apiKey } });
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      const ids = Array.isArray(data?.data) ? data.data.map((item: { id?: string }) => item.id).filter(Boolean) : [];
      setModelOptions(ids);
      setStatus(ids.length > 0 ? "已读取 " + ids.length + " 个模型，请选择准确的模型 ID" : "服务可访问，但没有返回模型列表");
    } catch (error) {
      setStatus("模型列表读取失败：" + (error instanceof Error ? error.message : "未知错误"));
    }
  }

  async function testConnection() {
    const validationError = validate();
    if (validationError) {
      setStatus(validationError);
      return;
    }
    setStatus("正在测试连接…");
    try {
      const response = await fetch(endpoint("/chat/completions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
        body: JSON.stringify({
          model: settings.model.trim(),
          temperature: 0,
          max_tokens: 8,
          messages: [{ role: "user", content: "只回复 OK" }],
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      if (!data?.choices?.[0]?.message?.content) throw new Error("接口返回成功，但响应格式不是 OpenAI Chat Completions 格式");
      const normalizedSettings = { ...settings, model: settings.model.trim(), baseUrl: normalizeModelBaseUrl(settings.baseUrl) };
      saveModelSettings(normalizedSettings, apiKey);
      setSettings(normalizedSettings);
      setStatus("真实生成测试成功，配置已自动保存");
    } catch (error) {
      setStatus("真实生成测试失败：" + (error instanceof Error ? error.message : "未知错误"));
    }
  }

  function save() {
    const validationError = validate();
    if (validationError) {
      setStatus(validationError);
      return;
    }
    const normalizedSettings = { ...settings, baseUrl: normalizeModelBaseUrl(settings.baseUrl) };
    saveModelSettings(normalizedSettings, apiKey);
    setSettings(normalizedSettings);
    setStatus("配置已保存。本浏览器会话结束后需要重新填写 API Key。 ");
  }

  return (
    <div className="modal-backdrop">
      <section className="modal settings-modal">
        <div className="modal-header"><div><p className="eyebrow">OpenAI 兼容接口</p><h2>模型配置</h2></div><button onClick={onClose}>×</button></div>
        <label>接口地址<input value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} placeholder="https://api.openai.com/v1" /></label>
        <label>模型名称<div className="model-field-row"><input list="available-models" value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} placeholder="请输入准确的模型 ID，例如服务商 /models 返回的 id" /><button className="secondary-button" onClick={loadModels}>加载模型</button></div><datalist id="available-models">{modelOptions.map((model) => <option value={model} key={model} />)}</datalist></label>
        <label>API Key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="仅保存在当前会话，桌面版将使用 Windows 安全存储" /></label>
        <label>温度：{settings.temperature.toFixed(1)}<input type="range" min="0" max="1" step="0.1" value={settings.temperature} onChange={(event) => setSettings({ ...settings, temperature: Number(event.target.value) })} /></label>
        <p className="endpoint-preview">生成测试地址：{endpoint("/chat/completions")}</p>
        <div className="workspace-setting"><div><strong>系统数据目录</strong><small>{supportsProjectFolders() ? workspace : "当前浏览器不支持本地文件夹访问"}</small></div><button className="secondary-button" onClick={chooseWorkspace} disabled={!supportsProjectFolders()}>选择目录</button></div>
        {status && <p className={status.includes("失败") || status.includes("请填写") ? "settings-status error" : "settings-status"}>{status}</p>}
        <div className="action-row"><button className="secondary-button" onClick={testConnection}>测试连接</button><button className="primary-button" onClick={save}>保存配置</button></div>
      </section>
    </div>
  );
}
