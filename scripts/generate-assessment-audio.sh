#!/usr/bin/env bash
set -euo pipefail

# Pre-generate assessment audios once and store them under `public/assessment-audio/`.
#
# Usage:
#   1) Start the dev server: npm run dev
#   2) Run: ./scripts/generate-assessment-audio.sh
#
# This uses curl against the app route `/api/assessment-audio/:id` which will
# generate the audio (via the configured TTS provider) only if the target file doesn't exist yet.

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Generating assessment audio via ${BASE_URL} ..."

for id in 1 2 3 4 5; do
  echo "  - /api/assessment-audio/${id}"
  curl -sf "${BASE_URL}/api/assessment-audio/${id}" >/dev/null
done

echo "Done. Files should now exist in public/assessment-audio/."
