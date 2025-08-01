# Wedding App Ticket Generation Rules

## Overview

This document provides standardized rules for generating comprehensive tickets for Wesley & Heather's wedding app. A "fresh" Claude instance should be able to read this document and generate a properly structured ticket from any bug report or feature request.

## Mandatory Reading Before Ticket Generation

**CRITICAL**: Before generating any ticket, Claude MUST read these core documents:

**NEW REQUIREMENT**: For any ticket involving AWS/backend integration, you MUST include exact field definitions from `.wedding/context/` files in EACH phase of the implementation plan. This eliminates guesswork and ensures code-writer and test-writer agents have the exact field information they need.

**CORS REQUIREMENT**: For any ticket involving API endpoints, you MUST include comprehensive CORS configuration sections. This applies to:
- API Gateway endpoints
- Lambda functions serving HTTP requests  
- Frontend features making cross-origin requests
- Authentication/authorization endpoints
- Any integration between frontend (heatherandwesley.com) and backend APIs

### Required Context Files:
1. **`README.md`** - Project overview and technology stack
2. **`package.json`** - Dependencies and available scripts  
3. **Core application files** - Main app structure and components
4. **Documentation files** in `/docs/` - Existing project requirements and TODOs

### Implementation Files to Review:
- **`src/App.tsx`** - Main application routing and providers
- **`src/pages/Index.tsx`** - Main page component with character system
- **`src/components/HeroSection.tsx`** - Hero section with character themes
- **`src/components/RSVPSection.tsx`** - Multi-step RSVP form system
- **`src/components/CharacterSelector.tsx`** - Character selection interface
- **`src/contexts/CharacterContext.tsx`** - Character state management
- **`src/types/character.ts`** - Character type definitions and themes
- **`index.html`** - Base HTML template and meta tags

### Additional Context (as needed):
- **`docs/RSVP_CHARACTER_BACKGROUNDS_TODO.md`** - RSVP system requirements and progress
- **`docs/wedding_bingo_cards.md`** - Bingo card feature requirements
- **Existing ticket files** in `docs/tickets/` for patterns and precedents

## Ticket File Location

**IMPORTANT**: All new tickets MUST be saved to `docs/tickets/backlog/` directory, regardless of their status. This ensures proper organization and tracking of all work items.

### File Naming Convention:
- Format: `XXX_[type]_[short_description].md`
- Types: feature, bug, refactor, chore, docs
- Example: `045_feature_photo_gallery.md`

### Directory Requirements:
1. Always ensure the `docs/tickets/backlog/` directory exists before writing
2. Save ALL new tickets to the backlog directory  
3. Use the next available ticket number:
   - Scan both `docs/tickets/backlog/` and `docs/tickets/archive/` directories
   - Find the highest XXX number across all tickets
   - Increment by 1 for the new ticket
   - Example: If highest is 003, new ticket should be 004

## Wedding App Context

### App Purpose
This is a wedding website for Wesley & Heather's "Epic Wedding Quest" taking place December 5-9, 2025 in Maui, Hawaii. The app features:

- **Character-based experience**: Users choose between Wesley (adventure theme), Heather (romantic theme), or Puffy (playful theme)
- **Multi-step RSVP system**: 4-step form with character-specific backgrounds
- **Fantasy/RPG theming**: Epic quest narrative with fantasy fonts and styling
- **Modern tech stack**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui components
- **Supabase integration**: Database for RSVP storage
- **Responsive design**: Mobile-first approach

### Character System
The app centers around three character perspectives:
- **Wesley**: Adventure/quest theme with purple/gold colors
- **Heather**: Romantic/elegant theme with pink/rose colors  
- **Puffy**: Playful/fun theme with blue/teal colors

Each character has unique:
- Content variations (titles, descriptions, call-to-actions)
- Background images for hero and RSVP sections
- Color themes and styling
- Voice/personality in text

### Key Features
1. **Character Selection**: Initial modal to choose viewing perspective
2. **Hero Section**: Character-specific background with wedding details
3. **Wedding Details**: Information about the celebration
4. **RSVP System**: Multi-step form (initial � diet � song � message � complete)
5. **Responsive Design**: Works across mobile, tablet, desktop

## Standard Ticket Structure

Every ticket must follow this exact structure:

