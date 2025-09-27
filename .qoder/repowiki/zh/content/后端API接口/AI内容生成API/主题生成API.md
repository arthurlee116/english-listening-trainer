# 主题生成API

<cite>
**本文档引用的文件**
- [topics/route.ts](file://app/api/ai/topics/route.ts)
- [ai-service.ts](file://lib/ai-service.ts)
- [ark-helper.ts](file://lib/ark-helper.ts)
- [difficulty-service.ts](file://lib/difficulty-service.ts)
- [rate-limiter.ts](file://lib/rate-limiter.ts)
- [performance-optimizer.ts](file://lib/performance-optimizer.ts)
</cite>

## 目录
1. [介绍](#介绍)
2. [请求结构与参数说明](#请求结构与参数说明)
3. [服务调用链与处理流程](#服务调用链与处理流程)
4. [错误处理机制](#错误处理机制)
5. [性能优化策略](#性能优化策略)
6. [使用示例](#使用示例)

## 介绍

主题生成API是英语听力训练系统的核心功能之一，专为K12学生设计。该接口通过`/api/ai/topics`端点接收用户指定的学习难度和可选主题关键词，调用Cerebras AI模型生成适合特定水平学习者的听力练习主题列表。系统结合了AI推理、速率限制、缓存优化和容错重试机制，确保高可用性和响应性能。

**Section sources**
- [topics/route.ts](file://app/api/ai/topics/route.ts#L1-L77)

## 请求结构与参数说明

### 请求体结构
```json
{
  "difficulty": "A2",
  "wordCount": 150,
  "language": "en-US",
  "topic": "daily-routine"
}
```

### 参数范围及默认值

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `difficulty` | string | 是 | 无 | 难度等级（如A1, A2, B1等） |
| `wordCount` | number | 是 | 无 | 目标词汇量（建议100-300） |
| `language` | string | 否 | 'en-US' | 音频语言代码 |
| `topic` | string | 否 | 无 | 可选主题关键词 |

返回的JSON格式包含5个符合要求的主题标题及其元数据信息。

**Section sources**
- [topics/route.ts](file://app/api/ai/topics/route.ts#L15-L38)

## 服务调用链与处理流程

### 调用链分析
```mermaid
sequenceDiagram
participant Client as 客户端应用
participant AIService as ai-service.ts
participant TopicRoute as topics/route.ts
participant ArkHelper as ark-helper.ts
participant Cerebras as Cerebras AI 模型
Client->>AIService : generateTopics()
AIService->>TopicRoute : POST /api/ai/topics
TopicRoute->>TopicRoute : 参数验证
alt 提供了数字难度等级
TopicRoute->>difficulty-service.ts : getDifficultyPromptModifier()
end
TopicRoute->>ArkHelper : callArkAPI()
ArkHelper->>Cerebras : 发送提示词请求
Cerebras-->>ArkHelper : 返回JSON响应
ArkHelper-->>TopicRoute : 解析结果
TopicRoute-->>AIService : 返回主题数组
AIService-->>Client : 返回成功响应
```

**Diagram sources**
- [ai-service.ts](file://lib/ai-service.ts#L29-L35)
- [topics/route.ts](file://app/api/ai/topics/route.ts#L15-L77)
- [ark-helper.ts](file://lib/ark-helper.ts#L113-L200)
- [difficulty-service.ts](file://lib/difficulty-service.ts#L142-L199)

### 处理逻辑详解
1. **参数解析**：从请求中提取`difficulty`, `wordCount`, `language`, `topic`
2. **输入验证**：检查必填字段是否存在
3. **难度描述生成**：若提供`difficultyLevel`数字，则调用`getDifficultyPromptModifier`生成详细提示
4. **提示词构造**：构建符合AI模型理解的自然语言指令
5. **模式校验**：定义返回JSON结构的schema以保证数据一致性

#### 超时与重试策略
系统采用指数退避算法实现最多3次自动重试：
- 第一次重试延迟：2秒
- 第二次重试延迟：4秒 + 随机抖动
- 第三次重试延迟：8秒 + 随机抖动

当代理服务异常时，会自动切换到备用客户端进行请求。

**Section sources**
- [ark-helper.ts](file://lib/ark-helper.ts#L113-L200)
- [difficulty-service.ts](file://lib/difficulty-service.ts#L142-L199)

## 错误处理机制

### 错误传播路径
```mermaid
flowchart TD
Start([请求进入]) --> ValidateInput["验证输入参数"]
ValidateInput --> InputValid{"参数完整?"}
InputValid --> |否| Return400["返回400错误"]
InputValid --> |是| CallAI["调用Cerebras API"]
CallAI --> AIResponse{"收到有效响应?"}
AIResponse --> |否| RetryLogic["执行重试逻辑"]
RetryLogic --> MaxRetries{"达到最大重试次数?"}
MaxRetries --> |是| Return500["返回500错误"]
MaxRetries --> |否| Delay["等待后重试"]
Delay --> CallAI
AIResponse --> |是| ParseResult["解析JSON结果"]
ParseResult --> ResultValid{"结果格式正确?"}
ResultValid --> |否| Return500
ResultValid --> |是| ReturnSuccess["返回成功响应"]
Return400 --> End([响应结束])
Return500 --> End
ReturnSuccess --> End
```

**Diagram sources**
- [topics/route.ts](file://app/api/ai/topics/route.ts#L15-L77)
- [ark-helper.ts](file://lib/ark-helper.ts#L113-L200)

### 常见错误码
- `400 Bad Request`: 缺少必要参数
- `429 Too Many Requests`: 超出速率限制
- `500 Internal Server Error`: AI响应格式异常或内部错误

所有错误均记录到服务器日志，并向客户端返回清晰的错误消息。

**Section sources**
- [topics/route.ts](file://app/api/ai/topics/route.ts#L70-L77)
- [enhanced-error-handler.ts](file://lib/enhanced-error-handler.ts#L249-L296)

## 性能优化策略

### 速率限制配置
系统对AI相关接口实施严格的速率控制：

```typescript
AI_ANALYSIS: {
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 10   // 最多10次请求
}
```

实际部署中针对`/api/ai/topics`设置了每分钟最多5次请求的限制，防止滥用并保障服务质量。

### 响应缓存机制
利用内存缓存提升重复请求的响应速度：

```mermaid
graph TB
subgraph "缓存层"
A[aiCache] --> |TTL 20分钟| B[LRU Cache]
C[基于输入哈希] --> D[键值存储]
end
subgraph "请求流"
E[新请求] --> F{缓存命中?}
F --> |是| G[直接返回缓存结果]
F --> |否| H[调用AI服务]
H --> I[存入缓存]
I --> J[返回响应]
end
A --> F
```

**Diagram sources**
- [rate-limiter.ts](file://lib/rate-limiter.ts#L152-L194)
- [performance-optimizer.ts](file://lib/performance-optimizer.ts#L55-L76)

缓存键由输入参数的哈希值生成，确保相同请求获得一致响应，同时避免不必要的AI调用开销。

**Section sources**
- [rate-limiter.ts](file://lib/rate-limiter.ts#L152-L194)
- [performance-optimizer.ts](file://lib/performance-optimizer.ts#L55-L76)

## 使用示例

### curl命令示例
```bash
curl -X POST https://api.example.com/api/ai/topics \
  -H "Content-Type: application/json" \
  -d '{
    "difficulty": "A2",
    "wordCount": 150,
    "topic": "daily-routine"
  }'
```

### 预期响应
```json
{
  "success": true,
  "topics": [
    "Morning routine: brushing teeth and getting dressed",
    "After school activities and homework time",
    "Family dinner and evening relaxation",
    "Weekend chores and grocery shopping",
    "Daily commute to school by bus"
  ]
}
```

此接口已集成至前端组件，支持实时生成符合学生水平的听力训练主题，显著提升个性化学习体验。

**Section sources**
- [topics/route.ts](file://app/api/ai/topics/route.ts#L15-L77)
- [ai-service.ts](file://lib/ai-service.ts#L29-L35)