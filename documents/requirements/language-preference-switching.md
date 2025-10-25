# Requirement: Language Preference Switching

## Background
- 当前页面通过 `BilingualText` 默认展示中英双语。
- 目标是默认中文，只显示当前语言内容，同时支持通过右上角地球图标在中英之间切换。
- 用户语言偏好需要持久化到数据库，并在登录后自动应用。

## Goals
- 在 `users` 表保存语言偏好（默认值：中文）。
- 切换语言时不刷新整页，可即时更新所有双语文案。
- 切换控件为纯地球图标，不显示文字或 tooltip。
- 复用现有 i18n 基础设施，无需引入新翻译框架。

## Scope
1. **数据库 & API**
   - 为 `users` 表新增 `preferredLanguage`（建议 enum `'zh' | 'en'`，默认 `'zh'`）。
   - 提供读取/更新语言偏好的 API（可复用现有用户设置端点，或新增 `/api/user/preferences`）。
   - 登录成功后返回语言偏好；客户端拿到后更新 i18n。
2. **前端状态管理**
   - `use-auth-state` 或相关 hook 在用户信息变更时应用 `preferredLanguage`。
   - 若无偏好字段，默认 `'zh'` 并写入数据库。
   - 原 `BilingualText` / `useBilingualText` 调整为根据当前语言只渲染一个语种文本。
3. **UI 实现**
   - 右上角新增地球按钮，点击后在 `'zh'` 与 `'en'` 之间切换。
   - 切换时直接更新上下文并触发数据库更新（需处理失败重试或回滚）。
   - 保证切换时 toast、按钮、表单 placeholder、导航等同步切换。
4. **性能与回退**
   - 切换采用客户端无刷新流程；若 API 更新失败，回滚到原语言并提示。
   - 对未登录用户，可使用 `localStorage` 暂存偏好（可选），登录后写入数据库。

## Non-Goals
- 不新增其他语言或自动检测逻辑。
- 不调整 AI 接口返回内容的语言（目前假定保持原状）。

## Acceptance Criteria
- 登录用户刷新页面后仍保持上次选择语言。
- 切换语言后 UI 所有双语文案仅显示对应语种，无残留混合文本。
- 地球图标按钮可在桌面与移动端使用，无额外文字/tooltip。
- 对新增字段进行数据库迁移并通过 Prisma/ORM 校验。

## Dependencies
- Prisma schema 更新及迁移文件。
- 用户信息读取/更新 API。
- i18n 组件和 hooks 变更。

## Sequencing
- 前置：`Topic Refresh Button`、`Update Key Copy and Tagline`、`Remove Practice Templates`、`Remove Keyboard Shortcuts`、`Remove Specialized Practice Mode` 已完成，确保 UI 元素和状态逻辑已精简。
- 该任务完成后可为左侧导航改造提供稳定的多语言渲染基础。
