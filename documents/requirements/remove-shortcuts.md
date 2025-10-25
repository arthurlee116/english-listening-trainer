# Requirement: Remove Keyboard Shortcuts

## Background
- 项目包含快捷键系统（hooks、配置、介绍对话框和 localStorage 设置）。
- 目标是彻底下线快捷键功能，不再在 UI 或代码中保留相关逻辑。

## Goals
- 删除快捷键功能所有代码、配置、翻译、localStorage 使用与测试。
- 移除入口按钮及 UI 提示，不再展示快捷键相关内容。
- 清理残余引用，确保构建无警告。

## Scope
1. **代码删除**
   - 移除 `use-hotkeys`, `use-shortcut-settings`, `lib/shortcuts`, `ShortcutHelpDialog`, `ShortcutOnboardingDialog` 等。
   - 删除相关导入、状态、props、事件处理。
   - 清理 localStorage 键（`english-listening-shortcuts-*`）的使用。
2. **UI 与文案**
   - 删除首页“快捷键”按钮及任何提示文本。
   - 移除翻译键（`shortcuts.*` 等）和测试文案。
3. **测试 / 文档**
   - 删除或更新涉及快捷键的单测、集成测。
   - 检查文档中是否提及快捷键，必要时移除。

## Non-Goals
- 不替换为其他输入方式。
- 不保留任何快捷键代码备份或隐藏入口。

## Acceptance Criteria
- 代码中无快捷键相关导入或引用。
- UI 不显示快捷键按钮/文案。
- 构建、lint、测试通过且无 unused 引用。

## Sequencing
- 前置：已完成 `Topic Refresh Button`、`Update Key Copy and Tagline`、`Remove Practice Templates`，避免在同一组件上出现并行改动冲突。
- 后续的专项模式下线、语言切换和侧边栏改造任务默认快捷键已移除。
