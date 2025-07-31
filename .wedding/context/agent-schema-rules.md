# API Field Validation Rules for AI Agents

## MANDATORY: Pre-Implementation Validation

Before writing ANY code that interfaces with the backend, you MUST follow these steps:

### 1. **READ** the current schema files:
   - `.wedding/context/dynamodb-schemas.json` - DynamoDB table field definitions
   - `.wedding/context/api-endpoints.md` - API endpoint documentation
   - `.wedding/context/api-gateway-routes.json` - Route configurations
   - `.wedding/context/lambda-patterns.json` - Request/response patterns

### 2. **VERIFY** field names exactly match schemas:
   - DynamoDB fields are case-sensitive
   - Use exact field names from schemas (e.g., `message_for_couple` not `messageForCouple`)
   - NEVER guess or assume field names
   - Check both required and optional fields

### 3. **STOP** if a required field is not in schemas:
   - Ask for clarification before proceeding
   - Update schemas if field is new (run `make update-schemas`)
   - Do not proceed with guessed names

## Common Mistakes to Avoid

### ❌ NEVER DO THIS:
- Using `userId` when schema shows `user_id`
- Using `userName` when schema shows `name`
- Using `rsvpStatus` when schema shows `attendance`
- Assuming field names from frontend code without checking backend schemas
- Creating new fields without updating schemas first
- Using camelCase when backend uses snake_case

### ✅ ALWAYS DO THIS:
- Copy field names exactly from `.wedding/context/dynamodb-schemas.json`
- Verify request format from `.wedding/context/api-endpoints.md`
- Check response patterns in `.wedding/context/lambda-patterns.json`
- Update schemas before adding new fields

## Field Reference for heatherandwesley-users Table

Current fields as documented in schemas:
- `id` (string) - UUID v4 identifier
- `name` (string) - Full name of guest
- `email` (string) - Email address
- `attendance` (string) - "yes" or "no"
- `phone` (string) - Phone number (optional)
- `notifications` (boolean) - Opt-in for notifications
- `dietary_restrictions` (string) - Dietary needs
- `song_request` (string) - Song for reception
- `message_for_couple` (string) - Personal message
- `created_at` (string) - ISO 8601 timestamp
- `updated_at` (string) - ISO 8601 timestamp

## Validation Workflow

```bash
# Before implementing any backend integration:

# 1. Update schemas to latest
cd /path/to/project
make update-schemas

# 2. Check the specific table schema
cat .wedding/context/dynamodb-schemas.json | jq '.schemas."heatherandwesley-users".properties'

# 3. Verify API endpoint format
cat .wedding/context/api-endpoints.md

# 4. Check Lambda response patterns
cat .wedding/context/lambda-patterns.json | jq '.patterns'
```

## Example: Correct Field Usage

### ❌ WRONG:
```typescript
const rsvpData = {
  userName: "John Doe",        // Wrong: should be 'name'
  emailAddress: "john@example.com",  // Wrong: should be 'email'
  isAttending: true,          // Wrong: should be 'attendance' with value "yes"/"no"
}
```

### ✅ CORRECT:
```typescript
const rsvpData = {
  name: "John Doe",           // Matches schema exactly
  email: "john@example.com",  // Matches schema exactly
  attendance: "yes",          // Matches schema exactly (string, not boolean)
}
```

## Schema Update Process

If you need to add a new field:

1. **DO NOT** add it to your code first
2. **DO** update the backend Lambda handler first
3. **DO** run `make update-schemas` to capture the change
4. **THEN** use the new field in your code

## Consequences of Field Name Errors

Using incorrect field names will cause:
- 🚫 Data not saved to DynamoDB (field ignored)
- 🚫 API validation errors
- 🚫 Lost wedding guest information
- 🚫 Debugging nightmares in production

## Quick Reference Commands

```bash
# View all current fields for a table
cat .wedding/context/field-mappings.md

# Check specific field details
cat .wedding/context/dynamodb-schemas.json | jq '.schemas."heatherandwesley-users".properties.FIELD_NAME'

# Update schemas after backend changes
make update-schemas

# Test field consistency
make test-api-consistency
```

---

⚠️ **REMEMBER**: The wedding is a once-in-a-lifetime event. Guest data MUST be captured correctly. Always validate field names against schemas before implementation!