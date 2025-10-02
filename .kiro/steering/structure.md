# Project Structure

## Root Organization

```
app/                    # Next.js App Router pages and API routes
components/             # React components
lib/                    # Core business logic and services
hooks/                  # Custom React hooks
prisma/                 # Database schema and migrations
tests/                  # Test suites (unit, integration, e2e)
scripts/                # Utility scripts
kokoro-local/           # Local TTS engine and Python environment
public/                 # Static assets and generated audio files
data/                   # SQLite database files
documents/              # Project documentation
```

## App Directory (Next.js App Router)

```
app/
├── page.tsx                    # Main application page
├── layout.tsx                  # Root layout with providers
├── globals.css                 # Global styles
├── admin/                      # Admin dashboard pages
└── api/                        # API routes
    ├── ai/                     # AI generation endpoints
    │   ├── topics/             # Topic generation
    │   ├── transcript/         # Transcript generation
    │   ├── questions/          # Question generation
    │   ├── grade/              # Answer grading
    │   └── wrong-answers/      # Wrong answer analysis
    ├── auth/                   # Authentication endpoints
    │   ├── login/
    │   ├── register/
    │   ├── logout/
    │   └── me/
    ├── tts/                    # Text-to-speech endpoint
    ├── practice/               # Practice session management
    └── admin/                  # Admin API endpoints
```

## Components

```
components/
├── ui/                         # shadcn/ui components (Radix UI wrappers)
│   ├── bilingual-*.tsx         # Bilingual UI components
│   └── *.tsx                   # Standard UI primitives
├── providers/                  # React context providers
├── examples/                   # Component demos and examples
├── main-app.tsx                # Main application component
├── question-interface.tsx      # Question display and interaction
├── audio-player.tsx            # Audio playback component
├── history-panel.tsx           # Practice history display
├── achievement-panel.tsx       # Achievement tracking
├── wrong-answers-book.tsx      # Wrong answer review
└── *-error-boundary.tsx        # Error boundary components
```

## Library (Core Logic)

```
lib/
├── i18n/                       # Internationalization
│   ├── config.ts               # i18n configuration
│   ├── translations/           # Translation files (JSON)
│   ├── performance.ts          # i18n performance monitoring
│   └── memory-management.ts    # Translation cache management
├── ai-service.ts               # AI content generation
├── ai-analysis-service.ts      # Wrong answer AI analysis
├── kokoro-service.ts           # TTS service (CPU)
├── kokoro-service-gpu.ts       # TTS service (GPU)
├── auth.ts                     # Authentication logic
├── database.ts                 # Prisma client and DB utilities
├── storage.ts                  # LocalStorage utilities
├── achievement-service.ts      # Achievement tracking
├── focus-metrics.ts            # Performance metrics
├── audio-cleanup-service.ts    # Audio file cleanup
└── types.ts                    # TypeScript type definitions
```

## Hooks

```
hooks/
├── use-auth-state.ts           # Authentication state management
├── use-exercise-workflow.ts    # Exercise flow orchestration
├── use-bilingual-text.ts       # Bilingual text formatting
├── use-hotkeys.ts              # Keyboard shortcuts
├── use-theme-classes.ts        # Theme-aware styling
└── use-legacy-migration.ts     # Data migration utilities
```

## Tests

```
tests/
├── unit/                       # Unit tests
│   ├── components/             # Component tests
│   ├── hooks/                  # Hook tests
│   ├── lib/                    # Service/utility tests
│   └── utils/                  # Helper function tests
├── integration/                # Integration tests
│   ├── api/                    # API endpoint tests
│   ├── components/             # Component integration tests
│   └── flows/                  # User flow tests
├── e2e/                        # End-to-end tests
├── fixtures/                   # Test data and fixtures
├── helpers/                    # Test utilities
│   ├── test-setup.ts           # Vitest setup
│   ├── render-utils.tsx        # Testing Library helpers
│   └── api-mocks.ts            # MSW mock handlers
└── __mocks__/                  # Module mocks
```

## Naming Conventions

- **Components**: PascalCase (`MainApp.tsx`, `AudioPlayer.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAuthState.ts`)
- **Services**: kebab-case (`ai-service.ts`, `kokoro-service.ts`)
- **API Routes**: kebab-case folders (`app/api/auth/login/route.ts`)
- **Types**: PascalCase interfaces/types in `lib/types.ts`
- **Test Files**: `*.spec.tsx` or `*.test.tsx`

## Import Patterns

```typescript
// Absolute imports using @ alias
import { Button } from '@/components/ui/button'
import { useAuthState } from '@/hooks/use-auth-state'
import { aiService } from '@/lib/ai-service'

// Relative imports for co-located files
import { helper } from './helper'
```

## File Conventions

- **API Routes**: `route.ts` (Next.js App Router convention)
- **Pages**: `page.tsx` (Next.js App Router convention)
- **Layouts**: `layout.tsx` (Next.js App Router convention)
- **Client Components**: Add `'use client'` directive at top
- **Server Components**: Default (no directive needed)
- **Server-only code**: Import `'server-only'` package

## Key Files

- `prisma/schema.prisma` - Database schema
- `vitest.config.ts` - Test configuration
- `tailwind.config.ts` - Tailwind configuration
- `next.config.mjs` - Next.js configuration
- `tsconfig.json` - TypeScript configuration
- `.env.local` - Local environment variables (not committed)
- `package.json` - Dependencies and scripts
