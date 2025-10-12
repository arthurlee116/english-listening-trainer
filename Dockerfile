# 生产环境Dockerfile - 用于CI/CD构建和部署
# 特点：完整的多级缓存策略，优化的层结构，支持GPU加速
# 使用场景：GitHub Actions构建、生产环境部署

# Optimized multi-stage build for Next.js + Kokoro TTS
# Strategy: Maximize caching by ordering from least to most frequently changed
# Base runtime uses NVIDIA CUDA 12.1 with cuDNN on Ubuntu 22.04 to support Tesla P40

###############################################################################
# Stage: base
# Install system dependencies that rarely change (shared across all stages)
###############################################################################
FROM ghcr.io/arthurlee116/base-images/cuda:12.1.1-cudnn8-runtime-ubuntu22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_MAJOR=20 \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    PYTHONUNBUFFERED=1

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

ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

###############################################################################
# Stage: python-deps
# Install Python dependencies (PyTorch + Kokoro requirements) - rarely changes
###############################################################################
FROM base AS python-deps

ENV KOKORO_VENV=/opt/kokoro-venv

# Create Python virtual environment
RUN python3 -m venv ${KOKORO_VENV} \
 && ${KOKORO_VENV}/bin/pip install --upgrade pip

# Install PyTorch with CUDA support (largest dependency, separate layer)
RUN --mount=type=cache,target=/root/.cache/pip \
    ${KOKORO_VENV}/bin/pip install --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/cu121 \
      torch==2.3.0+cu121 torchaudio==2.3.0+cu121 torchvision==0.18.0+cu121

# Install Kokoro Python requirements
COPY kokoro_local/requirements.txt /tmp/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    ${KOKORO_VENV}/bin/pip install --no-cache-dir -r /tmp/requirements.txt

# Pre-install SpaCy English model (required by Kokoro's misaki G2P)
RUN ${KOKORO_VENV}/bin/python -m spacy download en_core_web_sm

# Clean up Python cache
RUN find ${KOKORO_VENV} -type f -name "*.pyc" -delete \
 && find ${KOKORO_VENV} -type d -name "__pycache__" -exec rm -rf {} + || true

###############################################################################
# Stage: node-deps
# Install Node.js dependencies - changes when dependencies are updated
###############################################################################
FROM base AS node-deps

WORKDIR /app

# Copy package files first for optimal caching
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci && npm cache clean --force

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

###############################################################################
# Stage: builder
# Build Next.js application - changes most frequently
###############################################################################
FROM node-deps AS builder

# Copy application code (excluding files in .dockerignore)
COPY . .

# Set build-time environment variables (placeholders for Next.js build)
ARG CEREBRAS_API_KEY=placeholder_for_build
ARG JWT_SECRET=placeholder_for_build
ARG DATABASE_URL=file:./data/app.db

ENV CEREBRAS_API_KEY=$CEREBRAS_API_KEY \
    JWT_SECRET=$JWT_SECRET \
    DATABASE_URL=$DATABASE_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Build Next.js in standalone mode
RUN npm run build

###############################################################################
# Stage: runtime
# Final minimal runtime image with optimized layer structure
###############################################################################
FROM base AS runtime

# Runtime environment variables
ENV NODE_ENV=production \
    APP_HOME=/app \
    KOKORO_VENV=/opt/kokoro-venv \
    PYTHONPATH=/app/kokoro-main-ref:/app/kokoro-main-ref/kokoro.js \
    PYTORCH_ENABLE_MPS_FALLBACK=1 \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    PATH=${KOKORO_VENV}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

WORKDIR ${APP_HOME}

# Create runtime directories with correct ownership
RUN mkdir -p ${APP_HOME}/data ${APP_HOME}/public/audio ${APP_HOME}/logs ${APP_HOME}/backups \
 && chown -R nextjs:nodejs ${APP_HOME}

# Copy Python dependencies and Kokoro environment (installed in separate stage)
COPY --from=python-deps --chown=nextjs:nodejs /opt/kokoro-venv ${KOKORO_VENV}

# Copy built Node.js application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json ./package-lock.json

# Copy essential runtime files only
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/admin-server.mjs ./admin-server.mjs
COPY --from=builder --chown=nextjs:nodejs /app/kokoro_local ./kokoro_local

# Copy essential Prisma artifacts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Copy production node modules
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Optimized cleanup to reduce disk usage
RUN npm prune --omit=dev \
 && find ${KOKORO_VENV} -name "*.pyc" -delete \
 && find ${KOKORO_VENV} -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true \
 && rm -rf ${KOKORO_VENV}/share \
 && rm -rf ${KOKORO_VENV}/include \
 && rm -rf ${KOKORO_VENV}/lib/python*/site-packages/*/tests \
 && rm -rf ${KOKORO_VENV}/lib/python*/site-packages/*/test \
 && echo "✅ Cleanup completed successfully"

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
