# Stage 45 – Promocodes: Research Notes

**Generated:** 2026-04-05  
**Branch:** `spec/045-promocodes`  
**Status:** All unknowns resolved — READY FOR PLAN

---

## R-01 — Migration Numbering

**Unknown:** What migration number immediately precedes 024?

**Resolution:**

```
apps/api/src/db/tenant/migrations/20260406_022_student_management.ts
apps/api/src/db/tenant/migrations/20260407_023_plans_and_subscriptions.ts
```

Stage 44 used number `023`. Stage 45 must use `024`.

**Decision:** Migration file is `apps/api/src/db/tenant/migrations/20260408_024_promocodes.ts`

**File name format:** `YYYYMMDD_NNN_<descriptive_name>.ts` — confirmed from existing files.

---

## R-02 — Stage 44 Subscription Integration Point

**Unknown:** Which file is the "create-subscription" handler in Stage 44?

**Resolution:** Stage 44 uses `activate-subscription.ts` (not `create-subscription.ts`):

```
apps/api/src/routes/backoffice/subscriptions/activate-subscription.ts
  → handleActivateSubscription(c: Context)
  → imports activateSubscription from @zidney/domain-core/subscriptions
  → imports createSubscriptionBodySchema from @zidney/validation
```

The subscriptions domain service uses `db.transaction(async (tx) => {...})` pattern with a SERIALIZABLE transaction:

```typescript
// From subscriptions.service.ts
await db.transaction(
  async (tx) => {
    // expire old subscription if exists
    // insert new subscription
    // sync student status
  },
  { isolationLevel: "serializable" },
);
```

**Decision for Stage 45:**

- Modify `activate-subscription.ts` (not a new `create-subscription.ts`)
- Extend `createSubscriptionBodySchema` in `@zidney/validation` with `promo_code?: string`
- `applyPromocode` receives the transaction `tx` from within `activateSubscription` — the promo service participates in the transaction but does NOT own it
- `activateSubscription` in `subscriptions.service.ts` receives an optional `promoCode?: string` parameter

Integration call chain:

```
handleActivateSubscription
  → parse promo_code from body (optional)
  → if promo_code: pre-validate via PromocodeService.validatePromocode() (outside tx, fast-fail)
  → activateSubscription(db, input, promoCode)
    → db.transaction(SERIALIZABLE, async (tx) => {
        → [Stage 44 logic: expire old, insert subscription]
        → if promoCode: PromocodeService.applyPromocode(tx, context, subscriptionId, planPrice)
          → re-validates under lock (FOR UPDATE)
          → calculates discount
          → inserts promocode_usages
          → returns DiscountResult
        → final_price used for subscription.price_paid
      })
```

---

## R-03 — Drizzle FOR UPDATE Pattern

**Unknown:** How does this codebase perform row-level locks with Drizzle ORM?

**Resolution:** Drizzle does not have a built-in `.forUpdate()` chain method (as of v0.30). The project uses the `sql` template tag for raw SQL inside transactions:

```typescript
import { sql } from "drizzle-orm";

// Inside a transaction (tx):
await tx.execute(sql`SELECT id FROM promocodes WHERE id = ${promocodeId} FOR UPDATE`);
```

This is consistent with the codebase rule from `drizzle-orm-patterns` skill:

> "No raw SQL unless absolutely necessary (use `sql` template tag when required)"

FOR UPDATE is a legitimate exception — no Drizzle chain equivalent exists.

**Decision:**

- Use `tx.execute(sql\`SELECT id FROM promocodes WHERE id = ${id} FOR UPDATE\`)` before counting usages
- The lock is taken on the promocode row to serialize concurrent redemption attempts
- Function: `lockPromocodeForUpdate(tx, promocodeId): Promise<void>`

---

## R-04 — Drizzle Schema: JSONB Array Fields

**Unknown:** How are JSONB array fields typed in Drizzle schemas in this codebase?

**Resolution:** From inspection of existing schemas (e.g., `plans.schema.ts`), the pattern is:

```typescript
import { jsonb } from 'drizzle-orm/pg-core'

applies_to_plan_ids: jsonb('applies_to_plan_ids').notNull().default(sql`'[]'::jsonb`).$type<string[]>(),
target_division_ids: jsonb('target_division_ids').$type<string[] | null>(),
```

The `.$type<T>()` generic gives TypeScript the correct inference without altering the SQL column type.

**Decision:** Use `jsonb().$type<string[]>()` for all JSONB array fields in promocodes schema.

---

