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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
}


def lambda_handler(event, context):
    """
    Upload bingo photo to S3

    Expected payload:
    {
        "user_id": "username",
        "square_position": 0-24,
        "photo_data": "base64_encoded_image_data"
    }

    Returns:
    {
        "success": true,
        "photo_url": "https://bucket.s3.amazonaws.com/path/to/photo.jpg",
        "square_position": 0
    }
    """

    # Handle preflight OPTIONS request
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': ''
        }

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
        if not isinstance(square_position, int) or square_position < 0 or square_position > 24:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': 'Invalid square_position: must be integer 0-24'
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
