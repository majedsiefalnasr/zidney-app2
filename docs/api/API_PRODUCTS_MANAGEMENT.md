# API Products Management

## Overview

The Products Management API provides comprehensive endpoints for managing exam products in the
Zidney platform. This is part of the MMC (Master Management Console) and manages the product catalog
with version control and audit logging.

## Base URL

- **Production**: `https://api.zidney.io/mmc`
- **Development**: `http://localhost:3000/mmc`

## Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" https://api.zidney.io/mmc/products
```

## Rate Limiting

Rate limits are enforced per endpoint:

| Endpoint                     | Limit | Window   |
| ---------------------------- | ----- | -------- |
| POST /products               | 10    | 1 minute |
| GET /products                | 20    | 1 minute |
| GET /products/{id}           | 30    | 1 minute |
| PUT /products/{id}           | 10    | 1 minute |
| PATCH /products/{id}/status  | 10    | 1 minute |
| DELETE /products/{id}        | 5     | 1 minute |
| GET /products/{id}/audit-log | 20    | 1 minute |

Rate limit information is included in response headers:

- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Response Format

All API responses follow a consistent format:

### Success Response (2xx)

```json
{
  "success": true,
  "data": {
    "id": "prod-123",
    "name": { "en": "Product Name", "ar": "اسم المنتج" },
    "slug": "product-slug",
    "description": "Product description",
    "enabled_modules": ["MODULE_ASSESSMENT", "MODULE_ATTEMPT"],
    "status": "ACTIVE",
    "current_version": 1,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "error": null
}
```

### Error Response (4xx, 5xx)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "DUPLICATE_SLUG",
    "message": "Product with this slug already exists"
  }
}
```

## Endpoints

### 1. Create Product

**POST** `/products`

Create a new product with initial version 1.

**Permissions**: admin

**Request Body**:

```json
{
  "name": {
    "en": "Calculus Assessment",
    "ar": "تقييم الحساب"
  },
  "slug": "calculus-assessment",
  "description": "Comprehensive calculus assessment",
  "enabled_modules": ["MODULE_ASSESSMENT", "MODULE_ATTEMPT", "MODULE_REPORTING"]
}
```

**Response**: 201 Created

```json
{
  "success": true,
  "data": {
    "id": "prod-550e8400-e29b-41d4-a716-446655440000",
    "name": { "en": "Calculus Assessment", "ar": "تقييم الحساب" },
    "slug": "calculus-assessment",
    "description": "Comprehensive calculus assessment",
    "enabled_modules": ["MODULE_ASSESSMENT", "MODULE_ATTEMPT", "MODULE_REPORTING"],
    "status": "ACTIVE",
    "current_version": 1,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "error": null
}
```

**Errors**:

- `400 Bad Request`: Invalid input (INVALID_MODULE_ENUM, INVALID_NAME_LOCALIZATION)
- `409 Conflict`: Duplicate slug (DUPLICATE_SLUG)

### 2. List Products

**GET** `/products`

Retrieve paginated list of products with optional filtering and sorting.

**Permissions**: read

**Query Parameters**:

| Parameter  | Type    | Default    | Description                                          |
| ---------- | ------- | ---------- | ---------------------------------------------------- |
| status     | string  | ACTIVE     | Filter by status: ACTIVE, INACTIVE, or all           |
| search     | string  | -          | Search by name or slug (substring, case-insensitive) |
| module     | string  | -          | Filter by enabled module                             |
| limit      | integer | 10         | Items per page (max: 100)                            |
| offset     | integer | 0          | Pagination offset                                    |
| sort_by    | string  | created_at | Field to sort by: created_at, updated_at, name       |
| sort_order | string  | desc       | Sort order: asc, desc                                |

**Example**:

```bash
GET /products?status=ACTIVE&search=calculus&limit=10&offset=0&sort_by=updated_at&sort_order=desc
```

**Response**: 200 OK

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "prod-550e8400-e29b-41d4-a716-446655440000",
        "name": { "en": "Calculus Assessment" },
        "slug": "calculus-assessment",
        "description": "Comprehensive calculus assessment",
        "enabled_modules": ["MODULE_ASSESSMENT", "MODULE_ATTEMPT"],
        "status": "ACTIVE",
        "current_version": 3,
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T12:45:00Z"
      }
    ],
    "total": 42,
    "limit": 10,
    "offset": 0,
    "has_more": true
  },
  "error": null
}
```

### 3. Get Product

**GET** `/products/{productId}`

Retrieve a single product by ID.

**Permissions**: read

**Path Parameters**:

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| productId | string | Product ID  |

**Response**: 200 OK

```json
{
  "success": true,
  "data": {
    "id": "prod-550e8400-e29b-41d4-a716-446655440000",
    "name": { "en": "Calculus Assessment", "ar": "تقييم الحساب" },
    "slug": "calculus-assessment",
    "description": "Comprehensive calculus assessment",
    "enabled_modules": ["MODULE_ASSESSMENT", "MODULE_ATTEMPT", "MODULE_REPORTING"],
    "status": "ACTIVE",
    "current_version": 3,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T12:45:00Z"
  },
  "error": null
}
```

**Errors**:

- `404 Not Found`: Product not found

### 4. Update Product

**PUT** `/products/{productId}`

Update product details and create new version.

**Permissions**: admin

**Path Parameters**:

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| productId | string | Product ID  |

**Request Body**:

```json
{
  "name": { "en": "Updated Name", "ar": "اسم محدث" },
  "description": "Updated description",
  "enabled_modules": ["MODULE_ASSESSMENT", "MODULE_ATTEMPT", "MODULE_CONTENT"]
}
```

**Response**: 200 OK

```json
{
  "success": true,
  "data": {
    "id": "prod-550e8400-e29b-41d4-a716-446655440000",
    "name": { "en": "Updated Name", "ar": "اسم محدث" },
    "slug": "calculus-assessment",
    "description": "Updated description",
    "enabled_modules": ["MODULE_ASSESSMENT", "MODULE_ATTEMPT", "MODULE_CONTENT"],
    "status": "ACTIVE",
    "current_version": 4,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T13:00:00Z"
  },
  "error": null
}
```

**Behavior**:

- Increments `current_version` only if changes are detected
- Creates new ProductVersion record
- Creates audit log with UPDATE action
- Immutable fields: id, slug, created_at, status

**Errors**:

- `404 Not Found`: Product not found
- `400 Bad Request`: Invalid input

### 5. Change Product Status

**PATCH** `/products/{productId}/status`

Change product status (ACTIVE ↔ INACTIVE).

**Permissions**: admin

**Path Parameters**:

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| productId | string | Product ID  |

**Request Body**:

```json
{
  "status": "INACTIVE"
}
```

**Response**: 200 OK

```json
{
  "success": true,
  "data": {
    "id": "prod-550e8400-e29b-41d4-a716-446655440000",
    "name": { "en": "Calculus Assessment" },
    "slug": "calculus-assessment",
    "description": "Comprehensive calculus assessment",
    "enabled_modules": ["MODULE_ASSESSMENT", "MODULE_ATTEMPT"],
    "status": "INACTIVE",
    "current_version": 4,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T13:00:00Z"
  },
  "error": null
}
```

**Behavior**:

- Does NOT increment version number
- Does NOT create new ProductVersion record
- Creates audit log with STATUS_CHANGE action
- Idempotent: changing to current status is allowed

**Errors**:

- `404 Not Found`: Product not found
- `400 Bad Request`: Invalid status

### 6. Delete Product

**DELETE** `/products/{productId}`

Delete a product and cascade delete versions and audit logs.

**Permissions**: admin

**Path Parameters**:

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| productId | string | Product ID  |

**Response**: 204 No Content

**Behavior**:

- Hard delete (no soft_delete flag)
- Cascades to product_versions and product_audit_logs
- Cannot delete if product has active licenses (409)
- Returns 204 with no body

**Errors**:

- `404 Not Found`: Product not found
- `409 Conflict`: Product has associated licenses (PRODUCT_HAS_LICENSES)

### 7. Get Product Audit Log

**GET** `/products/{productId}/audit-log`

Retrieve paginated audit log for a product.

**Permissions**: read

**Path Parameters**:

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| productId | string | Product ID  |

**Query Parameters**:

| Parameter | Type    | Default | Description                                     |
| --------- | ------- | ------- | ----------------------------------------------- |
| action    | string  | -       | Filter by action: CREATE, UPDATE, STATUS_CHANGE |
| from_date | string  | -       | Filter entries from (ISO 8601)                  |
| to_date   | string  | -       | Filter entries until (ISO 8601)                 |
| limit     | integer | 10      | Items per page (max: 100)                       |
| offset    | integer | 0       | Pagination offset                               |

**Example**:

```bash
GET /products/prod-123/audit-log?action=UPDATE&limit=10&offset=0
```

**Response**: 200 OK

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "audit-456",
        "product_id": "prod-550e8400-e29b-41d4-a716-446655440000",
        "action": "UPDATE",
        "timestamp": "2024-01-15T13:00:00Z",
        "performed_by": "user-789",
        "previous_version": 3,
        "new_version": 4,
        "changed_fields": {
          "name": {
            "old_value": { "en": "Calculus Assessment" },
            "new_value": { "en": "Updated Name" }
          },
          "description": {
            "old_value": "Comprehensive calculus assessment",
            "new_value": "Updated description"
          }
        }
      },
      {
        "id": "audit-123",
        "product_id": "prod-550e8400-e29b-41d4-a716-446655440000",
        "action": "CREATE",
        "timestamp": "2024-01-15T10:30:00Z",
        "performed_by": "user-789",
        "previous_version": null,
        "new_version": 1,
        "changed_fields": null
      }
    ],
    "total": 15,
    "limit": 10,
    "offset": 0
  },
  "error": null
}
```

