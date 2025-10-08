# CI / Docker 缓存优化与部署加速路线图

## 目标
- **缩短构建时间**：代码改动场景控制在 5~8 分钟内完成 CI；依赖更新时控制在 15 分钟内。
- **降低网络传输**：让远程部署机拉取镜像时只下载业务层（<300 MB），避免重复传输 3~4 GB 的依赖层。
- **提升可靠性**：避免缓存命中失败导致的磁盘爆满，确保构建流程有清晰的预热/刷新机制。
- **明确责任分层**：区分基础镜像维护、依赖缓存刷新、业务镜像构建三类任务，便于协同。

## 现状诊断
1. **Runner 空间不足**：`ubuntu-latest` 仅约 14 GB 可用，当前 workflow 同时使用 `actions/cache` 和 registry cache，解包大缓存时容易触发 `No space left on device`。
2. **缓存 key 不稳定**：`actions/cache` 的 key 绑定 `github.sha`，几乎没有跨运行命中；registry 也只用一个 `:buildcache` 标签，任意阶段失效会导致整体重构。
3. **基础镜像外部下载**：Dockerfile 直接 `FROM nvidia/cuda:...`，每次构建和部署都需从 Docker Hub 拉取 2~3 GB 的层。
4. **部署端重复下载**：远程服务器缺乏层级缓存预热，拉取新镜像时需重复传输 PyTorch / npm 等大依赖，速度瓶颈明显。
5. **缺乏缓存刷新策略**：当依赖变更或缓存损坏时，没有明确的“强制更新”流程，常常通过手动删库重下解决，效率低。

## 方案概览
```
┌─────────────────────────────┐
│   预热工作流 (手动 / 定时)   │
│  - 构建 base/python/node    │
│  - 推送到 GHCR cache-*      │
└──────────────┬──────────────┘
               │cache-from
     ┌─────────▼─────────┐
     │ 主构建工作流       │
     │  - 使用 cache-*    │
     │  - 构建 builder    │
     │  - 推送 runtime    │
     └─────────┬─────────┘
               │docker pull
     ┌─────────▼─────────┐
     │ 部署/测试服务器    │
     │  - 预拉缓存层      │
     │  - 拉取 runtime    │
     │  - 仅更新业务层    │
     └───────────────────┘
```

## 行动步骤

### 1. 基础镜像内刊化 ✅ 已完成（2025-10-07）
- **任务**：在本地或专用 workflow 中执行：
  ```bash
  docker pull nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04
  docker tag nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04 \
    ghcr.io/arthurlee116/base-images/cuda:12.1.1-cudnn8-runtime-ubuntu22.04
  docker push ghcr.io/arthurlee116/base-images/cuda:12.1.1-cudnn8-runtime-ubuntu22.04
  ```
- **Dockerfile 调整**：
  ```dockerfile
  FROM ghcr.io/arthurlee116/base-images/cuda:12.1.1-cudnn8-runtime-ubuntu22.04
  ```
- **好处**：
  - 固定 digest，避免 CI/远程机重复下载基础层。
  - GHCR 内的镜像可配合 `cache-from` 命中。
- **执行记录**：
  - 时间：2025-10-07
  - Digest: `sha256:b2c52e5236a0cb72d88444dca87eaf69c8e79836b875f20ad58f4b65c12faa34`
  - 大小：3.38GB
  - cuDNN 版本：`libcudnn8 8.9.0.131-1+cuda12.1` ✅
  - 更新文件：`Dockerfile`, `Dockerfile.optimized`
  - 远程服务器：配置 Docker 镜像加速器（daocloud, 1panel, dockerproxy）
- **重要修复**：
  - 初始推送标签缺少 `cudnn8` 版本号（仅 `cudnn-runtime`）
  - 修正为 `12.1.1-cudnn8-runtime-ubuntu22.04` 保留明确版本号
  - **风险说明**：PyTorch/TensorFlow 依赖 `libcudnn.so.8`，若使用 cuDNN9 会导致符号缺失
  - **验证方法**：`docker run --rm <image> dpkg -l | grep cudnn` 确认 libcudnn8 存在

### 2. 新建"依赖缓存预热"工作流 ✅ 已完成（2025-10-07）
- **文件**：`.github/workflows/prewarm-deps.yml`（280 行）
- **触发方式**：`workflow_dispatch` + 每周一凌晨 2 点 UTC。
- **步骤**：
  1. 清理磁盘（保留必要目录），检查可用空间 ≥4GB。
  2. 设置 Buildx。
  3. 构建并推送以下目标：
     - `prewarm-base`: 构建 `base` stage → 推送 `cache-base` + `cache-base-2025Q4`
     - `prewarm-python`: 从 `cache-base` 构建 `python-deps` → 推送 `cache-python` + `cache-python-2025Q4`
     - `prewarm-node`: 从 `cache-base` + `cache-python` 构建 `node-deps` → 推送 `cache-node` + `cache-node-2025Q4`
  4. 独立 summary job 生成汇总报告（标签表格 + 使用指南）。
