# Requirements Document

## Introduction

This feature implements a GitHub Actions CI/CD pipeline to automate Docker image builds for the English Listening Trainer application. The primary goal is to eliminate the need for slow, manual Docker builds on the GPU server (Ubuntu 22.04 with Tesla P40) by building images in GitHub's infrastructure and publishing them to GitHub Container Registry (GHCR). The server will then simply pull pre-built images, dramatically reducing deployment time and network strain caused by pulling the large NVIDIA CUDA base image through a proxy.

## Requirements

### Requirement 1: Automated Docker Image Build Pipeline

**User Story:** As a DevOps engineer, I want GitHub Actions to automatically build Docker images when code is pushed to main, so that I don't have to manually build images on the slow GPU server.

#### Acceptance Criteria

1. WHEN code is pushed to the `main` branch THEN the GitHub Actions workflow SHALL trigger automatically
2. WHEN the workflow is triggered THEN it SHALL build the Docker image using the existing `Dockerfile` with the `runtime` target
3. WHEN building the image THEN it SHALL use `linux/amd64` platform to match the GPU server architecture
4. WHEN building the image THEN it SHALL use BuildKit with layer caching to optimize build times
5. WHEN the build completes successfully THEN it SHALL tag the image with both `latest` and the Git commit SHA
6. IF the build fails THEN the workflow SHALL fail and notify via GitHub's standard notification mechanisms

### Requirement 2: GitHub Container Registry Integration

**User Story:** As a DevOps engineer, I want built images automatically pushed to GHCR, so that the GPU server can pull them without rebuilding.

#### Acceptance Criteria

1. WHEN the Docker build succeeds THEN the workflow SHALL authenticate to GitHub Container Registry using `GITHUB_TOKEN`
2. WHEN authenticated THEN it SHALL push the image to `ghcr.io/arthurlee116/english-listening-trainer:latest`
3. WHEN pushing THEN it SHALL also push a tag with the Git commit SHA (e.g., `ghcr.io/arthurlee116/english-listening-trainer:<sha>`)
4. WHEN the push completes THEN the image SHALL be publicly accessible or accessible to authenticated users with repository access
5. IF authentication fails THEN the workflow SHALL fail with a clear error message
6. IF the push fails THEN the workflow SHALL retry once before failing

### Requirement 3: Build Cache Optimization

**User Story:** As a developer, I want the CI pipeline to use layer caching, so that builds complete quickly and don't re-download the 2GB+ CUDA base image every time.

#### Acceptance Criteria

1. WHEN the workflow runs THEN it SHALL use Docker BuildKit with inline cache enabled
2. WHEN building THEN it SHALL attempt to pull the previous `latest` image to use as cache
3. WHEN the CUDA base layer hasn't changed THEN it SHALL reuse the cached layer
4. WHEN Python dependencies haven't changed THEN it SHALL reuse the cached Python installation layer
5. WHEN Node dependencies haven't changed THEN it SHALL reuse the cached npm install layer
6. WHEN only application code changes THEN it SHALL only rebuild the final application layers

### Requirement 4: Manual Workflow Dispatch

**User Story:** As a DevOps engineer, I want to manually trigger the build workflow from GitHub's UI, so that I can rebuild images on-demand without pushing code.

#### Acceptance Criteria

1. WHEN I navigate to the Actions tab in GitHub THEN I SHALL see a "Run workflow" button for the build pipeline
2. WHEN I click "Run workflow" THEN I SHALL be able to select the branch to build from
3. WHEN I trigger a manual build THEN it SHALL execute the same build process as automatic triggers
4. WHEN the manual build completes THEN it SHALL push images with the same tagging strategy

### Requirement 5: Comprehensive Documentation

**User Story:** As an operations team member, I want clear documentation on how to deploy pre-built images, so that I can update the GPU server without confusion.

#### Acceptance Criteria

