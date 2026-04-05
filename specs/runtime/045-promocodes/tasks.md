# Stage 45 – Promocodes: Tasks

**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER
**Stage:** 45
**Branch:** `spec/045-promocodes`
**Spec:** `specs/runtime/045-promocodes/spec.md`
**Plan:** `specs/runtime/045-promocodes/plan.md`

---

## Architecture Governance Check

| Constraint                    | Status                                                                |
| ----------------------------- | --------------------------------------------------------------------- |
| No cross-tenant access        | ✅ PASS — all queries via `c.get('tenantDb')`; no global DB singleton |
| No middleware bypass          | ✅ PASS — all routes inherit backoffice middleware chain              |
| All writes transactional      | ✅ PASS — usage + subscription insert in single SERIALIZABLE tx       |
| Server-authoritative time     | ✅ PASS — `sql\`NOW()\``only; never`new Date()` in comparisons        |
| No client-calculated discount | ✅ PASS — `calculateDiscount()` server-side; client value discarded   |
| Code immutability enforced    | ✅ PASS — no PATCH endpoint; only `deactivate` write                  |
| Import boundaries             | ✅ PASS — `apps/api` → `packages/domain-core`; no reverse             |
| Migration forward-only        | ✅ PASS — no `down()`; `CREATE TABLE IF NOT EXISTS`                   |

---

## User Stories

| ID  | Story                          | FRs         | Priority |
| --- | ------------------------------ | ----------- | -------- |
| US1 | Promocode Admin CRUD           | FR-01–FR-05 | P1       |
| US2 | Discount Engine                | FR-07       | P1       |
| US3 | Validation Engine (7+2 checks) | FR-06       | P1       |
| US4 | Usage Tracking & Service Core  | FR-09–FR-12 | P1       |
| US5 | Stacking Policy                | FR-08       | P2       |
| US6 | Subscription Integration       | FR-13       | P1       |
| US7 | Analytics & Reporting          | FR-14–FR-15 | P2       |

## Independent Test Criteria per User Story

- **US1:** `GET /promocodes` returns list; `POST /promocodes` returns 201; duplicate code → 409 `PROMOCODE_CODE_ALREADY_EXISTS`; `GET /promocodes/:id` returns code + `SinglePromocodeAnalytics`; `POST /promocodes/:id/deactivate` idempotently sets `is_active=false`
- **US2:** `calculateDiscount('PERCENTAGE', 10, null, 100)` → `{discount_amount: 10, final_price: 90}`; `FREE_TRIAL` → `{final_price: 0, discount_amount: planPrice, free_trial_days}`; floor-rounding to 2 dp verified
- **US3:** `validatePromocodeApplication` returns `{valid: false, code: X}` for each of the 9 failure paths; `{valid: true}` when all checks pass; pure function — no I/O
- **US4:** `applyPromocode(tx, ...)` called inside SERIALIZABLE transaction records usage row; `lockPromocodeForUpdate` called before any count; rollback on failure leaves zero records
- **US5:** Non-stackable code with existing promo → `PROMOCODE_STACKING_NOT_ALLOWED`; stackable code passes
- **US6:** `POST /subscriptions` with valid `promo_code` → `price_paid = final_price` from `DiscountResult`; `FREE_TRIAL` → `expires_at = NOW() + free_trial_days`; invalid code → full transaction rollback; no subscription created
- **US7:** `GET /analytics` returns `PromocodeAnalytics` with `total_codes`, `active_codes`, `expired_codes`, `total_redemptions`, `revenue_impact`, `by_type` breakdown, `top_codes[10]`

---

## Phase 1 — Infrastructure Setup

> Migration and Drizzle schema files. Every downstream task depends on this phase being typecheck-clean.

- [ ] T001 Create tenant migration 024 (CREATE TABLE promocodes, CREATE TABLE promocode_usages, all indexes, UPDATE schema_versions) in `apps/api/src/db/tenant/migrations/20260408_024_promocodes.ts`
- [ ] T002 [P] Create Drizzle schema for `promocodes` table (20 columns, all CHECK constraints, uuid PK, JSONB fields) in `apps/api/src/db/tenant/schemas/promocodes.schema.ts`
- [ ] T003 [P] Create Drizzle schema for `promocode_usages` table (6 columns, FK to promocodes + students + subscriptions, ON DELETE RESTRICT) in `apps/api/src/db/tenant/schemas/promocode-usages.schema.ts`
- [ ] T004 Export `promocodesTable` and `promocodeUsagesTable` from Drizzle schema barrel in `apps/api/src/db/tenant/schemas/index.ts`

