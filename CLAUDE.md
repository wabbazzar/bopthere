# Wedding App Development Guidelines

When working on Wesley & Heather's wedding app, please follow these guidelines to ensure a methodical and clear development process:

## 1. Incremental Approach
Work on one small, testable component at a time rather than multiple components simultaneously. Complete each step fully before moving to the next.

## 2. Autonomous Development
Proceed with implementation autonomously while maintaining clear communication about progress. Work efficiently through tasks while being prepared to adapt based on feedback.

## 3. Clear Documentation
Document what each component does and how it fits into the overall wedding app architecture during implementation.

## 4. File Management
- Prefer editing existing files over creating new ones
- Follow existing file structure patterns in `src/` directory
- Check for similar files that could be modified instead of creating duplicates

## 5. Context Awareness
Research and understand the current state of the project before making major changes or new implementations.

## 6. Wedding App Specific Requirements

### Character System Integration
- All new features must work across all three character perspectives (Wesley, Heather, Puffy)
- Maintain character-specific theming (colors, fonts, content variations)
- Ensure content variations are appropriate for each character's voice:
  - **Wesley**: Adventure/quest language, heroic tone
  - **Heather**: Elegant/romantic language, warm tone  
  - **Puffy**: Playful/casual language, fun tone

### Technical Standards
- Use TypeScript with proper typing for all new code
- Follow existing shadcn/ui component patterns
- Maintain responsive design across all viewports (mobile-first approach)
- Integrate with existing Supabase setup when data is involved
- Follow existing file structure in `src/components/`, `src/contexts/`, etc.

### Content Guidelines
- Maintain the "Epic Wedding Quest" theme and fantasy narrative
- Use appropriate fonts (Cinzel for fantasy headers, Crimson Text for body)
- December 5-9, 2025 in Maui, Hawaii context
- Wedding celebration focus with quest/adventure metaphors

### UI/UX Consistency
- Follow existing character theme patterns from `src/types/character.ts`
- Use consistent background image integration patterns
- Maintain existing card-based layouts and animations
- Ensure smooth transitions between different character perspectives

## 7. Development Standards

### Component Structure
- Use functional components with TypeScript
- Follow existing patterns for character context integration
- Maintain consistent import organization
- Use proper React hooks and state management

### Styling Approach
- Use Tailwind CSS following existing patterns
- Maintain character-specific theming through CSS custom properties
- Ensure responsive design with mobile-first approach
- Follow existing animation and transition patterns

### Data Management
- Use Supabase client patterns for database operations
- Follow existing error handling and loading state patterns
- Maintain proper form validation and user feedback
- Use existing toast notification system

## 8. Testing Requirements
- Test functionality across all three character perspectives
- Verify responsive design on mobile, tablet, and desktop
- Test form submissions and data persistence
- Ensure smooth character switching and theme changes
- Validate RSVP flow functionality

### Playwright Testing and Debugging

#### Why Playwright?
Playwright provides powerful browser automation for debugging complex UI issues that are difficult to reproduce manually. It's particularly useful for:
- Debugging intermittent navigation issues
- Testing dialog and overlay interactions
- Capturing console logs and errors
- Taking screenshots at each step
- Running JavaScript in the browser context

#### Setting Up Playwright Tests

1. **Installation** (if not already installed):
```bash
npm install -D @playwright/test
npx playwright install chromium
```

2. **Basic Test Structure**:
```typescript
import { test, expect } from '@playwright/test';

test('navigation remains clickable after character selection', async ({ page }) => {
  // Enable debug mode
  await page.goto('http://localhost:5173?nav-debug');
  
  // Capture console logs
  page.on('console', msg => console.log(`[${msg.type()}]`, msg.text()));
  
  // Test your interaction
  await page.click('[data-character="wesley"]');
  await page.waitForTimeout(500);
  
  // Check for blockers
  const blockers = await page.evaluate(() => {
    return (window as any).navDebugger?.showBlockers() || [];
  });
  
  expect(blockers).toHaveLength(0);
});
```

#### Debugging Navigation Issues with Playwright

When debugging navigation or click issues:

1. **Enable Debug Mode**: Always append `?nav-debug` to URLs
2. **Capture Console Logs**: Monitor for warnings and errors
3. **Check for Blocking Elements**:
```javascript
const blockers = await page.evaluate(() => {
  return (window as any).navDebugger?.showBlockers() || [];
});
console.log('Blocking elements:', blockers);
```

