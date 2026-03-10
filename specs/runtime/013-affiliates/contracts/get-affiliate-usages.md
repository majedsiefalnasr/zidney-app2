# Contract: GET /v1/mmc/affiliates/:id/usages

**Purpose**: View usage history for an affiliate code (all license purchases using the code)  
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

### URL Parameters

```
GET /v1/mmc/affiliates/aff-550e8400-e29b-41d4-a716-446655440000/usages?page=1&limit=50&sort_by=created_at&sort_order=desc
```

| Parameter    | Type    | Required | Default    | Constraints                              | Notes                                |
| ------------ | ------- | -------- | ---------- | ---------------------------------------- | ------------------------------------ |
| `page`       | integer | NO       | 1          | >= 1                                     | Pagination: page number              |
| `limit`      | integer | NO       | 50         | 1-500                                    | Pagination: records per page         |
| `sort_by`    | string  | NO       | created_at | created_at, base_amount, discount_amount | Sort field                           |
| `sort_order` | string  | NO       | desc       | asc, desc                                | Sort direction                       |
| `client_id`  | UUID    | NO       | —          | valid UUID                               | Filter by specific client (optional) |

---

## Response: Success (200 OK)

```json
{
  "success": true,
  "data": {
    "affiliate_id": "aff-550e8400-e29b-41d4-a716-446655440000",
    "promo_code": "SPRING25",
    "total_usages": 342,
    "total_base_amount": "171000.00",
    "total_discount_amount": "17955.00",
    "total_commission_amount": "4737.75",
    "usages": [
      {
        "id": "usage-001",
        "client_id": "client-001",
        "license_id": "license-001",
        "base_amount": "500.00",
        "discount_amount": "52.50",
        "commission_amount": "13.75",
        "created_at": "2026-02-25T14:30:00Z"
      },
      {
        "id": "usage-002",
        "client_id": "client-002",
        "license_id": "license-002",
        "base_amount": "1000.00",
        "discount_amount": "105.00",
        "commission_amount": "27.50",
        "created_at": "2026-02-25T13:15:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 342,
      "total_pages": 7
    }
  },
  "error": null
}
```

### Response Notes

- `total_usages`: Count of all usage records for this affiliate
- `total_base_amount`: Sum of all base amounts (before discount)
- `total_discount_amount`: Sum of all discounts applied
- `total_commission_amount`: Sum of all commissions earned
- Summary fields useful for financial reporting
- Results paginated (default 50 per page)
- Sorted by created_at DESC (most recent first)

---

## Response: Empty Result (200 OK)

```json
{
  "success": true,
  "data": {
    "affiliate_id": "aff-550e8400-e29b-41d4-a716-446655440000",
    "promo_code": "SPRING25",
    "total_usages": 0,
    "total_base_amount": "0.00",
    "total_discount_amount": "0.00",
    "total_commission_amount": "0.00",
    "usages": [],
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

## Response: Not Found (404 Not Found)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AFFILIATE_NOT_FOUND",
    "message": "Affiliate with ID 'aff-550e8400-e29b-41d4-a716-446655440000' not found"
  }
}
```

---

## Response: Validation Error (400 Bad Request)

### Invalid Pagination

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

### Invalid Sort Field

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_SORT",
    "message": "sort_by must be one of: created_at, base_amount, discount_amount. Got: 'unknown'"
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

## Query Examples

### All Usages for Affiliate (Paginated)

```
GET /v1/mmc/affiliates/aff-001/usages?page=1&limit=50
```

### Usages for Specific Client

```
GET /v1/mmc/affiliates/aff-001/usages?client_id=client-xyz
```

### Sorted by Discount Amount (Largest First)

```
GET /v1/mmc/affiliates/aff-001/usages?sort_by=discount_amount&sort_order=desc
```

### Recent Usages (Chronological)

```
GET /v1/mmc/affiliates/aff-001/usages?sort_by=created_at&sort_order=desc&limit=20
```

---

## Use Cases

### Financial Reconciliation

Verify total commissions owed to affiliate:

```typescript
GET / v1 / mmc / affiliates / { affiliate_id } / usages;
total_commission_amount: "$4737.75"; // Sum of all commissions
```

### Usage Audit

Verify usage count hasn't been corrupted:

```typescript
affiliates.usage_count (from database counter)
   vs
pagination.total (from audit trail)

These must be equal or schema reconciliation job alerts
```

### Client Commission Tracking

List all purchases by a specific client with affiliate discounts:

```
GET /v1/mmc/affiliates/{affiliate_id}/usages?client_id={client_id}
```

### Reporting

Export affiliate performance report:

```
GET /v1/mmc/affiliates/{affiliate_id}/usages?limit=10000&sort_by=created_at
// Then export CSV with total_base_amount, total_discount_amount, total_commission_amount
```

---

## Performance Notes

- **Database Query**: O(log n \* page_size) with composite indexes on (affiliate_id, created_at)
- **Response Time**: 50-200ms depending on result set size and pagination
- **No Caching**: Real-time read from audit table (immutable, safe to read during transactions)

---

## Audit Trail Integration

Usage records are immutable and append-only. Each entry captures:

```json
{
  "id": "usage-001",
  "affiliate_id": "aff-001",
  "client_id": "client-001",
  "license_id": "license-001",
  "base_amount": "500.00", // Immutable snapshot at purchase time
  "discount_amount": "52.50", // Calculated discount at purchase time
  "commission_amount": "13.75", // Calculated commission at purchase time
  "created_at": "2026-02-25T14:30:00Z" // Immutable timestamp
}
```

No UPDATE or DELETE allowed on affiliate_usages records (database triggers enforce).

---

## Concurrency Safety

- **Read-Only Endpoint**: SELECT only, no transaction locks needed
- **Snapshot Isolation**: Uses read snapshot of immutable audit table
- **Safe During Purchase**: Can query usages while concurrent license purchase writes to same table

---

## Testing Requirements

```typescript
✓ Get usages for affiliate with no usage
✓ Get usages for affiliate with multiple records
✓ Paginate through results
✓ Filter by client_id
✓ Sort by created_at, base_amount, discount_amount
✓ Verify summary totals are correct
✓ Verify 404 on non-existent affiliate ID
✓ Verify pagination controls work
✓ Verify RBAC enforcement (affiliates:read)
✓ Verify correlation_id propagation
```
