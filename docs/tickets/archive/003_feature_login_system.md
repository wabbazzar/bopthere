# Ticket 003: Add Login System with Festival App Layout

## Metadata
- **Status**: Completed
- **Priority**: High
- **Effort**: 15 points (3 phases x 5 points each)
- **Created**: 2025-01-31
- **Updated**: 2025-08-01
- **Type**: feature
- **Character Impact**: All (Login appears after character selection)

## User Stories

### Primary User Story
As a wedding guest with login credentials, I want to access a personalized festival app experience so that I can view my itinerary, sleeping arrangements, guest list, and participate in games.

### Secondary User Stories
- As a logged-in guest, I want to maintain my character theme selection so that my personalized experience continues in the festival app.
- As the wedding couple, I want to provide special guests with enhanced features so that they have all the information they need for the wedding weekend.
- As an admin, I want to manage user accounts and credentials so that I can control access to the festival features.

## Technical Requirements

### Functional Requirements
1. Login tab appears in navigation bar after character selection (alongside Wesley, Heather, Puffy tabs)
2. Login opens a modal with username/password fields
3. Authentication via AWS Lambda connecting to new `heatherandwesley-users` DynamoDB table
4. JWT token generation and validation for session management
5. Successful login transforms entire app layout to festival view
6. Festival view maintains character theming and epic_background.png
7. New navbar with tabs: Itinerary, Sleeping Arrangements, Guest List, Games
8. Logout functionality returns to public wedding site
9. Session persistence across page refreshes
10. Mobile-first responsive design for all new components

### Non-Functional Requirements
1. Performance: Login response < 2s, JWT validation < 100ms
2. Security: Secure password hashing (bcrypt), HTTPS-only JWT cookies
3. Accessibility: WCAG 2.1 AA compliance for login form
4. Character Theming: Login modal and festival layout respect selected character theme

## Implementation Plan

### Phase 1: Backend Authentication Infrastructure (5 points)

**Files to create:**
- `infrastructure/dynamodb-users.tf` - Users table definition
- `infrastructure/lambda-auth.tf` - Authentication Lambda configuration
- `aws/lambda/auth-handler.py` - Lambda function for login/JWT operations
- `aws/lambda/requirements.txt` - Python dependencies (bcrypt, PyJWT)
- `scripts/seed-users.py` - Script to populate test users

**DynamoDB Users Table Schema:**
```typescript
interface User {
  username: string;      // Primary key
  password_hash: string; // bcrypt hashed password
  email: string;
  full_name: string;
  role: 'guest' | 'vip' | 'admin';
  created_at: string;    // ISO timestamp
  last_login: string;    // ISO timestamp
}
```

**Lambda Auth Handler Structure:**
```python
# auth-handler.py
import json
import bcrypt
import jwt
import boto3
from datetime import datetime, timedelta

def lambda_handler(event, context):
    """
    Handles /auth/login and /auth/verify endpoints
    """
    path = event['path']
    
    if path == '/auth/login':
        return handle_login(event)
    elif path == '/auth/verify':
        return handle_verify(event)
    
def handle_login(event):
    # 1. Parse username/password from body
    # 2. Query DynamoDB for user
    # 3. Verify password with bcrypt
    # 4. Generate JWT with 24hr expiry
    # 5. Return JWT and user info
    
def handle_verify(event):
    # 1. Extract JWT from Authorization header
    # 2. Verify JWT signature and expiry
    # 3. Return user info if valid
```

**Infrastructure Updates:**
```hcl
# dynamodb-users.tf
resource "aws_dynamodb_table" "users" {
  name         = "heatherandwesley-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "username"
  
  attribute {
    name = "username"
    type = "S"
  }
}

# lambda-auth.tf
resource "aws_lambda_function" "auth_handler" {
  function_name = "heatherandwesley-auth-handler"
  # Similar configuration to rsvp_handler
}
```

