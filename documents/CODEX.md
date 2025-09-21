# CODEX.md

This guide helps OpenAI Codex CLI (the agent you’re using here) work effectively in this repository.

Reminder: place any new text docs under `documents/` to keep the repo root clean.

## Quick Orientation
- Stack: Next.js 15, TypeScript, Prisma + SQLite, local Kokoro TTS, Cerebras AI
- Key flows: auth (JWT cookies), AI generation (topics/transcript/questions/grade), local TTS, admin dashboard
- Recommended OS: macOS; Apple Silicon enables MPS/Metal acceleration

## Prereqs
- Node.js 18+
- Python 3.8–3.12 (Kokoro TTS does not support 3.13+)
- npm

## Env Vars
Create `.env.local` in repo root:
```
CEREBRAS_API_KEY=your_api_key_here
PYTORCH_ENABLE_MPS_FALLBACK=1
JWT_SECRET=your-jwt-secret-here
DATABASE_URL=file:./data/app.db
# Optional admin bootstrap
ADMIN_EMAIL=admin@listeningtrain.com
ADMIN_PASSWORD=Admin123456
ADMIN_NAME=System Administrator
CEREBRAS_PROXY_URL=
```

## Common Commands
- Install deps: `npm install`
- Init Kokoro TTS: `npm run setup-kokoro`
- Seed admin: `npm exec tsx scripts/seed-user-db.ts` (or `npm run db:seed` if using seed-db.ts)
- Dev server: `npm run dev`
- Build/start: `npm run build` | `npm run start`
- Lint/tests: `npm run lint` | `npm test -- --run`
- Admin UI (3005): `npm run admin` | `npm run admin-dev`

## Important Paths
- Frontend: `app/page.tsx`, `components/*`
- APIs: `app/api/ai/*`, `app/api/auth/*`, `app/api/admin/*`, `app/api/tts/route.ts`
- Core libs: `lib/auth.ts`, `lib/database.ts`, `lib/ai-service.ts`, `lib/kokoro-service*.ts`
- TTS env: `kokoro-local/`, setup script `scripts/setup-kokoro.sh`

## Proxy Setup
- Cerebras API calls default to `http://127.0.0.1:7890` in development and `http://81.71.93.183:10811` in production
- Override the proxy by setting `CEREBRAS_PROXY_URL`

## TTS Notes
- First load ~3–5s; generation ~2–8s; RAM ~1–2GB
- Apple Silicon uses MPS automatically when available
- `/api/tts` returns `{ success, audioUrl, duration, byteLength, provider }`; keep this contract intact

## DB Notes
- Prisma + SQLite; default `DATABASE_URL=file:./data/app.db`
- WAL and busy_timeout enabled in `lib/database.ts`

## Health & Checks
- Verify: Kokoro setup, API key, DB write perms, admin seeding
- Endpoints: `/api/health`, `/api/performance/metrics`, `/admin`

## Agent Conventions
- Follow AGENTS.md rules across this repo
- Do not commit real secrets; use env files
- When changing behavior or contracts, add concise notes to `CLAUDE.md`, `AGENTS.md`, and affected code
- Prefer minimal, focused changes that match existing style

## Troubleshooting
- Python version: must be 3.8–3.12
- TTS init issues: rerun `npm run setup-kokoro`
- Venv issues: recreate `kokoro-local/venv` (e.g., `python3.12 -m venv venv`)
- AI failures: check API key/network/proxy
- Auth/DB issues: verify `JWT_SECRET` and DB path permissions
