# Stage 45 – Promocodes: Implementation Plan

**Generated:** 2026-04-05  
**Branch:** `spec/045-promocodes`  
**Spec:** `specs/runtime/045-promocodes/spec.md`  
**Research:** `specs/runtime/045-promocodes/research.md`  
**Data Model:** `specs/runtime/045-promocodes/data-model.md`

---

## Technical Context

| Field                   | Value                                                               |
| ----------------------- | ------------------------------------------------------------------- |
| Stage number            | 45                                                                  |
| Phase                   | 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER                            |
| Migration number        | 024 (follows 023 from Stage 44)                                     |
| Migration file          | `apps/api/src/db/tenant/migrations/20260408_024_promocodes.ts`      |
| Isolation               | SERIALIZABLE for all writes involving `promocode_usages`            |
| Row lock                | `SELECT id FROM promocodes WHERE id = $id FOR UPDATE` via `sql` tag |
| Server time             | All date comparisons use DB `NOW()` — never `new Date()` from JS    |
| Package manager         | bun                                                                 |
| Extend Stage 44 handler | `activate-subscription.ts` (not a new file)                         |

---

## Constitution Check

| Rule                          | Status  | Notes                                                                            |
| ----------------------------- | ------- | -------------------------------------------------------------------------------- |
| No cross-tenant access        | ✅ PASS | All queries via `c.get('tenantDb')` — no global DB singleton                     |
| No middleware bypass          | ✅ PASS | All routes inherit backoffice group middleware chain                             |
| All writes transactional      | ✅ PASS | Usage recording + subscription insert in single SERIALIZABLE transaction (FR-09) |
| Server-authoritative time     | ✅ PASS | `sql\`NOW()\`` for all time comparisons (FR-06 checks)                           |
| No client-calculated discount | ✅ PASS | `calculateDiscount()` runs server-side only; client value discarded              |
| Code immutability             | ✅ PASS | Only `deactivatePromocode()` mutates a record; no PATCH endpoint                 |
| Usage history preserved       | ✅ PASS | No DELETE on `promocode_usages`; ON DELETE RESTRICT FKs                          |
| Import boundaries             | ✅ PASS | `apps/api` → `packages/domain-core` only; no `packages` → `apps`                 |
| Migration forward-only        | ✅ PASS | No `down()` implementation; `CREATE TABLE IF NOT EXISTS` for idempotency         |
| Race-condition safe limits    | ✅ PASS | FOR UPDATE lock before counting; SERIALIZABLE transaction                        |

---

## Architecture Decisions

### AD-01: `applyPromocode` participates in but does not own the transaction

The SERIALIZABLE transaction is opened in `activateSubscription` (Stage 44 service). `applyPromocode` receives `tx` and runs all validation+insert operations within it. This ensures atomicity between `subscriptions` insert and `promocode_usages` insert without requiring the promo service to know about subscriptions.

### AD-02: Pre-validation outside transaction

`validatePromocode()` is called BEFORE opening the transaction (fast-fail). Inside the transaction, `applyPromocode()` re-validates under a `FOR UPDATE` lock. This prevents most invalid requests from opening a serializable transaction, while the inner re-validation guarantees correctness under concurrency.

### AD-03: JSONB array fields — case-sensitivity

`applies_to_plan_ids`, `target_division_ids`, `target_group_ids` store UUIDs as strings. UUID comparison is case-insensitive in theory but all platform UUIDs are canonically lowercase. No case normalization needed.

### AD-04: `plan_billing_type` passed in context

The route handler loads the plan record to check `billing_type` for FREE_TRIAL codes. This is passed into `PromocodeValidationContext.plan_billing_type`. The domain package does not make DB calls outside its own `promocodes.*` tables.

---

## File Structure (29 total: 23 new + 6 modified)

### New Files (24)

