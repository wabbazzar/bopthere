"""
Photos List Handler Lambda Function

Lists all photos from the S3 bucket for the photos gallery.
Enriches photo metadata with user information from DynamoDB.

Environment Variables:
- S3_BUCKET: S3 bucket name for photo storage (e.g., heatherandwesley-bingo-photos)
- USERS_TABLE: DynamoDB table for user information (e.g., heatherandwesley-users)
"""

import json
import boto3
import os
from datetime import datetime

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

S3_BUCKET = os.environ.get('S3_BUCKET', 'heatherandwesley-bingo-photos')
USERS_TABLE = os.environ.get('USERS_TABLE', 'heatherandwesley-users')

# CORS configuration
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
}


def get_user_display_name(user_id):
    """Get user's full name from DynamoDB users table"""
    try:
        table = dynamodb.Table(USERS_TABLE)
        response = table.get_item(Key={'username': user_id})
        if 'Item' in response:
            return response['Item'].get('full_name', user_id)
    except Exception as e:
        print(f"Error fetching user info for {user_id}: {str(e)}")
    return user_id


def lambda_handler(event, context):
    """
    List all photos from S3 bucket
    GET /photos/list

    Query Parameters:
    - limit: Max number of photos to return (default: 100)
    - continuation_token: For pagination

    Returns:
    {
        "photos": [
            {
                "url": "https://bucket.s3.amazonaws.com/user/photo.jpg",
                "user_id": "username",
                "user_name": "Full Name",
                "uploaded_at": "2025-10-27T12:00:00",
                "size": 12345
            }
        ],
        "count": 10,
        "has_more": false,
        "next_token": "optional_continuation_token"
    }
    """
    print(f"Received event: {json.dumps(event)}")

    # Handle preflight OPTIONS request
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': ''
        }

    try:
        # Get query parameters
        params = event.get('queryStringParameters') or {}
        limit = int(params.get('limit', 100))
        continuation_token = params.get('continuation_token')

        # List objects from S3
        list_params = {
            'Bucket': S3_BUCKET,
            'MaxKeys': limit
        }

        if continuation_token:
            list_params['ContinuationToken'] = continuation_token

        response = s3_client.list_objects_v2(**list_params)

        # Process photos
        photos = []
        for obj in response.get('Contents', []):
            key = obj['Key']

            # Parse user_id from key (format: {user_id}/{timestamp}.jpg or {user_id}/{square_position}_{timestamp}.jpg)
            parts = key.split('/')
            if len(parts) >= 2:
                user_id = parts[0]
                filename = parts[-1]

                # Extract timestamp from filename if available
                try:
                    # Handle both bingo format (position_timestamp.jpg) and general format (timestamp.jpg)
                    timestamp_str = filename.split('.')[0].split('_')[-1]
                    uploaded_at = datetime.fromtimestamp(int(timestamp_str) / 1000).isoformat()
                except (ValueError, IndexError):
                    # Fallback to S3 LastModified if timestamp parsing fails
                    uploaded_at = obj['LastModified'].isoformat()

                # Get user display name
                user_name = get_user_display_name(user_id)

                photos.append({
                    'url': f"https://{S3_BUCKET}.s3.amazonaws.com/{key}",
                    'user_id': user_id,
                    'user_name': user_name,
                    'uploaded_at': uploaded_at,
                    'size': obj['Size']
                })

        # Sort by upload date (newest first)
        photos.sort(key=lambda x: x['uploaded_at'], reverse=True)

        result = {
            'photos': photos,
            'count': len(photos),
            'has_more': response.get('IsTruncated', False)
        }

        if response.get('NextContinuationToken'):
            result['next_token'] = response['NextContinuationToken']

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps(result)
        }

    except Exception as e:
        print(f"Error listing photos: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': str(e)})
        }
