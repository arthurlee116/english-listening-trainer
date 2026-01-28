## ADDED Requirements
### Requirement: Test gating for production deploy
The system SHALL prevent the production deployment workflow from running unless all CI test jobs succeed.

#### Scenario: Failed test run
- **WHEN** any test job fails in the CI workflow
- **THEN** the production deploy workflow does not run

### Requirement: Non-blocking merges
The system SHALL allow merging changes even if tests fail, while still blocking deployment.

#### Scenario: Merge with failing tests
- **WHEN** a pull request is merged despite failing tests
- **THEN** the deployment workflow remains gated and does not execute

### Requirement: All-branches CI execution
The system SHALL run the CI test workflow on all branch pushes and on all pull requests.

#### Scenario: Feature branch push
- **WHEN** a developer pushes to any branch
- **THEN** the CI test workflow triggers and runs the full test matrix
