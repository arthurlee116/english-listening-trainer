# 问题生成API

<cite>
**本文档引用文件**  
- [questions/route.ts](file://app/api/ai/questions/route.ts)
- [ai-service.ts](file://lib/ai-service.ts)
- [question-interface.tsx](file://components/question-interface.tsx)
- [types.ts](file://lib/types.ts)
- [concurrency-service.ts](file://lib/concurrency-service.ts)
- [difficulty-service.ts](file://lib/difficulty-service.ts)
- [ark-helper.ts](file://lib/ark-helper.ts)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖分析](#依赖分析)
7. [性能考量](#性能考量)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)

## 简介
本技术文档全面解析英语听力训练系统中的问题生成API，重点针对`/api/ai/questions`端点。该接口在完成听力材料转录后，自动创建配套的理解题目，支持选择题、填空题等多种题型。文档将深入说明请求参数（如题目数量、认知层次）、响应格式、AI生成质量保障机制，并结合前端组件实现数据对接。

## 项目结构
系统采用Next.js App Router架构，API路由集中于`app/api`目录下，按功能模块组织。问题生成相关逻辑位于`app/api/ai/questions/route.ts`，客户端服务封装于`lib/ai-service.ts`，前端交互界面由`components/question-interface.tsx`实现。

```mermaid
graph TB
subgraph "API层"
A[/api/ai/questions/route.ts] --> B[callArkAPI]
C[ai-service.ts] --> A
end
subgraph "前端层"
D[question-interface.tsx] --> C
E[main-app.tsx] --> D
end
subgraph "辅助服务"
F[difficulty-service.ts] --> A
G[concurrency-service.ts] --> A
end
```

**Diagram sources**
- [route.ts](file://app/api/ai/questions/route.ts)
- [ai-service.ts](file://lib/ai-service.ts)
- [question-interface.tsx](file://components/question-interface.tsx)

**Section sources**
- [app/api/ai/questions/route.ts](file://app/api/ai/questions/route.ts)
- [lib/ai-service.ts](file://lib/ai-service.ts)
- [components/question-interface.tsx](file://components/question-interface.tsx)

## 核心组件
问题生成API的核心在于将转录文本作为上下文传递给AI模型，并通过结构化输出控制确保返回格式的规范性。系统利用Ark API进行调用，结合JSON Schema验证机制保证响应质量。

**Section sources**
- [questions/route.ts](file://app/api/ai/questions/route.ts#L1-L127)
- [ai-service.ts](file://lib/ai-service.ts#L1-L113)
- [types.ts](file://lib/types.ts#L37-L47)

## 架构概览
整个问题生成流程遵循清晰的分层架构：前端组件发起请求 → 客户端服务代理 → API路由处理 → AI模型调用 → 结构化结果返回。

```mermaid
sequenceDiagram
participant 前端 as question-interface.tsx
participant 服务 as ai-service.ts
participant 路由 as questions/route.ts
participant AI模型 as callArkAPI
前端->>服务 : generateQuestions()
服务->>路由 : POST /api/ai/questions
路由->>路由 : 构建提示词(prompt)
路由->>AI模型 : 调用Ark API
AI模型-->>路由 : 返回结构化JSON
路由-->>服务 : JSON响应
服务-->>前端 : 题目数组
```

**Diagram sources**
- [questions/route.ts](file://app/api/ai/questions/route.ts#L40-L127)
- [ai-service.ts](file://lib/ai-service.ts#L50-L65)
- [ark-helper.ts](file://lib/ark-helper.ts#L113-L200)

## 详细组件分析

### 问题生成API路由分析
`questions/route.ts`实现了完整的RESTful POST接口，接收转录文本和配置参数，生成符合教学要求的阅读理解题。

#### 请求处理流程
```mermaid
flowchart TD
Start([接收入参]) --> Validate["验证必要参数"]
Validate --> InputValid{"参数完整?"}
InputValid --> |否| ReturnError["返回400错误"]
InputValid --> |是| CalcCount["计算建议题量"]
CalcCount --> BuildPrompt["构建AI提示词"]
BuildPrompt --> AddDifficulty["添加难度描述"]
AddDifficulty --> CallAI["调用Ark API"]
CallAI --> Schema["使用JSON Schema校验"]
Schema --> ProcessResult["处理AI响应"]
ProcessResult --> ReturnSuccess["返回成功结果"]
ProcessResult --> ReturnFail["返回500错误"]
```

**Diagram sources**
- [questions/route.ts](file://app/api/ai/questions/route.ts#L15-L127)

**Section sources**
- [questions/route.ts](file://app/api/ai/questions/route.ts#L1-L127)

### 客户端AI服务分析
`ai-service.ts`为前端提供统一的AI功能调用接口，避免在浏览器中暴露敏感密钥。

#### 服务方法关系图
```mermaid
classDiagram
class AIService {
+generateTopics()
+generateTranscript()
+generateQuestions()
+gradeAnswers()
+expandText()
}
AIService --> HTTPClient : "使用fetch"
AIService --> APIRoute : "调用/api/ai/*"
```

**Diagram sources**
- [ai-service.ts](file://lib/ai-service.ts#L1-L113)

**Section sources**
- [ai-service.ts](file://lib/ai-service.ts#L1-L113)

### 前端答题界面分析
`question-interface.tsx`组件负责展示生成的问题并收集用户答案，实现完整的练习闭环。

#### 组件状态管理
```mermaid
stateDiagram-v2
[*] --> 初始化
初始化 --> 加载中 : 开始生成
加载中 --> 已加载 : 成功获取题目
加载中 --> 错误 : 生成失败
已加载 --> 答题中 : 用户开始作答
答题中 --> 提交中 : 点击提交
提交中 --> 已评分 : 批改完成
```

**Diagram sources**
- [question-interface.tsx](file://components/question-interface.tsx#L1-L310)

**Section sources**
- [question-interface.tsx](file://components/question-interface.tsx#L1-L310)

## 依赖分析
问题生成API依赖多个内部服务和外部AI模型，形成复杂的调用链路。

```mermaid
erDiagram
QUESTION_GENERATOR ||--|| DIFFICULTY_SERVICE : 使用
QUESTION_GENERATOR ||--|| CONCURRENCY_SERVICE : 限流
QUESTION_GENERATOR ||--|| ARK_API : 调用
FRONTEND_CLIENT ||--|| QUESTION_GENERATOR : 请求
DATABASE ||--o{ USER_SESSION : 存储
```

**Diagram sources**
- [questions/route.ts](file://app/api/ai/questions/route.ts)
- [difficulty-service.ts](file://lib/difficulty-service.ts)
- [concurrency-service.ts](file://lib/concurrency-service.ts)

**Section sources**
- [difficulty-service.ts](file://lib/difficulty-service.ts#L142-L199)
- [concurrency-service.ts](file://lib/concurrency-service.ts#L1-L251)

## 性能考量
系统通过并发控制和服务降级机制应对高并发场景，确保服务稳定性。

### 并发处理策略
```mermaid
flowchart LR
Request[新请求] --> Queue[进入队列]
Queue --> Active{活动数 < 最大并发?}
Active --> |是| Execute[立即执行]
Active --> |否| Wait[等待调度]
Execute --> Success[成功返回]
Execute --> Fail[失败重试]
Fail --> RetryCount{重试次数达标?}
RetryCount --> |否| BackToQueue[重新入队]
RetryCount --> |是| FinalFail[最终失败]
```

**Diagram sources**
- [concurrency-service.ts](file://lib/concurrency-service.ts#L1-L251)

**Section sources**
- [concurrency-service.ts](file://lib/concurrency-service.ts#L1-L251)

## 故障排除指南
当问题生成API出现异常时，可参考以下排查路径：

1. **参数缺失**：检查是否提供了`difficulty`和`transcript`必填字段
2. **AI响应异常**：查看日志中"AI响应格式异常"错误，确认Schema校验失败原因
3. **并发超限**：检查X-RateLimit头信息，确认是否达到速率限制
4. **代理故障**：观察`callArkAPI`中的代理健康检查逻辑是否触发降级

**Section sources**
- [questions/route.ts](file://app/api/ai/questions/route.ts#L115-L127)
- [ark-helper.ts](file://lib/ark-helper.ts#L113-L200)
- [rate-limiter.ts](file://lib/rate-limiter.ts#L60-L105)

## 结论
问题生成API通过精心设计的提示工程和严格的结构化输出控制，实现了高质量的自动化题目生成。系统整合了难度分级、并发控制、错误重试等企业级特性，为英语听力训练提供了可靠的技术支撑。未来可进一步优化AI提示词，增加更多题型支持。