**Top of every ticket**  
INSTRUCTIONS FOR CLAUDE:
- Save this ticket to `docs/tickets/backlog/XXX_[type]_[description].md`
- Ensure the backlog directory exists before writing
- Completed steps marked as [COMPLETE] in Headers
- Commit with standard messaging between each phase

### Header Section
```markdown
# Ticket #XXX: [Descriptive Title]

**Status**: PENDING
**Priority**: [HIGH/MEDIUM/LOW] - [Brief rationale]
**Estimated Effort**: [X points] - [Complexity description]
**Created**: [YYYY-MM-DD]

## Overview
[1-2 sentence summary of the ticket's purpose and value]
```

### User Stories Section
```markdown
## User Stories

### Primary User Story
As a [user role], I want [goal/functionality] so that [business value/benefit].

### Secondary User Stories (if applicable)
- As a [role], I want [goal] so that [benefit]
- As a [role], I want [goal] so that [benefit]
```

### Technical Requirements Section
```markdown
## Technical Requirements

### Functional Requirements
- [Specific functionality requirement 1]
- [Specific functionality requirement 2]
- [Character system integration requirement]
- [Responsive design requirement]

### Non-Functional Requirements
- Performance: [specific targets]
- Compatibility: [browser/device requirements]
- Character theming: [theme consistency requirements]
- User experience: [accessibility/usability standards]
```

### Implementation Plan Section
```markdown
## Implementation Plan

### Phase 1: [Phase Name] ([X points])
**Deliverables:**
- [Specific deliverable 1]
- [Specific deliverable 2]

**Field Reference (if AWS/backend integration):**
From `.wedding/context/dynamodb-schemas.json`:
```json
{
  "field_name": { "type": "string", "description": "exact description from schema" },
  "another_field": { "type": "boolean", "description": "exact description from schema" }
}
```

From `.wedding/context/api-endpoints.md`:
```
POST /endpoint
Request: { exact request format from api-endpoints.md }
Response: { exact response format from api-endpoints.md }
```

**CORS Configuration (if API endpoints involved):**

*Required Headers:*
```javascript
// Lambda proxy integration response format
{
  "statusCode": 200,
  "headers": {
    "Access-Control-Allow-Origin": "https://heatherandwesley.com",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400"
  },
  "body": JSON.stringify(responseData)
}
```

*API Gateway CORS Settings:*
- Enable CORS for all methods including OPTIONS
- Configure allowed origins: `https://heatherandwesley.com`, `http://localhost:5173` (dev)
- Allow credentials if authentication is required
- Set proper preflight response caching

*Implementation Requirements:*
1. **OPTIONS Method Handling**: Every Lambda must handle preflight requests
2. **Environment-based Origins**: Production vs development origin handling
3. **Error Response CORS**: Ensure error responses include CORS headers
4. **Authentication CORS**: Properly handle CORS with JWT/auth headers

**Implementation steps:**
1. Use ONLY the field names listed above (if applicable)
2. Validate against schemas before implementation
3. Configure CORS headers in Lambda response format (if API integration)
4. Test CORS configuration from frontend origin
5. [Other specific implementation steps]

**Files to Modify:**
- `src/path/to/file.tsx` - [What changes]
- `src/path/to/file.css` - [What changes]
- `aws/lambda/[function-name].py` - [CORS header configuration if Lambda integration]

**Files to Create:**
- `src/path/to/new-file.tsx` - [Purpose and contents]
- `aws/lambda/[function-name].py` - [Lambda function with CORS support if new API]

**Testing Requirements:**
- [Specific test cases]
- [Browser/device testing needed]
- [Character system testing]
- Schema validation: Verify all field names match `.wedding/context/` schemas
- **CORS Testing**: Verify cross-origin requests work from frontend to API
- **Preflight Testing**: Test OPTIONS requests return correct CORS headers
- **Browser Console**: Check for CORS errors in network tab

### Phase 2: [Phase Name] ([X points])
[Same structure as Phase 1, including Field Reference and CORS Configuration sections if AWS integration]

### Phase 3: [Phase Name] ([X points])
[Same structure as Phase 1, including Field Reference and CORS Configuration sections if AWS integration]
```

### Documentation Updates Section
```markdown
## Documentation Updates Required

### Core Documentation
- [ ] `README.md` - [What sections need updates]
- [ ] `docs/RSVP_CHARACTER_BACKGROUNDS_TODO.md` - [If RSVP system changes]

### Technical Documentation
- [ ] Component documentation - [If new components added]
- [ ] Character system documentation - [If character features change]

