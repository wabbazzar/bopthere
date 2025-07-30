# Project Interaction Guidelines

When working on this project, please follow these guidelines to ensure a methodical and clear development process:

1. **Incremental Approach**: Work on one small, testable component at a time rather than multiple components simultaneously. Complete each step fully before moving to the next.

2. **Check Before Proceeding**: After each step, ask me about the current state of the project and wait for confirmation before proceeding to the next step. This includes checking:
   - If files were created/updated successfully
   - If any tests were run and what the results were
   - If I need any clarification about what was just done

3. **Clear Explanations**: Provide a brief explanation of what each component does and how it fits into the overall architecture before implementing it.

4. **File Management**:
   - Ask before creating multiple files at once
   - Confirm the intended location and name of each file
   - Check if similar files already exist that could be modified instead

5. **Project Context**: Always ask about the current state of the project before suggesting major changes or new implementations.

6. **Test-Driven Development**: Suggest tests before implementation when appropriate, and always confirm tests are passing before moving on.

6a. **Endpoint Verification**: After deploying backend changes, always run `make test-all-endpoints` to verify no internal server errors (500 status codes) were introduced. This command tests:
   - Health check endpoint
   - User registration
   - User authentication (expects 400/401, not 500)
   - Tools endpoint (expects 401 without auth, not 500)  
   - Search tools endpoint (expects 401 without auth, not 500)

6b. **API Testing Procedures**: When testing rental and other authenticated endpoints, follow this procedure:

**Authentication Setup:**
```bash
# Get JWT token for test user
TOKEN=$(curl -s -X POST https://6fdig3pu4i.execute-api.us-east-1.amazonaws.com/dev/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "paula@hotmail.com", "password": "123shedly"}' | jq -r '.data.token')
```

**Test User Credentials:**
- Fred Firestation: `fred@hotmail.com` / `123shedly` (has Firefighter Axe)
- Paula Pool: `paula@hotmail.com` / `123shedly` (has Pool Skimmer Net)
- Puffy Lou: `puffy@hotmail.com` / `123shedly` (waitlist testing)

**Key Findings:**
- JWT tokens expire quickly (1 hour) - always get fresh tokens for testing
- Some endpoints require fresh tokens even within the expiry window
- Rental endpoints work: `/api/rentals/rent`, `/api/rentals/{id}/confirm-pickup`
- Authentication is inconsistent across endpoints - needs investigation

**Rental Flow Testing:**
```bash
# 1. Authenticate as borrower
PAULA_TOKEN=$(curl -s -X POST .../users/login -d '{"email":"paula@hotmail.com","password":"123shedly"}' | jq -r '.data.token')

# 2. Rent a tool (Paula rents Fred's axe - ID: 95a1ac3a-edeb-41ea-844e-cf2b61aa5614)
curl -X POST .../api/rentals/rent -H "Authorization: Bearer $PAULA_TOKEN" -d '{"tool_id":"95a1ac3a-edeb-41ea-844e-cf2b61aa5614","rental_period_days":3}'

# 3. Confirm pickup (both parties need to confirm)
curl -X POST .../api/rentals/{rental_id}/confirm-pickup -H "Authorization: Bearer $PAULA_TOKEN" -d '{}'
```

**Known Issues:**
- Some rental endpoints show auth errors even with valid tokens
- Owner confirmation may have user ID mismatch issues
- Tools/search endpoints may need different auth header format

6c. **CRITICAL: DynamoDB Table Schema Management**

⚠️ **NEVER modify DynamoDB table schemas without extreme caution**

**The Problem:**
- DynamoDB Global Secondary Index (GSI) schemas MUST match exactly between environments
- Lambda functions are written to expect specific index key structures
- Changing index schemas breaks existing Lambda code and causes 500 errors
- Even small changes like adding/removing RANGE keys breaks queries

**What Happened:**
- Agent modified dev `UserConversationsIndex` to use `participant_1_id` (HASH) + `last_message_at` (RANGE)
- Prod had `participant_1_id` (HASH only)
- Lambda code `Key('participant_1_id').eq(user_id)` works with HASH-only but fails with HASH+RANGE
- Result: Dev messages API returned 0 conversations while prod worked fine

**Prevention Rules:**
1. **Always check prod schema first**: `aws dynamodb describe-table --table-name [table-name]-prod`
2. **Match schemas exactly**: Dev/staging must mirror prod table structure perfectly
3. **Never guess schema**: If unsure, scan actual data to see what fields exist
4. **Test immediately**: After any table changes, test the actual API endpoints
5. **Document changes**: Always update CloudFormation templates to prevent drift

