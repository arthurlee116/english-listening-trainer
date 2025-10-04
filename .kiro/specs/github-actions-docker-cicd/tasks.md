# Implementation Plan

## Overview

This implementation plan breaks down the GitHub Actions Docker CI/CD pipeline into discrete, manageable tasks. Each task is designed to be completed independently and includes specific requirements references and implementation details.

---

## Task List

- [ ] 1. Create GitHub Actions workflow file
  - Create `.github/workflows/build-and-push.yml` with complete workflow configuration
  - Configure triggers for push to main and manual workflow dispatch
  - Set up proper permissions for GHCR access
  - Add workflow inputs for manual dispatch (branch, push option)
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3_

- [x] 1.1 Configure workflow triggers and permissions
  - Define `on.push.branches` for main branch
  - Define `on.workflow_dispatch` with input parameters
  - Set `permissions.contents: read` and `permissions.packages: write`
  - _Requirements: 1.1, 4.1, 6.2_

- [x] 1.2 Add checkout and Docker Buildx setup steps
  - Use `actions/checkout@v4` to checkout repository code
  - Use `docker/setup-buildx-action@v3` to enable BuildKit
  - Configure Buildx with default builder
  - _Requirements: 1.2, 3.1_

- [x] 1.3 Configure GHCR authentication step
  - Use `docker/login-action@v3` for GHCR login
  - Set registry to `ghcr.io`
  - Use `github.actor` as username
  - Use `secrets.GITHUB_TOKEN` as password
  - _Requirements: 2.1, 2.5, 6.2_

- [x] 1.4 Add metadata extraction step
  - Use `docker/metadata-action@v5` to generate tags and labels
  - Configure tag strategy: `latest` for main branch, `<branch>-<sha>` for commits
  - Add OCI labels for source, revision, created timestamp
  - _Requirements: 2.2, 2.3_

- [x] 1.5 Configure build and push step
  - Use `docker/build-push-action@v5` for building
  - Set context to `.` and dockerfile to `./Dockerfile`
  - Set target to `runtime` stage
  - Set platform to `linux/amd64`
  - Configure cache-from and cache-to for registry caching
  - Add build arg `BUILDKIT_INLINE_CACHE=1`
  - _Requirements: 1.2, 1.3, 1.4, 2.2, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 1.6 Update docker-compose.gpu.yml for GHCR integration
  - Update `image` field to use GHCR registry path
  - Set default image to `ghcr.io/arthurlee116/english-listening-trainer:latest`
  - Support `IMAGE_TAG` environment variable override
  - Keep build section commented for local development option
  - Update migrate service to use same image configuration
  - _Requirements: 7.1, 7.2, 9.1, 9.2_

- [x] 1.7 Create server deployment script
  - Create `scripts/deploy-from-ghcr.sh` with deployment automation
  - Accept optional tag parameter (default: latest)
  - Pull specified image from GHCR
  - Compare current and new image IDs
  - Backup database before deployment
  - Stop current containers gracefully
  - Start containers with new image
  - Wait for health check to pass
  - Verify deployment success
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 2. Add image pull and comparison logic
  - Pull image using `docker pull`
  - Get current running image ID
  - Get new image ID
  - Skip deployment if IDs match
  - _Requirements: 7.1, 7.2_

- [x] 2.1 Add backup and deployment logic
  - Call existing backup script with --compress flag
  - Stop containers with `docker compose down`
  - Export IMAGE_TAG environment variable
  - Start containers with `docker compose up -d`
  - _Requirements: 7.3, 7.4_

- [x] 2.2 Add health check verification
  - Wait 30 seconds for startup
  - Curl health endpoint with retry logic
  - Check TTS endpoint availability
  - Display deployment status
  - Exit with error code if health check fails
  - _Requirements: 7.5, 7.6, 8.5_