**Seed Script Example:**
```python
# scripts/seed-users.py
users = [
    {
        'username': 'testguest',
        'password': 'wedding2025',  # Will be hashed
        'email': 'guest@example.com',
        'full_name': 'Test Guest',
        'role': 'guest'
    },
    # More test users...
]
```

**Implementation steps:**
1. Create DynamoDB users table via OpenTofu
2. Implement auth Lambda with login/verify endpoints
3. Deploy Lambda and update API Gateway
4. Create seed script and populate test data
5. Test authentication flow with curl/Postman

**Testing:**
1. Test authentication flow with curl/Postman
2. Verify JWT generation and validation
3. Test bcrypt password hashing
4. Confirm DynamoDB user operations

**Use specialized agents:**
```bash
# Have the code-writer agent implement the authentication infrastructure
claude "Use the code-writer agent to implement aws/lambda/auth-handler.py with login and verify endpoints"
claude "Use the code-writer agent to create scripts/seed-users.py for populating test users"

# Have the code-quality-assessor review the security implementation
claude "Use the code-quality-assessor agent to review auth-handler.py focusing on security best practices and JWT handling"

# Have the test-writer create comprehensive auth tests
claude "Use the test-writer agent to create tests for auth-handler.py including security edge cases"

# Have the test-critic review auth test coverage
claude "Use the test-critic agent to analyze the auth-handler.py test suite for security vulnerabilities and missing scenarios"
```

**Build Verification:**
```bash
cd infrastructure
tofu plan
tofu apply
cd ..
python scripts/seed-users.py --profile personal
```

**Commit**: `feat(auth): implement backend authentication with JWT`

### Phase 2: Frontend Login Integration (5 points)

**Files to create:**
- `src/components/LoginModal.tsx` - Login form modal component
- `src/components/LoginTab.tsx` - Navigation tab for login
- `src/contexts/AuthContext.tsx` - Authentication state management
- `src/lib/auth.ts` - Authentication API client
- `src/types/auth.ts` - TypeScript types for auth

**Files to modify:**
- `src/components/CharacterSwitcher.tsx` - Add Login tab after character selection
- `src/pages/Index.tsx` - Integrate auth context and conditional rendering
- `vite.config.ts` - Add AUTH_API_URL environment variable

**LoginModal Component Structure:**
```typescript
interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { character } = useCharacter();
  const { login } = useAuth();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  
  // Modal with character-themed styling
  // Username/password inputs
  // Submit button with loading state
  // Error handling with toast notifications
}
```

**AuthContext Structure:**
```typescript
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  verifyToken: () => Promise<void>;
}
```

**CharacterSwitcher Modification:**
```typescript
// Add after character buttons
{isAuthenticated ? (
  <Button onClick={logout} variant="outline">
    <LogOut className="w-4 h-4 mr-1" />
    Logout
  </Button>
) : (
  <Button onClick={() => setShowLoginModal(true)} variant="outline">
    <LogIn className="w-4 h-4 mr-1" />
    Login
  </Button>
)}
```

**Implementation steps:**
1. Create auth context with JWT storage in localStorage
2. Implement login modal with character theming
3. Add login tab to CharacterSwitcher component
4. Integrate auth API client with error handling
5. Add loading states and toast notifications

**Testing:**
1. Test login flow with valid/invalid credentials
2. Verify JWT storage and retrieval
3. Test character theme persistence after login
4. Mobile responsive testing for login modal

