#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${PROJECT_ROOT}/docker-compose.gpu.yml}"
TARGET_TAG=""
RESTART=false
DRY_RUN=false
REMOVE_ORPHANS=true

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Options:
  --compose-file PATH   docker compose file (default: docker-compose.gpu.yml)
  --image-tag TAG       Image tag to roll back to (e.g. english-listening-trainer:previous)
  --restart             Start services after rollback using the specified tag
  --no-remove-orphans   Do not pass --remove-orphans to docker compose down
  --dry-run             Show actions without executing
  -h, --help            This help message
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --compose-file)
      COMPOSE_FILE="$2"; shift 2 ;;
    --image-tag)
      TARGET_TAG="$2"; shift 2 ;;
    --restart)
      RESTART=true; shift ;;
    --no-remove-orphans)
      REMOVE_ORPHANS=false; shift ;;
    --dry-run)
      DRY_RUN=true; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      printf '[ROLLBACK][ERROR] Unknown option: %s\n' "$1" >&2
      usage
      exit 1 ;;
  esac
done

log() { printf '[ROLLBACK] %s\n' "$1"; }
error_exit() { printf '[ROLLBACK][ERROR] %s\n' "$1" >&2; exit 1; }

ensure_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error_exit "Required command '$1' not found"
  fi
}

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

cd "${PROJECT_ROOT}"

DOWN_CMD=("${DOCKER_COMPOSE[@]}" down)
if [[ ${REMOVE_ORPHANS} == true ]]; then
  DOWN_CMD+=("--remove-orphans")
fi

log "Stopping services"
log "Command: ${DOWN_CMD[*]}"
if [[ ${DRY_RUN} == false ]]; then
  "${DOWN_CMD[@]}"
fi

if [[ -z "${TARGET_TAG}" ]]; then
  log "No image tag provided; rollback complete"
  exit 0
fi

if ! docker image inspect "${TARGET_TAG}" >/dev/null 2>&1; then
  error_exit "Docker image ${TARGET_TAG} not found locally"
fi

log "Image ${TARGET_TAG} available for restart"

if [[ ${RESTART} == false ]]; then
  log "Skipping restart per options"
  exit 0
fi

START_CMD=(IMAGE_TAG="${TARGET_TAG}" "${DOCKER_COMPOSE[@]}" up -d app)
log "Restarting services with IMAGE_TAG=${TARGET_TAG}"
log "Command: ${START_CMD[*]}"
if [[ ${DRY_RUN} == false ]]; then
  env IMAGE_TAG="${TARGET_TAG}" "${DOCKER_COMPOSE[@]}" up -d app
fi

log "Rollback complete"