- [x] 2.3 Update TTS_ISSUE_ANALYSIS.md documentation
  - Add new "CI/CD Pipeline" section after "下一步"
  - Explain the problem and solution
  - Document how the pipeline works
  - Add deployment flow instructions (first-time setup and regular deployment)
  - Include deployment script usage examples
  - Document advantages and image tagging strategy
  - Add rollback instructions
  - Include link to GitHub Actions monitoring
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 2.4 Update DEPLOYMENT_GUIDE.md documentation
  - Update "步骤 7: 使用 Docker GPU 部署" section
  - Add "方案 A: 使用预构建镜像（推荐）" with GHCR deployment steps
  - Keep "方案 B: 本地构建（开发环境）" as alternative
  - Add comparison table showing advantages of each approach
  - Update deployment time estimates
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 3. Update AUTO_DEPLOY_GUIDE.md documentation
  - Add new "CI/CD 自动化部署" section at the end
  - Document GitHub Actions automatic build process
  - Create auto-deploy-from-ci.sh script example
  - Add crontab example for scheduled deployments
  - Include webhook deployment option (advanced)
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 3.1 Create GHCR_DEPLOYMENT_GUIDE.md documentation
  - Create comprehensive GHCR deployment guide
  - Document prerequisites and first-time setup
  - Explain Personal Access Token (PAT) creation process
  - Document server authentication configuration (3 methods)
  - Add deployment flow instructions
  - Document image management (viewing, tagging, cleanup)
  - Add rollback procedures
  - Include troubleshooting section
  - Add best practices and security recommendations
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.3, 6.4_

- [x] 3.2 Create workflow validation script
  - Create `scripts/validate-workflow.sh` for local testing
  - Check workflow YAML syntax
  - Verify required files exist (Dockerfile, package.json, etc.)
  - Check Docker Buildx availability
  - Validate GHCR connectivity
  - _Requirements: 8.1, 8.2, 8.4_

- [x] 3.3 Test workflow with manual dispatch
  - Push workflow file to repository
  - Navigate to Actions tab in GitHub
  - Trigger manual workflow dispatch
  - Monitor build progress and logs
  - Verify image appears in GitHub Packages
  - Check image tags (latest and sha)
  - Verify image metadata and labels
  - _Requirements: 4.1, 4.2, 4.3, 8.1, 8.2, 8.3_

- [x] 3.4 Test server deployment with GHCR image
  - SSH to GPU server
  - Create and configure GHCR Personal Access Token
  - Authenticate Docker to GHCR
  - Test image pull manually
  - Update docker-compose.gpu.yml to use GHCR image
  - Run deployment script
  - Verify application starts correctly
  - Test TTS functionality with GPU
  - Verify health check endpoint
  - Check application logs for errors
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 4. Create monitoring and health check script
  - Create `scripts/monitor-deployment.sh` for deployment monitoring
  - Display current image information
  - Show container status
  - Check health endpoint
  - Display GPU usage
  - Show recent logs
  - _Requirements: 8.3, 8.5_

- [x] 4.1 Optimize Dockerfile for better caching
  - Review current Dockerfile layer ordering
  - Ensure dependencies are copied before application code
  - Add cache mount hints for apt, npm, and pip
  - Verify BUILDKIT_INLINE_CACHE arg is present
  - Test cache effectiveness with incremental builds
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4.2 Add workflow status badge to README
  - Add GitHub Actions status badge to README.md
  - Link badge to workflow runs page
  - Add brief explanation of CI/CD pipeline
  - _Requirements: 5.1_

- [ ] 4.3 Create rollback procedure documentation
  - Document step-by-step rollback process
  - Add commands for viewing image history
  - Explain how to deploy specific versions
  - Include emergency rollback script
  - _Requirements: 5.3, 7.6_

- [ ] 4.4 Set up automated deployment monitoring
  - Create cron job for periodic health checks
  - Configure log rotation for deployment logs
  - Set up alerts for deployment failures 
  - _Requirements: 8.3, 8.5_

- [x] 4.5 Fix SpaCy model offline installation issue
  - Add `python -m spacy download en_core_web_sm` to Dockerfile
  - Pre-install SpaCy English model during Docker build
  - Prevent runtime download attempts that fail in restricted environments
  - Resolves SSL/network errors when Kokoro TTS initializes G2P pipeline
  - _Requirements: 3.1, 9.3, 9.4_

