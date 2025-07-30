INSTRUCTIONS FOR CLAUDE:
- Completed steps marked as [COMPLETE] in Headers
- Commit with standard messaging between each phase

# Ticket #001: AWS Migration - Replace Supabase with DynamoDB for RSVP Storage

**Status**: PENDING
**Priority**: MEDIUM - Infrastructure modernization to leverage existing AWS account and reduce external dependencies
**Estimated Effort**: 9 points - Major architectural change requiring new infrastructure, Lambda functions, API Gateway, client modifications, and deployment processes
**Created**: 2025-01-25

## Overview
Migrate the wedding app's RSVP data storage from Supabase to AWS DynamoDB using existing AWS account (--profile personal) with Makefile-based table management for better control and consistency with preferred infrastructure patterns.

## User Stories

### Primary User Story
As a wedding guest, I want to submit my RSVP information so that Wesley & Heather can plan their celebration, regardless of the backend storage technology.

### Secondary User Stories
- As a developer, I want to use AWS DynamoDB so that I can leverage existing AWS infrastructure and reduce external service dependencies
- As a maintainer, I want Makefile-based table management so that I can easily create, update, and manage database resources consistently
- As a system administrator, I want to use the existing AWS account (--profile personal) so that all resources are centralized and properly managed

## Technical Requirements

### Functional Requirements
- Replace Supabase client with AWS DynamoDB SDK integration
- Maintain exact same RSVP form functionality and user experience
- Preserve all existing data fields from current `rsvp_responses` table structure
- Support all current RSVP operations: create, read (for admin purposes)
- Character system integration must remain unchanged
- Responsive design and mobile functionality must be preserved

### Non-Functional Requirements
- Performance: Database operations must complete within <500ms
- Compatibility: Support Chrome, Safari, Firefox on mobile and desktop
- Character theming: No changes to existing character-specific form experiences
- User experience: Zero visible changes to wedding guests' RSVP process
- Security: Use AWS IAM best practices for API access
- Reliability: Include proper error handling and retry logic

### Data Schema Requirements
- Table name: `heatherandwesley-users` (as specified in original request)
- Preserve all fields from current Supabase schema:
  - `id` (string, primary key)
  - `name` (string, required)
  - `email` (string, required)
  - `phone` (string, optional)
  - `attendance` (string, required: "yes" or "no")
  - `notifications` (boolean, optional)
  - `dietary_restrictions` (string, optional)
  - `song_request` (string, optional)
  - `message_for_couple` (string, optional)
  - `created_at` (string, ISO timestamp)
  - `updated_at` (string, ISO timestamp)

## Implementation Plan

### Phase 1: AWS Infrastructure Setup (3 points)
**Deliverables:**
- DynamoDB table creation with proper schema
- Makefile commands for table management
- AWS IAM roles and policies for table access

**Files to Create:**
- `Makefile` - Table management commands (create, update, delete, describe)
- `aws/dynamodb-table.yaml` - CloudFormation template for table definition
- `aws/iam-policy.json` - IAM policy for DynamoDB access
- `.env.example` - Environment variable template for AWS configuration

**Files to Modify:**
- `.gitignore` - Add AWS credential files and environment configs

**Testing Requirements:**
- Verify table creation with `make create-table`
- Test table access with AWS CLI using --profile personal
- Validate schema matches Supabase structure exactly

**Makefile Commands to Implement:**
```makefile
# DynamoDB Operations
create-table:         # Create DynamoDB table
update-table:         # Update table configuration
delete-table:         # Delete table (with confirmation)
describe-table:       # Show table status and schema
list-tables:          # List all DynamoDB tables

# Lambda Operations
deploy-lambda:        # Deploy Lambda function
update-lambda:        # Update Lambda function code
test-lambda:          # Test Lambda function with sample data
delete-lambda:        # Delete Lambda function

# API Gateway Operations
deploy-api:           # Deploy API Gateway configuration
update-api:           # Update API Gateway settings
test-api:             # Test API Gateway endpoints
delete-api:           # Delete API Gateway

# Full Stack Operations
deploy-all:           # Deploy table + lambda + api gateway
test-all:             # Test complete integration chain
cleanup-all:          # Delete all AWS resources (with confirmation)
```

