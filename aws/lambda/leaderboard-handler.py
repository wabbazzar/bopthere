import json
import logging
import os
from datetime import datetime
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB resource
dynamodb = boto3.resource("dynamodb")
table_name = os.environ.get("TABLE_NAME", "heatherandwesley-leaderboard")
table = dynamodb.Table(table_name)

# Auth Lambda verification endpoint
AUTH_LAMBDA_NAME = os.environ.get("AUTH_LAMBDA_NAME", "heatherandwesley-auth-handler")
lambda_client = boto3.client("lambda")

# CORS configuration
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "https://heatherandwesley.com,http://localhost:5173,http://localhost:8080,http://localhost:5174",
).split(",")


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


def get_cors_headers(origin):
    """Get CORS headers based on request origin"""
    # Check if origin is in allowed list
    if origin in ALLOWED_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400",
        }
    # Default to production origin
    return {
        "Access-Control-Allow-Origin": "https://heatherandwesley.com",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    }


def verify_jwt_token(token):
    """Verify JWT token via auth Lambda"""
    try:
        # First try to call auth Lambda to verify token
        response = lambda_client.invoke(
            FunctionName=AUTH_LAMBDA_NAME,
            InvocationType="RequestResponse",
            Payload=json.dumps(
                {
                    "httpMethod": "POST",
                    "path": "/auth/verify",
                    "body": json.dumps({"token": token}),
                }
            ),
        )

        # Parse response
        payload = json.loads(response["Payload"].read())
        if payload.get("statusCode") == 200:
            body = json.loads(payload.get("body", "{}"))
            return body.get("user")

        return None
    except lambda_client.exceptions.ResourceNotFoundException:
        # Fallback to local JWT verification for testing
        logger.warning("Auth Lambda not found, using local JWT verification")
        import jwt

        JWT_SECRET = os.environ.get(
            "JWT_SECRET", "development-secret-key-change-in-production"
        )
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            if "username" in payload:
                return {
                    "username": payload["username"],
                    "role": payload.get("role", "guest"),
                    "email": payload.get("email", ""),
                    "full_name": payload.get("full_name", ""),
                }
        except Exception as jwt_error:
            logger.error(f"Local JWT verification failed: {str(jwt_error)}")
        return None
    except Exception as e:
        logger.error(f"Error verifying token: {str(e)}")
        return None


def get_top_scores(game, limit=10):
    """Get top scores for a game"""
    try:
        # Query scores for the game, sorted by score_timestamp in ascending order
        # Note: score_timestamp uses inverted scores (999999999-score), so ascending order gives highest scores first
        response = table.query(
            KeyConditionExpression=Key("game").eq(game),
            ScanIndexForward=True,  # Sort in ascending order of composite key (which gives descending score order)
            Limit=limit,
        )

        items = response.get("Items", [])

        # Convert Decimal to float for JSON serialization
        scores = []
        for item in items:
            score_data = {
                "username": item.get("username"),
                "score": decimal_to_float(item.get("score")),
                "timestamp": item.get("timestamp"),
                "character": item.get("character"),
            }
            scores.append(score_data)

        # Get total unique players count
        all_scores = table.query(KeyConditionExpression=Key("game").eq(game))
        unique_players = set(
            item.get("username") for item in all_scores.get("Items", [])
        )

        return {"game": game, "scores": scores, "total_players": len(unique_players)}

    except Exception as e:
        logger.error(f"Error getting top scores: {str(e)}")
        raise


