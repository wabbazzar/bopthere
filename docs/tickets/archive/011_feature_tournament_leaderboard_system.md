# Ticket 011: Tournament Leaderboard System for Wedding Gaming

## Metadata
- **Status**: Not Started
- **Priority**: Medium
- **Effort**: 15 points
- **Created**: 2025-08-02
- **Type**: feature
- **Character Impact**: All

## User Stories

### Primary User Story
As a wedding guest, I want to compete with other guests in tournament games and see my ranking on a leaderboard so that I can enjoy friendly competition during the celebration weekend.

### Secondary User Stories
- As a wedding guest, I want to see the top 10 scores for Tetris so that I can try to beat them
- As a wedding guest, I want my high score to be automatically saved when I achieve a top 10 result so that I can maintain my ranking
- As a wedding guest, I want to see real-time leaderboard updates so that I can track my progress against other guests
- As Wesley or Heather, I want to see all guests enjoying competitive gaming that fits our Epic Wedding Quest theme

## Technical Requirements

### Functional Requirements
1. Leaderboard UI component displaying top 10 scores for tournament games
2. Initially supports Tetris game only, but designed for multiple games
3. Authentication-gated score submission (user must be logged in)
4. Real-time leaderboard updates when scores are submitted
5. Character-specific theming for leaderboard display
6. Mobile-responsive design for primary guest device usage
7. Integration with existing Tetris game component for score capture

### Non-Functional Requirements
1. Performance: Leaderboard queries complete in < 2 seconds
2. Accessibility: WCAG 2.1 AA compliance for leaderboard display
3. Character Theming: Maintain character-specific colors and fonts
4. Mobile-first: Optimized for smartphone usage during wedding events
5. Scalability: Support for multiple tournament games expansion

## Implementation Plan

### Phase 1: DynamoDB Table and Lambda Foundation (5 points)

**Files to create:**
- `aws/lambda/leaderboard-handler.py` - Unified Lambda for all leaderboard operations
- `scripts/deploy-leaderboard-lambda.sh` - Deployment script following project patterns

**DynamoDB Table Schema:**
```bash
aws dynamodb create-table \
  --table-name heatherandwesley-leaderboard \
  --attribute-definitions \
    AttributeName=game,AttributeType=S \
    AttributeName=score_timestamp,AttributeType=S \
  --key-schema \
    AttributeName=game,KeyType=HASH \
    AttributeName=score_timestamp,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=game-score-index,KeySchema=[{AttributeName=game,KeyType=HASH},{AttributeName=score_timestamp,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --billing-mode PAY_PER_REQUEST \
  --profile personal
```

**Field Reference:**
```json
{
  "game": { "type": "string", "description": "Game identifier (e.g., 'tetris')" },
  "score_timestamp": { "type": "string", "description": "Composite key: score#timestamp for sorting" },
  "username": { "type": "string", "description": "Player username from auth system" },
  "score": { "type": "number", "description": "Game score achieved" },
  "timestamp": { "type": "string", "description": "ISO timestamp when score was achieved" },
  "character": { "type": "string", "description": "Character theme user was playing as" }
}
```

**Lambda Function Requirements:**
- Handle GET /leaderboard/{game} - Query top 10 scores
- Handle POST /leaderboard/{game} - Submit new score
- Automatic top 10 maintenance (remove 11th score when adding new)
- JWT token validation using existing auth patterns
- Environment-based CORS configuration

**CORS Configuration:**

*Required Headers:*
```javascript
// Lambda proxy integration response format
{
  "statusCode": 200,
  "headers": {
    "Access-Control-Allow-Origin": "https://heatherandwesley.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400"
  },
  "body": JSON.stringify(responseData)
}
```

*API Gateway CORS Settings:*
- Enable CORS for all methods including OPTIONS
- Configure allowed origins: `https://heatherandwesley.com`, `http://localhost:5173` (dev)
- Allow credentials for JWT authentication
- Set proper preflight response caching

