# SpaCy Model Offline Installation Fix

## Problem

When running the Docker container, the Kokoro TTS service failed to initialize with the following error:

```
❌ Pipeline creation failed: HTTPSConnectionPool(host='raw.githubusercontent.com', port=443): 
Max retries exceeded with url: /explosion/spacy-models/master/compatibility.json 
(Caused by SSLError(SSLEOFError(8, '[SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1007)')))
```

## Root Cause

The `kokoro` package depends on `misaki` for G2P (grapheme-to-phoneme) conversion, which in turn requires the SpaCy English model `en_core_web_sm`. This model was not pre-installed in the Docker image, causing the application to attempt downloading it at runtime.

In production/restricted network environments, this runtime download fails due to:
- SSL/TLS connection issues
- Network restrictions
- Firewall policies
- Offline deployment requirements

## Solution

Pre-install the SpaCy model during the Docker build process by adding this step to the Dockerfile:

```dockerfile
# Pre-install SpaCy English model (required by Kokoro's misaki G2P)
# This prevents runtime download attempts that fail in offline/restricted environments
RUN ${KOKORO_VENV}/bin/python -m spacy download en_core_web_sm
```

This command:
1. Downloads the `en_core_web_sm` model during build time (when network access is available)
2. Installs it into the Python virtual environment
3. Makes it available for offline use at runtime

## Implementation Details

**File Modified**: `Dockerfile`

**Location**: After installing Kokoro requirements (line ~152)

**Build Impact**: 
- Adds ~12MB to image size
- Increases build time by ~10-15 seconds
- Requires internet access during build (standard for Docker builds)

## Verification

After rebuilding the Docker image with this fix:

1. The SpaCy model will be bundled in the image
2. Kokoro TTS will initialize successfully without network access
3. The G2P pipeline will work offline
4. No runtime download attempts will occur

## Related Files

- `Dockerfile` - Contains the fix
- `kokoro-local/requirements.txt` - Lists kokoro dependency
- `documents/TTS_ISSUE_ANALYSIS.md` - Previous TTS troubleshooting history

## References

- SpaCy Models Documentation: https://spacy.io/models
- Kokoro TTS: https://github.com/hexgrad/kokoro
- Docker Best Practices: Pre-install dependencies during build, not at runtime
