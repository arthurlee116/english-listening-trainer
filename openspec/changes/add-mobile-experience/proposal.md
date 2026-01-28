# Change: Add first-class mobile experience with bottom tab navigation and lite PWA

## Why
The current UI is desktop-first. Mobile users (iPhone 12+) need equal functionality without extra steps or hidden features.

## What Changes
- Add mobile-first navigation: bottom tab bar for core flows, drawer for secondary items.
- Remove the mobile header; move logout into a personal/profile screen.
- Rework the setup step layout for mobile (configuration first, floating & collapsible).
- Align admin page styling with main app on mobile while keeping tables usable via horizontal scroll.
- Add lightweight PWA support (manifest + icons + iOS meta), no offline service worker.

## Impact
- Affected specs: mobile-navigation, mobile-layout, admin-mobile, pwa-lite
- Affected code: `components/main-app.tsx`, `components/app-layout-with-sidebar.tsx`, `components/navigation/*`, `lib/navigation/config.ts`, `app/admin/page.tsx`, `app/layout.tsx`, `app/globals.css`, `public/`, `next.config.mjs` (if needed)