- **关键决策**：
  - 季度标签固定为 `2025Q4`（手动更新策略）
  - **不推送 builder 缓存**（体积控制，避免业务代码变化导致无效缓存）
- **执行记录**：
  - 时间：2025-10-07
  - Run 链接：待首次执行后填写
  - 标签验证：待确认

### 3. 调整主构建工作流 (`build-and-push.yml`) ✅ 已完成（2025-10-07）
- **核心结果**：
  - `actions/cache` 与 `/tmp/.buildx-cache` 逻辑全部移除，统一依赖 GHCR 多级缓存链。
  - `cache-from` 依次引用 `cache-base` → `cache-python` → `cache-node` → `cache-builder`；`cache-to` 仅推送 `cache-builder`（zstd 压缩）。
  - 通过 `docker buildx build`（`--progress plain` + `tee build.log`）记录完整日志，Summary 输出 `CACHED` 命中行数。
  - 在构建前执行 `df -h` 与 4 GB 阈值校验，空间不足时立即失败。
  - `workflow_dispatch` 新增 `rebuild-deps-cache` 输入，用于提醒手动触发预热 workflow 刷新依赖层。
  - `rebuild-cache` 描述更新为“仅重建 builder cache”，并在执行时跳过 `cache-builder` 的 `cache-from` 引用，确保 base/python/node 层仍能命中缓存。

### 4. 远程服务器缓存预热
- **一次性执行**：
  ```bash
  docker pull ghcr.io/arthurlee116/base-images/cuda:12.1.1-cudnn-runtime-ubuntu22.04
  docker pull ghcr.io/arthurlee116/english-listening-trainer:cache-python
  docker pull ghcr.io/arthurlee116/english-listening-trainer:cache-node
  ```
- **部署脚本调整**：
  - 在每次部署前先 `docker pull` 上述 cache 镜像，再 `docker pull` 最新 runtime。
  - 部署后避免 `docker system prune -a`，只清理旧 runtime 标签 (`:sha-xxxx`)。
  - 记录 `docker images --digests`，确认 layer 未被意外清除。

### 5. 缓存刷新策略
- **手动刷新**：
  - 当 `Dockerfile` 或 `requirements.txt`/`package-lock.json` 变更时，运行“依赖预热” workflow 手动刷新。
  - 如果缓存损坏，可删除对应 GHCR 标签（`cache-python` 等），再重新运行预热。
- **版本管理**：
  - 可按季度将 `cache-python` 复制为 `cache-python-2025Q2` 留存旧版本，确保回滚能力。
  - 文档化“如何强制全量构建”：在主 workflow 中设置 `inputs.rebuild-cache=true` + 手动清理远端 cache。

### 6. 监控与反馈
- **CI 日志**：统计 `CACHED` vs `RUN` 数量，写入 `GITHUB_STEP_SUMMARY`。
- **部署日志**：在脚本中 output `docker pull` 的 layer 状态，出现 `Layer already exists` 说明命中成功。
- **磁盘告警**：在 workflow 中检测 `df -h`，低于 4 GB 时报错，提醒处理。

## 风险与缓解
| 风险 | 影响 | 缓解措施 |
| --- | --- | --- |
| GHCR 未配置权限 | 无法推送缓存镜像 | 确认 `packages: write` 权限，必要时使用 PAT |
| 缓存标签体积失控 | 占用仓库配额 | 定期 `docker buildx imagetools inspect` + 删除老旧标签 |
| 远程机手动清理缓存镜像 | 下次拉取回到慢速 | 部署脚本中增加检查/预热；文档强调禁止 `prune -a` |
| CUDA 基础镜像升级 | 需同步更新 | 通过路线图明确：更新时先复制新版本到 GHCR，再修改 Dockerfile |

## 验收标准
- 主构建工作流在代码变更场景下时间 ≤ 8 分钟，日志中显示核心阶段 `CACHED`。
- 远程部署脚本执行 `docker pull` 时，大多数层显示 `Layer already exists`，总下载量 < 500 MB。
- 依赖预热 workflow 运行成功后，GHCR 中存在 `cache-base/cache-python/cache-node` 标签，`docker buildx imagetools inspect` 显示层大小与预期匹配。
- 准备好的文档更新到 `documents/WORKFLOW_TESTING_GUIDE.md` 或新指南，让协作者懂得如何使用与刷新缓存。

## 后续拓展
- 将预热 workflow 中的步骤扩展为“构建后自动运行 TTS CLI 自检”（引用 TTS 路线图中的脚本），实现端到端健康检查。
- 引入构建指标上报，例如把构建时长、缓存命中率写入 GitHub Actions 输出，后续可接入仪表板。
- 若未来需要多架构（如 `linux/arm64`），可按相同策略分别维护 `cache-base-arm64` 等标签；预热 workflow 增加 matrix 支援。