### User Documentation
- [ ] Update feature descriptions if new functionality added
- [ ] Update deployment/development instructions if needed
```

### Success Criteria Section
```markdown
## Success Criteria

### Functional Acceptance Criteria
- [ ] [Specific measurable outcome 1]
- [ ] [Specific measurable outcome 2]
- [ ] [Character system integration working correctly]
- [ ] [Responsive design working on mobile and desktop]

### Performance Criteria
- [ ] [Performance benchmark, e.g., "<200ms response time"]
- [ ] [Specific metrics if applicable]

### Quality Criteria
- [ ] All existing functionality continues to work
- [ ] New functionality integrates seamlessly with character system
- [ ] Code follows existing TypeScript/React patterns
- [ ] Mobile responsiveness maintained across all screen sizes
```

### Dependencies Section
```markdown
## Dependencies

### Technical Dependencies
- [React/TypeScript requirements]
- [shadcn/ui component requirements]
- [Supabase integration requirements]

### Character System Dependencies
- [Character theme consistency requirements]
- [Background image requirements]
- [Content variation requirements]

### Development Dependencies
- [Order of implementation requirements]
- [Other tickets that must be completed first]
```

### Risks & Mitigations Section
```markdown
## Risks & Mitigations

### Technical Risks
**Risk**: [Specific technical risk]
**Impact**: [HIGH/MEDIUM/LOW]
**Mitigation**: [Specific countermeasure]

### Character System Risks
**Risk**: [Theme consistency or character experience risk]
**Impact**: [HIGH/MEDIUM/LOW]  
**Mitigation**: [Testing/validation strategy]

### User Experience Risks
**Risk**: [UX degradation risk]
**Impact**: [HIGH/MEDIUM/LOW]
**Mitigation**: [Testing/fallback strategy]
```

## Ticket Generation Guidelines

### 1. Effort Estimation (Points System)

**Point Scale:**
- **1-2 points**: Simple UI tweaks, text changes, minor bug fixes
- **3-5 points**: Component modifications, new features, styling updates
- **6-8 points**: New components, character system changes, database updates
- **9+ points**: Major architectural changes, new systems, high-risk items

**Never use time estimates** (days, weeks, hours). Always use points with complexity descriptions.

### 2. Phase Breakdown Rules

**Phase Guidelines:**
- Each phase should deliver working, testable functionality
- No phase should exceed 5 points without being broken down further
- Each phase should have clear dependencies on previous phases
- Include testing and validation in every phase

**Phase Examples:**
- Phase 1: Component structure and basic functionality
- Phase 2: Character system integration and theming  
- Phase 3: Responsive design and testing

**Example Phase with AWS Integration:**
```markdown
### Phase 2: Backend Integration (3 points)

**Field Reference:**
From `.wedding/context/dynamodb-schemas.json`:
```json
{
  "name": { "type": "string", "description": "Full name of the guest" },
  "email": { "type": "string", "description": "Email address of the guest" },
  "attendance": { "type": "string", "description": "Guest's attendance status (e.g., 'attending', 'not_attending', 'maybe')" },
  "dietary_restrictions": { "type": "string", "description": "Any dietary restrictions or allergies" },
  "notifications": { "type": "boolean", "description": "Whether the guest opted in for notifications" }
}
```

From `.wedding/context/api-endpoints.md`:
```
POST /rsvp
Request: {
  "name": "string (required)",
  "email": "string (required)", 
  "attendance": "yes|no (required)",
  "dietary_restrictions": "string (optional)",
  "notifications": "boolean (optional)"
}
```

