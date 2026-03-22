# CLAUDE.md

This file gives Claude Code the shortest possible route to the truth instead of a scenic detour through stale docs.

## Project Overview

English Listening Trainer is a Next.js 16 app that generates listening practice with Cerebras for content and Together Kokoro-82M for audio.

**Current stack:** Next.js 16, React 19, TypeScript, Prisma 7, Postgres/Neon, Vercel Blob, Cerebras, Together TTS, GitHub Actions for scheduled news refresh.

## Common Commands

```bash
# App
npm run dev
npm run build
npm run start

# Admin
npm run admin
npm run admin-dev

# Database
npm run db:generate
npm run db:migrate
npm run db:sync
npm run db:studio
npm run db:reset

# Tests
npm run test:run
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage

# Quality
npm run lint
npx tsc --noEmit
```

## Architecture Snapshot

### Content pipeline
1. `/api/ai/topics`
2. `/api/ai/transcript`
3. `/api/ai/questions`
4. `/api/tts`
5. Practice session save / grading / history

Focus-area coverage is evaluated after generation. Retry logic lives in `lib/ai/retry-strategy.ts`, `lib/focus-area-utils.ts`, and the AI routes.

### TTS pipeline
- `/api/tts` calls `lib/together-tts-service.ts`
- Together returns WAV
- Audio is persisted through `lib/audio-storage.ts`
- Storage is Vercel Blob when `BLOB_READ_WRITE_TOKEN` exists, otherwise local disk is just a development fallback
- Playback is served through `/api/audio/[filename]`

### Database
- Runtime target is Postgres/Neon, not SQLite
- Prisma client setup lives in `lib/database.ts`
- Prisma schema target is `provider = "postgresql"` in `prisma/schema.prisma`
- `db:sync` uses `POSTGRES_URL_NON_POOLING`, `DIRECT_URL`, or `DATABASE_URL`

### Health checks
- `GET /api/health`: public readiness check
- `GET /api/health?mode=deep`: admin-only diagnostics
- Deep mode runs a Together TTS probe and returns proxy/storage-related diagnostics; it does not do the old local-file write/delete dance

## What Is True Right Now

- Production deploy target is Vercel, not a VPS.
- Production database is Postgres/Neon, not SQLite.
- Production audio persistence is Blob, not `public/audio`.
- Proxy configuration for Cerebras/Together/RSS is optional and env-driven.
- `withDatabase()` is a useful wrapper, but the codebase also uses `getPrismaClient()` directly in many routes. Do not pretend otherwise.

## Conventions

### File naming
- Components: `PascalCase.tsx`
- Hooks and utilities: `kebab-case.ts`
- Tests: `*.test.ts` or `*.spec.ts`

### Imports
- Prefer `@/` absolute imports for internal modules
- Keep server-only modules marked with `import 'server-only'`

### Database usage
- Prefer `withDatabase()` when retry/error normalization adds value
- Use `getPrismaClient()` directly where the route/service already follows that pattern
- Match local code patterns before introducing a new access style

## Environment Notes

- `CEREBRAS_BASE_URL` should be `https://api.cerebras.ai`
- Together config comes from `TOGETHER_API_KEY`, `TOGETHER_BASE_URL`, `TOGETHER_TTS_MODEL`
- Optional proxy inputs for Together are `TOGETHER_PROXY_URL`, `PROXY_URL`, `HTTPS_PROXY`, `HTTP_PROXY`
- Blob storage is enabled by `BLOB_READ_WRITE_TOKEN`
- Production examples live in `.env.production.example`

## Testing Notes

- Coverage thresholds are 85/85/85 in `vitest.config.ts`
- Test folders are `tests/unit`, `tests/integration`, and `tests/e2e`
- There is no `tests/README.md`, so don’t go hunting ghosts

## Deployment

Read `DEPLOYMENT.md` before touching production behavior. It is the authority for:
- Vercel deployment flow
- required env vars
- scheduled news refresh wiring
- verification commands after deploy

## Search Tools Convention

Use Exa for web search. Local code search is still `rg`, because using a slower tool on purpose would be a weird hobby.