```
apps/api/src/db/tenant/migrations/
  20260408_024_promocodes.ts                          ← Migration file

apps/api/src/db/tenant/schemas/
  promocodes.schema.ts                                ← Drizzle schema: promocodes
  promocode-usages.schema.ts                          ← Drizzle schema: promocode_usages

packages/domain-core/src/promocodes/
  promocodes.types.ts                                 ← All shared types
  promocodes.errors.ts                                ← Error factory + 13 error codes
  promocodes.repository.ts                            ← 9 DB query functions
  promocodes.validator.ts                             ← validatePromocodeApplication() — 7 checks
  promocodes.calculator.ts                            ← calculateDiscount() — pure
  promocodes.service.ts                               ← PromocodeService orchestration
  index.ts                                            ← Public barrel export

  __tests__/
    promocodes.validator.test.ts                      ← 13 test cases
    promocodes.calculator.test.ts                     ← 6 test cases
    promocodes.service.test.ts                        ← 5 test cases

packages/validation/src/schemas/
  promocodes.schemas.ts                               ← 4 Zod schemas

apps/api/src/routes/backoffice/promocodes/
  helpers.ts                                          ← getDb(), buildResponsePromocode(), buildAuditCtx()
  list-promocodes.ts                                  ← GET /promocodes handler
  create-promocode.ts                                 ← POST /promocodes handler
  get-promocode.ts                                    ← GET /promocodes/:id handler
  deactivate-promocode.ts                             ← POST /promocodes/:id/deactivate handler
  validate-promocode.ts                               ← POST /promocodes/validate handler
  get-promocode-analytics.ts                          ← GET /promocodes/analytics handler
  index.ts                                            ← Router barrel

  __tests__/
    promocodes.routes.test.ts                         ← Integration tests: all 8 endpoints
```

### Modified Files (5)

```
apps/api/src/routes/backoffice/subscriptions/
  activate-subscription.ts                            ← Add optional promo_code handling
  helpers.ts                                          ← Add promo resolution helper

packages/validation/src/schemas/
  subscriptions.schemas.ts                            ← Extend createSubscriptionBodySchema

packages/domain-core/src/
  index.ts                                            ← Export promocodes module

apps/api/src/db/tenant/schemas/
  index.ts                                            ← Register promocodes + promocode_usages tables
```

---

## Migration Plan

**File:** `apps/api/src/db/tenant/migrations/20260408_024_promocodes.ts`

### Steps

1. `BEGIN`
2. `CREATE TABLE IF NOT EXISTS promocodes (...)` — 20 columns, 8 CHECK constraints
3. `CREATE UNIQUE INDEX IF NOT EXISTS idx_promocodes_code_lower ON promocodes (LOWER(code))`
4. `CREATE INDEX IF NOT EXISTS idx_promocodes_active ON promocodes (is_active, valid_from, valid_until) WHERE is_active = TRUE`
5. `CREATE TABLE IF NOT EXISTS promocode_usages (...)` — 6 columns, 1 CHECK constraint
6. `CREATE UNIQUE INDEX IF NOT EXISTS idx_promocode_usages_subscription ON promocode_usages (promocode_id, subscription_id)`
7. `CREATE INDEX IF NOT EXISTS idx_promocode_usages_promocode ON promocode_usages (promocode_id)`
8. `CREATE INDEX IF NOT EXISTS idx_promocode_usages_student_promocode ON promocode_usages (student_id, promocode_id)`
9. `UPDATE schema_versions SET version = 24, updated_at = NOW() WHERE id = 1`
10. `COMMIT`
11. On error: `ROLLBACK`; re-throw

### Lock Risk Assessment

- `CREATE TABLE IF NOT EXISTS` acquires `AccessExclusiveLock` on the new table — no existing rows, no contention
- `CREATE INDEX IF NOT EXISTS` acquires `ShareLock` — concurrent reads unblocked except during index creation
- `UPDATE schema_versions` acquires `RowExclusiveLock` on one row — minimal contention
- **Risk Level: LOW** — new tables, no modifications to existing tables

---

## Domain Package Structure

### `promocodes.types.ts`

Full set of types from spec, plus enriched `PromocodeValidationContext` (from research R-06):

```typescript
export type PromocodeType = "PERCENTAGE" | "FIXED" | "FREE_TRIAL";

export interface PromocodeRow {
  /* 20 fields as spec */
}
export interface PromocodeInput {
  /* creation input fields */
}

export interface PromocodeValidationContext {
  code: string;
  student_id: string;
  plan_id: string;
  plan_billing_type: string; // loaded by route handler
  student_division_id: string | null; // loaded by route handler
  student_group_id: string | null; // loaded by route handler
  existing_promo_ids_on_subscription: string[];
  server_now: Date; // from DB NOW()
}

export interface DiscountResult {
  discount_amount: number;
  final_price: number;
  free_trial_days?: number;
}

export interface PromocodeUsageRow {
  /* 6 fields */
}

export type ValidatorResult =
  | { valid: true; promocode: PromocodeRow }
  | { valid: false; code: PromocodeErrorCode; message: string };

export interface ListPromocodesFilter {
  is_active?: boolean;
  type?: PromocodeType;
  status?: "ACTIVE_NOW" | "EXPIRED" | "NOT_YET_VALID" | "INACTIVE";
  page?: number;
  limit?: number;
}

export interface PromocodeAnalytics {
  /* as spec FR-14 */
}
export interface SinglePromocodeAnalytics {
  /* as spec FR-14 */
}
export interface AnalyticsFilter {
  /* date range, optional */
}
```

