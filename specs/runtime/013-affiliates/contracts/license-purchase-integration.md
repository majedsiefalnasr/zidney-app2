# Contract: License Purchase Integration (Affiliate Code Validation)

**Purpose**: Extend existing license purchase endpoint with optional affiliate code validation and
discount application  
**Endpoint**: `POST /v1/licenses/purchase` (existing endpoint, extended with optional affiliate
logic)  
**Authentication**: Client authentication (existing)  
**License Validation**: License middleware (existing)  
**Rate Limit**: Existing rate limiting for license endpoint

---

## Overview

The existing license purchase endpoint is extended to accept an optional `promo_code` parameter. If
provided, the affiliate code is validated and discount applied transactionally. This integration
maintains backward compatibility: license purchases without a promo code work exactly as before.

---

## Request Extension

### Headers

```
Authorization: Bearer <client-jwt-token>
Content-Type: application/json
X-Correlation-ID: <uuid>
```

### Body (Extended with Optional Field)

```json
{
  "product_id": "prod-001",
  "workspace_name": "Acme University",
  "student_limit": 1000,
  "staff_limit": 50,
  "promo_code": "SPRING25",
  "additional_fields": "..."
}
```

### Field Specifications

| Field                 | Type   | Required | Before | After | Notes                                                    |
| --------------------- | ------ | -------- | ------ | ----- | -------------------------------------------------------- |
| (all existing fields) | —      | —        | YES    | YES   | License purchase fields unchanged                        |
| `promo_code`          | string | NO       | NO     | YES   | Optional affiliate code; triggers validation if provided |

### Promo Code Format

- Uppercase alphanumeric (A-Z, 0-9)
- 3-50 characters
- Ignored if empty string or null
- Validation: skipped if not provided

---

## Request Validation Flow

```
1. (Existing) Tenant resolution
2. (Existing) License middleware: status validation
3. (Existing) Request body parsing
4. (Existing) Client field validation
5. [NEW] If promo_code provided:
   a. Validate format (uppercase, alphanumeric)
   b. Parse as immutable field
6. (Existing) Authorization checks
7. (Existing) Rate limiting
```

---

## Transaction Flow (Modified License Purchase)

```
BEGIN TRANSACTION with SERIALIZABLE isolation level;

  -- Step 1: Load and validate license context (existing logic)
  SELECT products... // Validate product exists
  VALIDATE license requirements (student_limit, staff_limit, etc.)

  -- Step 2-NEW: Affiliate code validation (if provided)
  IF promo_code is provided:
    a. SELECT * FROM affiliates
       WHERE promo_code = $1
       FOR UPDATE
       (acquire exclusive row lock on affiliate record)

    b. VALIDATE status = 'ACTIVE'
       ELSE: ROLLBACK + return 400 (AFFILIATE_CODE_INACTIVE)

    c. VALIDATE CURRENT_TIMESTAMP BETWEEN start_date AND end_date
       ELSE: ROLLBACK + return 400 (AFFILIATE_CODE_EXPIRED)

    d. VALIDATE usage_count < usage_limit_total (if limit set)
       ELSE: ROLLBACK + return 400 (AFFILIATE_USAGE_LIMIT_EXCEEDED)

    e. SELECT COUNT(*) FROM affiliate_usages
       WHERE affiliate_id = $1 AND client_id = $2
       (get per-client usage count)

    f. VALIDATE count < usage_limit_per_client (if limit set)
       ELSE: ROLLBACK + return 400 (AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED)

    g. CALCULATE discount_amount
       = ROUND(purchase_amount * discount_percentage / 100, 2)

    h. CALCULATE commission_amount
       = ROUND(purchase_amount * commission_percentage / 100, 2)

    i. INSERT INTO affiliate_usages (
         affiliate_id, client_id, license_id,
         base_amount, discount_amount, commission_amount
       )

    j. UPDATE affiliates SET usage_count = usage_count + 1
       (increment counter atomically within lock)

    k. Apply discount to final purchase amount
       final_amount = purchase_amount - discount_amount

  -- Step 3: Complete license purchase (existing logic)
  INSERT INTO licenses (...) WITH final_amount
  UPDATE workspace limits in tenant_db (if applicable)

  -- Step 4: Audit logging (existing + affiliate extension)
  IF affiliate used:
    LOG affiliate_code_applied event
  ELSE:
    LOG normal license purchase

COMMIT;

IF any validation fails:
  ROLLBACK transaction entirely
  affiliate_usages record NOT created
  usage_count NOT incremented
  license purchase NOT completed
  return appropriate 400/409 error
```

