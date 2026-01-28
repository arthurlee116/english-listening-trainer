## Context
Mobile users (iPhone 12+) must access all features without added steps. Current layout is desktop-first with a top header and sidebar. The app already has a mobile sidebar overlay but lacks a mobile-primary navigation pattern and mobile-optimized layout for the setup step.

## Goals / Non-Goals
- Goals:
  - Provide a bottom tab bar for core flows with a secondary drawer for everything else.
  - Keep all core functionality visible on mobile without extra steps.
  - Reorder the setup experience on mobile: configuration first, topics second.
  - Keep desktop and tablet behavior unchanged.
  - Add lightweight PWA installation affordances without offline support.
- Non-Goals:
  - Offline mode, caching, or service workers.
  - Major redesign of the TCP concept lab.
  - New backend APIs or schema changes.

## Decisions
- Decision: Bottom tab bar for primary flows (Practice, History, Wrong Answers, Assessment). Secondary actions (language, admin, external links) move into a mobile drawer.
  - Rationale: iPhone-first ergonomics and predictable navigation; keeps core tasks one-tap away.
- Decision: Remove the mobile header and place logout inside a dedicated personal/profile screen.
  - Rationale: header consumes vertical space; personal area aligns with user expectation and keeps logout accessible but not intrusive.
- Decision: Mobile setup layout uses a floating configuration card that can collapse by default; recommended topics appear below.
  - Rationale: configuration stays accessible while preserving scrollable content and reducing initial cognitive load.
- Decision: Admin tables remain in table layout with horizontal scroll on mobile; visual styling aligns with main app palette.
  - Rationale: lowest-risk change while preserving dense data views.
- Decision: Implement lite PWA (manifest + icons + iOS meta) without a service worker.
  - Rationale: improves installability with minimal risk to runtime behavior.

## Risks / Trade-offs
- Adding a profile screen introduces a new state in the main workflow; needs careful state handling to avoid breaking exercise flow.
- Collapsible configuration may hide context if the default state is too aggressive; ensure an obvious affordance and remember state where possible.
- Aligning admin styling with the main theme may reduce visual separation; keep admin-specific accents subtle but clear.

## Migration Plan
- No data migration required.
- Layout and navigation changes are client-only.
- PWA assets can be added without impacting current URLs.

## Open Questions
- None (requirements resolved in discovery).