**Implementation steps:**
1. Update RSVPForm.tsx to use ONLY the field names above
2. Map form fields to exact API field names (not camelCase)
3. Validate `attendance` is "yes" or "no" string, not boolean
4. Ensure all required fields are included in request
```

### 3. File Reference Standards

**Always Include:**
- **Absolute paths** from project root: `src/components/HeroSection.tsx`, not just `HeroSection.tsx`
- **Specific functions/components** to modify: "Update HeroSection component's character background logic"
- **New file purposes**: Clear description of what each new file contains
- **Directory structure** for new components following existing patterns

### 4. Wedding App Specific Requirements

**Character System Integration:**
- All new features must work across all three character perspectives
- Maintain character-specific theming (colors, fonts, content)
- Ensure content variations are appropriate for each character's voice
- Consider character-specific background images if applicable

**Content Guidelines:**
- Wesley: Adventure/quest language, heroic tone
- Heather: Elegant/romantic language, warm tone  
- Puffy: Playful/casual language, fun tone

**Technical Standards:**
- Use TypeScript with proper typing
- Follow existing shadcn/ui patterns
- Maintain responsive design across all viewports
- Integrate with existing Supabase setup when data is involved

### 5. Clarifying Questions Protocol

**When Requirements are Unclear:**
Claude should ask **ONE clarifying question at a time** to ensure accurate ticket generation.

**Example Questions:**
- "Should this feature work differently for each character or be consistent across all three?"
- "Should this integrate with the existing RSVP system or be a separate feature?"
- "Should this work offline or require internet connectivity?"
- "Is this intended for the wedding guests, the couple, or both?"

**Question Strategy:**
- Ask the most critical architectural question first
- Focus on questions that significantly impact implementation approach
- Consider character system integration early
- Avoid asking about minor UI details that can be determined during implementation

### 6. Data Integration Requirements

**Mandatory for Data-Related Tickets:**
- Include exact field definitions from `.wedding/context/` in EACH phase
- Copy field names and types EXACTLY from `dynamodb-schemas.json`
- Include request/response formats from `api-endpoints.md`
- Reference specific schema files to consult
- Verify Supabase integration patterns
- Follow existing database schema patterns
- Ensure proper error handling and loading states
- Consider data validation and security
- Account for offline/network failure scenarios

**Field Reference Format for Each Phase:**
```markdown
**Field Reference:**
From `.wedding/context/dynamodb-schemas.json`:
```json
{
  "name": { "type": "string", "description": "Full name of the guest" },
  "email": { "type": "string", "description": "Email address of the guest" },
  "attendance": { "type": "string", "description": "Guest's attendance status (e.g., 'attending', 'not_attending', 'maybe')" }
}
```

From `.wedding/context/api-endpoints.md`:
```
POST /rsvp
Request: {
  "name": "string (required)",
  "email": "string (required)",
  "attendance": "yes|no (required)"
}
Response: {
  "message": "RSVP submitted successfully",
  "data": { ... }
}
```
```

**CRITICAL**: Never use guessed field names. Always copy exact names from schemas.

### 7. Character System Validation

**Always Verify:**
- Character theme consistency (colors, fonts, voice)
- Content appropriateness for each character
- Background image integration if applicable
- Responsive behavior across character themes
- State management through CharacterContext

### 8. Testing Strategy Requirements

**Every Ticket Must Include:**
- Browser testing requirements (Chrome, Safari, Firefox)
- Mobile device testing requirements (iOS, Android)
- Character system testing (all three perspectives)
- Integration testing with existing features
- Performance testing criteria where applicable
- Schema validation testing for AWS integrations
- **CORS testing for API endpoints** (see CORS Testing section below)

**CORS Testing Requirements (for API-related tickets):**

*Manual Testing Checklist:*
- [ ] Frontend can make successful requests to API endpoints
- [ ] Preflight OPTIONS requests return correct CORS headers
- [ ] Error responses include proper CORS headers
- [ ] Both development (localhost:5173) and production origins work
- [ ] Browser network tab shows no CORS errors
- [ ] Authentication headers work with CORS (if applicable)

*Automated Testing:*
```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: https://heatherandwesley.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://api.heatherandwesley.com/endpoint

