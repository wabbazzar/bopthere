# Ticket #XXX: Fix Local Development Environment Configuration for API Authentication

**INSTRUCTIONS FOR CLAUDE:**
- Save this ticket to `docs/tickets/backlog/020_bug_localhost_env_config_authentication.md`
- Ensure the backlog directory exists before writing
- Completed steps marked as [COMPLETE] in Headers
- Commit with standard messaging between each phase

**Status**: PENDING  
**Priority**: HIGH - Blocks local development workflow  
**Estimated Effort**: 5 points - Comprehensive configuration fixes  
**Created**: 2025-10-30  
**Type**: bug  
**Character Impact**: All (affects development environment)

## Overview

Local development server (`make serve` on localhost:8080) lacks proper environment configuration, preventing developers from authenticating and accessing protected Lambda endpoints. The issue stems from missing `.env` file setup, inconsistent API configuration between services, and lack of validation in the development workflow.

## User Stories

### Primary User Story
As a developer, I want to run `make serve` and have a fully functional local development environment with proper API authentication so that I can test all features including login, leaderboard submission, and photo uploads without configuration errors.

### Secondary User Stories
- As a new developer joining the project, I want clear setup instructions and example environment files so that I can get started quickly without troubleshooting configuration issues.
- As a developer, I want helpful error messages when environment variables are missing so that I understand what needs to be configured.
- As a developer, I want consistent API configuration across all services so that authentication works uniformly throughout the application.

## Technical Requirements

### Functional Requirements
1. Create `.env.example` file with all required environment variables documented
2. Update `make serve` command to validate environment variables before starting server
3. Add clear error messages when `VITE_API_GATEWAY_URL` is not configured
4. Ensure CORS headers on all Lambda handlers include `http://localhost:8080`
5. Provide automated script to generate `.env` from deployed AWS resources
6. Document the complete local development setup process

### Non-Functional Requirements
1. **Developer Experience**: Setup process should take < 2 minutes for developers with AWS access
2. **Error Clarity**: Error messages must include actionable instructions
3. **Configuration Consistency**: All API calls should use the same base URL configuration
4. **Documentation**: Setup instructions must be clear for developers without AWS expertise

## Root Cause Analysis

### Current Issues Identified

1. **Missing Environment Configuration:**
   - No `.env` file exists in the project
   - No `.env.example` file to guide developers
   - README references `.env.example` but file doesn't exist

2. **Inconsistent API Configuration:**
   - Auth/RSVP/Photos use `apiRequest()` requiring `VITE_API_GATEWAY_URL`
   - Leaderboard uses hardcoded fallback URL: `https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod`
   - This creates confusing behavior where some features work and others fail

3. **No Development Validation:**
   - `make serve` doesn't check for required environment variables
   - Application fails at runtime with cryptic errors instead of startup validation

4. **CORS Configuration Gaps:**
   - `auth-handler.py`: Uses `Access-Control-Allow-Origin: *` (works)
   - `leaderboard-handler.py`: Has `localhost:8080` in `ALLOWED_ORIGINS` (works)
   - `photos-list-handler.py`: Uses `Access-Control-Allow-Origin: *` (works)
   - Infrastructure variables define CORS origins but `localhost:8080` is missing

5. **Authentication Flow Confusion:**
   - Without `VITE_API_GATEWAY_URL`, login fails with "API Gateway URL not configured"
   - Leaderboard GET requests work (uses hardcoded URL, no auth required)
   - Leaderboard POST requests fail (requires auth, needs proper token verification)
   - Photo uploads fail (requires auth, no fallback URL)

## Implementation Plan

### Phase 1: Create Environment Configuration Files (2 points)

**Deliverables:**
- `.env.example` file with complete documentation
- Automated script to generate `.env` from AWS deployment
- Update `.gitignore` to ensure `.env` is never committed

**Files to Create:**

