# Ticket 015: Persistent Login Sessions for PWA and Browser

## Metadata
- **Status**: Not Started
- **Priority**: High
- **Effort**: 8 points
- **Created**: 2025-08-10
- **Type**: feature
- **Character Impact**: All

## User Stories

### Primary User Story
As a wedding guest using the PWA installed app, I want to stay logged in for the full 30-day token duration so that I don't have to re-enter credentials every time I open the app.

### Secondary User Stories
- As a mobile user, I want my login session to persist even when the app goes to background or device sleeps so that I maintain seamless access to wedding features.
- As a PWA user, I want automatic token refresh to work seamlessly so that I never experience unexpected logouts during extended use.
- As a guest switching between characters, I want my authentication to persist so that the character selection doesn't require re-login.
- As a returning guest, I want my login to persist across browser restarts and app launches so that I don't lose access during the wedding planning period.

## Problem Analysis

### Current Issues Identified
1. **PWA Session Loss**: Users report frequent logouts in PWA installed app despite 30-day JWT expiry
2. **Token Expiry Mismatch**: Backend sets 30-day JWT expiry but frontend doesn't implement proper token refresh
3. **PWA Lifecycle Events**: App doesn't handle PWA lifecycle events (background, foreground, install) properly for auth persistence
4. **Storage Inconsistency**: Authentication state may not be properly synchronized between localStorage and React state
5. **Character Switching Impact**: Character selection dialogs or navigation may inadvertently clear auth state
6. **Background App Handling**: PWA doesn't maintain authentication when app goes to background or device sleeps

### Root Cause Analysis
- Frontend `isAuthenticated()` check relies on client-side timestamp validation (30 days) but doesn't refresh tokens
- No automatic token refresh mechanism when approaching expiry
- PWA service worker doesn't maintain auth state during background operations
- Authentication context may be reset during component unmounts/remounts
- Missing PWA-specific session persistence patterns

## Technical Requirements

### Functional Requirements
1. **Token Refresh System**: Implement automatic JWT token refresh before expiry (refresh at 80% of token lifetime)
2. **PWA Persistence**: Ensure authentication persists across PWA app launches, background/foreground cycles, and device sleep
3. **Storage Synchronization**: Synchronize authentication state between localStorage, sessionStorage, and React context
4. **Character Integration**: Maintain authentication across all character perspective switches (Wesley/Heather/Puffy)
5. **Background Handling**: Implement proper handling of PWA background/foreground events for auth persistence
6. **Token Validation**: Add server-side token refresh endpoint with proper security measures
7. **Session Recovery**: Implement session recovery mechanisms for interrupted connections or app crashes

### Non-Functional Requirements
1. **Performance**: Token refresh should be invisible to users (< 200ms response time)
2. **Security**: Refresh tokens should be securely stored and transmitted
3. **Reliability**: 99%+ auth persistence success rate across PWA lifecycle events
4. **Mobile Optimization**: Handle mobile-specific scenarios (airplane mode, poor connectivity, background app limits)

### Field Reference - Auth Token Refresh

#### Request Fields (`/auth/refresh`)
```typescript
interface RefreshTokenRequest {
  token: string;           // Current JWT token to refresh
  refresh_token?: string;  // Optional refresh token (if implemented)
}
```

#### Response Fields
```typescript
interface RefreshTokenResponse {
  message: string;         // Success message
  token: string;           // New JWT token with extended expiry
  expires_at: string;      // ISO timestamp of token expiration
  user: {                  // Updated user information
    username: string;
    email: string;
    full_name: string;
    role: string;
  }
}
```

#### Error Response Fields
```typescript
interface RefreshTokenError {
  error: string;           // Error message
  code?: string;          // Error code for client handling
  requires_login?: boolean; // Whether user needs to re-login
}
```

## Implementation Plan

### Phase 1: Backend Token Refresh Endpoint (3 points)
**Files to modify:**
- `aws/lambda/auth-handler.py` - Add `/auth/refresh` endpoint
- `Makefile` - Add deployment target for updated auth handler

**Lambda Function Enhancement:**
```python
def refresh_token_handler(event, context):
    """
    Refresh JWT token with extended expiry
    Validates current token and issues new one if valid
    """
    # Validate current token is not expired
    # Issue new token with 30-day expiry
    # Update last_activity timestamp in DynamoDB
    # Return new token and expiry information
```

