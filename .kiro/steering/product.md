# Product Overview

English Listening Trainer is an AI-powered web application for personalized English listening practice.

## Core Features

- **AI Content Generation**: Generates topics, transcripts, and questions using Cerebras-hosted LLMs
- **Adaptive Difficulty**: Assesses user level and recommends CEFR-based difficulty (A1-C2)
- **Local TTS**: Uses Kokoro engine (CPU/GPU variants) for high-quality text-to-speech
- **User Authentication**: Email/password login with JWT cookies and client-side caching
- **Progress Tracking**: Stores exercises, answers, and performance metrics
- **Wrong Answer Analysis**: AI-powered analysis of incorrect answers with focus area tagging
- **Admin Dashboard**: User management and performance monitoring (port 3005)
- **Bilingual UI**: English/Chinese interface with i18n support
- **Theme Support**: Light and dark modes via next-themes

## Key Workflows

1. **Content Generation**: AI generates topic → transcript → questions → grades answers
2. **Audio Generation**: Kokoro TTS converts text to speech with metadata (duration, size)
3. **Practice Session**: User listens → answers questions → receives feedback and AI analysis
4. **Progress Persistence**: Sessions, questions, and answers stored in SQLite database
5. **Audio Cleanup**: Background service automatically purges old WAV files

## Target Platform

- Primary: macOS (Apple Silicon optimized for MPS/Metal acceleration)
- Deployment: Docker-ready with standalone output mode
- TTS: Requires Python 3.8-3.12 (not 3.13+)
