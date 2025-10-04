# GitHub Actions Docker Build Cache Optimization

## Problem Statement

I've optimized my Dockerfile with multi-stage builds to separate rarely-changed dependencies (Python/PyTorch, Node packages) from frequently-changed application code. However, **GitHub Actions still rebuilds everything from scratch on every push**, which takes a long time and wastes resources.

The Dockerfile is now well-structured with these stages:
1. `base` - System dependencies (rarely changes)
2. `python-deps` - PyTorch + Kokoro requirements (~2GB, rarely changes)
3. `node-deps` - npm packages (~500MB, occasionally changes)
4. `builder` - Next.js build (changes with code)
5. `runtime` - Final image assembly

**Current issue**: Even though the Dockerfile is optimized, GitHub Actions doesn't properly cache the intermediate layers, so every build reinstalls PyTorch, npm packages, etc.

## Current GitHub Actions Workflow

```yaml
name: Build and Push Docker Image

on:
  push:
    branches:
      - main
      - feature/exercise-template
  workflow_dispatch:
    inputs:
      branch:
        description: 'Branch to build from'
        required: false
        default: 'main'
      push:
        description: 'Push to registry'
        required: false
        default: 'true'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,prefix={{branch}}-
          labels: |
            org.opencontainers.image.source=https://github.com/${{ github.repository }}
            org.opencontainers.image.revision=${{ github.sha }}
            org.opencontainers.image.created=${{ github.event.head_commit.timestamp }}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          target: runtime
          platforms: linux/amd64
          push: ${{ github.event_name != 'pull_request' && (github.event.inputs.push != 'false') }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-to: type=inline
```

## Optimization Goals

1. **Cache intermediate build stages**: `base`, `python-deps`, `node-deps` should be cached and reused
2. **Minimize rebuild time**: 
   - Code-only changes: < 5 minutes (currently ~20 minutes)
   - Dependency changes: < 15 minutes (acceptable)
   - Full rebuild: < 30 minutes (rare)
3. **Reduce GitHub Actions minutes usage**: Save CI/CD costs
4. **Maintain reliability**: Cache should be invalidated when dependencies actually change

## Technical Context

### Dockerfile Structure (Optimized)
- **Base stage**: NVIDIA CUDA 12.1 + system packages (~3GB)
- **Python-deps stage**: PyTorch 2.3.0+cu121 + Kokoro requirements (~2GB)
- **Node-deps stage**: npm ci + Prisma generate (~500MB)
- **Builder stage**: Next.js build (~200MB)
- **Runtime stage**: Final assembly (~100MB)

### Current Cache Configuration Issues
```yaml
cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
cache-to: type=inline
```

**Problems**:
- `type=inline` only caches the final image, not intermediate stages
- `cache-from` only pulls the `latest` tag, missing intermediate layers
- No explicit caching of `python-deps` and `node-deps` stages

## Desired Cache Strategy

### Option 1: Registry Cache with Multiple Tags (Recommended)
Cache each build stage separately in the registry:
- `ghcr.io/user/repo:cache-base`
- `ghcr.io/user/repo:cache-python-deps`
- `ghcr.io/user/repo:cache-node-deps`
- `ghcr.io/user/repo:cache-builder`

### Option 2: GitHub Actions Cache
Use GitHub's built-in cache action to store Docker layers locally.

### Option 3: BuildKit Cache Mount
Use `--mount=type=cache` more extensively (already partially implemented).

## Requirements

1. **Must work with GitHub Actions**: No external cache services
2. **Must work with GHCR**: GitHub Container Registry is our registry
3. **Must support multi-stage builds**: Cache each stage independently
4. **Must be reliable**: Cache invalidation when dependencies change
5. **Must be fast**: Restore cache quickly (< 2 minutes)

## Expected Behavior After Optimization

### Scenario 1: Code-only change (e.g., update a React component)
```
✓ Restore base cache (< 30s)
✓ Restore python-deps cache (< 30s)
✓ Restore node-deps cache (< 30s)
→ Rebuild builder stage (2-3 min)
→ Assemble runtime stage (1 min)
Total: ~5 minutes (vs current ~20 minutes)
```

### Scenario 2: Add a new npm package
```
✓ Restore base cache (< 30s)
✓ Restore python-deps cache (< 30s)
→ Rebuild node-deps stage (3-5 min)
→ Rebuild builder stage (2-3 min)
→ Assemble runtime stage (1 min)
Total: ~10 minutes
```

### Scenario 3: Update Python requirements
```
✓ Restore base cache (< 30s)
→ Rebuild python-deps stage (10-15 min, PyTorch is large)
→ Rebuild node-deps stage (3-5 min)
→ Rebuild builder stage (2-3 min)
→ Assemble runtime stage (1 min)
Total: ~20 minutes (acceptable, rare)
```

## Constraints

- **Cannot use external cache services**: Must use GitHub infrastructure
- **Cannot significantly increase complexity**: Keep workflow maintainable
- **Must work with existing Dockerfile**: Don't require major Dockerfile changes
- **Must handle cache invalidation correctly**: Don't use stale dependencies

## Deliverables Needed

1. **Optimized GitHub Actions workflow** (`.github/workflows/build-and-push.yml`)
2. **Explanation** of caching strategy and how it works
3. **Cache invalidation logic**: How to force rebuild when needed
4. **Estimated time savings** for different scenarios
5. **Troubleshooting guide**: What to do if cache becomes corrupted

## Additional Context

- **Repository**: arthurlee116/english-listening-trainer
- **Registry**: ghcr.io (GitHub Container Registry)
- **Current build time**: ~20 minutes for code changes
- **Target build time**: < 5 minutes for code changes
- **Deployment location**: China (uses NJU mirror for pulling, but builds on GitHub)

## References

- Docker Buildx cache documentation: https://docs.docker.com/build/cache/backends/
- GitHub Actions cache: https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows
- BuildKit cache mounts: https://docs.docker.com/build/guide/mounts/

---

**Please provide an optimized GitHub Actions workflow that properly caches Docker build stages to minimize rebuild time, especially for code-only changes.** If you need to, you can use EXA to search the web and get the latest information about available actions and best practices. 
