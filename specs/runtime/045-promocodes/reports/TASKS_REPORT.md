# Tasks Report — STAGE 45 – Promocodes

**Step:** 4 — Tasks  
**Timestamp:** 2026-04-05T00:30:00.000Z  
**Status:** COMPLETE

---

## Summary

29 atomic tasks (T001–T029) generated across 14 phases. Dependency graph verified — migration and schema files are the prerequisite root; domain layers follow in strict order; API handlers and tests are unblocked only after domain and Zod schemas are complete. Five parallel execution windows identified.

---

## Inputs Reviewed

- `specs/runtime/045-promocodes/spec.md`
- `specs/runtime/045-promocodes/plan.md`
- `specs/runtime/045-promocodes/data-model.md`
- `specs/runtime/045-promocodes/research.md`
- `specs/runtime/045-promocodes/tasks.md`

---

## Task Breakdown

| Category                                  | Count  | Tasks     |
| ----------------------------------------- | ------ | --------- |
| Infrastructure (migration + schema)       | 4      | T001–T004 |
| Domain foundation (types + errors)        | 2      | T005–T006 |
| Domain repository                         | 1      | T007      |
| Domain calculator                         | 1      | T008      |
| Domain validator                          | 1      | T009      |
| Domain service + barrels                  | 3      | T010–T012 |
| Validation schemas (Zod)                  | 2      | T013–T014 |
| API route helpers                         | 1      | T015      |
| API route handlers (CRUD)                 | 4      | T016–T019 |
| API route handlers (validate + analytics) | 2      | T020–T021 |
| API router mount                          | 2      | T022–T023 |
| Subscription integration (Stage 44 ext.)  | 2      | T024–T025 |
| Unit tests                                | 3      | T026–T028 |
| Integration tests                         | 1      | T029      |
| **Total**                                 | **29** |           |

---

## Transactional Tasks

- **T001** — Migration CREATE TABLE statements wrapped in `db.transaction()` by the migration runner
- **T010** — `applyPromocode` participates in the caller's SERIALIZABLE transaction (never opens its own)
- **T025** — Stage 44 `activate-subscription.ts`: `applyPromocode(tx, ...)` called inside existing SERIALIZABLE transaction; entire subscription + usage insert is atomic

---

## Idempotency Tasks

- **T019** — `deactivatePromocode`: already-inactive code returns 200 (not an error); idempotent by design
- **T025** — Subscription activation: duplicate `promo_code` in same transaction body triggers pre-flight `validatePromocode` (read-only check rejects at per-user limit), preventing double-apply without additional guard logic
- **T017** — `createPromocode` normalizes code to UPPERCASE before insert; DB UNIQUE constraint on `LOWER(code)` is the authoritative uniqueness enforcer

---

## Risk-Ranked Task Summary

| Task ID   | Risk      | Description                                                                         |
| --------- | --------- | ----------------------------------------------------------------------------------- |
| T001      | 🔴 HIGH   | Tenant migration 024 — `CREATE TABLE promocodes`, `CREATE TABLE promocode_usages`   |
| T004      | 🔴 HIGH   | Export new Drizzle schemas from barrel — any mis-export breaks all downstream tasks |
| T007      | 🔴 HIGH   | Domain repository with `FOR UPDATE` raw SQL lock pattern                            |
| T009      | 🔴 HIGH   | Validation engine — 9-check sequential fail-fast logic                              |
| T010      | 🔴 HIGH   | Service layer orchestration + SERIALIZABLE `applyPromocode`                         |
| T025      | 🔴 HIGH   | Stage 44 subscription integration — modifies existing transaction boundary          |
| T013      | 🟡 MEDIUM | Zod schemas with `.superRefine()` type-conditional validation                       |
| T020      | 🟡 MEDIUM | `/validate` handler — context building, server-time fetch, rate-limited             |
| T022      | 🟡 MEDIUM | Route index — static routes must precede parameterized routes                       |
| T029      | 🟡 MEDIUM | Integration tests — covers 20+ scenarios including tenant isolation                 |
| T026–T028 | 🟢 LOW    | Unit tests — pure functions, no DB                                                  |
| T016–T019 | 🟢 LOW    | CRUD handlers — straightforward read/write patterns                                 |
| T021      | 🟢 LOW    | Analytics handler — read-only aggregate                                             |

---

## External Dependency Tasks

| Task ID | Package             | Version Note                                                                                        |
| ------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| T007    | drizzle-orm         | `FOR UPDATE` via `tx.execute(sql\`...\`)` — verified against v0.30 docs (no native chain method)    |
| T001    | drizzle-orm/pg-core | `pgTable`, `uuid`, `text`, `integer`, `decimal`, `jsonb`, `boolean`, `timestamp` — standard columns |
| T013    | zod                 | `.superRefine()` cross-field validation — verified stable in zod v3                                 |
| T020    | @hono/zod-validator | Inline request validation middleware — confirmed available                                          |

---

## High-Downstream-Impact Tasks

| Task ID | Module                                                                | Centrality | Description                                                  |
| ------- | --------------------------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| T004    | apps/api/src/db/tenant/schemas/index.ts                               | HIGH       | Schema barrel export — all API queries depend on this        |
| T012    | packages/domain-core/src/index.ts                                     | HIGH       | Domain-core barrel — all API route handlers import from here |
| T025    | apps/api/src/routes/backoffice/subscriptions/activate-subscription.ts | HIGH       | Modifies Stage 44 subscription transaction boundary          |

---

## Architecture Governance Compliance

| Check                                        | Status | Notes                                                                                             |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T010 + T025 cover both write paths                                                                |
| Idempotency tasks are defined where required | ✅     | T019 deactivate idempotent; T025 pre-flight validation prevents double-apply                      |
| Layer boundary rules are respected           | ✅     | domain-core has no Hono import; API handlers import only from domain-core and packages/validation |
| No unrelated file modifications planned      | ✅     | Only 5 files modified, all with documented justification in plan.md                               |
| Migration tasks included when required       | ✅     | T001 — migration 024                                                                              |
| Trust chain respected                        | ✅     | Tenant DB extracted via `c.get('tenantDb')` only; no global singleton                             |
| Rate limiting on enumeration endpoint        | ✅     | T022 registers `rateLimitMiddleware` on POST /validate (AD-08)                                    |
| Static routes before parameterized routes    | ✅     | T022 route registration order enforced                                                            |