**Phase 1 done when:** T001–T004 pass `bun run typecheck`

---

## Phase 2 — Domain Foundation

> Pure type definitions and error registry. No DB calls, no framework imports. All domain phases depend directly on this phase.

- [ ] T005 [P] Create all shared domain types (`PromocodeType`, `PromocodeRow`, `PromocodeInput`, `PromocodeValidationContext` with `plan_billing_type`, `DiscountResult`, `PromocodeUsageRow`, `ValidatorResult`, `ListPromocodesFilter`, `PromocodeAnalytics`, `SinglePromocodeAnalytics`, `AnalyticsFilter`) in `packages/domain-core/src/promocodes/promocodes.types.ts`
- [ ] T006 [P] Create domain error registry (`PromocodeErrorCode` union of 13 codes, `HTTP_STATUS` map, `PromocodeError` class extending `Error` with `code` field) in `packages/domain-core/src/promocodes/promocodes.errors.ts`

**Phase 2 done when:** T005–T006 pass `bun run typecheck`

---

## Phase 3 — [US1] Promocode CRUD — Domain Repository

> Story: Admins can create, list, get, and deactivate promocodes in their workspace.
> Independent test criterion: Repository functions accept `db`/`tx` as first param; `createPromocode` handles PG unique violation (code 23505) by rethrowing as `PromocodeError('PROMOCODE_CODE_ALREADY_EXISTS', ...)`.

- [ ] T007 [US1] Create domain repository with 10 functions (`listPromocodes`, `getPromocodeById`, `getPromocodeByCode`, `createPromocode`, `deactivatePromocode`, `countTotalUsages`, `countUserUsages`, `lockPromocodeForUpdate` — uses `sql\`SELECT id FROM promocodes WHERE id = ${id} FOR UPDATE\``, `insertUsage`, `getAnalyticsSummary`) in `packages/domain-core/src/promocodes/promocodes.repository.ts`

---

## Phase 4 — [US2] Discount Engine

> Story: Discount amounts are always calculated server-side using a pure function; client values are never trusted.
> Independent test criterion: `calculateDiscount('FIXED', 200, null, 100)` → `{discount_amount: 100, final_price: 0}`; `calculateDiscount('PERCENTAGE', 10, null, 100)` → floor(10.00) correct; `FREE_TRIAL` passes `free_trial_days` through.

- [ ] T008 [US2] Create `calculateDiscount` pure function (PERCENTAGE: `Math.floor(planPrice * value / 100 * 100) / 100`, clamp to 0; FIXED: `Math.max(0, planPrice - value)`; FREE_TRIAL: `discount_amount = planPrice`, `final_price = 0`, `free_trial_days` returned) in `packages/domain-core/src/promocodes/promocodes.calculator.ts`

---

## Phase 5 — [US3] Validation Engine

> Story: Promocode applications are rejected server-side at the first failing check across 7 sequential checks + stacking check + FREE_TRIAL billing_type check.
> Independent test criterion: `validatePromocodeApplication(null, ctx, 0, 0)` → `{valid: false, code: 'PROMOCODE_NOT_FOUND'}`; all 9 failure paths return correct error codes; pure function — no async.

- [ ] T009 [US3] Create `validatePromocodeApplication` pure function (checks in order: code exists → is_active → valid_from/valid_until window → global usage_limit → per_user_limit → plan eligibility → student targeting; stacking check; FREE_TRIAL billing_type check; fail-fast, returns `ValidatorResult`) in `packages/domain-core/src/promocodes/promocodes.validator.ts`

---

## Phase 6 — [US4+US5] Service Orchestration + Barrel Exports

> Story: Usage is recorded atomically inside the caller's SERIALIZABLE transaction; `applyPromocode` participates in but does not own the transaction; `validatePromocode` runs outside the transaction as a fast-fail pre-check.
> Independent test criterion: `applyPromocode(tx, ...)` calls `lockPromocodeForUpdate`, re-runs validator, calls `calculateDiscount`, inserts usage, returns `DiscountResult`; `validatePromocode` returns `{promocode, discountPreview}` without inserting any row.

