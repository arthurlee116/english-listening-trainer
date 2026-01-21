# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains Next.js App Router pages and API routes.
- `components/`, `hooks/`, and `lib/` hold reusable UI, React hooks, and shared services.
- `prisma/` stores the schema and migrations; `public/` serves static assets.
- `tests/` includes unit, integration, and e2e suites.
- `scripts/` provides admin and setup utilities.

## Build, Test, and Development Commands
- `npm run dev`: start the Next.js dev server.
- `npm run build`: generate Prisma client and build for production.
- `npm run start`: run the production server on port 3000.
- `npm run lint`: run ESLint (Next.js config).
- `npm run test`: run Vitest in watch mode; `npm run test:run` for CI style runs.
- `npm run db:migrate` / `npm run db:generate`: apply migrations or regenerate Prisma client.
- TTS uses Together Kokoro-82M; requires `TOGETHER_API_KEY` and a proxy at `http://127.0.0.1:10808`.

## Coding Style & Naming Conventions
- TypeScript + React with Tailwind CSS; follow ESLint output in `eslint.config.mjs`.
- Prefer `PascalCase` for component files (e.g., `AudioPlayer.tsx`).
- Use `kebab-case` for hooks and utilities (e.g., `use-audio-player.ts`).
- Keep modules focused and colocate related helpers in `lib/`.

## Testing Guidelines
- Vitest is the primary runner; Testing Library is used for UI tests.
- Place tests under `tests/unit`, `tests/integration`, and `tests/e2e`.
- Name tests `*.test.ts` or `*.spec.ts` and keep assertions focused on behavior.

## Commit & Pull Request Guidelines
- Recent history uses Conventional Commits with optional scopes, e.g. `feat(news): ...` or `refactor: ...`.
- Keep commits small and descriptive; include context for AI/TTS or DB changes.
- PRs should include a clear description, linked issues (if any), and screenshots for UI updates.
- Confirm `npm run test:run` and `npm run lint` before requesting review.

## Configuration & Secrets
- Copy `.env.example` (or `.env.production.example`) to `.env.local` for local setup.
- Do not commit real API keys; use placeholders in examples.

## Deployment (Authoritative)

Read `DEPLOYMENT.md` before making any production changes. After changing code, follow the “Routine deployment after code changes (fast path)” section in `DEPLOYMENT.md`.

## CI/CD & Docker Registry

The project uses GitHub Actions for manual image builds and pushing to GitHub Container Registry (GHCR):
- Workflow: `.github/workflows/build-and-push.yml`
- Registry: `ghcr.io/`
- Target: `runtime` layer of the `Dockerfile`
- Platform: `linux/amd64`
- Cache: Registry-based multi-layer cache (`cache-base`, `cache-python`, `cache-node`, `cache-builder`)

To manually trigger a build:
1. Go to GitHub Actions -> "Build and Push Docker Image (Manual)"
2. Choose branch and build options (e.g., `rebuild-cache` for builder layer)
3. Ensure `GHCR_PAT` secret is configured in the repository

## Search Tools Convention

**MANDATORY**: Use `exa` tools for ALL web searches. Do NOT use built-in WebSearch or Grep.

| Task | Tool | Command |
|------|------|---------|
| Local code search | `mgrep` (via skill) | `mgrep "query"` |
| Web search | `mcp__exa__web_search_exa` | `exa web search` |
| Code/API docs | `mcp__exa__get_code_context_exa` | `exa code context` |

**IMPORTANT**: Always use exa for web searches - never use built-in WebSearch.