**Safe Approach:**
- Use `aws dynamodb describe-table` to check existing schemas
- Scan actual data with `aws dynamodb scan --limit 1` to see field structure  
- Modify CloudFormation template first, then deploy
- Always test both GET and POST operations after changes

7. **Important Reminder**: When designing SwiftUI interfaces, please maintain these UI consistency standards:

7a. TEXT FIELD STYLING:
   - Always use custom ZStack-based text fields as in RegisterView:
     ```swift
     ZStack(alignment: .leading) {
         if viewModel.fieldText.isEmpty {
             Text("Placeholder text")
                 .foregroundColor(warmCharcoal.opacity(0.6))
                 .padding()
         }
         
         TextField("", text: $viewModel.fieldText)
             .padding()
             .foregroundColor(warmCharcoal)
     }
     .background(Color.white)
     .cornerRadius(10)
     .overlay(
         RoundedRectangle(cornerRadius: 10)
             .stroke(viewModel.fieldError != nil ? Color.red : Color.gray.opacity(0.3), lineWidth: 1)
     )
     ```

7b. TEXT EDITOR STYLING:
   - For multi-line text editors, ensure similar styling with proper placeholder and error handling:
```
swift
   // Full card container structure
   VStack(alignment: .leading, spacing: 10) {
       Text("Section Title")
           .font(.system(size: 20, weight: .medium))
           .foregroundColor(warmCharcoal)
       
       // Text editor with proper styling
       VStack(alignment: .leading, spacing: 4) {
           Text("Field Label")
               .font(.system(size: 14, weight: .medium))
               .foregroundColor(warmCharcoal)
           
           ZStack(alignment: .topLeading) {
               Rectangle()
                   .fill(Color.white)
                   .cornerRadius(10)
                   .frame(minHeight: 100)
               
               if viewModel.fieldText.isEmpty {
                   Text("Placeholder text")
                       .foregroundColor(warmCharcoal.opacity(0.6))
                       .padding(.leading, 16)
                       .padding(.top, 12)
               }
               
               TextEditor(text: $viewModel.fieldText)
                   .scrollContentBackground(.hidden)
                   .background(Color.clear)
                   .foregroundColor(warmCharcoal)
                   .frame(minHeight: 100)
                   .padding(.horizontal, 8)
                   .padding(.vertical, 4)
           }
           .frame(minHeight: 100)
           .overlay(
               RoundedRectangle(cornerRadius: 10)
                   .stroke(viewModel.fieldError != nil ? Color.red : Color.gray.opacity(0.3), lineWidth: 1)
           )
           
           // Error messages and character count
           if let error = viewModel.fieldError {
               Text(error)
                   .font(.system(size: 12))
                   .foregroundColor(.red)
                   .padding(.horizontal, 4)
           }
       }
   }
   .padding()
   .frame(maxWidth: .infinity, alignment: .leading)
   .background(Color.white)
   .cornerRadius(16)
   .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
   .padding(.horizontal)
```

7c. FORM VALIDATION:
   - Place error messages directly below each field
   - Use consistent error message styling (small red text)
   - Check form validity before submission

7d. COLOR SCHEME:
   - Use predefined color variables (rustRed, warmCharcoal, cream, denimBlue)
   - Maintain consistent contrast between elements
   - Ensure dark text on light backgrounds for readability

8 *WRITE COMPLETE FUNCTIONS* ALWAYS ALWAYS ALWAYS PROVIDE ENTIRE WORKING FUNCTIONS RATHER THAN PARTIAL FUNCTION SNIPPETS.

Remember to review all UI components for consistency with existing screens before implementing.

Remember, I'd prefer a working solution that we build step by step rather than trying to implement everything at once. This ensures I understand each component and can maintain the codebase effectively after our work together is complete. Always ask to see files and/or the directory tree structure to know what files to ask for.

# Test Users and E2E Testing

Before merging major feature releases, always test entire flows using our predefined test users located in `backend/tests/data/`. Each commit should relate to a specific section of `todo.md`.

## Test Users:
1. **Fred Firestation** (`backend/tests/data/fred_firestation.json`)
   - Email: fred@hotmail.com
   - Password: 123shedly
   - Address: 7000 Reese Ln, Austin, TX 78757
   - Tool: Firefighter Axe (1 token)