- [ ] T010 [US4] Create `PromocodeService` class and `promocodeService` singleton (all 7 methods: `createPromocode`, `listPromocodes`, `getPromocode`, `deactivatePromocode`, `validatePromocode`, `applyPromocode`, `getAnalytics`) in `packages/domain-core/src/promocodes/promocodes.service.ts`
- [ ] T011 Create domain module barrel (export `promocodeService`, `PromocodeService`, `PromocodeError`, `HTTP_STATUS`, and all public types from `promocodes.types.ts`) in `packages/domain-core/src/promocodes/index.ts`
- [ ] T012 Export `promocodes` module re-exports from domain-core package barrel in `packages/domain-core/src/index.ts`

**Phase 6 done when:** T010–T012 pass `bun run typecheck`

---

## Phase 7 — Validation Schemas

> Prerequisite for all API route handlers. Both tasks must complete before Phase 8.

- [ ] T013 Create `createPromocodeBodySchema` (with `.superRefine()` for type-conditional validation: PERCENTAGE requires `value ≤100`; FIXED requires `value`; FREE_TRIAL requires `free_trial_days`, forbids `value`; `valid_until > valid_from`), `promocodeIdParamsSchema`, `validatePromocodeBodySchema`, `listPromocodesQuerySchema` in `packages/validation/src/schemas/promocodes.schemas.ts`
- [ ] T014 Extend `createSubscriptionBodySchema` with optional `promo_code: z.string().min(1).max(100).optional()` field in `packages/validation/src/schemas/subscriptions.schemas.ts`

**Phase 7 done when:** T013–T014 pass `bun run typecheck`

---

## Phase 8 — [US1] Admin CRUD API Route Handlers

> Story: Admins manage promocodes via REST API; all 5 CRUD/deactivate endpoints return structured responses conforming to the platform error contract.
> Independent test criterion (subset): `POST /promocodes` with duplicate code → 409; `GET /promocodes/:id` with unknown ID → 404; `POST /promocodes/:id/deactivate` called twice → 200 both times.
> T016–T019 are parallel once T013 (schemas) and T015 (helpers) complete.

- [ ] T015 Create route helpers (`getDb(c)` extracting tenant DB from context, `buildResponsePromocode(row)` response mapper, `buildAuditCtx(c)` for audit fields) in `apps/api/src/routes/backoffice/promocodes/helpers.ts`
- [ ] T016 [P] [US1] Create `handleListPromocodes` handler (parse `listPromocodesQuerySchema` from query, apply `is_active`/`type`/`status` filters using `sql\`NOW()\``, paginate with `page`+`limit`, return `{success:true, data:{promocodes, total, page, limit}}`) in `apps/api/src/routes/backoffice/promocodes/list-promocodes.ts`
- [ ] T017 [P] [US1] Create `handleCreatePromocode` handler (parse `createPromocodeBodySchema`, normalize `code` to `UPPERCASE` before insert, catch PG code `23505` → `PROMOCODE_CODE_ALREADY_EXISTS` 409, return 201 with created row) in `apps/api/src/routes/backoffice/promocodes/create-promocode.ts`
- [ ] T018 [P] [US1] Create `handleGetPromocode` handler (parse `promocodeIdParamsSchema`, return code + `SinglePromocodeAnalytics`, throw `PROMOCODE_NOT_FOUND` 404 when row is null) in `apps/api/src/routes/backoffice/promocodes/get-promocode.ts`
- [ ] T019 [P] [US1] Create `handleDeactivatePromocode` handler (parse UUID param, call `deactivatePromocode`, return idempotent 200 with current row state — already-inactive code must not return error) in `apps/api/src/routes/backoffice/promocodes/deactivate-promocode.ts`

---

## Phase 9 — [US3] Validate Endpoint Handler

> Story: Admin UI can preview discount for a student/plan/code combination before creating a subscription; endpoint is read-only — no DB write occurs on success.
> Independent test criterion: `POST /validate` with valid code → 200 `{valid:true, discount: DiscountResult}`; each of the 9 check failures → 422 with correct `error.code`; confirmed zero rows in `promocode_usages` after call.

- [ ] T020 [US3] Create `handleValidatePromocode` handler (parse `validatePromocodeBodySchema`, load plan `billing_type` + student `division_id`/`group_id`, fetch `server_now` via `SELECT NOW() AS now`, build `PromocodeValidationContext`, call `validatePromocode` — read-only, no insert, return `{success:true, data:{valid:true, discount: DiscountResult}}`) in `apps/api/src/routes/backoffice/promocodes/validate-promocode.ts`