**Behavior**:

- Sorted DESC by timestamp (newest first)
- Includes previous_version and new_version (null for STATUS_CHANGE)
- Includes changed_fields object only for UPDATE actions

**Errors**:

- `404 Not Found`: Product not found

## Error Codes

| Code                      | HTTP Status | Description                                                       |
| ------------------------- | ----------- | ----------------------------------------------------------------- |
| DUPLICATE_SLUG            | 409         | Product with this slug already exists                             |
| INVALID_MODULE_ENUM       | 400         | Invalid module enum value                                         |
| INVALID_NAME_LOCALIZATION | 400         | Invalid name localization (missing en)                            |
| INVALID_SLUG_FORMAT       | 400         | Slug format invalid (must be lowercase alphanumeric with hyphens) |
| INVALID_STATUS_TRANSITION | 400         | Invalid status transition                                         |
| INVALID_VERSION_CHANGE    | 400         | Invalid version change request                                    |
| PRODUCT_NOT_FOUND         | 404         | Product not found                                                 |
| PRODUCT_HAS_LICENSES      | 409         | Product has associated licenses (cannot delete)                   |
| INSUFFICIENT_PERMISSIONS  | 401         | User lacks required permissions                                   |
| LICENSE_EXPIRED           | 403         | User's license has expired                                        |
| SCHEMA_VERSION_MISMATCH   | 426         | Database schema version mismatch                                  |
| INTERNAL_SERVER_ERROR     | 500         | Unexpected server error                                           |
| RATE_LIMIT_EXCEEDED       | 429         | Rate limit exceeded                                               |

