# DynamoDB Table Schemas

*Generated on: 2025-07-31 17:55:48 UTC*

## Overview

This document provides detailed schema information for the DynamoDB tables used in the Wedding App.

## Table: `heatherandwesley-users`

**Description:** Stores RSVP information for wedding guests

**Primary Key:** `id`

### Fields

| Field Name | Type(s) | Required | Description |
|------------|---------|----------|-------------|
| `attendance` | string | Yes | Guest's attendance status (e.g., 'attending', 'not_attending', 'maybe') |
| `created_at` | string | Yes | Timestamp when the RSVP was submitted (ISO 8601) |
| `dietary_restrictions` | string | Yes | Any dietary restrictions or allergies |
| `email` | string | Yes | Email address of the guest |
| `id` | string | Yes | Unique identifier for the RSVP entry (UUID v4) |
| `message_for_couple` | string | Yes | Personal message from the guest to the couple |
| `name` | string | Yes | Full name of the guest |
| `notifications` | boolean | Yes | Whether the guest opted in for notifications |
| `phone` | string | Yes | Phone number of the guest (optional) |
| `song_request` | string | Yes | Guest's song request for the reception |
| `updated_at` | string | Yes | Timestamp when the RSVP was last updated (ISO 8601) |

### Example Values

- **attendance**: `yes`, `no`
- **created_at**: `2025-07-31T03:08:48.791963Z`, `2025-07-31T11:57:38.493342Z`, `2025-07-31T11:49:20.827694Z`
- **dietary_restrictions**: ``
- **email**: `test@example.com`, `wesleybeckner@gmail.com`
- **id**: `2c2f0a3a-7191-4f36-870c-ab15e711817d`, `de2e97d0-56e4-48bb-ad46-ae2c124b68c6`, `d72e7f7f-6620-4d79-b16f-739cb664f2d1`
- **message_for_couple**: ``
- **name**: `Test Guest`, `Wesley Adam Beckner`
- **notifications**: `False`
- **phone**: ``, `8176766617`
- **song_request**: ``
- **updated_at**: `2025-07-31T03:08:48.791963Z`, `2025-07-31T11:57:38.493342Z`, `2025-07-31T11:49:20.827694Z`

---

## Usage Notes

### For Lambda Functions

When working with DynamoDB in Lambda functions:

1. **Decimal Handling**: DynamoDB uses Decimal type for numbers. Convert float to Decimal before storing:
   ```python
   from decimal import Decimal
   item['amount'] = Decimal(str(float_value))
   ```

2. **Required Fields**: Ensure all required fields are included when creating new items

3. **Timestamps**: Use ISO 8601 format with 'Z' suffix for UTC timestamps

### For Frontend Development

When sending data to the API:

1. **Required Fields**: Always include `name`, `email`, and `attendance`
2. **Boolean Fields**: Send as true/false, not strings
3. **Optional Fields**: Can be omitted or sent as empty strings
