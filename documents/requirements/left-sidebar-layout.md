# Requirement: Left Sidebar Layout Redesign

## Background
- 现有首页将主要入口放在顶部标题框内，用户反馈“刚打开不知道要点哪里”。
- 目标是引入可折叠左侧导航栏，提升信息架构清晰度，并缩小标题/宣传语占用空间。

## Goals
- 将原标题区域的操作按钮集中到左侧导航栏，支持折叠/展开。
- 折叠动画参考 Apple 风格的弹性动效，提供顺滑体验。
- 移动端展示同一侧栏，展开时覆盖主内容区域。
- 调整主标题与宣传语尺寸，使页面更紧凑。

## Scope
1. **导航结构**
   - 左侧栏包含：自测英文水平、练习历史、错题本、登录/登出、用户信息、（可选）管理员入口等原按钮。
   - 无需分组或二级菜单；折叠后仅显示图标，展开显示文字。
   - 实现点击折叠/展开（无需 hover），带弹性动画（推荐 CSS transition + keyframes 或 Framer Motion）。
   - **共享导航配置**: 所有导航项统一定义在 `lib/navigation/config.ts` 中，包含类型化的导航项数组、图标映射、过滤辅助函数。相关类型定义在 `lib/types.ts` 中 (`NavigationItem`, `NavigationAction` 等)。
2. **移动端适配**
   - 在较小屏幕显示同一侧栏；展开时覆盖主页面，可通过遮罩点击关闭。
   - 确保触控区域足够大，考虑设备安全区。
3. **标题与宣传语**
   - 缩小字号/行距，保持与新导航并存时的布局美观。
   - 新宣传语来自文案更新任务，需根据语言展示对应版本。
4. **无障碍与状态**
   - 折叠按钮需具备可访问性属性（ARIA 标签等）。
   - 保证导航在不同语言下显示文本正确。
5. **联动检查**
   - 移除原顶部按钮位置，避免重复入口。
   - 与快捷键/专项模式下线任务保持兼容（按钮减少时需同步导航项）。

## Non-Goals
- 不新增额外功能入口。
- 不实现路由层级的面包屑或标签管理。

## Acceptance Criteria
- 左侧栏在桌面端固定显示，可点击折叠/展开并具备弹性动画。
- 移动端展开后覆盖内容区，点击遮罩或折叠按钮能关闭。
- 主标题与宣传语在新布局下未溢出，视觉层级清晰。
- 所有按钮在中英文模式下显示正确文本。

## Sequencing
- 前置：`Topic Refresh Button`、`Update Key Copy and Tagline`、`Remove Practice Templates`、`Remove Keyboard Shortcuts`、`Remove Specialized Practice Mode`、`Language Preference Switching` 已交付，确保导航所需入口、文案与语言逻辑稳定。
- 作为本轮改造的收尾任务，可在上述基础上重构布局而不引入回退依赖。

## Current Findings (Audit Phase 1 - 2025-10-26)

### 导航按钮清单

#### 主页导航区域 (`app/page.tsx` 第197-269行)

**主要操作按钮**:
1. **自测英文水平** (Assessment)
   - 文件: `app/page.tsx:216`
   - 图标: `Sparkles`
   - 处理器: `onClick={() => setStep("assessment")}`
   - 翻译键: `buttons.assessment`
   - 依赖: 无

2. **练习历史** (History)
   - 文件: `app/page.tsx:222`
   - 图标: `History`
   - 处理器: `onClick={() => setStep("history")}`
   - 翻译键: `buttons.history`
   - 依赖: 无

3. **错题本** (Wrong Answers Book)
   - 文件: `app/page.tsx:228`
   - 图标: `Book`
   - 处理器: `onClick={() => setStep("wrong-answers")}`
   - 翻译键: `buttons.wrongAnswersBook`
   - 依赖: 无

**辅助功能按钮**:
4. **语言切换器** (Language Switcher)
   - 文件: `app/page.tsx:237`
   - 组件: `<LanguageSwitcher />`
   - 图标: 地球图标（组件内部）
   - 处理器: 组件内部处理
   - 翻译键: `components.languageSwitcher.*`
   - 依赖: `components/ui/language-switcher.tsx`

5. **管理员入口** (Admin)
   - 文件: `app/page.tsx:239`
   - 图标: `Settings`
   - 处理器: `onClick={() => window.open('/admin', '_blank')}`
   - 翻译键: `buttons.admin`
   - 依赖: `user?.isAdmin` (仅管理员可见)

6. **登出** (Logout)
   - 文件: `app/page.tsx:248`
   - 图标: `LogOut`
   - 处理器: `onClick={handleLogout}`
   - 翻译键: `buttons.logout`
   - 依赖: `handleLogout` from `useAuthState()`

**状态显示**:
7. **用户信息 Badge**
   - 文件: `app/page.tsx:199-209`
   - 图标: `User`
   - 内容: 显示用户名/邮箱 + "Admin" 标签（如适用）
   - 依赖: `isAuthenticated && user`

