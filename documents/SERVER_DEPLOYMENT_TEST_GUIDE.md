# 服务器部署与缓存预热指南

> 适用场景：首次部署、季度缓存切换、CI 构建完成后的验收测试。

## 1. 环境准备
- 目标服务器：`ubuntu@49.234.30.246:60022`。
- 确保服务器已配置 Docker 镜像加速器（Phase 1 已完成：daocloud、1panel、dockerproxy）。
- 建议预先创建 `/opt/elt-cache/` 目录用于记录缓存状态。

## 2. 首次部署前的缓存预热（一次性）
```bash
ssh -p 60022 ubuntu@49.234.30.246

# 登录后执行
sudo docker login ghcr.io -u <GITHUB_USERNAME>

# 预热基础层
sudo docker pull ghcr.io/arthurlee116/base-images/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

# 预热依赖缓存
sudo docker pull ghcr.io/arthurlee116/english-listening-trainer:cache-python
sudo docker pull ghcr.io/arthurlee116/english-listening-trainer:cache-node
```

- **验证**：
  ```bash
  sudo docker images --digests | grep 'english-listening-trainer' | sort
  ```
  确认 `cache-python`、`cache-node` 均存在并显示 `Layer already exists`。

## 3. 日常部署流程建议
1. **同步依赖层**：
   ```bash
   sudo docker pull ghcr.io/arthurlee116/english-listening-trainer:cache-python
   sudo docker pull ghcr.io/arthurlee116/english-listening-trainer:cache-node
   ```
2. **拉取最新运行时镜像**：
   ```bash
   sudo docker pull ghcr.io/arthurlee116/english-listening-trainer:runtime-<git-sha>
   ```
3. **启动/更新服务**（示例）：
   ```bash
   sudo docker compose -f docker-compose.production.yml up -d --pull never
   ```
4. **健康检查**：访问 `/health` API 或执行 `npm run admin status`（按内部流程）。

> **禁止执行**：`docker system prune -a` 或删除 cache-* 标签，否则下次部署会重新下载 3~4 GB 依赖层。

## 4. 季度切换与缓存刷新
- 当预热 workflow 切换至新季度标签（例如 `2026Q1`）后：
  1. 在服务器上执行：
     ```bash
     sudo docker pull ghcr.io/arthurlee116/english-listening-trainer:cache-python-2026Q1
     sudo docker pull ghcr.io/arthurlee116/english-listening-trainer:cache-node-2026Q1
     ```
  2. 若磁盘空间有限，可保留最新季度与滚动标签，删除上一季度旧标签：
     ```bash
     sudo docker image rm ghcr.io/arthurlee116/english-listening-trainer:cache-node-2025Q4
     ```
  3. 记录变更：在 `/opt/elt-cache/CHANGELOG.md`（自建文件）中记下操作时间、执行人、保留标签。

## 5. 缓存验证清单
- [ ] `docker images --digests` 中存在 `cache-python`、`cache-node`、`runtime-<git-sha>`。
- [ ] 拉取运行时镜像时大部分层显示 `Layer already exists`。
- [ ] 服务启动日志未出现依赖下载超时。
- [ ] 若 builder 层大幅变化，确认主 workflow 已开启 `rebuild-cache` 并重新推送 runtime。

## 6. 常见问题与排查
| 问题 | 现象 | 排查步骤 |
| --- | --- | --- |
| 无法登录 GHCR | `Error response from daemon: unauthorized` | 检查 PAT 是否拥有 `read:packages` 权限；必要时重新登录。 |
| 拉取缓存层速度慢 | 下载速度 <2MB/s | 使用加速镜像源；如仍缓慢，确认服务器网络是否受限。 |
| 缓存层缺失 | `docker images` 无 `cache-python` | 重新执行预热命令；若标签被删除，通知 CI 团队重新推送。 |
| 部署后镜像体积过大 | `docker system df` 显示镜像占用 >20GB | 清理旧的 runtime 标签（保留 cache-*）；避免 prune -a。 |

## 7. 部署验证日志模板
```
[DATE] 部署摘要
- Runtime 标签：runtime-<git-sha>
- Cache 命中：python ✅ / node ✅
- `docker compose up` 输出：<简要摘要>
- 验证结果：访问 https://<domain>/health 返回 200
- 备注：<可选>
```

> 完成部署后，请将日志模板粘贴到内部记录系统或 Slack，确保所有人了解缓存状态。
