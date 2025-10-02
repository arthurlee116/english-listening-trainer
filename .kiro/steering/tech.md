# Tech Stack

## Core Technologies

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode enabled)
- **Runtime**: Node.js 18+
- **Database**: Prisma + SQLite (WAL mode)
- **UI**: React 19, shadcn/ui, Tailwind CSS, Radix UI
- **Styling**: Tailwind CSS with tailwindcss-animate
- **Theme**: next-themes for light/dark mode
- **i18n**: i18next, react-i18next with lazy loading
- **Forms**: react-hook-form + zod validation
- **Auth**: JWT cookies with bcryptjs
- **AI**: Cerebras Cloud SDK
- **TTS**: Kokoro (Python 3.8-3.12, PyTorch)

## Testing

- **Framework**: Vitest with jsdom
- **Testing Library**: @testing-library/react
- **Coverage**: v8 provider (60% branches, 80% functions, 70% lines)
- **Mocking**: MSW for API mocking

## Common Commands

```bash
# Development
npm run dev                    # Start dev server (port 3000)
npm run admin                  # Start admin dashboard (port 3005)
npm run setup-kokoro           # Initialize Kokoro TTS (first time)

# Database
npm run db:generate            # Generate Prisma client
npm run db:migrate             # Run migrations
npm run db:studio              # Open Prisma Studio
npm exec tsx scripts/seed-user-db.ts  # Seed admin user

# Testing
npm test                       # Run tests in watch mode
npm run test:run               # Run tests once
npm run test:coverage          # Run with coverage report
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only
npm run test:e2e               # E2E tests only

# Build & Deploy
npm run build                  # Build for production
npm run start                  # Start production server
npm run lint                   # Run ESLint

# Utilities
npm run verify-env             # Verify environment variables
npm run verify-i18n-setup      # Verify i18n configuration
```

## Environment Variables

Required in `.env.local`:

```bash
CEREBRAS_API_KEY=              # Cerebras API key
JWT_SECRET=                    # JWT signing secret
DATABASE_URL=file:./data/app.db
PYTORCH_ENABLE_MPS_FALLBACK=1  # For Apple Silicon

# Optional
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin123456
ADMIN_NAME=System Administrator
CEREBRAS_PROXY_URL=            # HTTP proxy for Cerebras API
```

## Path Aliases

TypeScript paths configured in `tsconfig.json`:

```typescript
"@/*" → "./*"
```

Usage: `import { Component } from '@/components/ui/button'`

## Build Configuration

- **Output**: Standalone mode for Docker deployment
- **Images**: Unoptimized (for Docker compatibility)
- **TypeScript**: Build errors ignored (set `ignoreBuildErrors: false` for strict builds)
- **ESLint**: Ignored during builds (run separately)

## Performance Notes

- TTS first load: 3-5s (model loading)
- TTS generation: 2-8s (text-dependent)
- TTS memory: 1-2GB RAM
- Apple Silicon: Automatic MPS acceleration
- Auth caching: Client-side + server-side TTL caches
- i18n: Lazy-loaded translations with format caching
