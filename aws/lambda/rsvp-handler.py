import json
import os
import uuid
from datetime import datetime
from decimal import Decimal

import boto3

# Initialize DynamoDB resource
dynamodb = boto3.resource("dynamodb")
table_name = os.environ.get("TABLE_NAME", "heatherandwesley-users")
table = dynamodb.Table(table_name)


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


def lambda_handler(event, context):
    """
    Handle RSVP submissions from the wedding website
    """
    print(f"Received event: {json.dumps(event)}")

    # Parse HTTP method
    http_method = event.get("httpMethod", "GET")

    # Enable CORS
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    }

    # Handle preflight requests
    if http_method == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    try:
        if http_method == "POST":
            # Parse request body
            body = json.loads(event.get("body", "{}"))

            # Validate required fields
            required_fields = ["name", "email", "attendance"]
            for field in required_fields:
                if field not in body:
                    return {
                        "statusCode": 400,
                        "headers": headers,
                        "body": json.dumps(
                            {"error": f"Missing required field: {field}"}
                        ),
                    }

            # Generate unique ID
            rsvp_id = str(uuid.uuid4())

            # Get current timestamp
            current_time = datetime.utcnow().isoformat() + "Z"

            # Prepare item for DynamoDB
            item = {
                "id": rsvp_id,
                "name": body["name"],
                "email": body["email"],
                "phone": body.get("phone", ""),
                "attendance": body["attendance"],
                "notifications": body.get("notifications", False),
                "dietary_restrictions": body.get("dietary_restrictions", ""),
                "song_request": body.get("song_request", ""),
                "message_for_couple": body.get("message_for_couple", ""),
                "created_at": current_time,
                "updated_at": current_time,
            }

            # Convert any float values to Decimal for DynamoDB
            item = float_to_decimal(item)

            # Save to DynamoDB
            table.put_item(Item=item)

            # Return success response
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(
                    {
                        "message": "RSVP submitted successfully",
                        "data": decimal_to_float(item),
                    }
                ),
            }

        elif http_method == "GET":
            # Get RSVP by ID or email
            path_params = event.get("pathParameters", {}) or {}
            query_params = event.get("queryStringParameters", {}) or {}

            rsvp_id = path_params.get("id")
            email = query_params.get("email")

            if rsvp_id:
                # Get by ID
                response = table.get_item(Key={"id": rsvp_id})

                if "Item" not in response:
                    return {
                        "statusCode": 404,
                        "headers": headers,
                        "body": json.dumps({"error": "RSVP not found"}),
                    }

                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({"data": decimal_to_float(response["Item"])}),
                }
            elif email:
                # Get by email using scan (since email is not the primary key)
                response = table.scan(
                    FilterExpression="email = :email",
                    ExpressionAttributeValues={":email": email},
                )

                items = response.get("Items", [])
                if not items:
                    return {
                        "statusCode": 404,
                        "headers": headers,
                        "body": json.dumps({"error": "RSVP not found"}),
                    }

                # Return the first matching RSVP
                return {
                    "statusCode": 200,
                    "headers": headers,
                    "body": json.dumps({"data": decimal_to_float(items[0])}),
                }
            else:
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({"error": "Missing RSVP ID or email parameter"}),
                }

        else:
            return {
                "statusCode": 405,
                "headers": headers,
                "body": json.dumps({"error": f"Method {http_method} not allowed"}),
            }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": "Internal server error", "message": str(e)}),
        }