### Phase 2: Frontend AWS Integration (4 points)
**Deliverables:**
- AWS Lambda function for RSVP operations (required for secure DynamoDB access)
- API Gateway endpoint for Lambda integration
- AWS service layer replacing Supabase client calls
- Environment variable configuration for API endpoints

**Primary Integration Point:**
The current RSVP submission occurs in `src/components/RSVPSection.tsx` at line 158-161:
```typescript
const { data, error } = await supabase
  .from('rsvp_responses')
  .insert([insertData])
  .select();
```

This will be replaced with a call to AWS API Gateway endpoint that triggers a Lambda function to write to DynamoDB.

**Architecture Decision:**
Direct DynamoDB access from frontend is not recommended due to:
- Security: Requires exposing AWS credentials to client-side code
- CORS complexity: DynamoDB doesn't natively support browser CORS
- Access control: No fine-grained permission management

**Recommended Pattern: API Gateway + Lambda**
```
Frontend RSVPSection.tsx -> API Gateway -> Lambda -> DynamoDB
```

**Files to Create:**
- `aws/lambda/rsvp-handler.py` - Lambda function for RSVP CRUD operations
- `aws/api-gateway.yaml` - API Gateway CloudFormation template
- `src/integrations/aws/api-client.ts` - HTTP client for API Gateway calls
- `src/integrations/aws/rsvp-service.ts` - Service layer abstracting API calls
- `src/integrations/aws/types.ts` - TypeScript types for API requests/responses

**Files to Modify:**
- `src/components/RSVPSection.tsx` - Replace Supabase call at `submitCompleteForm()` function (line 158-161)
- `package.json` - Remove Supabase dependencies, add HTTP client if needed
- `Makefile` - Add Lambda deployment and API Gateway management commands
- `vite.config.ts` - Environment variable for API Gateway endpoint URL

**Lambda Function Specifications:**
- **Function Name**: `heatherandwesley-rsvp-handler`
- **Runtime**: Python 3.9+ (consistent with --profile personal patterns)
- **Operations**: 
  - POST /rsvp - Create new RSVP entry
  - GET /rsvp/{id} - Retrieve RSVP (for admin purposes)
- **Error Handling**: Return appropriate HTTP status codes and user-friendly messages
- **Validation**: Input validation matching current frontend validation rules

**API Gateway Configuration:**
- **Endpoint**: `https://{api-id}.execute-api.{region}.amazonaws.com/prod/rsvp`
- **CORS**: Enable for wedding app domain
- **Authentication**: None (public endpoint for wedding guests)
- **Rate Limiting**: Implement to prevent abuse
- **Request/Response**: JSON format matching current Supabase patterns

**Integration Changes in RSVPSection.tsx:**
```typescript
// Replace lines 158-161 with:
const response = await fetch(`${process.env.VITE_API_GATEWAY_URL}/rsvp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(insertData)
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message || 'Failed to submit RSVP');
}

