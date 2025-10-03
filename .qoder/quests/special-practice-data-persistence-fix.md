# 专项练习数据持久化修复设计文档

## 概述

本设计文档规范了英语听力训练系统中专项练习数据持久化相关遗留问题的修复方案。重点解决类型定义不一致、成就系统时长统计、快捷键设置同步、专项数据合并以及练习时长采集等关键问题。

### 核心问题识别

1. **类型定义不一致**: Exercise 接口缺少标准化时长字段，导致使用 `(exercise as any)` 强制类型转换
2. **成就系统数据源**: 时长统计依赖回退逻辑而非标准字段，影响统计准确性
3. **快捷键状态不同步**: 设置变更后UI状态未即时更新，存在状态一致性问题
4. **专项数据整合**: 专项练习字段在组件消费端处理不完整
5. **时长采集时机**: 练习开始时间记录位置不准确，重置逻辑不完整

## 技术架构

### 数据模型优化架构

```mermaid
graph TD
    A[Exercise Interface] --> B[totalDurationSec: number]
    B --> C[PracticeSessionData]
    B --> D[PracticeRecord]
    
    C --> E[Achievement Service]
    D --> F[History Panel]
    
    G[convertExerciseToSessionData] --> H{时长数据来源}
    H -->|优先级1| I[exercise.totalDurationSec]
    H -->|回退逻辑| J[时间差计算]
    H -->|最终回退| K[内容估算]
```

### 状态管理同步架构

```mermaid
graph TD
    A[useShortcutSettings Hook] --> B[useState Management]
    B --> C[localStorage 操作]
    C --> D[自定义事件触发]
    
    D --> E[同页面组件监听]
    D --> F[跨标签页监听]
    
    E --> G[UI状态即时更新]
    F --> H[storage事件处理]
    
    I[设置变更] --> J[setEnabled调用]
    J --> K[state更新]
    J --> L[localStorage保存]
    J --> M[事件广播]
```

### 专项练习数据流架构

```mermaid
graph TD
    A[专项模式启动] --> B[focusAreas选择]
    B --> C[题目生成]
    C --> D[focusCoverage计算]
    
    D --> E[练习执行]
    E --> F[答题提交]
    F --> G[成绩计算]
    
    G --> H[perFocusAccuracy统计]
    H --> I[专项字段合并]
    I --> J[ResultsDisplay消费]
    I --> K[HistoryPanel消费]
    I --> L[AchievementPanel消费]
```

## 详细设计规范

### 类型与数据模型修复

#### Exercise 接口标准化

在 `lib/types.ts` 中已存在的 Exercise 接口将确保 `totalDurationSec` 字段的一致使用：

| 字段名 | 类型 | 说明 | 必需性 |
|--------|------|------|--------|
| totalDurationSec | number \| undefined | 练习总时长（秒），用于成就系统与历史统计 | 可选 |
| focusAreas | FocusArea[] \| undefined | 专项练习考察点标签 | 可选 |
| focusCoverage | FocusCoverage \| undefined | 标签覆盖率信息 | 可选 |
| specializedMode | boolean \| undefined | 是否为专项练习模式 | 可选 |
| perFocusAccuracy | Record<string, number> \| undefined | 按标签的正确率统计 | 可选 |

#### 类型同步更新策略

需要验证以下类型引用的一致性：

- **PracticeSessionData**: 确保 `duration` 字段对应 Exercise 的 `totalDurationSec`
- **PracticeRecord**: 验证时长字段的统一命名
- **成就服务相关接口**: 确保时长统计使用标准字段

### 成就系统与本地存储优化

#### convertExerciseToSessionData 函数修复

现有的时长获取逻辑采用三级优先级策略：

```mermaid
graph TD
    A[开始时长计算] --> B{exercise.totalDurationSec 是否有效}
    B -->|是| C[使用 totalDurationSec]
    B -->|否| D{时间差是否合理}
    D -->|是 30-1800秒| E[使用时间差]
    D -->|否| F[使用内容估算]
    
    C --> G[返回时长结果]
    E --> G
    F --> G
```

#### 数据兼容性保障

| 场景 | 处理策略 | 回退方案 |
|------|----------|----------|
| 新练习数据 | 优先使用 totalDurationSec | 时间差计算 |
| 历史练习数据 | 时间差计算 | 内容长度估算 |
| 音频异常情况 | 内容长度估算 | 最小60秒保底 |
| 数据损坏情况 | 默认估算值 | 用户提示重新练习 |

### 快捷键设置即时同步

#### 状态管理策略

`useShortcutSettings` Hook 实现状态与存储的双向同步：

| 功能 | 实现方式 | 同步机制 |
|------|----------|----------|
| 状态读取 | useState 初始化从 localStorage 加载 | 页面加载时同步 |
| 状态更新 | setEnabled/setOnboarded 同时更新 state 和 storage | 立即生效 |
| 跨组件同步 | CustomEvent 事件广播 | 同页面即时同步 |
| 跨标签同步 | storage 事件监听 | 跨标签页同步 |

#### 事件监听架构

```mermaid
graph TD
    A[设置变更触发] --> B[setState 更新]
    B --> C[localStorage 保存]
    C --> D[CustomEvent 广播]
    
    D --> E[useHotkeys 监听]
    E --> F[enabled 状态更新]
    
    G[跨标签变更] --> H[storage 事件]
    H --> I[state 同步更新]
```

### 专项数据合并与消费

#### 数据合并流程

在 `handleSubmitAnswers` 中确保以下专项字段的正确合并：

