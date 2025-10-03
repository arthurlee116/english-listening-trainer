# 音频播放问题修复 - 部署指南

## 问题描述

音频文件已成功生成（显示时长 1:46），但无法播放。

## 根本原因

1. **缺少正确的 Content-Type headers** - Next.js 没有为 WAV 文件设置正确的 MIME 类型
2. **缺少 CORS headers** - 浏览器可能阻止跨域音频访问
3. **缺少 Accept-Ranges headers** - 音频播放器需要支持范围请求

## 解决方案

### 1. 添加音频文件 API 路由

创建了 `/api/audio/[filename]/route.ts`，专门用于提供音频文件，确保：
- 正确的 `Content-Type: audio/wav`
- CORS headers (`Access-Control-Allow-Origin: *`)
- 范围请求支持 (`Accept-Ranges: bytes`)
- 缓存控制

### 2. 更新 Next.js 配置

在 `next.config.mjs` 中添加了音频文件的 headers 配置。

### 3. 修改 TTS API 响应

TTS API 现在返回通过 API 路由的 URL (`/api/audio/filename.wav`) 而不是直接的静态文件路径。

## 部署步骤

### 方案 A：安全同步（推荐）

使用安全同步脚本，保护远程的 GPU/TTS 配置：

```bash
./scripts/safe-remote-sync.sh
```

这个脚本会：
1. 检查远程未提交的更改
2. 使用 `git stash` 保存远程更改
3. 拉取最新代码
4. 恢复 stash 的更改

### 方案 B：手动部署

如果你想手动控制每一步：

```bash
# 1. SSH 到服务器
ssh -p 60022 ubuntu@49.234.30.246

# 2. 进入项目目录
cd ~/english-listening-trainer

# 3. 保存当前更改
git stash push -m "Before audio fix deployment"

# 4. 拉取最新代码
git fetch origin
git pull origin feature/exercise-template

# 5. 恢复之前的更改（如果有冲突需要手动解决）
git stash pop

# 6. 重新构建并重启服务
docker compose -f docker-compose.gpu.yml down
docker compose -f docker-compose.gpu.yml build --no-cache
docker compose -f docker-compose.gpu.yml up -d

# 7. 查看日志
docker compose -f docker-compose.gpu.yml logs -f app
```

### 方案 C：使用现有脚本

```bash
# 重新构建并部署
./scripts/smart-rebuild.sh --force

# 或者只是重启
./scripts/remote-restart.sh
```

## 验证修复

### 1. 检查音频文件

```bash
./scripts/check-audio-issue.sh
```

### 2. 测试 API 端点

```bash
# 生成新的音频
curl -X POST http://49.234.30.246:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","speed":1.0,"language":"en-US"}'

# 访问音频文件（使用返回的 filename）
curl -I http://49.234.30.246:3000/api/audio/tts_audio_XXXXX.wav
```

### 3. 浏览器测试

1. 打开应用：http://49.234.30.246:3000
2. 生成新的听力材料
3. 点击"生成音频"
4. 点击播放按钮
5. 检查浏览器控制台是否有错误

## 预期结果

- ✅ 音频文件可以正常播放
- ✅ 浏览器控制台没有 CORS 错误
- ✅ 音频播放器显示正确的时长
- ✅ 可以拖动进度条
- ✅ 播放/暂停按钮正常工作

## 故障排除

### 问题 1：音频仍然无法播放

**检查：**
```bash
# 查看 Next.js 日志
./scripts/remote-logs.sh | grep -i "audio\|tts"

# 检查文件权限
ssh -p 60022 ubuntu@49.234.30.246 'ls -la ~/english-listening-trainer/public/*.wav'
```

**解决：**
- 确保 `public` 目录已正确挂载到 Docker 容器
- 检查文件权限（应该是 644 或更宽松）

### 问题 2：404 错误

**检查：**
```bash
# 测试 API 路由
curl -I http://49.234.30.246:3000/api/audio/tts_audio_1759466252673.wav
```

**解决：**
- 确保文件名正确
- 检查 Next.js 路由是否正确部署

### 问题 3：CORS 错误

**检查浏览器控制台：**
```
Access to audio at 'http://...' from origin 'http://...' has been blocked by CORS policy
```

**解决：**
- 确保 `next.config.mjs` 的 headers 配置已生效
- 重新构建 Docker 镜像

## 回滚计划

如果修复导致问题：

```bash
# SSH 到服务器
ssh -p 60022 ubuntu@49.234.30.246
cd ~/english-listening-trainer

# 回滚到之前的提交
git reset --hard HEAD~1

# 重新构建
docker compose -f docker-compose.gpu.yml down
docker compose -f docker-compose.gpu.yml build
docker compose -f docker-compose.gpu.yml up -d
```

## 相关文件

- `app/api/audio/[filename]/route.ts` - 新增的音频服务 API
- `app/api/tts/route.ts` - 修改了返回的 URL 格式
- `next.config.mjs` - 添加了音频文件的 headers
- `scripts/check-audio-issue.sh` - 音频问题诊断脚本
- `scripts/safe-remote-sync.sh` - 安全同步脚本

## 技术细节

### 为什么需要 API 路由？

直接提供静态文件时，Next.js 可能不会设置正确的 headers。通过 API 路由，我们可以：
1. 完全控制 HTTP headers
2. 添加安全检查（只允许访问特定文件）
3. 支持范围请求（音频播放器需要）
4. 添加日志和监控

### Content-Type 的重要性

浏览器根据 `Content-Type` header 来决定如何处理文件：
- `audio/wav` - 浏览器知道这是音频文件，可以播放
- `application/octet-stream` - 浏览器会下载文件而不是播放

### CORS 的作用

即使是同域请求，某些浏览器在处理媒体文件时也会检查 CORS headers。添加 `Access-Control-Allow-Origin: *` 确保所有情况下都能访问。

## 后续优化

1. **添加音频文件清理** - 定期删除旧的音频文件
2. **添加 CDN 支持** - 将音频文件上传到 CDN
3. **添加音频压缩** - 使用 MP3 或 Opus 格式减小文件大小
4. **添加流式传输** - 支持大文件的分块传输

## 联系信息

如有问题，请查看：
- 主要文档：`documents/TTS_ISSUE_ANALYSIS.md`
- 部署指南：`documents/DEPLOYMENT_GUIDE.md`
- 自动部署：`documents/AUTO_DEPLOY_GUIDE.md`