---

## Phase 10 — [US7] Analytics Endpoint Handler

> Story: Admin can view workspace-level code metrics — active/expired counts, total redemptions, revenue impact, and top 10 codes by redemption.
> Independent test criterion: `GET /analytics` returns `PromocodeAnalytics` with all required fields; `by_type` has keys `PERCENTAGE`, `FIXED`, `FREE_TRIAL`; `top_codes` has at most 10 entries.

- [ ] T021 [US7] Create `handleGetPromocodeAnalytics` handler (call `getAnalytics`, return `{success:true, data:{analytics: PromocodeAnalytics}}`) in `apps/api/src/routes/backoffice/promocodes/get-promocode-analytics.ts`

---

## Phase 11 — API Route Index + Backoffice Router Mount

> Order of route registration is enforced: static routes `/analytics` and `/validate` MUST be registered before the parameterised `/:id` route.

- [ ] T022 Create Hono promocodes router (register `/analytics` first, then `POST /validate` with `rateLimitMiddleware({max:10, window:'1m', key:'workspace'})`, then `GET /`, `POST /`, `GET /:id`, `POST /:id/deactivate`) in `apps/api/src/routes/backoffice/promocodes/index.ts`
- [ ] T023 Mount `promocodesRouter` under `/promocodes` in the backoffice router in `apps/api/src/routes/backoffice/index.ts`

---

## Phase 12 — [US6] Subscription Integration (Stage 44 Extension)

> Story: `POST /subscriptions` accepts optional `promo_code`; discount is applied atomically inside the existing SERIALIZABLE transaction; `applyPromocode` participates in but never owns the transaction; FREE_TRIAL modifies `expires_at`.
> Independent test criterion: valid `promo_code` → `price_paid = discountResult.final_price`; invalid code → full SERIALIZABLE transaction rolls back, no subscription row and no usage row created; `FREE_TRIAL` → `expires_at = NOW() + free_trial_days`.

- [ ] T024 [US6] Add `resolvePromoContext` helper (loads plan `billing_type`, student `division_id`/`group_id` from DB, fetches `server_now` via `SELECT NOW()`, loads existing `promo_ids` for student, builds `PromocodeValidationContext`) in `apps/api/src/routes/backoffice/subscriptions/helpers.ts`
- [ ] T025 [US6] Extend `activateSubscription` handler to parse optional `promo_code` from body, call `validatePromocode` outside transaction (fast-fail), pass `DiscountResult` into SERIALIZABLE transaction, call `applyPromocode(tx, ...)` inside transaction, apply `final_price` to `price_paid`, add `free_trial_days` to `expires_at` for FREE_TRIAL type in `apps/api/src/routes/backoffice/subscriptions/activate-subscription.ts`

---

## Phase 13 — Unit Tests

> All unit tests target pure functions; no DB connection required; all three test files are independent and can be written in parallel.

- [ ] T026 [P] Create calculator unit tests (6 cases: PERCENTAGE 10% on 100 → discount=10 final=90; PERCENTAGE 100% clamped → final=0; FIXED 30 on 100 → discount=30 final=70; FIXED 200 > planPrice → final=0; FREE_TRIAL → final=0 free_trial_days returned; two sequential calls for stacking) in `packages/domain-core/src/promocodes/__tests__/promocodes.calculator.test.ts`
- [ ] T027 [P] Create validator unit tests (13 cases: all checks pass; null code → PROMOCODE_NOT_FOUND; is_active=false → PROMOCODE_INACTIVE; server_now < valid_from → PROMOCODE_NOT_YET_VALID; server_now > valid_until → PROMOCODE_EXPIRED; usage limit hit → PROMOCODE_USAGE_LIMIT_REACHED; per-user limit hit → PROMOCODE_PER_USER_LIMIT_REACHED; plan not eligible → PROMOCODE_PLAN_NOT_ELIGIBLE; division targeting miss → PROMOCODE_STUDENT_NOT_IN_TARGET; group targeting miss → PROMOCODE_STUDENT_NOT_IN_TARGET; no targeting → pass; stacking fail → PROMOCODE_STACKING_NOT_ALLOWED; stackable → pass) in `packages/domain-core/src/promocodes/__tests__/promocodes.validator.test.ts`
- [ ] T028 [P] Create service unit tests with mocked repository (5 cases: `createPromocode` success returns PromocodeRow; duplicate code → PROMOCODE_CODE_ALREADY_EXISTS; `deactivatePromocode` idempotent second call → 200; `validatePromocode` integrates validator and repository mocks; `getAnalytics` returns correctly typed shape) in `packages/domain-core/src/promocodes/__tests__/promocodes.service.test.ts`

