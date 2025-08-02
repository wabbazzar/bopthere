# Ticket #008: Fix GitHub Pages Build Failure - Auth Files Not Tracked in Git

**Status**: PENDING
**Priority**: HIGH - Build failures block all deployments and development
**Estimated Effort**: 3 points - Simple git tracking fix with comprehensive testing
**Created**: 2025-08-02

## Overview
GitHub Pages build is failing because `src/lib/auth.ts` and `src/lib/__tests__/auth.test.ts` exist locally but are not tracked in git due to overly broad `.gitignore` rule. The build fails with ENOENT error when trying to import the auth module.

## User Stories

### Primary User Story
As a developer, I want the GitHub Pages build to succeed so that the latest changes are deployed and accessible to wedding guests.

### Secondary User Stories
- As a developer, I want all auth-related files properly tracked in git so that authentication features work in production
- As a wedding guest, I want to access the website without build failures preventing deployment
- As the development team, I want proper version control of authentication components

## Technical Requirements

### Functional Requirements
- All authentication-related files must be tracked in git
- GitHub Pages build must complete successfully
- Authentication functionality must work in both development and production
- Character system integration must continue working with auth features

### Non-Functional Requirements
- Build time must remain under 3 minutes
- No breaking changes to existing authentication patterns
- Maintain compatibility with AWS Lambda auth integration
- Preserve TypeScript type safety for auth components

## Implementation Plan

### Phase 1: Fix .gitignore Rule and Track Auth Files (2 points)

**Root Cause Analysis:**
Current `.gitignore` contains `lib/` rule on line 65 which incorrectly ignores `src/lib/` directory, preventing `src/lib/auth.ts` and `src/lib/__tests__/auth.test.ts` from being tracked.

**Field Reference:**
From `src/lib/auth.ts` imports:
```typescript
import { apiRequest, APIError } from '@/integrations/aws/api-client';
import { LoginCredentials, LoginResponse, User } from '@/types/auth';
```

**Files to Track:**
- `src/lib/auth.ts` - Authentication service with JWT token management
- `src/lib/__tests__/auth.test.ts` - Test suite for authentication service
- `src/lib/utils.ts` - Already tracked utility functions

**Implementation steps:**
1. Update `.gitignore` to exclude `src/lib/` from the broad `lib/` rule
2. Add specific ignore for Python `lib/` directories to maintain intended functionality
3. Force add the untracked auth files to git
4. Verify all auth-related dependencies are properly tracked
5. Test build locally and verify imports resolve correctly

**Files to Modify:**
- `.gitignore` - Update rule to be more specific for Python lib directories
- Add `src/lib/auth.ts` to git tracking
- Add `src/lib/__tests__/auth.test.ts` to git tracking

**Testing Requirements:**
- Local build verification: `npm run build` completes without errors
- Development server verification: `npm run dev` runs without import errors
- GitHub Pages deployment verification: Push and monitor build status
- Authentication flow verification: Login/logout functions work correctly
- Character system integration: Auth works across all three character perspectives

### Phase 2: Verify Auth Integration and E2E Testing (1 point)

**Implementation steps:**
1. Verify all auth-related imports resolve correctly in development
2. Test authentication service methods (login, logout, token verification)
3. Verify AWS API client integration works with tracked files
4. Test character system compatibility with authentication
5. Run comprehensive build verification

**Files to Verify:**
- `src/contexts/AuthContext.tsx` - Imports `AuthService` correctly
- `src/integrations/aws/api-client.ts` - API client functions work
- `src/types/auth.ts` - Type definitions are accessible
- All component tests that depend on auth functionality

**E2E Testing Requirements:**
```bash
# Local build verification
npm run build
npm run lint
npm run dev

# Auth service testing
npm test src/lib/__tests__/auth.test.ts

# Integration testing
npm test src/contexts/__tests__/AuthContext.test.tsx
npm test src/components/__tests__/LoginModal.test.tsx
```

