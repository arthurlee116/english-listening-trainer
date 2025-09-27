#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${PROJECT_ROOT}/docker-compose.gpu.yml}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
DRY_RUN=false
NO_PULL=false
SKIP_SMOKE=false
BUILD_ARGS=()
PROFILE_ARGS=()
ENSURE_PY_ENV=true
PYTHON_BIN="${PYTHON_BIN:-python3}"
HOST_DIRS=("data" "public/audio" "logs" "backups")

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Options:
  --compose-file PATH     Path to docker compose file (default: docker-compose.gpu.yml)
  --base-url URL          Base URL for smoke tests (default: ${BASE_URL})
  --build-arg KEY=VALUE   Forward build arguments (repeatable)
  --dry-run               Print actions without executing them
  --no-pull               Skip git pull
  --python PATH           Python interpreter for local Kokoro env (default: ${PYTHON_BIN})
  --skip-python-setup     Skip provisioning local Kokoro virtualenv
  --skip-smoke            Skip smoke tests after startup
  -h, --help              Show this help message

Environment variables:
  COMPOSE_PROFILES   Additional docker compose profiles (comma separated)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --compose-file)
      COMPOSE_FILE="$2"; shift 2 ;;
    --base-url)
      BASE_URL="$2"; shift 2 ;;
    --build-arg)
      BUILD_ARGS+=("--build-arg" "$2"); shift 2 ;;
    --dry-run)
      DRY_RUN=true; shift ;;
    --no-pull)
      NO_PULL=true; shift ;;
    --python)
      PYTHON_BIN="$2"; shift 2 ;;
    --skip-python-setup)
      ENSURE_PY_ENV=false; shift ;;
    --skip-smoke)
      SKIP_SMOKE=true; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1 ;;
  esac
done

log() { printf '[DEPLOY] %s\n' "$1"; }
warn() { printf '[DEPLOY][WARN] %s\n' "$1"; }
error_exit() { printf '[DEPLOY][ERROR] %s\n' "$1" >&2; exit 1; }

run_cmd() {
  local description="$1"; shift
  local cmd=("$@")
  log "$description"
  log "Command: ${cmd[*]}"
  if [[ "${DRY_RUN}" == true ]]; then
    return 0
  fi
  "${cmd[@]}"
}

ensure_host_dir() {
  local path="$1"
  if [[ "${DRY_RUN}" == true ]]; then
    log "Would ensure host directory ${path} exists with UID/GID 1001"
    return
  fi
  mkdir -p "${path}"
  chmod u+rwX,g+rwX "${path}" 2>/dev/null || warn "Unable to chmod ${path}; adjust permissions manually"
  if chown 1001:1001 "${path}" 2>/dev/null; then
    log "Set owner of ${path} to 1001:1001"
    return
  fi
  if command -v sudo >/dev/null 2>&1; then
    if sudo chown 1001:1001 "${path}" >/dev/null 2>&1; then
      log "Set owner of ${path} to 1001:1001 via sudo"
      return
    fi
  fi
  if chmod 777 "${path}" 2>/dev/null; then
    warn "Chown failed; granted world-writable permissions on ${path} as a fallback"
    return
  fi
  if command -v sudo >/dev/null 2>&1 && sudo chmod 777 "${path}" >/dev/null 2>&1; then
    warn "Chown failed; applied sudo chmod 777 to ${path} as fallback"
    return
  fi
  warn "Could not adjust permissions for ${path}. Ensure UID/GID 1001 has write access (e.g. sudo chown 1001:1001 ${path})."
}

ensure_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error_exit "Required command '$1' not found"
  fi
}

ensure_command git
ensure_command docker

if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker compose -f "${COMPOSE_FILE}")
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker-compose -f "${COMPOSE_FILE}")
else
  error_exit "docker compose command not available"
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  error_exit "Compose file ${COMPOSE_FILE} not found"
fi

log "Using compose file: ${COMPOSE_FILE}"
cd "${PROJECT_ROOT}"

for dir in "${HOST_DIRS[@]}"; do
  ensure_host_dir "${dir}"
done

if [[ "${NO_PULL}" == false ]]; then
  run_cmd "Pull latest git changes" git pull --ff-only
else
  warn "Skipping git pull per --no-pull"
fi

log "Running GPU environment diagnostics"
log "Command: PYTHON_BIN=${PYTHON_BIN} ${SCRIPT_DIR}/gpu-environment-check.sh"
PYTHON_BIN="${PYTHON_BIN}" "${SCRIPT_DIR}/gpu-environment-check.sh"

if [[ "${ENSURE_PY_ENV}" == true ]]; then
  PY_CMD=("${SCRIPT_DIR}/install-pytorch-gpu.sh" --python "${PYTHON_BIN}")
  run_cmd "Provision Kokoro Python environment" "${PY_CMD[@]}"
else
  warn "Skipping local PyTorch setup per flag"
fi

if [[ "${DRY_RUN}" == false ]]; then
  log "Ensuring required docker volumes directories exist"
fi

if [[ -n "${COMPOSE_PROFILES:-}" ]]; then
  IFS=',' read -ra profile_list <<< "${COMPOSE_PROFILES}"
  for profile in "${profile_list[@]}"; do
    PROFILE_ARGS+=("--profile" "${profile}")
  done
  log "Using compose profiles: ${profile_list[*]}"
fi

if ((${#BUILD_ARGS[@]})); then
  BUILD_CMD=("${DOCKER_COMPOSE[@]}" build "${BUILD_ARGS[@]}" app)
else
  BUILD_CMD=("${DOCKER_COMPOSE[@]}" build app)
fi
run_cmd "Build application image" "${BUILD_CMD[@]}"

if ((${#PROFILE_ARGS[@]})); then
  RUN_MIGRATE=("${DOCKER_COMPOSE[@]}" "${PROFILE_ARGS[@]}" run --rm migrate)
  UP_CMD=("${DOCKER_COMPOSE[@]}" "${PROFILE_ARGS[@]}" up -d app)
else
  RUN_MIGRATE=("${DOCKER_COMPOSE[@]}" run --rm migrate)
  UP_CMD=("${DOCKER_COMPOSE[@]}" up -d app)
fi
run_cmd "Run Prisma migrations" "${RUN_MIGRATE[@]}"

run_cmd "Start application service" "${UP_CMD[@]}"

if [[ "${SKIP_SMOKE}" == true ]]; then
  warn "Skipping smoke tests per flag"
else
  SMOKE_CMD=("${SCRIPT_DIR}/smoke-test.sh" --base-url "${BASE_URL}" --compose-file "${COMPOSE_FILE}" --check-audio)
  run_cmd "Execute smoke tests" "${SMOKE_CMD[@]}"
fi

log "Deployment pipeline finished"
