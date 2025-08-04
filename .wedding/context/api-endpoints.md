# Wedding App API Documentation

## Overview

This document describes the API endpoints for the Wedding App RSVP system.

Generated on: 2025-07-31T18:31:12.767636Z

## Lambda Function Details

- **Function Name**: heatherandwesley-rsvp-handler

- **Runtime**: python3.11

- **Handler**: rsvp-handler.lambda_handler

- **Timeout**: 30 seconds

- **Memory**: 256 MB


### Environment Variables

- `TABLE_NAME`: heatherandwesley-users


## API Endpoints


### POST /rsvp

Submit a new RSVP for the wedding.


#### Request

```json
{
  "name": "string (required)",
  "email": "string (required)",
  "attendance": "yes|no (required)",
  "phone": "string (optional)",
  "notifications": "boolean (optional)",
  "dietary_restrictions": "string (optional)",
  "song_request": "string (optional)",
  "message_for_couple": "string (optional)"
}

```


#### Success Response (200)

```json
{
  "message": "RSVP submitted successfully",
  "data": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "phone": "string",
    "attendance": "string",
    "notifications": "boolean",
    "dietary_restrictions": "string",
    "song_request": "string",
    "message_for_couple": "string",
    "created_at": "ISO 8601 timestamp",
    "updated_at": "ISO 8601 timestamp"
  }
}

```


#### Error Response (400)

```json
{
  "error": "Missing required field: {field_name}"
}

```


### GET /rsvp/{id}

Retrieve an existing RSVP by ID.


#### Request

- **Path Parameter**: `id` - The UUID of the RSVP


#### Success Response (200)

```json
{
  "data": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "phone": "string",
    "attendance": "string",
    "notifications": "boolean",
    "dietary_restrictions": "string",
    "song_request": "string",
    "message_for_couple": "string",
    "created_at": "ISO 8601 timestamp",
    "updated_at": "ISO 8601 timestamp"
  }
}

```


#### Error Response (404)

```json
{
  "error": "RSVP not found"
}

```


### OPTIONS /rsvp

CORS preflight request.


#### Success Response (200)

Returns empty body with CORS headers.


## Common Response Headers


All responses include the following CORS headers:

```

Access-Control-Allow-Origin: *

Access-Control-Allow-Headers: Content-Type

Access-Control-Allow-Methods: GET, POST, OPTIONS

```


## Common Error Responses


### 400 Bad Request

Returned when required fields are missing or request is malformed.


### 404 Not Found

Returned when the requested RSVP ID does not exist.


### 405 Method Not Allowed

Returned when using an unsupported HTTP method.

```json
{
  "error": "Method {METHOD} not allowed"
}

```


### 500 Internal Server Error

Returned when an unexpected error occurs.

```json
{
  "error": "Internal server error",
  "message": "Error details"
}

```


## Test Examples


### Example: Submit RSVP

```bash

curl -X POST \

  https://your-api-gateway-url/rsvp \

  -H "Content-Type: application/json" \

  -d '{"name":"John Doe","email":"john@example.com","attendance":"yes"}'

```


### Example: Get RSVP

```bash

curl -X GET \

  https://your-api-gateway-url/rsvp/{rsvp-id}

```