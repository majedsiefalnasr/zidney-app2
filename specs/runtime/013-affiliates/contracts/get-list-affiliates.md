# Contract: GET /v1/mmc/affiliates

**Purpose**: List affiliate promo codes with filtering and pagination  
**Authentication**: MMC service token + admin RBAC  
**Authorization**: `affiliates:read` permission  
**Rate Limit**: Standard admin endpoint limit (~100 req/min per admin)

---

## Request

### Headers

```
Authorization: Bearer <mmc-service-token>
Content-Type: application/json
X-Correlation-ID: <uuid>
```

### Query Parameters

```
GET /v1/mmc/affiliates?status=ACTIVE&start_date_from=2026-03-01&start_date_to=2026-05-31&page=1&limit=50
```

| Parameter         | Type     | Required | Default    | Constraints                                     | Notes                                    |
| ----------------- | -------- | -------- | ---------- | ----------------------------------------------- | ---------------------------------------- |
| `status`          | string   | NO       | —          | ACTIVE, INACTIVE, or omit for all               | Filter by affiliate status               |
| `start_date_from` | ISO 8601 | NO       | —          | ISO 8601 timestamp                              | Affiliates with start_date >= this value |
| `start_date_to`   | ISO 8601 | NO       | —          | ISO 8601 timestamp                              | Affiliates with start_date <= this value |
| `page`            | integer  | NO       | 1          | >= 1                                            | Pagination: page number                  |
| `limit`           | integer  | NO       | 50         | 1-500                                           | Pagination: records per page             |
| `sort_by`         | string   | NO       | created_at | created_at, promo_code, usage_count, start_date | Sort field                               |
| `sort_order`      | string   | NO       | desc       | asc, desc                                       | Sort direction                           |

---

## Response: Success (200 OK)

```json
{
  "success": true,
  "data": {
    "affiliates": [
      {
        "id": "aff-001",
        "promo_code": "SUMMER25",
        "discount_percentage": "15.00",
        "commission_percentage": "3.00",
        "usage_limit_total": 2000,
        "usage_limit_per_client": 10,
        "usage_count": 145,
        "start_date": "2026-06-01T00:00:00Z",
        "end_date": "2026-08-31T23:59:59Z",
        "status": "ACTIVE",
        "allow_with_other_discounts": true,
        "description": "Summer promotional code",
        "created_at": "2026-02-20T10:00:00Z",
        "updated_at": "2026-02-24T14:30:00Z"
      },
      {
        "id": "aff-002",
        "promo_code": "SPRING25",
        "discount_percentage": "10.50",
        "commission_percentage": "2.75",
        "usage_limit_total": 1000,
        "usage_limit_per_client": 5,
        "usage_count": 342,
        "start_date": "2026-03-01T00:00:00Z",
        "end_date": "2026-05-31T23:59:59Z",
        "status": "ACTIVE",
        "allow_with_other_discounts": false,
        "description": "Spring promotional code for institutional partners",
        "created_at": "2026-02-15T09:00:00Z",
        "updated_at": "2026-02-25T14:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 2,
      "total_pages": 1
    }
  },
  "error": null
}
```

### Response Field Notes

- `affiliates`: Array of affiliate records (empty if no matches)
- Percentages returned as strings (NUMERIC type)
- `status`: "ACTIVE" or "INACTIVE"
- Sorted by `sort_by` parameter (default: created_at DESC)
- Pagination: total includes all matching records (for UI pagination controls)

---

## Response: Empty List (200 OK)

```json
{
  "success": true,
  "data": {
    "affiliates": [],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 0,
      "total_pages": 0
    }
  },
  "error": null
}
```

---

## Response: Validation Error (400 Bad Request)

### Invalid Page Number

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_PAGINATION",
    "message": "page must be >= 1, got: 0"
  }
}
```

### Invalid Limit

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_PAGINATION",
    "message": "limit must be between 1 and 500, got: 10000"
  }
}
```

### Invalid Status Filter

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_FILTER",
    "message": "status must be 'ACTIVE' or 'INACTIVE', got: 'PENDING'"
  }
}
```

---

## Response: Authorization Error (403 Forbidden)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Admin requires 'affiliates:read' permission"
  }
}
```

---

## Response: Authentication Error (401 Unauthorized)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Invalid or missing MMC service token"
  }
}
```

---

## Query Examples

### Active Affiliates Only

```
GET /v1/mmc/affiliates?status=ACTIVE
```

### Affiliates by Date Range

```
GET /v1/mmc/affiliates?start_date_from=2026-03-01T00:00:00Z&start_date_to=2026-05-31T23:59:59Z
```

### Paginated Results Sorted by Usage

```
GET /v1/mmc/affiliates?page=2&limit=20&sort_by=usage_count&sort_order=desc
```

### Multiple Filters Combined

```
GET /v1/mmc/affiliates?status=ACTIVE&start_date_from=2026-03-01&sort_by=created_at&sort_order=asc
```

---

## Performance Notes

- **Database Query**: O(log n) via indexes on status, start_date, created_at
- **Typical Response Time**: < 50ms for paginated results
- **Caching**: Results not cached (admin may want real-time view)

---

## Testing Requirements

```typescript
✓ List all affiliates (no filters)
✓ Filter by status=ACTIVE
✓ Filter by status=INACTIVE
✓ Filter by date range (start_date_from, start_date_to)
✓ Paginate results (page 1, 2, etc; custom limit)
✓ Sort by different fields (created_at, usage_count, promo_code)
✓ Sort order (asc, desc)
✓ Empty result set (no matches)
✓ Validation errors (invalid page, limit)
✓ RBAC enforcement (affiliates:read permission)
✓ Correlation_id propagation
```