### `promocodes.errors.ts`

```typescript
export type PromocodeErrorCode =
  | "PROMOCODE_NOT_FOUND"
  | "PROMOCODE_INACTIVE"
  | "PROMOCODE_EXPIRED"
  | "PROMOCODE_NOT_YET_VALID"
  | "PROMOCODE_USAGE_LIMIT_REACHED"
  | "PROMOCODE_PER_USER_LIMIT_REACHED"
  | "PROMOCODE_PLAN_NOT_ELIGIBLE"
  | "PROMOCODE_STUDENT_NOT_IN_TARGET"
  | "PROMOCODE_STACKING_NOT_ALLOWED"
  | "PROMOCODE_FREE_TRIAL_REQUIRES_RECURRING"
  | "PROMOCODE_DISCOUNT_EXCEEDS_PLAN"
  | "PROMOCODE_CODE_ALREADY_EXISTS"
  | "PROMOCODE_IMMUTABLE_FIELDS";

export const PROMOCODE_ERROR_HTTP: Record<PromocodeErrorCode, number> = {
  PROMOCODE_NOT_FOUND: 404,
  PROMOCODE_INACTIVE: 422,
  PROMOCODE_EXPIRED: 422,
  PROMOCODE_NOT_YET_VALID: 422,
  PROMOCODE_USAGE_LIMIT_REACHED: 422,
  PROMOCODE_PER_USER_LIMIT_REACHED: 422,
  PROMOCODE_PLAN_NOT_ELIGIBLE: 422,
  PROMOCODE_STUDENT_NOT_IN_TARGET: 422,
  PROMOCODE_STACKING_NOT_ALLOWED: 422,
  PROMOCODE_FREE_TRIAL_REQUIRES_RECURRING: 422,
  PROMOCODE_DISCOUNT_EXCEEDS_PLAN: 422,
  PROMOCODE_CODE_ALREADY_EXISTS: 409,
  PROMOCODE_IMMUTABLE_FIELDS: 422,
};

export class PromocodeError extends Error {
  readonly code: PromocodeErrorCode;
  readonly httpStatus: number;

  constructor(code: PromocodeErrorCode, message?: string) {
    super(message ?? code);
    this.name = "PromocodeError";
    this.code = code;
    this.httpStatus = PROMOCODE_ERROR_HTTP[code];
  }
}
```

### `promocodes.repository.ts`

Nine exported functions — pure data access, no business logic:

```typescript
// Read
listPromocodes(db, filter: ListPromocodesFilter): Promise<PromocodeRow[]>
getPromocodeById(db, id: string): Promise<PromocodeRow | null>
getPromocodeByCode(db, code: string): Promise<PromocodeRow | null>

// Write
createPromocode(db, input: PromocodeInput): Promise<PromocodeRow>
deactivatePromocode(db, id: string): Promise<PromocodeRow>

// Usage counts (called inside transaction)
countTotalUsages(tx, promocodeId: string): Promise<number>
countUserUsages(tx, promocodeId: string, studentId: string): Promise<number>

// Locking
lockPromocodeForUpdate(tx, promocodeId: string): Promise<PromocodeRow | null>
// → await tx.query('SELECT id, is_active, usage_limit, per_user_limit, type, is_stackable FROM promocodes WHERE id = $1 FOR UPDATE', [promocodeId])
// Must be called inside an open SERIALIZABLE transaction

// Usage insert (inside transaction)
insertUsage(tx, input: NewPromocodeUsage): Promise<PromocodeUsageRow>

// Analytics
getAnalyticsSummary(db): Promise<PromocodeAnalytics>
getUsagesBySubscription(db, subscriptionId: string): Promise<PromocodeUsageRow[]>
```

Pattern: each function receives `db` or `tx` as first parameter — tenant-scoped, never resolved internally.

### `promocodes.validator.ts`

```typescript
export function validatePromocodeApplication(
  promocode: PromocodeRow | null,
  context: PromocodeValidationContext,
  totalUsageCount: number,
  userUsageCount: number,
): ValidatorResult;
```

**Seven sequential checks (fail-fast):**

1. `promocode !== null` → `PROMOCODE_NOT_FOUND`
2. `promocode.is_active === true` → `PROMOCODE_INACTIVE`
3. Validity window:
   - `context.server_now < promocode.valid_from` → `PROMOCODE_NOT_YET_VALID`
   - `context.server_now > promocode.valid_until` → `PROMOCODE_EXPIRED`