## Examples

### Create Product with cURL

```bash
curl -X POST https://api.zidney.io/mmc/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": {
      "en": "Physics Assessment",
      "ar": "تقييم الفيزياء"
    },
    "slug": "physics-assessment",
    "description": "Complete physics assessment suite",
    "enabled_modules": [
      "MODULE_ASSESSMENT",
      "MODULE_ATTEMPT",
      "MODULE_REPORTING"
    ]
  }'
```

### List Active Products with cURL

```bash
curl -X GET "https://api.zidney.io/mmc/products?status=ACTIVE&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Product with cURL

```bash
curl -X PUT https://api.zidney.io/mmc/products/prod-123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated product description",
    "enabled_modules": ["MODULE_ASSESSMENT", "MODULE_ATTEMPT", "MODULE_CONTENT"]
  }'
```

### Change Product Status with cURL

```bash
curl -X PATCH https://api.zidney.io/mmc/products/prod-123/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "INACTIVE" }'
```

### Get Audit Log with cURL

```bash
curl -X GET "https://api.zidney.io/mmc/products/prod-123/audit-log?action=UPDATE&limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Modules

Available feature modules for products:

| Module            | Description                        |
| ----------------- | ---------------------------------- |
| MODULE_ASSESSMENT | Assessment creation and management |
| MODULE_ATTEMPT    | Student attempt functionality      |
| MODULE_CONTENT    | Content library management         |
| MODULE_REPORTING  | Reporting and analytics            |
| MODULE_PROCTOR    | Proctoring capabilities            |
| MODULE_ANALYTICS  | Advanced analytics                 |

At least one module must be enabled when creating a product. Multiple modules can be enabled
simultaneously.

## Versioning

Products use immutable versioning:

- **Initial Version**: 1 (created with product)
- **Version Increment**: Only on meaningful updates (no-op updates don't increment)
- **Version Records**: Stored in product_versions table with complete snapshot
- **Immutable Slug**: Cannot change post-creation
- **Change Tracking**: All changed fields recorded in audit logs

## Headers

All responses include these headers:

| Header                | Description                           |
| --------------------- | ------------------------------------- |
| X-Correlation-ID      | Unique request identifier for tracing |
| X-RateLimit-Limit     | Request limit for this endpoint       |
| X-RateLimit-Remaining | Requests remaining in current window  |
| X-RateLimit-Reset     | Unix timestamp when limit resets      |
| Content-Type          | application/json                      |

## Timestamps

All timestamps are in ISO 8601 format with UTC timezone:

```
2024-01-15T10:30:00Z
```

## Pagination

Pagination uses limit and offset model:

```
GET /products?limit=10&offset=0
```

- **limit**: Items per page (max: 100)
- **offset**: Starting position
- **has_more**: Boolean indicating if more items exist after current page
- **total**: Total number of items available

## Filtering

Products support multiple filter mechanisms:

### Status Filter

```
GET /products?status=ACTIVE  # ACTIVE or INACTIVE only
GET /products?status=all      # Both ACTIVE and INACTIVE
```

### Search Filter

```
GET /products?search=calculus  # Searches name and slug
```

### Module Filter

```
GET /products?module=MODULE_ASSESSMENT  # Products with this module enabled
```

### Audit Log Filters

```
GET /products/{id}/audit-log?action=UPDATE  # Filter by action
GET /products/{id}/audit-log?from_date=2024-01-01T00:00:00Z  # Date range
GET /products/{id}/audit-log?to_date=2024-01-31T23:59:59Z
```

## Related Documentation

- [OpenAPI Specification](./products-management-api-spec.yaml)
- [Implementation Guide](../runtime/009-products-management/IMPLEMENTATION_PRODUCTS.md)
- [Database Schema](../runtime/009-products-management/README_PRODUCTS.md)
- [Deployment Guide](../runtime/009-products-management/DEPLOYMENT_AND_VALIDATION_PRODUCTS.md)
