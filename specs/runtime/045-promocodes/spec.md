# Stage 45 – Promocodes

**Phase:** 3 – Backoffice Core
**Subdomain:** 06_COMMERCIAL_LAYER
**Branch:** `spec/045-promocodes`
**Stage File:** `specs/phases/03_BACKOFFICE_CORE/06_COMMERCIAL_LAYER/STAGE_45_PROMOCODES.md`

---

## Objective

Implement a workspace-scoped promocode system that enables Backoffice admins to:

1. **Promocode CRUD** — Create, list, get, and deactivate discount codes per workspace
2. **Discount Engine** — Calculate discounts (PERCENTAGE, FIXED, FREE_TRIAL) server-side
3. **Validation Engine** — Enforce 7 sequential validation checks before any discount is applied
4. **Usage Tracking** — Record every redemption transactionally in `promocode_usages`
5. **Stacking Policy** — Enforce stackable vs. non-stackable rules deterministically
6. **Subscription Integration** — Hook into Stage 44 subscription activation flow
7. **Analytics** — Report redemption counts, revenue impact, active/expired code breakdown

Promocodes are strictly per-workspace. No code may be shared across workspaces. No discount is ever calculated on the client.

---

## Architecture Governance Declaration

✅ No cross-tenant access — all reads/writes scoped to tenant DB (ADR-0001)
✅ No middleware bypass — license and authentication middleware mandatory on all workspace routes
✅ No grading outside Worker — not applicable to this stage
✅ Tenant resolver only — no direct database instantiation
✅ No weakening of snapshot integrity — not applicable to this stage
✅ All writes transactional — usage recording and subscription creation in a single SERIALIZABLE transaction
✅ Version compatibility enforced — migrations follow forward-only policy (ADR-0003)
✅ Server-authoritative time — all time comparisons use DB `NOW()` (ADR-0006)
✅ No client-authoritative time — client-supplied dates validated/normalized server-side
✅ No client-calculated discount — server recalculates discount on every apply; client value is never trusted
✅ Code immutability — `code`, `type`, and `value` fields are immutable after creation
✅ Usage history preservation — `promocode_usages` rows are never deleted

---

## Trust Chain Verification

- [x] Tenant isolation is the first gate (slug-based, database-per-tenant)
- [x] License validation occurs before any workspace operation
- [x] Authentication is checked after tenant resolution
- [x] Attempt engine: not applicable
- [x] Runtime enforces server-authoritative time for all validity window checks
- [x] Frontoffice receives only presentation data — discount is not calculated on client
- [x] All validation logic runs server-side — no client-validated discount accepted

---

## Import Boundary Compliance

- `apps/api` → `packages/domain-core` ✅
- `packages/domain-core/promocodes` → `packages/domain-core/subscriptions` ✅ (type reference for subscription activation integration)
- `packages/domain-core/promocodes` → `packages/domain-core/plans` ✅ (plan eligibility check)
- `packages/*` → `apps/*` ❌ FORBIDDEN
- UI → DB schemas ❌ FORBIDDEN
- Client-calculated discount passed to server ❌ FORBIDDEN

---

## Database Schema

### New Table: `promocodes`

```sql
CREATE TABLE promocodes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                VARCHAR(100) NOT NULL,
  type                VARCHAR(20) NOT NULL,           -- 'PERCENTAGE' | 'FIXED' | 'FREE_TRIAL'
  value               NUMERIC(10,2),                  -- required for PERCENTAGE/FIXED; NULL for FREE_TRIAL
  free_trial_days     INTEGER,                        -- required for FREE_TRIAL; NULL otherwise
  valid_from          TIMESTAMPTZ NOT NULL,
  valid_until         TIMESTAMPTZ NOT NULL,
  usage_limit         INTEGER,                        -- NULL = unlimited
  per_user_limit      INTEGER NOT NULL DEFAULT 1,
  applies_to_plan_ids JSONB NOT NULL DEFAULT '[]',    -- array of plan UUIDs; empty array = all plans
  target_division_ids JSONB,                          -- NULL = all divisions; array of division UUIDs
  target_group_ids    JSONB,                          -- NULL = all groups; array of group UUIDs
  is_stackable        BOOLEAN NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique code per tenant DB (each tenant has its own DB)
CREATE UNIQUE INDEX idx_promocodes_code_lower ON promocodes (LOWER(code));

-- Fast lookup for active codes within a validity window
CREATE INDEX idx_promocodes_active ON promocodes (is_active, valid_from, valid_until)
  WHERE is_active = TRUE;
```

Constraints:

- `type IN ('PERCENTAGE', 'FIXED', 'FREE_TRIAL')`
- `value IS NOT NULL` when `type IN ('PERCENTAGE', 'FIXED')`
- `value IS NULL` when `type = 'FREE_TRIAL'`
- `free_trial_days IS NOT NULL AND free_trial_days > 0` when `type = 'FREE_TRIAL'`
- `free_trial_days IS NULL` when `type != 'FREE_TRIAL'`
- `value > 0` when `value IS NOT NULL`
- `value <= 100` when `type = 'PERCENTAGE'`
- `per_user_limit >= 1`
- `usage_limit IS NULL OR usage_limit >= 1`
- `valid_until > valid_from`
- `code` is case-insensitively unique within the tenant database (enforced by index above)

