# GPU-ready multi-stage build for Next.js + Kokoro TTS
# Base runtime uses NVIDIA CUDA 12.1 with cuDNN on Ubuntu 22.04 to support Tesla P40

###############################################################################
# Stage: base
# Install Node.js 18, Python 3.10 toolchain, and system deps shared by all stages
###############################################################################
FROM nvidia/cuda:12.1.1-cudnn-runtime-ubuntu22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_MAJOR=18 \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8

RUN apt-get update \
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

COPY package.json package-lock.json* .
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# Build Next.js in standalone mode (includes Prisma client)
RUN npm run build

###############################################################################
# Stage: runtime
# Copy built artifacts, provision Kokoro GPU environment, and define runtime
###############################################################################
FROM base AS runtime

ENV NODE_ENV=production \
    APP_HOME=/app \
    KOKORO_VENV=/app/kokoro-local/venv \
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
COPY --from=deps --chown=nextjs:nodejs /app/kokoro-local ./kokoro-local
COPY --from=deps --chown=nextjs:nodejs /app/kokoro-main-ref ./kokoro-main-ref
COPY --from=deps --chown=nextjs:nodejs /app/admin-server.mjs ./admin-server.mjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Keep Prisma query engine artifacts that aren't part of standalone output
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Install Kokoro Python environment with CUDA-enabled PyTorch
RUN npm prune --omit=dev \
 && npm cache clean --force \
 && python3 -m venv ${KOKORO_VENV} \
 && ${KOKORO_VENV}/bin/pip install --upgrade pip \
 && ${KOKORO_VENV}/bin/pip install --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/cu121 \
      torch==2.3.0+cu121 torchaudio==2.3.0+cu121 torchvision==0.18.0+cu121 \
 && ${KOKORO_VENV}/bin/pip install --no-cache-dir -r /app/kokoro-local/requirements.txt \
 && find ${KOKORO_VENV} -type f -name "*.pyc" -delete

# Ensure venv bin is preferred when spawning python
ENV PATH=${KOKORO_VENV}/bin:${PATH}

# Copy entry script to warm up Kokoro if needed (optional placeholder)

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
