"""
Bingo Photo Handler Lambda Function

Handles photo uploads for the Wedding Bingo game.
Uploads photos to S3 and returns public URL.

Environment Variables:
- S3_BUCKET: S3 bucket name for photo storage (e.g., heatherandwesley-bingo-photos)
"""

import json
import boto3
import base64
import os
from datetime import datetime

# Initialize S3 client
s3_client = boto3.client('s3')
S3_BUCKET = os.environ.get('S3_BUCKET', 'heatherandwesley-bingo-photos')

# CORS headers for all responses
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',  # Allow all origins for development; restrict in production
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
}


def handle_delete(event, s3_client, S3_BUCKET, CORS_HEADERS):
    """
    Handle DELETE request - delete photo from S3 with user ownership verification

    Expected payload:
    {
        "user_id": "username",
        "photo_url": "https://bucket.s3.amazonaws.com/username/timestamp.jpg"
    }

    Returns:
    {
        "success": true,
        "message": "Photo deleted successfully"
    }
    """
    from urllib.parse import unquote

    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        user_id = body.get('user_id')
        photo_url = body.get('photo_url')

        if not user_id or not photo_url:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': 'Missing user_id or photo_url'
                })
            }

        # Extract S3 key from photo URL
        # URL format: https://bucket.s3.amazonaws.com/username/square_position_timestamp.jpg
        # Or: https://bucket.s3.us-east-1.amazonaws.com/username/square_position_timestamp.jpg
        try:
            # Handle both regional and non-regional S3 URLs
            if f'{S3_BUCKET}.s3' in photo_url:
                url_parts = photo_url.split(f'{S3_BUCKET}.s3')
                if len(url_parts) < 2:
                    raise ValueError('Invalid photo URL format')

                # Get the path after the domain (skip region part if present)
                path_part = url_parts[1]
                # Remove .amazonaws.com or .us-east-1.amazonaws.com prefix
                if path_part.startswith('.'):
                    path_part = path_part.split('/', 1)[1] if '/' in path_part else ''

                s3_key = unquote(path_part.lstrip('/'))  # Decode URL encoding and remove leading slash
            else:
                raise ValueError('Photo URL does not match expected S3 bucket')

        except (IndexError, ValueError) as e:
            print(f"Error parsing photo URL: {str(e)}, URL: {photo_url}")
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': 'Invalid photo URL format'
                })
            }

        # SECURITY: Verify user owns the photo
        # S3 key format: {user_id}/{square_position}_{timestamp}.jpg
        # User can only delete photos in their own folder
        print(f"Parsed S3 key: {s3_key} for user: {user_id}")

        if not s3_key.startswith(f'{user_id}/'):
            print(f"Security violation: User {user_id} attempted to delete {s3_key}")
            return {
                'statusCode': 403,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': 'You can only delete your own photos'
                })
            }

        # Verify photo exists in S3 before attempting deletion
        try:
            s3_client.head_object(Bucket=S3_BUCKET, Key=s3_key)
            print(f"Photo found in S3: {s3_key}")
        except Exception as e:
            error_code = e.response.get('Error', {}).get('Code', '') if hasattr(e, 'response') else ''
            print(f"S3 head_object error: {error_code}, {str(e)}")

            if error_code == '404' or error_code == 'NoSuchKey' or '404' in str(e):
                # Photo doesn't exist - treat as already deleted (idempotent operation)
                print(f"Photo not found (already deleted?): {s3_key}")
                return {
                    'statusCode': 200,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({
                        'success': True,
                        'message': 'Photo deleted successfully'
                    })
                }

            # Other errors
            print(f"Error checking photo existence: {str(e)}")
            return {
                'statusCode': 500,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': f'Failed to verify photo: {str(e)}'
                })
            }

        # Delete photo from S3
        try:
            s3_client.delete_object(
                Bucket=S3_BUCKET,
                Key=s3_key
            )
            print(f"Successfully deleted photo: {s3_key} by user: {user_id}")
        except Exception as e:
            print(f"S3 deletion error: {str(e)}")
            return {
                'statusCode': 500,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': f'Failed to delete photo from S3: {str(e)}'
                })
            }

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': True,
                'message': 'Photo deleted successfully'
            })
        }

    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': f'Invalid JSON in request body: {str(e)}'
            })
        }
    except Exception as e:
        print(f"Unexpected error deleting photo: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': 'Internal server error'
            })
        }


def lambda_handler(event, context):
    """
    Handle photo operations (upload and deletion)

    POST - Upload photo to S3 (existing functionality)
    DELETE - Delete photo from S3 (new functionality)
    OPTIONS - CORS preflight
    """

    http_method = event.get('httpMethod', '')

    # Handle preflight OPTIONS request
    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': ''
        }

    # Route to appropriate handler based on HTTP method
    if http_method == 'DELETE':
        return handle_delete(event, s3_client, S3_BUCKET, CORS_HEADERS)
    elif http_method == 'POST':
        # Existing upload logic continues below
        pass
    else:
        return {
            'statusCode': 405,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': f'Method {http_method} not allowed'
            })
        }

    # POST handler - existing upload logic

    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        user_id = body.get('user_id')
        square_position = body.get('square_position')
        photo_data = body.get('photo_data')

        # Validate required fields
        if not all([user_id, square_position is not None, photo_data]):
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': 'Missing required fields: user_id, square_position, photo_data'
                })
            }

        # Validate square_position is in valid range
        # -1 = general photo (non-bingo), 0-24 = bingo square positions
        if not isinstance(square_position, int) or square_position < -1 or square_position > 24:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': 'Invalid square_position: must be -1 (general photo) or 0-24 (bingo square)'
                })
            }

        # Decode base64 photo
        try:
            photo_bytes = base64.b64decode(photo_data)
        except Exception as e:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': f'Invalid base64 photo data: {str(e)}'
                })
            }

        # Generate timestamp for uniqueness
        timestamp = int(datetime.utcnow().timestamp() * 1000)

        # S3 key: {user_id}/{square_position}_{timestamp}.jpg
        key = f"{user_id}/{square_position}_{timestamp}.jpg"

        # Upload to S3 (public access controlled by bucket policy)
        try:
            s3_client.put_object(
                Bucket=S3_BUCKET,
                Key=key,
                Body=photo_bytes,
                ContentType='image/jpeg'
            )
        except Exception as e:
            print(f"S3 upload error: {str(e)}")
            return {
                'statusCode': 500,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': f'Failed to upload photo to S3: {str(e)}'
                })
            }

        # Generate public URL
        photo_url = f"https://{S3_BUCKET}.s3.amazonaws.com/{key}"

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': True,
                'photo_url': photo_url,
                'square_position': square_position
            })
        }

    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': f'Invalid JSON in request body: {str(e)}'
            })
        }
    except Exception as e:
        print(f"Unexpected error uploading photo: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': 'Internal server error'
            })
        }