4. **Take Strategic Screenshots**:
```javascript
await page.screenshot({ path: 'before-click.png' });
await page.click('#hamburger-menu');
await page.screenshot({ path: 'after-click.png' });
```

5. **Test Click Handlers**:
```javascript
const isClickable = await page.isVisible('#hamburger-menu');
const isEnabled = await page.isEnabled('#hamburger-menu');
console.log(`Button visible: ${isClickable}, enabled: ${isEnabled}`);
```

#### Common Debugging Patterns

1. **Dialog Cleanup Issues**:
```javascript
// Check for orphaned dialog overlays
const dialogElements = await page.$$('[role="dialog"], [data-radix-dialog-overlay]');
console.log(`Found ${dialogElements.length} dialog elements`);

// Force cleanup if needed
await page.evaluate(() => {
  document.querySelectorAll('[data-radix-dialog-overlay]').forEach(el => el.remove());
});
```

2. **Z-Index Conflicts**:
```javascript
const zIndexes = await page.evaluate(() => {
  const elements = document.querySelectorAll('.fixed');
  return Array.from(elements).map(el => ({
    class: el.className,
    zIndex: window.getComputedStyle(el).zIndex
  }));
});
console.table(zIndexes);
```

3. **Event Handler Verification**:
```javascript
const hasClickHandler = await page.evaluate((selector) => {
  const element = document.querySelector(selector);
  return element ? element.onclick !== null : false;
}, '#hamburger-menu');
```

#### Example: Complete Navigation Debug Test

```typescript
import { test, expect } from '@playwright/test';

test('debug navigation after character selection', async ({ page }) => {
  // Setup
  await page.goto('http://localhost:5173?nav-debug');
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  
  // Initial state
  await page.screenshot({ path: 'debug/1-initial.png' });
  
  // Select character
  await page.click('text=Choose Wesley');
  await page.waitForTimeout(300); // Wait for dialog animation
  
  // Check for blockers
  const blockers = await page.evaluate(() => {
    return (window as any).navDebugger?.showBlockers() || [];
  });
  
  if (blockers.length > 0) {
    console.log('Found blockers:', JSON.stringify(blockers, null, 2));
    await page.screenshot({ path: 'debug/2-blockers-found.png' });
  }
  
  // Test navigation
  const navButtons = await page.$$('nav button');
  console.log(`Found ${navButtons.length} nav buttons`);
  
  for (let i = 0; i < navButtons.length; i++) {
    const isClickable = await navButtons[i].isEnabled();
    console.log(`Button ${i}: ${isClickable ? 'clickable' : 'NOT clickable'}`);
  }
  
  // Export debug logs
  const debugLogs = await page.evaluate(() => {
    return (window as any).navDebugger?.exportLogs() || '[]';
  });
  
  console.log('Debug logs:', debugLogs);
});
```

#### Integration with CI/CD

Add Playwright tests to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run Playwright tests
  run: npx playwright test

- name: Upload test artifacts
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-screenshots
    path: test-results/