*Implementation Requirements:*
1. **OPTIONS Method Handling**: Lambda must handle preflight requests
2. **Environment-based Origins**: Production vs development origin handling
3. **Error Response CORS**: Ensure error responses include CORS headers
4. **Authentication CORS**: Properly handle CORS with JWT headers

**Implementation steps:**
1. Create DynamoDB table with composite key design
2. Implement Lambda with GET and POST handlers
3. Configure CORS headers in Lambda response format
4. Test CORS configuration from frontend origin
5. Set up JWT token validation using existing auth service patterns
6. Implement top 10 score maintenance logic

**Testing Requirements:**
- Schema validation: Verify field names match exact specifications
- **CORS Testing**: Verify cross-origin requests work from frontend to API
- **Preflight Testing**: Test OPTIONS requests return correct CORS headers
- **Browser Console**: Check for CORS errors in network tab
- JWT authentication flow testing
- Top 10 score boundary testing

**Build Verification:**
```bash
make deploy-leaderboard-lambda
make test-leaderboard
```

**Commit**: `feat(leaderboard): implement DynamoDB table and Lambda foundation`

### Phase 2: API Gateway Integration and Endpoints (4 points)

**Files to create:**
- `scripts/deploy-leaderboard-api.sh` - API Gateway setup script
- `scripts/test-leaderboard-endpoints.sh` - API testing script

**API Gateway Configuration:**
```bash
# Create API Gateway and integrate with Lambda
aws apigateway create-rest-api \
  --name "heatherandwesley-leaderboard-api" \
  --description "Tournament leaderboard API for wedding games" \
  --profile personal
```

**Endpoint Structure:**
```
GET  /leaderboard/{game}     - Get top 10 scores for game
POST /leaderboard/{game}     - Submit score for game (authenticated)
```

**Request/Response Formats:**

GET /leaderboard/tetris:
```json
{
  "statusCode": 200,
  "body": {
    "game": "tetris",
    "scores": [
      {
        "username": "player1",
        "score": 150000,
        "timestamp": "2025-08-02T10:30:00Z",
        "character": "wesley"
      }
    ],
    "total_players": 8
  }
}
```

POST /leaderboard/tetris:
```json
{
  "score": 145000,
  "character": "heather"
}
```

**Implementation steps:**
1. Create API Gateway REST API
2. Configure resource paths for /leaderboard/{game}
3. Set up Lambda proxy integration
4. Configure CORS at API Gateway level
5. Set up authorization using existing JWT patterns
6. Test all endpoints with authentication

**Testing Requirements:**
- **CORS Testing**: Manual and automated cross-origin request testing
- Authentication header validation
- Error response CORS header verification
- Endpoint integration with Lambda function

**Build Verification:**
```bash
make deploy-leaderboard-api
make test-all-endpoints
```

**Commit**: `feat(leaderboard): implement API Gateway endpoints with CORS`

### Phase 3: Frontend Leaderboard Component (3 points)

**Files to create:**
- `src/components/leaderboard/LeaderboardDisplay.tsx` - Main leaderboard component
- `src/components/leaderboard/ScoreSubmission.tsx` - Score submission logic
- `src/types/leaderboard.ts` - TypeScript interfaces

**Component Structure:**
```typescript
interface LeaderboardDisplayProps {
  game: string;
  character: Character;
  theme: CharacterTheme;
}

interface LeaderboardScore {
  username: string;
  score: number;
  timestamp: string;
  character: Character;
}

export function LeaderboardDisplay({ game, character, theme }: LeaderboardDisplayProps) {
  const { user } = useAuth();
  // Implementation following existing patterns
}
```

**Character-Specific Content:**
- Wesley: "Epic Quest Rankings", "Legendary Champions", heroic language
- Heather: "Elegant Competition Board", "Distinguished Players", refined language
- Puffy: "Super Fun High Scores!", "Amazing Players", playful language

**Design Requirements:**
- Card-based layout following existing shadcn/ui patterns
- Character theme colors for headers and accents
- Mobile-first responsive design
- Real-time updates using React Query
- Integration with existing toast notification system

