# Contract: POST /v1/mmc/affiliates/:id/disable

**Purpose**: Soft delete an affiliate (set status to INACTIVE)  
**Authentication**: MMC service token + admin RBAC  
**Authorization**: `affiliates:delete` permission  
**Rate Limit**: Standard admin endpoint limit (~100 req/min per admin)  
**Soft Delete**: Changes status to INACTIVE; promo code remains in database; usage records persist
for audit

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
POST /v1/mmc/affiliates/aff-550e8400-e29b-41d4-a716-446655440000/disable
```

### Body

Empty body or optional reason (if audit requires):

```json
{}
```

---

## Response: Success (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "aff-550e8400-e29b-41d4-a716-446655440000",
    "promo_code": "SPRING25",
    "status": "INACTIVE",
    "discount_percentage": "10.50",
    "commission_percentage": "2.75",
    "usage_count": 342,
    "description": "Spring promotional code for institutional partners",
    "retired_at": "2026-02-25T15:30:00Z",
    "updated_at": "2026-02-25T15:30:00Z"
  },
  "error": null
}
```

### Response Notes

- `status` changed to "INACTIVE"
- Code still exists in database (soft delete, not physical deletion)
- Future license purchases with this code will fail validation
- Existing usage records remain for audit trail

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

## Response: Already Disabled (400 Bad Request)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AFFILIATE_ALREADY_INACTIVE",
    "message": "Affiliate 'SPRING25' is already inactive (status='INACTIVE')"
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
    "message": "Admin requires 'affiliates:delete' permission"
  }
}
```

---

## Audit Trail

**Event Logged**:

```json
{
  "timestamp": "2026-02-25T15:30:00.123Z",
  "level": "info",
  "service": "api-affiliates",
  "correlation_id": "req-abc123xyz",
  "event": "affiliate_disabled",
  "affiliate_id": "aff-550e8400-e29b-41d4-a716-446655440000",
  "admin_id": "admin-uuid",
  "promo_code": "SPRING25",
  "action": "DISABLE",
  "old_values": { "status": "ACTIVE" },
  "new_values": { "status": "INACTIVE" }
}
```

---

## Transaction Flow

```
1. Validate admin authentication and RBAC (affiliates:delete)
2. BEGIN PostgreSQL transaction
3. SELECT * FROM affiliates WHERE id = $1
4. Verify status != INACTIVE (prevent double-disable)
5. UPDATE affiliates SET status = 'INACTIVE' WHERE id = $1
6. INSERT into affiliate_admin_audit (action='DISABLE')
7. COMMIT transaction
8. Return 200 OK with updated affiliate
```

---

## Cascading Effects

- ✗ Does NOT delete affiliate_usages records (immutable audit trail preserved)
- ✗ Does NOT delete affiliate_admin_audit records
- ✓ Future license purchases with code FAIL validation (status != 'ACTIVE')
- ✓ Usage count remains for historical reference

---

## Idempotency

- **Not Idempotent**: First disable succeeds (status changes), second disable fails with 400
  (already inactive)
- **Mitigation**: Client can catch 400 and treat as successful (idempotent error handling)

---

## Undo Operation

To re-enable a disabled affiliate:

```
PATCH /v1/mmc/affiliates/:id
{
  "status": "ACTIVE"
}
```

This would require the PATCH endpoint to support status field modification.

---

## Physical Deletion (Not Supported)

The endpoint does NOT physically delete the affiliate record. Reasons:

1. **Audit Trail Integrity**: Used codes must link to originating affiliate (referential integrity)
2. **Compliance**: Financial records must remain immutable
3. **Data Recovery**: Soft delete allows easy restoration if accidentally disabled

If physical deletion is ever needed, it must go through a formal data retention/compliance review
process.

---

## Testing Requirements

```typescript
✓ Disable active affiliate
✓ Verify status changes to INACTIVE
✓ Prevent double-disable (get 400 on second attempt)
✓ Verify 404 on non-existent ID
✓ Verify usage records NOT deleted
✓ Verify admin audit trail created
✓ Verify license purchase rejects disabled code after disable
✓ Verify RBAC enforcement (affiliates:delete)
✓ Verify can re-enable via PATCH
✓ Verify correlation_id propagation
```

---

## Performance Notes

- **Response Time**: < 50ms (single UPDATE + audit insert)
- **No Cascading Deletes**: affiliate_usages table unaffected (no DELETE operations)
