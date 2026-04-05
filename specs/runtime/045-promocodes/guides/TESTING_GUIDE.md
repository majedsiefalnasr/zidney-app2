# Testing Guide — STAGE 45: Promocodes

**Purpose:** Manual testing scenarios for the promocode CRUD, discount engine, and subscription integration.

---

## Setup

### Prerequisites

- API running: `bun run dev:api`
- Test database seeded with at least one organization/tenant
- Postman or equivalent HTTP client

### Test Database State

Use the seeded data from your test tenant:

- 1+ organizations
- 1+ subscription plans
- 1+ student users

---

## Test Scenarios

### 1. Create Promocode (Admin)

**Endpoint:** `POST /backoffice/promocodes`  
**Auth:** Admin token (`MANAGE_PROMOCODES` permission)  
**Scope:** Tenant 1

**Request:**

```json
{
  "code": "EARLY_BIRD_50",
  "type": "PERCENTAGE",
  "value": 50,
  "max_uses": 100,
  "max_uses_per_student": 1,
  "active": true,
  "expires_at": "2026-12-31T23:59:59Z"
}
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "id": "promo_xxx",
    "code": "EARLY_BIRD_50",
    "type": "PERCENTAGE",
    "value": "50",
    "active": true,
    "max_uses": 100,
    "max_uses_per_student": 1,
    "created_at": "2026-04-05T...",
    "expires_at": "2026-12-31T23:59:59Z"
  },
  "error": null
}
```

**Verification:**

- ✅ Response code: 201 Created
- ✅ Promocode ID is a valid UUID
- ✅ Code is uppercase (`EARLY_BIRD_50`)
- ✅ Value is stored as string number (`"50"`)
- ✅ Timestamps are ISO 8601 format

---

### 2. List Promocodes (Admin)

**Endpoint:** `GET /backoffice/promocodes`  
**Auth:** Admin token  
**Scope:** Tenant 1

**Query Parameters:**

- `page`: 1
- `limit`: 20
- `active`: true (optional filter)

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "promo_xxx",
        "code": "EARLY_BIRD_50",
        "type": "PERCENTAGE",
        "value": "50",
        "active": true,
        "max_uses": 100,
        "max_uses_per_student": 1,
        "created_at": "2026-04-05T...",
        "expires_at": "2026-12-31T23:59:59Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  },
  "error": null
}
```

**Verification:**

- ✅ Response code: 200 OK
- ✅ `items` array contains at least the promocode created in Test 1
- ✅ Pagination metadata (`total`, `page`, `limit`) present

---

### 3. Get Single Promocode (Admin)

**Endpoint:** `GET /backoffice/promocodes/{id}`  
**Auth:** Admin token  
**Scope:** Tenant 1  
**Param:** ID from Test 1

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "id": "promo_xxx",
    "code": "EARLY_BIRD_50",
    "type": "PERCENTAGE",
    "value": "50",
    "active": true,
    "max_uses": 100,
    "max_uses_per_student": 1,
    "total_usages": 0,
    "total_discount_amount": 0,
    "created_at": "2026-04-05T...",
    "expires_at": "2026-12-31T23:59:59Z"
  },
  "error": null
}
```

**Verification:**

- ✅ Response code: 200 OK
- ✅ `total_usages` and `total_discount_amount` are **0** (no one has used it yet)
- ✅ All fields match Test 1 response

**Error Case:** Get non-existent ID

- **Endpoint:** `GET /backoffice/promocodes/promo_nonexistent`
- **Expected:** 404 NOT_FOUND with error code `PROMOCODE_NOT_FOUND`

---

### 4. Validate Promocode (Student)

**Endpoint:** `POST /backoffice/promocodes/{id}/validate`  
**Auth:** Student token (`USE_PROMOCODES` permission)  
**Scope:** Tenant 1  
**Param:** ID from Test 1

**Request:**

```json
{
  "student_id": "student_uuid_from_db"
}
```

**Expected Response (Success):**

```json
{
  "success": true,
  "data": {
    "is_valid": true,
    "discount_amount": 0,
    "final_price": 100,
    "reason": "promocode_valid"
  },
  "error": null
}
```

**Verification:**

- ✅ Response code: 200 OK
- ✅ `is_valid` = true
- ✅ At least one of: discount_amount > 0 OR final_price < original_price OR reason = "valid"

**Error Case 1:** Expired Promocode

- Create a promocode with `expires_at` in the past
- Call validate endpoint
- **Expected:** `is_valid` = false, `reason` = `"promocode_expired"`

**Error Case 2:** Inactive Promocode

- Create a promocode with `active` = false
- Call validate endpoint
- **Expected:** `is_valid` = false, `reason` = `"promocode_inactive"`

**Error Case 3:** Per-User Limit Exceeded

- Create a promocode with `max_uses_per_student` = 1
- Use it once for a student
- Try to use again for same student
- **Expected:** `is_valid` = false, `reason` = `"per_student_limit_exceeded"`

---

### 5. Apply Promocode to Subscription (Discount Integration)

**Endpoint:** `POST /backoffice/subscriptions`  
**Auth:** Student token  
**Scope:** Tenant 1

**Request (with promocode):**

