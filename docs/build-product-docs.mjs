import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const dir = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const text = (x, y, label, size = 20, fill = '#17304d', weight = 400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${esc(label)}</text>`;
const box = (x, y, w, h, title, lines = [], accent = false) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${accent ? '#e9f0ff' : '#ffffff'}" stroke="#c6d3e4"/>${text(x + 18, y + 34, title, 21, '#17304d', 650)}${lines.map((line, i) => text(x + 18, y + 66 + i * 27, line, 17, '#52627a')).join('')}`;
const arrow = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#617a9d" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/>`;
function svg(name, width, height, title, body) {
  fs.writeFileSync(path.join(dir, 'assets', name), `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><title>${title}</title><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="#617a9d"/></marker></defs><rect width="100%" height="100%" fill="#f5f8fc"/><g font-family="Microsoft YaHei, PingFang SC, sans-serif">${body}</g></svg>`);
}

const skills = [
 ['01 五视角研究', '建立不同立场', '提出研究问题'], ['02 矛盾图谱', '梳理冲突与共识', '发现知识盲区'],
 ['03 综合简报', '提炼关键发现', '形成行动建议'], ['04 同行评审', '检查遗漏与偏差', '提出补充方向'],
 ['05 资源筛选', '安排资源顺序', '估计时间投入'], ['06 学习阶梯', '拆分五级能力', '明确晋级里程碑'],
 ['07 二八学习计划', '聚焦核心知识', '安排练习和项目'], ['08 自适应考试', '生成自测材料', '提出复习建议'],
];
let flow = text(30, 45, '从一个主题到一条学习路径', 28, '#17304d', 700) + text(30, 79, '填写目标与基础 → 逐步生成 → 阅读确认 → 交给下一阶段', 19);
skills.forEach((s, i) => {
  const x = 30 + i % 4 * 273, y = 110 + Math.floor(i / 4) * 200;
  flow += box(x, y, 240, 133, s[0], s.slice(1), true);
  if (i % 4 < 3) flow += arrow(x + 242, y + 64, x + 266, y + 64);
});
flow += `<path d="M969 245 L969 277 L150 277 L150 303" stroke="#617a9d" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/>`;
flow += text(30, 491, '每关都由用户确认后继续；第八关当前为文本生成，不是动态交互考试。', 18, '#52627a');
svg('learning-workflow.svg', 1120, 525, '八阶段学习流程示意', flow);

let phone = text(30, 45, '手机单关工作台', 28, '#17304d', 700) + text(30, 79, '结构示意 · 非产品截图', 18, '#52627a');
phone += `<rect x="32" y="110" width="374" height="570" rx="26" fill="#10182b" stroke="#556783" stroke-width="2"/>`;
phone += text(55, 151, 'React 性能优化  ▾', 21, '#eaf0ff', 650) + text(355, 151, '⚙', 25, '#c3d2ec');
phone += `<path d="M45 175 H393" stroke="#3d4f6c"/>` + text(55, 210, '第 1 / 8 关', 17, '#a4b5d0') + text(55, 246, '五视角研究', 24, '#eaf0ff', 650);
['任务', '成果', '反思'].forEach((s, i) => { phone += `<rect x="${55 + i * 111}" y="269" width="102" height="43" rx="9" fill="${i === 1 ? '#465b9d' : '#22314d'}"/>` + text(86 + i * 111, 298, s, 18, '#eaf0ff'); });
phone += `<rect x="55" y="335" width="326" height="220" rx="10" fill="#17233b"/>` + text(74, 372, '本关成果', 20, '#eaf0ff', 650);
phone += text(74, 408, '标题 · 表格 · 流程图', 18, '#b2c4df') + text(74, 449, '正文区域可以上下滚动', 17, '#b2c4df') + text(74, 489, '宽表格在内部左右滑动', 17, '#b2c4df');
phone += `<rect x="45" y="579" width="348" height="85" rx="12" fill="#22314d"/>` + text(60, 602, '已配置模型 · 本地自动保存', 14, '#b2c4df');
phone += `<rect x="59" y="615" width="64" height="36" rx="6" fill="#354767"/><rect x="134" y="615" width="244" height="36" rx="6" fill="#5969c7"/>` + text(70, 640, '关卡', 17, '#fff') + text(176, 640, '确认并进入下一关', 17, '#fff');
phone += box(454, 110, 368, 122, '顶部项目与配置', ['切换学习项目', '配置图标打开右侧抽屉'], true);
phone += box(454, 256, 368, 214, '抽屉内的常用入口', ['资料库 · 导出 · 导入', '模型设置 · AI 学习导师', '创建项目 · 删除项目', '目录访问取决于浏览器支持']);
phone += box(454, 494, 368, 168, '操作始终可达', ['任务、成果、反思分开阅读', '全部关卡按需展开', '底部固定生成与确认操作'], true);
svg('mobile-workspace.svg', 850, 710, '手机工作台与配置抽屉结构示意', phone);

let transfer = text(30, 44, '一个项目在电脑与手机间继续', 28, '#17304d', 700) + text(30, 78, '手动 JSON 迁移 · 保留项目 ID · 回导整份覆盖', 19, '#52627a');
transfer += box(30, 110, 300, 122, '手机创建或导入项目', ['继续阅读、生成和确认', '导出最新 JSON'], true);
transfer += arrow(335, 172, 402, 172);
transfer += box(410, 110, 300, 122, '电脑导入 JSON', ['先保存到浏览器', '检查系统数据目录与权限'], true);
transfer += arrow(716, 172, 782, 172);
transfer += box(790, 110, 300, 122, '按完整项目 ID 匹配', ['只查当前总目录的 projects/', '匹配 project.json 内的 ID'], true);
transfer += arrow(940, 237, 940, 300);
transfer += box(790, 310, 300, 148, '目录保存结果', ['有相同 ID → 更新原目录', '没有相同 ID → 创建目录', '无权限或未配置 → 浏览器保存']);
transfer += box(410, 310, 300, 148, '电脑继续学习后再导出', ['导出 JSON 传回手机', '手机导入，接着学习', '模型 API Key 需单独配置']);
transfer += arrow(785, 382, 718, 382);
transfer += `<path d="M405 382 L180 382 L180 239" stroke="#617a9d" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/>`;
transfer += text(30, 520, '不是云同步，不自动合并两端内容；导入前确认使用的是最新备份。', 19, '#52627a');
svg('device-transfer.svg', 1120, 552, 'PC与手机项目备份往返流程示意', transfer);

const css = `*{box-sizing:border-box}body{margin:0;background:#f1f4f8;color:#24364b;font:16px/1.85 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1040px;margin:36px auto;padding:50px 64px;background:#fff}h1{font-size:34px;line-height:1.4;color:#112b46;margin:0 0 20px}h2{font-size:24px;margin:42px 0 16px;color:#173d64;border-bottom:1px solid #dbe3ed;padding-bottom:10px}h3{font-size:19px;margin:26px 0 10px}p{margin:12px 0}a{color:#245fa4;text-underline-offset:3px}img{display:block;max-width:100%;height:auto;margin:24px auto}table{border-collapse:collapse;width:100%;font-size:14px;margin:20px 0}th,td{border:1px solid #d1dae5;padding:12px 14px;text-align:left;vertical-align:top}th{background:#e9f0f8;color:#183d63}tbody tr:nth-child(even){background:#f8fafc}.table-wrap{overflow-x:auto}code{font-size:.9em;background:#eef2f7;padding:2px 5px;border-radius:4px}li{margin:7px 0}footer{margin-top:40px;border-top:1px solid #dbe3ed;padding-top:16px;font-size:13px;color:#62748a}@media(max-width:700px){main{margin:0;padding:24px 18px}h1{font-size:27px}th,td{min-width:105px;padding:9px}body{font-size:15px}}@media print{body{background:#fff;font-size:11pt}main{margin:0;padding:0;max-width:none}h1{font-size:24pt}h2{font-size:17pt;break-after:avoid}h3{break-after:avoid}img{max-height:155mm;break-inside:avoid}tr{break-inside:avoid}thead{display:table-header-group}a{color:inherit}footer{font-size:9pt}@page{size:A4;margin:18mm}}`;
for (const name of ['PRD_V3.3', 'USER_GUIDE']) {
  const source = fs.readFileSync(path.join(dir, `${name}.md`), 'utf8');
  const title = source.split('\n')[0].replace(/^# /, '');
  const markup = renderToStaticMarkup(React.createElement(Markdown, { remarkPlugins: [remarkGfm], components: { table: ({ children }) => React.createElement('div', { className: 'table-wrap' }, React.createElement('table', {}, children)) } }, source));
  fs.writeFileSync(path.join(dir, `${name}.html`), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style></head><body><main>${markup}<footer>Knowledge Quest · V3.3 · 2026年11月3日</footer></main></body></html>`);
}
console.log('Generated two standalone HTML documents and three SVG illustrations.');
