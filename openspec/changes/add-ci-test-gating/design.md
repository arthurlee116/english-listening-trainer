## Context
The repository has a Next.js + Prisma stack with a production deployment via GitHub Actions (`deploy.yml`) that runs on pushes to `main`. The current deployment has no automated test gate. The project uses real AI/TTS services and a production SQLite database (per `DEPLOYMENT.md`), while other docs mention PostgreSQL; the deployment runbook is the authoritative source for production behavior.

## Goals / Non-Goals
- Goals:
  - Enforce a reliable CI testing pipeline on all branch pushes and PRs.
  - Require successful tests before deployment to production.
  - Achieve a global coverage threshold of 85%.
  - Use real external services and production-aligned database behavior for integration/e2e tests.
  - Keep the implementation minimal and explicit.
- Non-Goals:
  - Rewriting the entire test suite in one step.
  - Changing production database type.
  - Migrating CI to a different platform.

## Decisions
- Decision: Split tests into unit, integration, and e2e layers with parallel CI jobs.
  - Why: parallelism shortens CI time while preserving clarity and isolation.
- Decision: Count coverage globally at 85% using Vitest coverage tooling.
  - Why: a single global threshold is simple to enforce and aligns with the requested requirement.
- Decision: Use production-aligned SQLite for CI integration/e2e tests by default.
  - Why: the authoritative deployment runbook states SQLite as production; using SQLite minimizes mismatch risk.
- Decision: Use real external services for integration/e2e tests with CI-injected secrets; keep unit tests mocked.
  - Why: this matches the request for realistic testing while maintaining unit test speed.
- Decision: Implement deploy gating by tying `deploy.yml` to a test workflow success.
  - Why: ensures deployments never run on failing tests while still allowing merges.

## Risks / Trade-offs
- Risk: Real external service dependencies introduce flakiness and quota limits.
  - Mitigation: timeouts, retries on transient network errors, and careful test scope selection.
- Risk: Global 85% coverage may fail initially due to legacy test gaps.
  - Mitigation: incremental coverage improvements, or temporary allowlist if needed (explicitly documented).
- Risk: SQLite in CI might diverge from non-SQLite development environments.
  - Mitigation: document the production database source of truth and keep Prisma schemas compatible.

## Migration Plan
1. Add CI workflow for layered tests and coverage reporting.
2. Update deploy workflow to depend on test workflow success.
3. Adjust Vitest configuration to enforce 85% global coverage.
4. Introduce or update tests to match the 60/30/10 structure.
5. Verify CI with a trial PR and adjust timeouts/retries if needed.

## Open Questions
- None. Production DB type is taken from `DEPLOYMENT.md` as authoritative.
