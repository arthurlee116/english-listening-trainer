# AI Deployment Runbook (Authoritative)

Audience: AI agents operating this repo.

Goal: Deploy `english-listening-trainer` to the existing production VPS and keep it working after changes.

This file is the single source of truth for deployment. If it conflicts with other docs, follow this file.

## 0) Safety rules (still follow these)

- NEVER paste or commit secrets (API keys, `.env.production`, SSH private keys, subscription URLs/tokens, admin passwords).
- It is OK to store the server IP/domain here. It is NOT OK to store credentials.
- When you need values, read them from the server’s `.env.production` or ask the human.

## 1) Production inventory (current known state)

### Server
- Provider/Region: Tencent Cloud, Hong Kong
- Public IPv4: `43.159.200.246`
- SSH user: `ubuntu`
- App path on server: `/srv/leesaitool/english-listening-trainer`
- There is already another web app on the same server (shared `:80/:443` via Caddy). Host-based routing is used.

### Domain
- Primary domain: `leesaitool.com`
- `www.leesaitool.com` redirects to apex
- DNS: A records for apex + `www` point to `43.159.200.246`

### Edge / TLS
- Reverse proxy: Caddy
- Caddyfile path: `/etc/caddy/Caddyfile`
- Caddy terminates HTTPS (Let’s Encrypt) and routes by Host header.

### App runtime
- Deployment method: GitHub Actions (Push to `main`) or manual Docker Compose build-on-server
- Compose file: `/srv/leesaitool/english-listening-trainer/docker-compose.prod.yml`
- Container listens on `0.0.0.0:3000` inside container
- Host mapping: `127.0.0.1:3001 -> 3000` (so only Caddy can reach it)

### Database
- DB: SQLite (persistent on host)
- Host path: `/srv/leesaitool/english-listening-trainer/prisma/data/app.db`
- Container path: `/app/prisma/data/app.db`
- Required env: `DATABASE_URL=file:/app/prisma/data/app.db`

### AI outbound proxy (only if needed)
Production uses a local proxy stack on the VPS when the region cannot reliably reach some AI providers.

- Proxy stack:
  - `subconverter` container on host `127.0.0.1:25500`
  - `mihomo` container providing mixed proxy on `0.0.0.0:10808`
- App container reaches host proxy via Docker gateway, e.g.:
  - `CEREBRAS_PROXY_URL=http://172.19.0.1:10808`
  - `TOGETHER_PROXY_URL=http://172.19.0.1:10808`

Do NOT store subscription URLs/tokens here. They live on the server under `/srv/leesaitool/proxy/` (private).

## 2) Known pitfalls (root causes we hit)

### Pitfall A: Cerebras returns 404
Root cause: `@cerebras/cerebras_cloud_sdk` expects:
- `CEREBRAS_BASE_URL=https://api.cerebras.ai`

Do NOT set it to `https://api.cerebras.ai/v1` because the SDK calls `/v1/...` internally and you end up with `/v1/v1/...` → 404.

### Pitfall B: Prisma fails on slim images
Root cause: Prisma on Debian slim needs OpenSSL runtime.
Fix: install `openssl` in the Docker image runtime layer (already done in `Dockerfile`).

### Pitfall B2: Prisma 7 schema url error during build
Symptoms:
- `npx prisma generate` fails in Docker build with `P1012`
- Error says `datasource.url is no longer supported in schema files`

Root cause:
- Prisma CLI v7 removed `datasource.url` from `schema.prisma`.
- Connection URL must be supplied via `prisma.config.ts`.

Fix (applied 2026-01-28):
- Keep `schema.prisma` without `url`.
- Ensure `prisma.config.ts` is copied into the image for both build and runtime.
  - `Dockerfile`: copy `prisma.config.ts` into `/app` before `npx prisma generate`
  - `Dockerfile` runtime: copy `prisma.config.ts` into the final image
- Keep `DATABASE_URL=file:/app/prisma/data/app.db` set in `docker-compose.prod.yml`.

