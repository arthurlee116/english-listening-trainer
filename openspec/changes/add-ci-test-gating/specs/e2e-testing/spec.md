## ADDED Requirements
### Requirement: E2E runner and environment
The system SHALL provide an e2e test runner that executes against the full application stack using real external services and a production-aligned database.

#### Scenario: E2E smoke run
- **WHEN** the e2e suite is executed in CI
- **THEN** tests run against a running app instance with real external service credentials

### Requirement: Parallel test execution
The system SHALL execute unit, integration, and e2e test jobs in parallel where possible to reduce CI time.

#### Scenario: Parallel jobs
- **WHEN** a CI run starts
- **THEN** unit, integration, and e2e jobs run concurrently

### Requirement: Stable, scoped E2E coverage
The system SHALL keep the e2e suite focused on critical user journeys to maintain reliability with real external services.

#### Scenario: Critical path coverage
- **WHEN** the e2e suite runs
- **THEN** it validates at least one end-to-end user flow that exercises AI generation and TTS output