## R-05 — Migration File Format

**Unknown:** Does the migration use raw SQL strings or a builder pattern?

**Resolution:** Confirmed from `20260407_023_plans_and_subscriptions.ts`:

```typescript
import type { PoolClient } from "pg";

export async function up(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS ...`);
    await client.query(`CREATE INDEX IF NOT EXISTS ...`);
    await client.query(`UPDATE schema_versions SET ...`);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function down(_client: PoolClient): Promise<void> {
  // Forward-only: no down migration
}
```

**Decision:** Use exact same format. Raw SQL strings via `client.query()`. Explicit `BEGIN/COMMIT/ROLLBACK`. `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for idempotency. Update `schema_versions`.

---

## R-06 — FREE_TRIAL Plan Eligibility

**Unknown:** How is `billing_type = 'recurring'` validated for FREE_TRIAL codes?

**Resolution:** The `plans` table from Stage 44 has a `billing_type` column (`VARCHAR(20)`, `CHECK billing_type IN ('one-time', 'recurring')`). The `PromocodeService.validatePromocode()` method must load the plan record to:

1. Check `applies_to_plan_ids` eligibility (Check 6)
2. Check `billing_type = 'recurring'` when `type = 'FREE_TRIAL'`

The plan lookup happens in `promocodes.repository.ts` or is passed in via the validation context.

**Decision:** Add `plan_billing_type: string` field to `PromocodeValidationContext` — the route handler loads the plan and passes its `billing_type` into the context. This avoids cross-package DB queries from inside the domain package.

---

## R-07 — Numeric Precision for discount_amount

**Unknown:** How is `NUMERIC(10,2)` typed in Drizzle?

**Resolution:** From `subscriptions.schema.ts` pattern:

```typescript
import { numeric } from 'drizzle-orm/pg-core'

price_paid: numeric('price_paid', { precision: 10, scale: 2 }).notNull(),
```

Drizzle returns `string` for `numeric` columns (PostgreSQL NUMERIC type). Code must parse with `parseFloat()` when doing arithmetic.

**Decision:** Use `numeric('discount_amount', { precision: 10, scale: 2 }).notNull()` in `promocode_usages` schema. In the calculator, return JavaScript `number` (float64). Parse from DB string on read. Store formatted to 2dp string on write.

---

## R-08 — Route Mounting Point

**Unknown:** Where is the backoffice router mounted? What is the URL prefix?

**Resolution:** From `subscriptions/index.ts`:

> Mounted at `/api/v1/backoffice/workspace` via `app.route(...)` in `app.ts`

Routes are therefore:

- `GET /api/v1/backoffice/workspace/promocodes`
- `POST /api/v1/backoffice/workspace/promocodes`
- etc.

The spec uses short paths `/backoffice/promocodes` — those are the path fragments, not full URLs.

**Decision:** Register the promocodes router at `/promocodes` within the backoffice workspace group. The full URL will be `/api/v1/backoffice/workspace/promocodes`.

---

## R-09 — Stacking Arithmetic Implementation

**Unknown:** How is cumulative stacking implemented when multiple stackable codes are applied?

**Resolution:** Per spec FR-08, stacked discounts are applied sequentially (by `redeemed_at ASC`). Each code's calculation input is the previous code's `final_price`. This means:

```
Code A (PERCENTAGE 10%): plan_price=100 → discount=10, final=90
Code B (FIXED 5):        plan_price=90  → discount=5,  final=85
```

Guard: cumulative `final_price >= 0` always. In practice, each individual call to `calculateDiscount()` already clamps to 0, so the cumulative guard is automatic.

**Decision:** No special stacking accumulator needed. The subscription service calls `applyPromocode()` for each code in order. Each call uses the updated `plan_price` (= previous `final_price`) as input.

---

## All Unknowns Resolved

| ID   | Topic                              | Status   |
| ---- | ---------------------------------- | -------- |
| R-01 | Migration numbering                | RESOLVED |
| R-02 | Stage 44 integration point         | RESOLVED |
| R-03 | Drizzle FOR UPDATE pattern         | RESOLVED |
| R-04 | JSONB array field typing           | RESOLVED |
| R-05 | Migration file format              | RESOLVED |
| R-06 | FREE_TRIAL plan billing_type check | RESOLVED |
| R-07 | Numeric precision typing           | RESOLVED |
| R-08 | Route mounting point               | RESOLVED |
| R-09 | Stacking arithmetic                | RESOLVED |

**Verdict: PROCEED TO PLAN**