4. `promocode.usage_limit === null || totalUsageCount < promocode.usage_limit` → `PROMOCODE_USAGE_LIMIT_REACHED`
5. `userUsageCount < promocode.per_user_limit` → `PROMOCODE_PER_USER_LIMIT_REACHED`
6. Plan eligibility: `promocode.applies_to_plan_ids.length === 0 || promocode.applies_to_plan_ids.includes(context.plan_id)` → `PROMOCODE_PLAN_NOT_ELIGIBLE`
7. Student targeting:
   - If `target_division_ids === null && target_group_ids === null` → pass (no targeting)
   - Else: `(target_division_ids !== null && student_division_id ∈ target_division_ids) || (target_group_ids !== null && student_group_id ∈ target_group_ids)` → `PROMOCODE_STUDENT_NOT_IN_TARGET`

**Stacking check (after check 7, conditional):**

- If `!promocode.is_stackable && context.existing_promo_ids_on_subscription.length > 0` → `PROMOCODE_STACKING_NOT_ALLOWED`

**FREE_TRIAL billing type check (check 8 — added for billing_type):**

- If `promocode.type === 'FREE_TRIAL' && context.plan_billing_type !== 'recurring'` → `PROMOCODE_FREE_TRIAL_REQUIRES_RECURRING`

Pure function — no DB calls, no side effects, no async.

### `promocodes.calculator.ts`

```typescript
export function calculateDiscount(
  type: PromocodeType,
  value: number | null,
  free_trial_days: number | null,
  plan_price: number,
): DiscountResult;
```

**Logic:**

```
PERCENTAGE:
  raw = plan_price × value / 100
  discount_amount = Math.floor(raw * 100) / 100   // round down to 2 dp
  final_price = Math.max(0, plan_price - discount_amount)

FIXED:
  final_price = Math.max(0, plan_price - value!)
  discount_amount = plan_price - final_price

FREE_TRIAL:
  discount_amount = plan_price
  final_price = 0
  free_trial_days = free_trial_days!
```

Pure function — no network, no DB, no side effects.

### `promocodes.service.ts`

```typescript
class PromocodeService {
  // Admin CRUD
  async createPromocode(db, input: PromocodeInput): Promise<PromocodeRow>;
  async listPromocodes(db, filter: ListPromocodesFilter): Promise<PromocodeRow[]>;
  async getPromocode(db, id: string): Promise<PromocodeRow>; // throws PROMOCODE_NOT_FOUND
  async deactivatePromocode(db, id: string): Promise<PromocodeRow>;

  // Validation (outside transaction — fast-fail pre-check)
  async validatePromocode(
    db,
    context: PromocodeValidationContext,
  ): Promise<{ promocode: PromocodeRow; discountPreview: DiscountResult }>;
  // Loads promocode, gets DB NOW(), counts usages, runs validatePromocodeApplication(),
  // runs calculateDiscount(), returns preview

  // Application (inside transaction — called from subscriptions service)
  async applyPromocode(
    tx,
    context: PromocodeValidationContext,
    subscriptionId: string,
    planPrice: number,
  ): Promise<DiscountResult>;
  // 1. const locked = await lockPromocodeForUpdate(tx, context.promocodeId)
  //    → if (!locked) throw new PromocodeError('PROMOCODE_NOT_FOUND', ...)
  // 2. Re-fetch usage counts inside tx
  // 3. Re-run validatePromocodeApplication(locked, context, totalCount, userCount) — throws on failure
  // 4. calculateDiscount()
  // 5. insertUsage(tx, ...)
  // 6. Return DiscountResult

  // Analytics
  async getAnalytics(db): Promise<PromocodeAnalytics>;
}

export const promocodeService = new PromocodeService();
```

### `index.ts`

```typescript
export { promocodeService, PromocodeService } from "./promocodes.service";
export { PromocodeError, PROMOCODE_ERROR_HTTP } from "./promocodes.errors";
export type { PromocodeErrorCode } from "./promocodes.errors";
export type {
  PromocodeRow,
  PromocodeInput,
  PromocodeType,
  PromocodeValidationContext,
  DiscountResult,
  ValidatorResult,
  PromocodeAnalytics,
  SinglePromocodeAnalytics,
  PromocodeUsageRow,
  AnalyticsFilter,
} from "./promocodes.types";
```

---

## Validation Schemas (`packages/validation/src/schemas/promocodes.schemas.ts`)

### `createPromocodeBodySchema`

Conditional Zod validation with `.superRefine()`:

