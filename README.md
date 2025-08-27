# English Listening Trainer – Dev Guide

## Overview

This is a Next.js App Router (TypeScript) application for AI-assisted English listening practice.

### Features:
- **AI-Powered Content:** Generate topics, transcripts, and questions using AI.
- **Personalized Difficulty:** The system assesses the user's level and recommends a suitable difficulty (CEFR and L-levels).
- **Local Text-to-Speech (TTS):** Utilizes a local "Kokoro" TTS engine for audio generation.
- **Invitation Codes:** Access to the application is managed through invitation codes with daily usage limits.
- **Admin Dashboard:** A simple dashboard to manage invitation codes and view usage statistics.
- **Data Persistence:** Uses SQLite to store exercises and user progress.
- **Modern UI:** Built with shadcn/ui and Tailwind CSS.
- **Themeing:** Supports light and dark modes with `next-themes`.

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8-3.12 (Kokoro TTS does not support Python 3.13+)
- macOS (recommended, Apple Silicon supported)
- `pnpm` package manager (`npm install -g pnpm`)

### Installation & Setup
1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Set up environment variables:**
    ```bash
    cp .env.example .env.local
    ```
    You will need to add your AI provider's API key to `.env.local`.

3.  **Initialize Kokoro TTS (first time only):**
    ```bash
    pnpm run setup-kokoro
    ```
    This will create a Python virtual environment in `kokoro-local/venv`, install dependencies, and download the required voice files.

4.  **Run database migrations:**
    ```bash
    pnpm exec ts-node scripts/database-migration.ts
    ```

5.  **Run the development server:**
    ```bash
    pnpm run dev
    ```
    The application will be available at `http://localhost:3000`. You will need an invitation code to use it.

6.  **Run the admin dashboard:**
    ```bash
    pnpm run admin
    ```
    The admin dashboard will be available at `http://localhost:3005/admin`. The default password is `admin123`.

## Key Workflows

- **Content Generation:** The AI service generates topics, transcripts, and questions. The relevant code is in `lib/ai-service.ts` and `app/api/ai/*`.
- **Audio Generation:** The local Kokoro TTS engine generates audio from the transcript. The service is managed in `lib/kokoro-service.ts` and the API endpoint is `app/api/tts`.
- **User Progress:** The application tracks daily usage and stores exercises in a SQLite database (`data/app.db`).
- **Invitation Codes:** The invitation system is managed through the API endpoints in `app/api/invitation/*`.

## Project Structure

- `app/`: The main application code, following the Next.js App Router structure.
- `components/`: React components used throughout the application.
- `lib/`: Core application logic, services, and utilities.
- `hooks/`: Custom React hooks.
- `scripts/`: Utility scripts for tasks like database migration and setting up Kokoro.
- `kokoro-local/`: The local Kokoro TTS engine and its related files.
- `public/`: Static assets, including generated audio files.
- `data/`: The SQLite database file.

## Performance Notes

- **TTS Performance**: The first audio generation can take 3-5 seconds due to model loading. Subsequent generations are faster, typically taking 2-8 seconds depending on the text length.
- **Memory Usage**: The Kokoro TTS engine can consume 1-2GB of RAM when active.
- **Apple Silicon**: The application is optimized for Apple Silicon, which provides a significant performance boost for audio generation.

## Troubleshooting

- **Python Version Issues**: If TTS fails to initialize, verify your Python version (`python3 --version`). Kokoro requires Python 3.8-3.12. If needed, you can recreate the virtual environment: `cd kokoro-local && rm -rf venv && python3.12 -m venv venv`.
- **TTS Initialization**: If the TTS engine fails to start, try re-running the setup script: `pnpm run setup-kokoro`.
- **Database Issues**: If you encounter schema issues during development, you can delete the `data/app.db` file to reinitialize the database.

