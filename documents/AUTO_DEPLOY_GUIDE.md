# 🤖 完全自动化部署指南

## 🚀 一键部署命令

### 完全自动化部署（推荐）

```bash
# 使用 -y 选项跳过所有确认提示
./scripts/remote-deploy-gpu.sh -y

# 或使用完整选项名
./scripts/remote-deploy-gpu.sh --yes
```

这个命令会：
- ✅ 自动检测并安装所有缺失的依赖
- ✅ 自动安装 Docker 和 Docker Compose
- ✅ 自动配置 GPU 支持
- ✅ 自动克隆或更新代码
- ✅ 自动构建和启动服务
- ✅ 跳过所有用户确认提示

---

## 📋 自动化模式说明

### 默认行为

脚本默认启用 `AUTO_INSTALL_DEPS=true`，会自动安装依赖，但仍会在关键步骤询问确认。

### 完全自动化模式

使用 `-y` 或 `--yes` 选项后：
- ❌ 不会询问是否继续（有未提交更改时）
- ❌ 不会询问是否安装依赖
- ❌ 不会询问是否克隆项目
- ❌ 不会询问是否开始部署
- ✅ 所有操作自动执行

---

## 🎯 使用场景

### 场景 1：CI/CD 自动部署

```bash
# 在 CI/CD 流水线中使用
./scripts/remote-deploy-gpu.sh --yes --skip-gpu-check
```

### 场景 2：首次全自动部署

```bash
# 首次部署，自动安装所有依赖
./scripts/remote-deploy-gpu.sh -y \
  --repo https://github.com/your-username/english-listening-trainer.git
```

### 场景 3：快速更新部署

```bash
# 快速更新，不询问任何问题
./scripts/remote-deploy-gpu.sh -y
```

### 场景 4：调试模式的自动部署

```bash
# 自动部署 + 详细日志
./scripts/remote-deploy-gpu.sh -y --debug
```

---

## ⚙️ 选项组合

### 完全自动化 + 跳过 GPU

```bash
# 适用于 CPU-only 服务器
./scripts/remote-deploy-gpu.sh -y --skip-gpu-check
```

### 完全自动化 + 不备份

```bash
# 快速部署，不创建备份
./scripts/remote-deploy-gpu.sh -y --no-backup
```

### 完全自动化 + 运行测试

```bash
# 部署前运行测试
./scripts/remote-deploy-gpu.sh -y --run-tests
```

### 完全自动化 + 指定分支

```bash
# 部署特定分支
./scripts/remote-deploy-gpu.sh -y --branch develop
```

---

## 🔄 自动化流程

### 完整流程（使用 -y）

```
开始
  ↓
检查本地环境
  ├── 有未提交更改 → 自动继续 ✅
  └── 无更改 → 继续
  ↓
测试 SSH 连接
  ↓
检测远程操作系统
  ├── Ubuntu → 自动识别 ✅
  ├── Debian → 自动识别 ✅
  ├── CentOS → 自动识别 ✅
  └── 未知 → 尝试通用方法 ✅
  ↓
检查依赖
  ├── Git 缺失 → 自动安装 ✅
  ├── Docker 缺失 → 自动安装 ✅
  ├── Python 缺失 → 自动安装 ✅
  └── espeak-ng 缺失 → 自动安装 ✅
  ↓
检查 GPU（如果未跳过）
  ├── 驱动缺失 → 自动安装 ✅
  └── Container Toolkit 缺失 → 自动安装 ✅
  ↓
检查项目目录
  ├── 不存在 → 自动克隆 ✅
  └── 已存在 → 自动更新 ✅
  ↓
推送本地代码
  ↓
在服务器上部署
  ├── 自动备份数据 ✅
  ├── 自动拉取代码 ✅
  ├── 自动设置 TTS ✅
  ├── 自动构建镜像 ✅
  ├── 自动运行迁移 ✅
  └── 自动启动服务 ✅
  ↓
验证部署
  ↓
完成 ✅
```

---

## 📊 对比：手动 vs 自动