**`.env.example`:**
```bash
# Wedding App Environment Configuration
# Copy this file to .env and fill in the values

# AWS API Gateway URL (required for all API operations)
# Get this from: make get-api-url
# Or manually: aws apigateway get-rest-apis --profile personal --region us-east-1
VITE_API_GATEWAY_URL=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod

# Development server configuration
# Default port: 8080 (configured in vite.config.ts)
# VITE_DEV_PORT=8080

# Optional: Enable API debug logging
# VITE_API_DEBUG=true
```

**`scripts/setup-local-env.sh`:**
```bash
#!/bin/bash
# Automated script to generate .env file from AWS deployment

set -e

PROFILE="personal"
REGION="us-east-1"
API_NAME="heatherandwesley-api"

echo "🔍 Fetching API Gateway configuration from AWS..."

# Get API Gateway ID
API_ID=$(aws apigateway get-rest-apis \
  --profile $PROFILE \
  --region $REGION \
  --query "items[?name=='$API_NAME'].id" \
  --output text 2>/dev/null | awk '{print $NF}')

if [ -z "$API_ID" ]; then
  echo "❌ Error: API Gateway '$API_NAME' not found in $REGION"
  echo ""
  echo "Please deploy the backend infrastructure first:"
  echo "  make deploy-auth-all"
  exit 1
fi

# Check if stage exists
STAGE_EXISTS=$(aws apigateway get-stage \
  --rest-api-id $API_ID \
  --stage-name prod \
  --profile $PROFILE \
  --region $REGION 2>/dev/null && echo "true" || echo "false")

if [ "$STAGE_EXISTS" = "false" ]; then
  echo "❌ Error: Production stage not deployed for API Gateway"
  echo ""
  echo "Please deploy the API Gateway stage:"
  echo "  make deploy-auth-api"
  exit 1
fi

# Generate .env file
API_URL="https://$API_ID.execute-api.$REGION.amazonaws.com/prod"

cat > .env << EOF
# Wedding App Environment Configuration
# Auto-generated on $(date)

# AWS API Gateway URL
VITE_API_GATEWAY_URL=$API_URL

# Development server configuration
# Default port: 8080 (configured in vite.config.ts)
# VITE_DEV_PORT=8080

# Optional: Enable API debug logging
# VITE_API_DEBUG=true
EOF

echo "✅ Successfully created .env file"
echo ""
echo "Configuration:"
echo "  API Gateway URL: $API_URL"
echo "  Region: $REGION"
echo "  Stage: prod"
echo ""
echo "You can now run: make serve"
```

**Update Makefile:**
```makefile
# Add new target
setup-local-env: ## Setup local development environment
	@echo "Setting up local development environment..."
	@chmod +x scripts/setup-local-env.sh
	@./scripts/setup-local-env.sh

get-api-url: ## Get API Gateway URL for environment configuration
	@API_ID=$$(aws apigateway get-rest-apis --profile $(AWS_PROFILE) --region $(AWS_REGION) --query "items[?name=='$(API_NAME)'].id" --output text 2>/dev/null | awk '{print $$NF}') && \
	if [ -n "$$API_ID" ]; then \
		echo "https://$$API_ID.execute-api.$(AWS_REGION).amazonaws.com/prod"; \
	else \
		echo "API Gateway not deployed yet"; \
		exit 1; \
	fi

# Update serve target with validation
serve: ## Start local development server (requires .env)
	@if [ ! -f .env ]; then \
		echo "❌ Error: .env file not found"; \
		echo ""; \
		echo "Please set up your local environment first:"; \
		echo "  make setup-local-env"; \
		echo ""; \
		echo "Or manually create .env file (see .env.example)"; \
		exit 1; \
	fi
	@if ! grep -q "VITE_API_GATEWAY_URL=https://" .env 2>/dev/null; then \
		echo "❌ Error: VITE_API_GATEWAY_URL not configured in .env"; \
		echo ""; \
		echo "Please run: make setup-local-env"; \
		echo "Or manually set VITE_API_GATEWAY_URL in .env file"; \
		exit 1; \
	fi
	@echo "✅ Environment configured"
	@echo "🚀 Starting development server on http://localhost:8080..."
	@echo ""
	@npm run dev
```

