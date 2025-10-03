#!/bin/bash

# validate-workflow.sh
# Validates GitHub Actions workflow configuration and prerequisites
# Usage: ./scripts/validate-workflow.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    ((CHECKS_FAILED++))
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Main validation
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   GitHub Actions Workflow Validation Script           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

# 1. Check workflow YAML syntax
print_header "1. Workflow YAML Validation"

WORKFLOW_FILE=".github/workflows/docker-build.yml"

if [ ! -f "$WORKFLOW_FILE" ]; then
    print_error "Workflow file not found: $WORKFLOW_FILE"
    print_info "Expected location: .github/workflows/docker-build.yml"
else
    print_success "Workflow file exists: $WORKFLOW_FILE"
    
    # Check if yq is available for YAML validation
    if command_exists yq; then
        if yq eval '.' "$WORKFLOW_FILE" > /dev/null 2>&1; then
            print_success "YAML syntax is valid"
        else
            print_error "YAML syntax is invalid"
            yq eval '.' "$WORKFLOW_FILE" 2>&1 | head -5
        fi
    else
        print_warning "yq not installed - skipping YAML syntax validation"
        print_info "Install with: brew install yq (macOS) or snap install yq (Linux)"
    fi
    
    # Check for required workflow keys
    if grep -q "name:" "$WORKFLOW_FILE"; then
        print_success "Workflow has 'name' field"
    else
        print_warning "Workflow missing 'name' field"
    fi
    
    if grep -q "on:" "$WORKFLOW_FILE"; then
        print_success "Workflow has 'on' triggers"
    else
        print_error "Workflow missing 'on' triggers"
    fi
    
    if grep -q "jobs:" "$WORKFLOW_FILE"; then
        print_success "Workflow has 'jobs' defined"
    else
        print_error "Workflow missing 'jobs' section"
    fi
    
    # Check for GHCR-specific configuration
    if grep -q "ghcr.io" "$WORKFLOW_FILE"; then
        print_success "Workflow configured for GHCR (ghcr.io)"
    else
        print_warning "Workflow may not be configured for GHCR"
    fi
    
    if grep -q "GITHUB_TOKEN" "$WORKFLOW_FILE" || grep -q "secrets.GITHUB_TOKEN" "$WORKFLOW_FILE"; then
        print_success "Workflow uses GITHUB_TOKEN for authentication"
    else
        print_warning "Workflow may not have GITHUB_TOKEN configured"
    fi
fi

# 2. Check required files exist
print_header "2. Required Files Validation"

REQUIRED_FILES=(
    "Dockerfile"
    "package.json"
    "docker-compose.yml"
    "docker-compose.gpu.yml"
    ".dockerignore"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "Found: $file"
    else
        if [ "$file" == ".dockerignore" ]; then
            print_warning "Missing: $file (recommended but not required)"
        else
            print_error "Missing: $file"
        fi
    fi
done

# Check Dockerfile syntax
if [ -f "Dockerfile" ]; then
    if grep -q "FROM" Dockerfile; then
        print_success "Dockerfile has FROM instruction"
    else
        print_error "Dockerfile missing FROM instruction"
    fi
    
    if grep -q "WORKDIR" Dockerfile; then
        print_success "Dockerfile has WORKDIR instruction"
    else
        print_warning "Dockerfile missing WORKDIR instruction"
    fi
fi

# 3. Check Docker and Docker Buildx
print_header "3. Docker Environment Validation"

if command_exists docker; then
    print_success "Docker is installed"
    DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | tr -d ',')
    print_info "Docker version: $DOCKER_VERSION"
    
    # Check if Docker daemon is running
    if docker info > /dev/null 2>&1; then
        print_success "Docker daemon is running"
    else
        print_error "Docker daemon is not running"
        print_info "Start Docker Desktop or run: sudo systemctl start docker"
    fi
else
    print_error "Docker is not installed"
    print_info "Install from: https://docs.docker.com/get-docker/"
fi