### New Table: `promocode_usages`

```sql
CREATE TABLE promocode_usages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promocode_id    UUID NOT NULL REFERENCES promocodes(id) ON DELETE RESTRICT,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  discount_amount NUMERIC(10,2) NOT NULL,
  redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Counted for usage_limit enforcement
CREATE INDEX idx_promocode_usages_promocode ON promocode_usages (promocode_id);

-- Counted for per_user_limit enforcement
CREATE INDEX idx_promocode_usages_student_promocode ON promocode_usages (student_id, promocode_id);

-- For subscription lookup and deduplication
CREATE UNIQUE INDEX idx_promocode_usages_subscription ON promocode_usages (promocode_id, subscription_id);
```

Constraints:

- `discount_amount >= 0`
- A `(promocode_id, subscription_id)` pair must be unique — no double-application to the same subscription
- `promocode_usages` rows are NEVER deleted (history is immutable)

---

## Migration Strategy

**Migration number:** 024 (follows `20260407_023_plans_and_subscriptions.ts` from Stage 44)
**File:** `apps/api/src/db/tenant/migrations/20260408_024_promocodes.ts`

Steps:

1. Create `promocodes` table with all columns, constraints, and indexes
2. Create `promocode_usages` table with all columns, constraints, and indexes
3. No data backfill required

---

## Domain Modules

### New: `packages/domain-core/src/promocodes/`

```text
promocodes.types.ts       — Pure types: PromocodeRow, PromocodeInput, PromocodeValidationContext, DiscountResult
promocodes.errors.ts      — Error codes and error factory functions
promocodes.repository.ts  — listPromocodes, getPromocode, getPromocodeByCode, createPromocode, deactivatePromocode
                            countUsages, countUserUsages, insertUsage
promocodes.validator.ts   — validatePromocodeApplication(context): ValidatorResult (7 checks, pure function)
promocodes.calculator.ts  — calculateDiscount(type, value, planPrice): DiscountResult (pure function)
promocodes.service.ts     — PromocodeService: orchestrates validator + calculator + repository
index.ts                  — Public exports
```

### Types (`promocodes.types.ts`)

```typescript
export type PromocodeType = "PERCENTAGE" | "FIXED" | "FREE_TRIAL";

export interface PromocodeRow {
  id: string;
  code: string;
  type: PromocodeType;
  value: number | null;
  free_trial_days: number | null;
  valid_from: Date;
  valid_until: Date;
  usage_limit: number | null;
  per_user_limit: number;
  applies_to_plan_ids: string[]; // empty = all plans
  target_division_ids: string[] | null; // null = all divisions
  target_group_ids: string[] | null; // null = all groups
  is_stackable: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PromocodeInput {
  code: string;
  type: PromocodeType;
  value?: number;
  free_trial_days?: number;
  valid_from: string; // ISO 8601
  valid_until: string; // ISO 8601
  usage_limit?: number;
  per_user_limit?: number;
  applies_to_plan_ids?: string[];
  target_division_ids?: string[];
  target_group_ids?: string[];
  is_stackable?: boolean;
}

export interface PromocodeValidationContext {
  code: string;
  student_id: string;
  plan_id: string;
  student_division_id: string | null;
  student_group_id: string | null;
  existing_promo_ids_on_subscription: string[]; // for stacking check
  server_now: Date; // must come from DB NOW(), never from client
}

export interface DiscountResult {
  discount_amount: number;
  final_price: number;
  free_trial_days?: number;
}

export interface PromocodeUsageRow {
  id: string;
  promocode_id: string;
  student_id: string;
  subscription_id: string;
  discount_amount: number;
  redeemed_at: Date;
}
```

### Validation Engine (`promocodes.validator.ts`)

The validation function is a **pure function** receiving a `PromocodeValidationContext` plus the `PromocodeRow` and usage counts. It returns a `ValidatorResult` with a pass/fail status and an error code.

Seven sequential checks (fail-fast; return on first failure):

| #   | Check              | Condition                                                                                       | Error Code on Failure                            |
| --- | ------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Code exists        | `promocode` is not null                                                                         | `PROMOCODE_NOT_FOUND`                            |
| 2   | Code is active     | `is_active === true`                                                                            | `PROMOCODE_INACTIVE`                             |
| 3   | Validity window    | `valid_from <= server_now <= valid_until`                                                       | `PROMOCODE_NOT_YET_VALID` or `PROMOCODE_EXPIRED` |
| 4   | Global usage limit | `usage_limit IS NULL` OR `total_usage_count < usage_limit`                                      | `PROMOCODE_USAGE_LIMIT_REACHED`                  |
| 5   | Per-user limit     | `per_user_limit IS NULL` OR `user_usage_count < per_user_limit`                                 | `PROMOCODE_PER_USER_LIMIT_REACHED`               |
| 6   | Plan eligibility   | `applies_to_plan_ids` is empty OR `plan_id IN applies_to_plan_ids`                              | `PROMOCODE_PLAN_NOT_ELIGIBLE`                    |
| 7   | Student targeting  | Both `target_division_ids` and `target_group_ids` are NULL, OR student's division/group matches | `PROMOCODE_STUDENT_NOT_IN_TARGET`                |

