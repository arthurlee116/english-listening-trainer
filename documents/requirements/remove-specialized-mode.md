# Requirement: Remove Specialized Practice Mode

## Background
- 专项练习模式包含专属 UI、推荐逻辑、统计分析以及相关成就。
- 用户反馈希望简化体验，现计划全面下线该模式。

## Goals
- 移除专项练习所有前端/后端逻辑，并隐藏历史中的相关字段。
- 删除专项练习相关成就与触发点，但保留 Focus Area 类型供其他功能使用。
- 确保常规练习与统计功能仍健壮。

## Scope
1. **前端 UI 与状态**
   - 删除配置页、练习流程中与专项模式相关的控件、状态、hooks。
   - 清理推荐列表、覆盖率提示、Preset 保存等逻辑。
   - 更新历史、结果展示，隐藏专项模式字段/徽章。
2. **成就系统**
   - 删除专项练习相关成就定义、通知、触发代码及翻译。
   - 确认剩余成就仍能正常运行。
3. **数据结构**
   - 若存储层有专项模式标记（practice session 数据），保留字段但前端隐藏。
   - 视情况评估是否需要数据迁移，若仅前端使用可无操作。
4. **测试与文案**
   - 删除专项练习相关测试或更新期望。
   - 清理翻译文件中对应键值。

## Non-Goals
- 不精简 Focus Area 类型。
- 不改动 AI 生成接口用于生成专项内容的能力（若无引用即可保留）。

## Acceptance Criteria
- UI 无专项模式入口或提示，历史列表不显示对应标签。
- 成就系统无专项相关条目，运行无报错。
- Lint/测试通过，未出现未使用引用。

## Sequencing
- 前置：`Topic Refresh Button`、`Update Key Copy and Tagline`、`Remove Practice Templates`、`Remove Keyboard Shortcuts` 均已完成，确保练习配置页结构更简洁。
- 此任务完成后，为语言偏好切换与侧边栏改造提供更纯粹的练习流程。
