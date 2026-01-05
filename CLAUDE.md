# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

English Listening Trainer is an AI-powered language learning platform built with Next.js 15. It generates personalized listening comprehension exercises using Cerebras AI for content generation and Together Kokoro-82M TTS for audio synthesis.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Prisma ORM, Cerebras AI SDK, Together TTS (Kokoro-82M), SQLite/PostgreSQL.

## Common Development Commands

```bash
# Development
npm run dev              # Start main app on port 3000
npm run admin            # Start admin dashboard on port 3005

# Build & Production
npm run build            # Production build (includes Prisma generate)
npm run start            # Start production server

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Apply database migrations
npm run db:studio        # Open Prisma Studio
npm run db:reset         # Reset database (destructive)

# Testing
npm run test:run         # Run all tests once
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # E2E tests only
npm run test:coverage    # Generate coverage report
npm run test:ui          # UI-based test runner

# Linting
npm run lint             # Run ESLint
npx tsc --noEmit         # Type checking

# TTS Setup
# Requires TOGETHER_API_KEY and an HTTP(S) proxy at http://127.0.0.1:10808
```

## Architecture Overview

### Content Generation Pipeline
1. User selects language/difficulty/focus areas
2. `/api/ai/topics` generates topics via Cerebras
3. `/api/ai/transcript` generates listening script
4. `/api/ai/questions` generates comprehension questions
5. Focus area coverage validation with automatic retry (target: 80% coverage)

### TTS Pipeline
- `/api/tts` receives text + language configuration
- `lib/together-tts-service.ts` calls Together `/v1/audio/speech` via a fixed proxy
- Audio saved under `/public/audio/`, URL returned via `/api/audio/:filename`
- Supports HTTP Range requests for audio seeking

### Authentication
- JWT tokens in HTTP-only cookies
- Server-side: `lib/auth.ts` (`requireAuth()`, `requireAdmin()`)
- Client-side: `hooks/use-auth-state.ts` with caching

## Key Architectural Patterns

### AI Service Layer (`lib/ai/`)
- **Cerebras client manager**: SDK wrapper with proxy support
- **Prompt templates**: All AI prompts centralized in `prompt-templates.ts`
- **Schemas**: Zod schemas for structured output validation
- **Retry strategy**: Exponential backoff with focus coverage validation
- **Request preprocessor**: Adapts requests based on difficulty/language

### Database Access
- Always use `withDatabase()` wrapper from `lib/database.ts` for Prisma operations
- Singleton pattern with connection management
- WAL mode enabled for SQLite

### TTS Reliability
- Together calls are proxied via `http://127.0.0.1:10808`
- `/api/health` performs a lightweight real probe (writes then deletes a `public/audio/healthcheck-*.wav` file)

### Centralized Types
- Core types (`DifficultyLevel`, `FocusArea`, etc.) in `lib/types.ts`
- Language/voice configuration in `lib/language-config.ts`

## Important Conventions

### File Naming
- Components: `PascalCase` (e.g., `AudioPlayer.tsx`)
- Utilities & services: `kebab-case` (e.g., `config-manager.ts`)
- Hooks: `kebab-case` with `use-` prefix (e.g., `use-audio-player.ts`)
- Tests: `*.test.ts` or `*.spec.ts`

### Path Aliases
- `@/` maps to project root
- Use absolute imports for internal modules: `import { foo } from '@/lib/foo'`

### Server-Side Code
- Use `server-only` package to mark modules that should only run on the server
- Never import server-only code in client components

### Import Organization
```typescript
// 1. External packages
import { useState } from 'react'
// 2. Absolute imports (@/)
import { Button } from '@/components/ui/button'
// 3. Relative imports
import { useCustomHook } from '../hooks'
```

## Search Tools Convention

**MANDATORY**: Use `exa` tools for ALL web searches. Do NOT use built-in WebSearch or Grep.

| Task | Tool | Command |
|------|------|---------|
| Local code search | `mgrep` (via skill) | `mgrep "query"` |
| Web search | `mcp__exa__web_search_exa` | `exa web search` |
| Code/API docs | `mcp__exa__get_code_context_exa` | `exa code context` |

**IMPORTANT**: Always use exa for web searches - never use built-in WebSearch or mgrep web mode.

## User Rules (from `.github/copilot-instructions.md`)

1. System: Mac/Windows with M4 processor, 32GB RAM
2. Verify interfaces by reading actual code - never guess
3. Seek confirmation for ambiguities
4. Reuse existing code patterns instead of creating new ones
5. Test changes before reporting completion
6. Don't open browser preview after every task

## Testing Notes

- Coverage thresholds: 70% line, 60% branch, 80% function
- Test structure: `tests/unit/`, `tests/integration/`, `tests/e2e/`
- Use MSW for API mocking
- Fixtures in `tests/fixtures/`
- See `tests/README.md` for detailed conventions

## Environment Variables

Key variables (see `.env.example` for full list):
- `DATABASE_URL`: SQLite for dev, PostgreSQL for production
- `CEREBRAS_API_KEY`: Required for AI features
- `JWT_SECRET`: For session management
- `TOGETHER_API_KEY`: Required for TTS
- `TOGETHER_TTS_MODEL`: Defaults to `hexgrad/Kokoro-82M`
- `AI_DEFAULT_MODEL`: Default LLM model
- `NEXT_PUBLIC_APP_URL`: Application URL

## Troubleshooting

- **Together TTS errors**: Check `TOGETHER_API_KEY` and ensure proxy is running at `http://127.0.0.1:10808`
- **Database errors**: Check `DATABASE_URL`, run `npm run db:migrate`
- **AI timeouts**: Check `AI_TIMEOUT` setting, verify Cerebras API access
- **Audio issues**: Verify `Range` header support, check browser permissions

## Deployment (Authoritative)

Read `DEPLOYMENT.md` for:
- the real production server inventory (IP, paths, Caddy/Docker layout)
- the exact deployment commands to run after changes
- the “known pitfalls” section (Cerebras base URL, Prisma/OpenSSL, SQLite mounts, proxy wiring, etc.)