2. **Paula Pool** (`backend/tests/data/paula_pool.json`)
   - Email: paula@hotmail.com  
   - Password: 12shedly
   - Address: 6710 Arroyo Seco, Austin, TX 78757
   - Tool: Pool Skimmer Net (1 token)

3. **Puffy Lou** (`backend/tests/data/puffy_lou.json`)
   - Email: puffy@hotmail.com
   - Password: 123shedly
   - Address: 7609 Gault Street, Austin, TX 78757
   - Tool: "It's a Surprise!" gift (1 token)
   - Protected from automatic cleanup
   - Used for waitlist and rental queue testing

## E2E Testing Requirements:
- Test complete user flows before merging features
- Use test users for rental interactions
- Verify geospatial features work (users are ~0.6 miles apart)
- Test token transactions between users
- Validate all API endpoints with test user credentials

# deployment-methodology
The Shedly backend follows a two-step deployment pattern:
1. **Infrastructure First**: CloudFormation creates all AWS resources (DynamoDB, API Gateway, IAM roles, Lambda functions with placeholder code)
2. **Code Deployment**: Makefile commands package and deploy actual Lambda function code using `make update-*` commands

This pattern separates infrastructure management from code deployment, allowing faster iterations and cleaner rollbacks.

## Deployment Commands:
```bash
# Step 1: Deploy infrastructure
make force-update-stack

# Step 2: Deploy Lambda code  
make deploy  # deploys all Lambda functions
# OR deploy individual functions:
make update-user-registration
make update-tool-management
# etc.
```

## Build Status Check
**CRITICAL**: Always check build status before finishing any task or making commits. Run:
```bash
cd mobile/ShedlyApp/Shedly && xcodebuild -project Shedly.xcodeproj -scheme Shedly -destination 'platform=iOS Simulator,name=iPhone 16' build
```

This ensures code compiles successfully and prevents broken builds from being committed.

## CloudFormation Stack Update Issues (Common Problem)

**Problem**: CloudFormation stack updates frequently fail with rollbacks, especially when adding new API Gateway routes.

**Common Error Pattern**:
- Stack goes to `UPDATE_ROLLBACK_COMPLETE` state
- Routes like `WaitlistActionsOptionsRoute`, `RentalActionsOptionsRoute` fail to create
- Stack requires cleanup before retry

**Troubleshooting Steps**:
1. Check stack status: `aws cloudformation describe-stacks --stack-name shedly-backend-dev --profile personal --query 'Stacks[0].StackStatus'`
2. If in rollback state, wait for `UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS` to finish
3. Check specific errors: `aws cloudformation describe-stack-events --stack-name shedly-backend-dev --profile personal --max-items 20`
4. Consider manual resource cleanup if stuck
5. Retry with `make force-update-stack` after cleanup completes

**Workaround Strategy**:
- Deploy Lambda functions individually first: `make update-notification-service`
- Test notification system manually with direct Lambda invocation
- Update stack incrementally rather than all at once

## Key Benefits:
- Infrastructure and code are managed separately
- Lambda code can be updated without CloudFormation changes
- Faster development cycles for code changes
- Cleaner separation of concerns

# Commit Message Standards

Follow Enhanced Conventional Commits format for all git commits:

## Format:
```
<type>(<scope>): <subject under 50 chars>

<body (optional)>
- Brief explanation of what changed
- Why this change was needed  
- Any testing notes or breaking changes
```

**IMPORTANT**: Never include AI attribution signatures:
- ❌ NEVER use "🤖 Generated with [Claude Code](https://claude.ai/code)"
- ❌ NEVER use "Co-Authored-By: Claude <noreply@anthropic.com>"
- ✅ Keep commit messages clean and professional

## Types (Required):
- `feat` - New feature for the user
- `fix` - Bug fix for the user  
- `docs` - Documentation changes
- `style` - Code formatting, missing semicolons, etc (no production code change)
- `refactor` - Refactoring production code (no feature change)
- `test` - Adding/updating tests
- `chore` - Updating dependencies, build tools, etc (no production code change)

## Scopes (Common):
`mobile`, `backend`, `rental`, `auth`, `ui`, `tools`, `api`, `search`, `profile`, `tokens`

## Examples:
```
feat(rental): Add advanced validation UI with error handling
fix(mobile): Fix data staleness bug in tool list refresh  
docs(api): Update authentication flow documentation
chore(backend): Update Lambda deployment configuration
```

## Rules:
- Subject line: 50 characters max, lowercase after type/scope, no period, imperative mood
- Body: Explain what and why, include testing notes for significant changes
- Reference todo.md sections when applicable