8. **个性化难度 Badge**
   - 文件: `app/page.tsx:211-219`
   - 内容: 显示难度范围
   - 依赖: `assessmentResult`

#### 子页面返回按钮

9. **历史记录返回**
   - 文件: `components/history-panel.tsx:148`
   - 图标: `ArrowLeft`
   - 处理器: `onBack` prop → `setStep("setup")`
   - 翻译键: 无（仅图标）

10. **错题本返回**
    - 文件: 通过 `onBack` prop 传递
    - 处理器: `setStep("setup")`

11. **评估界面返回**
    - 文件: `app/page.tsx:750`
    - 处理器: `onBack={() => setStep("setup")}`

### 页面状态流转 (step state)

当前支持的页面状态：
- `setup` - 初始配置页面（主页）
- `listening` - 听力练习页面
- `questions` - 答题页面
- `results` - 结果显示页面
- `history` - 历史记录页面
- `wrong-answers` - 错题本页面
- `assessment` - 评估测试页面
- `assessment-result` - 评估结果页面

### 翻译键覆盖分析

#### 已覆盖的翻译键（`lib/i18n/translations/common.json`）:
- ✅ `buttons.assessment` - "自测英文水平" / "Test My Level"
- ✅ `buttons.history` - "练习历史" / "Practice History"
- ✅ `buttons.wrongAnswersBook` - "错题本" / "Wrong Answers Book"
- ✅ `buttons.admin` - "管理" / "Admin"
- ✅ `buttons.logout` - "退出" / "Logout"
- ✅ `labels.userMenu` - "用户菜单" / "User Menu"
- ✅ `labels.navigation` - "导航" / "Navigation"
- ✅ `labels.mainNavigation` - "主导航" / "Main Navigation"

#### 需要新增的翻译键（侧边栏特定）:
- ❌ `sidebar.toggleCollapse` - "折叠/展开侧边栏"
- ❌ `sidebar.closeOverlay` - "关闭侧边栏遮罩"
- ❌ `sidebar.ariaLabel` - "主导航侧边栏"
- ❌ `sidebar.collapseButton` - "折叠按钮"
- ❌ `sidebar.expandButton` - "展开按钮"

### 依赖关系图

#### 状态依赖
```
navigation buttons
  ├─ isAuthenticated (from useAuthState)
  │   └─ 控制用户相关功能显示
  ├─ user.isAdmin (from useAuthState)
  │   └─ 控制管理员入口显示
  ├─ step (local state)
  │   └─ 控制当前显示的页面
  └─ assessmentResult (local state)
      └─ 控制个性化难度显示
```

#### 处理器依赖
```
handlers
  ├─ handleLogout (from useAuthState)
  ├─ setStep (local setState)
  └─ window.open (原生 API)
```

#### Hooks 依赖
```
hooks
  ├─ useAuthState() → { user, isAuthenticated, handleLogout }
  └─ useBilingualText() → { t }
```

#### 图标依赖 (lucide-react)
```
icons
  ├─ Sparkles (自测)
  ├─ History (历史)
  ├─ Book (错题本)
  ├─ User (用户信息)
  ├─ Settings (管理员)
  ├─ LogOut (登出)
  ├─ ArrowLeft (返回)
  ├─ Trash2 (清空历史)
  ├─ RotateCcw (重新开始)
  └─ Download (导出)
```

### 当前布局特征

1. **顶部大型标题面板** (`app/page.tsx:190-270`):
   - 使用 `bg-slate-900/50 backdrop-blur` 磨砂玻璃效果
   - 包含双语标题（英文 + 中文）
   - 所有操作按钮水平排列在标题下方
   - 使用 `flex-wrap` 实现响应式折行
   - 移动端按钮显示简化文本（通过 `sm:hidden` 和 `hidden sm:inline`）

2. **按钮样式**:
   - 统一使用 `Button variant="outline" size="sm"`
   - 背景色: `bg-slate-900/60`
   - 文本色: `text-sky-400`
   - 边框色: `border-slate-700`
   - Hover 效果: `hover:bg-slate-800/80`

3. **响应式策略**:
   - 使用 Tailwind 断点 (`sm:`, `md:`, `lg:`)
   - 移动端隐藏部分文字，仅保留图标 + 简短文本
   - 按钮分组使用独立的 flex 容器

### 改造建议

基于当前发现，侧边栏改造需要：

1. **提取导航项**:
   - 将6个主要操作按钮移至侧边栏
   - 保留用户信息和个性化难度在顶部或侧边栏顶部

2. **新增侧边栏状态**:
   - `isSidebarOpen` (boolean) - 侧边栏展开/折叠状态
   - 移动端默认折叠，桌面端记忆用户偏好

3. **无障碍增强**:
   - 添加 ARIA 标签（`aria-label`, `aria-expanded`, `aria-controls`）
   - 键盘导航支持（Escape 关闭侧边栏）
   - 焦点管理（折叠后焦点回到触发按钮）

