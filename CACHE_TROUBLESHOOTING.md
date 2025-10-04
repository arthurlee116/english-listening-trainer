# Docker Build Cache Troubleshooting Guide (Updated 2024)

## Quick Reference

| Issue | Cause | Solution |
|-------|-------|----------|
| Build takes 20+ minutes | Local cache not working | Check `/tmp/.buildx-cache`, verify cache keys |
| Cache not found errors | Cache move step failed | Check cache move step logs |
| BuildX driver issues | BuildKit configuration | Verify `setup-buildx-action` configuration |
| Cache corruption | Improper cache handling | Use `rebuild-cache=true` parameter |

## 2024 Cache Architecture Differences

### New Multi-Tier System
1. **Local (`type=local`)**: Primary, fastest cache at `/tmp/.buildx-cache`
2. **GHA (`type=gha`)**: Native GitHub Actions cache, secondary
3. **Registry (`type=registry`)**: Persistent backup cache

### Critical Dependencies
- **Cache Move Step**: Essential for proper cache directory handling
- **BuildKit Configuration**: Enhanced with parallelism and network optimizations
- **Action Environment Variables**: Disable build summary for better performance

## Common Problems & Solutions

### 1. Cache Not Restoring (Builds Take 20+ Minutes)

**Symptoms:**
- Build starts from scratch every time
- No "CACHED" messages in build output
- All Docker layers rebuilt instead of reused

**Diagnostics for Local Cache Issues:**
```bash
# Check if cache directory exists
ls -la /tmp/.buildx-cache

# Verify cache key matches expected pattern
echo "expected key: ubuntu-latest-buildx-$(git rev-parse HEAD)"

# Check GitHub Actions cache state
# In workflow logs, look for:
# "Cache restored from key: ubuntu-latest-buildx-"
```

**Solutions:**

1. **Verify Cache Key Generation:**
   ```yaml
   # Check that cache-key step is generating correct keys
   - name: Debug cache keys
     run: |
       echo "OS: ${{ runner.os }}"
       echo "SHA: ${{ github.sha }}"
       echo "Cache key would be: ${{ runner.os }}-buildx-${{ github.sha }}"
   ```

2. **Check Cache Move Step:**
   Look for these logs in the workflow:
   ```
   Moving Docker cache to handle directory properly...
   Cache move completed successfully
   ```

3. **Verify BuildKit Setup:**
   The enhanced BuildKit configuration should show these features:
   ```
   Buildx: Docker Buildx + BuildKit
   Max parallelism: 4
   Network: host
   ```

### 2. Cache Corruption Issues

**Symptoms:**
- Build fails during cache restore
- "failed to solve: failed to read cache" errors
- Inconsistent build behavior

**Solutions:**

1. **Quick Fix - Manual Rebuild:**
   Trigger workflow with `rebuild-cache=true` parameter

2. **Clear Registry Cache Manually:**
   ```bash
   # Delete all cache tags (requires GHCR access)
   docker rmi ghcr.io/arthurlee116/english-listening-trainer:cache-base
   docker rmi ghcr.io/arthurlee116/english-listening-trainer:cache-python-deps
   docker rmi ghcr.io/arthurlee116/english-listening-trainer:cache-node-deps
   docker rmi ghcr.io/arthurlee116/english-listening-trainer:cache-builder
   ```

3. **Clear GitHub Actions Cache:**
   - Go to repository Settings → Actions → Caches
   - Delete all caches for "english-listening-trainer" scope

### 3. Slow Cache Performance

**Symptoms:**
- Cache takes >2 minutes to restore
- Build slower than expected despite cache hits

**Diagnostics:**
```bash
# Check cache sizes
docker buildx du --verbose

# Inspect cache transfer
docker buildx build --progress=plain --target=base .
```

**Solutions:**

1. **Optimize Build Context:**
   - Ensure `.dockerignore` is properly configured
   - Exclude unnecessary large files from build context

2. **Check Network Connectivity:**
   - Verify stable connection to GHCR
   - Consider regional network issues

