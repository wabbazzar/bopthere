# Ticket 002: API Field Integrity System

## Metadata
- **Status**: Not Started
- **Priority**: High
- **Effort**: 8 points
- **Created**: 2025-07-31
- **Type**: feature
- **Character Impact**: All (infrastructure feature)

## User Stories

### Primary User Story
As an AI development agent, I want automated schema documentation and validation so that I always use correct field names when interfacing with the wedding app's backend APIs.

### Secondary User Stories
- As a developer, I want up-to-date API documentation so that I can quickly understand the data model.
- As a wedding couple (Wesley/Heather), I want reliable backend interactions so that guest RSVPs are never lost due to field naming errors.
- As a DevOps engineer, I want automated schema drift detection so that API changes don't break existing functionality.

## Technical Requirements

### Functional Requirements
1. Automatically extract DynamoDB table schemas and field names
2. Generate API Gateway route documentation with request/response formats
3. Document Lambda function interfaces and response patterns
4. Create validation rules that AI agents must follow before writing backend code
5. Provide automated schema updates via GitHub Actions
6. Support the existing AWS infrastructure (single DynamoDB table, Lambda, API Gateway)
7. Prepare for future expansion (login system, additional tables)

### Non-Functional Requirements
1. Performance: Schema generation < 30 seconds
2. Accessibility: Documentation in both JSON (machine-readable) and Markdown (human-readable)
3. Character Theming: N/A (infrastructure feature)
4. Automation: Schema updates every 4 hours or on infrastructure changes

## Implementation Plan

### Phase 1: DynamoDB Schema Extraction (3 points)
**Files to modify:**
- None (new infrastructure tooling)

**Files to create:**
- `scripts/generate_dynamodb_schemas.py` - Extract DynamoDB table schemas
- `.wedding/context/dynamodb-schemas.json` - Machine-readable schema output
- `.wedding/context/field-mappings.md` - Human-readable field documentation

**Component Structure:**
```python
import boto3
import json
from typing import Dict, List, Any
from decimal import Decimal

class DynamoDBSchemaExtractor:
    def __init__(self, region: str = 'us-east-1'):
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.client = boto3.client('dynamodb', region_name=region)
    
    def extract_table_schema(self, table_name: str) -> Dict[str, Any]:
        """Extract schema for a single DynamoDB table"""
        # Implementation following existing AWS patterns
        pass
    
    def discover_field_types(self, table_name: str, sample_size: int = 20) -> Dict[str, str]:
        """Scan sample items to discover all fields and types"""
        # Implementation with Decimal handling
        pass
```

**Implementation steps:**
1. Create script to connect to DynamoDB using boto3
2. Extract heatherandwesley-users table schema (current table)
3. Scan 20 sample items to discover all fields and types
4. Generate JSON schema with complete field information
5. Create Markdown documentation with field descriptions and examples
6. Handle DynamoDB Decimal type conversions properly

**Testing:**
1. Run: `python scripts/generate_dynamodb_schemas.py`
2. Verify JSON output contains all table fields
3. Confirm Markdown documentation is human-readable
4. Test with empty tables and tables with varied data

**Use specialized agents:**
```bash
# Have the code-writer agent implement the schema extraction
claude "Use the code-writer agent to implement scripts/generate_dynamodb_schemas.py following the DynamoDBSchemaExtractor structure"

# Have the code-quality-assessor review the implementation
claude "Use the code-quality-assessor agent to review scripts/generate_dynamodb_schemas.py for performance and maintainability"

# Have the test-writer create comprehensive tests
claude "Use the test-writer agent to create tests for scripts/generate_dynamodb_schemas.py including edge cases"

# Have the test-critic review the test coverage
claude "Use the test-critic agent to analyze the test suite for generate_dynamodb_schemas.py and suggest improvements"
```

**Build Verification:**
```bash
cd scripts && python generate_dynamodb_schemas.py
cat .wedding/context/dynamodb-schemas.json
cat .wedding/context/field-mappings.md
```

**Commit**: `feat(api): implement DynamoDB schema extraction for field integrity`

### Phase 2: API Gateway & Lambda Documentation (3 points)
**Files to modify:**
- None (new infrastructure tooling)

**Files to create:**
- `scripts/extract_api_gateway_routes.py` - Extract API Gateway configuration
- `scripts/extract_lambda_patterns.py` - Document Lambda interfaces
- `.wedding/context/api-gateway-routes.json` - Route definitions
- `.wedding/context/lambda-patterns.json` - Lambda request/response patterns
- `.wedding/context/api-endpoints.md` - Combined API documentation

**Component Structure:**
```python
class APIGatewayExtractor:
    def __init__(self, api_name_pattern: str = 'heatherandwesley'):
        self.client = boto3.client('apigatewayv2')
        self.lambda_client = boto3.client('lambda')
    
    def find_api_by_pattern(self, pattern: str) -> str:
        """Find API Gateway by name pattern"""
        pass
    
    def extract_routes(self, api_id: str) -> List[Dict[str, Any]]:
        """Extract all routes with methods and integrations"""
        pass

class LambdaPatternExtractor:
    def extract_function_patterns(self, function_name: str) -> Dict[str, Any]:
        """Extract request/response patterns from Lambda"""
        # Include test invocation for response format discovery
        pass
```

**Implementation steps:**
1. Create API Gateway route extractor for HTTP API
2. Map routes to Lambda function integrations (heatherandwesley-rsvp-handler)
3. Document expected request formats for each endpoint
4. Extract Lambda response patterns through test invocations
5. Generate combined API documentation in Markdown
6. Prepare structure for future login system endpoints