4. **动画要求**:
   - 使用 Framer Motion 或 CSS transition 实现弹性动画
   - 参考 Apple 风格的 spring 动效
   - 移动端添加滑入/滑出动画

5. **缩小主标题**:
   - 当前字号: `text-4xl sm:text-5xl md:text-6xl lg:text-7xl`
   - 建议缩小至: `text-3xl sm:text-4xl md:text-5xl`
   - 宣传语也相应缩小

### 技术栈确认

- ✅ React 19 (客户端组件)
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ Radix UI (Button, Badge 等组件)
- ✅ lucide-react (图标库)
- ✅ 已有的国际化系统 (useBilingualText)
- ✅ 已有的认证系统 (useAuthState)

### 备注

- 当前没有使用任何路由库（Next.js App Router 仅用于 API 路由）
- 页面切换完全依赖本地 `step` 状态
- 所有导航按钮的翻译键均已覆盖
- 移动端体验已考虑（按钮文本简化、flex-wrap 布局）
- 无障碍支持较弱，需在侧边栏改造时加强

## Implementation Progress (实施进度)

### Phase 1: Audit & Discovery (审计与发现) - ✅ 完成

**完成时间**: 2025-10-26

**完成内容**:
- ✅ 清点主页所有导航按钮（11个）及其位置、图标、处理器
- ✅ 分析页面状态流转机制（8种 step 状态）
- ✅ 核查翻译键覆盖情况（6个已覆盖 + 5个待新增）
- ✅ 梳理依赖关系图（状态、处理器、Hooks、图标）
- ✅ 记录当前布局特征与响应式策略
- ✅ 提出侧边栏改造建议（5项关键要求）
- ✅ 确认技术栈兼容性（React 19 + TypeScript + Tailwind CSS）

**输出文档**:
- `documents/requirements/left-sidebar-layout.md` (Current Findings 章节)

### Phase 2: Shared Navigation Config & Translation Strings (共享导航配置与翻译字符串) - ✅ 完成

**完成时间**: 2025-10-26

**完成内容**:
- ✅ 创建 `lib/navigation/config.ts` 导航配置文件
  - 定义 `NAVIGATION_ITEMS` 主导航项数组（3个核心功能）
  - 定义 `USER_MENU_ITEMS` 用户菜单项数组（2个账户功能）
  - 定义 `NAVIGATION_SECTIONS` 导航分组结构
  - 提供 `filterNavigationItems()` 过滤辅助函数（支持认证/管理员权限）
  - 提供 `getNavigationItemById()` 查询辅助函数
- ✅ 扩展 `lib/types.ts` 添加 Navigation 类型定义
  - `NavigationActionType` - 动作类型枚举
  - `SetStateAction` - 状态切换动作
  - `CallbackAction` - 回调函数动作
  - `ExternalAction` - 外部链接动作
  - `NavigationAction` - 动作联合类型
  - `NavigationItem` - 导航项接口（包含 id、翻译键、图标、动作、权限标志等）
  - `NavigationSection` - 导航分组接口
- ✅ 扩展 `lib/i18n/translations/components.json` 翻译文件
  - 新增 `navigation.practiceHistory` ("练习历史" / "Practice History")
  - 新增 `navigation.wrongAnswers` ("错题本" / "Wrong Answers Book")
  - 新增 `navigation.assessment` ("自测英文水平" / "Test My Level")
  - 新增 `navigation.admin` ("管理" / "Admin")
  - 新增 `navigation.logout` ("退出" / "Logout")
  - 新增 `navigation.mainSection` ("主要功能" / "Main")
  - 新增 `navigation.userSection` ("账户" / "Account")
  - 新增侧边栏特定翻译键（`toggleSidebar`、`collapseSidebar`、`expandSidebar`、`closeSidebar`、`sidebarAriaLabel`、`overlayAriaLabel`）
- ✅ 更新 `documents/project-board.md` 添加 Phase 分解子任务
- ✅ 更新 `documents/requirements/left-sidebar-layout.md` Scope 章节引用新配置文件

**输出文件**:
- `lib/navigation/config.ts` (新建，166行)
- `lib/types.ts` (新增 59行 Navigation 类型)
- `lib/i18n/translations/components.json` (新增 40行翻译)
- `documents/project-board.md` (更新)
- `documents/requirements/left-sidebar-layout.md` (更新)

**技术要点**:
- 采用严格类型定义，确保编译时类型安全
- 支持多种动作类型（setState、callback、external），覆盖现有所有导航场景
- 翻译键与现有 i18n 体系无缝集成
- 权限控制字段（`requiresAuth`、`adminOnly`）为后续权限过滤提供基础
- 辅助函数提供便捷的过滤和查询能力

### Phase 3: Desktop Sidebar Structure (桌面端侧边栏结构) - ✅ 完成

