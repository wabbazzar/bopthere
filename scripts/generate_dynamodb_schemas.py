#!/usr/bin/env python3
"""
DynamoDB Schema Extractor for Wedding App
Extracts and documents DynamoDB table schemas for the heatherandwesley-users table
"""

import json
import logging
import os
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set

import boto3
from boto3.dynamodb.types import TypeDeserializer

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class DynamoDBSchemaExtractor:
    """Extract and document DynamoDB table schemas"""

    def __init__(self, profile_name: str = None, region: str = "us-east-1"):
        """
        Initialize the schema extractor with AWS credentials

        Args:
            profile_name: AWS profile name
            region: AWS region
        """
        try:
            # Initialize boto3 session with profile
            if profile_name:
                session = boto3.Session(profile_name=profile_name, region_name=region)
            else:
                # Use environment credentials (e.g., in GitHub Actions)
                session = boto3.Session(region_name=region)
            self.dynamodb = session.resource("dynamodb")
            self.dynamodb_client = session.client("dynamodb")
            self.type_deserializer = TypeDeserializer()
            logger.info(
                f"Initialized DynamoDB client with profile '{profile_name}' in region '{region}'"
            )
        except Exception as e:
            logger.error(f"Failed to initialize DynamoDB client: {e}")
            raise

    def _deserialize_dynamodb_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Convert DynamoDB item format to regular Python dict"""
        return {k: self.type_deserializer.deserialize(v) for k, v in item.items()}

    def _decimal_to_json_serializable(self, obj: Any) -> Any:
        """Convert Decimal objects to JSON-serializable format"""
        if isinstance(obj, Decimal):
            return float(obj) if obj % 1 else int(obj)
        elif isinstance(obj, dict):
            return {k: self._decimal_to_json_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._decimal_to_json_serializable(v) for v in obj]
        return obj

    def _infer_field_type(self, value: Any) -> str:
        """Infer the field type from a value"""
        if value is None:
            return "null"
        elif isinstance(value, bool):
            return "boolean"
        elif isinstance(value, (int, Decimal)):
            return "number"
        elif isinstance(value, str):
            return "string"
        elif isinstance(value, dict):
            return "object"
        elif isinstance(value, list):
            return "array"
        else:
            return "unknown"

    def _get_field_description(self, field_name: str) -> str:
        """Get human-readable description for known fields"""
        descriptions = {
            "id": "Unique identifier for the RSVP entry (UUID v4)",
            "name": "Full name of the guest",
            "email": "Email address of the guest",
            "phone": "Phone number of the guest (optional)",
            "attendance": "Guest's attendance status (e.g., 'attending', 'not_attending', 'maybe')",
            "notifications": "Whether the guest opted in for notifications",
            "dietary_restrictions": "Any dietary restrictions or allergies",
            "song_request": "Guest's song request for the reception",
            "message_for_couple": "Personal message from the guest to the couple",
            "created_at": "Timestamp when the RSVP was submitted (ISO 8601)",
            "updated_at": "Timestamp when the RSVP was last updated (ISO 8601)",
        }
        return descriptions.get(field_name, f"Field: {field_name}")

    def get_table_schema(self, table_name: str) -> Dict[str, Any]:
        """
        Get comprehensive schema information for a table

        Args:
            table_name: Name of the DynamoDB table

        Returns:
            Dictionary containing table schema information
        """
        try:
            logger.info(f"Extracting schema for table: {table_name}")

            # Get table description
            table = self.dynamodb.Table(table_name)
            table_description = self.dynamodb_client.describe_table(
                TableName=table_name
            )

            # Extract key schema
            key_schema = table_description["Table"]["KeySchema"]
            attribute_definitions = table_description["Table"]["AttributeDefinitions"]

            # Scan table to discover all fields
            logger.info("Scanning table for sample items...")
            response = table.scan(
                Limit=100
            )  # Scan up to 100 items for schema discovery
            items = response.get("Items", [])

            # Discover all fields and their types
            field_info = defaultdict(
                lambda: {
                    "types": set(),
                    "required": True,
                    "examples": [],
                    "description": "",
                }
            )

            # Analyze each item
            for item in items:
                item_fields = set(item.keys())

                # Track which fields appear in this item
                for field_name, value in item.items():
                    field_type = self._infer_field_type(value)
                    field_info[field_name]["types"].add(field_type)

                    # Collect example values (limit to 3)
                    if (
                        len(field_info[field_name]["examples"]) < 3
                        and value is not None
                    ):
                        example_value = self._decimal_to_json_serializable(value)
                        if example_value not in field_info[field_name]["examples"]:
                            field_info[field_name]["examples"].append(example_value)

                    # Add description
                    if not field_info[field_name]["description"]:
                        field_info[field_name][
                            "description"
                        ] = self._get_field_description(field_name)

                # Check which fields are missing (not required)
                all_fields = set(field_info.keys())
                missing_fields = all_fields - item_fields
                for missing_field in missing_fields:
                    field_info[missing_field]["required"] = False

            # Convert sets to lists for JSON serialization
            fields_schema = {}
            for field_name, info in field_info.items():
                fields_schema[field_name] = {
                    "types": list(info["types"]),
                    "required": info["required"],
                    "examples": info["examples"],
                    "description": info["description"],
                }

            # Build complete schema
            schema = {
                "tableName": table_name,
                "description": "Stores RSVP information for wedding guests",
                "keySchema": {
                    "partitionKey": next(
                        k["AttributeName"] for k in key_schema if k["KeyType"] == "HASH"
                    ),
                    "sortKey": next(
                        (
                            k["AttributeName"]
                            for k in key_schema
                            if k["KeyType"] == "RANGE"
                        ),
                        None,
                    ),
                },
                "attributes": {
                    attr["AttributeName"]: attr["AttributeType"]
                    for attr in attribute_definitions
                },
                "fields": fields_schema,
                "sampleCount": len(items),
                "extractedAt": datetime.utcnow().isoformat() + "Z",
            }

            logger.info(
                f"Successfully extracted schema for {table_name} with {len(fields_schema)} fields"
            )
            return schema

        except Exception as e:
            logger.error(f"Error extracting schema for table {table_name}: {e}")
            raise

    def extract_all_schemas(self) -> Dict[str, Any]:
        """
        Extract schemas for all relevant tables

        Returns:
            Dictionary containing all table schemas
        """
        tables_to_extract = ["heatherandwesley-users"]
        schemas = {}

        for table_name in tables_to_extract:
            try:
                schemas[table_name] = self.get_table_schema(table_name)
            except Exception as e:
                logger.warning(f"Failed to extract schema for {table_name}: {e}")
                continue

        return schemas

    def generate_json_schema(self, schemas: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert extracted schemas to JSON Schema format

        Args:
            schemas: Dictionary of extracted schemas

        Returns:
            JSON Schema formatted dictionary
        """
        json_schemas = {}

        for table_name, schema in schemas.items():
            # Build JSON Schema properties
            properties = {}
            required_fields = []

            for field_name, field_info in schema["fields"].items():
                # Determine primary type
                types = field_info["types"]
                if len(types) == 1:
                    field_type = list(types)[0]
                else:
                    # Handle multiple types
                    field_type = "string"  # Default to string for mixed types

                # Map to JSON Schema types
                type_mapping = {
                    "string": "string",
                    "number": "number",
                    "boolean": "boolean",
                    "object": "object",
                    "array": "array",
                    "null": "null",
                }

                properties[field_name] = {
                    "type": type_mapping.get(field_type, "string"),
                    "description": field_info["description"],
                }

                # Add examples if available
                if field_info["examples"]:
                    properties[field_name]["examples"] = field_info["examples"]

                # Track required fields
                if field_info["required"]:
                    required_fields.append(field_name)

            # Build complete JSON Schema
            json_schemas[table_name] = {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": table_name,
                "description": schema["description"],
                "type": "object",
                "properties": properties,
                "required": required_fields,
                "additionalProperties": False,
            }

        return {
            "schemas": json_schemas,
            "metadata": {
                "extractedAt": datetime.utcnow().isoformat() + "Z",
                "version": "1.0.0",
            },
        }

    def generate_markdown_docs(self, schemas: Dict[str, Any]) -> str:
        """
        Generate human-readable Markdown documentation

        Args:
            schemas: Dictionary of extracted schemas

        Returns:
            Markdown formatted string
        """
        md_lines = [
            "# DynamoDB Table Schemas",
            "",
            f"*Generated on: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}*",
            "",
            "## Overview",
            "",
            "This document provides detailed schema information for the DynamoDB tables used in the Wedding App.",
            "",
        ]

        for table_name, schema in schemas.items():
            md_lines.extend(
                [
                    f"## Table: `{table_name}`",
                    "",
                    f"**Description:** {schema['description']}",
                    "",
                    f"**Primary Key:** `{schema['keySchema']['partitionKey']}`",
                    "",
                ]
            )

            if schema["keySchema"]["sortKey"]:
                md_lines.append(f"**Sort Key:** `{schema['keySchema']['sortKey']}`")
                md_lines.append("")

            # Add fields table
            md_lines.extend(
                [
                    "### Fields",
                    "",
                    "| Field Name | Type(s) | Required | Description |",
                    "|------------|---------|----------|-------------|",
                ]
            )

            # Sort fields by required status and then alphabetically
            sorted_fields = sorted(
                schema["fields"].items(), key=lambda x: (not x[1]["required"], x[0])
            )

            for field_name, field_info in sorted_fields:
                types = ", ".join(field_info["types"])
                required = "Yes" if field_info["required"] else "No"
                description = field_info["description"]

                md_lines.append(
                    f"| `{field_name}` | {types} | {required} | {description} |"
                )

            md_lines.append("")

            # Add example values section
            md_lines.extend(["### Example Values", ""])

            for field_name, field_info in sorted_fields:
                if field_info["examples"]:
                    examples = ", ".join(
                        [f"`{ex}`" for ex in field_info["examples"][:3]]
                    )
                    md_lines.append(f"- **{field_name}**: {examples}")

            md_lines.extend(["", "---", ""])

        # Add usage notes
        md_lines.extend(
            [
                "## Usage Notes",
                "",
                "### For Lambda Functions",
                "",
                "When working with DynamoDB in Lambda functions:",
                "",
                "1. **Decimal Handling**: DynamoDB uses Decimal type for numbers. Convert float to Decimal before storing:",
                "   ```python",
                "   from decimal import Decimal",
                "   item['amount'] = Decimal(str(float_value))",
                "   ```",
                "",
                "2. **Required Fields**: Ensure all required fields are included when creating new items",
                "",
                "3. **Timestamps**: Use ISO 8601 format with 'Z' suffix for UTC timestamps",
                "",
                "### For Frontend Development",
                "",
                "When sending data to the API:",
                "",
                "1. **Required Fields**: Always include `name`, `email`, and `attendance`",
                "2. **Boolean Fields**: Send as true/false, not strings",
                "3. **Optional Fields**: Can be omitted or sent as empty strings",
                "",
            ]
        )

        return "\n".join(md_lines)

    def save_outputs(self, schemas: Dict[str, Any]) -> None:
        """
        Save extracted schemas to JSON and Markdown files

        Args:
            schemas: Dictionary of extracted schemas
        """
        # Ensure output directory exists
        output_dir = ".wedding/context"
        os.makedirs(output_dir, exist_ok=True)

        # Generate outputs
        json_schema = self.generate_json_schema(schemas)
        markdown_docs = self.generate_markdown_docs(schemas)

        # Save JSON schema
        json_path = os.path.join(output_dir, "dynamodb-schemas.json")
        with open(json_path, "w") as f:
            json.dump(json_schema, f, indent=2, default=str)
        logger.info(f"Saved JSON schema to {json_path}")

        # Save Markdown documentation
        md_path = os.path.join(output_dir, "field-mappings.md")
        with open(md_path, "w") as f:
            f.write(markdown_docs)
        logger.info(f"Saved Markdown documentation to {md_path}")


def main():
    """Main function to run the schema extraction"""
    try:
        # Initialize extractor
        # Use profile in local environment, environment credentials in CI
        profile_name = "personal" if os.path.exists(os.path.expanduser("~/.aws/credentials")) else None
        extractor = DynamoDBSchemaExtractor(profile_name=profile_name, region="us-east-1")

        # Extract schemas
        logger.info("Starting schema extraction...")
        schemas = extractor.extract_all_schemas()

        if not schemas:
            logger.error("No schemas were extracted")
            return

        # Save outputs
        extractor.save_outputs(schemas)

        logger.info("Schema extraction completed successfully!")

    except Exception as e:
        logger.error(f"Schema extraction failed: {e}")
        raise


if __name__ == "__main__":
    main()