```

### Specialized Testing Agents
Use specialized agents for comprehensive testing tasks:

#### test-writer Agent
- **Purpose**: Creates comprehensive test suites for code components, functions, or modules
- **When to use**: When implementing new features that need thorough testing coverage
- **Best practices**: 
  - Provide incremental instructions to allow for iterative development
  - Include specific requirements for wedding app context (character system, RSVP flow)
  - Request progress updates to maintain oversight and provide course corrections
  - **MANDATORY for AWS integrations**: Always request E2E smoke tests that verify Gateway → Lambda → DynamoDB flow

##### Field Validation in Tests

When writing tests for AWS integrations:

1. **PRIMARY SOURCE**: Use exact field names from the ticket's "Field Reference" sections
   - Test that requests use the exact fields shown in the ticket
   - Validate responses contain the documented fields

2. **FAILSAFE**: If field information is missing from the ticket:
   ```bash
   # Consult schema files
   cat .wedding/context/dynamodb-schemas.json
   cat .wedding/context/api-endpoints.md
   cat .wedding/context/lambda-patterns.json
   ```

3. **ALWAYS INCLUDE**: Tests that validate:
   - Request fields match schemas exactly
   - Response fields are documented
   - Field types match expectations
   - No extra undocumented fields

#### test-critic Agent  
- **Purpose**: Reviews and improves quality of existing test suites
- **When to use**: When test suites need quality assessment, coverage analysis, or performance optimization
- **Best practices**:
  - Ask for specific analysis of test maintainability and brittleness
  - Request recommendations for improving test performance
  - Include failsafes to prevent getting stuck on minor issues

#### Agent Usage Guidelines
- Provide clear, incremental instructions that allow for feedback loops
- Include specific context about wedding app requirements (character themes, mobile-first design)
- Set clear boundaries to prevent agents from going down rabbit holes
- Request regular progress updates and maintain oversight throughout the process

## 9. Build and Deployment

### Frontend Build Verification
Always verify the build works before finishing any task:
```bash
npm run build
npm run lint
```

Check that the development server runs without errors:
```bash
npm run dev
```

### AWS Deployment Standards
- **NO Terraform/OpenTofu** - Use AWS CLI and Makefile only
- **Always use `--profile personal --region us-east-1`** for all AWS commands
- **Use PyPI (not CodeArtifact)** for Python dependencies
- **Create Makefile targets** for all deployment operations
- **All resources must be in us-east-1 region**

#### Lambda Deployment Pattern:
```bash
# For new Lambda functions
make deploy-[function]-lambda
make test-[function]

# For updates
make update-[function]-lambda
```

#### DynamoDB Table Creation:
```bash
aws dynamodb create-table \
  --table-name heatherandwesley-[feature] \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --profile personal \
  --region us-east-1
```

#### E2E Smoke Tests:
Every AWS integration MUST include E2E smoke tests:
```bash
# Location: tests/e2e/smoke/test_[feature]_smoke.py
# Run: make test-e2e-smoke
# Or specific: cd tests/e2e/smoke && pytest test_[feature]_smoke.py -v
```

## 10. Git Commit Standards

Follow Enhanced Conventional Commits format:

### Format:
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

### Types:
- `feat` - New feature for wedding guests/couple
- `fix` - Bug fix for user experience
- `docs` - Documentation changes
- `style` - Code formatting, styling updates
- `refactor` - Code refactoring (no feature change)
- `test` - Adding/updating tests
- `chore` - Dependencies, build tools, etc.

### Scopes:
`character`, `rsvp`, `ui`, `hero`, `mobile`, `wedding`, `form`, `theme`

### Examples:
```
feat(character): Add Puffy character background images to RSVP flow
fix(rsvp): Fix form validation on mobile devices
style(hero): Update character theme colors for better contrast
docs(wedding): Update ticket generation rules for character system
```

## 11. File Organization

### CRITICAL: Directory Organization Rules

**ALL temporary files MUST go into `tmp/`:**
- Debugging scripts
- Temporary scripts  
- Build artifacts
- Scratch files
- Development utilities

**ALL files staged for deletion MUST go into `@local/`:**
- Files being phased out
- Deprecated components
- Legacy code awaiting removal

**ALL tests MUST go in `tests/` with proper subdirectories:**
- `tests/unit/frontend/` - Jest tests for React components
- `tests/unit/backend/` - Python tests for Lambda/API
- `tests/integration/frontend/` - React + API integration tests
- `tests/integration/backend/` - Lambda + DynamoDB integration tests
- `tests/e2e/playwright/` - Browser automation tests
- `tests/e2e/smoke/` - API smoke tests

### Core Files to Understand:
- `src/App.tsx` - Main application setup
- `src/pages/Index.tsx` - Main page with character system
- `src/contexts/CharacterContext.tsx` - Character state management
- `src/types/character.ts` - Character definitions and themes
- `src/components/` - All React components
- `docs/` - All documentation and requirements

### Asset Management:
- Images stored in `public/app-uploads/`
- Character-specific assets follow naming conventions
- Background images for each character and RSVP step

## 12. Important Reminders

- **Complete Functions**: Always provide entire working functions rather than partial snippets
- **Wedding Context**: Remember this is for a celebration - prioritize joy and user experience
- **Guest Experience**: Design with wedding guests in mind (mobile-first, easy navigation)
- **Character Immersion**: Maintain the magical quest experience throughout
- **Responsive Design**: Wedding guests will primarily use mobile devices

## 13. AWS Configuration

**🚨 CRITICAL: ALL AWS RESOURCES MUST BE IN US-EAST-1 (N. VIRGINIA) 🚨**

**IMPORTANT**: Always use the `personal` profile AND `us-east-1` region for AWS operations:
- All AWS CLI commands must include `--profile personal --region us-east-1`
- All boto3 sessions must specify `profile_name='personal', region_name='us-east-1'`
- Infrastructure is deployed manually using AWS CLI (no OpenTofu/Terraform)

Examples:
```bash
# AWS CLI commands - ALWAYS INCLUDE --region us-east-1
aws dynamodb describe-table --table-name heatherandwesley-users --profile personal --region us-east-1
aws lambda get-function --function-name heatherandwesley-auth-handler --profile personal --region us-east-1

