import json
import logging
import os
from datetime import datetime

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    """Health check endpoint for wedding app services"""

    try:
        # Initialize AWS clients with us-east-1
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

        # Check DynamoDB tables
        tables_status = {}
        required_tables = [
            "heatherandwesley-users",
            "heatherandwesley-auth-users",
            "heatherandwesley-leaderboard",
        ]

        for table_name in required_tables:
            try:
                table = dynamodb.Table(table_name)
                table.load()
                tables_status[table_name] = {"status": "active", "region": "us-east-1"}
            except Exception as e:
                logger.error(f"Error checking table {table_name}: {str(e)}")
                tables_status[table_name] = {"status": "error", "error": str(e)}

        # Check Lambda functions
        lambda_client = boto3.client("lambda", region_name="us-east-1")
        lambda_status = {}
        required_lambdas = [
            "heatherandwesley-rsvp-handler",
            "heatherandwesley-auth-handler",
            "heatherandwesley-leaderboard-handler",
        ]

        for lambda_name in required_lambdas:
            try:
                response = lambda_client.get_function(FunctionName=lambda_name)
                lambda_status[lambda_name] = {
                    "status": "active",
                    "region": response["Configuration"].get("Region", "unknown"),
                }
            except Exception as e:
                logger.error(f"Error checking Lambda {lambda_name}: {str(e)}")
                lambda_status[lambda_name] = {"status": "error", "error": str(e)}

        # Overall health status
        all_healthy = all(
            status["status"] == "active"
            for status in {**tables_status, **lambda_status}.values()
        )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET,OPTIONS",
            },
            "body": json.dumps(
                {
                    "status": "healthy" if all_healthy else "degraded",
                    "timestamp": datetime.utcnow().isoformat(),
                    "region": "us-east-1",
                    "services": {"dynamodb": tables_status, "lambda": lambda_status},
                }
            ),
        }

    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET,OPTIONS",
            },
            "body": json.dumps(
                {
                    "status": "error",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": str(e),
                }
            ),
        }