**Phase 13 done when:** `bun run test packages/domain-core` exits 0 with all 24 unit test cases green

---

## Phase 14 — Integration Tests

> End-to-end API tests against a real tenant DB; covers all 8 endpoints + subscription integration + tenant isolation. Single file, must run after all implementation phases complete.

- [ ] T029 Create integration test suite covering: `POST /promocodes` (201 success, 409 duplicate, 422 invalid body); `GET /promocodes` (list, filter by is_active/type/status/pagination); `GET /promocodes/:id` (200 with analytics, 404 not found); `POST /promocodes/:id/deactivate` (200 idempotent); `POST /promocodes/validate` (200 DiscountResult + 422 for all 7 failure checks + stacking fail + FREE_TRIAL billing_type fail); `GET /promocodes/analytics` (200 PromocodeAnalytics); `POST /subscriptions` with promo_code (usage recorded, discount correct, rollback on invalid promo, per-user limit, usage limit, targeting enforcement, stacking stackable, stacking non-stackable rejected, FREE_TRIAL expires_at, tenant isolation: code from tenant A unreachable in tenant B) in `apps/api/src/routes/backoffice/promocodes/__tests__/promocodes.routes.test.ts`

**Phase 14 done when:** `bun run test apps/api` exits 0

---

## Acceptance Gate

Stage 45 is **DONE** when all of the following are true:

- [ ] All 29 tasks checked
- [ ] 23 new files exist and compile without error
- [ ] 6 modified files pass typecheck
- [ ] Unit tests: 24 test cases green (`packages/domain-core`)
- [ ] Integration tests: all endpoint + subscription + isolation cases green (`apps/api`)
- [ ] Migration applies to a fresh tenant DB without error
- [ ] `bun run lint && bun run typecheck && bun run test` exits 0

---

## Dependency Graph

```
T002 [P] ─┐
T003 [P] ─┤─► T004 (schema barrel)
T001 ─────┘

T005 [P] ─┐
T006 [P] ─┤─► T007 (repository) ──────────────────────────────────────► T010 (service)
           │                                                               │
           ├─► T008 (calculator) ─────────────────────────────────────► T010
           │
           └─► T009 (validator) ──────────────────────────────────────► T010

T004 ─────────────────────────────────────────────────────────────────► T010

T010 ─► T011 (domain barrel) ─► T012 (domain-core index)

T013 (Zod schemas) ─┐
T015 (helpers) ─────┤─► T016 [P] [US1]
                    ├─► T017 [P] [US1]
T012 ───────────────┤─► T018 [P] [US1]
                    ├─► T019 [P] [US1]
                    ├─► T020 [US3]
                    └─► T021 [US7]

T016+T017+T018+T019+T020+T021 ─► T022 (route index) ─► T023 (router mount)

T014 (subscriptions schema mod) ─┐
T012 ─────────────────────────────┤─► T024 (subscriptions helpers)
                                  └─► T025 (activate-subscription)

All implementation (T001–T025) ─► T026 [P] ─┐
                                  T027 [P] ─┤─► T029 (integration tests)
                                  T028 [P] ─┘
```

## Parallel Execution Opportunities

| Window                                    | Parallel Tasks         | Unlock Condition                        |
| ----------------------------------------- | ---------------------- | --------------------------------------- |
| Phase 1 schema files                      | T002, T003             | Independent files                       |
| Phase 2 foundation files                  | T005, T006             | Independent files                       |
| Phase 4 + Phase 5                         | T008, T009             | Both depend only on Phase 2             |
| Phase 8 CRUD handlers (after T013 + T015) | T016, T017, T018, T019 | All independent handler files           |
| Phase 13 unit tests                       | T026, T027, T028       | Independent test files; pure fn targets |

## Implementation Strategy

**Recommended MVP increment (deliver first):** Phases 1–9 + 11 + 12 = full admin CRUD + validation engine + discount engine + subscription integration. This delivers all P1 user stories and unlocks frontend integration before analytics polish.

**Second increment:** Phase 10 (analytics) + Phase 13–14 (full test suite).

---

