# Plan Report — MCQ Baskets

**Step:** 3 — Plan
**Timestamp:** 2026-03-23T00:30:00.000Z
**Status:** COMPLETE

---

## Summary

Technical implementation plan for the MCQ Baskets feature is complete. `plan.md`, `research.md`,
and `data-model.md` were generated. Two guardian validators ran in parallel (Architecture Guardian
and API Designer). Architecture Guardian returned VERDICT: PASS with two correction requirements
(subsequently applied). API Designer returned VERDICT: BLOCKED with 3 blocking violations
(subsequently remediated — all violations resolved in `plan.md` and `spec.md` before this report
was written). Plan is now compliant and ready for task breakdown.

---

## Inputs Reviewed

- `specs/runtime/033-mcq-baskets/spec.md` (22 FRs, 14 BRs, 10 endpoints + 5 clarifications)
- `specs/runtime/033-mcq-baskets/plan.md`
- `specs/runtime/033-mcq-baskets/research.md`
- `specs/runtime/033-mcq-baskets/data-model.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| API       | 10 route handlers + 1 router assembly + backoffice router mount                                                            |
| Worker    | None                                                                                                                       |
| Frontend  | None                                                                                                                       |
| DB Master | None                                                                                                                       |
| DB Tenant | New migration `20260323_011_mcq_baskets.ts` (schema 1.16.0 → 1.17.0): 2 tables, 7 FK constraints, 6 indexes (2 CONCURRENT) |

---

## Key Technical Decisions

| #      | Decision                                                                                                                                                  | Rationale                                                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| AD-001 | Extend `WorkflowState` enum to include `DRAFT`; add `DRAFT→COMPLETED` transition edge; register `mcq_basket` in entity/table maps                         | Baskets require a `DRAFT` initial state; additive-only change with zero impact on existing entities                                      |
| AD-002 | Route handler bridges coarse RBAC codes (`question_manage`, `content_manage`, `content_review`) to engine-compatible `mcq_basket.{actionKey}` permissions | Engine is generic; bridging lives in basket route helper only                                                                            |
| AD-003 | `questionCount` computed at read time via COUNT subquery — no stored counter column                                                                       | Stored counter drifts on CASCADE deletes from `mcq_questions`; read-time count is always accurate                                        |
| AD-004 | Deletion guard queries `information_schema.tables` before checking reference tables (`exam_configurations`, `auto_selection_rules`) that do not yet exist | Graceful progressivity — enforcement becomes automatic when tables appear in future stages (pattern established in `tags.repository.ts`) |
| AD-005 | `PATCH` endpoint excludes `status` field; Zod strips unknown keys                                                                                         | Status is workflow-engine property only                                                                                                  |
| AD-006 | `type` column (LINKED/UNLINKED) is immutable post-creation                                                                                                | Mutation would break exam engine filtering assumptions                                                                                   |
| AD-007 | Dedicated basket workflow transition endpoint, not generic `/workflow/:entityType/:entityId/transition`                                                   | Allows basket-specific pre-transition guards and permission bridging scoped to this entity only                                          |

---

## Migration Impact

| Item                  | Value | Notes                                                                                              |
| --------------------- | ----- | -------------------------------------------------------------------------------------------------- |
| Migration required    | Yes   | `apps/api/src/db/tenant/migrations/20260323_011_mcq_baskets.ts`                                    |
| `schema_version` bump | Yes   | `1.16.0 → 1.17.0`                                                                                  |
| Backward compatible   | Yes   | Additive only — two new tables, no changes to existing tables                                      |
| CONCURRENT indexes    | Yes   | `unique_mcq_basket_code` and `unique_mcq_basket_question` created CONCURRENTLY outside transaction |

---

## Transaction Boundaries

- `createBasket`: single TX — uniqueness check → INSERT
- `updateBasket`: single TX — SELECT FOR UPDATE → optional code check → UPDATE
- `deleteBasket`: single TX — SELECT FOR UPDATE → deletion guard → DELETE (cascades basket_questions)
- `transitionStatus`: no outer TX — read-only pre-guards → `executeTransition()` (engine-owned BEGIN/FOR UPDATE/COMMIT)
- `linkQuestion`: single TX — existence checks → duplicate check → max_questions check → INSERT
- `unlinkQuestion`: single TX — existence check → find link → DELETE

---

## Idempotency Strategy

- `linkQuestion`: `UNIQUE (basket_id, question_id)` DB constraint + application pre-check; duplicate returns 409 (per C3)
- All migrations: `CREATE TABLE IF NOT EXISTS`, `IF NOT EXISTS` FK guards, `CREATE INDEX IF NOT EXISTS`, `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS`
- Boot registry: migration checked against `migration_history` before applying

---

## Guardian Verdicts

| Guardian              | Verdict                  | Notes                                                                                                                                                                                                                            |
| --------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture Guardian | PASS (with corrections)  | Corrections applied: (1) `transitionStatus` TX boundary table row fixed — removed incorrect outer BEGIN/FOR UPDATE wrap; (2) `status_updated_at`/`status_updated_by` added to spec.md `mcq_baskets` column table                 |
| API Designer          | PASS (after remediation) | V1 resolved: `BASKET_REFERENCED_IN_*` HTTP 422→409; V2 resolved: `BASKET_QUESTION_DUPLICATE`→`BASKET_QUESTION_ALREADY_LINKED` throughout plan.md + spec.md; V3 resolved: `:id`→`:basketId` in all 7 endpoint headings in spec.md |

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                                                                            |
| -------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | All queries scoped to tenant DB; tenant resolver middleware enforced                                                             |
| All writes are transactional by design | ✅     | Every write operation uses explicit BEGIN/COMMIT                                                                                 |
| Server-authoritative time enforced     | ✅     | All `created_at`/`updated_at`/`status_updated_at` set via NOW() server-side                                                      |
| License middleware enforced            | ✅     | Middleware chain: tenant-resolver → license → permission → handler                                                               |
| Version compatibility enforced         | ✅     | Migration registered in boot registry with `schema_version` check                                                                |
| No architecture redesign without ADR   | ✅     | AD-001 through AD-007 document all architectural decisions inline; no new ADR required (all decisions are scoped to this domain) |

**Overall:** COMPLIANT
