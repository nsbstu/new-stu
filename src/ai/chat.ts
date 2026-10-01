import { isModelConfigured, loadApiKey, loadModelSettings, modelEndpoint } from "./modelSettings";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function sendChat(messages: ChatMessage[], projectContext: string) {
  if (!isModelConfigured()) {
    throw new Error("请先在“模型配置”中填写接口地址、模型名称和 API Key。 ");
  }
  const settings = loadModelSettings();
  const response = await fetch(modelEndpoint(settings.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + loadApiKey() },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      messages: [
        { role: "system", content: "你是 Knowledge Quest 的学习导师。结合项目上下文回答问题，并指出当前问题与八步学习工作流的关系。项目上下文：" + projectContext },
        ...messages,
      ],
    }),
  });
  if (!response.ok) throw new Error("模型请求失败：HTTP " + response.status);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("模型未返回有效内容");
  return String(content);
}