1. WHEN the feature is complete THEN there SHALL be updated documentation in `documents/TTS_ISSUE_ANALYSIS.md` explaining the CI pipeline
2. WHEN reading the documentation THEN it SHALL include step-by-step instructions for pulling and deploying images on the GPU server
3. WHEN reading the documentation THEN it SHALL include commands for logging into GHCR, pulling images, and running docker compose
4. WHEN reading the documentation THEN it SHALL include verification steps (health checks, TTS endpoint testing, log review)
5. WHEN reading the documentation THEN it SHALL explain how to configure required GitHub secrets
6. WHEN the feature is complete THEN `documents/DEPLOYMENT_GUIDE.md` and `documents/AUTO_DEPLOY_GUIDE.md` SHALL be updated with CI/CD workflow information

### Requirement 6: Environment and Secret Configuration

**User Story:** As a repository administrator, I want clear guidance on required secrets and permissions, so that I can configure the repository correctly for CI/CD.

#### Acceptance Criteria

1. WHEN setting up the workflow THEN the documentation SHALL list all required GitHub secrets
2. WHEN using `GITHUB_TOKEN` THEN the workflow SHALL have `packages: write` permission configured
3. WHEN the repository is private THEN the documentation SHALL explain how to configure GHCR access for the GPU server
4. WHEN secrets are missing THEN the workflow SHALL fail with clear error messages indicating which secrets are needed
5. IF a custom `GHCR_TOKEN` is used THEN the documentation SHALL explain how to create and configure it

### Requirement 7: Server Deployment Integration

**User Story:** As an operations team member, I want simple commands to deploy the latest CI-built image, so that deployments are fast and reliable.

#### Acceptance Criteria

1. WHEN a new image is available THEN I SHALL run `docker login ghcr.io` with my credentials
2. WHEN logged in THEN I SHALL run `docker pull ghcr.io/arthurlee116/english-listening-trainer:latest` to fetch the image
3. WHEN the image is pulled THEN I SHALL run `docker compose -f docker-compose.gpu.yml up -d` to deploy
4. WHEN the deployment completes THEN the application SHALL be accessible and TTS SHALL work correctly
5. WHEN verifying deployment THEN I SHALL be able to test `/api/health` and `/api/tts` endpoints
6. IF deployment fails THEN I SHALL be able to review logs using `docker compose logs -f app`

### Requirement 8: Workflow Quality and Validation

**User Story:** As a developer, I want the workflow to be syntactically correct and testable, so that it works reliably in production.

#### Acceptance Criteria

1. WHEN the workflow file is created THEN it SHALL pass GitHub Actions YAML syntax validation
2. WHEN the workflow is committed THEN it SHALL be testable using `act` or manual workflow dispatch
3. WHEN the workflow runs THEN it SHALL produce clear, readable logs for debugging
4. WHEN errors occur THEN the workflow SHALL fail fast with descriptive error messages
5. WHEN the workflow completes THEN it SHALL report build time and image size metrics

### Requirement 9: Compatibility with Existing Infrastructure

**User Story:** As a system administrator, I want the CI/CD pipeline to work with existing Docker Compose configurations, so that no breaking changes are introduced.

#### Acceptance Criteria

1. WHEN using the CI-built image THEN it SHALL work with the existing `docker-compose.gpu.yml` configuration
2. WHEN the image runs THEN it SHALL respect all environment variables from `.env.production`
3. WHEN the image runs THEN it SHALL correctly mount volumes for `data`, `public/audio`, `logs`, `backups`, and HuggingFace cache
4. WHEN the image runs THEN it SHALL support GPU access via Docker Compose's `deploy.resources.reservations.devices` configuration
5. WHEN the image runs THEN TTS SHALL work correctly with CUDA acceleration
6. WHEN the image runs THEN Prisma migrations SHALL execute successfully
7. WHEN the image runs THEN the health check SHALL pass within the configured start period
