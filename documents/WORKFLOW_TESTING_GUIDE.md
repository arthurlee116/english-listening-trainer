# Workflow 测试指南

> 面向需要验证 CI 工作流（预热与主构建）的开发者与运维。涵盖触发方式、日志检查、缓存命中验证步骤。

## 1. 总览
- **预热工作流**：`.github/workflows/prewarm-deps.yml`
- **主构建工作流**：`.github/workflows/build-and-push.yml`
- **目标**：确保 base/python/node 依赖缓存层持续可用，builder 层按需刷新，构建时长保持在路线图目标内。

## 2. 预热 Workflow 测试步骤
1. **手动触发**：进入 GitHub Actions → 选择 `Prewarm dependency caches` → 点击 `Run workflow`。
   - 可选输入：`cache_quarter`（默认 `2025Q4`）。
2. **监控执行**：
   - `prewarm-base` → `prewarm-python` → `prewarm-node` → `summary` 共 4 个 job。
   - 每个 job 起始会输出磁盘空间信息（`df -h`），可确认是否 ≥4GB。
3. **日志检查**：
   - 重点关注 `docker buildx build` 阶段的 `#X exporting to image` 日志是否包含 `cache-base`/`cache-python`/`cache-node`。
   - 若出现 `ERROR: failed to solve`，根据错误信息排查（常见：磁盘不足、GHCR 权限）。
4. **Summary 验证**：
   - 表格中列出滚动标签与季度标签。
   - “使用指南”段落需提示主 workflow 依赖 `cache-*` 标签。
5. **产物验证**：
   - 本地运行：
     ```bash
     docker buildx imagetools inspect ghcr.io/arthurlee116/english-listening-trainer:cache-python
     docker buildx imagetools inspect ghcr.io/arthurlee116/english-listening-trainer:cache-node
     ```
   - 确认 manifest 存在，`size` 与历史记录一致。

## 3. 主构建 Workflow 测试步骤
1. **触发方式**：
   - 推送到主分支或 `workflow_dispatch` 手动触发（可设定 `rebuild-cache`、`rebuild-deps-cache` 输入）。
2. **磁盘检查**：
   - `Prepare disk` 步骤输出 `df -h`；若 `<4G`，workflow 将失败并提示“Insufficient free space”。
3. **构建日志捕获**：
   - `Build runtime image` 步骤使用 `--progress plain | tee build.log`；确保日志上传为 artifact（若未启用 artifact，可在本地下载）。
4. **缓存命中验证**：
   - 在 `Report cache hit statistics` 步骤中查看 Summary：
     - 显示 `CACHED 行数：XX`。
     - 若 `rebuild-cache=true`，Summary 会说明仅跳过 `cache-builder`。
   - 期望 base/python/node 大量 `CACHED` 命中，仅 builder 层需要重新编译。
5. **镜像推送**：
   - 日志应包含 `Successfully pushed ghcr.io/...:runtime-<sha>` 与 `cache-builder` 推送确认。
6. **耗时评估**：
   - 在 workflow 运行页查看总耗时，记录于 `workflow-snapshots/ci-runtime-snapshot.md`。

## 4. GHCR 标签校验
- 预热后执行：
  ```bash
  docker buildx imagetools inspect ghcr.io/arthurlee116/english-listening-trainer:cache-base
  docker buildx imagetools inspect ghcr.io/arthurlee116/english-listening-trainer:cache-python
  docker buildx imagetools inspect ghcr.io/arthurlee116/english-listening-trainer:cache-node
  ```
- 主构建后执行：
  ```bash
  docker buildx imagetools inspect ghcr.io/arthurlee116/english-listening-trainer:cache-builder
  docker buildx imagetools inspect ghcr.io/arthurlee116/english-listening-trainer:runtime-<sha>
  ```
- 检查结果中的 `digest`、`size`、`mediaType` 与预期是否一致。

## 5. Summary 报告阅读指南
- 预热 Summary：
  - **缓存标签表格**：确认滚动与季度标签都被更新。
  - **使用指南**：包含触发主 workflow 前的注意事项。
  - **下一步建议**：若构建失败，应有“重新运行”或“检查磁盘”的提醒。
- 主 workflow Summary：
  - **🎯 缓存命中情况**：`CACHED` 行数统计。
  - **磁盘状态**：输出 `df -h` 的关键行。
  - **提醒**：若 `rebuild-deps-cache=true`，Summary 会提示同时运行预热 workflow。

## 6. 缓存命中率验证方法
1. **日志统计**：
   ```bash
   grep "CACHED" build.log | wc -l
   grep " =>" build.log | wc -l
   ```
   - 命中率 ≈ `CACHED 行数 / 总阶段数`。
2. **对比运行**：
   - 正常运行：命中率 > 90%。
   - 当 `requirements.txt` 更新后：第一次构建命中率下降（Python 层重建），记录在快照中。
3. **记录表**：在 `workflow-snapshots/ci-runtime-snapshot.md` 中新增条目，包含：运行时间、命中率、耗时、触发人。

## 7. 常见故障场景
| 场景 | 现象 | 排查 | 解决 |
| --- | --- | --- | --- |
| GHCR 登录失败 | 构建日志 `unauthorized: access to the requested resource is not authorized` | 检查 `GITHUB_TOKEN` 权限是否包含 `packages: write` | 在仓库设置 → Actions → General 中启用 `Read and write permissions` |
| 磁盘不足 | `No space left on device` | 查看 `df -h`，确认 `/home/runner/work` 是否低于 4GB | 清理旧的 node_modules、启用 `actions/cache` 清理；必要时切换到 `ubuntu-24.04` runner |
| 缓存 miss | Summary 中 `CACHED 行数` 明显降低 | 检查 GHCR 标签是否存在；核对依赖文件是否更新 | 重新运行预热 workflow 或更新 `cache_quarter` |
| Builder 推送失败 | `blob upload unknown` | GHCR 网络波动 | 重试 workflow；若多次失败，联系 GitHub 支持 |

## 8. 变更记录
- 2025-10-07：首版文档，覆盖预热与主 workflow 测试步骤、Summary 阅读与命中率计算方法。

> 如需补充新的测试用例或脚本，请在提交前更新本指南并通知 CI 负责人。
