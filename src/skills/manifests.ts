import type { SkillManifest } from "../domain/types";

const commonQuality = ["完整性", "证据可靠性", "逻辑一致性", "目标匹配度"];

export const skillManifests: SkillManifest[] = [
  {
    id: "perspective-storm", order: 1, name: "五视角研究", shortName: "多维侦察",
    description: "从实践者、学者、怀疑者、经济学家和历史学家视角建立全景。",
    color: "#5b8cff", icon: "◈",
    requiredInputs: ["项目档案", "用户资料", "联网检索结果"],
    outputSections: ["角色立场", "最强证据", "独有问题", "初步共识与冲突"],
    qualityDimensions: [...commonQuality, "视角差异度"],
  },
  {
    id: "contradiction-map", order: 2, name: "矛盾图谱", shortName: "冲突解码",
    description: "识别观点冲突、证据强弱、共识和知识盲区。",
    color: "#7c5cff", icon: "⌘",
    requiredInputs: ["五视角研究成果"],
    outputSections: ["冲突关系", "共识", "盲区", "关键问题"],
    qualityDimensions: [...commonQuality, "冲突覆盖率"],
  },
  {
    id: "research-brief", order: 3, name: "综合简报", shortName: "情报汇总",
    description: "将多视角和矛盾分析压缩为可行动的研究简报。",
    color: "#ab63fa", icon: "▤",
    requiredInputs: ["五视角研究成果", "矛盾图谱"],
    outputSections: ["主题总览", "关键发现", "隐含关联", "行动建议"],
    qualityDimensions: [...commonQuality, "信息压缩质量"],
  },
  {
    id: "peer-review", order: 4, name: "同行评审", shortName: "质量审判",
    description: "检查简报的可靠性、遗漏、偏差和视角权重。",
    color: "#ec5fa4", icon: "◎",
    requiredInputs: ["综合简报", "引用与证据"],
    outputSections: ["可靠性评分", "遗漏信息", "视角失衡", "补充研究"],
    qualityDimensions: [...commonQuality, "评审严格度"],
  },
  {
    id: "resource-curator", order: 5, name: "资源筛选", shortName: "装备补给",
    description: "搜索或评价资源，形成按价值和时间排序的学习路径。",
    color: "#ff7a61", icon: "◇",
    requiredInputs: ["同行评审", "资源候选集", "用户时间预算"],
    outputSections: ["资源评分", "使用方式", "投入时间", "学习顺序"],
    qualityDimensions: [...commonQuality, "资源时效性", "路径可执行性"],
  },
  {
    id: "learning-ladder", order: 6, name: "学习阶梯", shortName: "能力进阶",
    description: "把主题拆分成五个可观察、可验证的能力等级。",
    color: "#f2a93b", icon: "△",
    requiredInputs: ["资源学习路径", "项目目标"],
    outputSections: ["五级目标", "关键技能", "晋级里程碑", "练习与错误"],
    qualityDimensions: [...commonQuality, "等级递进性", "里程碑可验证性"],
  },
  {
    id: "pareto-study-plan", order: 7, name: "二八学习计划", shortName: "行动路线",
    description: "围绕核心 20% 知识生成课程、练习和最小实践项目。",
    color: "#44c58a", icon: "✦",
    requiredInputs: ["学习阶梯", "资源路径", "用户时间预算"],
    outputSections: ["核心知识", "课程计划", "每日任务", "最终项目"],
    qualityDimensions: [...commonQuality, "优先级合理性", "计划可执行性"],
  },
  {
    id: "adaptive-exam", order: 8, name: "自适应考试", shortName: "终局试炼",
    description: "逐题验证理解，更新掌握度并触发薄弱环节返工。",
    color: "#21b8c7", icon: "⬡",
    requiredInputs: ["学习阶梯", "学习计划", "知识点列表"],
    outputSections: ["逐题反馈", "强弱项", "复习计划", "返工建议"],
    qualityDimensions: [...commonQuality, "难度适应性", "诊断准确度"],
  },
];
