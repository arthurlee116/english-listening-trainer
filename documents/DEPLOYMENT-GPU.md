# GPU Deployment Guide

This document describes the reproducible CUDA deployment pipeline for the English Listening Trainer on NVIDIA Tesla P40 servers. It supplements the general `documents/DEPLOYMENT.md` doc and focuses on Docker + NVIDIA Container Toolkit workflows.

## 1. Prerequisites
- Ubuntu 20.04/22.04 or another CUDA-capable Linux distribution.
- NVIDIA driver >= 525 (required for CUDA 12.x on Tesla P40).
- NVIDIA Container Toolkit (`nvidia-container-toolkit`) configured for Docker Engine.
- Docker Engine 24+, `docker compose` plugin v2.20+ (or legacy `docker-compose`).
- Git, curl, python3 (3.8–3.12), and sudo access for installation steps.

Verify drivers:
```bash
nvidia-smi
```

Install the container toolkit following NVIDIA's official guide: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html

## 2. Repository Preparation
```bash
git clone git@github.com:<org>/english-listening-trainer.git
cd english-listening-trainer
cp .env.production.example .env.production
npm run verify-env -- --file .env.production  # ensure required keys are filled
```

The GPU deployment pipeline uses the following helper scripts (all ASCII, `chmod +x`):

| Script | Purpose |
| --- | --- |
| `scripts/gpu-environment-check.sh` | Detects `nvidia-smi`, prints GPU model/driver, validates `torch.cuda.is_available()` with the configured Python interpreter. |
| `scripts/install-pytorch-gpu.sh` | Creates/refreshes the Kokoro virtualenv and installs the correct CUDA/CPU/MPS PyTorch build idempotently. |
| `scripts/deploy-gpu.sh` | Orchestrates git pull → environment checks → Docker build → Prisma migrate → service start → smoke tests. |
| `scripts/smoke-test.sh` | Exercises `/api/health`, `/api/performance/metrics`, and `/api/tts` (validates `audioUrl` + `duration`; optionally checks the generated WAV inside the container). |
| `scripts/rollback-gpu.sh` | Stops GPU services and optionally restarts them with a specified image tag. |

## 3. Docker Assets
- `Dockerfile`: multi-stage build based on `nvidia/cuda:12.1.1-cudnn-runtime-ubuntu22.04`.
  - Stage `base` installs Node 18, Python 3.10 toolchain, ffmpeg/libsndfile, build essentials.
  - Stage `deps` performs `npm ci`, `prisma generate`, and `next build` (standalone output).
  - Stage `runtime` copies the standalone App, provisions `kokoro-local/venv` with `torch==2.3.0+cu121`, `torchaudio==2.3.0+cu121`, `torchvision==0.18.0+cu121`, ensures `PATH` prefers the venv, and exposes port 3000 under user `nextjs` (UID 1001).
- `docker-compose.gpu.yml`:
  - `migrate` (profile `migrate`): runs `npx prisma migrate deploy` from the build stage (`target: deps`) so the Prisma CLI is available.
  - `app`: main service, GPU-enabled (`deploy.resources` + `device_requests`), binds `./data`, `./public/audio`, `./logs`, `./backups` into `/app/**`.
  - `admin` (profile `admin`): optional admin server on port 3005.
  - The image tag is configurable via `IMAGE_TAG`, defaulting to `english-listening-trainer:gpu`.
  - Healthcheck: `curl http://localhost:3000/api/health` every 30 seconds after a 60 second warm-up.

Mount points:

| Host path | Container path | Purpose |
| --- | --- | --- |
| `./data` | `/app/data` | SQLite database (WAL enabled). |
| `./public/audio` | `/app/public/audio` | Generated WAV files served by Next.js. The cleanup worker in `lib/audio-cleanup-service.ts` continues to prune stale files. |
| `./logs` | `/app/logs` | Application logs. |
| `./backups` | `/app/backups` | Optional snapshot location for manual DB/audio backups. |

The deployment script ensures these directories exist before Compose starts. It attempts to `chown` them to UID/GID `1001` (the container user) and falls back to `chmod 777` if privilege escalation is unavailable. Review permissions if stricter policies are required.