def submit_score(game, username, score, character):
    """Submit a new score and maintain top 10"""
    try:
        timestamp = datetime.utcnow().isoformat() + "Z"

        # Special handling for bingo: one score per user
        if game == "bingo":
            # For bingo, delete any existing scores for this user first
            # Query all scores for this game
            response = table.query(KeyConditionExpression=Key("game").eq(game))

            # Find and delete existing entries for this user
            for item in response.get("Items", []):
                if item.get("username") == username:
                    table.delete_item(
                        Key={
                            "game": game,
                            "score_timestamp": item["score_timestamp"],
                        }
                    )
                    logger.info(f"Deleted existing bingo score for {username}")

        # Create composite key for sorting (higher scores get lower sort keys)
        # Format: 999999999-score#timestamp
        score_timestamp = (
            f"{999999999 - int(score):09d}#{timestamp}"
        )

        # Prepare item
        item = {
            "game": game,
            "score_timestamp": score_timestamp,
            "username": username,
            "score": Decimal(str(score)),
            "timestamp": timestamp,
            "character": character,
        }

        # Put the new score
        table.put_item(Item=item)
        logger.info(f"Submitted score for {username}: {score}")

        # Get all scores to maintain top 10
        response = table.query(
            KeyConditionExpression=Key("game").eq(game),
            ScanIndexForward=True,  # Sort in ascending order of composite key (which gives descending score order)
        )

        items = response.get("Items", [])

        # If more than 10 scores, delete the extras
        if len(items) > 10:
            for item_to_delete in items[10:]:
                table.delete_item(
                    Key={
                        "game": game,
                        "score_timestamp": item_to_delete["score_timestamp"],
                    }
                )

        return True

    except Exception as e:
        logger.error(f"Error submitting score: {str(e)}")
        raise


def lambda_handler(event, context):
    """
    Handle leaderboard requests
    GET /leaderboard/{game} - Get top 10 scores
    POST /leaderboard/{game} - Submit new score (authenticated)
    """
    logger.info(f"Received event: {json.dumps(event, default=str)}")

    # Parse HTTP method and path
    http_method = event.get("httpMethod", "GET")
    path = event.get("path", "")

    # Get request origin
    headers_dict = event.get("headers", {})
    origin = headers_dict.get("origin") or headers_dict.get("Origin", "")

    # Set CORS headers based on origin
    headers = get_cors_headers(origin)

    # Handle preflight requests
    if http_method == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    try:
        # Extract game from path
        path_parts = path.strip("/").split("/")
        if len(path_parts) < 2 or path_parts[0] != "leaderboard":
            return {
                "statusCode": 404,
                "headers": headers,
                "body": json.dumps({"error": "Invalid endpoint"}),
            }

        game = path_parts[1]

        if http_method == "GET":
            # Get top scores
            result = get_top_scores(game)

            return {"statusCode": 200, "headers": headers, "body": json.dumps(result)}

        elif http_method == "POST":
            # Verify authentication
            auth_header = ""
            for key, value in headers_dict.items():
                if key.lower() == "authorization":
                    auth_header = value
                    break

            if not auth_header.startswith("Bearer "):
                return {
                    "statusCode": 401,
                    "headers": headers,
                    "body": json.dumps({"error": "Authorization required"}),
                }

            token = auth_header[7:]  # Remove 'Bearer ' prefix
            user = verify_jwt_token(token)

            if not user:
                return {
                    "statusCode": 401,
                    "headers": headers,
                    "body": json.dumps({"error": "Invalid or expired token"}),
                }

            # Parse request body
            body = json.loads(event.get("body", "{}"))

            # Validate required fields
            score = body.get("score")
            character = body.get("character")

            if score is None or not character:
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({"error": "Score and character are required"}),
                }

            # Submit the score with full name for display
            # Use full_name if available, otherwise fall back to username
            display_name = user.get("full_name", user.get("username", "Anonymous"))
            submit_score(game, display_name, score, character)

            # Get updated leaderboard
            result = get_top_scores(game)

            return {
                "statusCode": 201,
                "headers": headers,
                "body": json.dumps(
                    {"message": "Score submitted successfully", "leaderboard": result}
                ),
            }

        else:
            return {
                "statusCode": 405,
                "headers": headers,
                "body": json.dumps({"error": "Method not allowed"}),
            }

    except Exception as e:
        logger.error(f"Error in leaderboard handler: {str(e)}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": "Internal server error"}),
        }