**Implementation steps:**
1. Add `/auth/refresh` POST endpoint to auth-handler.py following existing patterns
2. Implement token refresh logic with proper validation and security checks
3. Add last_activity tracking to user records in DynamoDB
4. Include proper error handling for expired tokens requiring full re-login
5. Follow existing CORS and error response patterns from login/verify endpoints

**Testing:**
1. Run: `claude "Use the test-writer agent to create E2E smoke tests for auth refresh endpoint"`
2. Run: `claude "Use the test-critic agent to review auth refresh tests for security edge cases"`
3. Run: `claude "Use the test-writer agent to implement critic's suggestions for auth refresh tests"`

**Build Verification:**
```bash
make update-auth-lambda
make test-auth
aws logs tail /aws/lambda/heatherandwesley-auth-handler --follow --profile personal --region us-east-1
```

**Commit**: `feat(auth): implement JWT token refresh endpoint`

### Phase 2: Frontend Token Refresh Service (2 points)
**Files to modify:**
- `src/lib/auth.ts` - Add token refresh functionality
- `src/types/auth.ts` - Add refresh token interfaces

**AuthService Enhancement:**
```typescript
class AuthService {
  static async refreshToken(): Promise<RefreshTokenResponse> {
    // Call /auth/refresh endpoint with current token
    // Handle token refresh success/failure scenarios  
    // Update localStorage with new token and expiry
    // Return refresh status and new token info
  }

  static shouldRefreshToken(): boolean {
    // Check if token is approaching expiry (80% of lifetime)
    // Return true if refresh is needed
  }

  static getTokenExpiryTime(): number | null {
    // Calculate token expiry from JWT payload
    // Return timestamp or null if invalid
  }
}
```

**Implementation steps:**
1. Add JWT token parsing to extract expiry time from token payload
2. Implement shouldRefreshToken() logic to check 80% token lifetime threshold
3. Add refreshToken() method that calls new backend endpoint
4. Update setAuthData() to store token expiry information
5. Add error handling for refresh failures requiring re-login

**Testing:**
1. Run: `claude "Use the test-writer agent to create unit tests for AuthService token refresh methods"`
2. Run: `claude "Use the code-quality-assessor agent to review AuthService for performance and security"`
3. Run: `claude "Use the test-critic agent to analyze token refresh tests for edge cases"`

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(auth): add frontend token refresh service methods`

### Phase 3: Automatic Token Refresh Context (3 points)
**Files to modify:**
- `src/contexts/AuthContext.tsx` - Add automatic token refresh logic
- `src/hooks/useTokenRefresh.ts` - Create token refresh hook
- `src/components/AuthWrapper.tsx` - Create auth persistence wrapper

**Context Enhancement:**
```typescript
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Add token refresh interval management
  // Implement automatic refresh before expiry
  // Handle PWA lifecycle events (background/foreground)
  // Add session recovery on component mount
  // Maintain auth state synchronization

  useEffect(() => {
    // Set up automatic token refresh timer
    // Register PWA lifecycle event listeners
    // Implement session recovery logic
  }, []);
};

// New hook for token refresh management
export const useTokenRefresh = () => {
  // Manage refresh intervals and timing
  // Handle refresh success/failure states
  // Provide manual refresh trigger
};
```

**PWA Lifecycle Integration:**
```typescript
// Handle PWA background/foreground events
window.addEventListener('beforeunload', handleAppClose);
document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('focus', handleAppFocus);
window.addEventListener('blur', handleAppBlur);
```

**Implementation steps:**
1. Create useTokenRefresh hook to manage refresh intervals and timing
2. Add PWA lifecycle event listeners to AuthContext for background/foreground handling
3. Implement automatic token refresh timer that triggers at 80% token lifetime
4. Add session recovery logic that validates and refreshes tokens on app startup
5. Integrate with existing character context to maintain auth across character switches
6. Handle edge cases like network failures, server errors, and token refresh failures

**Testing:**
1. Run: `claude "Use the test-writer agent to create Playwright tests for PWA auth persistence across app lifecycle events"`
2. Run: `claude "Use the test-critic agent to review PWA auth tests for comprehensive coverage"`
3. Run: `claude "Use the test-writer agent to implement critic's suggestions for PWA auth tests"`

**Build Verification:**
```bash
npm run build
npm run lint  
npm run dev
```

**Commit**: `feat(auth): implement automatic token refresh with PWA lifecycle handling`

## Testing Strategy

### Character Perspective Tests
- Test persistent login across all character switches (Wesley ↔ Heather ↔ Puffy)
- Verify character selection doesn't clear authentication state
- Test auth persistence during character theme transitions

### PWA Lifecycle Tests  
- **App Launch**: Verify auth state loads correctly on PWA startup
- **Background/Foreground**: Test auth persistence when app goes to background and returns
- **Device Sleep**: Verify login persists through device sleep/wake cycles
- **Network Interruption**: Test auth recovery after network disconnections
- **App Installation**: Ensure auth works properly during and after PWA installation

### Token Refresh Tests
- **Automatic Refresh**: Verify tokens refresh automatically at 80% lifetime
- **Manual Refresh**: Test manual token refresh functionality
- **Refresh Failures**: Handle refresh failures gracefully with re-login prompts
- **Concurrent Requests**: Test token refresh during active API requests
- **Edge Cases**: Test refresh near token expiry, server errors, and network timeouts

### Integration Tests
- **RSVP Flow**: Verify persistent auth throughout RSVP process
- **Game Features**: Test auth persistence in Tetris and leaderboard features
- **API Requests**: Ensure all authenticated API calls work with refreshed tokens
- **Error Handling**: Test proper error states and recovery mechanisms

### E2E Smoke Tests
**MANDATORY**: Each phase must include smoke tests that verify the complete authentication flow

**Test Structure**:
```bash
# Create test file: tests/e2e/smoke/test_persistent_auth_smoke.py
import os
import requests
import pytest
import time

