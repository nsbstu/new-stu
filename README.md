# Knowledge Quest

Knowledge Quest 是一个 Windows 本地优先的 AI 学习工作流应用。它将行业或技术学习拆分为八个可组合 Skill，并要求每一步执行生成、反思、修订和用户确认。

## 当前进度

- 已完成 PRD。
- 已建立 React + TypeScript 前端骨架。
- 已定义八个 Skill manifest。
- 已实现工作流状态和基础 stale 传播。
- 已实现反思评分阈值。
- 已实现本地项目原型存储和游戏化学习地图。
- 已实现项目文件夹持久化迭代：创建项目时可选择文件夹，成果变化后自动写入 `project.json`、`artifacts.json` 和 `events.jsonl`，并支持重启后通过“打开项目文件夹”恢复。
- 浏览器版本同时保留 localStorage 缓存；API Key 不写入项目文件夹。后续 Tauri 版本将补充原子写入、SQLite 和 Windows 安全存储。
- 已支持系统总目录：在“模型与设置”中选择一次总目录后，系统会自动维护 `projects/` 子目录，启动时扫描并恢复历史项目。

## 本地运行

1. 安装依赖：pnpm install
2. 启动开发环境：pnpm dev
3. 运行测试：pnpm test
4. 构建：pnpm build

桌面封装计划使用 Tauri。当前开发环境缺少 Rust 工具链，前端和领域内核可先独立开发和验证。

完整需求见 docs/PRD.md。

## 项目文件夹使用

先在“模型与设置”中选择“系统数据目录”。点击“创建学习项目”后，应用会在总目录的 `projects/` 下自动创建项目子目录，再进入 AI 对话访谈。应用重启时会自动扫描并显示历史项目。也可以通过侧栏“打开已有项目”恢复任意中途项目或已完成项目；如果暂时未设置总目录，应用仍会使用浏览器本地缓存。

当前文件夹能力需要 Chrome 或 Edge 的 File System Access API。API Key 只保存在当前会话，不会写入项目文件夹。