Stacking check (conditional — only run when the subscription already has an applied promo):

- If `is_stackable === false` AND `existing_promo_ids_on_subscription.length > 0` → `PROMOCODE_STACKING_NOT_ALLOWED`
- If `is_stackable === true` → allowed; apply in deterministic order (by `redeemed_at ASC`)

Check 7 semantics — student is eligible if:

- `target_division_ids IS NULL` AND `target_group_ids IS NULL` (no targeting)
- OR `target_division_ids` is NOT NULL AND `student_division_id IN target_division_ids`
- OR `target_group_ids` is NOT NULL AND `student_group_id IN target_group_ids`

Targeting is OR-based (division OR group match is sufficient).

### Discount Calculator (`promocodes.calculator.ts`)

Pure function — no side effects, no DB access.

```typescript
function calculateDiscount(
  type: PromocodeType,
  value: number | null,
  free_trial_days: number | null,
  plan_price: number,
): DiscountResult;

// PERCENTAGE: discount = plan_price * value / 100; clamped to plan_price minimum
// FIXED:      discount = min(value, plan_price); final_price = max(0, plan_price - value)
// FREE_TRIAL: discount = plan_price; final_price = 0; free_trial_days returned
```

Rules:

- `PERCENTAGE`: `discount_amount = floor(plan_price * value / 100 * 100) / 100` (round down to 2 decimal places); `final_price = plan_price - discount_amount`; `final_price >= 0`
- `FIXED`: `final_price = max(0, plan_price - value)`; `discount_amount = plan_price - final_price`
- `FREE_TRIAL`: `final_price = 0`; `discount_amount = plan_price`; `free_trial_days` passed through

`FREE_TRIAL` requires the plan to be `billing_type = 'recurring'`. This is validated before calling the calculator.

### PromocodeService (`promocodes.service.ts`)

```typescript
class PromocodeService {
  // --- Admin CRUD ---
  createPromocode(db, input: PromocodeInput): Promise<PromocodeRow>;
  listPromocodes(db, filters: ListPromocodesFilter): Promise<PromocodeRow[]>;
  getPromocode(db, id: string): Promise<PromocodeRow>;
  deactivatePromocode(db, id: string): Promise<PromocodeRow>;

  // --- Validation & Application ---
  validatePromocode(db, context: PromocodeValidationContext): Promise<PromocodeValidationResult>;
  applyPromocode(
    db,
    tx,
    context: PromocodeValidationContext,
    subscriptionId: string,
    planPrice: number,
  ): Promise<DiscountResult>;

  // --- Analytics ---
  getAnalytics(db, filters: AnalyticsFilter): Promise<PromocodeAnalytics>;
}
```

`applyPromocode`:

1. Re-runs all 7 validation checks inside the transaction (double-check after acquiring lock)
2. Calculates discount server-side
3. Inserts `promocode_usages` record
4. Returns `DiscountResult` to caller (subscription service)

The SERIALIZABLE transaction is opened in the subscription service (Stage 44 extension). `applyPromocode` receives the transaction object (`tx`) and participates in it without owning it.

---

## API Endpoints

### Promocodes (Backoffice — Admin only)

All routes require: tenant resolution → license middleware → authentication middleware (admin role).

| Method | Path                                    | Handler                    | Description                                     |
| ------ | --------------------------------------- | -------------------------- | ----------------------------------------------- |
| GET    | `/backoffice/promocodes`                | list-promocodes.ts         | List all promocodes in workspace (filterable)   |
| POST   | `/backoffice/promocodes`                | create-promocode.ts        | Create a new promocode                          |
| GET    | `/backoffice/promocodes/:id`            | get-promocode.ts           | Get promocode by ID                             |
| POST   | `/backoffice/promocodes/:id/deactivate` | deactivate-promocode.ts    | Deactivate a promocode (sets is_active = false) |
| GET    | `/backoffice/promocodes/analytics`      | get-promocode-analytics.ts | Analytics summary across all codes              |

### Validate Endpoint (Backoffice — Admin, called before subscription creation UI)

| Method | Path                              | Handler               | Description                                                                  |
| ------ | --------------------------------- | --------------------- | ---------------------------------------------------------------------------- |
| POST   | `/backoffice/promocodes/validate` | validate-promocode.ts | Validate a code against a student+plan combination; returns discount preview |

**Note:** This endpoint does NOT apply the promo or create any usage record. It is a read-only preview for the admin UI. It runs the full 7-check validation and returns the `DiscountResult` on success.

### Subscription Integration (extends Stage 44)

`POST /backoffice/subscriptions` (Stage 44 handler: `create-subscription.ts`) is extended to accept an optional `promo_code` field in the request body.

Flow inside `create-subscription.ts`:

1. Parse `promo_code` from request body (optional string)
2. If present: call `PromocodeService.validatePromocode()` — throws structured error on failure
3. Begin SERIALIZABLE transaction
4. Apply discount via `PromocodeService.applyPromocode(tx, ...)` — returns `DiscountResult`
5. Create subscription with `final_price` from `DiscountResult`; if `FREE_TRIAL`, add `free_trial_days` to `expires_at`
6. Commit transaction (includes both `subscriptions` insert AND `promocode_usages` insert)
7. On gateway callback: server re-validates promo before creating subscription (never trusts client-sent discount)

---

## Functional Requirements

### FR-01 — Promocode Creation

Backoffice admin creates a promocode with:

- `code` (required, unique per workspace, case-insensitive, max 100 characters)
- `type` (required: PERCENTAGE | FIXED | FREE_TRIAL)
- `value` (required for PERCENTAGE/FIXED; must be > 0; PERCENTAGE must be ≤ 100)
- `free_trial_days` (required for FREE_TRIAL; must be > 0)
- `valid_from` / `valid_until` (required; `valid_until > valid_from`; server normalizes to UTC)
- `usage_limit` (optional; null = unlimited)
- `per_user_limit` (optional; default 1; minimum 1)
- `applies_to_plan_ids` (optional; default empty array = all plans)
- `target_division_ids` / `target_group_ids` (optional; null = all students)
- `is_stackable` (optional; default false)

After creation, `code`, `type`, and `value`/`free_trial_days` are immutable. Deactivation is the only mutation allowed.

### FR-02 — Promocode Listing

Admin can list all promocodes in the workspace with optional filters:

- `is_active` (boolean)
- `type` (PERCENTAGE | FIXED | FREE_TRIAL)
- Validity status: `ACTIVE_NOW` (valid_from ≤ now ≤ valid_until and is_active = true), `EXPIRED` (valid_until < now), `NOT_YET_VALID` (valid_from > now), `INACTIVE` (is_active = false)
- Pagination: `page` + `limit` with default `limit = 20`

Response includes current usage count per code (via sub-query).

### FR-03 — Promocode Get

Admin retrieves a single promocode by ID. Response includes full code details plus current `total_usages` count.

### FR-04 — Promocode Deactivation

Admin sets `is_active = false` on a promocode.

- Deactivated codes cannot be applied to new subscriptions
- All historical usages remain queryable
- Deactivation is irreversible via the API (no reactivation endpoint)
- `updated_at` is refreshed on deactivation

### FR-05 — Code Immutability

After creation:

- `code`, `type`, `value`, `free_trial_days` cannot be updated
- `valid_from`, `valid_until`, `usage_limit`, `per_user_limit`, `is_stackable`, `applies_to_plan_ids`, `target_division_ids`, `target_group_ids` cannot be updated
- The only permitted write operation on a promocode record is deactivation (`is_active = false`)
- Any PATCH endpoint for promocodes is FORBIDDEN in this stage

### FR-06 — Promocode Validation (7 Checks)

When a promo code is submitted (via validate endpoint or during subscription creation), the server runs all 7 checks in sequence (fail-fast). See Validation Engine section. All checks use server-supplied timestamps from the DB — never client timestamps.

### FR-07 — Discount Calculation

Server calculates the discount using the pure `calculateDiscount` function. Rules:

- PERCENTAGE: `final_price = plan_price - (plan_price × value / 100)`, rounded to 2 decimal places, minimum 0
- FIXED: `final_price = max(0, plan_price - value)`
- FREE_TRIAL: `final_price = 0`; subscription `expires_at = created_at + free_trial_days`; FREE_TRIAL only valid on plans with `billing_type = 'recurring'`

The `discount_amount` stored in `promocode_usages` is what is calculated server-side. The client must not influence this value.

### FR-08 — Stacking Rules

Default behavior: `is_stackable = false`. When a student applies a promo with `is_stackable = false`:

- If another promocode is already recorded in `promocode_usages` for this subscription → reject with `PROMOCODE_STACKING_NOT_ALLOWED`

When `is_stackable = true`:

- Multiple codes may be applied to a single subscription
- Applied in deterministic order: by `redeemed_at ASC`
- After each code is applied, `final_price` from the previous calculation becomes `plan_price` for the next calculation
- Cumulative total discount must not reduce `final_price` below 0

For MVP (this stage), stacking is expected to be rare (most codes will have `is_stackable = false`). The stacking check is enforced but complex multi-code stacking scenarios are not a primary feature.

### FR-09 — Usage Recording (Transactional)

Every application of a promocode must:

1. Insert a `promocode_usages` record atomically with the `subscriptions` insert
2. Use a single SERIALIZABLE transaction
3. If the transaction fails for any reason, no usage is recorded and no subscription is created
4. The `discount_amount` recorded is always the server-calculated value

### FR-10 — Per-User Limit Enforcement

Before applying, the system counts existing `promocode_usages` rows matching `(promocode_id, student_id)`.
If count >= `per_user_limit` → reject with `PROMOCODE_PER_USER_LIMIT_REACHED`.
This count is done inside the transaction with a `FOR UPDATE` lock on the `promocode_usages` aggregate to prevent race conditions.

### FR-11 — Global Usage Limit Enforcement