**完成时间**: 2025-10-26

**完成内容**:
- ✅ 创建 `components/navigation/sidebar.tsx` 侧边栏主组件（198行）
  - 支持 `collapsed` 状态控制（折叠/展开）
  - 集成 `useAuthState` 获取用户认证状态
  - 使用 `useBilingualText` 渲染多语言标签
  - 支持 `desktop` / `mobile` 两种渲染模式
  - 实现权限过滤（通过 `filterNavigationItems` 辅助函数）
  - 显示用户信息和个性化难度（当未折叠时）
  - 提供导航项点击处理（通过 `onNavigate` 回调）
  - 响应式宽度类：折叠时 `w-16`，展开时 `w-64`
  - 完整的 ARIA 无障碍属性（`aria-label`、`aria-current`）
- ✅ 创建 `components/navigation/sidebar-toggle.tsx` 折叠/展开按钮（68行）
  - 圆形按钮，位于侧边栏右侧边缘（`absolute -right-3`）
  - ChevronLeft/ChevronRight 图标切换
  - 完整的 ARIA 属性（`aria-expanded`、`aria-controls`、`aria-pressed`）
  - Screen reader 文本支持（`sr-only`）
- ✅ 创建 `components/navigation/sidebar-context.tsx` 侧边栏状态管理（95行）
  - React Context 提供全局 sidebar 状态
  - `collapsed` 状态持久化到 localStorage (`elt.sidebar.collapsed`)
  - 默认值：false（展开状态）
  - 提供 `toggleCollapsed` 和 `setCollapsed` 方法
  - 自定义 hook `useSidebar()` 访问上下文
- ✅ 创建 `components/app-layout-with-sidebar.tsx` 应用布局包装器（77行）
  - Flex 布局结构：侧边栏 + 主内容区
  - 桌面端显示侧边栏（`hidden md:flex`）
  - 接收 `onNavigate`、`currentStep`、`assessmentResult` props
  - 将导航动作委托给父组件处理
- ✅ 更新 `app/layout.tsx` 添加 `SidebarProvider`
  - 包装所有应用内容以提供 sidebar 上下文
  - 嵌套在 `ThemeProvider` 和 `LanguageProvider` 内部

**输出文件**:
- `components/navigation/sidebar.tsx` (新建，198行)
- `components/navigation/sidebar-toggle.tsx` (新建，68行)
- `components/navigation/sidebar-context.tsx` (新建，95行)
- `components/app-layout-with-sidebar.tsx` (新建，77行)
- `app/layout.tsx` (更新，添加 SidebarProvider)

**技术实现**:
- CSS Transition: `transition-[width] duration-300 ease-out`（Phase 4 将升级为弹性动画）
- Tailwind 响应式断点：`md:` 用于桌面端显示
- 权限过滤：侧边栏内部调用 `filterNavigationItems(items, isAuthenticated, isAdmin)`
- 状态持久化：localStorage 键名 `elt.sidebar.collapsed`

### Desktop Layout Notes (桌面端布局说明)

#### 已实现内容

1. **侧边栏组件完成**:
   - 完整的导航项渲染（支持图标 + 文字）
   - 折叠状态下仅显示图标（`w-16`）
   - 展开状态下显示图标 + 文字（`w-64`）
   - 用户信息和个性化难度显示（顶部区域）
   - 权限控制（管理员入口仅对管理员显示）
   - 活动状态高亮（基于 `currentStep` prop）

2. **状态管理**:
   - React Context 提供全局 sidebar 折叠状态
   - localStorage 持久化用户偏好
   - `useSidebar()` hook 方便组件访问状态

3. **布局结构**:
   - `AppLayoutWithSidebar` 提供 flex 布局容器
   - 侧边栏固定在左侧（桌面端）
   - 主内容区占据剩余空间（`flex-1`）

4. **无障碍支持**:
   - 完整的 ARIA 标签（`aria-label`、`aria-expanded`、`aria-current`）
   - Screen reader 文本（`sr-only`）
   - 语义化 HTML（`<aside>`、`<nav>`）

5. **国际化**:
   - 所有导航标签使用 `useBilingualText()`
   - 翻译键已在 Phase 2 完成

#### 待完成内容（后续 Phase）

1. **Phase 4: 弹性动画（Apple 风格）**:
   - 当前使用基础 CSS transition
   - 需升级为 Framer Motion 或 spring 动画
   - 目标效果：类似 macOS Finder 侧边栏的弹性收缩

2. **Phase 4: 集成到主页面**:
   - 移除 `app/page.tsx` 中的旧导航按钮（第856-909行）
   - 使用 `AppLayoutWithSidebar` 包装主页内容
   - 添加 `handleNavigate` 处理器连接侧边栏动作到页面状态
   - 缩小主标题字号（当前 `text-4xl sm:text-5xl md:text-6xl lg:text-7xl` → 目标 `text-3xl sm:text-4xl md:text-5xl`）

