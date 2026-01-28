## ADDED Requirements
### Requirement: Mobile-first setup layout order
The system SHALL render the setup flow on mobile with the configuration section above the recommended topics list.

#### Scenario: View setup on mobile
- **WHEN** the user is on the setup step in a mobile viewport
- **THEN** configuration appears before recommended topics in the scroll order

### Requirement: Floating, collapsible configuration on mobile
The system SHALL provide a floating configuration card on mobile that can be expanded or collapsed, defaulting to collapsed state.

#### Scenario: Expand configuration card
- **WHEN** the user taps the configuration affordance
- **THEN** the configuration panel expands and remains accessible during scrolling

### Requirement: Mobile layout without top header
The system SHALL hide the global header on mobile viewports to maximize vertical space.

#### Scenario: Mobile page chrome
- **WHEN** the user views any main app screen on mobile
- **THEN** the top header is not rendered and content starts near the top safe area

### Requirement: Mobile-safe spacing for fixed navigation
The system SHALL ensure primary content is not obscured by the bottom tab bar and respects device safe areas.

#### Scenario: Content near bottom
- **WHEN** the user scrolls to the end of a screen on mobile
- **THEN** the last interactive content remains fully visible above the tab bar