**Implementation steps:**
1. Create TypeScript interfaces for leaderboard data
2. Build LeaderboardDisplay component with character theming
3. Implement API calls using existing fetch patterns
4. Add real-time polling for score updates
5. Integrate with existing character context and theming

**Files to modify:**
- `src/components/festival/TetrisGame.tsx` - Add leaderboard display integration
- `src/components/festival/TetrisPage.tsx` - Add score submission on game completion

**Testing Requirements:**
- Test across all three character perspectives
- Mobile responsive design validation
- API integration testing with authentication
- Real-time update functionality

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(leaderboard): implement frontend display component with character theming`

### Phase 4: Tetris Game Score Integration (3 points)

**Files to modify:**
- `src/components/festival/TetrisGame.tsx` - Add score capture and submission
- `src/components/festival/TetrisPage.tsx` - Add leaderboard display and score submission

**Score Capture Integration:**
```typescript
// Listen for Tetris game completion messages
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.source === iframeRef.current?.contentWindow) {
      if (event.data.type === 'TETRIS_GAME_COMPLETE') {
        handleScoreSubmission(event.data.score);
      }
    }
  };
  
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [character]);
```

**Score Submission Flow:**
1. Game completion triggers score capture
2. Check if user is authenticated
3. Validate score is in top 10 range via API call
4. Submit score with character context
5. Show success/failure feedback using existing toast system
6. Update leaderboard display in real-time

**Implementation steps:**
1. Add postMessage listener for game completion events
2. Implement score validation and submission logic
3. Add leaderboard display to TetrisGame component
4. Handle authentication requirements for score submission
5. Add character-specific success/failure messages

**Testing Requirements:**
- Test score capture from Tetris iframe
- Authentication flow validation
- Character theme consistency
- Error handling for network failures

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(leaderboard): integrate score capture and submission with Tetris game`

## Testing Strategy

### Character Perspective Tests
- Test leaderboard display as Wesley (adventure theme)
- Test leaderboard display as Heather (elegant theme)
- Test leaderboard display as Puffy (playful theme)
- Verify character-specific content and theming
- Test score submission with each character context

### Responsive Design Tests
- Mobile: iPhone/Android (375px - 768px)
- Tablet: iPad (768px - 1024px)
- Desktop: (1024px+)
- Test leaderboard scrolling on small screens
- Verify touch interactions for score submission

### Integration Tests
- End-to-end score submission flow
- Real-time leaderboard updates
- Authentication integration with existing auth system
- API Gateway → Lambda → DynamoDB data flow
- CORS functionality across all endpoints

### CORS Testing Requirements

*Manual Testing Checklist:*
- [ ] Frontend can make successful requests to leaderboard API
- [ ] Preflight OPTIONS requests return correct CORS headers
- [ ] Error responses include proper CORS headers
- [ ] Both development (localhost:5173) and production origins work
- [ ] Browser network tab shows no CORS errors
- [ ] JWT authentication headers work with CORS

*Automated Testing:*
```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: https://heatherandwesley.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  https://api.heatherandwesley.com/leaderboard/tetris

# Expected response headers:
# Access-Control-Allow-Origin: https://heatherandwesley.com
# Access-Control-Allow-Methods: GET, POST, OPTIONS
# Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
```

*Browser Console Testing:*
```javascript
// Test from browser console on heatherandwesley.com
fetch('https://api.heatherandwesley.com/leaderboard/tetris', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  }
})
.then(response => console.log('CORS working:', response))
.catch(error => console.error('CORS error:', error));
```

### AWS E2E Smoke Tests
**Mandatory E2E smoke tests to verify Gateway → Lambda → DynamoDB flow:**
```bash
# Location: tests/e2e/smoke/test_leaderboard_smoke.py
# Run: make test-e2e-smoke
# Or specific: cd tests/e2e/smoke && pytest test_leaderboard_smoke.py -v
```

