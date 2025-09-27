# 错题本 AI 分析实现说明

## 1. 功能概述
- 练习结束后，对每道错题并行发送到 AI 服务生成详细中文解析。
- 错题本页面默认折叠“AI 解析”卡片，点击“展开/收起 AI 解析”查看结果。
- 失败可重试；顶部新增“一键全部解析”按钮，批量处理所有未解析错题。
- 支持导出解析为 `.txt` 文件，并将所有练习/解析数据存入数据库，支持多端同步。
- 历史 localStorage 数据在应用加载时自动上报至后端，默认不触发解析，待用户点击后再生成。

## 2. 数据库设计（Prisma）
修改 `prisma/schema.prisma`：

```prisma
model PracticeSession {
  id          String             @id @default(cuid())
  userId      String
  topic       String
  difficulty  String
  language    String
  transcript  String
  score       Int?
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  questions   PracticeQuestion[]
}

model PracticeQuestion {
  id                 String            @id @default(cuid())
  sessionId          String
  session            PracticeSession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  index              Int
  type               String
  question           String
  options            Json?
  correctAnswer      String
  explanation        String?
  transcriptSnapshot String?
  createdAt          DateTime          @default(now())
  answers            PracticeAnswer[]
}

model PracticeAnswer {
  id                     String            @id @default(cuid())
  questionId             String
  question               PracticeQuestion  @relation(fields: [questionId], references: [id], onDelete: Cascade)
  userAnswer             String
  isCorrect              Boolean
  attemptedAt            DateTime          @default(now())
  aiAnalysis             Json?
  aiAnalysisGeneratedAt  DateTime?
  tags                   String[]          @default([])
  needsAnalysis          Boolean           @default(true)
}
```

> 运行 `npx prisma migrate dev --name add_wrong_answer_ai` 并更新客户端。

## 3. 后端 API
1. `POST /api/practice/import-legacy`
   - 由前端在应用加载时上传 localStorage 数据。
   - 请求体示例：
     ```json
     {
       "sessions": [
         {
           "sessionId": "string",
           "topic": "string",
           "difficulty": "B2",
           "language": "en",
           "transcript": "全文",
           "score": 82,
           "createdAt": "2024-05-01T12:00:00Z",
           "questions": [
             {
               "index": 0,
               "type": "multiple_choice",
               "question": "题干文本",
               "options": ["A", "B", "C"],
               "correctAnswer": "B",
               "explanation": "可选",
               "answers": [
                 {
                   "userAnswer": "A",
                   "isCorrect": false,
                   "attemptedAt": "2024-05-01T12:01:00Z"
                 }
               ]
             }
           ]
         }
       ]
     }
     ```
   - 后端写入三张表，`needsAnalysis` 设为 `true`，不触发 AI。

2. `POST /api/ai/wrong-answers/analyze`
   - 单题解析接口，接收：
     ```json
     {
       "questionId": "PracticeQuestion.id",
       "answerId": "PracticeAnswer.id",
       "questionType": "multiple_choice",
       "question": "题干",
       "options": ["A", "B", "C"],
       "userAnswer": "A",
       "correctAnswer": "B",
       "transcript": "全文",
       "exerciseTopic": "Travel",
       "exerciseDifficulty": "B2",
       "language": "en",
       "attemptedAt": "2024-05-01T12:01:00Z"
     }
     ```
   - 后端通过 Cerebras API（经代理）构造 prompt，要求模型返回 JSON，成功解析后写入 `aiAnalysis` 与 `aiAnalysisGeneratedAt`，返回相同 JSON。

3. `POST /api/ai/wrong-answers/analyze-batch`
   - 请求体：`{ "answerIds": ["id1", "id2", ...] }`
   - 后端批量并发（<=100）调用单题 API，返回 `{ "success": [...], "failed": [...] }`。

4. `GET /api/wrong-answers/list`
   - 返回当前用户所有错题（问题 + 答案 + session 元信息 + aiAnalysis）。

## 4. AI Prompt 与输出要求
- Prompt 必须说明：将题干、选项、正确答案、用户答案、听力全文提供给模型，请模型扮演听力教练，分析错误原因、涉及的能力点、关键信号词、作答策略等。
- **禁止** 输出 Markdown 或额外文本，必须返回纯 JSON。你可以参考当前对指定 AI 生成 JSON 的实现，参考其结构化输出功能。 
- 目标 JSON Schema：
  ```json
  {
    "analysis": "详尽中文解析（>=150字）",
    "key_reason": "简述错误原因",
    "ability_tags": ["听力细节捕捉", "推理判断"],
    "signal_words": ["关键提示词1", "关键提示词2"],
    "strategy": "题型作答策略",
    "related_sentences": [
      { "quote": "文章原句片段", "comment": "与答案的关系" }
    ],
    "confidence": "high|medium|low"
  }
  ```
- 后端保存时可额外写入 `generated_at`。

## 5. 前端改动
1. **数据获取**：错题本加载时调用 `GET /api/wrong-answers/list`，按 session → question → answer 结构渲染。
2. **工具栏**：顶部新增两个按钮：
   - “一键全部解析”：点击弹出确认对话框（提示"确定生成全部未解析错题的 AI 解析？"），确认后调用 batch API，显示全局进度提示。
   - “导出解析为 TXT”：生成文本文件，内容包含导出时间、每题标题（Topic/难度/题型/日期）、题干、用户答案、正确答案、AI 解析等。
3. **错题卡**：在现有卡片内新增“AI 解析”折叠区：
   - 默认折叠，按钮文字“展开 AI 解析 / 收起 AI 解析”。
   - 状态：
     - `needsAnalysis=true` 且无请求进行：显示 “AI 解析尚未生成” + “生成解析”按钮。
     - 正在请求：显示 Loading 提示。
     - 请求失败：显示错误消息 + “重试”按钮。
     - 请求成功：根据 JSON 字段渲染段落/列表（analysis、key_reason、ability_tags、signal_words、strategy、related_sentences、confidence）。
4. **并发控制**：前端调用批量/单题接口时使用 `p-limit` 限制 100 并发；请求队列完成后刷新列表。
5. **历史迁移**：应用启动时检测本地 `getHistory()` 数据，若存在则 POST 至 `/api/practice/import-legacy` 并清空 localStorage。

## 6. 代理与环境变量
- 本地开发：`http://127.0.0.1:7890`。
- 生产代理地址参考现有 `lib/ai-service.ts`/`.env.production`，在新 API 中复用同样逻辑（优先 `CEREBRAS_PROXY_URL`）。

## 7. 错题导出 TXT 示例
```
错题本导出 - 2024-05-01 21:30

[题目1] Travel / B2 / multiple_choice / 2024-05-01
题干：...
你的答案：...
正确答案：...
AI 解析：
...analysis 文本...
关键信号词：关键提示词1, 关键提示词2
解题策略：...
相关句子：
- "文章原句片段" —— 与答案的关系

[题目2] ...
```

## 8. 测试与文档
- 编写后端单元测试验证 JSON 解析与数据库写入。
- 更新 `AGENTS.md` / `CLAUDE.md` 说明新的错题本流程与 API。
- 确保 `npm run lint`、`npm test -- --run` 通过。
