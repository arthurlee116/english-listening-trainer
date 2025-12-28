# English Listening Trainer - AI Coding Instructions

## Project Overview
AI-powered language learning platform using Next.js 15, React 19, Prisma, Cerebras AI (content), and local Kokoro TTS (audio).

## Architecture & Data Flow

### 1. AI Content Pipeline (`lib/ai/`)
- **Cerebras Integration**: Use `invokeStructured()` for all AI calls with Zod schemas.
- **Prompt Templates**: Centralized in `lib/ai/prompt-templates.ts`.
- **Validation**: Automatic retry with exponential backoff if focus area coverage < 80%.
- **Telemetry**: All AI requests are tracked via `lib/ai/telemetry.ts`.

### 2. TTS Pipeline (`lib/kokoro-service-gpu.ts`)
- **Local Synthesis**: Uses Python worker with CoreML/ANE on Apple Silicon.
- **Streaming**: Supports HTTP Range requests for audio seeking.
- **Circuit Breaker**: Monitored in `lib/kokoro-service-gpu.ts`; check for `Circuit breaker: OPEN`.
- **Audio Storage**: Generated audio is saved to `public/audio/` and served via `/api/audio/[filename]`.

### 3. Database Access (`lib/database.ts`)
- **Wrapper**: Always use `withDatabase()` for Prisma operations to ensure proper error handling and retries.
  ```typescript
  const result = await withDatabase(async (prisma) => {
    return await prisma.user.findUnique({ where: { id } });
  }, 'fetch user');
  ```
- **WAL Mode**: Enabled for SQLite to support higher concurrency.

### 4. Bilingual UI System
- **Components**: Use `BilingualText` for UI labels. Prefer `BilingualDialog`, `BilingualAlertDialog`, and `BilingualLoading` for complex UI elements.
- **Hooks**: Use `useBilingualText` for programmatic translations.
- **Format**: "English 中文" (e.g., `t('common.buttons.generate')` -> "Generate 生成").
- **Translations**: Centralized in `lib/i18n/translations/` (common, components, pages).

## Coding Conventions

### 1. Naming & Structure
- **Components**: `PascalCase` (e.g., `AudioPlayer.tsx`).
- **Hooks/Utils**: `kebab-case` (e.g., `use-audio-player.ts`, `config-manager.ts`).
- **Path Aliases**: Always use `@/` for absolute imports.
- **Server-Only**: Use `import 'server-only'` in modules that must not reach the client.

### 2. Import Organization
1. External packages (React, Lucide, etc.)
2. Absolute imports (`@/components/...`, `@/lib/...`)
3. Relative imports (`../hooks/...`)

## Performance & Caching
- **Auth**: Cached in `hooks/use-auth-state.ts` with 15-min TTL.
- **Audio**: Preload `metadata` only; cache duration info.
- **LRU Cache**: Use for frequently accessed data (e.g., translation lookups).

## Testing Guidelines
- **Framework**: Vitest + Testing Library + MSW.
- **Structure**: `tests/unit/`, `tests/integration/`, `tests/e2e/`.
- **Coverage**: Aim for 70% line, 60% branch, 80% function.

## Critical Workflows
- `npm run dev-kokoro`: Start dev server with local TTS support.
- `npm run db:migrate`: Apply schema changes.
- `npm run setup-kokoro`: Initialize TTS environment (Python venv, models).
- `npm run test:run`: Execute full test suite.

## Key Files & Directories
- `lib/ai/cerebras-service.ts`: Core AI invocation logic (`invokeStructured`).
- `lib/kokoro-service-gpu.ts`: TTS service management.
- `lib/database.ts`: Database connection and `withDatabase` wrapper.
- `components/ui/bilingual-text.tsx`: Primary component for bilingual text.
- `lib/i18n/translations/`: JSON translation files.