## File Manifest

### New Files (23)

| #   | File                                                                            | Phase |
| --- | ------------------------------------------------------------------------------- | ----- |
| 1   | `apps/api/src/db/tenant/migrations/20260408_024_promocodes.ts`                  | T001  |
| 2   | `apps/api/src/db/tenant/schemas/promocodes.schema.ts`                           | T002  |
| 3   | `apps/api/src/db/tenant/schemas/promocode-usages.schema.ts`                     | T003  |
| 4   | `packages/domain-core/src/promocodes/promocodes.types.ts`                       | T005  |
| 5   | `packages/domain-core/src/promocodes/promocodes.errors.ts`                      | T006  |
| 6   | `packages/domain-core/src/promocodes/promocodes.repository.ts`                  | T007  |
| 7   | `packages/domain-core/src/promocodes/promocodes.calculator.ts`                  | T008  |
| 8   | `packages/domain-core/src/promocodes/promocodes.validator.ts`                   | T009  |
| 9   | `packages/domain-core/src/promocodes/promocodes.service.ts`                     | T010  |
| 10  | `packages/domain-core/src/promocodes/index.ts`                                  | T011  |
| 11  | `packages/domain-core/src/promocodes/__tests__/promocodes.calculator.test.ts`   | T026  |
| 12  | `packages/domain-core/src/promocodes/__tests__/promocodes.validator.test.ts`    | T027  |
| 13  | `packages/domain-core/src/promocodes/__tests__/promocodes.service.test.ts`      | T028  |
| 14  | `packages/validation/src/schemas/promocodes.schemas.ts`                         | T013  |
| 15  | `apps/api/src/routes/backoffice/promocodes/helpers.ts`                          | T015  |
| 16  | `apps/api/src/routes/backoffice/promocodes/list-promocodes.ts`                  | T016  |
| 17  | `apps/api/src/routes/backoffice/promocodes/create-promocode.ts`                 | T017  |
| 18  | `apps/api/src/routes/backoffice/promocodes/get-promocode.ts`                    | T018  |
| 19  | `apps/api/src/routes/backoffice/promocodes/deactivate-promocode.ts`             | T019  |
| 20  | `apps/api/src/routes/backoffice/promocodes/validate-promocode.ts`               | T020  |
| 21  | `apps/api/src/routes/backoffice/promocodes/get-promocode-analytics.ts`          | T021  |
| 22  | `apps/api/src/routes/backoffice/promocodes/index.ts`                            | T022  |
| 23  | `apps/api/src/routes/backoffice/promocodes/__tests__/promocodes.routes.test.ts` | T029  |

### Modified Files (6)

| #   | File                                                                    | Change                                           | Phase |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------ | ----- |
| 1   | `apps/api/src/db/tenant/schemas/index.ts`                               | Export `promocodesTable`, `promocodeUsagesTable` | T004  |
| 2   | `packages/domain-core/src/index.ts`                                     | Re-export promocodes module                      | T012  |
| 3   | `packages/validation/src/schemas/subscriptions.schemas.ts`              | Add `promo_code` optional field                  | T014  |
| 4   | `apps/api/src/routes/backoffice/subscriptions/helpers.ts`               | Add `resolvePromoContext` helper                 | T024  |
| 5   | `apps/api/src/routes/backoffice/subscriptions/activate-subscription.ts` | Integrate `applyPromocode`                       | T025  |
| 6   | `apps/api/src/routes/backoffice/index.ts`                               | Mount promocodes router                          | T023  |

> **Note:** Plan document lists 5 modified files; the backoffice router mount (file 6 above) is a required additional modification that is implicit in the plan's Step 9 but not explicitly listed in the modified files table.

---

## Non-Negotiable Guards

These must hold at every commit touching this stage:

- [ ] Zero uses of `new Date()` in time comparisons — only `sql\`NOW()\``
- [ ] `calculateDiscount()` never called from client-side code
- [ ] `applyPromocode()` only called inside an open SERIALIZABLE `tx`
- [ ] `lockPromocodeForUpdate()` called before any usage `COUNT(*)` in the same `tx`
- [ ] Zero `DELETE` statements on `promocode_usages`
- [ ] Zero `UPDATE` on `code`, `type`, `value`, `free_trial_days` columns
- [ ] All error responses: `{ success: false, data: null, error: { code, message } }`
- [ ] `bun run lint && bun run typecheck && bun run test` exit 0
