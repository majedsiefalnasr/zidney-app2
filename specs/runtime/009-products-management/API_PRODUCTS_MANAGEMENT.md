# Products Management API Documentation

**Stage:** STAGE_09_PRODUCTS  
**Version:** 1.0.0  
**Last Updated:** 2024-12-15

## Overview

The Products Management API provides complete CRUD operations for managing product offerings in Zidney. Products define commercial offerings with configurable modules and manage the foundation of the licensing system.

## Base URL

```
https://api.zidney.com/api/v1/mmc
```

## Authentication

All endpoints require JWT token in `Authorization` header:

```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

The token must include the required scopes for each operation:

- `products:read` - List and retrieve products
- `products:write` - Create and update products
- `products:delete` - Delete products
- `products:audit` - Access audit logs

## Endpoints

### 1. List Products

**GET** `/products`

Returns a paginated list of products

#### Query Parameters

| Parameter | Type   | Default  | Description                                      |
| --------- | ------ | -------- | ------------------------------------------------ |
| `status`  | string | `ACTIVE` | Filter by status: `ACTIVE`, `INACTIVE`, or `all` |
| `search`  | string | -        | Search by product name (en/ar) or slug           |
| `limit`   | number | 20       | Items per page (max 100)                         |
| `offset`  | number | 0        | Pagination offset                                |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": {
          "en": "Mathematics Course",
          "ar": "دورة الرياضيات"
        },
        "slug": "math-course",
        "description": "Comprehensive mathematics education",
        "enabled_modules": ["MCQ", "EXERCISES", "LIBRARY"],
        "status": "ACTIVE",
        "current_version": 2,
        "created_at": "2024-12-15T10:00:00Z",
        "updated_at": "2024-12-15T11:30:00Z"
      }
    ],
    "total": 45,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

#### Example Requests

```bash
# Get active products
curl -X GET "https://api.zidney.com/api/v1/mmc/products" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Search and paginate
curl -X GET "https://api.zidney.com/api/v1/mmc/products?search=math&limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get all status types
curl -X GET "https://api.zidney.com/api/v1/mmc/products?status=all" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 2. Get Single Product

**GET** `/products/:id`

Returns complete details of a single product

#### Parameters

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | Product ID  |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": {
      "en": "Mathematics Course",
      "ar": "دورة الرياضيات"
    },
    "slug": "math-course",
    "description": "Comprehensive mathematics education",
    "enabled_modules": ["MCQ", "TRADITIONAL_EXAMS", "EXERCISES", "LIBRARY"],
    "status": "ACTIVE",
    "current_version": 2,
    "created_at": "2024-12-15T10:00:00Z",
    "updated_at": "2024-12-15T11:30:00Z"
  }
}
```

#### Error Responses

**404 Not Found** - Product doesn't exist

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product not found"
  }
}
```

---

### 3. Create Product

**POST** `/products`

Creates a new product with initial version 1

#### Request Body

```json
{
  "name": {
    "en": "New Course",
    "ar": "دورة جديدة"
  },
  "slug": "new-course",
  "description": "Course description",
  "enabled_modules": ["MCQ", "LIBRARY", "EXERCISES"]
}
```

#### Field Specifications

- **name.en** (required, 1-255 chars): English product name
- **name.ar** (optional, 1-255 chars): Arabic product name
- **slug** (required, 1-100 chars): URL-friendly identifier (lowercase alphanumeric + dashes)
- **description** (optional): Product description
- **enabled_modules** (required, array): At least one of: `MCQ`, `TRADITIONAL_EXAMS`, `EXERCISES`, `LIBRARY`, `LIVES`, `FORUM`

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": {
      "en": "New Course",
      "ar": "دورة جديدة"
    },
    "slug": "new-course",
    "description": "Course description",
    "enabled_modules": ["MCQ", "LIBRARY", "EXERCISES"],
    "status": "ACTIVE",
    "current_version": 1,
    "created_at": "2024-12-15T12:00:00Z",
    "updated_at": "2024-12-15T12:00:00Z"
  }
}
```

#### Error Responses

**400 Bad Request** - Invalid data

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_MODULE_ENUM",
    "message": "Invalid module. Allowed: MCQ, TRADITIONAL_EXAMS, EXERCISES, LIBRARY, LIVES, FORUM"
  }
}
```

**409 Conflict** - Slug already exists

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "DUPLICATE_SLUG",
    "message": "Product slug already exists"
  }
}
```

#### Rate Limiting

- **Limit:** 10 requests per minute per user
- **Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

### 4. Update Product

**PUT** `/products/:id`

Updates product configuration. Changes automatically increment the version number.

#### Request Body (all fields optional)

```json
{
  "name": {
    "en": "Updated Course Name"
  },
  "description": "Updated description",
  "enabled_modules": ["MCQ", "EXERCISES"]
}
```

#### Important Notes

- **Slug is immutable** after creation
- **Version automatically increments** only if actual changes detected
- No version increment if sent data matches current data

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": {
      "en": "Updated Course Name"
    },
    "slug": "new-course",
    "current_version": 2,
    "updated_at": "2024-12-15T13:00:00Z"
  }
}
```

#### Error: Slug Cannot Be Changed

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SLUG_NOT_MUTABLE",
    "message": "Slug cannot be changed after creation"
  }
}
```

---

### 5. Change Product Status

**PATCH** `/products/:id/status`

Changes product status without incrementing version

#### Request Body

```json
{
  "status": "INACTIVE"
}
```

Valid values: `ACTIVE`, `INACTIVE`

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "INACTIVE",
    "current_version": 2,
    "updated_at": "2024-12-15T14:00:00Z"
  }
}
```

#### Important Note

