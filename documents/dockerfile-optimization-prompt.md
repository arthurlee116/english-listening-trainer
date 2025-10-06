# Dockerfile Optimization Request

## Context & Problem

I'm working on an English Listening Trainer application with the following setup:

### Current Infrastructure
- **Local Development**: macOS with Apple M4, 32GB RAM, ARM64 architecture
- **Production Server**: Ubuntu 22.04 on remote GPU server (81.71.93.183)
  - GPU: NVIDIA Tesla P40 (requires CUDA 12.1)
  - Located in China (uses NJU mirror for Docker: ghcr.nju.edu.cn)
- **CI/CD**: GitHub Actions builds Docker images, pushes to GHCR
- **Deployment**: Pull images from GHCR via NJU mirror, run with docker-compose

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 20
- **Database**: Prisma + SQLite (WAL mode)
- **UI**: React 19, shadcn/ui, Tailwind CSS
- **AI**: Cerebras Cloud SDK
- **TTS**: Kokoro (Python 3.8-3.12, PyTorch with CUDA support)

### Current Problem
**Every code change requires downloading a 3.3GB+ Docker image**, which is extremely slow and inefficient. The image is rebuilt from scratch even for small changes like updating a single JavaScript file.

### Current Dockerfile Structure
- Base image: `nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04` (very large)
- Multi-stage build with stages: base, deps, builder, runtime
- Installs: Node.js 20, Python 3.10, system dependencies, npm packages, Python packages
- Final runtime image includes Next.js standalone build + Kokoro TTS

## Optimization Goals

1. **Minimize layer invalidation**: Separate rarely-changed layers (dependencies) from frequently-changed layers (application code)
2. **Reduce image size**: Current image is 3.6GB, target < 2GB if possible
3. **Maximize cache reuse**: Small code changes should only require downloading changed layers (ideally < 100MB)
4. **Maintain GPU support**: Must work with NVIDIA Tesla P40 (CUDA 12.1)
5. **Keep all functionality**: Don't break TTS, database, or Next.js features

## Technical Requirements

### Must Keep
- NVIDIA CUDA 12.1 + cuDNN support for Tesla P40
- Node.js 20 (not 18)
- Python 3.10 (not 3.11+, Kokoro requires ≤3.12)
- PyTorch with CUDA support
- All system dependencies for audio processing (ffmpeg, sox, libsndfile1, espeak-ng)
- Next.js standalone output mode
- Prisma client generation
- Non-root user (UID/GID 1001)

### Current File Structure
```
/app/
├── package.json & package-lock.json (Node dependencies)
├── requirements.txt (Python dependencies)
├── prisma/schema.prisma (database schema)
├── next.config.mjs (Next.js config)
├── .next/ (built Next.js app)
├── public/ (static assets)
├── scripts/ (utility scripts like seed-docker.js)
├── kokoro_local/ (TTS engine code)
└── node_modules/ (installed packages)
```

### Frequently Changed Files
- `scripts/*.js` - utility scripts
- `app/**/*.tsx` - Next.js pages and API routes
- `components/**/*.tsx` - React components
- `lib/**/*.ts` - business logic

### Rarely Changed Files
- `package.json` / `package-lock.json` - only changes when adding dependencies
- `requirements.txt` - only changes when adding Python packages
- `prisma/schema.prisma` - only changes when modifying database schema
- System dependencies (apt packages)

## Current Dockerfile

