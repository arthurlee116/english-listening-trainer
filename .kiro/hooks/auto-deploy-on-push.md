---
name: Auto Deploy on Git Push
trigger: after_git_push
enabled: true
---

# Auto Deploy on Git Push to Production Server

## Goal
Automatically deploy the application to the production server after successfully pushing code to the main branch and waiting for GitHub Actions to build the Docker image.

## Trigger Event
After executing `git push origin main` successfully

## Workflow Steps

### Step 1: Confirm Push Success
- Verify that the git push command completed successfully
- Confirm the target branch is `main`

### Step 2: Monitor GitHub Actions Build
- Check GitHub Actions workflow status for repository `arthurlee116/english-listening-trainer`
- Poll the workflow status every 30 seconds
- Wait until the "Build and Push Docker Image" workflow completes successfully
- If workflow fails, notify user and stop execution

### Step 3: Deploy to Production Server
Once GitHub Actions build succeeds, execute the following on the production server:

**Server Details:**
- Host: `ubuntu@81.71.93.183`
- Project Path: `~/english-listening-trainer`
- Docker Compose File: `docker-compose.gpu.yml`

**Deployment Commands:**
```bash
# Pull latest code
cd ~/english-listening-trainer
git pull origin main

# Pull new Docker image (via NJU mirror)
docker compose -f docker-compose.gpu.yml pull

# Restart containers with new image
docker compose -f docker-compose.gpu.yml up -d

# Optional: Run migrations if needed
docker compose -f docker-compose.gpu.yml exec app npx prisma migrate deploy
```

### Step 4: Health Check
- Wait 30 seconds for containers to start
- Check health endpoint: `http://81.71.93.183:3000/api/health`
- Verify response status is 200 OK
- If health check fails, notify user with error details

### Step 5: Notification
- On success: "✅ Deployment completed successfully! App is running at http://81.71.93.183:3000"
- On failure: "❌ Deployment failed at [step]. Check logs for details."

## Prerequisites
- SSH key authentication configured for `ubuntu@81.71.93.183`
- GitHub personal access token for API access (to check workflow status)
- Docker and docker-compose installed on server
- NJU mirror configured in `/etc/docker/daemon.json`

## Environment Variables Needed
- `GITHUB_TOKEN`: Personal access token with `repo` scope
- `PROD_SERVER_HOST`: ubuntu@81.71.93.183
- `PROD_SERVER_PATH`: ~/english-listening-trainer

## Error Handling
- If GitHub Actions fails: Stop and notify, don't deploy
- If SSH connection fails: Retry 3 times with 10s delay
- If docker pull fails: Check mirror configuration and retry
- If health check fails: Show container logs and rollback option

## Notes
- This hook runs in the background and doesn't block your work
- You'll receive notifications at each major step
- The entire process typically takes 3-5 minutes
- Uses NJU mirror (ghcr.nju.edu.cn) for faster image pulling in China