## 4. Deployment Workflow
Run a dry-run first to confirm connectivity:
```bash
scripts/deploy-gpu.sh --dry-run
```

Production deployment (CUDA server):
```bash
scripts/deploy-gpu.sh \
  --compose-file docker-compose.gpu.yml \
  --base-url http://localhost:3000
```

The script executes these steps:
1. `git pull --ff-only` (skip with `--no-pull`).
2. `scripts/gpu-environment-check.sh` (fails with actionable hints if drivers or torch GPU bindings are missing).
3. `scripts/install-pytorch-gpu.sh` (idempotent virtualenv bootstrap; override interpreter with `--python /usr/bin/python3.10`).
4. `docker compose build app` (optional build args: `--build-arg KEY=VALUE`).
5. `docker compose run --rm migrate` (profile aware via `COMPOSE_PROFILES`).
6. `docker compose up -d app` (requests all GPUs via `device_requests.count=-1`).
7. `scripts/smoke-test.sh --compose-file docker-compose.gpu.yml --check-audio`.

Use `--skip-python-setup` or `--skip-smoke` for advanced scenarios (document reasons in deployment logs when skipping).

## 5. Smoke/Health Verification
`scripts/smoke-test.sh` performs:
- GET `${BASE_URL}/api/health` (expects 200 JSON).
- GET `${BASE_URL}/api/performance/metrics` (expects 200).
- POST `${BASE_URL}/api/tts` with a short English sentence; validates JSON structure and optionally ensures `/app/public/audio/<file>` exists via `docker compose exec -T app`.

Failure codes:
- `1`: Missing curl/python dependencies.
- `2`: Endpoint timeout (> `--timeout`, default 180s).
- `3`: Malformed TTS response.
- `4`: Audio file absent inside container when `--check-audio` set.

## 6. Rollback / Restart

Stop services and remove orphans:
```bash
scripts/rollback-gpu.sh
```

Roll back to a previously tagged image and restart:
```bash
scripts/rollback-gpu.sh \
  --image-tag english-listening-trainer:previous \
  --restart
```

The compose file honors `IMAGE_TAG`; push tagged images to your registry (e.g. `docker tag english-listening-trainer:gpu english-listening-trainer:previous`).

## 7. Environment Management
- Generate `.env.production` from the template and run `npm run verify-env -- --file .env.production` on CI or prior to deployment.
- Ensure `DATABASE_URL=file:./data/app.db` or your production DSN is reachable from the container.
- Preserve secrets exclusively in `.env*` files; never bake into images.

## 8. Troubleshooting

| Symptom | Diagnosis | Fix |
| --- | --- | --- |
| `nvidia-smi` missing | NVIDIA drivers/toolkit not installed | Follow NVIDIA toolkit guide, reboot server, rerun `scripts/gpu-environment-check.sh`. |
| `torch.cuda.is_available()` false | CUDA version mismatch or PyTorch CPU build installed | Re-run `scripts/install-pytorch-gpu.sh --cuda-version 12.1`; confirm CUDA driver >= 525. |
| Kokoro audio generation fails with permission errors | Host bind mounts not writable | Ensure `data`, `public/audio`, `logs`, `backups` directories exist with `chmod 775` and are owned by UID 1001 or world-writable as required. |
| `/api/tts` returns 503 `GPU TTS service not ready` | Model boot warm-up (3–5 seconds) or Kokoro wrapper crash | Check `docker compose logs -f app`, restart service once GPU is stable. |
| Slow smoketest | Large initial TTS warm-up; the script waits up to 180s | Increase `--timeout` or run once after container warm-up. |
| Need CPU fallback | Run `scripts/install-pytorch-gpu.sh --device cpu --skip-python-setup` and set `KOKORO_DEVICE=cpu` before invoking `deploy-gpu.sh`; skip GPU compose file and rely on local dev instructions. |

## 9. References
- NVIDIA Container Toolkit installation guide (see link above).
- PyTorch CUDA 12.1 wheels: https://download.pytorch.org/whl/cu121/torch/.
- Docker Compose GPU device requests: https://docs.docker.com/compose/gpu-support/.

Keep this document aligned with `Dockerfile`, `docker-compose.gpu.yml`, and the deployment scripts whenever they change.