**Files to Modify:**
- `Makefile` - Add new targets and update serve command
- `.gitignore` - Already has `.env` (line 34, 95), verify it's not tracked

**Testing Requirements:**
1. Verify `.env.example` includes all required variables with clear documentation
2. Test `scripts/setup-local-env.sh` with deployed AWS resources
3. Test `scripts/setup-local-env.sh` error handling when AWS not deployed
4. Verify `make serve` fails gracefully without `.env`
5. Verify `make serve` succeeds with properly configured `.env`
6. Test that `.env` file is never committed to git

**Implementation Steps:**
1. Create `.env.example` with comprehensive variable documentation
2. Create `scripts/setup-local-env.sh` with AWS integration
3. Update Makefile with new targets and serve validation
4. Make setup script executable: `chmod +x scripts/setup-local-env.sh`
5. Test setup script with deployed infrastructure
6. Test error cases (no AWS deployment, missing stage, etc.)
7. Verify `.env` is in `.gitignore`

**Build Verification:**
```bash
# Test environment setup
make setup-local-env

# Verify .env was created
cat .env | grep VITE_API_GATEWAY_URL

# Test serve with validation
make serve

# Test serve without .env (should fail gracefully)
rm .env
make serve
# Should show helpful error message
```

**Commit**: `fix(dev-env): add environment configuration files and validation`

### Phase 2: Fix API Configuration Consistency (2 points)

**Deliverables:**
- Remove hardcoded fallback URLs from leaderboard configuration
- Ensure all API calls use centralized configuration
- Add runtime validation for API URL configuration
- Improve error messages for missing configuration

**Files to Modify:**

**`src/types/leaderboard.ts`:**
```typescript
/**
 * Leaderboard API configuration
 */
export const LEADERBOARD_API = {
  // Remove hardcoded fallback - use environment variable only
  baseUrl: import.meta.env.VITE_API_GATEWAY_URL || '',
  endpoints: {
    getLeaderboard: (game: string) => `/leaderboard/${game}`,
    submitScore: (game: string) => `/leaderboard/${game}`,
  },
};
```

**`src/utils/leaderboardApi.ts`:**
```typescript
/**
 * API utility functions for leaderboard operations
 */

import {
  LeaderboardResponse,
  ScoreSubmission,
  ScoreSubmissionResponse,
  LEADERBOARD_API,
} from '@/types/leaderboard';
import { AuthService } from '@/lib/auth';
import { APIError } from '@/integrations/aws/api-client';

/**
 * Fetch leaderboard data for a specific game
 */
export async function fetchLeaderboard(game: string): Promise<LeaderboardResponse> {
  // Validate API configuration
  if (!LEADERBOARD_API.baseUrl) {
    throw new APIError(
      'API not configured. Please set VITE_API_GATEWAY_URL environment variable.',
      500
    );
  }

  try {
    const response = await fetch(
      `${LEADERBOARD_API.baseUrl}${LEADERBOARD_API.endpoints.getLeaderboard(game)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new APIError(
        `Failed to fetch leaderboard: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data as LeaderboardResponse;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError('Failed to fetch leaderboard. Please check your connection.');
  }
}

/**
 * Submit a score to the leaderboard
 */
export async function submitScore(
  game: string,
  submission: ScoreSubmission
): Promise<ScoreSubmissionResponse> {
  // Validate API configuration
  if (!LEADERBOARD_API.baseUrl) {
    throw new APIError(
      'API not configured. Please set VITE_API_GATEWAY_URL environment variable.',
      500
    );
  }

  const token = AuthService.getToken();

  if (!token) {
    throw new APIError('Authentication required to submit scores', 401);
  }

  const url = `${LEADERBOARD_API.baseUrl}${LEADERBOARD_API.endpoints.submitScore(game)}`;
  console.log('leaderboardApi: Submitting score to:', url);
  console.log('leaderboardApi: Submission data:', submission);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(submission),
    });

    console.log('leaderboardApi: Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('leaderboardApi: Error response:', errorText);

      if (response.status === 401) {
        throw new APIError('Authentication failed. Please log in again.', 401);
      }
      throw new APIError(
        `Failed to submit score: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    console.log('leaderboardApi: Success response:', data);
    return data as ScoreSubmissionResponse;
  } catch (error) {
    console.error('leaderboardApi: Error submitting score:', error);
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError('Failed to submit score. Please try again.');
  }
}