const data = await response.json();
```

**Testing Requirements:**
- Test Lambda function directly with AWS CLI/console
- Test API Gateway endpoint with curl/Postman
- Test RSVP form submission with all three character perspectives
- Verify data persistence in DynamoDB table
- Test error handling for network failures and invalid data
- Validate CORS functionality from wedding app domain
- Performance test API Gateway + Lambda + DynamoDB chain

### Phase 3: Cleanup and Documentation (2 points)
**Deliverables:**
- Remove Supabase dependencies and configurations
- Update documentation and deployment instructions
- Comprehensive testing across all characters and devices

**Files to Modify:**
- `package.json` - Remove Supabase dependencies
- `README.md` - Update setup instructions for AWS configuration
- `docs/RSVP_CHARACTER_BACKGROUNDS_TODO.md` - Update if any RSVP system references

**Files to Remove:**
- `src/integrations/supabase/` - Entire directory
- `supabase/` - Configuration directory

**Testing Requirements:**
- Full end-to-end testing of RSVP flow for all characters
- Cross-browser testing (Chrome, Safari, Firefox)
- Mobile device testing (iOS, Android)
- Performance testing to ensure <500ms response times
- Error scenario testing (network failures, invalid data)

## Documentation Updates Required

### Core Documentation
- [ ] `README.md` - Add AWS setup instructions, environment variables, and Makefile usage
- [ ] `docs/RSVP_CHARACTER_BACKGROUNDS_TODO.md` - Update any references to data storage system

### Technical Documentation
- [ ] Create `docs/aws-setup.md` - Detailed AWS configuration and deployment instructions
- [ ] Create `docs/makefile-commands.md` - Documentation of all table management commands

### User Documentation
- [ ] No user-facing documentation changes required (invisible backend change)
- [ ] Update deployment instructions for production environment

## Success Criteria

### Functional Acceptance Criteria
- [ ] RSVP form functions identically to current Supabase implementation
- [ ] All character perspectives (Wesley, Heather, Puffy) work correctly
- [ ] Data is successfully stored in `heatherandwesley-users` DynamoDB table
- [ ] Form validation and error handling work exactly as before
- [ ] Responsive design maintained across all screen sizes

### Performance Criteria
- [ ] RSVP submission completes within 500ms under normal conditions
- [ ] Page load times remain unchanged from Supabase implementation
- [ ] No degradation in form responsiveness or character switching speed

### Quality Criteria
- [ ] All existing functionality continues to work
- [ ] No visual changes to wedding guest experience
- [ ] Code follows existing TypeScript/React patterns
- [ ] AWS integration follows security best practices
- [ ] Makefile commands work reliably with --profile personal
- [ ] Error handling provides appropriate user feedback

## Dependencies

### Technical Dependencies
- AWS account access with --profile personal configured
- AWS CLI installed and configured on development machine
- DynamoDB service availability in chosen AWS region
- Sufficient AWS permissions for DynamoDB operations

### Character System Dependencies
- No changes to character theme system required
- Character-specific content and styling must remain unchanged
- Character context and state management unchanged

### Development Dependencies
- Complete Phase 1 (infrastructure) before Phase 2 (frontend integration)
- Test Phase 2 thoroughly before Phase 3 (cleanup)
- Coordinate with any ongoing wedding app development to avoid conflicts

## Risks & Mitigations

### Technical Risks
**Risk**: AWS credential management complexity for frontend application
**Impact**: HIGH
**Mitigation**: Use AWS Cognito Identity Pools for secure frontend access, or API Gateway with Lambda for backend proxy pattern

**Risk**: DynamoDB query patterns different from Supabase relational queries
**Impact**: MEDIUM  
**Mitigation**: Design simple key-based access patterns, create comprehensive service layer abstraction

**Risk**: AWS SDK bundle size impact on frontend performance
**Impact**: MEDIUM
**Mitigation**: Use tree-shaking and only import required DynamoDB operations, consider server-side API approach

### Character System Risks
**Risk**: Breaking character-specific form experiences during migration
**Impact**: HIGH
**Mitigation**: Comprehensive testing across all three character perspectives, maintain exact API contract

### User Experience Risks
**Risk**: RSVP form downtime during migration
**Impact**: HIGH
**Mitigation**: Implement feature flags for gradual rollout, maintain Supabase as backup during transition, thorough staging environment testing

### Infrastructure Risks  
**Risk**: Makefile commands failing with --profile personal configuration
**Impact**: MEDIUM
**Mitigation**: Test all Makefile commands thoroughly, include proper error handling and confirmation prompts

**Risk**: DynamoDB table schema mismatch with application expectations
**Impact**: HIGH
**Mitigation**: Create exact schema mapping documentation, implement comprehensive validation in service layer

## Additional Notes

### AWS Profile Configuration
All AWS operations must use `--profile personal` as specified in requirements. This should be:
- Hardcoded in Makefile commands
- Configured in AWS SDK client initialization
- Documented clearly for future maintenance

### Table Naming Convention
The table name `heatherandwesley-users` follows a simple naming pattern. Consider if this should be:
- Environment-specific (e.g., `heatherandwesley-users-dev`, `heatherandwesley-users-prod`)
- Include additional metadata in naming
- Follow any existing AWS resource naming conventions

### Data Migration Considerations
While not explicitly requested, consider:
- Exporting existing Supabase data for backup
- Potential data migration scripts if production data exists
- Validation scripts to ensure data integrity post-migration

### Security Considerations
- Review AWS IAM permissions for least-privilege access
- Consider API Gateway + Lambda pattern instead of direct DynamoDB access from frontend
- Implement proper error handling to avoid exposing AWS internals to users