# Wedding Website

A beautiful React-based wedding website built with modern web technologies, featuring a character-based experience and AWS serverless backend for RSVP management.

## Getting Started

**Development Setup**

To work locally using your IDE, clone this repo and follow these steps:

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Configure AWS environment variables (see AWS Setup below)
cp .env.example .env
# Edit .env with your API Gateway URL

# Step 5: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## AWS Setup

### Prerequisites

1. AWS CLI installed and configured with `--profile personal`
2. OpenTofu (or Terraform) installed for infrastructure management
3. Appropriate AWS permissions for DynamoDB, Lambda, and API Gateway

### Infrastructure Deployment

```sh
# Initialize OpenTofu
make tofu-init

# Deploy all AWS infrastructure (DynamoDB, Lambda, API Gateway)
make deploy-all

# Get the API Gateway URL
cd infrastructure && tofu output api_gateway_url
```

### Environment Configuration

1. Copy `.env.example` to `.env`
2. Update `VITE_API_GATEWAY_URL` with the URL from the OpenTofu output

### Managing Infrastructure

```sh
# View all available commands
make help

# Test the complete integration
make test-all

# Update Lambda function code
make update-lambda

# View DynamoDB table details
make describe-table

# Destroy all infrastructure (use with caution)
make cleanup-all
```

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- AWS DynamoDB (for RSVP storage)
- AWS Lambda (for serverless RSVP processing)
- AWS API Gateway (for REST API)
- OpenTofu (for infrastructure as code)

## How can I deploy this project?

Run `npm run build` to create a production build, then deploy the `dist` folder to your hosting provider.

## Custom Domain

You can connect your own custom domain by deploying the built files to your hosting provider and configuring your domain's DNS settings to point to your hosting service.

## Testing Infrastructure

The project includes comprehensive testing infrastructure with multiple test types and quality assurance measures:

### Test Types

**Unit Tests**
```bash
# Python unit tests
make test-unit-python

# Frontend Jest unit tests  
make test-unit-frontend
```

**Integration Tests**
```bash
# Python integration tests (API + Database)
make test-integration-python

# Frontend integration tests
npm test
```

**End-to-End Tests**
```bash
# Playwright browser automation tests
make test-e2e-playwright

# API smoke tests (critical path verification)
make test-e2e-smoke

# Integration smoke tests (no AWS required)
make test-e2e-smoke-integration
```

**Comprehensive Test Suites**
```bash
# Run all Python tests (unit + integration + smoke)
make test-python

# Run all frontend tests (unit + e2e)
make test-frontend

# Run complete test suite
make test-all-new
```

### Git Hooks for Quality Assurance

The project includes automated Git hooks to ensure code quality:

**Setup Git Hooks**
```bash
# Install pre-commit and pre-push hooks
make hooks-setup

# Check hook status
make hooks-status

# Test hook functionality
make hooks-test
```

**Hook Behavior:**
- **Pre-commit**: Fast checks (linting, unit tests, AWS region consistency)
- **Pre-push**: Comprehensive testing (integration tests, smoke tests, migration verification)

**Hook Management**
```bash
# Enable/disable hooks
make hooks-enable
make hooks-disable

# Bypass hooks if needed (use sparingly)
git commit --no-verify
git push --no-verify
```

### Health Monitoring

**Health Check Endpoint**
```bash
# Test health status of all services
make test-health

# Deploy health check Lambda (if needed)
make deploy-health-lambda
```

The health endpoint monitors:
- DynamoDB table status
- Lambda function availability
- Service region consistency
- Overall system health

### Migration Verification

**Verify AWS Migration**
```bash
# Verify all resources are in us-east-1
make verify-migration

# Complete comprehensive migration verification
make verify-migration-complete

# Clean up any remaining us-west-2 resources
make cleanup-west-2-final
```

### Test Organization

Tests are organized in the `tests/` directory:
```
tests/
├── unit/
│   ├── frontend/     # Jest tests for React components
│   └── backend/      # Python tests for Lambda/API logic
├── integration/
│   ├── frontend/     # React + API integration tests
│   └── backend/      # Lambda + DynamoDB integration tests
├── e2e/
│   ├── playwright/   # Browser automation tests
│   └── smoke/        # API smoke tests for critical paths
```

### Debugging and Development

**Playwright Testing for Complex UI Issues**
```bash
# Install Playwright (if not already installed)
npm install -D @playwright/test
npx playwright install chromium

# Run with debug mode
npm run dev  # Start dev server
# Add ?nav-debug to any URL for debug mode
```

For navigation debugging, use the navigation debugger:
```javascript
// In browser console
navDebugger.showBlockers()  // Shows elements blocking clicks
navDebugger.exportLogs()    // Exports debug information
```

**Specialized Testing Agents**

Use Claude agents for comprehensive testing:
```bash
# Generate comprehensive test suites
claude --agent test-writer "Write tests for [component/function]"

# Review and improve existing tests  
claude --agent test-critic "Review tests for [component/function]"
```

### API Schema Management

The project includes automated API schema documentation and field integrity validation:

**Update Schemas**
```bash
# Update all API schemas and documentation
make update-schemas
```

This command will:
- Extract DynamoDB table schemas
- Document API Gateway routes
- Capture Lambda request/response patterns
- Generate human-readable documentation

**Test Field Consistency**
```bash
# Validate field consistency across all layers
make test-api-consistency
```

**Schema Files**
Generated schemas are stored in `.wedding/context/`:
- `dynamodb-schemas.json` - DynamoDB table field definitions
- `api-endpoints.md` - Human-readable API documentation
- `api-gateway-routes.json` - Route configurations
- `lambda-patterns.json` - Request/response patterns
- `field-mappings.md` - Field reference documentation
- `agent-schema-rules.md` - Validation rules for AI agents

**Automated Updates**
GitHub Actions automatically updates schemas every 4 hours or when backend code changes. Check `.github/workflows/update-schemas.yml` for details.
