# 文本扩展API

<cite>
**本文档引用文件**   
- [route.ts](file://app/api/ai/expand/route.ts)
- [transcript-expansion.ts](file://lib/ai/transcript-expansion.ts)
- [cerebras-service.ts](file://lib/ai/cerebras-service.ts)
- [schemas.ts](file://lib/ai/schemas.ts)
- [prompt-templates.ts](file://lib/ai/prompt-templates.ts)
</cite>

## 更新摘要
**主要变更**   
- 更新了AI服务调用架构，从`ark-helper.ts`迁移至`cerebras-service.ts`中的`invokeStructured`函数
- 重构了文本扩展处理流程，引入结构化调用管道
- 新增了智能重试策略和错误处理机制
- 更新了扩写提示词生成逻辑和响应模式
- 移除了动态代理支持，统一了AI调用接口

## 目录
1. [简介](#简介)
2. [核心功能与应用场景](#核心功能与应用场景)
3. [输入输出结构定义](#输入输出结构定义)
4. [处理流程剖析](#处理流程剖析)
5. [扩写算法实现机制](#扩写算法实现机制)
6. [AI服务调用与模型集成](#ai服务调用与模型集成)
7. [示例演示](#示例演示)
8. [可控性设置与语义保持](#可控性设置与语义保持)
9. [敏感内容过滤策略](#敏感内容过滤策略)
10. [性能优化与错误处理](#性能优化与错误处理)

## 简介
文本扩展API旨在为英语听力学习者提供智能化的语言输入增强功能。该API通过`/api/ai/expand`端点接收简短的原始文本，并将其扩展为更丰富、更具上下文意义的表达形式，从而提升语言学习材料的复杂度和实用性。系统利用Cerebras大模型进行语义保持的扩写任务，确保生成内容既符合目标长度要求，又不偏离原始含义。近期重构了AI服务调用管道，统一采用结构化调用机制，提升了调用的稳定性和可维护性。

## 核心功能与应用场景
本API的核心功能是将用户提供的简短句子或关键词扩展为适合听力练习的完整段落。主要应用于：
- 增强初级学习者的语言输入质量
- 生成多样化且自然的听力脚本素材
- 提供不同难度级别的语言表达变体
- 支持个性化学习路径中的内容定制化

**Section sources**
- [route.ts](file://app/api/ai/expand/route.ts#L1-L38)

## 输入输出结构定义
### 输入字段说明
| 字段名 | 类型 | 必填 | 描述 |
|-------|------|------|------|
| text | string | 是 | 需要扩展的原始文本 |
| targetWordCount | number | 是 | 目标单词数量 |
| topic | string | 是 | 主题领域（如日常生活、学术讲座等） |
| difficulty | string | 是 | 难度等级（A1-C2） |
| language | string | 否 | 语言代码，默认'en-US' |
| maxAttempts | number | 否 | 最大尝试次数，默认5次 |
| minAcceptablePercentage | number | 否 | 可接受最小百分比，默认0.9 |

### 输出结构说明
```json
{
  "success": true,
  "expandedText": "扩展后的文本",
  "originalWordCount": 3,
  "finalWordCount": 20,
  "targetWordCount": 20,
  "expansionAttempts": 2,
  "meetsRequirement": true,
  "meetsBasicRequirement": true,
  "minAcceptablePercentage": 0.9,
  "message": "扩写成功：从 3 词扩写到 20 词（达到90%要求）"
}
```

**Section sources**
- [route.ts](file://app/api/ai/expand/route.ts#L1-L38)

## 处理流程剖析
```mermaid
flowchart TD
Start([接收到POST请求]) --> ValidateInput["验证输入参数"]
ValidateInput --> InputValid{"参数完整?"}
InputValid --> |否| ReturnError["返回400错误"]
InputValid --> |是| CheckLength["检查是否已达长度要求"]
CheckLength --> MeetsTarget{"已满足长度要求?"}
MeetsTarget --> |是| ReturnOriginal["直接返回原文本"]
MeetsTarget --> |否| InitLoop["初始化循环变量"]
InitLoop --> WhileLoop["进入扩写循环"]
WhileLoop --> GeneratePrompt["生成扩写提示词"]
GeneratePrompt --> CallAI["调用AI服务"]
CallAI --> AISuccess{"AI调用成功?"}
AISuccess --> |否| ContinueLoop["继续下一次尝试"]
AISuccess --> |是| UpdateText["更新当前文本"]
UpdateText --> SafetyCheck["安全检查: 是否超长?"]
SafetyCheck --> |是| BreakLoop["跳出循环"]
SafetyCheck --> |否| LengthMet{"达到目标长度?"}
LengthMet --> |否| ContinueLoop
LengthMet --> |是| BreakLoop
BreakLoop --> FinalCheck["最终结果检查"]
FinalCheck --> ReturnResult["返回JSON响应"]
ReturnError --> End([结束])
ReturnOriginal --> End
ReturnResult --> End
```

**Diagram sources**
- [transcript-expansion.ts](file://lib/ai/transcript-expansion.ts#L32-L130)

**Section sources**
- [transcript-expansion.ts](file://lib/ai/transcript-expansion.ts#L32-L130)

## 扩写算法实现机制
### 单词计数逻辑
精确统计英文单词数量，采用正则表达式清理非单词字符后分割字符串并过滤无效项。

### 长度达标判断
基于目标词数和最小可接受百分比计算所需最低词数，比较实际词数是否达标。

### 扩写提示词生成
根据原始文本、当前词数、目标词数、主题、难度等因素动态构建结构化提示词，指导AI模型进行扩写。

```mermaid
classDiagram
class TextExpansionUtils {
+countWords(text : string) : number
+meetsLengthRequirement(text : string, targetWordCount : number, minPercentage : number) : boolean
+calculateExpansionTarget(currentText : string, targetWordCount : number, expansionPercentage : number) : number
+buildExpansionPrompt(originalText : string, currentWordCount : number, targetWordCount : number, topic : string, difficulty : string, minAcceptablePercentage : number, languageName : string) : string
}
TextExpansionUtils --> "uses" cerebras-service : 调用
TextExpansionUtils --> "defines" ExpansionStructuredResponse : 输出格式
```

**Diagram sources**
- [prompt-templates.ts](file://lib/ai/prompt-templates.ts#L188-L225)
- [transcript-expansion.ts](file://lib/ai/transcript-expansion.ts#L32-L130)

**Section sources**
- [prompt-templates.ts](file://lib/ai/prompt-templates.ts#L188-L225)
- [transcript-expansion.ts](file://lib/ai/transcript-expansion.ts#L32-L130)

## AI服务调用与模型集成
### 结构化调用管道
`cerebras-service.ts`提供了统一的结构化调用接口`invokeStructured`，所有AI调用通过此函数完成，确保了调用的一致性和类型安全。

### 服务端AI调用
`invokeStructured`函数封装了对Cerebras大模型的调用，包含智能重试策略、超时控制和结构化响应处理，移除了之前的动态代理支持。

```mermaid
sequenceDiagram
participant Frontend as 前端应用
participant AIService as ai-service.ts
participant APIRoute as route.ts
participant CerebrasService as cerebras-service.ts
participant Cerebras as Cerebras模型
Frontend->>AIService : expandText()
AIService->>APIRoute : POST /api/ai/expand
APIRoute->>transcript-expansion : expandTranscript()
transcript-expansion->>CerebrasService : invokeStructured()
CerebrasService->>Cerebras : 发送消息+Schema
Cerebras-->>CerebrasService : 返回JSON响应
CerebrasService-->>transcript-expansion : 解析结果
transcript-expansion-->>APIRoute : 扩展结果
APIRoute-->>AIService : JSON响应
AIService-->>Frontend : 扩展结果对象
```

**Diagram sources**
- [cerebras-service.ts](file://lib/ai/cerebras-service.ts#L31-L60)
- [transcript-expansion.ts](file://lib/ai/transcript-expansion.ts#L89-L89)

**Section sources**
- [cerebras-service.ts](file://lib/ai/cerebras-service.ts#L31-L60)
- [transcript-expansion.ts](file://lib/ai/transcript-expansion.ts#L89-L89)

## 示例演示
将简单句子"I like apples"扩展为更丰富的表达：

**输入：**
```json
{
  "text": "I like apples",
  "targetWordCount": 20,
  "topic": "Daily Life",
  "difficulty": "B1",
  "language": "en-US"
}
```

**输出：**
```json
{
  "expandedText": "I really enjoy eating fresh red apples every morning because they are both delicious and healthy.",
  "originalWordCount": 3,
  "finalWordCount": 14,
  "targetWordCount": 20,
  "expansionAttempts": 1,
  "meetsRequirement": true,
  "message": "扩写成功：从 3 词扩写到 14 词（达到90%要求）"
}
```

**Section sources**
- [transcript-expansion.ts](file://lib/ai/transcript-expansion.ts#L32-L130)

## 可控性设置与语义保持
### 控制参数
- `maxAttempts`: 控制最大迭代次数，防止无限循环
- `minAcceptablePercentage`: 设定最低长度达标比例
- `difficulty`: 影响生成文本的词汇复杂度和句式结构
- `topic`: 引导扩写方向，确保内容相关性

### 语义保持技术
- 在提示词中明确要求"保持核心内容和逻辑结构"
- 禁止改变原意或添加无关信息
- 要求生成完整的扩展脚本而非片段
- 使用结构化输出确保数据一致性
- 通过`expansionSchema`强制要求返回`expanded_text`字段

**Section sources**
- [prompt-templates.ts](file://lib/ai/prompt-templates.ts#L188-L225)
- [schemas.ts](file://lib/ai/schemas.ts#L154-L161)

## 敏感内容过滤策略
虽然当前代码未直接体现敏感内容过滤逻辑，但可通过以下方式实现：
1. 在AI提示词中加入内容安全约束
2. 对生成结果进行关键词扫描
3. 利用外部内容审核API进行二次校验
4. 设置黑名单机制阻止特定主题的扩写

建议在`invokeStructured`返回后增加内容审查步骤，确保生成文本符合教育场景的安全标准。

## 性能优化与错误处理
### 错误处理机制
- 参数缺失时返回400状态码
- 捕获异步操作异常并记录日志
- AI响应格式异常时继续重试
- 超出最大尝试次数后返回部分成功结果
- 通过`try-catch`块处理单次扩写尝试失败

### 性能优化措施
- 统一采用`invokeStructured`结构化调用管道
- 实现智能重试策略，失败时自动重试直至达到最大尝试次数
- 添加超时控制和信号中断支持
- 使用结构化响应模式减少解析错误
- 本地缓存常用配置减少重复计算

**Section sources**
- [transcript-expansion.ts](file://lib/ai/transcript-expansion.ts#L32-L130)
- [cerebras-service.ts](file://lib/ai/cerebras-service.ts#L31-L60)