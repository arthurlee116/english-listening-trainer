# 会话启动清单（上下文加载模板）

> 用途：每次开启新会话或交接任务前，自行或要求执行 AI 按顺序确认以下项目。

## 1. 核心文档阅读确认
- [ ] `documents/project-status.md` —— 当前目标、阻塞项、下一步计划
- [ ] `documents/project-board.md` —— 自己负责的任务所在列
- [ ] 相关路线图：
  - [ ] `documents/future-roadmap/ci-docker-cache-roadmap.md`
  - [ ] `documents/future-roadmap/tts-refactor-roadmap.md`
  - [ ] 其他：________
- [ ] 工作流快照：
  - [ ] `documents/workflow-snapshots/ci-runtime-snapshot.md`
  - [ ] `documents/workflow-snapshots/deployment-prod-snapshot.md`
  - [ ] `documents/workflow-snapshots/tts-selftest-snapshot.md`
- [ ] 协作守则：`documents/future-roadmap/ai-collaboration-guidelines.md`

## 2. 现场状态速览（可手动补充）
- 最近一次 CI：________（run 链接 + 成功/失败）
- 最近部署：________（run/日志链接 + 结论）
- 当前阻塞：________
- 风险提示：________

## 3. 需要额外加载的材料
- GitHub issue / PR 链接：________
- 日志文件位置或下载方式：________
- 其他补充：________

## 4. 会话起始回应模板
执行 AI 在首条消息中应包含：
```
- 已阅读：<列出已确认的文档>
- 当前理解的目标：<摘要>
- 负责任务：<引用 project-board 条目>
- 最新状态：<CI/部署/阻塞情况>
- 需补充信息：<若缺资料，明确提出>
```

> 小提示：完成阅读后立即把关键结论写进首条回复；如某文档缺更新，请在回复中指出，以便双方同步修订。
