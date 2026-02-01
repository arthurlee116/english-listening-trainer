# Change: Add visitor cover card for logged-in users

## Why
Provide a friendly, personalized cover card showing the user's registration order and contact info to encourage feedback.

## What Changes
- Add a logged-in-only cover card at the top of main content with registration-rank copy and contact info.
- Add API endpoint to return registration rank and total user count.
- Add i18n copy for the cover card.

## Impact
- Affected specs: visitor-cover (new)
- Affected code: app/api, components/home, components/main-app, translations
