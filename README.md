English Listening Trainer – Dev Guide

Overview
- Next.js App Router (TypeScript) app for AI‑assisted English listening practice.
- Features: topic/transcript generation, questions, grading, local Kokoro TTS, invitation code access with daily usage limits, admin dashboard, SQLite persistence.

Quick Start
- Prereqs: Node.js 18+, Python 3.8+, macOS recommended (Apple Silicon supported), local HTTPS proxy if needed.
- Install deps: `npm install`
- Set env vars: copy `.env.local` (ensure `CEREBRAS_API_KEY` is set). Optionally set a proxy for Cerebras in `lib/ark-helper.ts` or via environment.
- Initialize Kokoro (first time): `npm run setup-kokoro`
  - Creates Python venv under `kokoro-local/venv` and installs dependencies
  - Copies required voice file to `kokoro-local/voices`
- Create invitation codes: `node scripts/create-test-codes.js`
- Run dev server: `npm run dev`
- Open: `http://localhost:3000` (enter a generated invitation code)
- Admin dashboard: `http://localhost:3000/admin` (default password: `admin123`)

Key Workflows
- Generate topics/transcripts/questions via Cerebras (proxied) APIs under `app/api/ai/*`.
- Generate audio locally via Kokoro: `POST /api/tts` saves WAV to `public/`.
- Track daily usage and store exercises using SQLite under `data/app.db`.

Environment
- Required: `CEREBRAS_API_KEY` (see `.env.local`).
- Local proxy (optional): update `PROXY_URL` in `lib/ark-helper.ts` if needed.
- Apple Silicon: `PYTORCH_ENABLE_MPS_FALLBACK=1` is set; `setup-kokoro.sh` configures PyTorch + MPS.

Files to Know
- `app/page.tsx`: main flow (invitation → generation → audio → questions → grading → save).
- `app/api/ai/*`: topics/transcript/questions/grade/expand endpoints.
- `app/api/invitation/*`: verify/check/use daily limit.
- `app/api/exercises/*`: save and fetch history.
- `app/admin/page.tsx` + `app/api/admin/*`: invitation code admin + usage stats.
- `lib/kokoro-service.ts`: Node ↔ Python Kokoro bridge.
- `scripts/setup-kokoro.sh`: TTS env setup; `scripts/create-test-codes.js`: seed invitation codes.

Notes
- The default admin password is hardcoded in API routes (`admin123`). For production, move to env vars.
- The project ignores TypeScript and ESLint errors during build (`next.config.mjs`).
- Some npm scripts reference non-existent files (e.g., `scripts/test-mcp.js`); they are not required for core features.

Troubleshooting
- Cerebras errors: verify API key and proxy connectivity.
- TTS errors: ensure Kokoro venv is initialized and voice file exists; try rerunning `npm run setup-kokoro`.
- SQLite: database is at `data/app.db`. If schema issues occur, delete the file to reinit (development only).