```typescript
const base = z.object({
  code: z.string().min(1).max(100),
  type: z.enum(['PERCENTAGE', 'FIXED', 'FREE_TRIAL']),
  value: z.number().positive().optional(),
  free_trial_days: z.number().int().positive().optional(),
  valid_from: z.string().datetime(),
  valid_until: z.string().datetime(),
  usage_limit: z.number().int().positive().optional(),
  per_user_limit: z.number().int().min(1).optional().default(1),
  applies_to_plan_ids: z.array(z.string().uuid()).optional().default([]),
  target_division_ids: z.array(z.string().uuid()).optional(),
  target_group_ids: z.array(z.string().uuid()).optional(),
  is_stackable: z.boolean().optional().default(false),
})

export const createPromocodeBodySchema = base.superRefine((data, ctx) => {
  if (data.type === 'PERCENTAGE') {
    if (data.value === undefined) ctx.addIssue(...)
    if (data.value !== undefined && data.value > 100) ctx.addIssue(...)
    if (data.free_trial_days !== undefined) ctx.addIssue(...)
  }
  if (data.type === 'FIXED') {
    if (data.value === undefined) ctx.addIssue(...)
    if (data.free_trial_days !== undefined) ctx.addIssue(...)
  }
  if (data.type === 'FREE_TRIAL') {
    if (data.free_trial_days === undefined) ctx.addIssue(...)
    if (data.value !== undefined) ctx.addIssue(...)
  }
  if (/* valid_until <= valid_from */ ...) ctx.addIssue(...)
})
```

### Other schemas

```typescript
export const promocodeIdParamsSchema = z.object({ id: z.string().uuid() });

export const validatePromocodeBodySchema = z.object({
  code: z.string().min(1).max(100),
  student_id: z.string().uuid(),
  plan_id: z.string().uuid(),
});

export const listPromocodesQuerySchema = z.object({
  is_active: z.coerce.boolean().optional(),
  type: z.enum(["PERCENTAGE", "FIXED", "FREE_TRIAL"]).optional(),
  status: z.enum(["ACTIVE_NOW", "EXPIRED", "NOT_YET_VALID", "INACTIVE"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
```

### Modified: `subscriptions.schemas.ts`

Extend `createSubscriptionBodySchema` to add:

```typescript
promo_code: z.string().min(1).max(100).optional(),
```

---

## API Endpoints

### Route Registration

**File:** `apps/api/src/routes/backoffice/promocodes/index.ts`

```typescript
const router = new Hono();

// Static routes MUST be registered before parameterised routes to prevent path conflicts.
// /analytics and /validate registered first to prevent /:id capturing them.
const validateRateLimiter = createRateLimiter();
const VALIDATE_PROMO_RATE_LIMIT_MAX = 10;
const VALIDATE_PROMO_RATE_LIMIT_WINDOW_SEC = 60;

router.get("/analytics", handleGetPromocodeAnalytics);
router.post(
  "/validate",
  async (c, next) => {
    const tenantId = c.get("tenantId") as string;
    const key = `validate-promo:${tenantId}`;
    const isLimited = await validateRateLimiter.isLimited(
      key,
      VALIDATE_PROMO_RATE_LIMIT_MAX,
      VALIDATE_PROMO_RATE_LIMIT_WINDOW_SEC,
    );
    if (isLimited) {
      c.header("Retry-After", String(VALIDATE_PROMO_RATE_LIMIT_WINDOW_SEC));
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many validate requests. Retry after 60 seconds.",
          },
        },
        429,
      );
    }
    await next();
  },
  handleValidatePromocode,
);
router.get("/", handleListPromocodes);
router.post("/", handleCreatePromocode);
router.get("/:id", handleGetPromocode);
router.post("/:id/deactivate", handleDeactivatePromocode);
```

> **Order matters (ENFORCED):** `/analytics` and `/validate` are registered BEFORE `/:id` to prevent Hono routing the validate path to the parameterised handler. `/validate` is registered second, immediately after `/analytics`.

> **Rate limiting on POST /validate:** Uses `createRateLimiter()` from `apps/api/src/middleware/rate-limit.middleware`, keyed by `tenantId` from context (`validate-promo:{tenantId}`). Applies a 10-requests-per-minute per-workspace limit to prevent brute-force code enumeration. Pattern follows `apps/api/src/routes/backoffice/workflow/index.ts`.

> **POST /promocodes idempotency decision (AD-07):** Admin CRUD create is NOT given transparent idempotency via Idempotency-Key header. Rationale: AGENTS.md mandates idempotency for payment, exam submission, certificates, and webhooks — not admin resource creation. A duplicate POST returns 409 PROMOCODE_CODE_ALREADY_EXISTS. This is the documented and accepted behavior. If retry-transparent semantics are needed in the future, a separate ADR is required.

### Endpoint Details

#### GET `/backoffice/promocodes` — List Promocodes

- Parse `listPromocodesQuerySchema` from query params
- Apply filters: `is_active`, `type`, `status` (server-side time comparison using `sql\`NOW()\``)
- Paginate with `page` + `limit`
- Response: `{ success: true, data: { promocodes: PromocodeRow[], total, page, limit } }`