/**
 * Format score for display (add thousands separators)
 */
export function formatScore(score: number): string {
  return score.toLocaleString();
}
```

**`src/integrations/aws/api-client.ts`:**
```typescript
const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || '';

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!API_GATEWAY_URL) {
    throw new APIError(
      'API Gateway URL not configured. ' +
      'Please ensure VITE_API_GATEWAY_URL is set in your .env file. ' +
      'Run "make setup-local-env" to configure automatically.',
      500
    );
  }

  const url = `${API_GATEWAY_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new APIError(
        data.error || `Request failed with status ${response.status}`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new APIError('Network error - please check your connection');
    }

    throw new APIError('An unexpected error occurred');
  }
}
```

**Testing Requirements:**
1. Test that leaderboard GET fails gracefully without `VITE_API_GATEWAY_URL`
2. Test that leaderboard POST (score submission) works with valid auth token
3. Test that all error messages mention how to configure environment
4. Verify auth endpoints show improved error messages
5. Test photo upload shows improved error messages

**Implementation Steps:**
1. Remove hardcoded fallback URL from `LEADERBOARD_API`
2. Add validation to `fetchLeaderboard()` function
3. Update error messages in `apiRequest()` to include setup instructions
4. Update error messages in leaderboard API to use `APIError` class
5. Test all API endpoints with missing environment variable
6. Test all API endpoints with valid environment variable

**Build Verification:**
```bash
# Test without environment variable
unset VITE_API_GATEWAY_URL
npm run dev
# Try to use any feature - should show helpful error

# Test with environment variable
export VITE_API_GATEWAY_URL=https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod
npm run dev
# All features should work
```

**Commit**: `fix(api): remove hardcoded URLs and improve error messages`

### Phase 3: Update Documentation and Infrastructure (1 point)

**Deliverables:**
- Update README with corrected setup instructions
- Add troubleshooting guide for common environment issues
- Update infrastructure CORS configuration to include localhost:8080
- Add help text to Makefile targets

**Files to Modify:**

**`README.md`:**
```markdown
# Wedding Website

A beautiful React-based wedding website built with modern web technologies, featuring a character-based experience and AWS serverless backend for RSVP management.

## Quick Start for Developers

### Prerequisites

1. Node.js 18+ and npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
2. AWS CLI configured with `--profile personal` (only if deploying infrastructure)

### Local Development Setup

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Option 1: Automatic environment setup (requires AWS access)
make setup-local-env

# Option 2: Manual environment setup
cp .env.example .env
# Edit .env and set VITE_API_GATEWAY_URL

# Start development server
make serve
```

The development server will run on http://localhost:8080

### Troubleshooting

**"API Gateway URL not configured" error:**
```bash
# Ensure .env file exists
ls -la .env

# Verify VITE_API_GATEWAY_URL is set
cat .env | grep VITE_API_GATEWAY_URL

# Regenerate .env from AWS
make setup-local-env
```

**"API Gateway not found" when running setup:**
```bash
# Deploy backend infrastructure first
make deploy-auth-all

# Then setup environment
make setup-local-env
```

**Login works but other features fail:**
- Ensure you're using the same API Gateway URL for all requests
- Check browser console for CORS errors
- Verify your token is valid: localStorage should contain 'wedding-auth-token'

## AWS Setup (For Infrastructure Deployment)

### Prerequisites

1. AWS CLI installed and configured with `--profile personal`
2. Appropriate AWS permissions for DynamoDB, Lambda, and API Gateway in us-east-1 region

### Infrastructure Deployment