3. **Phase 5: 移动端适配** - ✅ 完成:
   - 完成移动端覆盖式侧边栏的焦点管理与遮罩交互
   - 增加安全区 padding 与 44px 触控区域，避免被刘海/圆角遮挡
   - 优化滑入/滑出动画在移动端的展示（延续 Phase 4 动效）

4. **Phase 5: 无障碍增强** - ✅ 完成:
   - 增加 Escape 键/遮罩关闭的焦点恢复逻辑
   - 引入焦点陷阱，折叠后自动回到触发按钮
   - 为高对比度模式提供专用配色覆盖（`prefers-contrast: more`）

#### 当前文件状态

- `app/page.tsx`: **未修改**（旧导航按钮仍存在，等待 Phase 4 移除）
- `app/layout.tsx`: **已更新**（添加 `SidebarProvider`）
- 新增组件: **4 个文件**（sidebar、toggle、context、layout wrapper）
- 配置文件: **Phase 2 已完成**（config、types、translations）

#### 验证检查清单

- ✅ 组件编译通过（无 TypeScript 错误）
- ✅ 导航配置类型安全
- ✅ 翻译键完整（中英文双语）
- ✅ ARIA 属性完整
- ⏳ 运行时测试（待 Phase 4 集成后验证）
- ⏳ 移动端测试（待 Phase 5 实现）
- ⏳ 无障碍审计（待 Phase 5 完成）

**下一步（Phase 4）**:
- [ ] 实现弹性动画（Framer Motion 或 CSS spring）
- [ ] 集成侧边栏到主页面（移除旧导航按钮）
- [ ] 缩小主标题与宣传语字号
- [ ] 运行时测试与调试

---

### Phase 4: Elastic Animation & Mobile Overlay (弹性动画与移动端遮罩) - ✅ 完成

**完成时间**: 2025-10-26

**完成内容**:
- ✅ 在 `styles/globals.css` 添加 Apple 风格弹性动画 keyframes
  - `sidebar-expand`: 移动端侧边栏滑入动画（带弹性回弹）
  - `sidebar-collapse`: 移动端侧边栏滑出动画
  - `sidebar-width-expand`: 桌面端宽度展开动画（带弹性回弹）
  - `sidebar-width-collapse`: 桌面端宽度收缩动画
  - `overlay-fade-in/out`: 遮罩层淡入淡出动画
  - 使用 `cubic-bezier(0.34, 1.56, 0.64, 1)` 实现弹性效果
- ✅ 创建 `components/navigation/sidebar-overlay.tsx` 移动端遮罩组件（87行）
  - 半透明黑色背景 + 背景模糊效果（`bg-black/60 backdrop-blur-sm`）
  - 点击/触摸遮罩关闭侧边栏
  - Escape 键盘快捷键支持
  - 完整的无障碍属性（role、tabIndex、onKeyDown）
  - 仅在移动端显示（`md:hidden`）
- ✅ 更新 `components/navigation/sidebar-context.tsx` 添加移动端状态管理
  - 新增 `mobileOpen` 状态（boolean）
  - 新增 `toggleMobileOpen` 和 `setMobileOpen` 方法
  - 自动控制 `document.body.style.overflow`（打开时 `hidden`，关闭时恢复）
  - 组件卸载时清理副作用
- ✅ 更新 `components/navigation/sidebar.tsx` 使用弹性动画
  - 根据 `variant` 和 `collapsed` 动态应用动画类
  - 桌面端：`animate-sidebar-width-expand/collapse`
  - 移动端：`animate-sidebar-expand`（滑入效果）
  - 添加 `id="main-sidebar"` 用于 ARIA 关联
- ✅ 更新 `components/navigation/sidebar-toggle.tsx` 支持移动端逻辑
  - 使用 `useEffect` + `window.matchMedia` 检测移动端视口（≤768px）
  - 移动端显示汉堡菜单图标（Menu from lucide-react）
  - 桌面端显示圆形折叠按钮（ChevronLeft/Right）
  - 响应式图标大小（移动端 `h-5 w-5`，桌面端 `h-4 w-4`）
- ✅ 创建 `components/navigation/mobile-sidebar-wrapper.tsx` 移动端侧边栏包装器（84行）
  - 整合汉堡菜单按钮 + 遮罩 + 侧边栏
  - 导航后自动关闭侧边栏（`setMobileOpen(false)`）
  - 固定定位汉堡按钮（`fixed top-4 left-4 z-50`）
  - 仅在 `mobileOpen=true` 时渲染侧边栏（条件渲染）

**输出文件**:
- `styles/globals.css` (新增 104行动画代码)
- `components/navigation/sidebar-overlay.tsx` (新建，87行)
- `components/navigation/mobile-sidebar-wrapper.tsx` (新建，84行)
- `components/navigation/sidebar-context.tsx` (新增 48行)
- `components/navigation/sidebar.tsx` (更新，新增 19行，移除 5行)
- `components/navigation/sidebar-toggle.tsx` (更新，新增 51行，移除 3行)

