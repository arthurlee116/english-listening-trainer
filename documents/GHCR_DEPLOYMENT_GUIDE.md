# GitHub Container Registry (GHCR) Deployment Guide

## Overview

This guide explains how to deploy the English Listening Trainer application using Docker images automatically built and published to GitHub Container Registry (GHCR) via GitHub Actions.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [First-Time Setup](#first-time-setup)
3. [Personal Access Token (PAT) Creation](#personal-access-token-pat-creation)
4. [Server Authentication Configuration](#server-authentication-configuration)
5. [Deployment Flow](#deployment-flow)
6. [Image Management](#image-management)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)
10. [Security Recommendations](#security-recommendations)

---

## Prerequisites

Before deploying from GHCR, ensure you have:

- **GitHub Repository**: Your code is hosted on GitHub with Actions enabled
- **GitHub Actions Workflow**: CI/CD workflow configured (see `.github/workflows/docker-build.yml`)
- **Docker Server**: Target server with Docker and Docker Compose installed
- **SSH Access**: Ability to SSH into the deployment server
- **GitHub Account**: With appropriate repository permissions

### Server Requirements

- Docker Engine 20.10+
- Docker Compose 2.0+
- SSH access with sudo privileges
- Network access to `ghcr.io`

---

## First-Time Setup

### 1. Verify GitHub Actions Workflow

Ensure your repository has the GitHub Actions workflow file at `.github/workflows/docker-build.yml`. This workflow:

- Builds Docker images on every push to `main` branch
- Publishes images to GHCR with tags: `latest` and `sha-<commit>`
- Runs automatically or can be triggered manually

### 2. Check Image Availability

After the first successful workflow run, verify your image is published:

1. Go to your GitHub repository
2. Click on "Packages" in the right sidebar
3. You should see `english-listening-trainer` package
4. Click on it to view available tags

---

## Personal Access Token (PAT) Creation

To pull images from GHCR, you need a GitHub Personal Access Token with appropriate permissions.

### Step-by-Step PAT Creation

1. **Navigate to GitHub Settings**
   - Go to GitHub.com and click your profile picture
   - Select "Settings" → "Developer settings" → "Personal access tokens" → "Tokens (classic)"

2. **Generate New Token**
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a descriptive name: `GHCR Pull Token - Production Server`

3. **Set Expiration**
   - Choose expiration period (recommended: 90 days or 1 year)
   - Set a calendar reminder to rotate the token before expiration

4. **Select Scopes**
   - Check `read:packages` - Required to pull images from GHCR
   - Check `write:packages` - Only if you need to push images from this server (usually not needed)

5. **Generate and Save**
   - Click "Generate token"
   - **IMPORTANT**: Copy the token immediately - you won't see it again!
   - Store it securely (password manager recommended)

### Token Security Notes

- Never commit tokens to Git repositories
- Use environment variables or secure vaults
- Rotate tokens regularly
- Use separate tokens for different servers/environments
- Revoke tokens immediately if compromised


---

## Server Authentication Configuration

There are three methods to authenticate Docker with GHCR on your server. Choose the one that best fits your security requirements.

### Method 1: Environment Variable (Recommended for Automation)

Store the PAT in an environment variable for use in scripts.

```bash
# Add to ~/.bashrc or ~/.zshrc
export GHCR_TOKEN="ghp_your_token_here"

# Reload shell configuration
source ~/.bashrc  # or source ~/.zshrc

# Login to GHCR
echo $GHCR_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

**Pros**: Easy to use in scripts, can be rotated easily
**Cons**: Token visible in environment, less secure if server is shared

### Method 2: Docker Credential Store (Most Secure)

Use Docker's built-in credential storage for better security.

```bash
# One-time login (credentials stored securely)
docker login ghcr.io -u YOUR_GITHUB_USERNAME

# When prompted, paste your PAT as the password
# Docker will store credentials in ~/.docker/config.json
```

**Pros**: Most secure, credentials encrypted, persistent across sessions
**Cons**: Requires manual re-authentication when token expires

### Method 3: Deployment Script with Inline Authentication

Authenticate within the deployment script itself.

```bash
#!/bin/bash
# In your deployment script

# Read token from secure location
GHCR_TOKEN=$(cat /secure/path/ghcr-token.txt)

# Login before pulling
echo $GHCR_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Pull and deploy
docker compose pull
docker compose up -d
```

**Pros**: Flexible, can integrate with secret management systems
**Cons**: Requires careful file permission management

### Verification

Test your authentication:

```bash
# Try pulling a test image
docker pull ghcr.io/YOUR_GITHUB_USERNAME/english-listening-trainer:latest

# Check login status
docker system info | grep -i registry
```

---

## Deployment Flow

### Standard Deployment Process

1. **Code Push Triggers Build**
   ```bash
   # On your development machine
   git add .
   git commit -m "feat: add new feature"
   git push origin main
   ```

2. **GitHub Actions Builds Image**
   - Workflow automatically triggers
   - Builds Docker image
   - Publishes to GHCR with tags: `latest` and `sha-<commit>`
   - Takes 5-10 minutes typically

3. **Monitor Build Progress**
   - Go to repository → "Actions" tab
   - Watch the workflow run
   - Check for any build errors

4. **Deploy to Server**

   **Option A: Manual Deployment**
   ```bash
   # SSH to your server
   ssh user@your-server.com

   # Navigate to project directory
   cd /path/to/english-listening-trainer

   # Pull latest image
   docker compose pull

   # Restart services
   docker compose up -d

   # Verify deployment
   docker compose ps
   docker compose logs -f --tail=50
   ```

   **Option B: Automated Deployment Script**
   ```bash
   # On your local machine
   ./scripts/remote-deploy-gpu.sh
   ```

### Deployment with Specific Version

To deploy a specific commit version:

```bash
# Edit docker-compose.gpu.yml
# Change image tag from 'latest' to 'sha-abc123'
image: ghcr.io/YOUR_USERNAME/english-listening-trainer:sha-abc123

# Pull and deploy
docker compose -f docker-compose.gpu.yml pull
docker compose -f docker-compose.gpu.yml up -d
```


---

## Image Management

### Viewing Available Images

**Via GitHub Web Interface:**
1. Go to your repository on GitHub
2. Click "Packages" in the right sidebar
3. Click on `english-listening-trainer`
4. View all available tags and their metadata

**Via Docker CLI:**
```bash
# List local images
docker images ghcr.io/YOUR_USERNAME/english-listening-trainer

# View image details
docker inspect ghcr.io/YOUR_USERNAME/english-listening-trainer:latest

# Check image labels
docker inspect ghcr.io/YOUR_USERNAME/english-listening-trainer:latest \
  --format='{{json .Config.Labels}}' | jq
```

### Image Tags Explained

- **`latest`**: Always points to the most recent build from `main` branch
- **`sha-<commit>`**: Specific commit version (e.g., `sha-abc123def`)
  - Immutable - never changes
  - Useful for rollbacks and version pinning

### Pulling Specific Versions

```bash
# Pull latest version
docker pull ghcr.io/YOUR_USERNAME/english-listening-trainer:latest

# Pull specific commit version
docker pull ghcr.io/YOUR_USERNAME/english-listening-trainer:sha-abc123

# Pull and tag locally
docker pull ghcr.io/YOUR_USERNAME/english-listening-trainer:sha-abc123
docker tag ghcr.io/YOUR_USERNAME/english-listening-trainer:sha-abc123 \
  english-listening-trainer:stable
```

### Image Cleanup

Remove old images to free up disk space:

```bash
# Remove unused images
docker image prune -a

# Remove specific old version
docker rmi ghcr.io/YOUR_USERNAME/english-listening-trainer:sha-old123

# Remove all but latest
docker images ghcr.io/YOUR_USERNAME/english-listening-trainer \
  --format "{{.Tag}}" | grep -v latest | xargs -I {} \
  docker rmi ghcr.io/YOUR_USERNAME/english-listening-trainer:{}
```

### GHCR Package Cleanup

Delete old versions from GitHub Packages:

1. Go to repository → Packages → `english-listening-trainer`
2. Click on a specific version
3. Click "Delete version" (requires appropriate permissions)
4. Or use GitHub API for bulk deletion

---

## Rollback Procedures

### Quick Rollback to Previous Version

If the latest deployment has issues, rollback to a known good version:

**Step 1: Identify Good Version**
```bash
# Check deployment history
docker compose logs --tail=100 | grep "version"

# Or check GitHub Actions history for last successful build
# Note the commit SHA
```

**Step 2: Update Compose File**
```bash
# Edit docker-compose.gpu.yml
nano docker-compose.gpu.yml

# Change image tag to previous version
# FROM:
#   image: ghcr.io/YOUR_USERNAME/english-listening-trainer:latest
# TO:
#   image: ghcr.io/YOUR_USERNAME/english-listening-trainer:sha-abc123
```

**Step 3: Deploy Previous Version**
```bash
# Pull the specific version
docker compose -f docker-compose.gpu.yml pull

# Stop current version
docker compose -f docker-compose.gpu.yml down

# Start previous version
docker compose -f docker-compose.gpu.yml up -d

# Verify
docker compose -f docker-compose.gpu.yml ps
docker compose -f docker-compose.gpu.yml logs -f --tail=50
```

### Emergency Rollback Script

Create a quick rollback script:

```bash
#!/bin/bash
# rollback.sh

if [ -z "$1" ]; then
  echo "Usage: ./rollback.sh <commit-sha>"
  exit 1
fi

COMMIT_SHA=$1
IMAGE="ghcr.io/YOUR_USERNAME/english-listening-trainer:sha-$COMMIT_SHA"

echo "Rolling back to $IMAGE..."

# Update docker-compose file
sed -i.bak "s|image: ghcr.io/.*|image: $IMAGE|g" docker-compose.gpu.yml

# Deploy
docker compose -f docker-compose.gpu.yml pull
docker compose -f docker-compose.gpu.yml down
docker compose -f docker-compose.gpu.yml up -d

echo "Rollback complete!"
docker compose -f docker-compose.gpu.yml ps
```

Usage:
```bash
chmod +x rollback.sh
./rollback.sh abc123
```

### Database Rollback Considerations

**IMPORTANT**: Rolling back the application doesn't rollback the database!

If database migrations were applied:
1. Check if migrations are reversible
2. Run down migrations if needed
3. Restore database backup if necessary

```bash
# Backup database before deployment
docker compose exec app npm run db:backup

# Restore if needed
docker compose exec app npm run db:restore backup-file.sql
```


---

## Troubleshooting

### Issue: Authentication Failed

**Symptom:**
```
Error response from daemon: unauthorized: authentication required
```

**Solutions:**

1. **Check Token Validity**
   ```bash
   # Test token with GitHub API
   curl -H "Authorization: token YOUR_TOKEN" \
     https://api.github.com/user
   ```

2. **Re-authenticate**
   ```bash
   docker logout ghcr.io
   docker login ghcr.io -u YOUR_USERNAME
   # Enter PAT when prompted
   ```

3. **Verify Token Permissions**
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Ensure `read:packages` scope is enabled
   - Check token hasn't expired

### Issue: Image Not Found

**Symptom:**
```
Error response from daemon: manifest for ghcr.io/.../image:tag not found
```

**Solutions:**

1. **Check Package Visibility**
   - Go to repository → Packages
   - Ensure package is not private or you have access
   - Check package settings → "Manage Actions access"

2. **Verify Tag Exists**
   ```bash
   # List available tags via GitHub API
   curl -H "Authorization: token YOUR_TOKEN" \
     https://api.github.com/users/YOUR_USERNAME/packages/container/english-listening-trainer/versions
   ```

3. **Check Workflow Success**
   - Go to repository → Actions
   - Verify latest workflow completed successfully
   - Check workflow logs for build errors

### Issue: Pull Rate Limiting

**Symptom:**
```
Error response from daemon: toomanyrequests: too many requests
```

**Solutions:**

1. **Authenticate to Increase Limits**
   - GHCR has higher limits for authenticated users
   - Ensure you're logged in: `docker login ghcr.io`

2. **Use Image Caching**
   - Don't pull on every deployment if image hasn't changed
   - Check image digest before pulling

3. **Wait and Retry**
   - Rate limits reset after a period
   - Implement exponential backoff in scripts

### Issue: Deployment Fails After Pull

**Symptom:**
Container starts but application doesn't work correctly

**Solutions:**

1. **Check Environment Variables**
   ```bash
   # Verify .env.production exists and is correct
   cat .env.production
   
   # Check container environment
   docker compose exec app env | grep -E 'DATABASE|JWT|CEREBRAS'
   ```

2. **Check Volume Mounts**
   ```bash
   # Verify volumes are mounted correctly
   docker compose exec app ls -la /app/data
   docker compose exec app ls -la /app/kokoro-local
   ```

3. **Check Logs**
   ```bash
   # Application logs
   docker compose logs app -f --tail=100
   
   # System logs
   journalctl -u docker -f
   ```

4. **Verify Database Migrations**
   ```bash
   # Run migrations manually if needed
   docker compose exec app npm run db:migrate
   ```

### Issue: GPU Not Available in Container

**Symptom:**
TTS falls back to CPU mode despite GPU server

**Solutions:**

1. **Verify NVIDIA Runtime**
   ```bash
   # Check Docker can see GPU
   docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
   ```

2. **Check Compose Configuration**
   ```yaml
   # Ensure docker-compose.gpu.yml has:
   deploy:
     resources:
       reservations:
         devices:
           - driver: nvidia
             count: all
             capabilities: [gpu]
   ```

3. **Restart Docker Daemon**
   ```bash
   sudo systemctl restart docker
   ```

### Issue: Old Image Still Running

**Symptom:**
Pulled new image but old version still running

**Solutions:**

1. **Force Recreate Containers**
   ```bash
   docker compose up -d --force-recreate
   ```

2. **Remove Old Containers**
   ```bash
   docker compose down
   docker compose up -d
   ```

3. **Verify Image ID**
   ```bash
   # Check running container image
   docker compose ps --format json | jq '.[].Image'
   
   # Compare with pulled image
   docker images ghcr.io/YOUR_USERNAME/english-listening-trainer:latest
   ```


---

## Best Practices

### 1. Version Pinning for Production

**Don't rely on `latest` tag in production:**

```yaml
# ❌ Bad - unpredictable updates
image: ghcr.io/YOUR_USERNAME/english-listening-trainer:latest

# ✅ Good - explicit version control
image: ghcr.io/YOUR_USERNAME/english-listening-trainer:sha-abc123
```

**Benefits:**
- Predictable deployments
- Easy rollbacks
- Clear audit trail
- Prevents unexpected breaking changes

### 2. Automated Health Checks

Add health checks to your deployment process:

```bash
#!/bin/bash
# deploy-with-health-check.sh

# Deploy
docker compose up -d

# Wait for container to be healthy
echo "Waiting for health check..."
timeout 60 bash -c 'until docker compose ps | grep -q "healthy"; do sleep 2; done'

if [ $? -eq 0 ]; then
  echo "✅ Deployment successful and healthy"
else
  echo "❌ Health check failed, rolling back..."
  docker compose down
  # Restore previous version
  exit 1
fi
```

### 3. Blue-Green Deployments

For zero-downtime deployments:

```bash
# Start new version on different port
docker compose -f docker-compose.blue.yml up -d

# Test new version
curl http://localhost:3001/api/health

# Switch traffic (update nginx/load balancer)
# Stop old version
docker compose -f docker-compose.green.yml down
```

### 4. Monitoring and Alerting

Set up monitoring for deployments:

```bash
# Log deployment events
echo "$(date): Deployed sha-$COMMIT_SHA" >> /var/log/deployments.log

# Send notification (example with webhook)
curl -X POST https://your-webhook.com/notify \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Deployed version sha-$COMMIT_SHA\"}"
```

### 5. Regular Token Rotation

Create a reminder system for token rotation:

```bash
# Add to crontab - check token expiry monthly
0 0 1 * * /path/to/check-token-expiry.sh
```

### 6. Backup Before Deployment

Always backup critical data:

```bash
#!/bin/bash
# pre-deploy-backup.sh

# Backup database
docker compose exec app npm run db:backup

# Backup volumes
docker run --rm -v app_data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/data-$(date +%Y%m%d-%H%M%S).tar.gz /data

echo "✅ Backup complete"
```

### 7. Deployment Checklist

Create a checklist for each deployment:

- [ ] Check GitHub Actions workflow succeeded
- [ ] Review changes in commit history
- [ ] Backup database and volumes
- [ ] Pull new image
- [ ] Stop old containers
- [ ] Start new containers
- [ ] Verify health checks pass
- [ ] Test critical functionality
- [ ] Monitor logs for errors
- [ ] Update deployment log

### 8. Use Deployment Scripts

Standardize deployments with scripts:

```bash
# scripts/deploy-production.sh
#!/bin/bash
set -e

COMMIT_SHA=$1
IMAGE="ghcr.io/YOUR_USERNAME/english-listening-trainer:sha-$COMMIT_SHA"

echo "🚀 Deploying $IMAGE..."

# Pre-deployment checks
./scripts/pre-deploy-backup.sh
./scripts/check-server-resources.sh

# Update compose file
sed -i.bak "s|image: ghcr.io/.*|image: $IMAGE|g" docker-compose.gpu.yml

# Deploy
docker compose -f docker-compose.gpu.yml pull
docker compose -f docker-compose.gpu.yml up -d

# Post-deployment checks
./scripts/health-check.sh
./scripts/smoke-test.sh

echo "✅ Deployment complete!"
```


---

## Security Recommendations

### 1. Token Management

**DO:**
- ✅ Use separate tokens for different environments (dev, staging, prod)
- ✅ Store tokens in secure vaults (HashiCorp Vault, AWS Secrets Manager)
- ✅ Set token expiration dates and rotate regularly
- ✅ Use minimum required permissions (`read:packages` only for deployment)
- ✅ Revoke tokens immediately when no longer needed

**DON'T:**
- ❌ Commit tokens to Git repositories
- ❌ Share tokens between team members
- ❌ Use tokens with excessive permissions
- ❌ Store tokens in plain text files
- ❌ Use the same token for multiple purposes

### 2. Image Security

**Scan Images for Vulnerabilities:**

```bash
# Using Docker Scout (built-in)
docker scout cves ghcr.io/YOUR_USERNAME/english-listening-trainer:latest

# Using Trivy
trivy image ghcr.io/YOUR_USERNAME/english-listening-trainer:latest
```

**Sign Images for Verification:**

```bash
# Using Docker Content Trust
export DOCKER_CONTENT_TRUST=1
docker pull ghcr.io/YOUR_USERNAME/english-listening-trainer:latest
```

### 3. Network Security

**Restrict GHCR Access:**

```bash
# Firewall rules - only allow GHCR IPs
sudo ufw allow from 140.82.112.0/20 to any port 443

# Or use VPN/private network for deployment servers
```

**Use TLS for All Connections:**
- Ensure Docker daemon uses TLS
- Verify GHCR connections use HTTPS
- Use SSH keys (not passwords) for server access

### 4. Access Control

**Limit Server Access:**

```bash
# Create dedicated deployment user
sudo useradd -m -s /bin/bash deployer
sudo usermod -aG docker deployer

# Use this user for deployments only
# Don't use root or personal accounts
```

**Repository Permissions:**
- Use GitHub Teams for access control
- Require 2FA for all team members
- Use branch protection rules
- Require code reviews before merging

### 5. Audit Logging

**Enable Comprehensive Logging:**

```bash
# Docker daemon logging
# Edit /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}

# Application logging
# Ensure all deployments are logged
echo "$(date) - User: $USER - Action: deploy - Image: $IMAGE" >> /var/log/deployments.log
```

**Monitor for Suspicious Activity:**
- Failed authentication attempts
- Unusual pull patterns
- Unexpected image versions
- Access from unknown IPs

### 6. Environment Variables

**Secure Environment Configuration:**

```bash
# ❌ Bad - exposed in docker-compose.yml
environment:
  JWT_SECRET: "my-secret-key"

# ✅ Good - use .env file with restricted permissions
env_file:
  - .env.production

# Set proper permissions
chmod 600 .env.production
chown deployer:deployer .env.production
```

### 7. Regular Security Updates

**Keep Everything Updated:**

```bash
# Update Docker
sudo apt update && sudo apt upgrade docker-ce docker-ce-cli containerd.io

# Update base images regularly
# Rebuild and redeploy even if code hasn't changed

# Monitor security advisories
# Subscribe to GitHub Security Advisories for dependencies
```

### 8. Incident Response Plan

**Prepare for Security Incidents:**

1. **Detection**: Monitor logs and alerts
2. **Containment**: 
   ```bash
   # Immediately stop compromised containers
   docker compose down
   
   # Revoke compromised tokens
   # Via GitHub Settings → Developer settings → Personal access tokens
   ```
3. **Investigation**: Review logs, check for unauthorized changes
4. **Recovery**: Deploy known good version, rotate all secrets
5. **Post-Mortem**: Document incident, improve security measures

### 9. Compliance Considerations

**Data Protection:**
- Ensure GDPR/privacy compliance for user data
- Encrypt data at rest and in transit
- Implement data retention policies
- Regular security audits

**Access Logs:**
- Maintain audit trails for all deployments
- Log all administrative actions
- Retain logs per compliance requirements

---

## Quick Reference

### Common Commands

```bash
# Login to GHCR
docker login ghcr.io -u YOUR_USERNAME

# Pull latest image
docker pull ghcr.io/YOUR_USERNAME/english-listening-trainer:latest

# Deploy with compose
docker compose -f docker-compose.gpu.yml pull
docker compose -f docker-compose.gpu.yml up -d

# Check status
docker compose ps
docker compose logs -f --tail=50

# Rollback
docker compose down
# Edit docker-compose.gpu.yml to change image tag
docker compose up -d

# Cleanup
docker image prune -a
docker system prune -a
```

### Useful Links

- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)

---

## Support

For issues or questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review GitHub Actions workflow logs
3. Check Docker and application logs
4. Consult the main [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

**Last Updated**: 2025-01-03
**Version**: 1.0.0