```sh
# Deploy complete authentication system
make deploy-auth-all

# Deploy leaderboard system
make deploy-leaderboard-lambda
make deploy-leaderboard-api

# Verify deployment
make test-all

# Get API Gateway URL for .env
make get-api-url
```

### Available Make Commands

View all available commands:
```sh
make help
```

Key development commands:
- `make setup-local-env` - Automatically configure .env from AWS deployment
- `make serve` - Start local development server (requires .env)
- `make get-api-url` - Display API Gateway URL for manual .env setup
- `make test-auth` - Test authentication endpoints
- `make test-all` - Run comprehensive API tests

## Project Structure

- `/src` - React frontend application
  - `/components` - Reusable UI components
  - `/contexts` - React context providers (Auth, Character)
  - `/hooks` - Custom React hooks
  - `/integrations/aws` - AWS API client
  - `/lib` - Utility libraries (auth, utils)
  - `/pages` - Top-level page components
  - `/types` - TypeScript type definitions
- `/aws/lambda` - AWS Lambda function handlers
- `/scripts` - Deployment and utility scripts
- `/infrastructure` - Infrastructure as code (Terraform/OpenTofu)
- `/docs` - Project documentation and tickets

## Character System

The app features three character perspectives:
- **Wesley**: Adventure/quest theme with purple/gold colors
- **Heather**: Romantic/elegant theme with pink/rose colors
- **Puffy**: Playful/fun theme with blue/teal colors

Each character has unique content variations, backgrounds, and styling.

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: AWS Lambda (Python 3.11), API Gateway, DynamoDB
- **Authentication**: JWT with 30-day expiration
- **Deployment**: GitHub Actions → GitHub Pages (frontend), AWS CLI (backend)

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Test locally with `make serve`
4. Run tests with `make test-all`
5. Commit with conventional commit messages
6. Create a pull request

## License

Private project for Wesley & Heather's wedding.
```

**`docs/DEVELOPMENT_SETUP.md`:** (New file)
```markdown
# Local Development Setup Guide

## Overview

This guide covers setting up your local development environment for the Wedding App project.

## Prerequisites

