# Contract: PATCH /v1/mmc/affiliates/:id

**Purpose**: Edit affiliate configuration (all fields except immutable promo_code)  
**Authentication**: MMC service token + admin RBAC  
**Authorization**: `affiliates:update` permission  
**Rate Limit**: Standard admin endpoint limit (~100 req/min per admin)  
**Immutability**: promo_code cannot be changed (enforced by database trigger)

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
PATCH /v1/mmc/affiliates/aff-550e8400-e29b-41d4-a716-446655440000
```

| Parameter | Type | Required | Notes               |
| --------- | ---- | -------- | ------------------- |
| `id`      | UUID | YES      | Affiliate record ID |

### Body (All Fields Optional)

```json
{
  "discount_percentage": 12.5,
  "commission_percentage": 3.0,
  "usage_limit_total": 1500,
  "usage_limit_per_client": 8,
  "start_date": "2026-03-01T00:00:00Z",
  "end_date": "2026-06-30T23:59:59Z",
  "allow_with_other_discounts": true,
  "description": "Updated spring promotional code"
}
```

### Field Specifications

| Field                        | Type            | Mutable        | Constraints               | Notes                                      |
| ---------------------------- | --------------- | -------------- | ------------------------- | ------------------------------------------ |
| `promo_code`                 | string          | NO (Immutable) | N/A                       | Cannot be changed; sends error if included |
| `discount_percentage`        | number          | YES            | 0.00 - 100.00, 2 decimals | Can update after creation                  |
| `commission_percentage`      | number          | YES            | 0.00 - 100.00, 2 decimals | Can update after creation                  |
| `usage_limit_total`          | integer or null | YES            | >= 0                      | Can update; `null` = unlimited             |
| `usage_limit_per_client`     | integer or null | YES            | >= 0                      | Can update; `null` = unlimited             |
| `start_date`                 | ISO 8601        | YES            | start < end               | Can move time window                       |
| `end_date`                   | ISO 8601        | YES            | end > start               | Can move time window                       |
| `allow_with_other_discounts` | boolean         | YES            | true/false                | Can toggle discount stacking               |
| `description`                | string          | YES            | max 1000 chars            | Admin notes                                |

### Validation Rules

- If `promo_code` included: HTTP 400 error (AFFILIATE_IMMUTABLE_FIELD)
- Start/end date: Must satisfy start < end
- Percentages: 0-100 with 2 decimals
- Other fields: Same constraints as POST /create

---

## Response: Success (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "aff-550e8400-e29b-41d4-a716-446655440000",
    "promo_code": "SPRING25",
    "discount_percentage": "12.50",
    "commission_percentage": "3.00",
    "usage_limit_total": 1500,
    "usage_limit_per_client": 8,
    "usage_count": 342,
    "start_date": "2026-03-01T00:00:00Z",
    "end_date": "2026-06-30T23:59:59Z",
    "status": "ACTIVE",
    "allow_with_other_discounts": true,
    "description": "Updated spring promotional code",
    "created_at": "2026-02-15T09:00:00Z",
    "updated_at": "2026-02-25T15:00:00Z"
  },
  "error": null
}
```

### Response Notes

- Returns updated affiliate record with new values
- `updated_at` reflects the update time
- `usage_count` unchanged by PATCH (only incremented during license purchase)

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

## Response: Immutable Field Error (400 Bad Request)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AFFILIATE_IMMUTABLE_FIELD",
    "message": "Field 'promo_code' is immutable and cannot be changed"
  }
}
```

---

## Response: Validation Error (400 Bad Request)

### Invalid Date Range

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AFFILIATE_INVALID_DATE_RANGE",
    "message": "start_date must be before end_date: start=2026-06-30, end=2026-03-01"
  }
}
```

### Invalid Percentage

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AFFILIATE_INVALID_DISCOUNT_PERCENTAGE",
    "message": "discount_percentage must be between 0 and 100: got 150.00"
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
    "message": "Admin requires 'affiliates:update' permission"
  }
}
```

---

## Audit Trail

**Event Logged**:

```json
{
  "timestamp": "2026-02-25T15:00:00.123Z",
  "level": "info",
  "service": "api-affiliates",
  "correlation_id": "req-abc123xyz",
  "event": "affiliate_updated",
  "affiliate_id": "aff-550e8400-e29b-41d4-a716-446655440000",
  "admin_id": "admin-uuid",
  "promo_code": "SPRING25",
  "action": "UPDATE",
  "old_values": {
    "discount_percentage": "10.50",
    "usage_limit_total": 1000,
    "end_date": "2026-05-31T23:59:59Z"
  },
  "new_values": {
    "discount_percentage": "12.50",
    "usage_limit_total": 1500,
    "end_date": "2026-06-30T23:59:59Z"
  }
}
```

---

## Partial Update Examples

### Update Only Percentages

```
PATCH /v1/mmc/affiliates/{id}
{
  "discount_percentage": 15.00,
  "commission_percentage": 3.50
}
```

Only specified fields are updated; others remain unchanged.

### Extend Campaign Dates

```
PATCH /v1/mmc/affiliates/{id}
{
  "end_date": "2026-08-31T23:59:59Z"
}
```

---

## Transaction Flow

```
1. Parse and validate request body (only modified fields)
2. Validate admin authentication and RBAC
3. Check if promo_code included → error if present
4. BEGIN PostgreSQL transaction
5. SELECT * FROM affiliates WHERE id = $1 (fetch current)
6. Validate updated fields (date ranges, percentages)
7. UPDATE affiliates SET <modified fields> WHERE id = $1
8. INSERT into affiliate_admin_audit (old_values, new_values)
9. COMMIT transaction
10. Return 200 OK with updated record
```

---

## Idempotency

- **Not Idempotent**: Repeated identical PATCH requests will UPDATE and log multiple audit records
- **Mitigation**: Retry logic should check if update already applied (compare updated_at or audit
  log)

---

## Testing Requirements

```typescript
✓ Update single field (partial update)
✓ Update multiple fields
✓ Update percentages
✓ Update date range
✓ Update limits
✓ Reject promo_code modification
✓ Reject invalid date range
✓ Reject invalid percentages
✓ Verify 404 on non-existent ID
✓ Verify audit trail created with old/new values
✓ Verify RBAC enforcement
✓ Verify correlation_id propagation
```

---

## Performance Notes

- **Response Time**: < 50ms (single UPDATE + audit insert)
- **Concurrency**: Row-level update lock brief and released quickly
- **Cascading**: No cascading updates to affiliate_usages (they remain immutable)
