# Copilot Instructions

English Listening Trainer is an AI-powered listening practice app built around Cerebras for content and Together Kokoro-82M for audio.

## Architecture Overview

**Content pipeline**: user config -> `/api/ai/topics` -> `/api/ai/transcript` -> `/api/ai/questions` -> `/api/tts` -> practice session.

Focus-area coverage is validated after generation. Retry/degradation behavior is handled by:
- `lib/ai/retry-strategy.ts`
- `lib/focus-area-utils.ts`
- the AI route handlers in `app/api/ai/*`

**Service boundaries**:
- `lib/ai/` — AI orchestration, prompts, schemas, retry logic, telemetry.
- `lib/together-tts-service.ts` — Together TTS request/validation/storage orchestration.
- `lib/audio-storage.ts` — Blob-first audio persistence with local fallback.
- `lib/database.ts` — Prisma client setup plus retry/error helpers.
- `lib/auth.ts` — JWT auth with `requireAuth()` / `requireAdmin()`.

## Database Reality Check

- Runtime target is Postgres/Neon on Vercel.
- Prisma schema is PostgreSQL-only.
- `withDatabase()` is recommended when you want retry/error normalization.
- The codebase also uses `getPrismaClient()` directly in several routes. Follow the local pattern instead of cargo-culting one wrapper everywhere.

## TTS Reality Check

- Together returns WAV audio.
- Audio persistence goes through `lib/audio-storage.ts`.
- Blob is used when `BLOB_READ_WRITE_TOKEN` is configured.
- Local `public/audio` or `public/assessment-audio` writes are fallback behavior for non-Blob environments, not the production architecture.
- Proxy settings are optional and env-driven: `TOGETHER_PROXY_URL`, `PROXY_URL`, `HTTPS_PROXY`, `HTTP_PROXY`.

## Admin Dashboard

- `npm run admin` starts the admin server on port `3005`
- `npm run admin-dev` enables hot reload
- Entry point: `scripts/admin-server.mjs`
- Admin routes live under `app/admin` and `app/api/admin`

## Essential Commands

```bash
npm run dev
npm run admin
npm run build
npm run test:run
npm run db:sync
npm run db:migrate
npm run db:studio
```

## Environment Notes

- `CEREBRAS_BASE_URL` should be `https://api.cerebras.ai`
- `TOGETHER_API_KEY` is required for TTS
- `BLOB_READ_WRITE_TOKEN` enables Blob-backed audio persistence
- `POSTGRES_PRISMA_URL` is preferred at runtime when present
- `POSTGRES_URL_NON_POOLING` / `DIRECT_URL` / `DATABASE_URL` are used for schema sync

## Deployment

`DEPLOYMENT.md` is the authoritative runbook.

It documents:
- Vercel deployment flow
- required environment variables
- scheduled news refresh via GitHub Actions
- verification commands after deploy

If another doc disagrees with `DEPLOYMENT.md`, the other doc is wrong. Simple.

## Testing Guidelines

- Run `npm run test:run && npm run lint` before landing meaningful changes
- Coverage thresholds are 85/85/85 in `vitest.config.ts`
- Test folders mirror runtime intent: `tests/unit`, `tests/integration`, `tests/e2e`

## Search Tools Convention

Use Exa for web search. Use `rg` for local code search. Life is too short for slower grep.
