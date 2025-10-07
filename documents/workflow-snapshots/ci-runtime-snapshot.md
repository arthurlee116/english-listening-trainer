# CI Runtime 快照

## Phase 1 基线数据（2025-10-07）

### 基础镜像切换
- **操作时间**：2025-10-07
- **基础镜像**：
  - 切换前：`nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04`（Docker Hub 外部源）
  - 切换后：`ghcr.io/arthurlee116/base-images/cuda:12.1.1-cudnn-runtime-ubuntu22.04`（GHCR 内刊镜像）
  - Digest: `sha256:b2c52e5236a0cb72d88444dca87eaf69c8e79836b875f20ad58f4b65c12faa34`
  - 大小：3.38GB
- **预期影响**：
  - CI 构建时不再从 Docker Hub 拉取基础镜像，改用 GHCR（同源缓存更高效）
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