**技术实现**:
- **弹性动画曲线**: `cubic-bezier(0.34, 1.56, 0.64, 1)` 模拟 Apple 风格弹性回弹
- **动画时长**: 展开 400ms，收缩 350ms（快速收起）
- **关键帧设计**: 0% → 60%（超调）→ 80%（回弹）→ 100%（停止）
- **移动端遮罩**: `z-30`（低于侧边栏 `z-40`，高于内容区）
- **body overflow 控制**: 侧边栏打开时锁定滚动，关闭时恢复
- **视口检测**: `window.matchMedia('(max-width: 768px)')` 匹配 Tailwind `md` 断点

### Animation & Mobile Notes (动画与移动端说明)

#### 弹性动画设计

**设计理念**:
- 参考 Apple macOS Finder 侧边栏的弹性收缩效果
- 使用 CSS Keyframes 替代 Framer Motion（减少依赖，提高性能）
- 动画曲线 `cubic-bezier(0.34, 1.56, 0.64, 1)` 产生轻微超调效果

**桌面端动画**:
1. **展开动画**（`sidebar-width-expand`）:
   - 0%: 宽度 4rem（64px，折叠状态）
   - 60%: 宽度 17rem（272px，**超调 +8px**）
   - 80%: 宽度 15.5rem（248px，**回弹 -8px**）
   - 100%: 宽度 16rem（256px，最终状态）

2. **收缩动画**（`sidebar-width-collapse`）:
   - 0%: 宽度 16rem（256px）
   - 60%: 宽度 3.5rem（56px，**超调 -8px**）
   - 80%: 宽度 4.5rem（72px，**回弹 +8px**）
   - 100%: 宽度 4rem（64px，最终状态）

**移动端动画**:
1. **滑入动画**（`sidebar-expand`）:
   - 0%: `translateX(-100%)`（完全隐藏在左侧）
   - 60%: `translateX(8px)`（**超调进入 +8px**）
   - 80%: `translateX(-2px)`（**回弹 -2px**）
   - 100%: `translateX(0)`（最终位置）

2. **滑出动画**（`sidebar-collapse`）:
   - 0%: `translateX(0)`
   - 60%: `translateX(-8px)`（**超调退出 -8px**）
   - 80%: `translateX(2px)`（**回弹 +2px**）
   - 100%: `translateX(-100%)`（完全隐藏）

**动画触发时机**:
- 桌面端：`collapsed` 状态改变时触发
- 移动端：`mobileOpen=true` 时触发（条件渲染，每次打开都播放滑入动画）

#### 移动端遮罩行为

**交互方式**:
1. **打开侧边栏**:
   - 点击左上角汉堡菜单按钮（固定在 `top-4 left-4`）
   - 触发 `toggleMobileOpen()`
   - 遮罩淡入（200ms）+ 侧边栏滑入（400ms）
   - `document.body.style.overflow = 'hidden'` 锁定页面滚动

2. **关闭侧边栏**:
   - 点击遮罩层（`onClick`、`onTouchEnd`）
   - 按下 Escape 键（全局监听）
   - 点击任意导航项（自动关闭）
   - 触发 `setMobileOpen(false)`
   - 遮罩淡出（150ms）+ 侧边栏卸载
   - `document.body.style.overflow = ''` 恢复滚动

**焦点管理**:
- 遮罩层具备 `role="button"` 和 `tabIndex={0}`，支持键盘导航
- Enter 和 Space 键可关闭遮罩（`onKeyDown` 处理）
- Screen reader 提供 "关闭侧边栏" 提示（`sr-only`）

**Z-Index 层级**:
```
z-50: 汉堡菜单按钮、桌面端折叠按钮
z-40: 移动端侧边栏
z-30: 遮罩层
z-0:  主内容区
```

#### 响应式断点策略

**Tailwind 断点**: `md` = 768px

**桌面端（≥768px）**:
- 侧边栏固定显示（`hidden md:flex`）
- 支持折叠/展开（宽度 64px ↔ 256px）
- 圆形折叠按钮位于侧边栏右侧边缘（`-right-3`）
- 无遮罩层
- 状态持久化到 localStorage

**移动端（<768px）**:
- 侧边栏默认隐藏（条件渲染）
- 汉堡菜单按钮固定在左上角
- 打开时侧边栏覆盖整个屏幕（`fixed inset-y-0 left-0`）
- 显示半透明遮罩层
- body 滚动锁定
- 状态不持久化（每次默认关闭）

**视口检测实现**:
```typescript
const [isMobileView, setIsMobileView] = useState(false)

useEffect(() => {
  const checkMobile = () => {
    setIsMobileView(window.matchMedia('(max-width: 768px)').matches)
  }
  
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  return () => {
    window.removeEventListener('resize', checkMobile)
  }
}, [])
```

