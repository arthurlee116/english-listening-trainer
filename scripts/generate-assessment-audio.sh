#!/usr/bin/env bash
set -euo pipefail

# Pre-generate assessment audios through the app route.
# In Blob-enabled environments the assets land in Blob; local disk is only fallback.
#
# Usage:
#   1) Start the dev server: npm run dev
#   2) Run: ./scripts/generate-assessment-audio.sh
#
# This uses curl against `/api/assessment-audio/:id`, which generates the asset
# via the configured TTS provider only when it is missing.

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Generating assessment audio via ${BASE_URL} ..."

for id in 1 2 3 4 5; do
  echo "  - /api/assessment-audio/${id}"
  curl -sf "${BASE_URL}/api/assessment-audio/${id}" >/dev/null
done

echo "Done. Assessment audio assets should now be available via /api/assessment-audio/:id."
