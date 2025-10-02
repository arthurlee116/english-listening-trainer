# 🚀 部署系统使用说明

## 快速开始

### 一键自动化部署

```bash
./scripts/remote-deploy-gpu.sh -y
```

就这么简单！脚本会自动完成所有操作。

---

## 📋 功能特性

- ✅ **完全自动化**：零用户交互
- ✅ **智能检测**：自动识别操作系统和环境
- ✅ **自动安装**：Docker, GPU, Python 等所有依赖
- ✅ **错误处理**：详细的错误提示和解决方案
- ✅ **调试支持**：完整的日志和诊断工具

---

## 🎯 使用场景

### 场景 1：首次部署到新服务器

```bash
./scripts/remote-deploy-gpu.sh -y \
  --repo https://github.com/your-username/english-listening-trainer.git
```

### 场景 2：日常更新部署

```bash
git add .
git commit -m "更新功能"
git push
./scripts/remote-deploy-gpu.sh -y
```

### 场景 3：调试部署问题

```bash
# 先测试环境
./scripts/test-remote-connection.sh

# 然后带调试信息部署
./scripts/remote-deploy-gpu.sh -y --debug
```

---

## 📚 文档

| 文档 | 说明 |
|------|------|
| [完成总结](./DEPLOYMENT_COMPLETE_SUMMARY.md) | 系统概述和功能说明 |
| [自动部署指南](./AUTO_DEPLOY_GUIDE.md) | 完全自动化部署详解 |
| [快速参考](./DEPLOY_QUICK_REFERENCE.md) | 常用命令速查 |
| [故障排查](./DEPLOYMENT_TROUBLESHOOTING.md) | 问题解决方案 |

---

## 🛠️ 常用命令

```bash
# 完全自动化部署
./scripts/remote-deploy-gpu.sh -y

# 测试服务器环境
./scripts/test-remote-connection.sh

# 调试模式部署
./scripts/remote-deploy-gpu.sh -y --debug

# 跳过 GPU 检查
./scripts/remote-deploy-gpu.sh -y --skip-gpu-check

# 指定分支部署
./scripts/remote-deploy-gpu.sh -y --branch develop
```

---

## ✅ 验证部署

```bash
# 健康检查
curl http://49.234.30.246:3000/api/health

# 查看服务状态
ssh -p 60022 ubuntu@49.234.30.246 \
  'cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml ps'
```

---

## 📞 获取帮助

遇到问题？查看 [故障排查指南](./DEPLOYMENT_TROUBLESHOOTING.md)

---

**版本**：2.0  
**更新**：2025-02-10  
**状态**：✅ 生产就绪