#### 无障碍增强

**已实现**:
- ✅ Escape 键关闭移动端侧边栏
- ✅ 遮罩层支持键盘操作（Enter/Space）
- ✅ ARIA 属性完整（`aria-label`、`aria-expanded`、`aria-controls`）
- ✅ Screen reader 文本（`sr-only`）
- ✅ 焦点可访问性（`role="button"`、`tabIndex={0}`）

**待增强（Phase 5）**:
- ⏳ 焦点陷阱（侧边栏打开时限制焦点范围）
- ⏳ 焦点恢复（关闭后焦点回到汉堡菜单按钮）
- ⏳ 高对比度模式测试
- ⏳ 触控区域优化（最小 44×44px）
- ⏳ 安全区适配（iPhone notch/Dynamic Island）

#### 性能优化

**CSS 动画优化**:
- 使用 `transform` 和 `width` 属性（GPU 加速）
- 避免使用 `left`、`right` 等布局属性（触发重排）
- `will-change` 隐式启用（通过 `transform` 动画）

**条件渲染策略**:
- 移动端侧边栏仅在 `mobileOpen=true` 时挂载（减少初始 DOM 节点）
- 遮罩层使用 `if (!isOpen) return null` 提前退出

**副作用清理**:
- `useEffect` 清理函数移除事件监听器
- 组件卸载时恢复 `body.style.overflow`

#### 当前文件状态

- `styles/globals.css`: **已更新**（新增 104行动画代码）
- `components/navigation/sidebar-overlay.tsx`: **新建**（87行）
- `components/navigation/mobile-sidebar-wrapper.tsx`: **新建**（84行）
- `components/navigation/sidebar-context.tsx`: **已更新**（新增移动端状态管理）
- `components/navigation/sidebar.tsx`: **已更新**（集成弹性动画）
- `components/navigation/sidebar-toggle.tsx`: **已更新**（响应式按钮）
- `app/page.tsx`: **未修改**（等待 Phase 4 后半段集成）
- `app/layout.tsx`: **未修改**（等待集成 MobileSidebarWrapper）

#### 验证检查清单

- ✅ 弹性动画编译通过（CSS keyframes 语法正确）
- ✅ 移动端组件编译通过（无 TypeScript 错误）
- ✅ 状态管理扩展完成（mobileOpen + body overflow 控制）
- ✅ 响应式逻辑实现（视口检测 + 条件渲染）
- ✅ Phase 5 焦点陷阱、焦点恢复与安全区适配
- ✅ 高对比度模式适配（`prefers-contrast: more`）
- ⏳ 动画/交互实机测试（待 iOS Safari、Android Chrome 终端验证）

---

### Phase 4 后半段: Main Page Integration (主页面集成) - ✅ 完成

**完成时间**: 2025-10-26

**完成内容**:
- ✅ 集成 `MobileSidebarWrapper` 到 `app/page.tsx`
  - 添加导入语句
  - 在 `<AuthenticationGate>` 内最外层渲染移动端侧边栏
  - 传递 `currentStep`、`onNavigate`、`assessmentResult` props
- ✅ 移除旧导航按钮（原第856-909行）
  - 删除用户信息 Badge（User 图标 + 用户名/邮箱 + Admin 标签）
  - 删除个性化难度 Badge
  - 删除三个主要操作按钮（自测英文水平、练习历史、错题本）
  - 删除两个次要操作按钮（管理员入口、登出）
  - 删除所有相关的 flex 容器和间距样式
- ✅ 使用 `AppLayoutWithSidebar` 包装主页内容
  - 在 `<div className="min-h-screen...">` 内部添加 `<AppLayoutWithSidebar>`
  - 传递 `currentStep`、`onNavigate`、`assessmentResult` props
  - 将 `<div className="container mx-auto px-4 py-8">` 作为子元素
- ✅ 实现 `handleNavigate` 处理器
  - 使用 `useCallback` 创建导航处理函数
  - 支持三种动作类型：
    - `setState`: 调用 `setStep(action.targetState)` 切换页面
    - `callback`: 根据 `action.callbackName` 执行对应函数（如 `handleLogout`）
    - `external`: 调用 `window.open(action.href, action.openInNewTab ? '_blank' : '_self')`
  - 添加 `handleLogout` 到依赖数组
- ✅ 缩小主标题字号
  - 英文标题：`text-4xl sm:text-5xl md:text-6xl lg:text-7xl` → `text-3xl sm:text-4xl md:text-5xl`
  - 中文标题：同样缩小到 `text-3xl sm:text-4xl md:text-5xl`
  - 宣传语：`text-base sm:text-lg md:text-xl` → `text-base sm:text-lg`（移除 `md:text-xl`）
- ✅ 保留 `LanguageSwitcher` 在主标题面板
  - 移至主标题面板内部右上角（`flex justify-end`）
  - 方便用户快速切换语言，无需打开侧边栏
