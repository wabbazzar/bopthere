import json
import boto3
import os
import jwt
import hashlib
from datetime import datetime, timedelta
from decimal import Decimal

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', 'heatherandwesley-auth-users')
table = dynamodb.Table(table_name)

# JWT configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_HOURS = 24

def simple_hash_password(password):
    """Simple password hashing using SHA256 (NOT for production)"""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def verify_simple_hash(password, password_hash):
    """Verify password against simple hash"""
    return simple_hash_password(password) == password_hash

def generate_token(username, role):
    """Generate JWT token for authenticated user"""
    payload = {
        'username': username,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token):
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def lambda_handler(event, context):
    """
    Handle authentication requests for the wedding website
    Supports /auth/login and /auth/verify endpoints
    """
    print(f"Received event: {json.dumps(event)}")
    
    # Parse HTTP method and path
    http_method = event.get('httpMethod', 'GET')
    path = event.get('path', '')
    
    # Enable CORS
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    }
    
    # Handle preflight requests
    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }
    
    try:
        if path.endswith('/login') and http_method == 'POST':
            # Parse request body
            body = json.loads(event.get('body', '{}'))
            
            # Validate required fields
            username = body.get('username')
            password = body.get('password')
            
            if not username or not password:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'Username and password are required'
                    })
                }
            
            # Get user from DynamoDB
            try:
                response = table.get_item(Key={'username': username})
            except Exception as e:
                print(f"DynamoDB error: {str(e)}")
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'Database error'
                    })
                }
            
            if 'Item' not in response:
                return {
                    'statusCode': 401,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'Invalid username or password'
                    })
                }
            
            user = response['Item']
            
            # Verify password (using simple hash for testing)
            password_hash = user.get('password_hash', '')
            if not verify_simple_hash(password, password_hash):
                return {
                    'statusCode': 401,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'Invalid username or password'
                    })
                }
            
            # Update last login timestamp
            current_time = datetime.utcnow().isoformat() + 'Z'
            try:
                table.update_item(
                    Key={'username': username},
                    UpdateExpression='SET last_login = :last_login',
                    ExpressionAttributeValues={':last_login': current_time}
                )
            except Exception as e:
                print(f"Failed to update last login: {str(e)}")
            
            # Generate JWT token
            token = generate_token(username, user.get('role', 'guest'))
            
            # Return success response with token
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'message': 'Login successful',
                    'token': token,
                    'user': {
                        'username': user.get('username'),
                        'email': user.get('email'),
                        'full_name': user.get('full_name'),
                        'role': user.get('role', 'guest')
                    }
                })
            }
            
        elif path.endswith('/verify') and http_method == 'POST':
            # Parse request body
            body = json.loads(event.get('body', '{}'))
            token = body.get('token')
            
            if not token:
                # Check Authorization header as fallback
                auth_header = event.get('headers', {}).get('Authorization', '')
                if auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1]
                else:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': 'Token is required'
                        })
                    }
            
            # Verify token
            payload = verify_token(token)
            
            if not payload:
                return {
                    'statusCode': 401,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'Invalid or expired token'
                    })
                }
            
            # Get updated user info
            username = payload.get('username')
            try:
                response = table.get_item(Key={'username': username})
            except Exception as e:
                print(f"DynamoDB error: {str(e)}")
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'Database error'
                    })
                }
            
            if 'Item' not in response:
                return {
                    'statusCode': 401,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'User not found'
                    })
                }
            
            user = response['Item']
            
            # Return user info
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'message': 'Token is valid',
                    'user': {
                        'username': user.get('username'),
                        'email': user.get('email'),
                        'full_name': user.get('full_name'),
                        'role': user.get('role', 'guest')
                    }
                })
            }
            
        elif path.endswith('/register') and http_method == 'POST':
            # Parse request body
            body = json.loads(event.get('body', '{}'))
            
            # Validate required fields
            required_fields = ['username', 'password', 'email', 'full_name']
            for field in required_fields:
                if field not in body:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': f'Missing required field: {field}'
                        })
                    }
            
            username = body['username']
            password = body['password']
            email = body['email']
            full_name = body['full_name']
            role = body.get('role', 'guest')
            
            # Check if user already exists
            try:
                response = table.get_item(Key={'username': username})
                if 'Item' in response:
                    return {
                        'statusCode': 409,
                        'headers': headers,
                        'body': json.dumps({
                            'error': 'Username already exists'
                        })
                    }
            except Exception as e:
                print(f"DynamoDB error: {str(e)}")
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'Database error'
                    })
                }
            
            # Hash password (using simple hash for testing)
            password_hash = simple_hash_password(password)
            
            # Get current timestamp
            current_time = datetime.utcnow().isoformat() + 'Z'
            
            # Prepare user item for DynamoDB
            user_item = {
                'username': username,
                'password_hash': password_hash,
                'email': email,
                'full_name': full_name,
                'role': role,
                'created_at': current_time,
                'last_login': current_time
            }
            
            # Save to DynamoDB
            try:
                table.put_item(Item=user_item)
            except Exception as e:
                print(f"DynamoDB error: {str(e)}")
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'Database error'
                    })
                }
            
            # Generate JWT token
            token = generate_token(username, role)
            
            # Return success response
            return {
                'statusCode': 201,
                'headers': headers,
                'body': json.dumps({
                    'message': 'User registered successfully',
                    'token': token,
                    'user': {
                        'username': username,
                        'email': email,
                        'full_name': full_name,
                        'role': role
                    }
                })
            }
            
        else:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': f'Endpoint not found: {http_method} {path}'
                })
            }
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'details': str(e)
            })
        }