```dockerfile
# GPU-ready multi-stage build for Next.js + Kokoro TTS
# Base runtime uses NVIDIA CUDA 12.1 with cuDNN on Ubuntu 22.04 to support Tesla P40

###############################################################################
# Stage: base
# Install Node.js 18, Python 3.10 toolchain, and system deps shared by all stages
###############################################################################
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_MAJOR=20 \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8

# Use cache mounts for apt packages to speed up builds
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
 && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    locales \
 && locale-gen en_US.UTF-8 \
 && mkdir -p /etc/apt/keyrings \
 && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
 && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
    build-essential \
    dumb-init \
    git \
    nodejs \
    pkg-config \
    python3 \
    python3-dev \
    python3-distutils \
    python3-venv \
    python3-pip \
    unzip \
    wget \
    ffmpeg \
    libsndfile1 \
    libsndfile1-dev \
    sox \
    libgl1 \
    libglib2.0-0 \
    zlib1g-dev \
    espeak-ng \
 && npm install -g npm@10 \
 && rm -rf /var/lib/apt/lists/*

# create non-root runtime user (UID/GID 1001 matches compose user overrides)
RUN groupadd --gid 1001 nodejs \
 && useradd --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin nextjs

ENV PYTHONUNBUFFERED=1 \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

###############################################################################
# Stage: deps
# Install Node dependencies, Prisma client, and build application
###############################################################################
FROM base AS deps

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy Prisma schema and generate client (separate layer for better caching)
COPY prisma ./prisma
RUN npx prisma generate

# Copy application code (this layer changes most frequently)
COPY . .

# Set build-time environment variables (placeholders for Next.js build)
# These will be replaced at runtime with actual values
ARG CEREBRAS_API_KEY=placeholder_for_build
ARG JWT_SECRET=placeholder_for_build
ARG DATABASE_URL=file:./data/app.db
ARG BUILDKIT_INLINE_CACHE=1

ENV CEREBRAS_API_KEY=$CEREBRAS_API_KEY \
    JWT_SECRET=$JWT_SECRET \
    DATABASE_URL=$DATABASE_URL \
    NEXT_TELEMETRY_DISABLED=1

# Build Next.js in standalone mode (includes Prisma client)
RUN npm run build

###############################################################################
# Stage: runtime
# Copy built artifacts, provision Kokoro GPU environment, and define runtime
###############################################################################
FROM base AS runtime

ENV NODE_ENV=production \
    APP_HOME=/app \
    KOKORO_VENV=/app/kokoro_local/venv \
    PYTHONPATH=/app/kokoro-main-ref:/app/kokoro-main-ref/kokoro.js \
    PYTORCH_ENABLE_MPS_FALLBACK=1 \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

WORKDIR ${APP_HOME}

# Ensure runtime directories exist and are owned by app user
RUN mkdir -p ${APP_HOME}/data ${APP_HOME}/public/audio ${APP_HOME}/logs ${APP_HOME}/backups \
 && chown -R nextjs:nodejs ${APP_HOME}

# Copy built node runtime + public assets
COPY --from=deps --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=deps --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=deps --chown=nextjs:nodejs /app/public ./public
COPY --from=deps --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=deps --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=deps --chown=nextjs:nodejs /app/package-lock.json ./package-lock.json
COPY --from=deps --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=deps --chown=nextjs:nodejs /app/kokoro_local ./kokoro_local
COPY --from=deps --chown=nextjs:nodejs /app/admin-server.mjs ./admin-server.mjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Keep Prisma query engine artifacts that aren't part of standalone output
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Prune dev dependencies and clean npm cache
RUN npm prune --omit=dev \
 && npm cache clean --force

# Install Kokoro Python environment with CUDA-enabled PyTorch
# Split into separate RUN commands for better layer caching
RUN python3 -m venv ${KOKORO_VENV} \
 && ${KOKORO_VENV}/bin/pip install --upgrade pip

# Install PyTorch with CUDA support (large, rarely changes - separate layer)
RUN --mount=type=cache,target=/root/.cache/pip \
    ${KOKORO_VENV}/bin/pip install --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/cu121 \
      torch==2.3.0+cu121 torchaudio==2.3.0+cu121 torchvision==0.18.0+cu121

# Install Kokoro requirements (separate layer for better caching)
RUN --mount=type=cache,target=/root/.cache/pip \
    ${KOKORO_VENV}/bin/pip install --no-cache-dir -r /app/kokoro_local/requirements.txt \
 && find ${KOKORO_VENV} -type f -name "*.pyc" -delete

# Pre-install SpaCy English model (required by Kokoro's misaki G2P)
# This prevents runtime download attempts that fail in offline/restricted environments
RUN ${KOKORO_VENV}/bin/python -m spacy download en_core_web_sm

# Ensure venv bin is preferred when spawning python
ENV PATH=${KOKORO_VENV}/bin:${PATH}

# Copy entry script to warm up Kokoro if needed (optional placeholder)

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
```