# Python boto3 usage - ALWAYS SPECIFY region_name='us-east-1'
session = boto3.Session(profile_name='personal', region_name='us-east-1')
dynamodb = session.resource('dynamodb')
```

**⚠️ NEVER CREATE RESOURCES IN ANY OTHER REGION! ALL INFRASTRUCTURE IS IN US-EAST-1! ⚠️**

## 13a. Python Package Management

**IMPORTANT**: Use PyPI (not CodeArtifact) for Python packages:
- Poetry is configured to use PyPI via `poetry config repositories.pypi https://pypi.org/simple/`
- `pip.conf` file ensures pip uses PyPI for Lambda package builds
- Always use `--index-url https://pypi.org/simple/` flag when installing packages for Lambda

Examples:
```bash
# Install packages for Lambda with PyPI
pip install --index-url https://pypi.org/simple/ -r requirements.txt -t build/lambda-package/

# Poetry operations use PyPI by default
poetry install
poetry add boto3
```

## 14. Temporary Files Management

**FOLLOW STRICT DIRECTORY ORGANIZATION:**

- **Use `tmp/` for ALL temporary files** - debugging scripts, analysis files, build artifacts, scratch files that aid in development but aren't part of the main codebase
- **Use `@local/` for files staged for deletion** - deprecated components, legacy code, files being phased out
- **Use `tests/` with proper subdirectories** - all testing files must be properly organized by type and technology (unit/frontend, unit/backend, integration/frontend, integration/backend, e2e/playwright, e2e/smoke)

**DO NOT** use `docs/` for temporary files - maintain clean documentation structure.

## 15. Ticket Generation

When generating tickets for the Wedding App:
- **Always save new tickets to**: `docs/tickets/backlog/XXX_[type]_[description].md`
- **Never save to**: `docs/tickets/` root directory
- **Ticket numbering**: Scan both backlog/ and archive/ directories to find the highest XXX number, then increment by 1
- **Ensure directory exists**: Always verify `docs/tickets/backlog/` exists before writing
- **Follow ticket rules**: Refer to `docs/generate_ticket_rules.md` for comprehensive ticket structure

## 16. Recent Updates (August 2025)

### Completed Features
- **Persistent Login Sessions**: Implemented 30-day JWT tokens with automatic refresh at 80% lifetime
- **Token Refresh**: Added `/auth/refresh` endpoint with PWA lifecycle support
- **AWS Migration**: Completed migration from us-west-2 to us-east-1
- **Region Consistency**: All resources now in us-east-1 (N. Virginia) with enforced consistency checks

### AWS Integration Requirements

When working with AWS services:

1. **Binary Dependencies**: Avoid Python packages with binary dependencies in Lambda (e.g., bcrypt)
   - Use pure Python alternatives or SHA256 for hashing
   - Test deployment packages locally before uploading

2. **Deployment Documentation**: Update these sections in real-time:
   - Makefile targets for new resources
   - Environment variables in Lambda configurations
   - IAM permissions required
   - DynamoDB table schemas and indexes

3. **Verification Process**:
   ```bash
   # After deployment
   make test-[feature]
   make test-all-endpoints
   ```

Focus on delivering working solutions built incrementally while maintaining code quality and comprehensive testing. Use specialized agents when appropriate to ensure thorough testing coverage and quality assurance.

## Wedding App Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **State Management**: React Context (Character system)
- **Database**: Supabase (RSVP data)
- **Deployment**: GitHub Pages with custom domain
- **Fonts**: Google Fonts (Cinzel, Crimson Text)
- **Icons**: Lucide React

Always check existing patterns and implementations before creating new components or features.