**Testing with specialized agents:**
1. Run: `claude --agent test-writer "Write comprehensive tests for leaderboard system including exact field validation"`
2. Run: `claude --agent test-critic "Review leaderboard tests for CORS, authentication, and character integration"`
3. Run: `claude --agent test-writer "Implement critic's suggestions for leaderboard testing"`
4. **For API endpoints**: Run: `claude --agent test-writer "Write CORS integration tests for leaderboard API including preflight and error scenarios"`

## Documentation Updates Required

### Core Documentation
- [ ] `README.md` - Add leaderboard system overview and API endpoints
- [ ] `docs/aws-setup.md` - Document leaderboard table creation and Lambda deployment

### Technical Documentation
- [ ] Document leaderboard component usage patterns
- [ ] Add API endpoint documentation with CORS configuration
- [ ] Document DynamoDB table schema and indexing strategy

### Deployment Documentation
- [ ] Update Makefile targets for leaderboard deployment
- [ ] Document environment variables for Lambda configuration
- [ ] Add IAM permissions documentation for leaderboard access

## Success Criteria

### Functional Acceptance Criteria
- [ ] Top 10 leaderboard displays correctly for Tetris game
- [ ] Score submission works only for authenticated users
- [ ] Leaderboard automatically maintains top 10 scores (removes 11th)
- [ ] Real-time updates show new scores within 5 seconds
- [ ] Character theming applied correctly across all three perspectives
- [ ] Mobile-responsive design works on wedding guest devices

### Performance Criteria
- [ ] Leaderboard queries complete in < 2 seconds
- [ ] Score submission completes in < 3 seconds
- [ ] No CORS errors in browser console
- [ ] Page load performance maintained < 3s

### Quality Criteria
- [ ] All existing Tetris functionality continues to work
- [ ] Authentication integration seamless with existing auth system
- [ ] Code follows existing TypeScript/React patterns
- [ ] AWS deployment follows project CLI and Makefile patterns
- [ ] Character system integration maintains theme consistency

## Dependencies

### Technical Dependencies
- Existing AWS authentication system (Lambda and DynamoDB)
- Tetris game component for score capture integration
- Character context system for theming
- React Query for API state management

### Character System Dependencies
- Character theme consistency across leaderboard displays
- Character-specific content variations for leaderboard text
- Integration with existing character background/theming patterns

### AWS Infrastructure Dependencies
- AWS CLI deployment patterns (no Terraform/OpenTofu)
- Existing API Gateway configuration patterns
- DynamoDB table creation and management via CLI
- Lambda deployment using --profile personal

## Risks & Mitigations

### Technical Risks
**Risk**: CORS configuration conflicts between API Gateway and Lambda
**Impact**: HIGH
**Mitigation**: Implement comprehensive CORS testing and environment-based origin handling in Lambda functions

**Risk**: DynamoDB query performance with growing leaderboard data
**Impact**: MEDIUM
**Mitigation**: Use composite key design and GSI for efficient top 10 queries, implement pagination if needed

**Risk**: Real-time updates causing excessive API calls
**Impact**: MEDIUM
**Mitigation**: Implement smart polling intervals and only update when scores change

### Character System Risks
**Risk**: Leaderboard theming conflicts with existing character system
**Impact**: MEDIUM
**Mitigation**: Thorough testing across all character perspectives and follow existing theming patterns

**Risk**: Content variations inappropriate for wedding celebration context
**Impact**: LOW
**Mitigation**: Ensure all character-specific text maintains Epic Wedding Quest theme and celebration focus

### User Experience Risks
**Risk**: Authentication friction preventing score submission
**Impact**: MEDIUM
**Mitigation**: Clear user feedback and integration with existing smooth auth flow

**Risk**: Mobile performance degradation with real-time updates
**Impact**: MEDIUM
**Mitigation**: Optimize API calls, implement efficient caching, test on actual mobile devices

### AWS Integration Risks
**Risk**: Lambda deployment complexity with existing infrastructure
**Impact**: MEDIUM
**Mitigation**: Follow established Makefile deployment patterns and test thoroughly in staging

**Risk**: JWT token validation consistency with existing auth system
**Impact**: HIGH
**Mitigation**: Use exact same JWT validation patterns as existing Lambda functions