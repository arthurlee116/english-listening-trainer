#!/bin/bash
# 快速切换 Kokoro HuggingFace 模式（在线/离线）

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.production"

MODE="${1:-status}"

update_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"

  [[ -f "$file" ]] || return 0

  if grep -q "^${key}=" "$file"; then
    perl -0pi -e "s/^${key}=.*/${key}=${value}/m" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

print_status() {
  echo "📄 当前模式配置:"
  if [[ -f "$ENV_FILE" ]]; then
    grep -E "^(HF_HUB_OFFLINE|TRANSFORMERS_OFFLINE|HF_DATASETS_OFFLINE|KOKORO_OFFLINE)=" "$ENV_FILE" || echo "(未在 .env.production 中设置)"
  else
    echo "⚠️ 找不到 $ENV_FILE"
  fi
  echo ""
  echo "💡 使用示例:"
  echo "   ./scripts/kokoro-switch-mode.sh online"
  echo "   ./scripts/kokoro-switch-mode.sh offline"
}

case "$MODE" in
  online)
    echo "🌐 切换到在线模式 (允许通过代理下载 HuggingFace 文件)"
    update_env_var "$ENV_FILE" "KOKORO_OFFLINE" "0"
    update_env_var "$ENV_FILE" "HF_HUB_OFFLINE" "0"
    update_env_var "$ENV_FILE" "TRANSFORMERS_OFFLINE" "0"
    update_env_var "$ENV_FILE" "HF_DATASETS_OFFLINE" "0"
    ;;
  offline)
    echo "📴 切换到离线模式 (仅使用本地缓存)"
    update_env_var "$ENV_FILE" "KOKORO_OFFLINE" "1"
    update_env_var "$ENV_FILE" "HF_HUB_OFFLINE" "1"
    update_env_var "$ENV_FILE" "TRANSFORMERS_OFFLINE" "1"
    update_env_var "$ENV_FILE" "HF_DATASETS_OFFLINE" "1"
    ;;
  status)
    print_status
    exit 0
    ;;
  *)
    echo "❌ 未知模式: $MODE"
    echo "用法: $0 [online|offline|status]"
    exit 1
    ;;
esac

echo ""
print_status

echo "🚀 下一步:"
echo "   1. docker compose -f docker-compose.gpu.yml restart app"
echo "   2. 观察 Kokoro GPU 日志确认模式生效"