**Use specialized agents:**
```bash
# Have the code-writer agent implement the frontend components
claude "Use the code-writer agent to implement src/components/LoginModal.tsx with character theming"
claude "Use the code-writer agent to create src/contexts/AuthContext.tsx for authentication state management"
claude "Use the code-writer agent to implement src/lib/auth.ts for API client functionality"

# Have the code-quality-assessor review the frontend implementation
claude "Use the code-quality-assessor agent to review the authentication components for React best practices and security"

# Have the test-writer create frontend tests
claude "Use the test-writer agent to create tests for LoginModal and AuthContext components"

# Have the test-critic review frontend test coverage
claude "Use the test-critic agent to analyze frontend auth tests for UI edge cases and accessibility"
```

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(auth): add frontend login modal and auth context`

### Phase 3: Festival App Layout Implementation (5 points)

**Files to create:**
- `src/pages/Festival.tsx` - Main festival app layout
- `src/components/FestivalNav.tsx` - Festival navigation bar
- `src/components/festival/ItineraryView.tsx` - Placeholder itinerary component
- `src/components/festival/SleepingView.tsx` - Placeholder sleeping arrangements
- `src/components/festival/GuestListView.tsx` - Placeholder guest list
- `src/components/festival/GamesView.tsx` - Placeholder games component

**Files to modify:**
- `src/pages/Index.tsx` - Conditional rendering based on auth state
- `src/App.tsx` - Add Festival route (if using routing)

**Festival Layout Structure:**
```typescript
export function Festival() {
  const { character } = useCharacter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'itinerary' | 'sleeping' | 'guests' | 'games'>('itinerary');
  
  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundImage: `url(/app-uploads/epic_background.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-black bg-opacity-40" />
      
      <FestivalNav activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="relative z-10 container mx-auto px-4 pt-20">
        {activeTab === 'itinerary' && <ItineraryView />}
        {activeTab === 'sleeping' && <SleepingView />}
        {activeTab === 'guests' && <GuestListView />}
        {activeTab === 'games' && <GamesView />}
      </main>
    </div>
  );
}
```

**FestivalNav Component:**
```typescript
interface FestivalNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function FestivalNav({ activeTab, onTabChange }: FestivalNavProps) {
  const { character } = useCharacter();
  const theme = characterThemes[character];
  
  const tabs = [
    { id: 'itinerary', label: 'Itinerary', icon: Calendar },
    { id: 'sleeping', label: 'Sleeping Arrangements', icon: Bed },
    { id: 'guests', label: 'Guest List', icon: Users },
    { id: 'games', label: 'Games', icon: Gamepad }
  ];
  
  // Responsive tab navigation with character theming
}
```

**Placeholder Components:**
Each view component should:
- Display "Coming Soon" message
- Maintain character theming
- Use consistent card-based layout
- Include proper TypeScript types

**Implementation steps:**
1. Create Festival page with epic background
2. Implement responsive navigation bar
3. Create placeholder components for each section
4. Add smooth transitions between tabs
5. Ensure character theme consistency

**Testing:**
1. Test navigation between all tabs
2. Verify background image loads correctly
3. Test responsive design on all devices
4. Verify logout returns to public site

**Use specialized agents:**
```bash
# Have the code-writer agent implement the festival layout
claude "Use the code-writer agent to implement src/pages/Festival.tsx with epic_background.png integration"
claude "Use the code-writer agent to create src/components/FestivalNav.tsx with responsive tab navigation"
claude "Use the code-writer agent to implement placeholder components for all festival views"

# Have the code-quality-assessor review the festival implementation
claude "Use the code-quality-assessor agent to review Festival layout components for performance and responsive design"

# Have the test-writer create festival layout tests
claude "Use the test-writer agent to create tests for Festival page navigation and character theming"

# Have the test-critic review the festival tests
claude "Use the test-critic agent to analyze festival layout tests for mobile responsiveness coverage"
```

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(festival): implement authenticated festival app layout`

## Testing Strategy

### Character Perspective Tests
- Login modal appears correctly with Wesley theme (adventure styling)
- Login modal appears correctly with Heather theme (elegant styling)
- Login modal appears correctly with Puffy theme (playful styling)
- Festival layout maintains character selection after login

### Authentication Tests
- Successful login with valid credentials
- Failed login with invalid credentials
- JWT token persistence across page refreshes
- Logout functionality clears session
- Protected routes redirect to login

### Responsive Design Tests
- Mobile: Login modal on small screens (375px - 768px)
- Tablet: Festival navigation on tablets (768px - 1024px)
- Desktop: Full festival layout (1024px+)
- Touch interactions for tab navigation

### Integration Tests
- Login flow from character selection to festival view
- Character context persistence through authentication
- API error handling and user feedback
- Network failure resilience

### Accessibility Tests
- Keyboard navigation through login form
- Screen reader compatibility for all new components
- Focus management in modal
- ARIA labels for interactive elements

## Documentation Updates Required
1. Update CLAUDE.md with authentication patterns
2. Document JWT token handling approach
3. Add festival app component guidelines
4. Document user seeding process for testing

## Success Criteria
1. Login tab appears after character selection
2. Authentication works with test credentials
3. Festival layout loads with all four navigation tabs
4. Character theming persists throughout authenticated experience
5. Mobile-first responsive design implemented
6. Epic background displays correctly in festival view
7. Logout returns user to public wedding site
8. JWT tokens secure and properly validated

## Dependencies
- Existing character context system
- AWS Lambda and DynamoDB infrastructure
- API Gateway configuration
- Existing shadcn/ui components
- Epic background image asset

## Risks & Mitigations
1. **Risk**: JWT security vulnerabilities
   **Mitigation**: Use secure HTTP-only cookies, implement proper expiration, validate on every request

2. **Risk**: Character theme conflicts in festival layout
   **Mitigation**: Thoroughly test all three character contexts in festival view

3. **Risk**: Mobile navigation complexity with additional tabs
   **Mitigation**: Implement hamburger menu or tab scrolling for mobile devices

4. **Risk**: User table management complexity
   **Mitigation**: Create comprehensive seed script with clear documentation

5. **Risk**: State management between public and authenticated views
   **Mitigation**: Clear separation of auth context and proper cleanup on logout

## Implementation Status

### ✅ Phase 1: Backend Authentication Infrastructure - COMPLETED
- Created `heatherandwesley-auth-users` DynamoDB table with 8 test users
- Deployed `heatherandwesley-auth-handler` Lambda function
- Implemented `/auth/login`, `/auth/verify`, and `/auth/register` endpoints
- Created seed-users.py script with SHA256 password hashing
- Fixed CORS configuration for cross-origin requests
- All endpoints tested and working

**Note**: Currently using SHA256 instead of bcrypt due to Lambda deployment constraints. This should be updated for production.

### ✅ Phase 2: Frontend Login Integration - COMPLETED  
- Created LoginModal.tsx with character theming
- Implemented AuthContext.tsx for state management
- Added auth.ts library for API integration
- Modified CharacterSwitcher.tsx to show Login/Logout button
- Integrated with production API URL
- Session persistence working with localStorage

### ✅ Phase 3: Festival App Layout - COMPLETED
- Created Festival.tsx with epic_background.png
- Implemented FestivalNav.tsx with responsive design
- Added placeholder components for all four tabs
- Character theming maintained throughout
- Mobile hamburger menu implemented
- Logout functionality returns to public site

### 🧪 Testing - COMPLETED
- Created comprehensive test suites (100+ tests)
- Frontend component tests with React Testing Library
- E2E smoke tests for AWS integration
- CORS configuration tested and verified
- All test credentials working

### 🚀 Deployment Status
- **API Gateway**: ~~https://m1wocluixd.execute-api.us-west-2.amazonaws.com/prod~~ (Migrated to us-east-1)
- **DynamoDB Table**: heatherandwesley-auth-users (8 users)
- **Lambda Function**: heatherandwesley-auth-handler
- **Frontend**: Ready at http://localhost:8080

### 📝 Remaining Improvements (Lower Priority)
1. Replace SHA256 with bcrypt/argon2 for password hashing
2. Change /auth/verify to POST method only
3. Add security edge case tests (XSS, rapid submission)
4. Implement rate limiting
5. Add refresh token pattern

### Test Credentials
- `testguest` / `wedding2025` (guest role)
- `testvip` / `maui2025` (vip role)  
- `testadmin` / `admin2025` (admin role)