Before applying, the system counts total `promocode_usages` rows matching `promocode_id`.
If count >= `usage_limit` (when `usage_limit IS NOT NULL`) → reject with `PROMOCODE_USAGE_LIMIT_REACHED`.
This count is done inside the transaction with a `FOR UPDATE` lock.

### FR-12 — Targeting Enforcement

If `target_division_ids IS NOT NULL` or `target_group_ids IS NOT NULL`:

- The student's `division_id` and `group_id` are loaded from the `students` table at validation time
- Student is eligible if: `student.division_id IN target_division_ids` OR `student.group_id IN target_group_ids`
- If targeting is configured and student does not match → reject with `PROMOCODE_STUDENT_NOT_IN_TARGET`
- If both arrays are NULL, targeting is disabled (all students eligible)

### FR-13 — Subscription Flow Integration

The `activate-subscription.ts` route (Stage 44) is extended:

- Accepts optional `promo_code: string` in body
- If `promo_code` is provided:
  1. Load student's division and group
  2. Run `PromocodeService.validatePromocode()` (returns validated `PromocodeRow` + `DiscountResult` preview)
  3. Inside SERIALIZABLE transaction: call `PromocodeService.applyPromocode(tx, ...)` to re-validate under lock and record usage
  4. Create subscription with server-calculated `final_price`
  5. For FREE_TRIAL: set `expires_at = NOW() + free_trial_days`

On gateway payment callback:

- Re-validate the promo code before confirming subscription creation
- Use server-recalculated discount, not the amount from the gateway callback
- If re-validation fails (e.g., limit just reached): reject the callback, do not create subscription, trigger gateway refund flow (out of scope for this stage; log and alert)

### FR-14 — Analytics & Reporting

`GET /backoffice/promocodes/analytics` returns:

```typescript
interface PromocodeAnalytics {
  total_codes: number;
  active_codes: number; // is_active = true AND valid_until >= now
  expired_codes: number; // valid_until < now
  inactive_codes: number; // is_active = false
  total_redemptions: number;
  revenue_impact: number; // sum of discount_amount across all usages
  by_type: {
    PERCENTAGE: { count: number; redemptions: number; revenue_impact: number };
    FIXED: { count: number; redemptions: number; revenue_impact: number };
    FREE_TRIAL: { count: number; redemptions: number; revenue_impact: number };
  };
  top_codes: Array<{
    id: string;
    code: string;
    redemptions: number;
    revenue_impact: number;
  }>; // top 10 by redemptions
}
```

Individual code analytics (included in `GET /backoffice/promocodes/:id`):

```typescript
interface SinglePromocodeAnalytics {
  total_usages: number;
  usages_remaining: number | null; // null if usage_limit is null
  revenue_impact: number;
  usages_by_division: Array<{ division_id: string; count: number }>;
  usages_by_group: Array<{ group_id: string; count: number }>;
}
```

MMC app does NOT access individual student-level promocode data under any circumstances.

### FR-15 — Expiration Behavior

When `valid_until < NOW()` at validation time:

- The code cannot be applied to new subscriptions
- Existing subscriptions that used the code are not affected
- `promocode_usages` history remains fully queryable
- Admin can still view the expired code and its usage history

---

## Validation Schemas (`packages/validation`)

New Zod schemas:

- `createPromocodeBodySchema` — All creation fields; conditional validation for type-specific fields
- `promocodeIdParamsSchema` — UUID
- `validatePromocodeBodySchema` — `{ code: string; student_id: UUID; plan_id: UUID }`
- `listPromocodesQuerySchema` — `{ is_active?: boolean; type?: PromocodeType; status?: string; page?: number; limit?: number }`
- `createSubscriptionWithPromoBodySchema` — Extends Stage 44 `createSubscriptionBodySchema` with optional `promo_code?: string`

Conditional Zod validation in `createPromocodeBodySchema`:

- When `type = 'PERCENTAGE'`: `value` required, `0 < value <= 100`, `free_trial_days` must be absent
- When `type = 'FIXED'`: `value` required, `value > 0`, `free_trial_days` must be absent
- When `type = 'FREE_TRIAL'`: `free_trial_days` required, `free_trial_days > 0`, `value` must be absent

---

## Error Codes

| Code                                      | HTTP | Description                                                                   |
| ----------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `PROMOCODE_NOT_FOUND`                     | 404  | Promocode does not exist in this workspace                                    |
| `PROMOCODE_INACTIVE`                      | 422  | Promocode has been deactivated                                                |
| `PROMOCODE_EXPIRED`                       | 422  | Promocode validity window has passed (`valid_until < now`)                    |
| `PROMOCODE_NOT_YET_VALID`                 | 422  | Promocode validity window has not started (`valid_from > now`)                |
| `PROMOCODE_USAGE_LIMIT_REACHED`           | 422  | Global usage limit has been reached                                           |
| `PROMOCODE_PER_USER_LIMIT_REACHED`        | 422  | This student has reached the per-user limit for this code                     |
| `PROMOCODE_PLAN_NOT_ELIGIBLE`             | 422  | Selected plan is not in the code's `applies_to_plan_ids` list                 |
| `PROMOCODE_STUDENT_NOT_IN_TARGET`         | 422  | Student's division/group does not match the code's targeting rules            |
| `PROMOCODE_STACKING_NOT_ALLOWED`          | 422  | This code is not stackable and a code is already applied to this subscription |
| `PROMOCODE_FREE_TRIAL_REQUIRES_RECURRING` | 422  | FREE_TRIAL type can only be applied to recurring billing plans                |
| `PROMOCODE_DISCOUNT_EXCEEDS_PLAN`         | 422  | Cumulative stacked discount would exceed plan price (internal guard)          |
| `PROMOCODE_CODE_ALREADY_EXISTS`           | 409  | A promocode with this code already exists in the workspace                    |
| `PROMOCODE_IMMUTABLE_FIELDS`              | 422  | Attempt to update immutable fields (code, type, value)                        |