| 字段名 | 数据来源 | 计算逻辑 | 消费组件 |
|--------|----------|----------|----------|
| focusAreas | 用户选择 + AI生成匹配 | 并集合并 | ResultsDisplay, HistoryPanel |
| focusCoverage | AI分析结果 | 覆盖率计算 | 专项分析面板 |
| specializedMode | 模式标记 | 布尔值 | 历史记录筛选 |
| perFocusAccuracy | 按题目标签统计 | 分标签正确率 | AchievementPanel |

#### 数据安全访问策略

```mermaid
graph TD
    A[组件消费数据] --> B{focusCoverage 存在?}
    B -->|是| C[正常渲染]
    B -->|否| D[安全降级显示]
    
    E[perFocusAccuracy 访问] --> F{数据有效性检查}
    F -->|有效| G[按标签展示统计]
    F -->|无效| H[显示总体统计]
```

### 练习时长采集机制

#### 时间节点管理

`exerciseStartTimeRef` 的设置和重置时机：

| 操作 | 设置时机 | 重置时机 | 备注 |
|------|----------|----------|------|
| 生成练习 | 音频加载完成后 | 切换模式时 | 确保计时准确性 |
| 恢复历史 | 恢复操作完成后 | 重新生成时 | 避免时间重复 |
| 模式切换 | - | 立即重置 | 防止跨模式计时 |
| 应用推荐 | - | 立即重置 | 重新开始计时 |

#### 时长计算精度保障

```mermaid
graph TD
    A[练习开始] --> B[记录 exerciseStartTimeRef]
    B --> C[用户答题过程]
    C --> D[提交答案]
    D --> E[计算 totalDurationSec]
    E --> F[保存到 Exercise 对象]
    
    G[中断情况] --> H[重置 exerciseStartTimeRef]
    H --> I[清理相关状态]
    
    J[恢复练习] --> K[重新设置时间起点]
```

## 组件交互规范

### ResultsDisplay 组件适配

确保组件能够安全处理专项练习字段：

- 检查 `exercise.specializedMode` 决定显示模式
- 安全访问 `exercise.perFocusAccuracy` 避免未定义错误
- 对 `focusCoverage` 进行空值检查

### HistoryPanel 组件增强

历史记录面板需要支持专项数据的筛选和展示：

- 按 `specializedMode` 标记区分普通和专项练习
- 展示 `focusAreas` 标签信息
- 支持按专项标签筛选历史记录

### AchievementPanel 组件集成

成就面板消费专项统计数据：

- 读取 `perFocusAccuracy` 进行专项能力分析
- 基于 `totalDurationSec` 计算累计听力时长
- 支持专项练习成就解锁逻辑

## 验证与测试策略

### 自动化验证

| 验证项目 | 验证方法 | 预期结果 |
|----------|----------|----------|
| 类型检查 | npm run lint | 无 TypeScript 错误 |
| 单元测试 | npm run test | 关键函数测试通过 |
| 数据一致性 | 集成测试 | 时长字段统计准确 |

### 手动验证流程

#### 专项模式完整流程

1. **生成环节**: 选择专项标签 → 生成练习 → 验证 `focusAreas` 设置
2. **练习环节**: 听音频 → 答题 → 验证时长记录
3. **结果环节**: 查看结果 → 验证专项统计 → 检查 `perFocusAccuracy`
4. **历史环节**: 查看历史 → 验证专项标记 → 检查筛选功能
5. **成就环节**: 打开成就面板 → 验证时长累计 → 检查专项成就

#### 快捷键同步验证

1. **设置切换**: 快捷键开关 → 观察按钮文案变化 → 验证即时生效
2. **功能响应**: 切换后测试快捷键 → 验证启用/禁用状态
3. **持久化**: 刷新页面 → 验证设置保持 → 检查状态一致性

## 风险控制与回滚策略

### 潜在风险识别

| 风险类型 | 影响程度 | 缓解策略 |
|----------|----------|----------|
| 类型不兼容 | 高 | 渐进式类型迁移，保持向后兼容 |
| 数据丢失 | 高 | 多级回退机制，安全默认值 |
| 性能影响 | 中 | 数据缓存，惰性计算 |
| 状态不一致 | 中 | 事件机制同步，错误恢复 |

### 回滚预案

如发现修复引入新问题，可采用以下回滚策略：

1. **字段级回滚**: 保持 `totalDurationSec` 可选，回退到时间差计算
2. **功能级回滚**: 禁用专项模式，恢复基础练习功能
3. **存储级回滚**: 清理问题数据，重置为默认状态

### 数据迁移保障

对现有用户数据的兼容性处理：

```mermaid
graph TD
    A[用户数据加载] --> B{数据版本检查}
    B -->|旧版本| C[数据格式升级]
    B -->|新版本| D[直接使用]
    
    C --> E[字段补充]
    E --> F[默认值设置]
    F --> G[验证完整性]
    G --> D
    
    H[升级失败] --> I[使用安全默认值]
    I --> J[记录警告日志]
```

## 实施计划

### 阶段性推进

1. **第一阶段**: 类型定义修复和数据模型统一
2. **第二阶段**: 快捷键状态同步机制实现
3. **第三阶段**: 专项数据合并逻辑完善
4. **第四阶段**: 时长采集机制优化
5. **第五阶段**: 组件适配和测试验证

### 质量保证

- 每个阶段完成后进行代码审查
- 实施单元测试和集成测试
- 进行用户体验测试确保功能正常
- 监控错误日志和性能指标

本设计确保专项练习数据持久化的完整性、准确性和可靠性，为用户提供一致的学习体验。