# Wedding App Authentication Lambda

This Lambda function handles authentication for the wedding app, providing login, registration, and token verification endpoints.

## Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "email": "string",
  "full_name": "string",
  "role": "guest|vip|admin" // optional, defaults to "guest"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "jwt-token",
  "user": {
    "username": "string",
    "email": "string",
    "full_name": "string",
    "role": "string"
  }
}
```

### POST /auth/login
Login with username and password.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "jwt-token",
  "user": {
    "username": "string",
    "email": "string",
    "full_name": "string",
    "role": "string"
  }
}
```

### POST /auth/verify
Verify a JWT token.

**Request Body:**
```json
{
  "token": "jwt-token"
}
```

Or via Authorization header:
```
Authorization: Bearer jwt-token
```

**Response (200):**
```json
{
  "message": "Token is valid",
  "user": {
    "username": "string",
    "email": "string",
    "full_name": "string",
    "role": "string"
  }
}
```

## DynamoDB Schema

The function uses the `heatherandwesley-users` table with the following schema:

- **username** (string) - Primary key
- **password_hash** (string) - bcrypt hashed password
- **email** (string) - User's email address
- **full_name** (string) - User's full name
- **role** (string) - User role: 'guest', 'vip', or 'admin'
- **created_at** (string) - ISO timestamp of account creation
- **last_login** (string) - ISO timestamp of last successful login

## Environment Variables

- **TABLE_NAME** - DynamoDB table name (default: 'heatherandwesley-users')
- **JWT_SECRET** - Secret key for JWT signing (required for production)

## Deployment

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Deploy using the provided script:
   ```bash
   ./deploy-auth.sh
   ```

3. Configure API Gateway to route `/auth/*` requests to this Lambda function

## Security Notes

1. **JWT Secret**: Always use a strong, unique secret in production
2. **HTTPS Only**: Ensure API Gateway enforces HTTPS
3. **Password Requirements**: Consider adding password strength validation
4. **Rate Limiting**: Configure API Gateway throttling to prevent brute force attacks
5. **Token Expiry**: Tokens expire after 24 hours

## Testing

Use the provided test script to validate the handler locally:

```bash
python docs/test_auth_handler.py
```

## Integration with RSVP System

The auth system can be integrated with the existing RSVP system by:

1. Adding a `user_id` field to RSVP submissions
2. Requiring authentication for viewing/editing RSVPs
3. Using role-based access for admin features