#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env.local}"

if [[ ! -f "${ENV_FILE}" ]]; then
  ENV_FILE="${ROOT_DIR}/.env"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "No .env.local or .env found. Set ENV_FILE to the correct path." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is not installed or not on PATH." >&2
  exit 1
fi

RG_AVAILABLE=true
if ! command -v rg >/dev/null 2>&1; then
  RG_AVAILABLE=false
fi

SECRETS=(
  CEREBRAS_API_KEY
  TOGETHER_API_KEY
  JWT_SECRET
  CEREBRAS_PROXY_URL
  TOGETHER_PROXY_URL
  HTTP_PROXY
  HTTPS_PROXY
  RSS_PROXY_URL
  RSS_USE_SYSTEM_PROXY
  ADMIN_DEMO_DATA
)

parse_env_value() {
  local raw="$1"
  raw="${raw%%\r}"
  raw="${raw# }"
  raw="${raw% }"
  if [[ "$raw" == "\""*"\"" ]]; then
    raw="${raw:1:${#raw}-2}"
    raw="${raw//\\\"/\"}"
    raw="${raw//\\n/$'\n'}"
  elif [[ "$raw" == "'"*"'" ]]; then
    raw="${raw:1:${#raw}-2}"
  fi
  printf '%s' "$raw"
}

set_secret() {
  local key="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "Skipping ${key} (empty or missing)"
    return
  fi
  echo "Setting ${key}"
  printf '%s' "$value" | gh secret set "$key" -R "$(gh repo view --json nameWithOwner -q .nameWithOwner)"
}

for key in "${SECRETS[@]}"; do
  if [[ "${RG_AVAILABLE}" == true ]]; then
    line=$(rg -n "^${key}=" "${ENV_FILE}" | head -n 1 || true)
  else
    line=$(grep -n "^${key}=" "${ENV_FILE}" | head -n 1 || true)
  fi
  if [[ -z "$line" ]]; then
    echo "${key} not found in ${ENV_FILE}"
    continue
  fi
  value="${line#*=}"
  value=$(parse_env_value "$value")
  set_secret "$key" "$value"
  echo "${key} configured"
  echo "---"
 done

 echo "Done."
