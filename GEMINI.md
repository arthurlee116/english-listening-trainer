# GEMINI.md

## Project Overview

This is a Next.js project that serves as an AI-powered English listening practice platform. It leverages the Cerebras AI platform for content generation and a local TTS solution called Kokoro for audio synthesis. The application is designed to help users improve their English listening comprehension through adaptive difficulty, real-time feedback, and personalized progress tracking.

The frontend is built with React, TypeScript, and Tailwind CSS, while the backend is powered by Next.js API routes and Prisma ORM. The database is SQLite for development and PostgreSQL for production.

## Building and Running

### Prerequisites

*   Node.js 20+ or Bun
*   Docker & Docker Compose
*   Git

### Environment Setup

1.  Clone the repository.
2.  Copy `.env.example` to `.env.local` and fill in the required credentials for the Cerebras API and other services.
3.  Install dependencies: `npm install`

### Running the Application

*   **Development:** `npm run dev`
*   **Production:** `npm run build` followed by `npm run start`
*   **With Docker:** `docker-compose up -d`

### Running Tests

*   **All tests:** `npm run test`
*   **Unit tests:** `npm run test:unit`
*   **Integration tests:** `npm run test:integration`
*   **E2E tests:** `npm run test:e2e`

## Development Conventions

### Code Style

*   **TypeScript:** Use explicit return types, `unknown` for uncertain types, and `const` over `let`.
*   **React:** Use PascalCase for component filenames and kebab-case for hooks and utilities.
*   **Styling:** Use Tailwind CSS utilities exclusively.
*   **Imports:** Organize imports into three groups: external packages, absolute imports, and relative imports.

### Testing

*   **Unit Tests:** Test individual functions and components in isolation, mocking external dependencies.
*   **Integration Tests:** Test component behavior with real user interactions, using Testing Library and MSW.
*   **E2E Tests:** Test complete user workflows.

### Commits

Commit messages should follow the Conventional Commits specification (e.g., `feat:`, `fix:`, `docs:`).