All error responses conform to the platform contract: `{ success: false, data: null, error: { code, message } }`.

---

## Non-Goals

- Cross-workspace promocodes (FORBIDDEN)
- Client-calculated discount accepted by server (FORBIDDEN)
- Updating code/type/value after creation (FORBIDDEN)
- Hard deletion of `promocode_usages` records (FORBIDDEN)
- Retroactive application of a promocode to an existing subscription (FORBIDDEN)
- MMC access to individual student-level promocode usage data (FORBIDDEN)
- Bulk code generation or CSV import (not in scope for this stage)
- Public-facing (Frontoffice) endpoint for code submission by students (admin-only in this stage) — note: any future frontoffice student-facing validate endpoint MUST upgrade rate limiting to per-IP + per-user (≤3/min) before launch
- Gateway refund orchestration on re-validation failure (out of scope; log and alert only)

---

## Test Requirements

### Unit Tests

**`packages/domain-core/src/promocodes/__tests__/promocodes.validator.test.ts`**

Each of the 7 validation checks must have a dedicated test:

- Valid code passes all 7 checks
- Check 1 failure: code not found
- Check 2 failure: `is_active = false`
- Check 3a failure: `server_now < valid_from` → NOT_YET_VALID
- Check 3b failure: `server_now > valid_until` → EXPIRED
- Check 4 failure: `usage_limit` reached
- Check 5 failure: `per_user_limit` reached for this student
- Check 6 failure: `plan_id` not in `applies_to_plan_ids`
- Check 7a failure: division targeting — student not in `target_division_ids`
- Check 7b failure: group targeting — student not in `target_group_ids`
- Check 7c pass: no targeting configured (both null)
- Stacking check failure: non-stackable code with existing promo
- Stacking check pass: stackable code allowed

**`packages/domain-core/src/promocodes/__tests__/promocodes.calculator.test.ts`**

- PERCENTAGE: normal case, clamped to 100%, result rounded to 2 dp
- PERCENTAGE: would-be negative price clamped to 0
- FIXED: normal case
- FIXED: `value > plan_price` → `final_price = 0`
- FREE_TRIAL: returns `final_price = 0`, `free_trial_days` passed through
- Stacked discounts: two sequential calculations

**`packages/domain-core/src/promocodes/__tests__/promocodes.service.test.ts`**

- `createPromocode`: success, duplicate code rejection
- `deactivatePromocode`: success, idempotent deactivation
- `validatePromocode`: delegates to validator (integration of validator + repository)
- `applyPromocode`: records usage, returns DiscountResult
- `getAnalytics`: returns correctly shaped response

### Integration Tests

**`apps/api/src/routes/backoffice/promocodes/__tests__/`**

- `POST /backoffice/promocodes` — creates code, returns 201
- `POST /backoffice/promocodes` — duplicate code returns 409
- `POST /backoffice/promocodes` — invalid type/value combination returns 400
- `GET /backoffice/promocodes` — lists codes, supports filters
- `GET /backoffice/promocodes/:id` — returns full code + analytics
- `POST /backoffice/promocodes/:id/deactivate` — deactivates, subsequent apply returns 422
- `POST /backoffice/promocodes/validate` — returns 200 with DiscountResult on valid code
- `POST /backoffice/promocodes/validate` — returns 422 for each failure check (7 cases)
- `GET /backoffice/promocodes/analytics` — returns analytics summary

**Subscription Integration Tests (extend Stage 44 suite)**

- `POST /backoffice/subscriptions` with `promo_code` → usage recorded, `discount_amount` correct
- `POST /backoffice/subscriptions` with invalid `promo_code` → transaction rolled back, no subscription created
- Usage limit: second application after limit reached returns 422
- Per-user limit: same student second application returns 422
- Targeting enforcement: student not in division/group returns 422
- Stacking: two stackable codes applied, cumulative discount correct
- Stacking: non-stackable code rejected when another code already applied
- FREE_TRIAL: `expires_at = NOW() + free_trial_days`, `final_price = 0`
- Tenant isolation: code from one tenant's DB cannot be used in another tenant's DB

---

## Files to Create / Modify

### New Files

#### Migrations

- `apps/api/src/db/tenant/migrations/20260408_024_promocodes.ts`

#### Drizzle Schemas

