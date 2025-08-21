English Listening Trainer – Dev Guide

Overview
- Next.js App Router (TypeScript) app for AI‑assisted English listening practice.
- Features: topic/transcript generation, questions, grading, local Kokoro TTS, invitation code access with daily usage limits, admin dashboard, SQLite persistence.

Quick Start
- Prereqs: Node.js 18+, Python 3.8-3.12 (⚠️ Python 3.13+ not supported by Kokoro), macOS recommended (Apple Silicon supported), local HTTPS proxy if needed.
- Install deps: `npm install`
- Set env vars: `cp .env.example .env.local` and ensure `CEREBRAS_API_KEY` is set. Optionally set a proxy for Cerebras in `lib/ark-helper.ts` or via environment.
- Initialize Kokoro (first time): `npm run setup-kokoro`
  - Creates Python venv under `kokoro-local/venv` and installs dependencies
  - Copies required voice file to `kokoro-local/voices`
- Create invitation codes: `node scripts/create-test-codes.js`
- Run dev server: `npm run dev`
- Open: `http://localhost:3000` (enter a generated invitation code)
- Admin dashboard: `npm run admin` then `http://localhost:3005/admin` (default password: `admin123`)

Key Workflows
- Generate topics/transcripts/questions via Cerebras (proxied) APIs under `app/api/ai/*`.
- Generate audio locally via Kokoro: `POST /api/tts` saves WAV to `public/`.
- Track daily usage and store exercises using SQLite under `data/app.db`.

Environment
- Required: `CEREBRAS_API_KEY` (see `.env.local`).
- Local proxy (optional): update `PROXY_URL` in `lib/ark-helper.ts` if needed.
- Apple Silicon: `PYTORCH_ENABLE_MPS_FALLBACK=1` is set; `setup-kokoro.sh` configures PyTorch + MPS.

Performance Notes
- **TTS Performance**: First audio generation takes 3-5 seconds (model loading), subsequent generations: 2-8 seconds depending on text length.
- **Memory Usage**: Kokoro TTS uses ~1-2GB RAM when active. Memory warnings in console are cosmetic.
- **Apple Silicon**: Metal acceleration provides significant performance boost for audio generation.

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
- **Python Version Issues**: If TTS fails to initialize, check Python version with `python3 --version`. Kokoro requires Python 3.8-3.12 (not 3.13+). If needed, recreate venv: `cd kokoro-local && rm -rf venv && python3.12 -m venv venv`
- **Cerebras API**: verify API key and proxy connectivity in `lib/ark-helper.ts`.
- **TTS Initialization**: ensure Kokoro venv is initialized and voice file exists; try rerunning `npm run setup-kokoro`.
- **Usage Count Display**: if usage counter shows incorrect values, check browser console for API errors and refresh the page.
- **SQLite**: database is at `data/app.db`. If schema issues occur, delete the file to reinit (development only).
- **Memory Leaks**: EventEmitter warnings are cosmetic and don't affect functionality.