#### POST `/backoffice/promocodes` — Create Promocode

- Parse `createPromocodeBodySchema` from body
- Normalize `code` to uppercase before insert (decision: uppercase canonical form)
- On PG unique constraint violation on `idx_promocodes_code_lower` → return `PROMOCODE_CODE_ALREADY_EXISTS` 409
- Response: `{ success: true, data: { promocode: PromocodeRow } }` 201

#### GET `/backoffice/promocodes/:id` — Get Promocode

- Parse `promocodeIdParamsSchema`
- Load promocode + `SinglePromocodeAnalytics` (usage counts query)
- Response: `{ success: true, data: { promocode: PromocodeRow, analytics: SinglePromocodeAnalytics } }`

#### POST `/backoffice/promocodes/:id/deactivate` — Deactivate Promocode

- Parse `:id` as UUID
- Call `promocodeService.deactivatePromocode(db, id)` — sets `is_active = false`, refreshes `updated_at`
- Idempotent: already-inactive promocode returns 200 with current state (no error)
- Response: `{ success: true, data: { promocode: PromocodeRow } }`

#### POST `/backoffice/promocodes/validate` — Validate (Preview)

- Parse `validatePromocodeBodySchema`
- Load plan record (`billing_type`) and student record (`division_id`, `group_id`)
- Load DB `server_now` via `SELECT NOW() AS now`
- Call `promocodeService.validatePromocode(db, context)` — throws `PromocodeError` on failure
- **Does NOT insert any DB record**
- Response: `{ success: true, data: { valid: true, discount: DiscountResult } }`
- Error: `{ success: false, data: null, error: { code, message } }` with appropriate HTTP status

#### GET `/backoffice/promocodes/analytics` — Analytics

- No params required
- Call `promocodeService.getAnalytics(db)`
- Response: `{ success: true, data: { analytics: PromocodeAnalytics } }`

#### POST `/backoffice/subscriptions` (MODIFIED — Stage 44) — With Promo

- `activate-subscription.ts` reads optional `promo_code` from body
- If present:
  1. Load plan, student (for division/group)
  2. Load `server_now` from DB
  3. Load existing promo usage IDs for this student's potential subscription
  4. Build `PromocodeValidationContext`
  5. Call `promocodeService.validatePromocode(db, context)` — fast-fail outside transaction
  6. Pass `promoCode` and pre-validated `PromocodeRow` into `activateSubscription()`
  7. Inside SERIALIZABLE transaction: call `promocodeService.applyPromocode(tx, context, subscriptionId, planPrice)`
  8. Use `DiscountResult.final_price` for `price_paid`; if FREE_TRIAL, add `free_trial_days` to `expires_at`

---

## Transaction Boundaries

### Transaction 1: `activateSubscription` (SERIALIZABLE)

Owned by: `subscriptions.service.ts`

```
BEGIN SERIALIZABLE
  [Stage 44] SELECT existing ACTIVE subscription FOR UPDATE
  [Stage 44] UPDATE subscriptions SET status='EXPIRED' (if exists)
  [Stage 44] INSERT INTO subscriptions (...) RETURNING id
  [Stage 45] SELECT id FROM promocodes WHERE id = $id FOR UPDATE  ← lock
  [Stage 45] SELECT COUNT(*) FROM promocode_usages WHERE promocode_id = $id
  [Stage 45] SELECT COUNT(*) FROM promocode_usages WHERE promocode_id = $id AND student_id = $sid
  [Stage 45] re-run validatePromocodeApplication()
  [Stage 45] calculateDiscount()
  [Stage 45] INSERT INTO promocode_usages (...) RETURNING id
  [Stage 44] UPDATE students SET subscription_status = ... (if applicable)
COMMIT
```

On any failure → ROLLBACK → 0 subscriptions created, 0 usages recorded.

### Transaction 2: `createPromocode` (READ COMMITTED)

```
BEGIN
  INSERT INTO promocodes (...) RETURNING *
COMMIT
```

Standard insert, no concurrent writes to this row yet. READ COMMITTED sufficient.

### Transaction 3: `deactivatePromocode` (READ COMMITTED)

```
BEGIN
  UPDATE promocodes SET is_active = false, updated_at = NOW() WHERE id = $id RETURNING *
COMMIT
```

---

## Error Code Implementation Strategy

All errors map to `{ success: false, data: null, error: { code: string, message: string } }`.

Pattern in route handlers:

```typescript
try {
  const result = await promocodeService.doSomething(db, ...)
  return c.json({ success: true, data: result }, 200)
} catch (err) {
  if (err instanceof PromocodeError) {
    return c.json(
      { success: false, data: null, error: { code: err.code, message: err.message } },
      err.httpStatus
    )
  }
  // Re-throw unknown errors for global error handler
  throw err
}
```

### Database constraint violations

Unique violation on `idx_promocodes_code_lower`:

- PostgreSQL error code `23505` (unique_violation)
- In `createPromocode`: catch PG error, rethrow as `PromocodeError('PROMOCODE_CODE_ALREADY_EXISTS', ...)`

---

## Test File Structure

### Unit Tests

#### `packages/domain-core/src/promocodes/__tests__/promocodes.validator.test.ts`

13 test cases:

| #   | Test                                           | Expected                           |
| --- | ---------------------------------------------- | ---------------------------------- |
| 1   | Valid code passes all 7 checks                 | `{ valid: true }`                  |
| 2   | Check 1: `promocode = null`                    | `PROMOCODE_NOT_FOUND`              |
| 3   | Check 2: `is_active = false`                   | `PROMOCODE_INACTIVE`               |
| 4   | Check 3a: `server_now < valid_from`            | `PROMOCODE_NOT_YET_VALID`          |
| 5   | Check 3b: `server_now > valid_until`           | `PROMOCODE_EXPIRED`                |
| 6   | Check 4: `totalUsageCount >= usage_limit`      | `PROMOCODE_USAGE_LIMIT_REACHED`    |
| 7   | Check 5: `userUsageCount >= per_user_limit`    | `PROMOCODE_PER_USER_LIMIT_REACHED` |
| 8   | Check 6: plan not in `applies_to_plan_ids`     | `PROMOCODE_PLAN_NOT_ELIGIBLE`      |
| 9   | Check 7a: student not in `target_division_ids` | `PROMOCODE_STUDENT_NOT_IN_TARGET`  |
| 10  | Check 7b: student not in `target_group_ids`    | `PROMOCODE_STUDENT_NOT_IN_TARGET`  |
| 11  | Check 7c: no targeting → pass                  | `{ valid: true }`                  |
| 12  | Stacking: non-stackable + existing promo       | `PROMOCODE_STACKING_NOT_ALLOWED`   |
| 13  | Stacking: stackable → allowed                  | `{ valid: true }`                  |

#### `packages/domain-core/src/promocodes/__tests__/promocodes.calculator.test.ts`

6 test cases:

| #   | Type                           | Input                     | Expected                                  |
| --- | ------------------------------ | ------------------------- | ----------------------------------------- |
| 1   | PERCENTAGE (10%)               | plan_price=100            | discount=10, final=90                     |
| 2   | PERCENTAGE (150% clamped)      | plan_price=100, value=100 | discount=100, final=0                     |
| 3   | FIXED (30) on 100              | plan_price=100, value=30  | discount=30, final=70                     |
| 4   | FIXED (200) > plan_price       | plan_price=100, value=200 | discount=100, final=0                     |
| 5   | FREE_TRIAL                     | plan_price=100, days=30   | discount=100, final=0, free_trial_days=30 |
| 6   | Stacked: PERCENTAGE then FIXED | sequential calls          | cumulative correct                        |

#### `packages/domain-core/src/promocodes/__tests__/promocodes.service.test.ts`

5 test cases (mocking repository):

| #   | Method                | What is tested                                   |
| --- | --------------------- | ------------------------------------------------ |
| 1   | `createPromocode`     | Success — returns PromocodeRow                   |
| 2   | `createPromocode`     | Duplicate code → `PROMOCODE_CODE_ALREADY_EXISTS` |
| 3   | `deactivatePromocode` | Sets `is_active=false`, idempotent               |
| 4   | `validatePromocode`   | Integrates validator + repository mock           |
| 5   | `getAnalytics`        | Returns correctly shaped response                |

### Integration Tests

#### `apps/api/src/routes/backoffice/promocodes/__tests__/promocodes.routes.test.ts`

Coverage:

**`POST /backoffice/promocodes`**

- Creates code → 201
- Duplicate code → 409 with `PROMOCODE_CODE_ALREADY_EXISTS`
- Invalid type/value combo (PERCENTAGE without value) → 422

**`GET /backoffice/promocodes`**

- Lists codes with no filter
- Filters by `is_active=true`
- Filters by `type=PERCENTAGE`
- Filters by `status=EXPIRED` (server-side time comparison)
- Pagination: `page=2&limit=5`

**`GET /backoffice/promocodes/:id`**

- Returns code + `SinglePromocodeAnalytics`
- Non-existent ID → 404

**`POST /backoffice/promocodes/:id/deactivate`**

- Deactivates → 200
- Already inactive → 200 (idempotent)

