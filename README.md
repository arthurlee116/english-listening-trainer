# English Listening Trainer – Dev Guide

## Overview

This is a Next.js App Router (TypeScript) application for AI-assisted English listening practice.

### Features:
- **AI-Powered Content:** Generate topics, transcripts, and questions using Cerebras-hosted models.
- **Personalized Difficulty:** The system assesses the user's level and recommends a suitable difficulty (CEFR and L-levels).
- **Local Text-to-Speech (TTS):** Utilizes a local Kokoro engine (CPU & GPU variants) and now returns duration/byte-size metadata for instant UI feedback.
- **Authentication Optimizations:** Email/password login with JWT cookies, client-side caching via `use-auth-state`, and server-side in-memory caches in `lib/auth.ts`.
- **Automated Clean-up:** A background audio clean-up service prunes generated WAV files to avoid exhausting disk space.
- **Admin Dashboard:** Manage users and monitor performance statistics.
- **Data Persistence:** Uses Prisma + SQLite (WAL mode enabled by default) to store exercises and user progress.
- **Modern UI:** Built with shadcn/ui, Tailwind CSS, and bilingual text helpers.
- **Themeing:** Dark-first experience with built-in styling tokens.

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8-3.12 (Kokoro TTS does not support Python 3.13+)
- macOS (recommended, Apple Silicon supported)
- `npm` package manager (`npm install -g npm`)

### Installation & Setup
1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Set up environment variables:**
    ```bash
    cp .env.example .env.local
    ```
    Update the file with your Cerebras API key and a secure `JWT_SECRET` (see `CLAUDE.md` or `documents/CODEX.md` for the full list). Optional overrides include `AI_PROXY_URL` for outbound requests and `AI_ENABLE_PROXY_HEALTH_CHECK` (`true`/`false`) when running behind custom proxies.

3.  **Initialize Kokoro TTS (first time only):**
    ```bash
    npm run setup-kokoro
    ```
    This will create a Python virtual environment in `kokoro_local/venv`, install dependencies, and download the required voice files. You can customise the installer via environment variables before running the command, for example:
    ```bash
    KOKORO_TORCH_VARIANT=cuda KOKORO_CUDA_HOME=/usr/local/cuda-12.2 npm run setup-kokoro
    ```
    Supported overrides include `KOKORO_DEVICE`, `KOKORO_TORCH_INDEX_URL`, `KOKORO_REPO_PATH`, `KOKORO_VOICE_SOURCE`, and HTTP(S) proxy variables for offline deployments.

4.  **Run database migrations:**
    ```bash
    npm run db:migrate
    ```

5.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

6.  **Run the admin dashboard:**
    ```bash
    npm run admin
    ```
    The admin dashboard will be available at `http://localhost:3005/admin`. The default password is `admin123`.

## Key Workflows

- **Content Generation:** The AI service generates topics, transcripts, and questions (see `lib/ai-service.ts`, `lib/ai/cerebras-service.ts`, and `app/api/ai/*`).
- **Audio Generation:** `lib/kokoro-service.ts` (CPU) and `lib/kokoro-service-gpu.ts` (GPU) orchestrate Kokoro Python workers. `/api/tts` now returns metadata (`duration`, `byteLength`) consumed by `components/audio-player.tsx`.
- **Authentication:** `hooks/use-auth-state.ts` hydrates auth state from localStorage and refreshes via `/api/auth/me`. Server-side helpers in `lib/auth.ts` use TTL caches and refresh-once logic to reduce DB load.
- **Audio Clean-up:** `lib/audio-cleanup-service.ts` is started automatically (see `lib/kokoro-init.ts`) to purge stale WAV files under `public/`.
- **User Progress:** Exercises and session data are persisted in `data/app.db` via Prisma.

## Project Structure

- `app/`: The main application code, following the Next.js App Router structure.
- `components/`: React components used throughout the application.
- `lib/`: Core application logic, services, and utilities.
- `hooks/`: Custom React hooks.
- `scripts/`: Maintenance utilities (`backup.sh`, `restore.sh`, `setup-kokoro.sh`).
- `kokoro_local/`: The local Kokoro TTS engine and its related files.
- `public/`: Static assets, including generated audio files.
- `data/`: The SQLite database file.
- `__tests__/`: Vitest suites covering the TTS API, auth helpers, hooks, and bilingual utilities.

## Performance Notes

- **TTS Performance**: The first audio generation can take 3-5 seconds due to model loading. Subsequent generations are faster, typically taking 2-8 seconds depending on the text length.
- **Memory Usage**: The Kokoro TTS engine can consume 1-2GB of RAM when active.
- **Circuit Breakers**: Both CPU and GPU TTS services include circuit breakers and exponential backoff. Monitor logs for repeated `Circuit breaker: OPEN` messages.
- **Apple Silicon**: The application is optimized for Apple Silicon, which provides a significant performance boost for audio generation.

## Troubleshooting

- **Python Version Issues**: If TTS fails to initialize, verify your Python version (`python3 --version`). Kokoro requires Python 3.8-3.12. If needed, you can recreate the virtual environment: `cd kokoro_local && rm -rf venv && python3.12 -m venv venv`.
- **TTS Initialization**: If the TTS engine fails to start, try re-running the setup script: `npm run setup-kokoro`.
- **Database Issues**: If you encounter schema issues during development, you can delete the `data/app.db` file to reinitialize the database.
- **Audio Clean-up**: Generated audio lives in `public/`. The clean-up service runs automatically, but you can invoke `audioCleanupService.performCleanup()` manually from a Node REPL if needed.

## Testing & Quality

- **Linting**: `npm run lint`
- **Unit/Integration tests**: `npm test` (or `npm test -- --run` in CI)
- The test suite covers auth caching (`__tests__/lib/auth.test.ts`), the TTS API (`__tests__/api/tts.test.ts`), audio utilities, bilingual formatting, and hooks. Keep tests updated when changing service contracts.
