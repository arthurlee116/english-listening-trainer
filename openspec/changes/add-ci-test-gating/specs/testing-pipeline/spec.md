## ADDED Requirements
### Requirement: Layered test pipeline
The system SHALL define a layered test pipeline with unit, integration, and e2e suites, targeting an overall test distribution of 60% unit, 30% integration, and 10% e2e coverage by scope.

#### Scenario: Test suite separation
- **WHEN** a developer runs the test scripts for a specific layer
- **THEN** only tests belonging to that layer are executed

### Requirement: Global coverage enforcement
The system SHALL enforce a global test coverage threshold of at least 85% for lines, branches, functions, and statements in CI runs.

#### Scenario: Coverage below threshold
- **WHEN** the coverage report shows any global metric below 85%
- **THEN** the CI test workflow fails

### Requirement: Real-service integration scope
The system SHALL use real external services for integration and e2e tests, with credentials provided via CI environment variables.

#### Scenario: CI secrets injection
- **WHEN** the integration or e2e jobs run in CI
- **THEN** the jobs load external service credentials from configured secrets

### Requirement: Production-aligned database behavior
The system SHALL run integration and e2e tests against a database configuration aligned with production (SQLite as documented in `DEPLOYMENT.md`).

#### Scenario: CI database setup
- **WHEN** integration or e2e tests start in CI
- **THEN** the database is initialized using the production-aligned SQLite configuration
