# Plan Report — STAGE 45 – Promocodes

**Step:** 3 — Plan  
**Timestamp:** 2026-04-05T00:20:00.000Z  
**Status:** COMPLETE

---

## Summary

Technical implementation plan complete for the workspace-scoped Promocode system. Plan went through one guardian cycle (Architecture Guardian: PASS, API Designer: initially BLOCKED → fixed → PASS), resolving route ordering and rate limiting violations before finalizing. Plan covers 24 new files + 5 modified files, migration 024, domain package, API routes, and 36 test cases.

---

## Inputs Reviewed

- `specs/runtime/045-promocodes/spec.md` (with clarifications)
- `specs/runtime/045-promocodes/plan.md`
- `specs/runtime/045-promocodes/research.md`
- `specs/runtime/045-promocodes/data-model.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                      |
| --------- | -------------------------------------------------------------------- |
| API       | 8 new route handlers in `apps/api/src/routes/backoffice/promocodes/` |
| Worker    | None                                                                 |
| Frontend  | None (Backoffice UI scope deferred)                                  |
| DB Tenant | Migration 024: `promocodes` + `promocode_usages` tables              |
| DB Master | None                                                                 |

---

## Key Technical Decisions

| #     | Decision                                                                                    | Rationale                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| AD-01 | SERIALIZABLE isolation for apply-promocode transaction                                      | Prevents race conditions on usage_limit counter under concurrent redemptions                                           |
| AD-02 | Row-level lock: `FOR UPDATE` on `promocodes` row before counting usages                     | Single lock covers both global and per-user limit checks; avoids JSONB aggregate lock                                  |
| AD-03 | Pre-validation fast-fail before opening transaction                                         | Eliminates most invalid requests before acquiring SERIALIZABLE transaction; inner re-validation guarantees correctness |
| AD-04 | Stage 44 `activate-subscription.ts` owns transaction; Stage 45 domain function participates | Stage 44 calls `applyPromocode(tx, ...)` — no new transaction opened; no double-commit                                 |
| AD-05 | Case-insensitive uniqueness via `UNIQUE (LOWER(code))` partial index                        | Prevents "SUMMER10" / "summer10" duplicates; enforced at DB level                                                      |
| AD-06 | Drizzle FOR UPDATE via `tx.execute(sql\`...\`)` raw query                                   | No native Drizzle chain method for row-level locks as of v0.30                                                         |
| AD-07 | POST /promocodes — no transparent idempotency (explicit decision)                           | AGENTS.md mandates idempotency for payment/exam/certs/webhooks, not admin CRUD                                         |
| AD-08 | /validate rate limited: 10 req/min per workspace via redis-utils                            | Prevents brute-force code enumeration on the preview endpoint                                                          |

---

## Migration Impact

| Item               | Value                       | Notes                                                   |
| ------------------ | --------------------------- | ------------------------------------------------------- |
| Migration required | Yes                         | `20260408_024_promocodes.ts`                            |
| Migration type     | Forward-only                | `down()` is a no-op per ADR-0003                        |
| Lock risk          | LOW                         | CREATE TABLE on new tables; no ALTER on existing tables |
| Sequence follows   | 023_plans_and_subscriptions | Confirmed in codebase                                   |
| New tables         | 2                           | `promocodes`, `promocode_usages`                        |

---

## File Manifest

| Type           | Count | Locations                                                                                                              |
| -------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| New files      | 24    | `packages/domain-core/src/promocodes/` (8), `apps/api/src/routes/backoffice/promocodes/` (9), migration (1), tests (6) |
| Modified files | 5     | `activate-subscription.ts`, main router, migration runner, test helpers, schema index                                  |

---

## Guardian Verdicts (Step 3.1A)

| Guardian              | Verdict             | Notes                                                                      |
| --------------------- | ------------------- | -------------------------------------------------------------------------- |
| Architecture Guardian | ✅ PASS             | All 10 architectural criteria satisfied; 2 non-blocking doc defects noted  |
| API Designer          | ✅ PASS (after fix) | Route ordering fixed, rate limiting added, idempotency decision documented |
