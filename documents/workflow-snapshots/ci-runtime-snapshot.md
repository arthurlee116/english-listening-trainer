# CI Runtime 快照

## Phase 1 基线数据（2025-10-07）

### 基础镜像切换
- **操作时间**：2025-10-07
- **基础镜像**：
  - 切换前：`nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04`（Docker Hub 外部源）
  - 切换后：`ghcr.io/arthurlee116/base-images/cuda:12.1.1-cudnn8-runtime-ubuntu22.04`（GHCR 内刊镜像）
  - Digest: `sha256:b2c52e5236a0cb72d88444dca87eaf69c8e79836b875f20ad58f4b65c12faa34`
  - 大小：3.38GB
  - cuDNN 版本：`libcudnn8 8.9.0.131-1+cuda12.1` ✅
- **关键修复**：
  - 初始标签 `12.1.1-cudnn-runtime` 缺少版本号，存在被 cuDNN9 覆盖风险
  - 修正为 `12.1.1-cudnn8-runtime` 保留明确版本号
  - 验证镜像内容：`dpkg -l | grep cudnn` 确认包含 libcudnn8
- **预期影响**：
  - CI 构建时不再从 Docker Hub 拉取基础镜像，改用 GHCR（同源缓存更高效）
  - cuDNN8 兼容性保证：PyTorch/TensorFlow 依赖 libcudnn.so.8 正常加载
  - 为 Phase 2 多级缓存奠定基础

### 最近 CI 执行（待填充）
- **最近执行**：待记录（示例：2025-10-07，workflow run https://github.com/.../runs/123456789）
- **结果**：待记录（成功/失败 + 耗时）
- **缓存命中情况**：
  - base：待验证
  - python：待验证
  - node：待验证
  - builder：待验证
- **关键日志**：
  - Build log 片段或链接（建议记录 `CACHED` 命中所在行）。
- **问题 & 备注**：
  - 例如：builder 缓存未命中，原因 `package-lock.json` 变更。
- **下一步动作**：
  - Phase 2: 创建依赖缓存预热 workflow

> 更新步骤：构建结束后复制 run 链接与摘要信息，按上述要点填写，耗时控制在 1 分钟内。

## Phase 3 主 workflow 缓存链切换（2025-10-07）

### Workflow 更新点
- `.github/workflows/build-and-push.yml` 使用多级 `cache-from`：`cache-base` → `cache-python` → `cache-node` → `cache-builder`
- `cache-to` 仅推送 `cache-builder`（zstd 压缩，保留业务层缓存）
- 移除本地 `/tmp/.buildx-cache` 及 `actions/cache`，改用 BuildKit 原生 registry 缓存
- 增加 `df -h` 空间快照与 4GB 阈值校验，失败时直接终止构建
- 构建日志通过 `tee build.log` 保存，Summary 汇总 `CACHED` 命中行数
- 新增 `workflow_dispatch.inputs.rebuild-deps-cache`，用于提醒同步触发 `prewarm-deps.yml`

### 最近运行（待填充）
- **运行时间**：待记录（例如：2025-10-07 18:30 UTC 推送触发）
- **Run 链接**：待记录（https://github.com/.../runs/...）
- **耗时**：待记录（目标 5-8 分钟内）
- **缓存命中统计**：
  - build.log 中 `CACHED` 行数：待记录
  - 总阶段记录行数：待记录
- **磁盘空间**：
  - 构建前：待记录（`df -h /home/runner/work`）
  - 构建后（可选）：待记录
- **是否触发依赖预热提醒**：待记录（如 workflow_dispatch 设置 `rebuild-deps-cache=true`）
- **问题 & 备注**：待记录（例如：builder cache miss 原因）

### 验证要点
- Summary 中出现“CACHED 行数”与“下一步建议”段落
- BuildKit 日志包含 `CACHED` 关键字（至少 base/python/node 任一命中）
- 构建耗时落在路线图目标区间
- 若空间不足（<4GB），workflow 应直接失败并提示错误

## Phase 2 预热工作流基线（2025-10-07）

### 工作流配置
- **文件路径**：`.github/workflows/prewarm-deps.yml`
- **触发方式**：
  - 定时：每周一 02:00 UTC（cron: `0 2 * * 1`）
  - 手动：workflow_dispatch（可指定 cache_quarter）
- **季度版本**：2025Q4（固定）
- **推送标签**：
  - 滚动标签：`cache-base`, `cache-python`, `cache-node`
  - 季度标签：`cache-base-2025Q4`, `cache-python-2025Q4`, `cache-node-2025Q4`

### 首次执行（待填充）
- **执行时间**：待记录（示例：2025-10-07 手动触发）
- **Run 链接**：待记录（https://github.com/.../runs/...）
- **执行结果**：
  - prewarm-base: ✅ / ❌ （耗时 X 分钟）
  - prewarm-python: ✅ / ❌ （耗时 X 分钟）
  - prewarm-node: ✅ / ❌ （耗时 X 分钟）
- **缓存层大小**（通过 `imagetools inspect` 获取）：
  - cache-base: 待记录（预期 ~3.4GB）
  - cache-python: 待记录（预期 ~1.5-2GB）
  - cache-node: 待记录（预期 ~500-800MB）
- **磁盘使用**：
  - 构建前：待记录（例如：12.5GB / 14GB）
  - 构建后：待记录（例如：8.2GB / 14GB）
- **问题 & 备注**：待记录

### 验证清单
- [ ] GHCR 中存在 6 个标签（3 个滚动 + 3 个季度）
- [ ] `docker buildx imagetools inspect` 显示层完整
- [ ] Summary 报告正确生成表格与指南
- [ ] 磁盘空间检查正常工作（无低于 4GB 告警）

> 更新步骤：首次运行后填写执行数据，记录任何异常情况。

## Phase 4 文档与运行手册交付（2025-10-07）

### 交付内容
- `documents/CACHE_MANAGEMENT_GUIDE.md`：覆盖缓存刷新策略、季度切换流程、旧标签清理与 GHCR 配额监控
- `documents/SERVER_DEPLOYMENT_TEST_GUIDE.md`：记录远程服务器预热步骤、部署清单、常见问题排查
- `documents/WORKFLOW_TESTING_GUIDE.md`：定义预热/主 workflow 验证、Summary 阅读、缓存命中率计算方法

### 验收要点
- 项目状态表、看板、路线图与本快照均已更新，标记 CI 缓存优化路线图完结
- 文档提供命令示例与记录模板，便于协作者快速执行与追踪
- 强调远程服务器禁止 `docker system prune -a`，保护 cache-* 层免于误删
