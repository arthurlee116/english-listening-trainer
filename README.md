# English Listening Trainer

A comprehensive, AI-powered English listening practice platform built with Next.js, featuring adaptive difficulty, real-time feedback, and personalized progress tracking.

**Version:** v1.3.0 | **Status:** Production Ready

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Installation & Setup](#installation--setup)
- [Development Guide](#development-guide)
- [Usage Guide](#usage-guide)
- [API Reference](#api-reference)
- [Architecture Overview](#architecture-overview)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Changelog](#changelog)

---

## Overview

**English Listening Trainer** is an intelligent language learning platform designed to help users improve English listening comprehension through AI-generated content, adaptive difficulty assessment, and comprehensive progress analytics. The platform leverages **Cerebras API** for intelligent content generation and **Kokoro TTS** for high-quality audio synthesis.

### Problem Statement

Traditional listening practice often lacks:
- **Adaptive difficulty scaling** based on individual performance
- **Intelligent content generation** tailored to learning goals
- **Detailed error analysis** and targeted feedback
- **Real-time progress tracking** across multiple skill dimensions

### Target Audience

- English language learners (intermediate to advanced)
- Self-directed learners seeking structured practice
- Educational institutions requiring adaptive learning platforms
- Users seeking personalized, data-driven feedback

---

## Features

### Core Capabilities

- **🎯 AI-Powered Content Generation**
  - Topic generation via Cerebras API with difficulty customization
  - Automatic transcript creation from synthesized speech
  - Intelligent multiple-choice and short-answer question generation
  - Focus area coverage validation and automatic regeneration on low coverage

- **🎤 Advanced Audio Synthesis**
  - Local Kokoro TTS integration with GPU acceleration support
  - Multi-language support (English, Spanish, French, Japanese, Italian, Portuguese, Hindi)
  - Variable speech rate and natural voice characteristics
  - Streaming audio delivery with HTTP Range support

- **📊 Comprehensive Assessment & Analytics**
  - Real-time grading with confidence scoring
  - Detailed AI analysis of incorrect answers with related examples
  - Focus area mastery tracking across 10 skill dimensions
  - Achievement badges and personalized learning recommendations
  - User performance trends and weekly statistics

- **🔐 Secure Authentication & User Management**
  - JWT-based session management with optional "Remember Me"
  - Secure password hashing using bcryptjs
  - User progress persistence across sessions
  - Admin dashboard for system monitoring

- **🌍 Multi-Language Support**
  - Full bilingual UI (English/Chinese)
  - Language-specific content generation
  - Adaptive prompts based on selected learning language

- **📱 Responsive Design & Accessibility**
  - Mobile-optimized interface using Tailwind CSS
  - Keyboard shortcut support for power users
  - Audio player with seek/range controls
  - Progressive enhancement for offline capability

---

## Technology Stack

### Frontend
- **Next.js 15** (App Router) — Modern React framework with optimized performance
- **React 19** — UI component library
- **TypeScript** — Type-safe development
- **Tailwind CSS** — Utility-first styling
- **Radix UI** — Headless component primitives
- **React Hook Form** — Form state management
- **Recharts** — Data visualization

### Backend & Services
- **Next.js API Routes** — Serverless function handlers
- **Prisma ORM** — Database abstraction layer
- **Cerebras API** — AI content generation and analysis
- **Kokoro TTS** — Text-to-speech synthesis (local)
- **OpenAI TTS** — Fallback audio generation

### Database
- **SQLite** — Development database
- **PostgreSQL** — Production database

### DevOps & Deployment
- **Docker & Docker Compose** — Containerization with multi-stage builds
- **GitHub Actions** — CI/CD pipeline with multi-level caching
- **GHCR (GitHub Container Registry)** — Image registry

### Testing & Quality
- **Vitest** — Unit and integration testing framework
- **Testing Library** — React component testing
- **MSW (Mock Service Worker)** — API mocking for tests
- **ESLint** — Code linting

---

## Installation & Setup

### Prerequisites

- **Node.js** 20+ or **Bun** runtime
- **Docker & Docker Compose** (for containerized development)
- **Git** for version control
- **M4 processor recommended** (verified on Apple Silicon and x86-64 systems)
- **32GB RAM recommended** for GPU-accelerated TTS

### Environment Configuration

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/english-listening-trainer.git
   cd english-listening-trainer
   ```

2. **Copy environment template:**
   ```bash
   cp .env.example .env.local
   ```

3. **Configure `.env.local` with required credentials:**
   ```env
   # Database
   DATABASE_URL="file:./dev.db"  # SQLite for development
   # DATABASE_URL="postgresql://user:password@localhost:5432/listening_trainer"  # PostgreSQL for production

   # Cerebras API (required for AI features)
   CEREBRAS_API_KEY=your_cerebras_api_key_here
   CEREBRAS_API_BASE_URL=https://api.cerebras.ai/v1
   AI_DEFAULT_MODEL=llama-3.1-70b
   AI_DEFAULT_TEMPERATURE=0.7
   AI_DEFAULT_MAX_TOKENS=2048
   AI_TIMEOUT=30000
   AI_MAX_RETRIES=3

   # Kokoro TTS (optional, defaults to local if available)
   KOKORO_ENABLED=true
   KOKORO_DEVICE=auto

   # OpenAI (fallback TTS)
   OPENAI_API_KEY=your_openai_api_key_if_using_fallback

   # Application
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NODE_ENV=development
   ```

4. **Verify environment configuration:**
   ```bash
   npm run verify-env
   ```

### Installation Steps

#### Option A: Local Development Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Create/migrate database
npm run db:migrate

# Seed database with sample content (optional)
npm run db:seed

# Start development server (includes hot reload)
npm run dev
```

Access the application at `http://localhost:3000`

#### Option B: Docker Compose Setup

```bash
# Start with database
npm run docker:dev-db

# In another terminal, start application
npm run dev

# Alternatively, use Docker Compose for complete stack
docker-compose up -d
```

#### Option C: GPU-Accelerated TTS Setup

```bash
# Install and configure Kokoro TTS with GPU support
npm run setup-kokoro

# Start dev server with Kokoro enabled
npm run dev-kokoro
```

---

## Development Guide

### Build & Compilation

```bash
# Production build (includes Prisma generation)
npm run build

# Production build only (assumes Prisma already generated)
npm run start
```

### Testing

```bash
# Run all tests (watch mode)
npm run test

# Run tests once (CI mode)
npm run test:run

# Run specific test suite
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only

# Generate coverage report
npm run test:coverage

# UI-based test runner
npm run test:ui
```

### Database Operations

```bash
# Apply pending migrations
npm run db:migrate

# Deploy migrations (production)
npm run db:deploy

# Open Prisma Studio (visual database editor)
npm run db:studio

# Reset database (destructive)
npm run db:reset

# Sync schema with database
npm run db:push
```

### Code Quality

```bash
# Lint code and apply auto-fixes
npm run lint

# Format code (Prettier)
npm run format

# Type checking
npx tsc --noEmit
```

### Admin Operations

```bash
# Start admin companion server
npm run admin

# Development mode with hot reload
npm run admin-dev
```

### Project Structure

```
english-listening-trainer/
├── app/                          # Next.js App Router pages and API routes
│   ├── page.tsx                 # Home page (main practice interface)
│   ├── admin/                   # Admin dashboard
│   ├── api/
│   │   ├── ai/                 # AI generation endpoints
│   │   ├── auth/               # Authentication endpoints
│   │   ├── tts/                # Text-to-speech endpoints
│   │   ├── practice/           # Practice session endpoints
│   │   └── health/             # Health check endpoints
│   └── layout.tsx              # Root layout
├── components/                   # Reusable React components
│   ├── audio-player/           # Audio playback components
│   ├── practice/               # Practice flow components
│   ├── ui/                     # UI primitives (Radix-based)
│   └── ...
├── lib/                        # Utility libraries and services
│   ├── ai/                    # AI service integration
│   │   ├── cerebras-client-manager.ts
│   │   ├── prompt-templates.ts
│   │   ├── schemas.ts
│   │   └── telemetry.ts
│   ├── arkovy-helper.ts       # Ark API wrapper
│   ├── config-manager.ts      # Configuration management
│   ├── kokoro-service-gpu.ts  # Kokoro TTS service
│   ├── database.ts            # Database helpers
│   ├── auth.ts                # Authentication utilities
│   └── ...
├── hooks/                      # Custom React hooks
│   ├── use-auth-state.ts      # Authentication state
│   ├── use-audio-player.ts    # Audio player logic
│   └── ...
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   └── migrations/            # Database migrations
├── kokoro_local/              # Kokoro TTS wrapper (Python)
│   ├── kokoro_wrapper.py      # Main wrapper script
│   ├── text_chunker.py        # Text segmentation logic
│   └── ...
├── public/                    # Static assets and audio files
├── scripts/                   # Utility and deployment scripts
├── documents/                 # Project documentation
├── tests/                     # Test suites
├── Dockerfile                 # Container image definition
├── docker-compose.yml         # Local development setup
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

### Coding Standards

#### TypeScript
- **Always use explicit return types** on exported functions
- Use `unknown` for values with uncertain types, narrow with type guards
- Prefer `const` over `let`; avoid `var`

#### React Components
- Use **PascalCase** filenames for shared components (e.g., `AudioPlayer.tsx`)
- Use **kebab-case** for hooks and utilities (e.g., `use-audio-player.ts`)
- Prefer **functional components** with hooks
- Keep components focused on a single responsibility

#### Styling
- Use **Tailwind CSS** utilities exclusively
- Co-locate component styles within class names
- Avoid creating new CSS modules
- Reference [`components/ui/*`](components/ui) for reusable primitives

#### File Naming
- Components: `PascalCase` (e.g., `AudioPlayer.tsx`)
- Utilities & services: `kebab-case` (e.g., `config-manager.ts`)
- Types: `types.ts` or suffix `.types.ts`
- Tests: `*.test.ts` or `*.spec.ts`

#### Imports Organization
```typescript
// 1. External packages
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

// 2. Absolute imports (aliased with @/)
import { Button } from '@/components/ui/button'
import { authService } from '@/lib/auth'

// 3. Relative imports
import { useCustomHook } from '../hooks'
```

### Testing Guidelines

#### Unit Tests
- Test individual functions and components in isolation
- Mock external dependencies ([`__tests__/utils`](__tests__/utils))
- Aim for meaningful assertions, not 100% coverage

Example:
```typescript
describe('calculateStreakDays', () => {
  it('returns current and longest streaks', () => {
    const dates = ['2025-01-01', '2025-01-02', '2025-01-03']
    const result = calculateStreakDays(dates)
    expect(result.current).toBe(3)
  })
})
```

#### Integration Tests
- Test component behavior with real user interactions
- Use Testing Library for DOM queries
- Mock API responses with MSW

#### E2E Tests
- Test complete user workflows
- Verify critical features end-to-end
- Run before production deployments

---

## Usage Guide

### Quick Start: Running a Practice Session

1. **Launch the application:**
   ```bash
   npm run dev
   # Opens http://localhost:3000
   ```

2. **Register or log in:**
   - Click "Register" to create a new account
   - Or use existing credentials

3. **Configure practice settings:**
   - Select **Language**: English (US/GB), Spanish, French, etc.
   - Select **Difficulty**: A1 (beginner) to C2 (advanced)
   - Optional: Enter a custom topic or let AI generate one

4. **Practice listening:**
   - Listen to AI-generated audio
   - Answer multiple-choice and short-answer questions
   - Receive instant grading and detailed feedback

5. **Review progress:**
   - Check achievement badges
   - View focus area mastery metrics
   - See recommended learning areas

### Core Workflows

#### Generating Practice Content

**Via UI:**
1. Home page → Select "Generate Topic"
2. Choose language, difficulty, duration
3. Optionally specify focus areas
4. AI automatically generates transcript and questions

**Via API:**
```bash
curl -X POST http://localhost:3000/api/ai/topics \
  -H "Content-Type: application/json" \
  -d '{
    "language": "en-US",
    "difficulty": "B1",
    "focusAreas": ["main-idea", "detail-comprehension"]
  }'
```

#### Saving Practice Sessions

Sessions are automatically saved after grading. View history:
1. Home page → "History" button
2. Filter by language, difficulty, date range
3. Click session to review questions and feedback

#### Analyzing Mistakes

1. Home page → "Wrong Answers Book"
2. Browse incorrect responses by focus area
3. Click item to see:
   - AI explanation
   - Related example sentences
   - Confidence scoring

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause audio |
| `→` | Skip forward 5 seconds |
| `←` | Skip backward 5 seconds |
| `?` | Show shortcut help |
| `Esc` | Close dialogs |

(Customize in user settings)

---

## API Reference

### Authentication Endpoints

#### Register
**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

#### Login
**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "rememberMe": true
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

#### Get Current User
**Endpoint:** `GET /api/auth/me`

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

#### Logout
**Endpoint:** `POST /api/auth/logout`

**Response:** `200 OK`

### AI Content Generation Endpoints

#### Generate Topics
**Endpoint:** `POST /api/ai/topics`

**Request:**
```json
{
  "language": "en-US",
  "difficulty": "B1",
  "focusAreas": ["main-idea"],
  "minWords": 150,
  "maxWords": 300
}
```

**Response:** `200 OK`
```json
{
  "topic": "Technology and Society",
  "description": "Discussion of how technology shapes modern life"
}
```

#### Generate Transcript
**Endpoint:** `POST /api/ai/transcript`

**Request:**
```json
{
  "topic": "Technology and Society",
  "language": "en-US",
  "difficulty": "B1",
  "wordCount": 200
}
```

**Response:** `200 OK`
```json
{
  "transcript": "In recent years, technology has...",
  "wordCount": 198
}
```

#### Generate Questions
**Endpoint:** `POST /api/ai/questions`

**Request:**
```json
{
  "transcript": "...",
  "difficulty": "B1",
  "focusAreas": ["main-idea", "detail-comprehension"],
  "language": "en-US"
}
```

**Response:** `200 OK`
```json
{
  "questions": [
    {
      "id": "q1",
      "type": "single",
      "text": "What is the main topic?",
      "options": ["A) ...", "B) ...", "C) ..."],
      "focusArea": "main-idea"
    }
  ]
}
```

#### Grade Answers
**Endpoint:** `POST /api/ai/grade`

**Request:**
```json
{
  "transcript": "...",
  "questions": [...],
  "answers": ["A", "B"],
  "language": "en-US"
}
```

**Response:** `200 OK`
```json
{
  "results": [
    {
      "questionId": "q1",
      "correct": true,
      "userAnswer": "A",
      "explanation": "..."
    }
  ]
}
```

#### Analyze Wrong Answers
**Endpoint:** `POST /api/ai/wrong-answers/analyze`

**Request:**
```json
{
  "question": "What is the speaker's attitude?",
  "userAnswer": "Neutral",
  "correctAnswer": "Skeptical",
  "transcript": "...",
  "language": "en-US"
}
```

**Response:** `200 OK`
```json
{
  "analysis": "The speaker uses phrases like 'allegedly' and 'reportedly'...",
  "relatedSentences": ["Example sentence 1", "Example sentence 2"]
}
```

### Text-to-Speech Endpoints

#### Generate Audio
**Endpoint:** `POST /api/tts`

**Request:**
```json
{
  "text": "Hello, how are you?",
  "language": "en-US",
  "speed": 1.0,
  "voiceId": "default"
}
```

**Response:** `200 OK` (audio/wav)

### Practice Session Endpoints

#### Save Session
**Endpoint:** `POST /api/practice/save`

**Request:**
```json
{
  "transcript": "...",
  "questions": [...],
  "answers": [...],
  "duration": 300,
  "difficulty": "B1"
}
```

**Response:** `201 Created`
```json
{
  "sessionId": "uuid",
  "savedAt": "2025-10-18T05:41:00Z"
}
```

#### Get History
**Endpoint:** `GET /api/practice/history?limit=10&offset=0`

**Response:** `200 OK`
```json
{
  "sessions": [...],
  "total": 42
}
```

---

## Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│  React 19 + Next.js 15 App Router + Tailwind CSS        │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/HTTPS
┌────────────────────▼────────────────────────────────────┐
│            Next.js API Routes (Server)                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Authentication (JWT-based)                       │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ AI Services (Cerebras Integration)               │  │
│  │  - Content Generation (Topics, Transcripts)      │  │
│  │  - Question Generation                           │  │
│  │  - Grading & Analysis                            │  │
│  │  - Focus Area Coverage Evaluation                │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ TTS Services                                      │  │
│  │  - Kokoro (Primary, GPU-accelerated)             │  │
│  │  - OpenAI (Fallback)                             │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Practice Session Management                      │  │
│  │  - Session Saving & Loading                      │  │
│  │  - History Management                            │  │
│  │  - Progress Analytics                            │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────┬──────────────┬──────────────┬──────────┘
                 │              │              │
    ┌────────────▼────┐  ┌──────▼────┐  ┌────▼──────────┐
    │  Database       │  │ Cerebras  │  │ Kokoro TTS    │
    │ (SQLite/PG)     │  │    API    │  │ (Local/GPU)   │
    └─────────────────┘  └───────────┘  └───────────────┘
```

### Data Flow: Practice Session Lifecycle

1. **User Initiates Practice**
   - Selects language, difficulty, focus areas
   - Optionally provides custom topic

2. **AI Content Generation** (via `lib/ai/`)
   - Generate topic (Cerebras)
   - Generate transcript (Cerebras, respecting word count)
   - Generate questions (Cerebras, with focus area validation)
   - Coverage validation: If below 80%, regenerate with expanded prompt

3. **Audio Synthesis** (via `lib/kokoro-service-gpu.ts`)
   - Stream transcript to local Kokoro TTS
   - GPU acceleration for real-time performance
   - Fallback to OpenAI if Kokoro unavailable

4. **User Answers Questions**
   - Frontend collects responses
   - Real-time validation

5. **Grading & Feedback** (via `lib/ai/`)
   - Cerebras grades answers
   - AI generates explanations
   - Analyze incorrect responses with related examples

6. **Session Saving** (via `lib/database.ts`)
   - Persist to Prisma ORM
   - Update user progress metrics
   - Trigger achievement checks

7. **Analytics** (via `lib/focus-metrics.ts`)
   - Compute focus area statistics
   - Generate recommendations
   - Update user dashboard

### Component Hierarchy

```
<PracticeProvider>
  ├─ <PracticeSetup>         # Configuration component
  │  └─ Language/Difficulty selectors
  ├─ <PracticeFlow>          # Main practice interface
  │  ├─ <AudioPlayer>        # Audio controls
  │  ├─ <QuestionInterface>  # Question display
  │  └─ <ResultsDisplay>     # Feedback view
  └─ <HistoryPanel>          # Session history
```

### State Management

- **Component State**: React `useState` for local UI state
- **Auth State**: Custom hook [`useAuthState`](hooks/use-auth-state.ts)
- **Practice State**: Context API via `PracticeContext`
- **Global Storage**: Browser localStorage (user preferences, history)
- **Server State**: Prisma ORM + database

### API Integration Strategy

**Cerebras/Ark Integration** ([`lib/ark-helper.ts`](lib/ark-helper.ts)):
- Unified API wrapper with retry logic
- Request preprocessing and schema validation
- Telemetry and error reporting

**Error Handling**:
- Automatic retry with exponential backoff
- Circuit breaker pattern for failing endpoints
- Fallback chains (e.g., Kokoro → OpenAI TTS)
- User-friendly error messages

---

## Troubleshooting

### Common Issues & Solutions

#### 1. Database Connection Error

**Error:** `Unable to connect to database`

**Solutions:**
- Verify `DATABASE_URL` in `.env.local`
- For SQLite: Ensure `./prisma/` directory is writable
- For PostgreSQL: Check database server is running
- Run migrations: `npm run db:migrate`

#### 2. Cerebras API Key Invalid

**Error:** `Invalid API key` or `Unauthorized`

**Solutions:**
- Verify `CEREBRAS_API_KEY` is correctly set in `.env.local`
- Check API key hasn't expired
- Confirm billing status in Cerebras dashboard
- Test with: `curl -H "Authorization: Bearer $CEREBRAS_API_KEY" https://api.cerebras.ai/v1/models`

#### 3. Kokoro TTS Not Initializing

**Error:** `Kokoro service failed to start` or `Python not found`

**Solutions:**
- Run setup: `npm run setup-kokoro`
- Verify Python 3.8+ installed: `python --version`
- Check Kokoro model files downloaded: `ls kokoro_local/`
- Review GPU status: `nvidia-smi` (for NVIDIA) or `system_profiler SPPowerDataType` (for Apple Silicon)
- Fallback to OpenAI: Set `OPENAI_API_KEY`

#### 4. Audio Playback Issues

**Error:** Audio doesn't play or stops unexpectedly

**Solutions:**
- Check browser audio permissions
- Verify audio endpoint: `curl http://localhost:3000/api/tts` (should return WAV)
- Check `Range` header support for seek: `curl -H "Range: bytes=0-1000" http://localhost:3000/api/audio/filename.wav`
- Clear browser cache: Ctrl+Shift+Delete (or Cmd+Shift+Delete on macOS)

#### 5. JWT Token Expired

**Error:** `Unauthorized` after long inactivity

**Solutions:**
- Logout and log back in
- Check "Remember Me" is enabled for extended sessions
- Verify `JWT_SECRET` in production environment

#### 6. Content Generation Timeout

**Error:** Cerebras request times out

**Solutions:**
- Check `AI_TIMEOUT` setting in `.env.local` (default: 30000ms)
- Reduce `maxWords` in generation request
- Verify network connectivity to `api.cerebras.ai`
- Check Cerebras service status
- Review rate limiting: `AI_MAX_RETRIES` and exponential backoff

### Debugging Tips

#### Enable Verbose Logging

```bash
# Set debug environment variable
DEBUG=english-listening-trainer:* npm run dev

# Or in .env.local
LOG_LEVEL=debug
```

#### Check Database State

```bash
# Open Prisma Studio
npm run db:studio

# Browse tables and data visually
```

#### Test API Endpoints Directly

```bash
# Test health check
curl http://localhost:3000/api/health

# Test AI topic generation
curl -X POST http://localhost:3000/api/ai/topics \
  -H "Content-Type: application/json" \
  -d '{"language":"en-US","difficulty":"B1"}'

# Monitor TTS status
curl http://localhost:3000/api/admin/tts-status
```

#### Review Server Logs

```bash
# Terminal output from dev server
npm run dev

# Production logs (if deployed)
docker logs listening-trainer-app
```

### FAQ

**Q: Can I use this offline?**
A: Partially. Core content generation requires internet (Cerebras API). Local TTS and audio playback work offline once generated.

**Q: What's the recommended database for production?**
A: PostgreSQL with connection pooling (e.g., PgBouncer) for concurrent users. SQLite works for single-machine deployment.

**Q: How do I customize AI prompts?**
A: Edit prompt templates in [`lib/ai/prompt-templates.ts`](lib/ai/prompt-templates.ts).

**Q: Can I add more languages?**
A: Yes. Add language config to [`lib/language-config.ts`](lib/language-config.ts) and corresponding Kokoro voices.

**Q: How to scale for thousands of users?**
A: Use PostgreSQL + Redis caching, deploy via Docker on Kubernetes, implement API rate limiting, use CDN for static assets.

---

## Contributing

### Contribution Workflow

1. **Create a feature branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Develop and test:**
   ```bash
   npm run dev
   npm run test
   npm run lint
   ```

3. **Commit with conventional messages:**
   ```bash
   git commit -m "feat: add audio visualization to player"
   git commit -m "fix: resolve race condition in TTS queue"
   git commit -m "docs: update API reference for grade endpoint"
   ```

   Prefix format: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `perf:`

4. **Push and create pull request:**
   ```bash
   git push origin feat/your-feature-name
   ```

5. **PR template checklist:**
   - [ ] Tests added/updated
   - [ ] Linting passes (`npm run lint`)
   - [ ] Documentation updated
   - [ ] Screenshots/GIFs for UI changes

### Coding Standards

#### TypeScript
```typescript
// ✅ Explicit return types
export function calculateScore(answers: string[]): number {
  return answers.filter(a => a).length
}

// ✅ Type guards for unknown values
function processData(data: unknown): Data {
  if (!isValidData(data)) throw new Error('Invalid data')
  return data as Data
}
```

#### React Components
```typescript
// ✅ Functional component with hooks
export function AudioPlayer({ url }: { url: string }): JSX.Element {
  const [isPlaying, setIsPlaying] = useState(false)
  // ...
  return <div>{/* */}</div>
}

// ✅ Custom hook with clear purpose
export function useAudioPlayer(url: string) {
  const [isPlaying, setIsPlaying] = useState(false)
  // ...
  return { isPlaying, play, pause }
}
```

#### Testing
```typescript
// ✅ Meaningful test descriptions
describe('calculateScore', () => {
  it('returns 0 for empty answers', () => {
    expect(calculateScore([])).toBe(0)
  })

  it('returns count of non-empty answers', () => {
    expect(calculateScore(['A', '', 'C'])).toBe(2)
  })
})
```

### Review Checklist

Before requesting review:

- [ ] All tests pass: `npm run test:run`
- [ ] Linting clean: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Documentation updated
- [ ] No console errors/warnings
- [ ] Database migrations included (if schema changed)
- [ ] Commits follow conventional format
- [ ] Branch up-to-date with main

### Submitting Changes

**For AI/TTS Changes:**
- Request review from [`@ark-helper`](lib/ark-helper.ts) and [`@kokoro-service-gpu`](lib/kokoro-service-gpu.ts) maintainers
- Add telemetry metrics to [`lib/monitoring.ts`](lib/monitoring.ts)

**For Database Changes:**
- Include migration files generated by Prisma
- Test on both SQLite and PostgreSQL
- Request review from database maintainers

**For UI Changes:**
- Include before/after screenshots
- Test responsive behavior on mobile
- Verify accessibility with keyboard navigation

---

## Changelog

### [v1.3.0] - 2025-10-18

#### Added
- Main page practice flow modularization with separate configuration, workspace, and authentication gate components
- New `hooks/use-practice-setup.ts` and `hooks/use-practice-templates.ts` for unified practice state management
- GPU-accelerated TTS single-stack switching with `kokoroTTSGPU`
- HTTP Range support in audio streaming for seek/scrub functionality
- Complete integration test suite for audio route handling
- Enhanced WAV metadata parsing for large files (>10MB)

#### Changed
- Unified TTS routes to exclusively use `kokoroTTSGPU` service
- Replaced legacy audio player with modular [`components/audio-player/AudioPlayer.tsx`](components/audio-player.tsx)
- Refactored AI call layer with centralized Cerebras integration
- Text chunking strategy to prioritize word-level segmentation

#### Removed
- Legacy `lib/kokoro-service.ts` (replaced by GPU variant)
- Route-specific TTS optimizations (merged into unified service)

#### Fixed
- Audio metadata accuracy for WAV files with multiple chunks
- Race conditions in TTS request queue processing
- Focus area coverage validation for low-coverage regeneration

### [v1.2.0] - 2025-10-15

#### Added
- Cerebras API integration with structured output and schema validation
- AI telemetry and monitoring dashboard
- Exponential backoff retry strategy with circuit breaker pattern
- Request preprocessing for difficulty and language adaptation
- Prompt template library with multi-language support

#### Changed
- All AI endpoints migrated to unified `invokeStructured()` pipeline
- Enhanced error reporting with telemetry
- Improved focus area coverage evaluation

### [v1.1.0] - 2025-10-07

#### Added
- Comprehensive deployment documentation
- Cache management guide
- Multi-level Docker caching strategy
- CI/CD pipeline optimization

#### Fixed
- GitHub Actions cache efficiency

### [v1.0.0] - 2025-09-01

- Initial production release
- Core features: listening practice, AI feedback, progress tracking
- TTS integration (Kokoro + OpenAI fallback)
- Multi-language support (8 languages)

---

## License

This project is licensed under the [MIT License](LICENSE).

## Support

For issues, feature requests, or questions:
- **GitHub Issues**: [Create an issue](https://github.com/yourusername/english-listening-trainer/issues)
- **Documentation**: See [`documents/`](documents/) for detailed guides
- **Email**: laoliarthur@outlook.com
- **WeChat**: bookspiano

---

**Happy learning! 🎧📚**