---

## Response Structure (Unchanged)

Success response includes purchase details (same as before, but with discount applied):

```json
{
  "success": true,
  "data": {
    "license_id": "lic-001",
    "workspace_slug": "acme-university",
    "amount_paid": "4947.50",
    "discount_applied": false,
    "discount_amount": null,
    "commission_earned": null,
    "affiliate_code": null,
    "created_at": "2026-02-25T14:30:00Z"
  },
  "error": null
}
```

With affiliate:

```json
{
  "success": true,
  "data": {
    "license_id": "lic-002",
    "workspace_slug": "acme-university-2",
    "amount_before_discount": "5000.00",
    "discount_applied": true,
    "discount_amount": "52.50",
    "amount_paid": "4947.50",
    "affiliate_code": "SPRING25",
    "commission_earned": "13.75",
    "created_at": "2026-02-25T14:30:00Z"
  },
  "error": null
}
```

---

## Error Responses

### Affiliate Code Errors (400 Bad Request)

**Code Not Found**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AFFILIATE_CODE_NOT_FOUND",
    "message": "Promo code 'SPRING25' not found"
  }
}
```

**Code Inactive**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AFFILIATE_CODE_INACTIVE",
    "message": "Promo code 'SPRING25' is inactive"
  }
}
```

**Code Expired**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AFFILIATE_CODE_EXPIRED",
    "message": "Promo code 'SPRING25' expired on 2026-05-31"
  }
}
```

**Global Usage Limit Exceeded**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AFFILIATE_USAGE_LIMIT_EXCEEDED",
    "message": "Promo code 'SPRING25' has reached its global usage limit of 1000"
  }
}
```

**Per-Client Usage Limit Exceeded**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED",
    "message": "This client has already used promo code 'SPRING25' 5 times (limit reached)"
  }
}
```

### Concurrency Error (409 Conflict)

If affiliate row lock times out (concurrent high-volume purchases):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONFLICT_LOCK_TIMEOUT",
    "message": "System busy processing concurrent requests. Please retry the purchase."
  }
}
```

---

## Backward Compatibility

**Without Promo Code** (existing behavior unchanged):

```json
{
  "product_id": "prod-001",
  "workspace_name": "Acme University",
  "student_limit": 1000
}
```

Response:

```json
{
  "success": true,
  "data": {
    "license_id": "lic-001",
    "amount_paid": "5000.00",
    "discount_applied": false,
    "affiliate_code": null,
    "created_at": "2026-02-25T14:30:00Z"
  },
  "error": null
}
```

---

## Audit Trail

**Purchase Without Affiliate**:

```json
{
  "timestamp": "2026-02-25T14:30:00.123Z",
  "level": "info",
  "service": "api-licenses",
  "correlation_id": "req-abc123xyz",
  "event": "license_purchased",
  "license_id": "lic-001",
  "base_amount": "5000.00",
  "discount_applied": false
}
```

**Purchase With Affiliate**:

```json
{
  "timestamp": "2026-02-25T14:30:00.123Z",
  "level": "info",
  "service": "api-licenses",
  "correlation_id": "req-abc123xyz",
  "event": "license_purchased_with_affiliate",
  "license_id": "lic-002",
  "affiliate_code": "SPRING25",
  "affiliate_id": "aff-001",
  "base_amount": "5000.00",
  "discount_percentage": "1.05",
  "discount_amount": "52.50",
  "commission_percentage": "0.275",
  "commission_amount": "13.75",
  "final_amount": "4947.50",
  "client_id": "client-001"
}
```

