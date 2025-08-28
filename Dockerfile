# 多阶段构建 Dockerfile for Next.js + Kokoro TTS 应用
# 支持 Node.js 18 + Python 3.11 环境

# =========================
# Stage 1: 依赖安装和构建
# =========================
FROM node:18-alpine AS builder

# 安装 Python 和编译依赖
RUN apk add --no-cache \
    python3 \
    python3-dev \
    py3-pip \
    build-base \
    linux-headers \
    && python3 -m ensurepip

# 设置工作目录
WORKDIR /app

# 复制 package 文件并安装 Node.js 依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 复制 Prisma schema 并生成客户端
COPY prisma ./prisma
RUN npx prisma generate

# 复制源代码
COPY . .

# 构建 Next.js 应用 (standalone 模式，包含 Prisma 生成)
RUN npm run build

# =========================  
# Stage 2: 生产运行环境
# =========================
FROM node:18-alpine AS runner

# 安装运行时依赖（包括数据库客户端）
RUN apk add --no-cache \
    python3 \
    py3-pip \
    dumb-init \
    postgresql-client \
    mysql-client \
    curl \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 设置工作目录
WORKDIR /app

# 创建必要的目录
RUN mkdir -p /app/data /app/public/audio /app/logs \
    && chown -R nextjs:nodejs /app

# 从构建阶段复制 Next.js standalone 输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 复制 Prisma 相关文件
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# 复制 Kokoro TTS 相关文件
COPY --from=builder --chown=nextjs:nodejs /app/kokoro-local ./kokoro-local
COPY --from=builder --chown=nextjs:nodejs /app/kokoro-main-ref ./kokoro-main-ref

# 复制数据库初始化脚本
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# 安装 Python 依赖 (Kokoro TTS)
COPY kokoro-local/requirements.txt ./kokoro-local/
RUN cd kokoro-local && python3 -m pip install --no-cache-dir -r requirements.txt

# 设置环境变量
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PYTHONPATH=/app/kokoro-main-ref \
    PYTORCH_ENABLE_MPS_FALLBACK=1

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 切换到非 root 用户
USER nextjs

# 启动应用
CMD ["dumb-init", "node", "server.js"]