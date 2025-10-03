#!/bin/bash

# 检查音频播放问题的诊断脚本

set -e

SERVER="ubuntu@49.234.30.246"
PORT="60022"
PROJECT_DIR="~/english-listening-trainer"

echo "🔍 诊断音频播放问题..."
echo ""

echo "1️⃣ 检查生成的音频文件..."
ssh -p $PORT $SERVER "cd $PROJECT_DIR && ls -lh public/*.wav 2>/dev/null | tail -5 || echo '❌ 没有找到音频文件'"
echo ""

echo "2️⃣ 检查最新音频文件的详细信息..."
ssh -p $PORT $SERVER "cd $PROJECT_DIR && file public/*.wav 2>/dev/null | tail -1 || echo '❌ 无法检查文件类型'"
echo ""

echo "3️⃣ 检查 TTS 服务状态..."
ssh -p $PORT $SERVER "cd $PROJECT_DIR && docker compose -f docker-compose.gpu.yml logs app 2>&1 | grep -i 'tts\|audio\|kokoro' | tail -20"
echo ""

echo "4️⃣ 测试 TTS API 端点..."
ssh -p $PORT $SERVER 'curl -s -X POST http://localhost:3000/api/tts -H "Content-Type: application/json" -d "{\"text\":\"Hello world\",\"speed\":1.0,\"language\":\"en-US\"}" | jq .'
echo ""

echo "5️⃣ 检查音频文件权限..."
ssh -p $PORT $SERVER "cd $PROJECT_DIR && ls -la public/*.wav 2>/dev/null | tail -3 || echo '❌ 没有音频文件'"
echo ""

echo "6️⃣ 检查 public 目录挂载..."
ssh -p $PORT $SERVER "cd $PROJECT_DIR && docker compose -f docker-compose.gpu.yml exec app ls -la /app/public/*.wav 2>/dev/null | tail -3 || echo '⚠️  容器内没有音频文件'"
echo ""

echo "7️⃣ 检查 Nginx/反向代理配置（如果有）..."
ssh -p $PORT $SERVER "curl -I http://localhost:3000/tts_audio_1759466252673.wav 2>&1 | head -10 || echo '⚠️  无法访问音频文件'"
echo ""

echo "✅ 诊断完成"
echo ""
echo "📋 常见问题:"
echo "  - 如果没有音频文件: TTS 服务可能未正常工作"
echo "  - 如果文件存在但无法访问: 检查文件权限和路径"
echo "  - 如果 API 返回错误: 查看详细日志 ./scripts/remote-logs.sh"
echo "  - 如果音频格式不正确: 可能是编码问题"
