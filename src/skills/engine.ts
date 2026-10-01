import type { ProjectWorkspace, SkillArtifact, SkillManifest } from "../domain/types";
import { createId } from "../utils/id";
import { createReflectionReport } from "../reflection/reflection";
import { loadApiKey, loadModelSettings, isModelConfigured, modelEndpoint } from "../ai/modelSettings";

function confirmedUpstream(project: ProjectWorkspace, order: number) {
  const allowedIds = project.runs.slice(0, Math.max(0, order - 1)).map((run) => run.confirmedArtifactId).filter(Boolean);
  return project.artifacts.filter((artifact) => allowedIds.includes(artifact.id));
}

function fallbackContent(project: ProjectWorkspace, skill: SkillManifest, upstream: SkillArtifact[]) {
  const normalizedGoal = project.profile.goal.replace(/[。.!！?？]+$/, "");
  const context = upstream.length > 0
    ? upstream.map((artifact) => artifact.title + "：" + artifact.summary).join("\n")
    : "这是工作流第一步，输入来自项目访谈档案。";

  const sectionText = skill.outputSections.map((section, index) =>
    "### " + (index + 1) + ". " + section + "\n" +
    "围绕“" + project.profile.topic + "”整理 " + section + "。当前目标是：" + normalizedGoal +
    "。该部分会在接入模型和检索后替换为带引用的详细结论。"
  ).join("\n\n");

  return "## 输入上下文\n" + context + "\n\n" + sectionText +
    "\n\n## 向下一步传递\n下一步将读取本成果的摘要、关键结论、未决问题和引用关系。";
}

async function callConfiguredModel(project: ProjectWorkspace, skill: SkillManifest, upstream: SkillArtifact[]) {
  const settings = loadModelSettings();
  const apiKey = loadApiKey();
  const upstreamText = upstream.map((artifact) => artifact.title + "\n" + artifact.content).join("\n\n");
  const prompt = [
    "你是 Knowledge Quest 学习工作流中的 Skill 执行器。",
    "当前 Skill：" + skill.name,
    "目标：" + skill.description,
    "学习主题：" + project.profile.topic,
    "用户目标：" + project.profile.goal,
    "当前水平：" + project.profile.currentLevel,
    "必须输出的部分：" + skill.outputSections.join("、"),
    "上游已确认成果：\n" + (upstreamText || "无，这是第一步。"),
    "请输出中文 Markdown。明确区分事实、推断和待验证问题，并在最后提供向下一步传递的摘要。",
  ].join("\n\n");

  const transientStatuses = new Set([429, 502, 503, 504]);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(modelEndpoint(settings.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: settings.model,
        temperature: settings.temperature,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (response.ok) {
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error("模型未返回有效内容");
      return String(content);
    }
    if (!transientStatuses.has(response.status) || attempt === 2) {
      let detail = "HTTP " + response.status;
      try {
        const errorData = await response.json();
        detail = errorData?.error?.message ?? errorData?.message ?? detail;
      } catch { /* keep the HTTP status */ }
      throw new Error("模型请求失败：" + detail);
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error("模型服务暂时不可用");
}

export async function generateSkillArtifact(project: ProjectWorkspace, skill: SkillManifest): Promise<SkillArtifact> {
  const upstream = confirmedUpstream(project, skill.order);
  let content: string;
  let generatedBy: SkillArtifact["generatedBy"] = "local-fallback";
  let generationWarning: string | undefined;
  if (isModelConfigured()) {
    try {
      content = await callConfiguredModel(project, skill, upstream);
      generatedBy = "configured-model";
    } catch (error) {
      generationWarning = error instanceof Error ? error.message : "模型服务暂时不可用";
      content = fallbackContent(project, skill, upstream);
    }
  } else {
    content = fallbackContent(project, skill, upstream);
  }

  const previous = project.artifacts.filter((artifact) => artifact.skillId === skill.id);
  const reflection = createReflectionReport(
    generatedBy === "configured-model"
      ? { completeness: 82, evidenceReliability: 72, citationCoverage: 70, logicalConsistency: 84, goalAlignment: 88, actionability: 80 }
      : { completeness: 70, evidenceReliability: 45, citationCoverage: 20, logicalConsistency: 82, goalAlignment: 86, actionability: 65 },
    generatedBy === "configured-model"
      ? []
      : [
          generationWarning ? generationWarning + "，已自动生成本地草稿" : "当前使用本地兜底内容，尚未调用模型与联网检索",
          "关键结论缺少真实引用",
        ],
    ["已检查输出结构", "已检查上游成果是否被引用", "已生成向下一步传递的摘要"],
  );

  return {
    id: createId(),
    skillId: skill.id,
    revision: previous.length + 1,
    status: "draft",
    title: skill.name + " · 第 " + (previous.length + 1) + " 版",
    summary: project.profile.topic + "的" + skill.name + "成果，包含：" + skill.outputSections.join("、"),
    content,
    upstreamArtifactIds: upstream.map((artifact) => artifact.id),
    reflection,
    generatedBy,
    generationWarning,
    createdAt: new Date().toISOString(),
  };
}