# Check Docker Buildx
if command_exists docker; then
    if docker buildx version > /dev/null 2>&1; then
        print_success "Docker Buildx is available"
        BUILDX_VERSION=$(docker buildx version | cut -d ' ' -f2)
        print_info "Buildx version: $BUILDX_VERSION"
    else
        print_warning "Docker Buildx not available"
        print_info "Buildx is required for multi-platform builds"
    fi
    
    # Check for buildx builder
    if docker buildx ls | grep -q "default"; then
        print_success "Docker Buildx builder exists"
    else
        print_warning "No Docker Buildx builder found"
        print_info "Create with: docker buildx create --use"
    fi
fi

# 4. Check GHCR connectivity
print_header "4. GHCR Connectivity Validation"

if command_exists curl; then
    if curl -s -o /dev/null -w "%{http_code}" https://ghcr.io | grep -q "200\|301\|302"; then
        print_success "GHCR (ghcr.io) is reachable"
    else
        print_error "Cannot reach GHCR (ghcr.io)"
        print_info "Check your internet connection and firewall settings"
    fi
else
    print_warning "curl not installed - skipping connectivity check"
fi

# Check if logged into GHCR
if command_exists docker; then
    if docker info 2>/dev/null | grep -q "ghcr.io"; then
        print_success "Logged into GHCR"
    else
        print_warning "Not logged into GHCR"
        print_info "Login with: docker login ghcr.io -u YOUR_USERNAME"
    fi
fi

# 5. Check Git configuration
print_header "5. Git Configuration Validation"

if command_exists git; then
    print_success "Git is installed"
    
    # Check if in a git repository
    if git rev-parse --git-dir > /dev/null 2>&1; then
        print_success "Current directory is a Git repository"
        
        # Check for remote
        if git remote -v | grep -q "github.com"; then
            print_success "GitHub remote configured"
            REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "N/A")
            print_info "Remote: $REMOTE_URL"
        else
            print_warning "No GitHub remote found"
            print_info "Add with: git remote add origin https://github.com/USER/REPO.git"
        fi
        
        # Check current branch
        CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "N/A")
        print_info "Current branch: $CURRENT_BRANCH"
        
        if [ "$CURRENT_BRANCH" == "main" ] || [ "$CURRENT_BRANCH" == "master" ]; then
            print_success "On main/master branch"
        else
            print_warning "Not on main/master branch"
            print_info "Workflow typically triggers on 'main' branch"
        fi
    else
        print_error "Not in a Git repository"
        print_info "Initialize with: git init"
    fi
else
    print_error "Git is not installed"
fi

# 6. Check environment variables
print_header "6. Environment Variables Validation"

ENV_FILES=(
    ".env.local"
    ".env.production"
)

for env_file in "${ENV_FILES[@]}"; do
    if [ -f "$env_file" ]; then
        print_success "Found: $env_file"
        
        # Check for critical variables
        if grep -q "DATABASE_URL" "$env_file"; then
            print_success "  - DATABASE_URL configured"
        else
            print_warning "  - DATABASE_URL not found"
        fi
        
        if grep -q "JWT_SECRET" "$env_file"; then
            print_success "  - JWT_SECRET configured"
        else
            print_warning "  - JWT_SECRET not found"
        fi
    else
        if [ "$env_file" == ".env.production" ]; then
            print_warning "Missing: $env_file (needed for production deployment)"
        else
            print_info "Missing: $env_file (optional)"
        fi
    fi
done

# 7. Summary
print_header "Validation Summary"

echo -e "${GREEN}Passed:${NC}  $CHECKS_PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}  $CHECKS_FAILED"

echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ All critical checks passed!                         ║${NC}"
    echo -e "${GREEN}║  Your workflow is ready to use.                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    
    if [ $WARNINGS -gt 0 ]; then
        echo -e "\n${YELLOW}Note: There are $WARNINGS warning(s) that should be reviewed.${NC}"
    fi
    
    echo -e "\n${BLUE}Next steps:${NC}"
    echo "1. Commit and push your workflow file:"
    echo "   git add .github/workflows/docker-build.yml"
    echo "   git commit -m 'ci: add GitHub Actions workflow'"
    echo "   git push origin main"
    echo ""
    echo "2. Check GitHub Actions tab in your repository"
    echo "3. Monitor the workflow run"
    echo "4. Once complete, check GitHub Packages for your image"
    
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ✗ Validation failed!                                  ║${NC}"
    echo -e "${RED}║  Please fix the errors above before proceeding.        ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════╝${NC}"
    
    exit 1
fi
