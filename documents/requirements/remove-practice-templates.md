# Requirement: Remove Practice Templates

## Background
- 当前练习配置页支持保存、重命名、删除、应用练习模板，数据保存在浏览器 `localStorage`。
- 目标是彻底下线模板功能，并清理所有残留代码与本地缓存。

## Goals
- 删除模板相关 UI、hooks、storage 模块、翻译、测试与文档引用。
- 页面加载时清空旧模板存储键，避免遗留数据。
- 确保核心练习流程在无模板功能时依然完整可用。

## Scope
1. **前端实现**
   - 移除 `PracticeConfiguration` 中模板卡片、按钮与状态。
   - 删除 `use-practice-templates` hook、`lib/template-storage.ts` 及相关类型。
   - 清理模板相关的 `BilingualText` key、常量、测试。
2. **本地数据清理**
   - 在应用初始化时（例如 App 入口或特定 hook）调用 `localStorage.removeItem('english-listening-templates')`。
   - 需处理浏览器没有 `localStorage` 的容错。
3. **验证与回归**
   - 确保练习配置页、生成练习流程（话题、音频、题目）在无模板逻辑下正常。
   - 更新文档/提醒避免提到模板功能。

## Non-Goals
- 不保留模板数据备份，也不迁移至后端。
- 不新增替代特性。

## Acceptance Criteria
- UI 中不再出现任何模板入口。
- 本地 `localStorage` 无模板键值。
- 构建、测试通过，无未使用代码或翻译键。

## Sequencing
- 前置：`Topic Refresh Button`、`Update Key Copy and Tagline` 已完成，确保共享组件中的新文案稳定。
- 此任务完成后，为移除快捷键/专项模式提供更简化的状态管理环境。
