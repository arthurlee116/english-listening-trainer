# AI内容生成API

<cite>
**本文档引用文件**  
- [cerebras-service.ts](file://lib/ai/cerebras-service.ts) - *重构AI调用核心服务*
- [topics/route.ts](file://app/api/ai/topics/route.ts) - *更新为结构化调用*
- [transcript/route.ts](file://app/api/ai/transcript/route.ts) - *迁移至Cerebras Cloud SDK*
- [questions/route.ts](file://app/api/ai/questions/route.ts) - *实现结构化响应验证*
- [grade/route.ts](file://app/api/ai/grade/route.ts) - *重构AI辅助接口*
- [expand/route.ts](file://app/api/ai/expand/route.ts) - *优化路由管理*
- [schemas.ts](file://lib/ai/schemas.ts) - *定义结构化响应模式*
- [route-utils.ts](file://lib/ai/route-utils.ts) - *统一AI路由创建*
- [retry-strategy.ts](file://lib/ai/retry-strategy.ts) - *实现覆盖重试策略*
- [prompt-templates.ts](file://lib/ai/prompt-templates.ts) - *重构提示词模板*
- [ark-helper.ts](file://lib/ark-helper.ts) - *代理容错机制*
- [rate-limiter.ts](file://lib/rate-limiter.ts) - *速率限制配置*
- [difficulty-service.ts](file://lib/difficulty-service.ts) - *难度级别服务*
- [text-expansion.ts](file://lib/text-expansion.ts) - *文本扩展工具*
- [types.ts](file://lib/types.ts) - *类型定义*
</cite>

## 更新摘要
**变更内容**   
- 将所有AI路由从直接调用`callArkAPI`重构为使用`invokeStructured`管道
- 引入`cerebras-service.ts`作为统一的AI调用服务层
- 更新所有API端点以使用结构化响应验证
- 增强重试策略，实现基于覆盖质量的智能重试
- 重构提示词模板系统，提高可维护性
- 更新服务协调机制和调用链文档

## 目录
1. [简介](#简介)
2. [核心功能与API端点](#核心功能与api端点)
3. [服务协调机制](#服务协调机制)
4. [服务调用链与容错策略](#服务调用链与容错策略)
5. [请求示例](#请求示例)
6. [速率限制机制](#速率限制机制)
7. [缓存优化方案](#缓存优化方案)
8. [错误处理与监控](#错误处理与监控)
9. [结论](#结论)

## 简介
本API系统为英语听力训练平台提供AI驱动的内容生成能力，涵盖主题生成、转录文本生成、问题生成、文本扩展和答案评分五大核心功能。所有AI调用均通过Cerebras云平台实现，并由`cerebras-service.ts`统一协调客户端请求。系统采用结构化提示工程、多阶段生成流程和智能重试机制，确保高质量输出的同时保障服务稳定性。

## 核心功能与API端点

### 主题生成 (/api/ai/topics)
生成适合特定难度等级的听力练习话题。

**输入参数：**
- `difficulty`: 难度级别 (A1, A2, B1, B2, C1, C2)
- `wordCount`: 目标词数
- `language`: 听力语言 (en-US, en-GB, es等)
- `difficultyLevel`: 数字型难度等级 (1-30)
- `focusAreas`: 重点关注领域数组

**JSON响应结构：**
```json
{
  "success": true,
  "topics": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "focusCoverage": {
    "requested": 3,
    "provided": 2,
    "coverage": 0.67,
    "missing": ["inference", "vocabulary"]
  },
  "attempts": 2,
  "degradationReason": "content_quality"
}
```

### 转录文本生成 (/api/ai/transcript)
基于指定主题生成符合难度要求的听力稿。

**输入参数：**
- `difficulty`: 难度级别
- `wordCount`: 目标词数
- `topic`: 主题
- `language`: 语言
- `difficultyLevel`: 数字难度等级
- `focusAreas`: 重点关注领域数组

**JSON响应结构：**
```json
{
  "success": true,
  "transcript": "生成的听力文本",
  "wordCount": 120,
  "generationAttempts": 2,
  "expansionAttempts": 3,
  "message": "生成成功"
}
```

### 问题生成 (/api/ai/questions)
根据听力稿生成理解性题目。

**输入参数：**
- `difficulty`: 难度级别
- `transcript`: 听力文本
- `duration`: 音频时长(秒)
- `language`: 语言
- `difficultyLevel`: 数字难度等级
- `focusAreas`: 重点关注领域数组
- `targetCount`: 目标题目数量

**JSON响应结构：**
```json
{
  "success": true,
  "questions": [
    {
      "type": "single",
      "question": "问题文本",
      "options": ["A", "B", "C", "D"],
      "answer": "正确答案",
      "focus_areas": ["main-idea", "detail-comprehension"],
      "explanation": "解释文本"
    }
  ]
}
```

### 文本扩展 (/api/ai/expand)
将现有文本扩写至目标长度。

**输入参数：**
- `text`: 原始文本
- `targetWordCount`: 目标词数
- `topic`: 主题
- `difficulty`: 难度级别
- `language`: 语言
- `maxAttempts`: 最大尝试次数
- `minAcceptablePercentage`: 最小可接受百分比

**JSON响应结构：**
```json
{
  "success": true,
  "expandedText": "扩写后的文本",
  "originalWordCount": 80,
  "finalWordCount": 115,
  "expansionAttempts": 2,
  "meetsRequirement": true,
  "message": "扩写成功"
}
```

### 答案评分 (/api/ai/grade)
对用户答案进行专业批改。

**输入参数：**
- `transcript`: 原文
- `questions`: 题目列表
- `answers`: 用户答案
- `language`: 语言

**JSON响应结构：**
```json
{
  "success": true,
  "results": [
    {
      "type": "short",
      "user_answer": "用户答案",
      "correct_answer": "标准答案",
      "is_correct": false,
      "standard_answer": "参考答案",
      "score": 7,
      "short_feedback": "简要反馈",
      "error_tags": ["inference", "vocabulary"],
      "error_analysis": "中文错误分析"
    }
  ]
}
```

**Section sources**
- [topics/route.ts](file://app/api/ai/topics/route.ts#L1-L122)
- [transcript/route.ts](file://app/api/ai/transcript/route.ts#L1-L188)
- [questions/route.ts](file://app/api/ai/questions/route.ts#L1-L127)
- [expand/route.ts](file://app/api/ai/expand/route.ts#L1-L113)
- [grade/route.ts](file://app/api/ai/grade/route.ts#L1-L134)

## 服务协调机制
整个AI内容生成系统通过`cerebras-service.ts`作为统一的AI调用服务层，该文件导出`invokeStructured`函数作为核心接口。所有API端点不再直接调用`callArkAPI`，而是通过`invokeStructured`管道进行结构化调用。

后端API路由接收到请求后，会调用`invokeStructured`函数，该函数封装了完整的AI调用逻辑，包括：
- 构建符合JSON Schema的响应格式
- 处理超时、重试等选项
- 添加监控标签
- 传递温度和最大token数等模型参数

系统利用`difficulty-service.ts`提供的`getDifficultyPromptModifier`函数，将数字型难度等级转换为详细的提示词修饰符，精确控制生成内容的复杂度。同时，`schemas.ts`文件定义了所有结构化响应的JSON Schema，确保返回数据格式符合预期。

**Diagram sources**
- [cerebras-service.ts](file://lib/ai/cerebras-service.ts#L1-L65)
- [ark-helper.ts](file://lib/ark-helper.ts#L1-L289)

```mermaid
flowchart TD
A[客户端] --> B[cerebras-service.ts]
B --> C[/api/ai/* 路由]
C --> D[invokeStructured]
D --> E[ark-helper.ts]
E --> F[Cerebras云平台]
G[difficulty-service.ts] --> C
H[schemas.ts] --> D
I[prompt-templates.ts] --> C
```

## 服务调用链与容错策略
以`topics/route.ts`为例，展示完整的服务调用链和容错设计：

1. **请求验证**：检查必要参数是否存在
2. **上下文预处理**：通过`preprocessRequestContext`获取请求上下文
3. **难度映射**：获取精确的难度描述
4. **提示词构建**：通过`buildTopicsPrompt`构造系统提示
5. **覆盖重试执行**：使用`executeWithCoverageRetry`进行智能重试
6. **结构化调用**：通过`invokeStructured`发起AI请求
7. **结果验证**：检查返回数据是否符合预期结构
8. **异常处理**：捕获并记录错误，返回标准化错误响应

`invokeStructured`函数实现了多层次的容错机制：
- **结构化响应**：使用JSON Schema确保输出格式正确
- **代理健康检查**：定期检测代理服务器状态
- **自动回退**：代理失败时切换到直连模式
- **指数退避重试**：最多3次重试，间隔时间递增
- **电路断路器**：防止雪崩效应

```mermaid
sequenceDiagram
participant Client as 客户端
participant CerebrasService as cerebras-service.ts
participant Route as topics/route.ts
participant InvokeStructured as invokeStructured
participant ArkHelper as ark-helper.ts
participant Cerebras as Cerebras云平台
Client->>CerebrasService : generateTopics()
CerebrasService->>Route : POST /api/ai/topics
Route->>Route : 参数验证
Route->>Route : 上下文预处理
Route->>Route : 构建提示词
Route->>InvokeStructured : executeWithCoverageRetry()
InvokeStructured->>InvokeStructured : 生成请求
InvokeStructured->>InvokeStructured : 评估覆盖质量
InvokeStructured->>InvokeStructured : 决定是否重试
InvokeStructured->>InvokeStructured : 构建重试提示
InvokeStructured->>InvokeStructured : 调用invokeStructured
InvokeStructured->>ArkHelper : callArkAPI()
ArkHelper->>Cerebras : 发送请求
alt 成功响应
Cerebras-->>ArkHelper : 返回JSON
ArkHelper-->>InvokeStructured : 解析结果
InvokeStructured-->>Route : 返回最佳结果
Route-->>CerebrasService : 返回话题列表
CerebrasService-->>Client : 返回topics数组
else 失败重试
Cerebras--xArkHelper : 连接失败
ArkHelper->>ArkHelper : 指数退避等待
ArkHelper->>Cerebras : 重试请求
end
```

**Diagram sources**
- [topics/route.ts](file://app/api/ai/topics/route.ts#L1-L122)
- [cerebras-service.ts](file://lib/ai/cerebras-service.ts#L1-L65)
- [retry-strategy.ts](file://lib/ai/retry-strategy.ts#L1-L102)

**Section sources**
- [topics/route.ts](file://app/api/ai/topics/route.ts#L1-L122)
- [cerebras-service.ts](file://lib/ai/cerebras-service.ts#L1-L65)
- [retry-strategy.ts](file://lib/ai/retry-strategy.ts#L1-L102)

## 请求示例

### 生成初级校园话题
```json
{
  "level": "A2",
  "topic": "school",
  "wordCount": 100,
  "language": "en-US",
  "focusAreas": ["main-idea", "detail-comprehension"]
}
```

### 生成听力稿（带扩写）
```json
{
  "difficulty": "B1",
  "wordCount": 150,
  "topic": "environmental protection",
  "language": "en-US",
  "difficultyLevel": 14,
  "focusAreas": ["inference", "vocabulary"]
}
```

### 批改答案
```json
{
  "transcript": "The climate change conference...",
  "questions": [...],
  "answers": {
    "0": "The main point is about global warming",
    "1": "They discussed renewable energy"
  },
  "language": "en-US"
}
```

**Section sources**
- [topics/route.ts](file://app/api/ai/topics/route.ts#L1-L122)
- [transcript/route.ts](file://app/api/ai/transcript/route.ts#L1-L188)
- [grade/route.ts](file://app/api/ai/grade/route.ts#L1-L134)

## 速率限制机制
系统通过`rate-limiter.ts`实现精细化的速率控制，防止滥用并保障服务质量。

**预设配置：**
- **AI分析端点**：每分钟10次请求
- **批量处理**：每5分钟3次请求
- **通用API**：每分钟60次请求

**关键特性：**
- **自适应计数**：可选择是否计入成功/失败请求
- **多维度键值**：基于IP地址或用户ID进行限流
- **内存存储**：使用Map对象存储限流状态
- **定时清理**：每5分钟清理过期条目

```mermaid
flowchart TD
A[接收请求] --> B{是否首次请求?}
B --> |是| C[创建新条目]
B --> |否| D{是否超限?}
D --> |是| E[拒绝请求]
D --> |否| F[增加计数]
F --> G[处理请求]
C --> G
G --> H[返回响应]
```

**Diagram sources**
- [rate-limiter.ts](file://lib/rate-limiter.ts#L1-L276)

## 缓存优化方案
虽然当前代码未直接实现响应缓存，但可通过以下方式优化性能：

1. **应用层缓存**：在`cerebras-service.ts`中添加内存缓存，对相同参数的请求返回缓存结果
2. **CDN缓存**：对于不敏感的公共内容，可配置CDN进行边缘缓存
3. **数据库缓存**：将高频请求的结果持久化存储，减少AI调用次数
4. **本地缓存**：客户端可缓存最近生成的内容，减少网络往返

建议结合`rate-limiter.ts`中的键值生成逻辑，实现基于用户和请求参数的细粒度缓存策略。

## 错误处理与监控
系统建立了全面的错误处理和监控体系：

- **结构化错误**：所有错误都包含明确的消息和状态码
- **详细日志**：关键步骤输出调试信息，便于问题追踪
- **电路断路器**：`aiServiceCircuitBreaker`防止级联故障
- **代理健康检查**：定期检测连接
- **AI遥测**：通过`emitAiTelemetry`收集调用指标

## 结论
本次重构将AI调用系统从分散的直接调用模式升级为统一的结构化调用管道，提高了代码的可维护性和可靠性。通过引入`invokeStructured`核心服务，实现了调用逻辑的集中管理，同时增强了错误处理和监控能力。智能重试策略的实现确保了在复杂场景下的高质量输出，为用户提供更稳定可靠的内容生成服务。