**Testing:**
1. Run: `python scripts/extract_api_gateway_routes.py`
2. Run: `python scripts/extract_lambda_patterns.py`
3. Verify route mappings are correct
4. Confirm Lambda patterns match actual responses
5. Test error response documentation

**Use specialized agents:**
```bash
# Have the code-writer agent implement both extractors
claude "Use the code-writer agent to implement scripts/extract_api_gateway_routes.py with the APIGatewayExtractor class"
claude "Use the code-writer agent to implement scripts/extract_lambda_patterns.py with the LambdaPatternExtractor class"

# Have the code-quality-assessor review both implementations
claude "Use the code-quality-assessor agent to review the API Gateway and Lambda extraction scripts for AWS best practices"

# Have the test-writer create integration tests
claude "Use the test-writer agent to create integration tests for the API Gateway and Lambda extractors"
```

**Build Verification:**
```bash
cd scripts && python extract_api_gateway_routes.py
cd scripts && python extract_lambda_patterns.py
cat .wedding/context/api-endpoints.md
```

**Commit**: `feat(api): add API Gateway and Lambda pattern extraction`

### Phase 3: Validation Rules & Automation (2 points)
**Files to modify:**
- `.github/workflows/update-schemas.yml` - Add automated schema updates
- `Makefile` - Add schema update commands

**Files to create:**
- `.wedding/context/agent-schema-rules.md` - Validation rules for AI agents
- `tests/test_api_field_consistency.py` - Consistency tests
- `.github/workflows/update-schemas.yml` - GitHub Actions workflow

**Component Structure:**
```yaml
# .github/workflows/update-schemas.yml
name: Update API Schemas
on:
  schedule:
    - cron: '0 */4 * * *'  # Every 4 hours
  push:
    paths:
      - 'backend/**'
      - 'scripts/generate_*.py'
      - 'scripts/extract_*.py'
```

**Agent Rules Documentation:**
```markdown
# API Field Validation Rules for AI Agents

## MANDATORY: Pre-Implementation Validation

Before writing ANY code that interfaces with the backend:

1. **READ** the current schema files:
   - `.wedding/context/dynamodb-schemas.json`
   - `.wedding/context/api-endpoints.md`

2. **VERIFY** field names exactly match schemas:
   - DynamoDB fields are case-sensitive
   - Use exact field names from schemas
   - NEVER guess or assume field names

3. **STOP** if a required field is not in schemas:
   - Ask for clarification
   - Update schemas if field is new
   - Do not proceed with guessed names

## Common Mistakes to Avoid
- ❌ Using `userId` when schema shows `user_id`
- ❌ Assuming field names from frontend code
- ❌ Creating new fields without schema updates
```

**Implementation steps:**
1. Create comprehensive validation rules documentation
2. Add Makefile targets for schema updates
3. Implement GitHub Actions workflow for automated updates
4. Create pytest tests for field consistency validation
5. Document rollback procedures for schema changes
6. Add schema change detection and commit automation

**Testing:**
1. Run: `make update-schemas`
2. Run: `make test-api-consistency`
3. Trigger GitHub Actions workflow manually
4. Verify automated commits on schema changes

**Use specialized agents:**
```bash
# Have the code-writer agent implement the validation rules and automation
claude "Use the code-writer agent to create tests/test_api_field_consistency.py with comprehensive field validation"
claude "Use the code-writer agent to implement the GitHub Actions workflow .github/workflows/update-schemas.yml"

# Have the test-critic review the consistency tests
claude "Use the test-critic agent to review test_api_field_consistency.py for coverage and edge cases"
```

**Build Verification:**
```bash
make update-schemas
make test-api-consistency
npm run build
npm run lint
```

**Commit**: `feat(api): add validation rules and automation for field integrity`

## Testing Strategy

### Character Perspective Tests
- N/A (infrastructure feature affects all characters equally)

### Responsive Design Tests
- N/A (backend infrastructure feature)

### Integration Tests
- Test schema extraction with empty DynamoDB tables
- Test with tables containing varied data types
- Verify API Gateway route extraction accuracy
- Test Lambda pattern extraction with auth-protected endpoints
- Validate GitHub Actions workflow execution
- Test schema consistency across all layers

### Accessibility Tests
- Ensure generated documentation is screen-reader friendly
- Verify Markdown formatting for documentation tools

## Documentation Updates Required
1. Update README.md with new schema generation commands
2. Document `.wedding/context/` directory structure
3. Add section on API field validation for contributors
4. Update development setup to include schema generation
5. Document how AI agents should use schema files

## Success Criteria
1. DynamoDB schemas automatically extracted and documented
2. API Gateway routes mapped to Lambda integrations
3. Lambda request/response patterns documented
4. AI agents following validation rules with 100% field accuracy
5. Automated schema updates running every 4 hours
6. No field naming errors in new backend code
7. Schema drift detected and reported automatically

## Dependencies
- AWS SDK (boto3) for Python
- Existing AWS infrastructure (DynamoDB, Lambda, API Gateway)
- GitHub Actions for automation
- Python 3.8+ for scripts
- pytest for consistency testing

## Risks & Mitigations
1. **Risk**: AWS credentials exposure in CI/CD
   **Mitigation**: Use GitHub Secrets and IAM roles with minimal permissions

2. **Risk**: Schema extraction performance impact on production
   **Mitigation**: Use read-only operations with pagination, implement caching

3. **Risk**: Breaking changes in schema updates
   **Mitigation**: Version schemas, implement change detection and notifications

4. **Risk**: AI agents ignoring validation rules
   **Mitigation**: Make rules prominent in documentation, include in agent prompts