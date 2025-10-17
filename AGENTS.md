# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds Next.js route handlers, layouts, and global styles; keep new pages in feature folders under `app/`.
- `components/` contains reusable UI and form primitives shared across views.
- `lib/` groups domain services (TTS, AI analysis, Kokoro) plus configuration helpers; co-locate new service modules here.
- `lib/ai/` centralizes Ark/Cerebras integrations (`ark-helper`, `cerebras-client-manager`, `prompt-templates`, `schemas`, `telemetry`, `transcript-expansion`) with shared retry/coverage logic.
- `prisma/schema.prisma` owns the database model; migrations now run via Prisma CLI (`npm run db:migrate`).
- Tests are split across `__tests__/` (unit, integration, e2e) and `src/test/` fixtures; assets and public audio reside under `public/` and `data/`.

## Build, Test, and Development Commands
- `npm run dev` starts the Next dev server on port 3000 with hot reload.
- `npm run build` runs `prisma generate` and compiles the production Next bundle.
- `npm run start` serves the built app; use after `npm run build`.
- `npm run test` runs the full Vitest suite; append `--run` for CI-friendly mode.
- `npm run db:migrate` applies local migrations; `npm run db:seed` populates sample content.
- `npm run admin` boots the admin companion server; use `npm run admin-dev` when iterating on admin features.

## Coding Style & Naming Conventions
- TypeScript is required; prefer explicit return types on exported functions and keep file names kebab-case (e.g. `user-progress.ts`).
- React components use PascalCase filenames and default exports when shared broadly.
- Follow ESLint and `next lint`; run `npm run lint` before submitting.
- Tailwind utilities are the default styling tool; colocate component styles via class names instead of new CSS modules.

## Testing Guidelines
- Vitest powers unit and integration tests; Testing Library covers React behavior, while `__tests__/e2e` holds higher-level flows.
- Name tests after the feature under test (`feature-name.test.ts`) and mirror the source folder structure.
- Keep new tests deterministic; mock external APIs like TTS or Cerebras SDK using local fixtures in `__tests__/utils`.
- Aim for meaningful assertions around audio rendering, AI feedback, and Prisma interactions; add smoke tests when introducing new routes.

## Commit & Pull Request Guidelines
- Align with lightweight Conventional Commits (`feat:`, `fix:`, `docs:`). Keep messages ≤72 characters and note user-facing language updates.
- Pull requests should include: summary, testing notes (commands run), linked issue or doc reference, and screenshots/GIFs for UI changes.
- Request review from domain owners when touching `lib/` AI services or Prisma schema. Add migration notes in the PR body when schema changes occur.

## Environment & Data Setup
- Copy `.env.example` to `.env.local` and run `npm run verify-env` before starting.
- Use `npm run docker:dev-db` for a throwaway Postgres instance, or `npm run db:reset` to refresh the local database.
- Align AI configuration envs (`AI_DEFAULT_MODEL`, `AI_DEFAULT_TEMPERATURE`, `AI_DEFAULT_MAX_TOKENS`, `AI_TIMEOUT`, `AI_MAX_RETRIES`) with the defaults in `lib/config-manager.ts`.
- Track sensitive credentials in `admin_cookies.txt`/`test_cookies.txt` only for local debugging—do not commit or share externally.

## User Rule (Superimportant)
1. My system is Mac/Windows.
2. My system has a M4 processor.
3. My system  has 32GB of RAM.
4. 以暗猜接口为耻，以认真查阅为荣。
5. 以模糊执行为耻，以寻求确认为荣。
6. 以盲想业务为耻，以人类确认为荣。
7. 以创造接口为耻，以复用现有为荣。
8. 以跳过验证为耻，以主动测试为荣。
9. 以破坏架构为耻，以遵循规范为荣。
10. 以假装理解为耻，以诚实无知为荣。
11. 以盲目修改为耻，以谨慎重构为荣。
12. 不要每次完成任务都打开一个brower preview