Status changes do NOT increment version (no change_summary created)

---

### 6. Delete Product

**DELETE** `/products/:id`

Deletes product (requires no active licenses)

#### Response (204 No Content)

Empty response on success

#### Error: Product Has Licenses

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PRODUCT_HAS_LICENSES",
    "message": "Cannot delete product with active licenses"
  }
}
```

---

### 7. Get Audit Log

**GET** `/products/:id/audit-log`

Returns all changes made to a product

#### Query Parameters

| Parameter   | Type     | Description                                           |
| ----------- | -------- | ----------------------------------------------------- |
| `action`    | string   | Filter by action: `CREATE`, `UPDATE`, `STATUS_CHANGE` |
| `from_date` | ISO-8601 | Start date for range                                  |
| `to_date`   | ISO-8601 | End date for range                                    |
| `limit`     | number   | Items per page (max 100, default 20)                  |
| `offset`    | number   | Pagination offset                                     |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "audit-001",
        "product_id": "550e8400-e29b-41d4-a716-446655440000",
        "action": "UPDATE",
        "previous_version": 1,
        "new_version": 2,
        "changed_fields": {
          "name": {
            "old": { "en": "Old Name" },
            "new": { "en": "New Name" }
          }
        },
        "performed_by": "admin@example.com",
        "timestamp": "2024-12-15T13:00:00Z"
      },
      {
        "id": "audit-002",
        "product_id": "550e8400-e29b-41d4-a716-446655440000",
        "action": "CREATE",
        "previous_version": null,
        "new_version": 1,
        "changed_fields": {},
        "performed_by": "admin@example.com",
        "timestamp": "2024-12-15T10:00:00Z"
      }
    ],
    "total": 5,
    "limit": 20,
    "offset": 0,
    "has_more": false
  }
}
```

#### Access Control

Requires `products:audit` scope. Without proper permission:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied"
  }
}
```

---

## Error Codes Reference

| Code                        | HTTP Status | Description                        | Retry |
| --------------------------- | ----------- | ---------------------------------- | ----- |
| `INVALID_MODULE_ENUM`       | 400         | Invalid module value               | No    |
| `INVALID_NAME_LOCALIZATION` | 400         | Missing English name               | No    |
| `SLUG_NOT_MUTABLE`          | 400         | Attempting to change slug          | No    |
| `DUPLICATE_SLUG`            | 409         | Slug already exists                | Yes   |
| `PRODUCT_HAS_LICENSES`      | 409         | Can't delete product with licenses | Yes   |
| `PRODUCT_NOT_FOUND`         | 404         | Product doesn't exist              | No    |
| `LICENSE_NOT_FOUND`         | 404         | License doesn't exist              | No    |
| `UNAUTHORIZED`              | 401         | Authentication required            | No    |
| `FORBIDDEN`                 | 403         | Insufficient permissions           | No    |
| `WORKSPACE_LOCKED`          | 423         | Workspace soft-locked              | Yes   |
| `WORKSPACE_ARCHIVED`        | 403         | Workspace archived                 | No    |
| `VERSION_MISMATCH`          | 426         | Schema/version incompatible        | Yes   |
| `INTERNAL_SERVER_ERROR`     | 500         | Server error                       | Yes   |

---

## Rate Limiting

All endpoints implement rate limiting:

| Endpoint                    | Limit       |
| --------------------------- | ----------- |
| POST /products              | 10 req/min  |
| PUT /products/:id           | 20 req/min  |
| PATCH /products/:id/status  | 20 req/min  |
| GET /products               | 100 req/min |
| GET /products/:id           | 100 req/min |
| GET /products/:id/audit-log | 50 req/min  |
| DELETE /products/:id        | 10 req/min  |

When rate limit exceeded, response includes:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded"
  }
}
```

---

## Versioning & Change Tracking

### Version Semantics

- **Version 1**: Assigned at product creation
- **Version increment**: Only when content actually changes
- **Immutable versions**: All historical versions permanently recorded

### Audit Trail

Every change creates an audit log entry:

- **CREATE**: Initial product creation
- **UPDATE**: Content modification (increments version)
- **STATUS_CHANGE**: Status change (preserves version)

---

## Module Definitions

Six available modules:

| Module            | Code                | Description                         |
| ----------------- | ------------------- | ----------------------------------- |
| Multiple Choice   | `MCQ`               | Multiple choice questions           |
| Traditional Exams | `TRADITIONAL_EXAMS` | Essay/short answer exams            |
| Exercises         | `EXERCISES`         | Problem sets and exercises          |
| Library           | `LIBRARY`           | Resource library/content repository |
| Live Classes      | `LIVES`             | Live class/session support          |
| Forum             | `FORUM`             | Discussion forums/Q&A               |

---

## Examples

### JavaScript/Node.js

```javascript
const response = await fetch('https://api.zidney.com/api/v1/mmc/products', {
  method: 'GET',
  headers: {
    Authorization: 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
})

const data = await response.json()
if (data.success) {
  data.data.items.forEach((product) => {
    console.log(`${product.name.en} (${product.slug})`)
  })
}
```

### cURL

```bash
# Create product
curl -X POST https://api.zidney.com/api/v1/mmc/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": {"en": "Physics Course", "ar": "فيزياء"},
    "slug": "physics-101",
    "enabled_modules": ["MCQ", "EXERCISES", "LIBRARY"]
  }'

# Update product
curl -X PUT https://api.zidney.com/api/v1/mmc/products/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": {"en": "Advanced Physics"}
  }'
```

---

## Support

For API issues or questions, contact support@zidney.com or refer to the [implementation guide](IMPLEMENTATION_PRODUCTS.md).