**GitHub Actions Testing:**
1. Create test scripts in `tmp/` directory for autonomous execution
2. Push changes and monitor GitHub Actions build logs
3. Verify deployment succeeds and auth endpoints are accessible
4. Test authentication flow from deployed website

**Testing with specialized agents:**
1. Run: `claude --agent test-writer "Write comprehensive integration tests for auth service using exact field names from src/types/auth.ts"`
2. Run: `claude --agent test-critic "Review auth integration tests for character system compatibility and build verification"`
3. Run: `claude --agent test-writer "Implement critic's suggestions and add E2E smoke tests for auth functionality"`

## Documentation Updates Required

### Core Documentation
- [ ] `README.md` - No updates needed (auth system already documented)
- [ ] `.gitignore` - Update comments to clarify Python lib/ exclusion

### Technical Documentation
- [ ] Verify component documentation reflects proper auth file tracking
- [ ] Ensure deployment instructions account for auth file dependencies

## Success Criteria

### Functional Acceptance Criteria
- [ ] GitHub Pages build completes successfully without ENOENT errors
- [ ] `src/lib/auth.ts` is properly tracked in git and accessible in CI
- [ ] `src/lib/__tests__/auth.test.ts` is tracked and runs in test suite
- [ ] All auth-related imports resolve correctly in production build
- [ ] Authentication functionality works across all character perspectives

### Performance Criteria
- [ ] Build time remains under 3 minutes (baseline: current build time)
- [ ] No degradation in development server startup time
- [ ] Auth service tests execute in under 10 seconds

### Quality Criteria
- [ ] All existing functionality continues to work without regression
- [ ] TypeScript compilation succeeds with proper auth type checking
- [ ] Code follows existing patterns for service organization
- [ ] Character system integration remains seamless

## Dependencies

### Technical Dependencies
- Git tracking system must recognize file changes
- GitHub Actions build environment must access tracked files
- TypeScript compiler must resolve auth imports
- Jest testing framework must execute auth tests

### Character System Dependencies
- Authentication must work consistently across Wesley, Heather, and Puffy themes
- Auth modal styling must respect character-specific theming
- Token storage must persist through character switching

### Development Dependencies
- Fix must be applied before any auth-related feature development
- Resolves blocking issues for AWS Lambda auth integration deployment
- Required for proper staging and production auth testing

## Risks & Mitigations

### Technical Risks
**Risk**: Overly broad .gitignore changes could expose sensitive files
**Impact**: HIGH
**Mitigation**: Use specific Python lib/ exclusions instead of broad lib/ rule

**Risk**: Auth files contain sensitive credentials or API keys
**Impact**: HIGH  
**Mitigation**: Review auth.ts content before tracking (already verified - no secrets present)

**Risk**: Breaking changes to existing import patterns
**Impact**: MEDIUM
**Mitigation**: Test all existing auth imports before and after changes

### Build System Risks
**Risk**: GitHub Actions caching issues with newly tracked files
**Impact**: MEDIUM
**Mitigation**: Clear caches and force rebuild to verify proper file tracking

**Risk**: Deployment pipeline fails due to auth dependency changes
**Impact**: HIGH
**Mitigation**: Test full deployment cycle in staging before production release

### User Experience Risks
**Risk**: Authentication breaks during transition period
**Impact**: HIGH
**Mitigation**: Quick rollback plan and comprehensive testing before deployment

**Commit Messages:**
```
Phase 1: "fix(build): track auth files and update gitignore rule

- Update .gitignore to exclude src/lib/ from broad lib/ rule
- Add specific Python lib/ directory exclusions  
- Track src/lib/auth.ts and src/lib/__tests__/auth.test.ts
- Resolve GitHub Pages ENOENT build failure"

Phase 2: "test(auth): verify auth integration and build success

- Confirm all auth imports resolve correctly
- Test authentication service across character themes
- Verify E2E build and deployment pipeline  
- Validate auth functionality in production environment"
```