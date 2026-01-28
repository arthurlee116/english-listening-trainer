## ADDED Requirements
### Requirement: Mobile bottom tab navigation for core flows
The system SHALL present a bottom tab bar on mobile viewports that exposes the core flows: Practice, History, Wrong Answers, and Assessment.

#### Scenario: Switch core flow from tab bar
- **WHEN** the user taps a bottom tab
- **THEN** the current step updates to the corresponding flow without adding extra steps

### Requirement: Mobile drawer for secondary actions
The system SHALL provide a mobile drawer that contains secondary actions, including language switch and admin link (when eligible).

#### Scenario: Access secondary actions
- **WHEN** the user opens the mobile drawer
- **THEN** secondary actions are visible and usable without leaving the current flow

### Requirement: Personal screen for logout
The system SHALL provide a personal/profile screen on mobile where logout is available.

#### Scenario: Log out from personal screen
- **WHEN** the user selects logout on the personal screen
- **THEN** the session ends and the user returns to the unauthenticated state
