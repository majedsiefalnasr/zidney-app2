# Plan Report — TRANSLATION_SYSTEM

**Step:** 3 — Plan  
**Timestamp:** 2026-03-01T00:40:00Z  
**Status:** COMPLETE

---

## Summary

Technical plan is complete across 5 artifacts (plan.md, research.md, data-model.md, contracts/api-endpoints.md, contracts/worker-job-schema.md). Guardian validation passed from both Architecture Checker and API Designer with VERDICT: PASS. Two pre-task items were remediated: DRAIN DELETE pattern updated to include `RETURNING` clause for FR-032 audit compliance, and HTTP 202 corrected to 409 in research.md to align with spec Q3 clarification.

The plan covers a full-stack translation system: tenant DB migration (2 new tables + schema_version 1.1.0→1.2.0), domain-core service layer, 4 API endpoints, and a Worker job for async language removal cascade.

---

## Inputs Reviewed

- `specs/runtime/019-translation-system/spec.md` (including Clarifications)
- `specs/runtime/019-translation-system/plan.md`
- `specs/runtime/019-translation-system/research.md`
- `specs/runtime/019-translation-system/data-model.md`
- `specs/runtime/019-translation-system/contracts/api-endpoints.md`
- `specs/runtime/019-translation-system/contracts/worker-job-schema.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API       | 4 routes under `/api/workspaces/:slug/translations` (upsert, resolve, list, coverage); language removal cascade integration in workspace settings route |
| Worker    | New job handler: `DRAIN_LANGUAGE_TRANSLATIONS` in `apps/worker/src/jobs/drain-language-translations.ts`                                                 |
| Frontend  | None — translation management UI is out of scope for this stage                                                                                         |
| DB Master | None                                                                                                                                                    |
| DB Tenant | 2 new tables: `translations` + `translation_audit_logs`; JSONB `language_settings` schema extension for `language_status` field                         |

---

## Key Technical Decisions

| #   | Decision                                                                 | Rationale                                                                                                                                             |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Drizzle `onConflictDoUpdate` on composite unique constraint              | Idempotent upsert; handles concurrent writes to same key safely; HTTP 200 for both create and update (Q4)                                             |
| 2   | 4-index strategy for translations table                                  | Unique constraint + entity lookup + coverage + language_code — covers all query shapes without full-table scans; forward-compatible with partitioning |
| 3   | Audit log in same transaction as translation upsert                      | 100% auditability guaranteed; no silent mutations possible; FR-031–FR-034 satisfied                                                                   |
| 4   | No FK cascade for entity deletion                                        | Translations table cannot have FK pointing to multiple parent tables; application-layer explicit DELETE in entity deletion transaction (Q1)           |
| 5   | Hybrid threshold for language removal cascade (10,000 rows)              | Below threshold: synchronous in-transaction per FR-016; above: Worker DRAIN_LANGUAGE_TRANSLATIONS job, language marked `removing` (Q3)                |
| 6   | DRAIN DELETE with `RETURNING *` clause                                   | Required to populate per-row audit entries (entity_type, entity_id, field_name) that satisfy FR-032 — cannot be inferred from job payload alone       |
| 7   | TRANSLATABLE_FIELDS pure constant in domain-core                         | Zero DB overhead for coverage denominator; governed by code change + version bump; unknown entity_type → 0% + warning                                 |
| 8   | `language_status` stored in workspace_settings JSONB                     | No new table or migration needed; backward-compatible optional field; absent = active; `removing` blocks writes during drainage                       |
| 9   | schema_version 1.1.0 → 1.2.0 (MINOR bump)                                | Additive tables only; per ADR-0008 MINOR policy for new tables; license middleware enforces compatible version before route access                    |
| 10  | Redis cache key: `coverage:{workspace_id}:{entity_type}:{language_code}` | Cross-tenant cache access architecturally impossible by construction; invalidated on any translation write or language config change                  |

---

## Migration Impact

| Item                  | Value | Notes                                                                                                        |
| --------------------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| Migration required    | Yes   | Single forward-only migration file in `apps/api/src/db/tenant/migrations/`                                   |
| `schema_version` bump | Yes   | 1.1.0 → 1.2.0 (MINOR — new tables are additive) per ADR-0008                                                 |
| Backward compatible   | Yes   | Existing tenant data unaffected; new tables have no FK to existing tables (entity_type is open-ended string) |

---

## Transaction Boundaries

- **Single translation upsert**: 1 transaction — `translations` upsert + `translation_audit_logs` insert committed atomically
- **Batch translation upsert (N items)**: 1 transaction — all N upserts + all N audit inserts are committed or rolled back as a unit (FR-029)
- **Language removal (≤10K rows)**: 1 transaction — `workspace_settings` update + `translations` bulk delete + `translation_audit_logs` inserts (FR-016)
- **Language removal (>10K rows)**: Transaction 1 — `workspace_settings` update (language_status → `removing`) + enqueue DRAIN job; Worker: 1 mini-transaction per batch of 1,000 rows (DELETE + audit inserts)
- **Entity deletion cleanup**: Part of the entity deletion transaction — `DELETE FROM translations WHERE entity_type + entity_id` executed by domain service within the entity deletion transaction

---

## Idempotency Strategy

- **Translation upsert**: Composite key `(entity_type, entity_id, field_name, language_code)` is the idempotency key; submitting same key any number of times produces the same final state — no unique constraint errors; HTTP 200 always (Q4)
- **Batch upsert**: Each item in the batch is individually idempotent via composite key; batch atomicity ensures no partial-save scenarios
- **DRAIN_LANGUAGE_TRANSLATIONS**: Idempotent by design — job re-processes only rows that still exist; `language_status='removing'` flag prevents duplicate job enqueue (via `job-hash.ts` dedup); safe to retry after crash

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                                                        |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| No cross-tenant logic introduced       | ✅     | All DB access via tenant pool from request/job context; Redis cache keyed by workspace_id                    |
| All writes are transactional by design | ✅     | Explicitly documented transaction boundaries table in plan.md; batch upserts atomic; language removal atomic |
| Server-authoritative time enforced     | ✅     | `created_at` and `updated_at` use `db.$now()` / server-side SQL `NOW()`; audit timestamps server-side        |
| License middleware enforced            | ✅     | FR-041, plan.md Phase 3 middleware chain position 3 (`licenseEnforcement`)                                   |
| Version compatibility enforced         | ✅     | schema_version 1.1.0→1.2.0 per ADR-0008; license middleware validates schema_version compatibility           |
| No architecture redesign without ADR   | ✅     | No new architectural patterns introduced; uses existing Worker, Redis, Drizzle, domain-core patterns         |

**Overall:** COMPLIANT

---

## Guardian Validation Results

| Guardian                    | Verdict | Notes                                                                              |
| --------------------------- | ------- | ---------------------------------------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS | 2 items remediated: RETURNING clause added to DRAIN DELETE; HTTP 202→409 corrected |
| Zidney API Designer         | ✅ PASS | All 10 API design checklist items satisfied                                        |

---

## Open Risks

- **Coverage cache invalidation at scale**: With millions of translation rows, invalidating on every individual upsert may cause cache thrashing. Recommend batch/debounce invalidation in a future optimization pass.
- **Unknown entity_type governance**: If a consuming domain uses an entity_type not registered in TRANSLATABLE_FIELDS, coverage returns 0% with a warning. No hard error. Requires domain team discipline in keeping the registry current.

---

## Next Step

Proceed to Step 4 — Tasks.