# Temporary Files Management

**CRITICAL**: Always use the `tmp/` directory at the root of the repository for temporary files including:
- Test outputs and debug logs
- Debugging scripts and utilities
- Files meant to aid in agentic coding tasks
- Build artifacts and temporary analysis files
- Any file that is not meant to be committed to the repository

**Directory Structure:**
```
/Users/wesleybeckner/code/shedly/tmp/
├── test-outputs/
├── debug-scripts/
├── analysis/
└── build-artifacts/
```

**Benefits:**
- Keeps the repository clean and organized
- Easy to add `tmp/` to .gitignore if not already present
- Provides a standard location for all temporary development files
- Prevents accidental commits of debugging artifacts

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

# Cursor Rules Summary

This project uses 12 cursor rules files to maintain development standards:

## Core Development Guidelines

### 1. Project Interaction (claude.mdc)
- **Incremental approach**: Work on one component at a time
- **Check before proceeding**: Wait for confirmation between steps  
- **Test-driven development**: Suggest tests before implementation
- **Complete functions**: Always provide entire working functions, not snippets
- **API testing procedures**: Use test users (Fred/Paula) for endpoint verification
- **Build status checks**: Run Xcode build before commits to prevent broken builds

### 2. Data Field Consistency (data-field-consistency.mdc) ⚠️ CRITICAL
Backend uses **snake_case**, frontend uses **camelCase**:
- Backend: `user_id`, `user_name`, `profile_image_url`, `tool_description`
- Frontend: `userId`, `userName`, `profileImageUrl`, `toolDescription`
- **Required prefixes**: user_, tool_, image_ (backend) / user, tool, image (frontend)
- **Type indicators**: _url/_id/_at suffixes (backend) / Url/Id/At (frontend)
- **Prohibited**: Ambiguous names like `name`, `description`, `type`

### 3. Git Workflow & Commits (frontend-development.mdc)
- **Enhanced Conventional Commits**: `<type>(<scope>): <subject under 50 chars>`
- **Frontend types**: feat(mobile), fix(mobile), style(ui), refactor(mobile)
- **Common scopes**: ui, auth, rental, profile, tools, navigation
- **Clean commit messages**: Never include AI attribution signatures or co-author tags
- **One commit per todo item**: Atomic commits for single logical units

## Data Management & Caching

### 4. Data Object Updates (data-object-updates.mdc)
Comprehensive patterns for cache synchronization and UI updates:
- **Cache-then-update pattern**: Always clear cache before updating data
- **Notification system**: Use NotificationCenter for cross-app communication
- **AsyncImage handling**: Force reload with refresh triggers and UUID identity
- **Multi-level UI updates**: Use multiple `objectWillChange.send()` calls
- **Debug logging**: Track data flow with comprehensive logging patterns

### 5. Tool List Refresh (tool-list-refresh.mdc)
- **Auto-refresh triggers**: View load, onAppear, ToolAddedNotification
- **Backend endpoint**: `get_user_tools()` in user_profile.py
- **Client components**: NetworkService, ProfileViewModel, ProfileView
- **Horizontal scroll view**: Card-based tool display in profile

## UI/UX Standards

### 6. SwiftUI View Styling (view-style.mdc)
Comprehensive styling guidelines for consistent UI:
- **Color palette**: rustRed, warmCharcoal, cream, denimBlue, sageGreen, amber
- **Text fields**: Custom ZStack-based fields with placeholder and error handling
- **Text editors**: Multi-line styling with proper placeholder positioning
- **Buttons**: Primary (solid) and secondary (outlined) patterns
- **Form validation**: Error messages directly below fields
- **Cards**: Consistent shadow and corner radius (10pt inputs, 16pt cards)

## Infrastructure & Deployment

### 7. Deployment Patterns (shedly-deployment-patterns.mdc)
AWS resource organization and deployment workflows:
- **IAM roles**: Shared LambdaExecutionRole for all functions
- **Lambda functions**: Consistent naming `shedly-{function}-${Environment}`
- **DynamoDB tables**: `shedly-{resource}-${Environment}` with PAY_PER_REQUEST
- **API Gateway**: HTTP API with CORS, AWS_PROXY integrations
- **Deployment flow**: CloudFormation → Lambda packaging → code deployment

### 8. Lambda Function Patterns (lambda-function-patterns.mdc)
Standardized Lambda implementation patterns:
- **Handler structure**: Consistent response format with CORS headers
- **Error handling**: Try-catch with appropriate status codes and user-friendly messages
- **Logging**: Custom logging utility with metrics and performance timing
- **Authentication**: Standard JWT extraction and validation
- **Environment variables**: Consistent access with defaults