---

## Validation Enforcement Points

### Step 1: Database Constraints

- Affiliate code MUST BE found via UNIQUE index (promo_code)
- Status enum CHECK constraint enforced by database
- Date range CHECK constraint enforced by database
- Percentages CHECK constraints enforced by database

### Step 2: Row Locking

- `SELECT ... FOR UPDATE` blocks concurrent modifications
- Guarantees usage_count accuracy
- Per-client COUNT within same transaction ensures no double-counting

### Step 3: Transactional Boundary

- All affiliate logic within single PostgreSQL transaction
- ROLLBACK on any validation failure
- No partial updates

---

## Integration Points

### 1. Base Amount Validation

```typescript
if (base_amount <= 0) {
  throw new Error("INVALID_LICENSE_AMOUNT");
}
```

Prevents corrupt financial records from reaching affiliate system.

### 2. Discount Application

```typescript
final_amount = base_amount - discount_amount;
// Always: discount_amount <= base_amount (enforced by calculations)
```

### 3. Audit Trail Linking

Both license and affiliate_usages records linked by license_id:

```sql
SELECT * FROM affiliate_usages au
JOIN licenses l ON au.license_id = l.id
WHERE au.affiliate_id = 'aff-001'
```

### 4. Correlation ID Propagation

```typescript
log.info({
  correlation_id: request.correlation_id, // Propagated throughout transaction
  license_id: created_license.id,
  affiliate_code_used: promo_code,
});
```

---

## Performance Characteristics

| Operation                                | Time          | Notes                                      |
| ---------------------------------------- | ------------- | ------------------------------------------ |
| Affiliate lookup (SELECT ... FOR UPDATE) | 1-10ms        | Index on promo_code, fast lock acquisition |
| Validations (date, status, limits)       | < 1ms         | All in-memory after SELECT                 |
| Per-client COUNT                         | 5-15ms        | Index on (affiliate_id, client_id)         |
| INSERT affiliate_usages                  | 2-5ms         | Simple transaction insert                  |
| UPDATE usage_count                       | < 1ms         | Single field update                        |
| Total affiliate overhead                 | 10-50ms       | Added to existing license purchase time    |
| Existing license purchase                | ~50-100ms     | (unchanged)                                |
| **Total with affiliate**                 | **~60-150ms** | p95 requirement: < 200ms ✓                 |

---

## Testing Requirements

### Unit Tests

```typescript
✓ Calculate discount correctly (NUMERIC precision)
✓ Calculate commission correctly
✓ Rounding works for edge cases (fractional cents)
```

### Integration Tests

```typescript
✓ License purchase without promo code (backward compatibility)
✓ License purchase with valid promo code
✓ Reject expired code
✓ Reject inactive code
✓ Reject code past usage limit
✓ Reject code past per-client limit
✓ Verify franchise record created
✓ Verify usage counter incremented
✓ Verify audit trail logged
✓ Verify discount applied to final amount
```

### Concurrency Tests

```typescript
✓ Multiple concurrent purchases with same code
✓ Usage counter consistency under concurrency
✓ Per-client limit enforcement with concurrent requests
✓ Lock timeout graceful handling (409 response)
```

### Transaction Tests

```typescript
✓ Rollback on validation failure
✓ Rollback on database error
✓ affiliate_usages NOT created on failure
✓ usage_count NOT incremented on failure
```

---

## Deployment Notes

- **Backward Compatible**: Existing clients not affected (promo_code optional)
- **Migration Required**: Deploy data-model (affiliate tables) before API changes
- **No Downtime**: License purchase logic unchanged for requests without promo_code
- **Feature Flag Suggested**: Can gate affiliate code processing during gradual rollout
