## 1. Implementation
- [ ] 1.1 Review existing testing docs (`tests/README.md`, Vitest config) and capture current gaps.
- [ ] 1.2 Define CI test workflow with parallel jobs (lint/unit/integration/e2e) for push + PR.
- [ ] 1.3 Add coverage enforcement at 85% global threshold.
- [ ] 1.4 Wire deploy workflow to require test workflow success before deployment.
- [ ] 1.5 Ensure CI injects required external service secrets and aligns DB with production SQLite.
- [ ] 1.6 Add or update tests to hit the 60/30/10 layer balance target.
- [ ] 1.7 Add CI artifacts (JUnit/coverage) if useful for visibility.
- [ ] 1.8 Validate with `openspec validate <change-id> --strict --no-interactive` before implementation.
- [ ] 1.9 Run local tests and verify CI pass on a PR before merging.