```json
{
  "plan_id": "plan_uuid",
  "student_id": "student_uuid",
  "promocode_id": "promo_xxx",
  "start_date": "2026-04-05"
}
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "id": "sub_xxx",
    "student_id": "student_uuid",
    "plan_id": "plan_uuid",
    "promocode_id": "promo_xxx",
    "discount_amount": 25,
    "final_price": 75,
    "status": "active",
    "created_at": "2026-04-05T...",
    "expires_at": "2027-04-05T..."
  },
  "error": null
}
```

**Verification:**

- ✅ Response code: 201 Created
- ✅ `promocode_id` is set
- ✅ `discount_amount` > 0 (50% of $100 = $50 for PERCENTAGE type)
- ✅ `final_price` = original_price - discount_amount ($100 - $50 = $50)
- ✅ Subscription created with discount applied

**Database Verification:**

Query the `promocode_usages` table:

```sql
SELECT * FROM promocode_usages
WHERE promocode_id = 'promo_xxx'
  AND student_id = 'student_uuid'
```

**Expected:**

- ✅ 1 row inserted
- ✅ `discount_amount` = 50 (for 50% PERCENTAGE)
- ✅ `subscription_id` matches the subscription created above
- ✅ `created_at` is current timestamp

---

### 6. Get Promocode Analytics (Admin)

**Endpoint:** `GET /backoffice/promocodes/{id}/analytics`  
**Auth:** Admin token  
**Scope:** Tenant 1  
**Param:** ID from Test 1

**Expected Response (after Test 5):**

```json
{
  "success": true,
  "data": {
    "id": "promo_xxx",
    "code": "EARLY_BIRD_50",
    "total_usages": 1,
    "total_discount_amount": 50,
    "unique_students": 1,
    "effective_rate": "50.00%"
  },
  "error": null
}
```

**Verification:**

- ✅ Response code: 200 OK
- ✅ `total_usages` = 1 (one subscription created with this promo)
- ✅ `total_discount_amount` = 50 or 50.00 (aggregate of all discounts)
- ✅ `unique_students` = 1 (one student used this promo)
- ✅ Numbers increment from previous value (was 0 in Test 3)

---

### 7. Deactivate Promocode (Admin)

**Endpoint:** `DELETE /backoffice/promocodes/{id}`  
**Auth:** Admin token  
**Scope:** Tenant 1  
**Param:** ID from Test 1

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "id": "promo_xxx",
    "code": "EARLY_BIRD_50",
    "active": false,
    "deactivated_at": "2026-04-05T..."
  },
  "error": null
}
```

**Verification:**

- ✅ Response code: 200 OK
- ✅ `active` = false
- ✅ `deactivated_at` is set

**Follow-up:** Try to use this promocode again

- Call validate endpoint with deactivated promo
- **Expected:** `is_valid` = false, `reason` = `"promocode_inactive"`

---

## Cross-Tenant Isolation Tests

### Test: Tenant Isolation

**Setup:**

- Create Tenant A and Tenant B (two organizations in test DB)
- Create Promocode X in Tenant A

**Test:**

1. As Tenant A admin: `GET /backoffice/promocodes` → See Promocode X ✅
2. As Tenant B admin: `GET /backoffice/promocodes` → Do NOT see Promocode X ✅
3. As Tenant B admin: Try to access Tenant A's promo directly `GET /backoffice/promocodes/promo_x_id` → 404 Forbidden ✅

**Expected:** Each tenant sees and can only modify their own promocodes.

---

## Performance Tests

### Test: Bulk List (Load)

**Setup:** Create 1000 promocodes in Tenant

**Endpoint:** `GET /backoffice/promocodes?page=1&limit=100`

**Verification:**

- ✅ Response time < 500ms
- ✅ Page 1 returns 100 items
- ✅ Query uses covering index on `active`, `expires_at`, `code`

---

## Error Handling Tests

| Scenario                                 | Expected Code | Expected Error Code          |
| ---------------------------------------- | ------------- | ---------------------------- |
| Create with invalid code format          | 400           | `INVALID_CODE_FORMAT`        |
| Create with expired date in past         | 400           | `INVALID_EXPIRATION_DATE`    |
| Get non-existent promocode               | 404           | `PROMOCODE_NOT_FOUND`        |
| Apply after limit exceeded               | 409           | `GLOBAL_LIMIT_EXCEEDED`      |
| Apply after per-student limit            | 409           | `PER_STUDENT_LIMIT_EXCEEDED` |
| Unauthorized (missing MANAGE_PROMOCODES) | 403           | `PERMISSION_DENIED`          |

---

## Checklist for QA

- [ ] All 7 CRUD operations work (create, list, get, validate, apply, analytics, deactivate)
- [ ] Error handling: invalid input, expired, inactive, limits
- [ ] Cross-tenant isolation: students can't see other tenants' promos
- [ ] Discount calculation: PERCENTAGE/FIXED/FREE_TRIAL all work correctly
- [ ] Database state: promocode_usages table updated correctly
- [ ] Analytics: usage counts and totals are accurate
- [ ] Performance: list with 1000 items < 500ms
- [ ] Rate limiting: per-student limit enforced
- [ ] Global limit: max_uses limit enforced
- [ ] Timestamps: all in ISO 8601 UTC

---

**For issues:** File a bug with endpoint, HTTP method, request body, response code, and response body.
