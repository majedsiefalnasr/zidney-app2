# Testing Guide — Stage 44: Plans & Subscriptions

**Stage:** STAGE_44_PLANS_AND_SUBSCRIPTIONS
**Branch:** `spec/044-plans-and-subscriptions`
**Audience:** QA engineers, reviewing developers

---

## Prerequisites

1. API running locally: `bun run dev` (from `apps/api/`)
2. Tenant database migrated through migration 023 for your test workspace
3. A valid backoffice JWT with a role that has `PLANS` and `SUBSCRIPTIONS` permissions
4. A student record exists in the tenant DB for subscription tests
5. Postman, curl, or HTTPie available

Environment variables assumed:

```bash
BASE_URL=http://localhost:3000
WORKSPACE_SLUG=<your-test-tenant-slug>
TOKEN=<backoffice-jwt>
```

---

## 1. Unit Tests (automated)

Run the domain service unit tests:

```bash
bun run test packages/domain-core/src/plans/__tests__/plans.service.test.ts
bun run test packages/domain-core/src/subscriptions/__tests__/subscriptions.service.test.ts
```

Expected: **23 passed, 0 failed**

---

## 2. Plans API — Manual Tests

### 2.1 Create Plan

```bash
curl -sX POST "$BASE_URL/api/v1/backoffice/workspace/plans" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Standard Plan",
    "description": "12-month access",
    "price": 9900,
    "currency": "SAR",
    "duration_days": 365,
    "is_active": true
  }' | jq .
```

Expected: `{ success: true, data: { id: "<uuid>", name: "Standard Plan", ... } }`

### 2.2 Get Plan

```bash
curl -s "$BASE_URL/api/v1/backoffice/workspace/plans/<plan-id>" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{ success: true, data: { id: "...", name: "Standard Plan", is_deleted: false } }`

Unknown ID: expect `{ success: false, error: { code: "PLAN_NOT_FOUND", ... } }`

### 2.3 List Plans

```bash
curl -s "$BASE_URL/api/v1/backoffice/workspace/plans?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{ success: true, data: { items: [...], total: 1, page: 1, limit: 10 } }`

### 2.4 Update Plan

```bash
curl -sX PATCH "$BASE_URL/api/v1/backoffice/workspace/plans/<plan-id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "price": 12000, "description": "Updated description" }' | jq .
```

Expected: `{ success: true, data: { ... price: 12000 } }`

### 2.5 Delete Plan (no active subscriptions)

```bash
curl -sX DELETE "$BASE_URL/api/v1/backoffice/workspace/plans/<plan-id>" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{ success: true, data: null }`

Verify the record is soft-deleted (not hard-deleted) — it should no longer appear in list results.

### 2.6 Delete Plan — blocked by active subscriptions

After activating a subscription for this plan (see Section 3), attempt delete again:
Expected: `{ success: false, error: { code: "PLAN_HAS_ACTIVE_SUBSCRIPTIONS", ... } }`

---

## 3. Subscriptions API — Manual Tests

### 3.1 Activate Subscription

Replace `<student-id>` and `<plan-id>` with real IDs from your test DB:

```bash
curl -sX POST "$BASE_URL/api/v1/backoffice/workspace/subscriptions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "<student-id>",
    "plan_id": "<plan-id>",
    "notes": "Manual activation"
  }' | jq .
```

Expected: `{ success: true, data: { id: "<uuid>", status: "ACTIVE", ... } }`

**Side effect check:** Query the students table / GET student endpoint — `subscription_status` should now be `ACTIVE`.

### 3.2 Activate Subscription — Plan not found

```bash
curl -sX POST "$BASE_URL/api/v1/backoffice/workspace/subscriptions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "student_id": "<student-id>", "plan_id": "00000000-0000-0000-0000-000000000000" }' | jq .
```

Expected: `{ success: false, error: { code: "PLAN_NOT_FOUND" } }`

### 3.3 Activate Subscription — Plan inactive

Deactivate a plan (`is_active: false`) then try to subscribe:
Expected: `{ success: false, error: { code: "PLAN_INACTIVE" } }`

### 3.4 Get Subscription

```bash
curl -s "$BASE_URL/api/v1/backoffice/workspace/subscriptions/<subscription-id>" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{ success: true, data: { id: "...", status: "ACTIVE", ... } }`

### 3.5 List Subscriptions

```bash
curl -s "$BASE_URL/api/v1/backoffice/workspace/subscriptions?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: list with the subscription created in 3.1.

Filter by student:

```bash
curl -s "$BASE_URL/api/v1/backoffice/workspace/subscriptions?student_id=<student-id>" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### 3.6 Cancel Subscription (ACTIVE)

```bash
curl -sX POST "$BASE_URL/api/v1/backoffice/workspace/subscriptions/<subscription-id>/cancel" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{ success: true, data: { ... status: "CANCELED" } }`

**Side effect check:** Student's `subscription_status` should now be `NONE` (or previous known state).

### 3.7 Cancel Subscription — Not found

Use a non-existent UUID:
Expected: `{ success: false, error: { code: "SUBSCRIPTION_NOT_FOUND" } }`

### 3.8 Cancel Subscription — Already CANCELED

Cancel an already-cancelled subscription:
Expected: `{ success: false, error: { code: "SUBSCRIPTION_CANNOT_CANCEL" } }`

### 3.9 Cancel Subscription — EXPIRED

Manually UPDATE a subscription status to EXPIRED in the DB, then try to cancel:
Expected: `{ success: false, error: { code: "SUBSCRIPTION_CANNOT_CANCEL" } }`

---

## 4. RBAC — Permission Guard Tests

### 4.1 No Token

```bash
curl -s "$BASE_URL/api/v1/backoffice/workspace/plans" | jq .
```

Expected: `401 Unauthorized`

### 4.2 Token Missing PLANS Permission

Use a role WITHOUT `PLANS` read permission:

```bash
curl -s "$BASE_URL/api/v1/backoffice/workspace/plans" \
  -H "Authorization: Bearer $TOKEN_NO_PLANS" | jq .
```

Expected: `403 Forbidden`

### 4.3 Token Missing SUBSCRIPTIONS Permission

Same pattern for subscriptions routes.

---

## 5. Tenant Isolation Test

Create a plan in Workspace A, then attempt to access it using a token from Workspace B:
Expected: `404 PLAN_NOT_FOUND` (the record exists but not in Workspace B's DB).

---

## 6. Role-Permission Modules Endpoint

Confirm PLANS and SUBSCRIPTIONS appear in the permission modules list:

```bash
curl -s "$BASE_URL/api/v1/backoffice/workspace/role-permission-modules" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.modules | keys'
```

Expected array should include `"plans"` and `"subscriptions"`.

---

## Known Limitations (by design)

- `subscription-enforcement.ts` middleware is a stub — not mounted. No runtime subscription gate yet.
- Payment gateway (`paymentMethod: 'GATEWAY'`) is deferred to Stage 45+. Only `'MANUAL'` is used in this stage.
- No subscription renewal logic — deferred.
