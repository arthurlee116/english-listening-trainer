#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT=180
COMPOSE_FILE=""
CHECK_AUDIO=false
PYTHON_BIN="${PYTHON_BIN:-python3}"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Options:
  --base-url URL          Service base URL (default: ${BASE_URL})
  --timeout SECONDS       Overall timeout in seconds (default: ${TIMEOUT})
  --compose-file PATH     docker compose file for in-container checks (optional)
  --check-audio           Verify generated audio file exists via docker compose exec
  -h, --help              Show this help message
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="$2"; shift 2 ;;
    --timeout)
      TIMEOUT="$2"; shift 2 ;;
    --compose-file)
      COMPOSE_FILE="$2"; shift 2 ;;
    --check-audio)
      CHECK_AUDIO=true; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1 ;;
  esac
done

log() { printf '[SMOKE] %s\n' "$1"; }
error_exit() { printf '[SMOKE][ERROR] %s\n' "$1" >&2; exit 1; }

if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  else
    error_exit "python3/python not available for JSON parsing"
  fi
fi

curl_check() {
  local path="$1"
  local tries=0
  local max_tries=$(( TIMEOUT / 5 ))
  while (( tries < max_tries )); do
    if curl -sf "${BASE_URL}${path}" >/dev/null; then
      log "${path} responded with 200"
      return 0
    fi
    ((tries++))
    sleep 5
  done
  error_exit "Endpoint ${path} did not return success within ${TIMEOUT}s"
}

log "Running smoke tests against ${BASE_URL}"

curl_check "/api/health"
curl_check "/api/performance/metrics"

log "Triggering TTS endpoint"
TTS_PAYLOAD='{ "text": "Automated deployment smoke test.", "language": "en-US", "speed": 1.0 }'
TTS_RESPONSE="$(curl -sf -X POST -H 'Content-Type: application/json' -d "${TTS_PAYLOAD}" "${BASE_URL}/api/tts")"

if [[ -z "${TTS_RESPONSE}" ]]; then
  error_exit "Empty response from /api/tts"
fi

log "Received response: ${TTS_RESPONSE}"

AUDIO_PATH="$(RESP="${TTS_RESPONSE}" "${PYTHON_BIN}" - <<'PY'
import json, os, sys
try:
    data = json.loads(os.environ['RESP'])
except Exception as exc:
    print(f"error:{exc}")
    sys.exit(1)

if not data.get('success'):
    print('error:TTS response did not contain success=true')
    sys.exit(2)

audio = data.get('audioUrl') or data.get('audio_url')
duration = data.get('duration') or data.get('initialDuration')
if not audio:
    print('error:audioUrl missing')
    sys.exit(3)
if duration is None:
    print('error:duration missing')
    sys.exit(4)
print(audio)
PY
)"

if [[ "${AUDIO_PATH}" == error:* ]]; then
  error_exit "${AUDIO_PATH#error:}"
fi

log "Audio URL: ${AUDIO_PATH}"

if [[ "${CHECK_AUDIO}" == true ]]; then
  if [[ -z "${COMPOSE_FILE}" ]]; then
    error_exit "--check-audio requires --compose-file"
  fi
  if docker compose version >/dev/null 2>&1; then
    DOCKER_CLI=(docker compose -f "${COMPOSE_FILE}")
  elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_CLI=(docker-compose -f "${COMPOSE_FILE}")
  else
    error_exit "docker compose binary not found for audio verification"
  fi
  AUDIO_FILENAME="${AUDIO_PATH##*/}"
  if ! "${DOCKER_CLI[@]}" exec -T app test -f "/app/public/audio/${AUDIO_FILENAME}"; then
    # shellcheck disable=SC2016
    error_exit "Audio file /app/public/audio/${AUDIO_FILENAME} not found inside container"
  fi
  log "Verified audio file inside container"
fi

log "Smoke tests completed successfully"
