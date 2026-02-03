FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Accept DATABASE_URL as build argument
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build


FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates adduser ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN adduser --disabled-password --gecos "" --uid 10001 nodeapp

COPY --from=build --chown=nodeapp:nodeapp /app/package.json /app/package-lock.json ./
COPY --from=build --chown=nodeapp:nodeapp /app/node_modules ./node_modules
COPY --from=build --chown=nodeapp:nodeapp /app/.next ./.next
COPY --from=build --chown=nodeapp:nodeapp /app/public ./public
COPY --from=build --chown=nodeapp:nodeapp /app/prisma ./prisma
COPY --from=build --chown=nodeapp:nodeapp /app/prisma.config.ts ./prisma.config.ts

USER nodeapp
EXPOSE 3000

CMD ["npm","run","start"]
