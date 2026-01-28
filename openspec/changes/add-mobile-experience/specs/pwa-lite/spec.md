## ADDED Requirements
### Requirement: Lightweight PWA installability
The system SHALL provide a web app manifest and platform icons to enable add-to-home-screen on supported browsers.

#### Scenario: Install prompt eligibility
- **WHEN** a supported mobile browser visits the app
- **THEN** the app meets installability requirements via manifest and icons

### Requirement: No offline or service worker behavior
The system SHALL NOT introduce offline caching or service worker logic as part of this change.

#### Scenario: PWA scope behavior
- **WHEN** the app is installed or launched
- **THEN** network behavior remains unchanged from the current online-only experience