3. **Monitor Cache Compression:**
   - Workflow uses `compression=zstd` for optimal transfer
   - Consider using `compression=estargz` for faster pulls

### 4. Cache Invalidation Not Working

**Symptoms:**
- Old dependencies still used after updates
- New packages not installed after package.json changes

**Solutions:**

1. **Verify File Hashes:**
   Check that dependency files are properly tracked:
   ```bash
   # In workflow, check generated cache keys
   echo "Cache keys:"
   echo "Base: $(git hash-object Dockerfile)"
   echo "Python: $(cat kokoro-local/requirements.txt | git hash-object --stdin)"
   echo "Node: $(cat package.json package-lock.json | git hash-object --stdin)"
   ```

2. **Force Stage Rebuild:**
   - Add a comment to the relevant Dockerfile stage
   - Modify the specific file that should trigger invalidation

3. **Check File Placement:**
   - Ensure `COPY` commands are in the right order
   - Dependencies should be copied before application code

## Performance Monitoring

### Expected Build Times

| Scenario | Expected Time | Warning Threshold |
|----------|---------------|-------------------|
| Code-only change | 3-7 minutes | >10 minutes |
| npm package update | 8-12 minutes | >15 minutes |
| Python requirement update | 18-25 minutes | >30 minutes |
| Full rebuild | 20-30 minutes | >40 minutes |

### Build Metrics to Track

1. **Cache Hit Rate:**
   ```bash
   # In build logs, look for:
   # => CACHED [stage/name]
   # => [internal] load cache
   ```

2. **Cache Restore Time:**
   Look for "importing cache manifest" messages and their duration

3. **Stage-by-Stage Timing:**
   Monitor individual stage build times to identify bottlenecks

## Debug Workflow

### Enable Verbose Logging

Modify the workflow temporarily for debugging:

```yaml
- name: Build and push Docker image with debugging
  uses: docker/build-push-action@v6
  with:
    # ... existing config ...
    build-args: |
      BUILDKIT_INLINE_CACHE=1
      BUILDKIT_PROGRESS=plain  # Verbose output
```

### Local Testing

Test cache behavior locally:

```bash
# Setup BuildKit locally
docker buildx create --use
docker buildx inspect --bootstrap

# Test with cache
docker buildx build \
  --cache-from type=local,src=/tmp/.buildx-cache \
  --cache-to type=local,dest=/tmp/.buildx-cache \
  --target runtime \
  .

# Check local cache
docker buildx du --verbose
```

## Emergency Recovery

### Complete Cache Reset

If all else fails, perform a complete cache reset:

1. **Clear All Registry Images:**
   ```bash
   # Delete all application and cache images
   docker rmi $(docker images "ghcr.io/arthurlee116/english-listening-trainer*" -q)
   ```

2. **Clear GitHub Actions Cache:**
   - Go to repository Settings → Actions → Caches
   - Delete all caches

3. **Force Full Rebuild:**
   - Trigger workflow with `rebuild-cache=true`
   - First build will take full time (~20-30 minutes)

4. **Verify Recovery:**
   - Subsequent builds should be fast again
   - Monitor the GitHub Actions cache summary

## Getting Help

### Information to Collect

When reporting cache issues, include:

1. **Build Information:**
   - Full workflow run URL
   - Build time breakdown
   - Cache hit/miss patterns

2. **Environment Details:**
   - Repository and branch
   - Dockerfile version
   - Workflow version

3. **Error Messages:**
   - Complete error log
   - Step where error occurred
   - Any relevant GitHub Actions warnings

### Performance Analysis

To analyze cache performance:

```bash
# Extract timing information from workflow
grep "took\|CACHED\|cache" workflow-log.txt

# Analyze cache effectiveness
docker buildx du --format "{{.Type}}\t{{.Size}}"

# Check BuildKit cache
docker buildx inspect --bootstrap
```

---

**Last Updated**: October 4, 2024  
**Version**: 1.0  
**Contact**: Repository maintainers for additional support