ENV = os.environ.get('ENV', 'prod')  
API_BASE = f"https://[api-id].execute-api.us-east-1.amazonaws.com/{ENV}"

def test_auth_token_refresh_smoke():
    """Smoke test for persistent auth - verifies Gateway → Lambda → DynamoDB flow"""
    
    # 1. Test initial login
    login_response = requests.post(f"{API_BASE}/auth/login", json={
        "username": "testguest",
        "password": "wedding2025"
    })
    assert login_response.status_code == 200
    initial_token = login_response.json()["token"]
    
    # 2. Test token refresh endpoint
    refresh_response = requests.post(f"{API_BASE}/auth/refresh",
        headers={"Authorization": f"Bearer {initial_token}"},
        json={"token": initial_token})
    
    assert refresh_response.status_code == 200
    refresh_data = refresh_response.json()
    assert refresh_data["token"] != initial_token
    assert "expires_at" in refresh_data
    
    # 3. Test new token validation
    verify_response = requests.post(f"{API_BASE}/auth/verify",
        headers={"Authorization": f"Bearer {refresh_data['token']}"})
    assert verify_response.status_code == 200
    assert verify_response.json()["user"]["username"] == "testguest"

def test_pwa_auth_persistence_smoke():
    """Test PWA-specific auth persistence scenarios"""
    
    # Test auth state after simulated app background/foreground
    # Test token refresh during app lifecycle events
    # Verify session recovery after simulated app restart
    pass

# Run with: pytest tests/e2e/smoke/test_persistent_auth_smoke.py -v
```

**Playwright PWA Tests**:
```typescript
import { test, expect } from '@playwright/test';

test('PWA auth persistence across app lifecycle', async ({ page, context }) => {
  // Test PWA installation and auth state
  await page.goto('http://localhost:5173');
  
  // Login and verify auth state
  await page.fill('[data-testid="username"]', 'testguest');
  await page.fill('[data-testid="password"]', 'wedding2025');
  await page.click('[data-testid="login-button"]');
  
  // Simulate PWA installation
  await context.grantPermissions(['notifications']);
  
  // Test background/foreground cycle
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  
  // Verify auth state persists
  const authState = await page.evaluate(() => {
    return localStorage.getItem('wedding-auth-token') !== null;
  });
  
  expect(authState).toBe(true);
});
```

## Documentation Updates Required
1. Update auth service documentation with token refresh patterns
2. Document PWA auth persistence best practices
3. Add troubleshooting guide for auth issues in PWA context
4. Document token refresh endpoint API specification

## Success Criteria
1. **PWA Users**: 99%+ auth persistence across app launches and lifecycle events
2. **Token Refresh**: Automatic refresh works seamlessly without user intervention  
3. **Character Integration**: Auth persists perfectly across all character switches
4. **Mobile Performance**: No performance degradation on mobile devices during auth operations
5. **Error Recovery**: Graceful handling of auth failures with clear user feedback
6. **30-Day Persistence**: Users stay logged in for full token lifetime as intended

## Dependencies
- Existing JWT authentication system (auth-handler.py)
- Character context system (src/contexts/CharacterContext.tsx)
- PWA manifest configuration (public/manifest.json)
- localStorage and React context integration

## Risks & Mitigations
1. **Risk**: Token refresh failures during poor network conditions
   **Mitigation**: Implement exponential backoff retry logic and graceful degradation
2. **Risk**: PWA lifecycle events not firing consistently across devices
   **Mitigation**: Use multiple event listeners and polling fallback mechanisms
3. **Risk**: Security issues with token refresh implementation
   **Mitigation**: Follow JWT best practices and implement proper validation

## Deployment Guide

**CRITICAL**: This section MUST be updated by EVERY agent working on the ticket when making infrastructure changes.

### Infrastructure Changes

#### Enhanced Lambda Functions
- **Lambda Functions**: 
  - `heatherandwesley-auth-handler` - Enhanced with `/auth/refresh` endpoint
  - Handler: `auth-handler.lambda_handler`
  - Runtime: Python 3.11
  - Memory: 256MB  
  - Timeout: 30s

#### Updated DynamoDB Schema
- **DynamoDB Tables**:
  - `heatherandwesley-users` - Enhanced with `last_activity` field
  - Primary Key: `username` (String)
  - New Field: `last_activity` (String, ISO timestamp)

#### Enhanced API Gateway Endpoints
- **New Endpoint**: `POST /auth/refresh` → Lambda: `heatherandwesley-auth-handler`
- CORS enabled for refresh endpoint
- Rate limiting: 100 requests per minute per IP

#### IAM Permissions Required
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow", 
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem", 
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:[account]:table/heatherandwesley-users"
      ]
    }
  ]
}
```