**`POST /backoffice/promocodes/validate`**

- Returns `DiscountResult` on valid code
- Returns 422 for each of 7 failure check conditions (7 sub-cases)

**`GET /backoffice/promocodes/analytics`**

- Returns `PromocodeAnalytics` summary

**Subscription integration (extend Stage 44 test suite):**

- `POST /subscriptions` with `promo_code` → usage recorded, `discount_amount` correct
- Invalid `promo_code` → transaction rolled back, no subscription created
- Usage limit: second application after limit → 422
- Per-user limit: same student second application → 422
- Targeting: student not in division/group → 422
- Stacking: two stackable codes applied → cumulative discount correct
- Stacking: non-stackable code rejected when another applied
- FREE_TRIAL: `expires_at = NOW() + interval '30 days'`, `price_paid = 0`
- Tenant isolation: code from one tenant DB not visible in another tenant DB

---

## Implementation Order (dependency-safe sequence)

```
Step 1: Migration file
  → apps/api/src/db/tenant/migrations/20260408_024_promocodes.ts

Step 2: Drizzle schemas
  → apps/api/src/db/tenant/schemas/promocodes.schema.ts
  → apps/api/src/db/tenant/schemas/promocode-usages.schema.ts
  → [modify] apps/api/src/db/tenant/schemas/index.ts

Step 3: Domain types + errors
  → packages/domain-core/src/promocodes/promocodes.types.ts
  → packages/domain-core/src/promocodes/promocodes.errors.ts

Step 4: Domain repository
  → packages/domain-core/src/promocodes/promocodes.repository.ts

Step 5: Domain pure functions
  → packages/domain-core/src/promocodes/promocodes.calculator.ts
  → packages/domain-core/src/promocodes/promocodes.validator.ts

Step 6: Domain service
  → packages/domain-core/src/promocodes/promocodes.service.ts

Step 7: Domain barrel + package export
  → packages/domain-core/src/promocodes/index.ts
  → [modify] packages/domain-core/src/index.ts

Step 8: Validation schemas
  → packages/validation/src/schemas/promocodes.schemas.ts
  → [modify] packages/validation/src/schemas/subscriptions.schemas.ts

Step 9: API route handlers
  → apps/api/src/routes/backoffice/promocodes/helpers.ts
  → apps/api/src/routes/backoffice/promocodes/list-promocodes.ts
  → apps/api/src/routes/backoffice/promocodes/create-promocode.ts
  → apps/api/src/routes/backoffice/promocodes/get-promocode.ts
  → apps/api/src/routes/backoffice/promocodes/deactivate-promocode.ts
  → apps/api/src/routes/backoffice/promocodes/validate-promocode.ts
  → apps/api/src/routes/backoffice/promocodes/get-promocode-analytics.ts
  → apps/api/src/routes/backoffice/promocodes/index.ts

Step 10: Stage 44 extension
  → [modify] apps/api/src/routes/backoffice/subscriptions/activate-subscription.ts
  → [modify] apps/api/src/routes/backoffice/subscriptions/helpers.ts

Step 11: Unit tests
  → packages/domain-core/src/promocodes/__tests__/promocodes.calculator.test.ts
  → packages/domain-core/src/promocodes/__tests__/promocodes.validator.test.ts
  → packages/domain-core/src/promocodes/__tests__/promocodes.service.test.ts

Step 12: Integration tests
  → apps/api/src/routes/backoffice/promocodes/__tests__/promocodes.routes.test.ts
```

---

## Non-Negotiables (implementation guard)

These must be verified by the implementing engineer and CI:

- [ ] No `new Date()` inside any time comparison — only `sql\`NOW()\`` results
- [ ] No discount calculation on the client — `calculateDiscount()` called server-side only
- [ ] `applyPromocode()` always called inside the subscription SERIALIZABLE transaction
- [ ] `lockPromocodeForUpdate()` called before any usage count in the same transaction
- [ ] `promocode_usages` rows never deleted (no DELETE statements)
- [ ] `code`, `type`, `value`, `free_trial_days` are immutable (no UPDATE on these columns)
- [ ] All error responses follow `{ success: false, data: null, error: { code, message } }`
- [ ] `bun run lint && bun run typecheck && bun run test` pass

---

## Acceptance Gate

Stage 45 is DONE when:

1. All 23 new files exist and compile without error
2. 6 modified files pass typecheck
3. Unit tests: all 24 test cases green
4. Integration tests: all endpoints tested including subscription integration
5. Tenant isolation test passes (cross-tenant lookup returns 404)
6. Migration can be applied to a fresh tenant DB without error
7. `bun run lint && bun run typecheck && bun run test` exit 0