### Pitfall C: SQLite data disappears after redeploy
Root cause: DB stored inside container filesystem.
Fix: mount host dir `./prisma/data` into `/app/prisma/data` and use absolute `DATABASE_URL=file:/app/prisma/data/app.db`.

### Pitfall D: “Env var is empty” debugging lies
If you run `ssh host 'docker exec ... sh -lc "echo $VAR"'`, the *remote shell* may expand `$VAR` before it reaches the container.
Preferred checks:
- `docker inspect <container> --format '{{range .Config.Env}}{{println .}}{{end}}'`
- or: `docker exec <container> node -e 'console.log(process.env.VAR)'`

### Pitfall E: Recommended topics were grey/can’t click
Root cause: UI disabled click when no pre-generated transcript existed for selected duration.
Fix: `components/home/recommended-topics.tsx` now allows click and shows a “Generate/需生成” hint.

### Recent incident (2026-01-28): Deploy health check 502
Symptoms:
- GitHub Actions deploy failed on health check.
- `curl -fsS https://listen.leesaitool.com/api/health` returned 502.
- App container exited with `Error: The datasource.url property is required in your Prisma config file when using prisma db push.`

Root cause:
- Prisma config file was not available in the container at runtime or build time.
- A temporary attempt to add `url = env("DATABASE_URL")` to `schema.prisma` broke Prisma 7 (P1012).

Resolution:
- Copy `prisma.config.ts` into the Docker image (build + runtime).
- Keep `schema.prisma` without `datasource.url`.
- Keep `DATABASE_URL=file:/app/prisma/data/app.db` in `docker-compose.prod.yml`.
- Health check uses `https://listen.leesaitool.com/api/health`.

Notes:
- If health check fails again, inspect container logs with:
  `sudo docker logs --tail=200 english-listening-trainer-app-1`

## 3) How production works (wiring)

### Caddy routing (reference)
`leesaitool.com` and `www.leesaitool.com` should proxy to `127.0.0.1:3001`.
Multiple domains can share the same server IP; Caddy routes by Host header.

### Docker Compose (reference)
`docker-compose.prod.yml` is the production entrypoint for builds and restarts.
- `env_file: .env.production`
- persistent volumes: `./prisma/data`, `./public/audio`, `./data`, `./logs`
- startup command runs `prisma db push` then `next start`

Why `db push` (for speed): migration history may not be stable/complete for a clean prod DB. Follow up later with real migrations + `prisma migrate deploy`.

## 4) One-time setup checklist (if rebuilding a fresh server)

1) Install Docker + Compose plugin
2) Install Caddy
3) Set DNS A records (apex + `www`) to server IP
4) Put site blocks into `/etc/caddy/Caddyfile`, reload Caddy
5) Clone repo into `/srv/leesaitool/english-listening-trainer`
6) Create `.env.production` from `.env.production.example` (fill secrets locally; do not commit)
7) Create persistent dirs:
   - `mkdir -p public/audio public/assessment-audio data logs prisma/data`
8) `docker compose -f docker-compose.prod.yml up -d --build`
9) Pre-generate assessment audio once (persists via volume):
   - `BASE_URL=http://127.0.0.1:3001 ./scripts/generate-assessment-audio.sh`

If you need assessment audio baked into the image:
- Generate `public/assessment-audio/*` before building the image so `COPY . .` includes it.

# 5) Routine deployment after code changes (fast path)

### Option A: GitHub Actions (Automatic - Preferred)
Simply push to `main` or merge a PR. The `deploy.yml` workflow will:
1. Sync code on the server via SSH.
2. Rebuild and restart the container.
3. Perform a health check.

### Option B: Manual sync (Run from your local machine)

```bash
# 1) sync code to server
ssh ubuntu@43.159.200.246 'cd /srv/leesaitool/english-listening-trainer && git fetch --all && git reset --hard origin/main'

# 2) rebuild + restart app
ssh ubuntu@43.159.200.246 'cd /srv/leesaitool/english-listening-trainer && sudo docker compose -f docker-compose.prod.yml up -d --build app'

# 3) health check
curl -fsS https://listen.leesaitool.com/api/health
```