- `apps/api/src/db/tenant/schemas/promocodes.schema.ts`
- `apps/api/src/db/tenant/schemas/promocode-usages.schema.ts`

#### Domain — Promocodes

- `packages/domain-core/src/promocodes/promocodes.types.ts`
- `packages/domain-core/src/promocodes/promocodes.errors.ts`
- `packages/domain-core/src/promocodes/promocodes.repository.ts`
- `packages/domain-core/src/promocodes/promocodes.validator.ts`
- `packages/domain-core/src/promocodes/promocodes.calculator.ts`
- `packages/domain-core/src/promocodes/promocodes.service.ts`
- `packages/domain-core/src/promocodes/index.ts`
- `packages/domain-core/src/promocodes/__tests__/promocodes.validator.test.ts`
- `packages/domain-core/src/promocodes/__tests__/promocodes.calculator.test.ts`
- `packages/domain-core/src/promocodes/__tests__/promocodes.service.test.ts`

#### Validation Schemas

- `packages/validation/src/schemas/promocodes.schemas.ts`

#### API Routes — Promocodes

- `apps/api/src/routes/backoffice/promocodes/helpers.ts`
- `apps/api/src/routes/backoffice/promocodes/list-promocodes.ts`
- `apps/api/src/routes/backoffice/promocodes/create-promocode.ts`
- `apps/api/src/routes/backoffice/promocodes/get-promocode.ts`
- `apps/api/src/routes/backoffice/promocodes/deactivate-promocode.ts`
- `apps/api/src/routes/backoffice/promocodes/validate-promocode.ts`
- `apps/api/src/routes/backoffice/promocodes/get-promocode-analytics.ts`
- `apps/api/src/routes/backoffice/promocodes/index.ts`

### Modified Files

#### Stage 44 Extension

- `apps/api/src/routes/backoffice/subscriptions/create-subscription.ts` — add optional `promo_code` field handling
- `apps/api/src/routes/backoffice/subscriptions/helpers.ts` — add promo resolution helpers
- `packages/validation/src/schemas/subscriptions.schemas.ts` — extend `createSubscriptionBodySchema` with `promo_code`

#### Domain Core Exports

- `packages/domain-core/src/index.ts` — export `promocodes` module

#### Drizzle Schema Registry

- `apps/api/src/db/tenant/schema.ts` (or equivalent barrel) — register new tables

---

## Integration Points Summary

| Upstream                           | Integration                                         | Contract                                                                                   |
| ---------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Stage 44 — `subscriptions`         | `create-subscription.ts` extended with `promo_code` | Promo validation + usage recording in same SERIALIZABLE transaction as subscription insert |
| Stage 44 — `plans`                 | Plan eligibility check via `applies_to_plan_ids`    | Plan `billing_type` checked for FREE_TRIAL constraint                                      |
| Stage 42 — `students`              | Targeting check via `division_id` and `group_id`    | Read-only; student record loaded at validation time                                        |
| Stage 22/24 — `divisions`/`groups` | Targeting check                                     | Division and group IDs validated against student record                                    |
| Gateway callback (stub)            | Re-validate promo on payment callback               | Server-recalculated discount; client value discarded                                       |

---

## Acceptance Criteria

Stage 45 is complete when:

1. A promocode can be created by a Backoffice admin via `POST /backoffice/promocodes`
2. All 7 validation checks are enforced and return correct structured error codes on failure
3. `usage_limit` enforcement is race-condition-safe (transaction-locked count)
4. `per_user_limit` enforcement is race-condition-safe (transaction-locked count)
5. Targeting by division and/or group is enforced correctly
6. PERCENTAGE, FIXED, and FREE_TRIAL discounts are calculated server-side with correct math
7. Stacking rules are enforced (non-stackable code rejected when another code already applied)
8. Every redemption is stored in `promocode_usages` within the same transaction as the subscription
9. Usage history is never deleted; expired codes remain queryable
10. Cross-workspace code isolation is verified by tests (tenant DB separation)
11. Analytics endpoint returns correct redemption counts and revenue impact
12. `bun run lint && bun run typecheck && bun run test` pass with no new failures

---

## Clarifications

### Session 2026-04-05

- Q: How are race conditions on `usage_limit` resolved — specifically, `SELECT COUNT(*) ... FOR UPDATE` is not valid PostgreSQL syntax; what is the correct locking mechanism? → A: The correct approach is a **two-step lock** inside the SERIALIZABLE transaction: (1) issue `SELECT id FROM promocodes WHERE id = $1 FOR UPDATE` to acquire a row-level exclusive lock on the `promocodes` record, then (2) issue a plain `SELECT COUNT(*) FROM promocode_usages WHERE promocode_id = $1` (no FOR UPDATE on the aggregate — it is unnecessary and invalid). The SERIALIZABLE isolation level combined with the row lock on `promocodes` serializes all concurrent applications of the same code. This replaces the ambiguous phrase "FOR UPDATE lock on the `promocode_usages` aggregate" in FR-10 and FR-11, which is now superseded by this two-step pattern. Both global `usage_limit` and `per_user_limit` checks follow the same pattern (lock `promocodes` row, then count). The same `SELECT ... FOR UPDATE` on `promocodes` covers both counts — it is acquired once per transaction.

