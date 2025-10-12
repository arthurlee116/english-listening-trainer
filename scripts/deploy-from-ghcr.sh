#!/bin/bash
set -e

# Configuration
REGISTRY="ghcr.io"
IMAGE_NAME="arthurlee116/english-listening-trainer"
TAG="${1:-latest}"
COMPOSE_FILE="docker-compose.gpu.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Deploying from GHCR...${NC}"
echo -e "${BLUE}📦 Image: $REGISTRY/$IMAGE_NAME:$TAG${NC}"
echo ""

# Pull latest image
echo -e "${BLUE}📥 检查缓存层状态...${NC}"
if ! ./scripts/verify-cache-layers.sh; then
    echo -e "${YELLOW}⚠️  缓存层不完整，开始预热...${NC}"
    echo -e "${BLUE}🔥 执行缓存预热...${NC}"
    if ! ./scripts/remote-cache-prewarm.sh; then
        echo -e "${RED}❌ 缓存预热失败${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ 缓存预热完成${NC}"
else
    echo -e "${GREEN}✅ 缓存层已就绪${NC}"
fi

echo ""
echo -e "${BLUE}📥 拉取runtime镜像...${NC}"
if ! docker pull "$REGISTRY/$IMAGE_NAME:$TAG"; then
  echo -e "${RED}❌ Failed to pull image from GHCR${NC}"
  echo -e "${YELLOW}💡 Make sure you're logged in: docker login ghcr.io${NC}"
  exit 1
fi

# Get current running image ID (if exists)
CURRENT_ID=$(docker inspect --format='{{.Image}}' \
  $(docker compose -f "$COMPOSE_FILE" ps -q app 2>/dev/null) 2>/dev/null || echo "none")

# Get new image ID
NEW_ID=$(docker inspect --format='{{.Id}}' "$REGISTRY/$IMAGE_NAME:$TAG")

# Compare image IDs
if [ "$CURRENT_ID" = "$NEW_ID" ]; then
  echo -e "${GREEN}✅ Already running the latest version${NC}"
  echo -e "${BLUE}ℹ️  Current image ID: ${CURRENT_ID:7:12}${NC}"
  exit 0
fi

echo -e "${YELLOW}🆕 New version detected${NC}"
echo -e "${BLUE}   Current: ${CURRENT_ID:7:12}${NC}"
echo -e "${BLUE}   New:     ${NEW_ID:7:12}${NC}"
echo ""

# Backup database
echo -e "${BLUE}💾 Backing up database...${NC}"
if [ -f "./scripts/backup.sh" ]; then
  if ./scripts/backup.sh --compress; then
    echo -e "${GREEN}✅ Database backup completed${NC}"
  else
    echo -e "${YELLOW}⚠️  Backup failed, continuing anyway...${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Backup script not found, skipping backup${NC}"
fi
echo ""

# Stop current containers
echo -e "${BLUE}🛑 Stopping current containers...${NC}"
docker compose -f "$COMPOSE_FILE" down
echo -e "${GREEN}✅ Containers stopped${NC}"
echo ""

# Set IMAGE_TAG environment variable
export IMAGE_TAG="$REGISTRY/$IMAGE_NAME:$TAG"

# Start containers with new image
echo -e "${BLUE}▶️  Starting containers with new image...${NC}"
docker compose -f "$COMPOSE_FILE" up -d
echo -e "${GREEN}✅ Containers started${NC}"
echo ""

# Wait for application to start
echo -e "${BLUE}⏳ Waiting for application to start (30 seconds)...${NC}"
sleep 30

# Verify deployment with health check
echo -e "${BLUE}✅ Verifying deployment...${NC}"
MAX_RETRIES=5
RETRY_COUNT=0
HEALTH_CHECK_PASSED=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -f -s http://localhost:3000/api/health > /dev/null 2>&1; then
    HEALTH_CHECK_PASSED=true
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo -e "${YELLOW}⏳ Health check attempt $RETRY_COUNT/$MAX_RETRIES...${NC}"
  sleep 5
done

echo ""
if [ "$HEALTH_CHECK_PASSED" = true ]; then
  echo -e "${GREEN}✅ Deployment successful!${NC}"
  echo -e "${GREEN}🌐 Application: http://localhost:3000${NC}"
  echo -e "${GREEN}🏥 Health check: http://localhost:3000/api/health${NC}"
  
  # Test TTS endpoint
  echo ""
  echo -e "${BLUE}🔊 Testing TTS endpoint...${NC}"
  if curl -f -s http://localhost:3000/api/tts > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TTS endpoint is accessible${NC}"
  else
    echo -e "${YELLOW}⚠️  TTS endpoint check failed (may need POST request)${NC}"
  fi
else
  echo -e "${RED}❌ Health check failed!${NC}"
  echo -e "${YELLOW}📋 Check logs with: docker compose -f $COMPOSE_FILE logs -f app${NC}"
  echo -e "${YELLOW}🔄 Rollback with: docker compose -f $COMPOSE_FILE down && docker compose -f $COMPOSE_FILE up -d${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo -e "${BLUE}📊 View logs: docker compose -f $COMPOSE_FILE logs -f app${NC}"
echo -e "${BLUE}🔍 Check status: docker compose -f $COMPOSE_FILE ps${NC}"