If assessment audio is missing (fresh host or cleared volume):
- `ssh ubuntu@43.159.200.246 'cd /srv/leesaitool/english-listening-trainer && BASE_URL=http://127.0.0.1:3001 ./scripts/generate-assessment-audio.sh'`

If you changed Prisma schema:
- Expect `prisma db push` to run at container start.
- Verify DB file is still mounted and writable.

If you changed env requirements:
- Update server `.env.production` (never commit it).
- Recreate container: `docker compose ... up -d --force-recreate --no-deps app`

Text model reminder:
- `AI_DEFAULT_MODEL=gpt-oss-120b` (project default for text generation)

## 6) Verification checklist (must pass)

From anywhere:
- `GET https://listen.leesaitool.com/api/health` returns `status=healthy`

Assessment audio sanity:
- `curl -fsS https://listen.leesaitool.com/api/assessment-audio/1`

AI sanity (Cerebras):
```bash
curl -fsS -X POST https://leesaitool.com/api/ai/topics \
  -H 'content-type: application/json' \
  -d '{"difficulty":"easy","wordCount":120,"language":"en-US"}'
```

If AI fails:
- Check app logs: `sudo docker logs --tail=200 english-listening-trainer-app-1`
- Ensure `CEREBRAS_BASE_URL` has NO `/v1`
- If proxy is required, ensure:
  - `mihomo` + `subconverter` containers are running
  - app env includes `CEREBRAS_PROXY_URL` / `TOGETHER_PROXY_URL`

## 7) Troubleshooting quick commands (server)

```bash
ssh ubuntu@43.159.200.246

# app status
cd /srv/leesaitool/english-listening-trainer
sudo docker compose -f docker-compose.prod.yml ps
sudo docker logs -f --tail=200 english-listening-trainer-app-1

# caddy status
sudo systemctl status caddy --no-pager
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo systemctl reload caddy

# confirm ports
sudo ss -lntp | egrep '(:80|:443|:3001|:10808)'
```

## 8) Memory pressure (swap) — optional

If the server is low-memory and builds OOM, add temporary swap (example 4G):

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
swapon --show
```

## 9) What NOT to do

- Do not run `docker system prune -a` unless the human explicitly asks (it destroys caches and slows next deploy).
- Do not exposure proxy port `10808` publicly unless required (keep it internal).
- Do not paste `.env.production` contents into chats/issues.

## 10) CI/CD & Docker Registry

The project uses GitHub Actions for automation:

### Workflows
- **Deploy to Production (`deploy.yml`)**: Triggered on push to `main`. Syncs code and restarts app on the server.
- **Build and Push (`build-and-push.yml`)**: Manual workflow to build production-ready Docker images and push to GHCR (`ghcr.io`). Supports advanced caching.
- **Prewarm Dependencies (`prewarm-deps.yml`)**: Weekly schedule or manual. Pre-builds `cache-base`, `cache-python`, and `cache-node` layers to speed up main builds.

### Registry & Caching
- **Registry**: `ghcr.io/arthurlee116/english-listening-trainer`
- **Caching strategy**: Uses multi-layer registry cache (`type=registry`).
  - `cache-base`: OS + System dependencies (CUDA/CUDNN).
  - `cache-python`: Python runtime + pip packages.
  - `cache-node`: Node.js runtime + npm packages + Prisma.
  - `cache-builder`: Compilation artifacts.

## 11) GitHub Secrets Configuration

The following secrets must be configured in GitHub Actions for the workflows to function:

### Deployment (`deploy.yml`)
- `SSH_HOST`: IP or domain of the production server (e.g., `43.159.200.246`).
- `SSH_USER`: SSH username (e.g., `ubuntu`).
- `SSH_PRIVATE_KEY`: The private key used to access the server.
- `SSH_PORT`: (Optional) SSH port, defaults to `22`.

### Registry Registry (`build-and-push.yml`)
- `GHCR_PAT`: Personal Access Token with `write:packages` permission.