- Node.js 18+ ([install with nvm](https://github.com/nvm-sh/nvm))
- npm (comes with Node.js)
- AWS CLI (optional, for automatic environment setup)
- Git

## Step-by-Step Setup

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd heatherandwesley
npm install
```

### 2. Configure Environment Variables

You have two options:

#### Option A: Automatic Setup (Requires AWS Access)

```bash
make setup-local-env
```

This will:
1. Connect to AWS using your configured profile
2. Fetch the API Gateway URL from your deployment
3. Create a `.env` file with the correct configuration

#### Option B: Manual Setup

```bash
# Copy example file
cp .env.example .env

# Edit .env and set VITE_API_GATEWAY_URL
nano .env
```

Your `.env` should look like:
```
VITE_API_GATEWAY_URL=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod
```

To get your API ID:
```bash
make get-api-url
```

### 3. Start Development Server

```bash
make serve
```

The server will start on http://localhost:8080

## Verifying Your Setup

### Check Environment Configuration

```bash
# View your .env file
cat .env

# Should output:
# VITE_API_GATEWAY_URL=https://...
```

### Test Authentication

1. Navigate to http://localhost:8080
2. Click login button
3. Use test credentials:
   - Username: `testguest`
   - Password: `wedding2025`
4. You should successfully log in

### Test Protected Endpoints

After logging in, try:
- Viewing the leaderboard (Games tab)
- Submitting a score (requires login)
- Uploading a bingo photo (Festival tab → Bingo)

## Common Issues

### Issue: "API Gateway URL not configured"

**Symptom:** Login fails immediately with error toast

**Solution:**
```bash
# Check if .env exists
ls -la .env

# If not, create it
make setup-local-env

# Restart dev server
make serve
```

### Issue: "API Gateway not found" during setup

**Symptom:** `make setup-local-env` fails with AWS error

**Solution:**
```bash
# Deploy backend infrastructure first
make deploy-auth-all

# Then setup environment
make setup-local-env
```

### Issue: Login works but other features fail

**Symptom:** Can login but can't submit scores or upload photos

**Possible Causes:**

1. **Token not being sent**: Check browser console for authentication errors
2. **CORS issues**: Check for CORS errors in browser console
3. **Wrong API URL**: Verify `.env` has correct URL matching your AWS deployment

**Debug Steps:**
```bash
# Check what's stored in localStorage
# Open browser console and run:
localStorage.getItem('wedding-auth-token')
# Should show a JWT token

# Check API URL in use
# Open browser console and run:
console.log(import.meta.env.VITE_API_GATEWAY_URL)
# Should show your API Gateway URL
```

### Issue: "CORS policy" errors in browser console

**Symptom:** Browser blocks requests with CORS error

**Solution:**

1. Verify your API Gateway has CORS enabled:
```bash
make test-auth-cors
```

2. Check that localhost:8080 is in allowed origins:
```bash
# Should see "localhost:8080" in ALLOWED_ORIGINS
aws lambda get-function-configuration \
  --function-name heatherandwesley-leaderboard-handler \
  --profile personal \
  --query 'Environment.Variables.ALLOWED_ORIGINS'
```

3. If needed, redeploy Lambda with updated CORS:
```bash
make deploy-leaderboard-lambda
```

### Issue: Changes not reflecting after edit

**Symptom:** Code changes don't appear in browser

**Solution:**

1. Hard refresh browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Restart dev server:
```bash
# Stop server: Ctrl+C
make serve
```

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_GATEWAY_URL` | Yes | API Gateway base URL | `https://abc123.execute-api.us-east-1.amazonaws.com/prod` |
| `VITE_DEV_PORT` | No | Development server port (default: 8080) | `8080` |
| `VITE_API_DEBUG` | No | Enable API request logging | `true` |

## Development Workflow

### Making Changes

1. Create a feature branch:
```bash
git checkout -b feature/my-feature
```

2. Make your changes
3. Test locally: `make serve`
4. Commit changes:
```bash
git add .
git commit -m "feat(scope): description"
```

### Testing

```bash
# Run all tests
make test-all

# Test specific features
make test-auth          # Test auth endpoints
make test-leaderboard  # Test leaderboard
make test-photos-list  # Test photo gallery
```

### Code Quality

```bash
# Format code
make format

# Check formatting
make format-check

# Run linters
make lint-frontend
make lint-python
```

## Additional Resources

- [Project README](../README.md) - General project information
- [AWS Setup Guide](./aws-setup.md) - Deploying infrastructure
- [Makefile Commands](./makefile-commands.md) - All available make commands
- [Ticket System](./tickets/) - Development tickets and features

## Getting Help

- Check existing [documentation](./README.md)
- Review [tickets](./tickets/) for similar issues
- Check browser console for error messages
- Verify AWS deployment status: `make test-all`
```

**`infrastructure/variables.tf`:** (Update default allowed_origins)
```terraform
variable "allowed_origins" {
  description = "Allowed CORS origins for API Gateway"
  type        = list(string)
  default     = [
    "https://heatherandwesley.com",
    "http://localhost:5173",
    "http://localhost:8080",  # Add this line
    "http://localhost:5174"
  ]
}
```

**`Makefile`:** (Add help text to new commands)
```makefile
# Update help command
help:
	@echo "Wedding App AWS Infrastructure Management"
	@echo ""
	@echo "Local Development:"
	@echo "  make setup-local-env    Setup .env file from AWS deployment"
	@echo "  make get-api-url        Display API Gateway URL for manual setup"
	@echo "  make serve              Start local dev server (requires .env)"
	@echo ""
	# ... rest of existing help text
```

**Testing Requirements:**
1. Verify README setup instructions are accurate and complete
2. Follow README setup steps on clean checkout to validate
3. Test that DEVELOPMENT_SETUP.md covers all common issues
4. Verify infrastructure update includes localhost:8080 in CORS
5. Test help text displays correctly

**Implementation Steps:**
1. Update README.md with corrected Quick Start section
2. Create DEVELOPMENT_SETUP.md with comprehensive troubleshooting
3. Update infrastructure/variables.tf to include localhost:8080
4. Update Makefile help text for new commands
5. Test setup process from README on clean environment
6. Test troubleshooting guide scenarios

**Build Verification:**
```bash
# Test that documentation is accurate
rm .env
# Follow README setup steps exactly
# Should result in working environment

# Test Makefile help
make help
# Should show all new commands with descriptions
```

**Commit**: `docs(setup): add comprehensive local development documentation`

## Success Criteria

### Functional Acceptance Criteria
- [ ] New developers can set up local environment in < 2 minutes with AWS access
- [ ] `make setup-local-env` successfully creates `.env` from AWS deployment
- [ ] `make serve` fails gracefully with helpful message when `.env` missing
- [ ] `make serve` starts successfully when `.env` properly configured
- [ ] All API calls (auth, leaderboard, photos) use same base URL configuration
- [ ] Login works on localhost:8080 with proper authentication
- [ ] Protected endpoints (score submission, photo upload) work after login
- [ ] Error messages clearly indicate how to fix configuration issues

### Performance Criteria
- [ ] Environment setup script completes in < 10 seconds
- [ ] Serve validation adds < 1 second to startup time
- [ ] No performance degradation from environment validation

### Quality Criteria
- [ ] All existing functionality continues to work with new configuration
- [ ] No hardcoded API URLs remain in codebase
- [ ] `.env` file is never committed to git
- [ ] Error messages are actionable and include specific commands
- [ ] Documentation is accurate and covers common issues
- [ ] CORS configuration supports all development environments

## Dependencies

### Technical Dependencies
- AWS CLI configured with `--profile personal`
- Deployed AWS infrastructure (API Gateway, Lambda, DynamoDB)
- Node.js 18+ and npm
- bash shell for setup script

### Development Dependencies
- Vite (existing)
- React development tools (existing)
- AWS SDK for scripts (existing)

### AWS Resources Required
- API Gateway deployed and accessible
- Lambda functions deployed
- DynamoDB tables created
- Proper IAM permissions for CLI access

## Risks & Mitigations

### Risk: Developers without AWS access can't set up environment
**Impact**: MEDIUM  
**Mitigation**: Provide manual setup option with .env.example. Document how to get API URL from team member who has AWS access.

### Risk: API Gateway URL changes after deployment updates
**Impact**: MEDIUM  
**Mitigation**: Setup script can be re-run anytime. Add note in README about re-running after infrastructure updates.

### Risk: Environment validation breaks existing workflows
**Impact**: LOW  
**Mitigation**: Only validate when running `make serve`. Direct `npm run dev` bypasses validation if needed.

### Risk: Hardcoded fallback removal breaks production
**Impact**: HIGH  
**Mitigation**: Verify VITE_API_GATEWAY_URL is set in GitHub Actions secrets before merging. Add build-time validation.

## Deployment Guide

This ticket does not require backend infrastructure changes beyond CORS configuration update.

### Frontend Deployment

**Environment Variables:**
```bash
# Verify GitHub Actions secrets are set
# Repository → Settings → Secrets and variables → Actions
# Verify: VITE_API_GATEWAY_URL exists and is correct
```

**Deployment Steps:**
```bash
# Test build locally first
npm run build

# If successful, merge to main
git checkout main
git merge feature/local-dev-config

# GitHub Actions will automatically:
# 1. Build with VITE_API_GATEWAY_URL from secrets
# 2. Deploy to GitHub Pages
```

**Deployment Verification:**
```bash
# Test production site
curl https://heatherandwesley.com

# Verify login works
# Verify leaderboard loads
# Verify photo upload works (after login)
```

**Rollback Plan:**
```bash
# If deployment fails, revert commit
git revert <commit-hash>
git push origin main
```

### Infrastructure Changes (CORS Update)

**If using OpenTofu/Terraform:**
```bash
# Update infrastructure/variables.tf with localhost:8080
cd infrastructure
tofu plan
tofu apply

# Verify API Gateway CORS settings
make test-auth-cors
```

**If using AWS CLI:**
```bash
# Lambda functions already include localhost:8080 in ALLOWED_ORIGINS
# Verify with:
aws lambda get-function-configuration \
  --function-name heatherandwesley-leaderboard-handler \
  --profile personal \
  --query 'Environment.Variables.ALLOWED_ORIGINS'
```

## Production Readiness Checklist

- [ ] `.env.example` file created with complete documentation
- [ ] `scripts/setup-local-env.sh` created and executable
- [ ] Makefile updated with new targets and validation
- [ ] Hardcoded API URLs removed from codebase
- [ ] API error messages improved with actionable instructions
- [ ] README.md updated with corrected setup instructions
- [ ] DEVELOPMENT_SETUP.md created with troubleshooting guide
- [ ] CORS configuration includes localhost:8080
- [ ] GitHub Actions secrets include VITE_API_GATEWAY_URL
- [ ] `.gitignore` contains `.env` entry (already present)
- [ ] All tests pass: `make test-all`
- [ ] Manual testing completed:
  - [ ] Fresh checkout setup process
  - [ ] Login on localhost:8080
  - [ ] Score submission with authentication
  - [ ] Photo upload with authentication
  - [ ] Error messages display correctly
- [ ] Documentation reviewed and accurate
- [ ] No breaking changes to existing development workflows

## Related Tickets

- Ticket #003: Feature - Login System (dependency - authentication must work)
- Ticket #016: Feature - Games Tab Integrated Leaderboard (affects leaderboard API)
- Ticket #017: Feature - Wedding Bingo Game (affects photo upload)
- Ticket #014: Bug - CORS Auth Endpoint Blocking (related CORS configuration)

## Notes for Implementation

### Critical Implementation Details

1. **Environment Variable Handling:**
   - Vite requires `VITE_` prefix for environment variables exposed to browser
   - Variables must be set before `vite` command starts
   - No runtime environment variable access in browser (all baked into build)

2. **Setup Script Considerations:**
   - Script must check for AWS CLI presence
   - Must verify AWS profile is configured
   - Should validate API Gateway is deployed
   - Handle network errors gracefully

3. **CORS Configuration:**
   - All Lambda handlers must include localhost:8080 in allowed origins
   - Origin checking is case-sensitive
   - Must include in both Lambda handler code and API Gateway configuration

4. **Error Message Standards:**
   - Always include the command to fix the issue
   - Use consistent formatting: "Error: [description]. Solution: [command]"
   - Link to documentation where appropriate

5. **Backward Compatibility:**
   - Don't break existing `npm run dev` workflow
   - Support both automatic and manual environment setup
   - Preserve existing Makefile targets

### Testing Strategy

**Unit Testing:**
- Not applicable (configuration changes only)

**Integration Testing:**
```bash
# Test complete development setup flow
rm -rf node_modules .env
npm install
make setup-local-env
make serve

# Test in browser:
# 1. Login
# 2. Submit score
# 3. Upload photo
```

**E2E Testing:**
```bash
# Run existing smoke tests with local environment
export VITE_API_GATEWAY_URL=$(make get-api-url)
make test-all
```

### Migration Path

For existing developers with working environments:

1. **No action required** if they already have `VITE_API_GATEWAY_URL` set
2. If experiencing issues, run: `make setup-local-env`
3. Review updated README for new commands

### Future Improvements

Potential enhancements for future tickets:

1. Support for multiple environments (dev/staging/prod)
2. Hot reload of environment variables
3. Docker-based development environment
4. Automated API mocking for development without AWS
5. Visual environment configuration tool
6. Pre-flight checks for all required AWS resources

---

**Remember**: This ticket focuses on developer experience. The goal is to make local development setup trivial and error messages helpful. Prioritize clear documentation and graceful error handling over complex automation.