| 操作 | 默认模式 | 自动模式 (-y) |
|------|----------|---------------|
| 未提交更改确认 | 询问 ❓ | 自动继续 ✅ |
| 安装依赖确认 | 询问 ❓ | 自动安装 ✅ |
| 克隆项目确认 | 询问 ❓ | 自动克隆 ✅ |
| 开始部署确认 | 询问 ❓ | 自动开始 ✅ |
| 切换分支确认 | 询问 ❓ | 自动切换 ✅ |
| **总交互次数** | **5+ 次** | **0 次** |

---

## 🛡️ 安全考虑

### 自动模式的风险

使用 `-y` 选项时：
- ⚠️ 会自动安装系统软件包（需要 sudo）
- ⚠️ 会自动修改 Docker 配置
- ⚠️ 会自动克隆/更新代码
- ⚠️ 会自动重启服务

### 建议

1. **首次部署**：先不使用 `-y`，了解每个步骤
2. **生产环境**：确保已在测试环境验证
3. **CI/CD**：使用 `-y` 实现完全自动化
4. **调试**：使用 `-y --debug` 查看详细日志

---

## 🔍 验证自动部署

### 部署后检查

```bash
# 1. 检查服务状态
ssh -p 60022 ubuntu@49.234.30.246 \
  'cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml ps'

# 2. 健康检查
curl http://49.234.30.246:3000/api/health

# 3. 查看日志
ssh -p 60022 ubuntu@49.234.30.246 \
  'cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml logs --tail=50'
```

---

## 📝 示例：完整的自动化部署脚本

### 创建自动化部署脚本

```bash
#!/bin/bash
# auto-deploy.sh - 完全自动化部署脚本

set -e

echo "=========================================="
echo "开始自动化部署"
echo "=========================================="

# 1. 提交代码
echo "提交本地更改..."
git add .
git commit -m "自动部署 $(date '+%Y-%m-%d %H:%M:%S')" || echo "无需提交"
git push origin main

# 2. 执行自动部署
echo "执行远程部署..."
./scripts/remote-deploy-gpu.sh -y

# 3. 验证部署
echo "验证部署..."
sleep 10
curl -f http://49.234.30.246:3000/api/health || {
  echo "健康检查失败"
  exit 1
}

echo "=========================================="
echo "部署成功完成！"
echo "=========================================="
echo "访问: http://49.234.30.246:3000"
```

### 使用方法

```bash
chmod +x auto-deploy.sh
./auto-deploy.sh
```

---

## 🎓 最佳实践

### 1. 首次使用

```bash
# 第一次：不使用 -y，了解流程
./scripts/remote-deploy-gpu.sh

# 第二次：使用 -y，体验自动化
./scripts/remote-deploy-gpu.sh -y
```

### 2. 定期部署

```bash
# 创建 cron 任务自动部署
0 2 * * * cd /path/to/project && ./scripts/remote-deploy-gpu.sh -y >> /var/log/auto-deploy.log 2>&1
```

### 3. 多环境部署

```bash
# 开发环境
./scripts/remote-deploy-gpu.sh -y --branch develop --host dev.example.com

# 生产环境
./scripts/remote-deploy-gpu.sh -y --branch main --host prod.example.com
```

---

## 🐛 故障排查

### 自动模式失败

如果自动部署失败：

1. **查看详细日志**：
```bash
./scripts/remote-deploy-gpu.sh -y --debug 2>&1 | tee deploy.log
```

2. **检查服务器状态**：
```bash
./scripts/test-remote-connection.sh
```

3. **手动模式重试**：
```bash
# 不使用 -y，逐步确认
./scripts/remote-deploy-gpu.sh
```

---

## 📚 相关文档

- [远程部署脚本指南](./REMOTE_DEPLOY_SCRIPT_GUIDE.md)
- [部署故障排查](./DEPLOYMENT_TROUBLESHOOTING.md)
- [快速参考](./DEPLOY_QUICK_REFERENCE.md)

---

## 🎯 总结

### 完全自动化部署命令

```bash
# 最简单的一键部署
./scripts/remote-deploy-gpu.sh -y
```

### 特点

- ✅ 零交互
- ✅ 自动安装依赖
- ✅ 自动配置环境
- ✅ 适合 CI/CD
- ✅ 节省时间

### 适用场景

- ✅ CI/CD 流水线
- ✅ 定时自动部署
- ✅ 快速迭代开发
- ✅ 批量服务器部署

---

**最后更新**：2025-02-10  
**版本**：1.0  
**状态**：✅ 生产就绪