- Q: What happens when a `FREE_TRIAL` code is applied to a non-recurring (one-time) plan — at which validation step is this rejected? → A: The `FREE_TRIAL`/`billing_type` check is **Check #8 (post-stacking)**, executed after the stacking check (Check #7) and before the calculator is invoked. This is NOT a sub-check of Check #6 (Plan Eligibility). If `type = 'FREE_TRIAL'` and the resolved plan's `billing_type != 'recurring'`, validation fails with `PROMOCODE_FREE_TRIAL_REQUIRES_RECURRING` (HTTP 422). Check #8 is a new row in the 9-check validation table: condition `type != 'FREE_TRIAL' OR plan.billing_type = 'recurring'`, error code `PROMOCODE_FREE_TRIAL_REQUIRES_RECURRING`. Check #6 (Plan Eligibility) covers only `applies_to_plan_ids` membership and uses only `PROMOCODE_PLAN_NOT_ELIGIBLE`. The two checks are distinct and sequential: #6 → #7 (stacking) → #8 (FREE_TRIAL/recurring constraint).

- Q: How is stacking order determined when multiple codes are applied, and what `redeemed_at` is used for a code being applied in the current transaction? → A: Stacking order is always **existing-codes-first, new-code-last**. Codes already recorded in `promocode_usages` for the subscription are ordered by `redeemed_at ASC`; the code being applied in the current transaction is treated as the final step and receives the current transaction timestamp as its `redeemed_at`. Discount chaining: each sequential code uses the `final_price` output of the previous code as its `plan_price` input. If two or more codes are submitted in a single subscription creation request (not supported in MVP — only one `promo_code` field exists), they would be ordered by their position in the request array. For MVP this is moot: at most one code is applied per subscription creation call; additional stacked codes (applied in subsequent calls to a subscription amendment flow) are not in scope for this stage.

- Q: Are partial stack failures atomic — if one stacked code fails validation inside the transaction, does the entire subscription roll back? → A: Yes. **All-or-nothing atomicity is mandatory.** The SERIALIZABLE transaction wraps the subscription INSERT and all `promocode_usages` INSERTs as a single unit. If any promocode fails re-validation inside the transaction (e.g., the usage limit was just reached by a concurrent request that committed first), the entire transaction is rolled back: no subscription is created and no usage record is inserted. The caller receives a structured error response for the first failing code. There is no partial commit of a subscription without its promo usages, nor a subscription creation with a stale (pre-lock) discount. This applies equally whether one or multiple (future stacking) codes are being applied.

- Q: Does deactivating a code affect already-applied subscriptions, and is the stored `discount_amount` retroactively altered? → A: No retroactive effect. Deactivation (`is_active = false`) affects **only future applications**; it does not alter any existing `promocode_usages` rows, and the `discount_amount` stored at redemption time is immutable. Subscriptions that were created under a now-deactivated code retain their original pricing. The subscription record's `final_price` is never recalculated after the subscription is created. Admin visibility: deactivated codes and their full usage history remain visible in the admin UI (GET `/backoffice/promocodes/:id` continues to return all analytics). `updated_at` on the `promocodes` row is refreshed on deactivation, but no cascade occurs to `promocode_usages` or `subscriptions`.

- Q: What is the complete response envelope for `POST /backoffice/promocodes/validate` when the code is valid? → A: The response follows the platform contract `{ success: true, data: <ValidatePromocodeResponse>, error: null }` where `ValidatePromocodeResponse` is:

  ```typescript
  interface ValidatePromocodeResponse {
    valid: true;
    promocode: {
      id: string;
      code: string;
      type: PromocodeType;
      value: number | null;
      free_trial_days: number | null;
    };
    discount: {
      discount_amount: number; // server-calculated
      final_price: number; // plan_price minus discount_amount
      free_trial_days?: number; // only present when type = 'FREE_TRIAL'
    };
  }
  ```

  On failure the response is `{ success: false, data: null, error: { code: "<PROMOCODE_*>", message: "..." } }` using the codes from the Error Codes table. The `ValidatePromocodeResponse` type is added to `promocodes.types.ts` and exported from the module index. The `discount` field is the `DiscountResult` shape (renamed to `discount` in the response for client clarity, not a structural change).

- Q: Are analytics data scoped strictly to the current workspace, and does a super-admin cross-workspace aggregation endpoint exist in this stage? → A: Analytics are **strictly workspace-scoped** in this stage. `GET /backoffice/promocodes/analytics` queries only the current tenant's database (resolved via the standard tenant slug pipeline). No cross-workspace aggregation endpoint is defined or planned for this stage. Super-admins accessing this endpoint receive only data from the workspace their session is scoped to — identical to any other admin. Cross-workspace analytics (e.g., platform-wide revenue impact or redemption aggregation) is an explicit non-goal for Stage 45 and must be deferred to a future Platform Intelligence stage. Any AI-generated code that queries multiple tenant DBs in a single analytics request is FORBIDDEN and violates ADR-0001.
