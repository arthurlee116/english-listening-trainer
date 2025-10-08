# 缓存管理指南

> 适用范围：CI 预热工作流（`prewarm-deps.yml`）、主构建工作流（`build-and-push.yml`）以及远程服务器缓存维护。

## 1. 缓存刷新策略

### 1.1 定期刷新
- **频率**：预热工作流已配置每周一 02:00 UTC 自动执行。
- **任务链**：`prewarm-base` → `prewarm-python` → `prewarm-node` → `summary`。
- **监控**：Run 完成后检查 Summary，确认三个阶段均为 ✅，并核对缓存标签表格。

### 1.2 手动刷新
- 在以下场景触发 `prewarm-deps.yml` 的 `workflow_dispatch`：
  - 更新 `Dockerfile` 中的基础系统依赖。
  - 修改 `requirements.txt` 或 `package-lock.json`，导致 Python/Node 依赖变化。
  - GHCR 标签被手动删除或标记失效。
- **参数**：`cache_quarter`（默认 `2025Q4`），必要时可手动改为新季度标签。

## 2. 强制更新特定缓存层

| 层级 | 触发方式 | 操作步骤 |
| --- | --- | --- |
| Base | 手动运行 `prewarm-base` job（通过 workflow `Enable debug logging` 针对性重试） | 1. 在 `prewarm-deps.yml` 的手动触发页面启用 `base-only` 输入（未来可扩展）。<br>2. 如需立即执行，可在本地 `docker buildx build --target base --push`（确保登录 GHCR）。 |
| Python | 修改 `requirements.txt` 后手动运行预热 workflow | 1. 在 `workflow_dispatch` 备注中注明“Python deps refresh”。<br>2. 运行完成后，主 workflow 第一次构建会重新生成 builder 层。 |
| Node | 修改 `package.json`/`package-lock.json` 后运行预热 workflow | 1. 确认 npm 依赖已锁定，避免 cache miss。<br>2. Summary 中确认 `cache-node` 成功推送。 |
| Builder | 主 workflow 中将 `rebuild-cache` 设为 `true`，或手动删除 `cache-builder` 标签 | 1. `rebuild-cache=true` 会跳过 `cache-builder` 的 `cache-from` 引用，仅重建 builder 层。<br>2. 若要完全清空，可执行 `docker buildx imagetools rm ghcr.io/...:cache-builder` 后重新触发主 workflow。 |

> **注意**：主 workflow 的 `rebuild-cache=true` 不会影响 base/python/node 层，确保依赖缓存仍能命中。

## 3. 季度版本切换流程（示例：2025Q4 → 2026Q1）

1. **准备阶段**（当季度最后一次构建完成后）：
   - 在 GHCR 中复制现有标签：
     ```bash
     docker buildx imagetools create \
       ghcr.io/arthurlee116/english-listening-trainer:cache-base \
       --tag ghcr.io/arthurlee116/english-listening-trainer:cache-base-2025Q4
     ```
   - 确认 Python/Node 标签同样存在对应季度后缀。
2. **更新预热 workflow 输入**：
   - 在 `prewarm-deps.yml` 中调整默认 `cache_quarter: 2026Q1`（或触发时手动覆盖）。
   - 第一次运行时会同时推送滚动标签和新季度标签。
3. **更新文档**：
   - 更新本指南、`ci-docker-cache-roadmap.md` 与状态/看板，记录季度切换日期。
4. **验证**：
   - 通过 `docker buildx imagetools inspect ghcr.io/...:cache-base-2026Q1` 验证层大小。
   - 主 workflow 构建一次，确保命中 `cache-base` 与新季度标签一致。

## 4. 清理旧缓存标签

1. **确认无依赖**：确保没有旧分支或部署需要该标签。
2. **删除命令**：
   ```bash
   docker buildx imagetools rm ghcr.io/arthurlee116/english-listening-trainer:cache-python-2024Q4
   ```
3. **配额回收**：删除后等待 GHCR 后台完成垃圾回收（通常 <1 小时）。
4. **记录**：在 `workflow-snapshots/ci-runtime-snapshot.md` 备注删除日期与原因。

## 5. 缓存损坏恢复步骤

1. **症状识别**：
   - 主 workflow 构建日志中大量 `=> [stage] ...` 而非 `CACHED`。
   - Summary 提示依赖层命中率骤降。
2. **诊断流程**：
   - 使用 `docker buildx imagetools inspect ghcr.io/...:cache-python` 检查 manifest 是否存在。
   - 查看 GHCR 包页面，确认最近推送记录是否成功。
   - 检查预热 workflow run 日志，是否因磁盘不足或登录失败导致推送中断。
3. **恢复步骤**：
   - 若标签缺失：重新运行预热 workflow，必要时删除损坏标签后重试。
   - 若推送失败：排查 `GITHUB_TOKEN` 权限（需 packages: write），并确认磁盘检查已通过。
   - 若仍失败：在讨论中记录问题，联系仓库管理员手动推送或扩容配额。
4. **验证**：
   - 主 workflow 再次构建，确认 Summary 中 `CACHED` 行数恢复。

## 6. GHCR 配额监控

1. **查看仓库级使用量**：访问 https://github.com/orgs/arthurlee116/packages 并检查 `Storage` 标签。
2. **命令行巡检**：
   ```bash
   gh api orgs/arthurlee116/packages/container/english-listening-trainer/versions --paginate \
     --jq 'map({id, updated_at, tags})'
   ```
3. **阈值**：当存储使用率超过 80% 时，优先清理过期季度标签和旧 runtime 镜像。
4. **告警建议**：
   - 每月第一周运行一次 `gh api` 命令并记录结果。
   - 在 `project-status.md` 的“阻塞事项”中添加配额提醒。

## 7. 最佳实践速查

- **保持 Summary 记录**：每次预热/主构建后，将缓存命中情况写入快照文档，形成可追溯链路。
- **不要执行 `docker system prune -a`**：该命令会删除所有缓存层，远程机上特别危险。
- **季度切换时先复制再更新**：避免直接覆盖导致回滚困难。
- **遇到构建时间飙升先看日志**：统计 `CACHED` 行数是排查第一步。
- **需要全量刷新时**：清空 `cache-builder` + 触发预热 workflow，即可保留依赖层的同时重建业务层。

> 如发现新的问题或改进方案，请更新本指南并同步到路线图/快照文档。
