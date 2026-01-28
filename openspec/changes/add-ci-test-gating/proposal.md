# Change: Add comprehensive CI test pipeline with deploy gating

## Why
Current test coverage and CI enforcement are insufficient to prevent regressions. Deployments are triggered on push to `main` without a required test gate, which risks shipping failures to production. We need a full, reliable testing flow that runs on all branches and enforces an 85% global coverage target, while still allowing merges to proceed.

## What Changes
- Introduce a multi-layer testing pipeline (unit/integration/e2e) with defined targets (60/30/10 weighting) and a global coverage threshold of 85%.
- Run tests on all branch pushes and all PRs with parallelized jobs.
- Gate production deployment so it only runs after all tests succeed.
- Use real external services in integration/e2e tests with CI-injected secrets; minimize mocking to unit tests.
- Align CI database setup with production (SQLite per `DEPLOYMENT.md`) and document the rationale.

## Impact
- Affected specs: `testing-pipeline`, `ci-gating`, `e2e-testing` (new capabilities).
- Affected code: `.github/workflows/`, test configuration files (`vitest` config), `package.json` scripts, `tests/` directories.
- Operational impact: CI will require secrets for external services; deployments will become dependent on successful test runs.