#### Environment Variables
- `TABLE_NAME`: `heatherandwesley-users`
- `JWT_SECRET`: `[production-secret-key]`
- `JWT_REFRESH_THRESHOLD`: `0.8` (refresh at 80% token lifetime)

### Deployment Steps

1. **Backend Infrastructure** (if AWS changes):
   ```bash
   # Update auth Lambda function
   make update-auth-lambda
   
   # Test auth endpoints
   make test-auth-endpoints
   
   # Update DynamoDB table schema (add last_activity field)
   # Note: DynamoDB NoSQL allows adding fields without schema migration
   ```

2. **Frontend Deployment**:
   ```bash
   # Build and test locally  
   npm run build
   npm run test
   
   # Deploy to GitHub Pages
   npm run deploy
   ```

3. **Data Migration** (if schema changes):
   ```bash
   # No migration needed - last_activity field added dynamically
   # Existing users will get last_activity on next login/refresh
   ```

### Deployment Verification

**Automated Smoke Tests**:
```bash
# Run E2E smoke tests after deployment
pytest tests/e2e/smoke/test_persistent_auth_smoke.py -v --env=prod

# Test PWA auth persistence  
npx playwright test tests/e2e/playwright/pwa-auth.spec.ts
```

**Manual Verification Commands**:
```bash
# Check Lambda logs for auth refresh
aws logs tail /aws/lambda/heatherandwesley-auth-handler --follow --profile personal --region us-east-1

# Test auth refresh endpoint
curl -X POST https://[api-id].execute-api.us-east-1.amazonaws.com/prod/auth/refresh \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [test-token]" \
  -d '{"token": "[test-token]"}'

# Verify DynamoDB user records include last_activity
aws dynamodb scan --table-name heatherandwesley-users --profile personal --region us-east-1
```

### Rollback Plan
1. **Lambda**: Revert auth-handler to previous version
   ```bash
   aws lambda update-function-code --function-name heatherandwesley-auth-handler \
     --s3-bucket [backup-bucket] --s3-key [previous-version] \
     --profile personal --region us-east-1
   ```

2. **Frontend**: Revert to previous auth implementation
   ```bash
   git revert [commit-hash-range]
   git push origin main
   ```

3. **API Gateway**: Remove refresh endpoint if needed
   ```bash
   aws apigateway delete-resource --rest-api-id [api-id] --resource-id [refresh-resource-id] \
     --profile personal --region us-east-1
   ```

### Production Readiness Checklist
- [ ] All E2E smoke tests passing
- [ ] Auth refresh endpoint properly secured with rate limiting
- [ ] PWA lifecycle event handlers tested across devices
- [ ] Token refresh timing optimized for performance
- [ ] Error handling tested for all failure scenarios  
- [ ] Character-specific auth persistence verified (Wesley/Heather/Puffy)
- [ ] Mobile device compatibility tested (iOS/Android PWA)
- [ ] CloudWatch alarms configured for auth failures
- [ ] JWT secret properly configured in production
- [ ] Session persistence verified across browser restarts
- [ ] Background/foreground PWA transitions working correctly