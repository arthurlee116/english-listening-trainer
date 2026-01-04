# Copilot Instructions

English Listening Trainer: AI-powered listening practice with Cerebras AI (content) + Together Kokoro-82M TTS (audio).

## Architecture Overview

**Content Pipeline**: User config → `/api/ai/topics` → `/api/ai/transcript` → `/api/ai/questions` → `/api/tts` → practice session.

Key insight: Focus area coverage is validated after question generation; if <80%, the system regenerates with expanded prompts (`lib/ai/retry-strategy.ts`).

**Service Boundaries**:
- `lib/ai/` — AI orchestration: client manager, prompts, schemas, retry logic.
- `lib/together-tts-service.ts` — TTS via Together API with mandatory proxy at `127.0.0.1:10808`.
- `lib/database.ts` — Always wrap Prisma operations in `withDatabase()` for retry/error handling.
- `lib/auth.ts` — JWT auth with `requireAuth()` / `requireAdmin()` guards.

## AI Prompt Templates (`lib/ai/prompt-templates.ts`)

All AI prompts are centralized here. Key builders:
- `buildTopicsPrompt()` — Generates 5 topics for a language/difficulty/focus area combo
- `buildQuestionsPrompt()` — Creates comprehension questions with 70%+ focus area coverage
- `buildTranscriptPrompt()` — Generates listening scripts matching word count targets

Each builder accepts typed params (e.g., `TopicsPromptParams`, `QuestionsPromptParams`) and returns a formatted string. When modifying prompts:
1. Keep the Zod schema in `lib/ai/schemas.ts` in sync with expected AI output
2. Test with `npm run test:integration` to verify AI responses parse correctly
3. Check focus area coverage thresholds in `lib/ai/retry-strategy.ts`

## Admin Dashboard

- **Start**: `npm run admin` (port 3005) or `npm run admin-dev` for hot reload
- **Entry**: `scripts/admin-server.mjs` serves `app/admin/` routes
- **Auth**: Uses `requireAdmin()` guard — user must have `isAdmin: true` in DB
- **Demo mode**: Set `ADMIN_DEMO_DATA=1` to show simulated stats (clearly labeled)

## Essential Commands

```bash
npm run dev           # Dev server on :3000
npm run admin         # Admin dashboard on :3005
npm run test:run      # CI-style test run (Vitest)
npm run db:migrate    # Apply Prisma migrations
npm run db:studio     # Visual DB editor
```

**TTS requires**: `TOGETHER_API_KEY` + HTTP proxy at `http://127.0.0.1:10808`.

## Key Conventions

**File Naming**:
- Components: `PascalCase.tsx` (e.g., `AudioPlayer.tsx`)
- Hooks/utils: `kebab-case.ts` with `use-` prefix (e.g., `use-audio-player.ts`)
- Tests: `*.test.ts` in `tests/unit/`, `tests/integration/`, `tests/e2e/`

**Imports** (always use `@/` alias):
```typescript
import { useState } from 'react'           // 1. External
import { Button } from '@/components/ui/button'  // 2. Absolute (@/)
import { localHelper } from './helper'     // 3. Relative
```

**Server-Only Code**: Mark with `import 'server-only'` at top. Never import into client components.

## Core Patterns

**Database Access**:
```typescript
import { withDatabase } from '@/lib/database'

const result = await withDatabase(async (prisma) => {
  return prisma.user.findUnique({ where: { id } })
}, 'fetch user')
```

**API Route Auth**:
```typescript
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const user = await requireAuth(request)  // Throws 401 if unauthenticated
  // ...
}
```

**AI Structured Output**: Use Zod schemas from `lib/ai/schemas.ts` for type-safe AI responses.

## Environment Pitfalls

- `CEREBRAS_BASE_URL` must be `https://api.cerebras.ai` (no `/v1` — SDK adds it automatically)
- SQLite DB must use absolute path in Docker: `DATABASE_URL=file:/app/prisma/data/app.db`
- TTS and Cerebras calls are proxied; check `*_PROXY_URL` env vars in production

## Types Reference

Core types live in `lib/types.ts`:
- `DifficultyLevel`: `"A1" | "A2" | "B1" | "B2" | "C1" | "C2"`
- `FocusArea`: 10 skill dimensions (e.g., `"main-idea"`, `"inference"`, `"vocabulary"`)
- `ListeningLanguage`: `"en-US" | "en-GB" | "es" | "fr" | "ja" | "it" | "pt-BR" | "hi"`

Language/voice mapping in `lib/language-config.ts`.

## Deployment — READ AND UPDATE `DEPLOYMENT.md`

**[DEPLOYMENT.md](../DEPLOYMENT.md) is the authoritative deployment runbook.** It documents:
- Production server inventory (IP, paths, Caddy/Docker layout)
- 5 known pitfalls with root causes and fixes (Pitfalls A–E)
- Exact deployment commands and verification checklist

**IMPORTANT**: If you encounter a new deployment pitfall not covered in `DEPLOYMENT.md`:
1. Diagnose and fix the issue
2. Add it as "Pitfall F" (or next letter) following the existing format in section "2) Known pitfalls"
3. Include: root cause, fix, and how to verify

Fast deployment path after code changes:
```bash
ssh ubuntu@43.159.200.246 'cd /srv/leesaitool/english-listening-trainer && git fetch --all && git reset --hard origin/main'
ssh ubuntu@43.159.200.246 'cd /srv/leesaitool/english-listening-trainer && sudo docker compose -f docker-compose.prod.yml up -d --build app'
curl -fsS https://leesaitool.com/api/health
```

## Testing Guidelines

- Run `npm run test:run && npm run lint` before committing
- Use MSW for API mocking in integration tests
- Test files mirror source structure under `tests/unit/`