# Expected response headers:
# Access-Control-Allow-Origin: https://heatherandwesley.com
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
```

*Browser Console Testing:*
```javascript
// Test from browser console on heatherandwesley.com
fetch('https://api.heatherandwesley.com/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({test: 'data'})
})
.then(response => console.log('CORS working:', response))
.catch(error => console.error('CORS error:', error));
```

**Use Specialized Agents:**
```markdown
**Testing with specialized agents:**
1. Run: `claude --agent test-writer "Write tests for [component] using exact field names from .wedding/context/dynamodb-schemas.json"`
2. Run: `claude --agent test-critic "Review tests for [component] and verify field name accuracy"`
3. Run: `claude --agent test-writer "Implement critic's suggestions for [component]"`
4. **For API endpoints**: Run: `claude --agent test-writer "Write CORS integration tests for [endpoint] including preflight and error scenarios"`
```

### 9. CORS Troubleshooting Guide

**Common CORS Issues and Solutions:**

*Issue: "Access to fetch at 'API_URL' from origin 'FRONTEND_URL' has been blocked by CORS policy"*
- **Cause**: Missing or incorrect `Access-Control-Allow-Origin` header
- **Solution**: Ensure Lambda returns proper CORS headers in ALL responses (including errors)
- **Check**: Verify API Gateway CORS configuration matches Lambda response headers

*Issue: "Request header 'content-type' is not allowed by Access-Control-Allow-Headers"*
- **Cause**: Missing `Content-Type` in `Access-Control-Allow-Headers`
- **Solution**: Add `Content-Type` to allowed headers list
- **Note**: Case-sensitive matching required

*Issue: "Method POST is not allowed by Access-Control-Allow-Methods"*
- **Cause**: OPTIONS preflight not properly configured
- **Solution**: Ensure Lambda handles OPTIONS method and returns correct methods list
- **Check**: Verify API Gateway OPTIONS integration

*Issue: CORS works in development but fails in production*
- **Cause**: Different origins between environments
- **Solution**: Environment-based origin configuration in Lambda
- **Pattern**: Use environment variables for allowed origins

**CORS Implementation Checklist for Lambda:**
```python
# Required in every Lambda function
def lambda_handler(event, context):
    # Determine origin based on environment
    allowed_origins = {
        'development': 'http://localhost:5173',
        'production': 'https://heatherandwesley.com'
    }
    
    origin = event.get('headers', {}).get('origin', '')
    stage = event.get('requestContext', {}).get('stage', 'development')
    
    cors_headers = {
        'Access-Control-Allow-Origin': allowed_origins.get(stage, allowed_origins['production']),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400'
    }
    
    # Handle preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': ''
        }
    
    try:
        # Your main logic here
        result = process_request(event)
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps(result)
        }
    except Exception as e:
        # CRITICAL: Include CORS headers in error responses
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': str(e)})
        }
```

## Quality Checklist

Before finalizing any ticket, verify:

- [ ] All required context documents have been read
- [ ] **AWS/Backend phases include exact field definitions from `.wedding/context/` files**
- [ ] User stories clearly define business value for wedding context
- [ ] Technical requirements address character system integration
- [ ] Implementation plan considers all three character perspectives
- [ ] **Each phase with AWS integration has Field Reference section with exact schemas**
- [ ] **API endpoint phases include CORS Configuration section with specific headers**
- [ ] File references use absolute paths and specific descriptions
- [ ] Documentation updates are explicitly called out
- [ ] Success criteria are measurable and testable
- [ ] Dependencies include character system requirements
- [ ] Risks assess impact on existing wedding app functionality
- [ ] **CORS testing requirements included for API-related tickets**
- [ ] Point estimates reflect complexity, not time
- [ ] Mobile and desktop compatibility is addressed
- [ ] Wedding/celebration context is appropriate
- [ ] **Field names are copied exactly from schemas, never guessed**
- [ ] **CORS troubleshooting guidance provided for Lambda functions**

## Common Pitfalls to Avoid

### Don't:
- Use time estimates (days, weeks, hours) instead of points
- Create vague file references ("update the main component")
- Skip character system integration considerations
- Ignore mobile compatibility for wedding guests
- Forget to validate against existing character themes
- Create phases longer than 5 points without breakdown
- Make assumptions about character-specific requirements
- **Forget CORS headers in Lambda error responses**
- **Assume API Gateway CORS is sufficient without Lambda headers**
- **Skip preflight OPTIONS method handling in Lambda functions**
- **Use different origins between development and production without environment handling**
- **Test CORS only from same origin (missing cross-origin validation)**

### Do:
- Ask clarifying questions when character integration is unclear
- Break complex work into logical, testable phases
- Specify exact files and components to modify
- Include comprehensive testing across all character perspectives
- Validate all changes against existing wedding app patterns
- Consider mobile-first design for wedding guests
- Reference existing character system patterns and precedents
- **Include CORS configuration in every API endpoint phase**
- **Test CORS from both development and production origins**
- **Provide environment-based origin handling in Lambda functions**
- **Include CORS troubleshooting steps in testing requirements**
- **Verify CORS headers are returned in ALL response scenarios (success, error, validation failure)**

---

**Remember**: This is a wedding website that prioritizes user experience, character-based storytelling, and celebration. The goal is to create tickets that a fresh Claude instance can read and implement immediately while maintaining the magical, quest-like experience for Wesley & Heather's guests. Thoroughness and attention to the character system are more valuable than brevity.