- ✅ 清理未使用的导入
  - 移除 `BilingualText`（原导航按钮使用）
  - 移除 `Button`（原导航按钮使用）
  - 移除 `Badge`（原用户信息/难度显示使用）
  - 移除 `Sparkles, History, User, Settings, LogOut, Book` 图标导入
- ✅ 修复 JSX 结构错误
  - 移除多余的 `</div>` 标签
  - 确保 `<AppLayoutWithSidebar>` 正确嵌套在 `<div className="min-h-screen...">` 内
  - 将 `<Toaster />` 移至正确位置（`<AuthenticationGate>` 子元素的外层 `<div>` 内）

**输出文件**:
- `app/page.tsx` (净减少 44 行代码，移除旧按钮 + 集成新布局)

**技术实现**:
- **导航处理器**: 使用 `useCallback` 优化性能，避免不必要的重渲染
- **类型安全**: `action.targetState as typeof step` 确保类型兼容
- **回调映射**: 通过 `callbackName` 字符串映射到实际函数（`handleLogout`）
- **条件渲染**: 移动端和桌面端侧边栏独立渲染，互不干扰

**布局变化**:
```
旧布局:
<AuthenticationGate>
  <div className="min-h-screen...">
    <div className="container...">
      <div className="mb-8...">  {/* 主标题面板 */}
        <h1>...</h1>
        {/* 用户信息 Badge */}
        {/* 导航按钮行1 */}
        {/* 导航按钮行2 */}
      </div>
      <PracticeConfiguration />
      <PracticeWorkspace />
    </div>
    <Toaster />
  </div>
</AuthenticationGate>

新布局:
<AuthenticationGate>
  <MobileSidebarWrapper />  {/* 移动端侧边栏 + 汉堡按钮 */}
  <div className="min-h-screen...">
    <AppLayoutWithSidebar>  {/* 桌面端侧边栏 */}
      <div className="container...">
        <div className="mb-8...">  {/* 主标题面板 - 仅保留标题和语言切换器 */}
          <h1>...</h1>
          <LanguageSwitcher />
        </div>
        <PracticeConfiguration />
        <PracticeWorkspace />
      </div>
    </AppLayoutWithSidebar>
    <Toaster />
  </div>
</AuthenticationGate>
```

**验证检查清单**:
- ✅ ESLint 检查通过（无错误、无警告）
- ✅ 导航处理器类型正确（符合 `NavigationAction` 接口）
- ✅ JSX 结构正确（无多余/缺失的闭合标签）
- ✅ 移除了所有旧导航按钮代码
- ✅ 标题字号正确缩小
- ⏳ 运行时测试（待启动开发服务器验证）
- ⏳ 响应式测试（待测试移动端/桌面端切换）
- ⏳ 导航功能测试（待验证所有导航项点击效果）

**后续验证建议（Phase 5）**:
- ⏳ 运行时测试（待启动开发服务器验证）
- ⏳ 响应式测试（待测试移动端/桌面端切换）
- ⏳ 导航功能测试（待验证所有导航项点击效果）

---

### Phase 5: Mobile Accessibility Hardening (移动端与无障碍加固) - ✅ 完成

**完成时间**: 2025-10-27

**完成内容**:
- ✅ 新增 `hooks/use-focus-trap.ts`，提供轻量级焦点陷阱与焦点恢复能力，移动端侧边栏打开时锁定焦点循环并在关闭时返聚到触发按钮。
- ✅ 更新 `components/navigation/mobile-sidebar-wrapper.tsx`，接入焦点陷阱、汉堡按钮 ref，并根据 `env(safe-area-inset-*)` 应用安全区偏移。
- ✅ 将 `components/navigation/sidebar.tsx` 升级为 `forwardRef` 组件，补充 `role="dialog"`、`aria-modal`、`tabIndex=-1`、安全区 padding 与高对比度友好类名。
- ✅ 调整 `components/navigation/sidebar-toggle.tsx` 与 `components/navigation/sidebar-overlay.tsx`，扩展触控面积至 ≥44px，并统一高对比度样式钩子类。
- ✅ 扩展 `styles/globals.css`，为侧边栏/按钮/遮罩提供 `prefers-contrast: more` 情况下的颜色增强方案。
- ✅ 执行 `npm run lint`，确认更新后的组件通过 TypeScript/ESLint 校验。

**输出文件**:
- `hooks/use-focus-trap.ts`
- `components/navigation/mobile-sidebar-wrapper.tsx`
- `components/navigation/sidebar-context.tsx`
- `components/navigation/sidebar.tsx`
- `components/navigation/sidebar-toggle.tsx`
- `components/navigation/sidebar-overlay.tsx`
- `styles/globals.css`
- `documents/project-board.md`

**验证笔记**:
- 🔄 尚需在真机上验证移动端动画与高对比度渲染效果（iOS Safari、Android Chrome）。
- 🔄 桌面/移动端端到端导航流待在开发服务器上复测。
