import hashlib
import json
import logging
import os
from datetime import datetime, timedelta
from decimal import Decimal

import boto3
import jwt

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB resource
# Note: AWS profile is handled by Lambda execution environment
dynamodb = boto3.resource("dynamodb")
table_name = os.environ.get("TABLE_NAME", "heatherandwesley-users")
table = dynamodb.Table(table_name)

# JWT configuration
JWT_SECRET = os.environ.get("JWT_SECRET", "development-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 30

# Validate JWT secret is set properly
if JWT_SECRET == "development-secret-key-change-in-production":
    logger.warning(
        "Using default JWT secret - "
        "should be set via environment variable in production"
    )


# Helper function to convert float to Decimal for DynamoDB
def float_to_decimal(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: float_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [float_to_decimal(v) for v in obj]
    return obj


# Helper function to convert Decimal to float for JSON serialization
def decimal_to_float(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [decimal_to_float(v) for v in obj]
    return obj


def generate_token(username, role):
    """Generate JWT token for authenticated user"""
    payload = {
        "username": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token):
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        # Verify required claims are present
        if "username" not in payload or "exp" not in payload:
            logger.warning("JWT token missing required claims")
            return None
        return payload
    except jwt.ExpiredSignatureError:
        logger.info("JWT token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error verifying JWT token: {str(e)}")
        return None


def hash_password(password):
    """Hash password using SHA256 with salt (avoiding bcrypt binary dependency)"""
    salt = os.urandom(32).hex()  # 32 bytes salt
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{password_hash}"


def verify_password(password, stored_hash):
    """Verify password against stored hash (supports both legacy and salted formats)"""
    try:
        if ":" in stored_hash:
            # New salted format: salt:hash
            salt, password_hash = stored_hash.split(":")
            return (
                hashlib.sha256((password + salt).encode()).hexdigest() == password_hash
            )
        else:
            # Legacy format: plain SHA256 hash
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            return password_hash == stored_hash
    except Exception:
        return False


def lambda_handler(event, context):
    """
    Handle authentication requests for the wedding website
    Supports /auth/login and /auth/verify endpoints
    """
    logger.info(f"Received event: {json.dumps(event, default=str)}")

    # Parse HTTP method and path
    http_method = event.get("httpMethod", "GET")
    path = event.get("path", "")

    # Enable CORS
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    }

    # Handle preflight requests
    if http_method == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    try:
        if path.endswith("/login") and http_method == "POST":
            # Parse request body
            body = json.loads(event.get("body") or "{}")

            # Validate required fields
            username = body.get("username")
            password = body.get("password")

            if not username or not password:
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({"error": "Username and password are required"}),
                }

            # Get user from DynamoDB
            response = table.get_item(Key={"username": username})

            if "Item" not in response:
                return {
                    "statusCode": 401,
                    "headers": headers,
                    "body": json.dumps({"error": "Invalid username or password"}),
                }

            user = response["Item"]

            # Verify password using SHA256 (avoiding bcrypt binary dependency)
            password_hash = user.get("password_hash", "")
            if not verify_password(password, password_hash):
                return {
                    "statusCode": 401,
                    "headers": headers,
                    "body": json.dumps({"error": "Invalid username or password"}),
                }

            # Update last login timestamp
            current_time = datetime.utcnow().isoformat() + "Z"
            try:
                table.update_item(
                    Key={"username": username},
                    UpdateExpression="SET last_login = :last_login",
                    ExpressionAttributeValues={":last_login": current_time},
                )
            except Exception as update_error:
                logger.warning(
                    f"Failed to update last_login for {username}: {str(update_error)}"
                )
                # Continue with login even if timestamp update fails

            # Generate JWT token
            token = generate_token(username, user.get("role", "guest"))

            # Return success response with token - using exact field names from ticket
            response_user = {
                "username": user.get("username"),
                "email": user.get("email"),
                "full_name": user.get("full_name"),
                "role": user.get("role", "guest"),
            }

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(
                    {
                        "message": "Login successful",
                        "token": token,
                        "user": response_user,
                    }
                ),
            }

        elif path.endswith("/verify") and http_method in ["GET", "POST"]:
            token = None

            # For GET requests, token must be in Authorization header
            # For POST requests, check body first, then Authorization header
            if http_method == "GET":
                # Check Authorization header (case-insensitive)
                headers_dict = event.get("headers", {})
                auth_header = ""
                for key, value in headers_dict.items():
                    if key.lower() == "authorization":
                        auth_header = value
                        break

                if auth_header.startswith("Bearer "):
                    token = auth_header[7:]  # Remove 'Bearer ' prefix
            else:
                # POST method - check body first
                body = json.loads(event.get("body") or "{}")
                token = body.get("token")

                if not token:
                    # Check Authorization header as fallback
                    headers_dict = event.get("headers", {})
                    auth_header = ""
                    for key, value in headers_dict.items():
                        if key.lower() == "authorization":
                            auth_header = value
                            break

                    if auth_header.startswith("Bearer "):
                        token = auth_header[7:]  # Remove 'Bearer ' prefix

            if not token:
                return {
                    "statusCode": 401,
                    "headers": headers,
                    "body": json.dumps({"error": "Token is required"}),
                }

            # Verify token
            payload = verify_token(token)

            if not payload:
                return {
                    "statusCode": 401,
                    "headers": headers,
                    "body": json.dumps({"error": "Invalid or expired token"}),
                }

            # Get updated user info
            username = payload.get("username")
            response = table.get_item(Key={"username": username})

            if "Item" not in response:
                return {
                    "statusCode": 401,
                    "headers": headers,
                    "body": json.dumps({"error": "User not found"}),
                }

            user = response["Item"]

            # Return user info - using exact field names from ticket
            response_user = {
                "username": user.get("username"),
                "email": user.get("email"),
                "full_name": user.get("full_name"),
                "role": user.get("role", "guest"),
            }

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(
                    {"message": "Token is valid", "user": response_user}
                ),
            }

        elif path.endswith("/refresh") and http_method == "POST":
            # Token refresh endpoint for extending sessions
            token = None
            
            # Check Authorization header (case-insensitive)
            headers_dict = event.get("headers", {})
            auth_header = ""
            for key, value in headers_dict.items():
                if key.lower() == "authorization":
                    auth_header = value
                    break
            
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]  # Remove 'Bearer ' prefix
            
            # Also check body for token
            if not token:
                body = json.loads(event.get("body") or "{}")
                token = body.get("token")
            
            if not token:
                return {
                    "statusCode": 401,
                    "headers": headers,
                    "body": json.dumps({"error": "Token is required for refresh"}),
                }
            
            # Verify the current token
            payload = verify_token(token)
            
            if not payload:
                return {
                    "statusCode": 401,
                    "headers": headers,
                    "body": json.dumps({"error": "Invalid or expired token"}),
                }
            
            # Check if token is within refresh window (last 6 days of 30-day lifetime)
            exp_timestamp = payload.get("exp", 0)
            current_timestamp = datetime.utcnow().timestamp()
            time_until_expiry = exp_timestamp - current_timestamp
            
            # Allow refresh if token expires within 6 days (518400 seconds)
            # or if explicitly requested (for testing/PWA lifecycle)
            if time_until_expiry > 518400:
                logger.info(f"Token refresh requested with {time_until_expiry/86400:.1f} days remaining")
            
            # Get user info for new token
            username = payload.get("username")
            response = table.get_item(Key={"username": username})
            
            if "Item" not in response:
                return {
                    "statusCode": 401,
                    "headers": headers,
                    "body": json.dumps({"error": "User not found"}),
                }
            
            user = response["Item"]
            
            # Update last_activity timestamp
            current_time = datetime.utcnow().isoformat() + "Z"
            try:
                table.update_item(
                    Key={"username": username},
                    UpdateExpression="SET last_activity = :last_activity",
                    ExpressionAttributeValues={":last_activity": current_time},
                )
            except Exception as update_error:
                logger.warning(
                    f"Failed to update last_activity for {username}: {str(update_error)}"
                )
                # Continue with refresh even if timestamp update fails
            
            # Generate new JWT token with fresh expiry
            new_token = generate_token(username, user.get("role", "guest"))
            
            # Calculate expiry timestamp for response
            expires_at = (datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS)).isoformat() + "Z"
            
            # Return user info with new token
            response_user = {
                "username": user.get("username"),
                "email": user.get("email"),
                "full_name": user.get("full_name"),
                "role": user.get("role", "guest"),
            }
            
            logger.info(f"Token refreshed for user: {username}")
            
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(
                    {
                        "message": "Token refreshed successfully",
                        "token": new_token,
                        "expires_at": expires_at,
                        "user": response_user,
                    }
                ),
            }
        
        elif path.endswith("/register") and http_method == "POST":
            # Registration endpoint for admin user creation
            # Parse request body
            body = json.loads(event.get("body") or "{}")

            # Validate required fields
            required_fields = ["username", "password", "email", "full_name"]
            for field in required_fields:
                if field not in body:
                    return {
                        "statusCode": 400,
                        "headers": headers,
                        "body": json.dumps(
                            {"error": f"Missing required field: {field}"}
                        ),
                    }

            username = body["username"]
            password = body["password"]
            email = body["email"]
            full_name = body["full_name"]
            role = body.get("role", "guest")

            # Check if user already exists
            response = table.get_item(Key={"username": username})
            if "Item" in response:
                return {
                    "statusCode": 409,
                    "headers": headers,
                    "body": json.dumps({"error": "Username already exists"}),
                }

            # Hash password using SHA256 with salt
            password_hash = hash_password(password)

            # Get current timestamp
            current_time = datetime.utcnow().isoformat() + "Z"

            # Prepare user item for DynamoDB
            user_item = {
                "username": username,
                "password_hash": password_hash,
                "email": email,
                "full_name": full_name,
                "role": role,
                "created_at": current_time,
                "last_login": current_time,
            }

            # Convert any float values to Decimal for DynamoDB
            user_item = float_to_decimal(user_item)

            # Save to DynamoDB
            table.put_item(Item=user_item)

            # Generate JWT token
            token = generate_token(username, role)

            # Return success response
            return {
                "statusCode": 201,
                "headers": headers,
                "body": json.dumps(
                    {
                        "message": "User registered successfully",
                        "token": token,
                        "user": {
                            "username": username,
                            "email": email,
                            "full_name": full_name,
                            "role": role,
                        },
                    }
                ),
            }

        else:
            return {
                "statusCode": 404,
                "headers": headers,
                "body": json.dumps({"error": f"Endpoint not found: {path}"}),
            }

    except Exception as e:
        logger.error(f"Error in auth handler: {str(e)}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": "Internal server error"}),
        }