### 9. Deployment Troubleshooting (deployment-troubleshooting.mdc)
Common issues and solutions:
- **Lambda import errors**: Check handler paths and CloudFormation references
- **S3 bucket issues**: Verify bucket names and deployment package paths
- **CloudFormation rollbacks**: Use changeset approach and debug commands
- **JWT token debugging**: Fresh token generation and validation steps
- **PyPI vs CodeArtifact**: Local project pip.conf overrides

## Documentation & Testing

### 10. Documentation Organization (documentation-organization.mdc)
**CRITICAL**: All documentation must go in `docs/` directory
- ❌ **Prohibited**: README.md files in subdirectories, scattered *.md files
- ✅ **Required**: Descriptive filenames in docs/ with logical grouping
- **Structure**: api.md, deployment_architecture.md, spec.md, todo.md

### 11. Xcode Testing (xcode-testing.mdc)
Comprehensive testing guidelines and commands:
- **Enhanced test commands**: Detailed output with xcresult bundles
- **Test extraction tools**: xcresulttool for failure analysis
- **Data safety**: Always create test-specific data objects, never modify app data
- **Network test diagnostics**: Custom assertion helpers for HTTP responses
- **Iterative process**: Write, run, analyze, fix, repeat

### 12. Backend Development (backend-development.mdc)
- **Test users**: Fred Firestation, Paula Pool, and Puffy Lou with specific credentials
- **E2E testing**: Complete user flows before feature merges
- **Two-step deployment**: Infrastructure first, then code deployment
- **CloudFormation issues**: Stack rollback patterns and troubleshooting
- **Endpoint verification**: `make test-all-endpoints` after backend changes

## Key Enforcement Points

1. **Data field consistency** is critical for API integration
2. **Documentation centralization** in docs/ directory only
3. **Test data safety** - never modify production data objects
4. **Incremental development** with confirmation between steps
5. **Complete function implementations** always
6. **Clean commit messages** without Claude attribution

# Memories
NEVER SAY 🤖 Generated with [Claude Code](https://claude.ai/code)
NEVER SAY Co-Authored-By: Claude <noreply@anthropic.com
ALWAYS LEAVE THOSE SIGNATURES OUT

- Always change table settings rather than lambda functions - lambda functions are persistent across environments. usually when there is an issue between a table and a lambda function it is because we deployed the table incorrectly. 
- use poetry for all dependency related things

# Temporary Files Management
- keep temporary files and debugging and developments scripts that are not meant to be kept but only meant for agentic code development temporarily in the `tmp/` directory

# AWS Resource Naming Convention

**CRITICAL**: All AWS resources follow the `shedly-{resource}-{environment}` naming pattern:

## Environment Variables
- `ENVIRONMENT`: The deployment environment (dev, staging, prod)
- Used to dynamically construct resource names without hardcoding

## Lambda Function Names
```python
# CORRECT: Intelligent function name construction
env = os.environ.get("ENVIRONMENT", "dev")
function_name = f"shedly-email-verification-{env}"

# INCORRECT: Hardcoded or explicit ENV vars
function_name = "shedly-email-verification-dev"  # hardcoded
function_name = os.environ.get("EMAIL_VERIFICATION_FUNCTION_NAME")  # unnecessary ENV var
```

## DynamoDB Table Names
- Format: `shedly-{resource}-{env}`
- Examples: `shedly-users-dev`, `shedly-tools-staging`, `shedly-email-verifications-prod`

## Benefits of This Pattern
1. **Environment Consistency**: Same code works across dev/staging/prod
2. **Reduced ENV Vars**: Eliminates need for explicit resource name variables
3. **Maintainable**: Easy to understand and modify
4. **Scalable**: Works for any new resources or environments

## Usage Examples
```python
# DynamoDB tables
USER_TABLE_NAME = os.environ.get("USER_TABLE_NAME", f"shedly-users-{env}")
TOOLS_TABLE_NAME = os.environ.get("TOOLS_TABLE_NAME", f"shedly-tools-{env}")

# Lambda functions  
email_function = f"shedly-email-verification-{env}"
password_function = f"shedly-password-reset-{env}"

# S3 buckets
bucket_name = f"shedly-artifacts-{env}"
```

# Memories

- never force update stacks - cloudformation stack is used for reference or entirely new env builds