## Current .dockerignore

```
# Docker 构建忽略文件
# 排除不需要的文件以优化构建速度和镜像大小

# Node.js
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Next.js
.next
out

# 构建输出
build
dist

# 环境配置文件
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# 数据库文件
data/
*.db
*.db-shm
*.db-wal

# 日志文件
logs/
*.log

# 音频文件 (运行时生成)
public/audio/*.wav
public/tts_audio_*.wav

# 测试相关
coverage/
__tests__/
*.test.js
*.test.ts
*.spec.js
*.spec.ts

# 开发工具
.vscode/
.idea/
*.swp
*.swo
*~

# 操作系统
.DS_Store
Thumbs.db

# Git
.git
.gitignore

# 文档
README.md
docs/
*.md

# 备份文件
backups/
*.backup
*_backup*

# 临时文件
tmp/
temp/
.tmp

# Python 缓存
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
pip-log.txt

# Kokoro TTS 虚拟环境 (会在容器中重新创建)
kokoro_local/venv/

# 其他
.dockerignore
Dockerfile*
docker-compose*.yml
```

## Optimization Strategies to Consider

1. **Layer Ordering**:
   - System dependencies (apt-get) → rarely changes
   - Node.js dependencies (npm install) → changes occasionally
   - Python dependencies (pip install) → changes occasionally
   - Prisma generation → changes when schema changes
   - Next.js build → changes with code
   - Application code copy → changes frequently

2. **Dependency Caching**:
   - Copy only `package*.json` first, run `npm ci`, then copy rest of code
   - Copy only `requirements.txt` first, run `pip install`, then copy rest
   - Use `--mount=type=cache` for npm/pip cache directories

3. **Multi-stage Optimization**:
   - Build stage: Install all build tools, compile code
   - Runtime stage: Copy only necessary artifacts, minimal dependencies
   - Consider separate stage for Python dependencies

4. **Size Reduction**:
   - Use `--no-install-recommends` for apt (already doing)
   - Clean up apt cache (already doing)
   - Remove build tools from runtime image
   - Consider using slim Python base if possible
   - Minimize layers by combining RUN commands where appropriate

5. **GitHub Actions Cache**:
   - Already configured with `cache-from` and `cache-to`
   - Ensure cache is being utilized effectively

## Constraints

- **Cannot change base image family**: Must use NVIDIA CUDA images for GPU support
- **Cannot upgrade Python beyond 3.12**: Kokoro TTS compatibility
- **Must maintain current functionality**: All features must continue working
- **Must work with existing docker-compose.gpu.yml**: Don't break deployment setup

## Expected Outcome

After optimization:
- **Small code changes** (e.g., updating a script): Download < 100MB
- **Dependency changes**: Download < 500MB
- **Full rebuild**: Acceptable if unavoidable, but should be rare
- **Image size**: Reduced from 10.8GB to < 5GB if possible
- **Build time**: Faster due to better caching

## Deliverables Needed

1. **Optimized Dockerfile** with clear comments explaining layer strategy
2. **Updated .dockerignore** to exclude unnecessary files
3. **Explanation** of what changed and why
4. **Testing recommendations** to verify nothing broke
5. **Estimated size savings** and cache behavior improvements

## Additional Context

- I'm using Kiro IDE with Agent Hooks for automated deployment
- Current workflow: git push → GitHub Actions builds → pull image → restart containers
- I want to minimize the "pull image" step duration
- The server is in China, so download speed from GHCR (even via NJU mirror) is a bottleneck

## Files to Review

Please review these files in the repository:
- `Dockerfile` (main optimization target)
- `.dockerignore` (may need updates)
- `package.json` (to understand Node dependencies)
- `requirements.txt` (to understand Python dependencies)
- `next.config.mjs` (Next.js configuration)
- `docker-compose.gpu.yml` (deployment configuration)

---

**Please provide an optimized Dockerfile that significantly reduces the amount of data that needs to be downloaded when only application code changes, while maintaining all current functionality.**
