# Tasks Report — TRANSLATION_SYSTEM

**Step:** 4 — Tasks  
**Timestamp:** 2026-03-01T00:55:00Z  
**Status:** COMPLETE

---

## Summary

28 atomic, dependency-ordered tasks generated spanning 6 execution phases: Setup (types/errors/constants), Migration (2 Drizzle schemas + DB migration), Domain (translation + coverage services), API (4 route handlers + workspace-settings integration), Worker (DRAIN_LANGUAGE_TRANSLATIONS job), and Tests (unit + integration + contract). Task ordering enforces all cross-phase dependencies.

---

## Inputs Reviewed

- `specs/runtime/019-translation-system/spec.md`
- `specs/runtime/019-translation-system/plan.md`
- `specs/runtime/019-translation-system/data-model.md`
- `specs/runtime/019-translation-system/contracts/api-endpoints.md`
- `specs/runtime/019-translation-system/contracts/worker-job-schema.md`
- `specs/runtime/019-translation-system/tasks.md`

---

## Task Breakdown

| Category                                                                           | Count  | Notes                                                                               |
| ---------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| Setup (types, errors, constants)                                                   | 3      | T001–T003; global blockers for all subsequent phases                                |
| Migration (Drizzle schemas + DB migration)                                         | 3      | T004–T006; translations + translation_audit_logs tables, schema_version 1.1.0→1.2.0 |
| Domain (services + barrel export)                                                  | 3      | T007–T009; translation.service.ts, coverage.service.ts, index.ts                    |
| API (workspace-settings types/validation/service/repo + 4 route handlers + router) | 9      | T010–T018; includes workspace-settings.service.ts modification for language removal |
| Worker (job type + DRAIN handler)                                                  | 2      | T019–T020; DRAIN_LANGUAGE_TRANSLATIONS with RETURNING clause                        |
| Tests (unit + integration + contract)                                              | 8      | T021–T028; 3 unit, 4 integration, 1 contract                                        |
| **Total**                                                                          | **28** |                                                                                     |

---

## Transactional Tasks

- **T007** (translation.service.ts): upsertTranslations commits N upserts + N audit inserts atomically; batch validation failure triggers full rollback
- **T008** (coverage.service.ts): no direct write transactions; invalidation call is fire-and-forget
- **T014** (POST translations route): 1 transaction per single/batch write — all rows + audit entries committed together
- **T018** (workspace-settings.service.ts): language removal ≤10K: `workspace_settings` update + translations DELETE + audit entries in 1 transaction; language removal >10K: 1 transaction for `language_status='removing'` + job enqueue only
- **T020** (DRAIN job handler): 1 mini-transaction per batch of 1,000: DELETE with RETURNING + audit inserts committed atomically per batch

---

## Idempotency Tasks

- **T007** (translation.service.ts): Drizzle `onConflictDoUpdate` on composite unique constraint — submitting same composite key always safe; HTTP 200 for both create and update
- **T020** (DRAIN job handler): reads only rows that still exist; `language_status='removing'` guard prevents duplicate job enqueue; safe to retry after crash
- **T024** (integration tests): explicit idempotency test — rapid duplicate upsert submission produces no unique-constraint error, correct final state

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                                                                 |
| -------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | T007, T014, T018, T020 all have explicit transaction boundaries                                       |
| Idempotency tasks are defined where required | ✅     | T007 (upsert), T020 (DRAIN), T024 (idempotency integration test)                                      |
| Layer boundary rules are respected           | ✅     | Types in domain-core; business logic in domain-core; routes call service only; no cross-app imports   |
| No unrelated file modifications planned      | ✅     | Only T018 modifies an existing file (workspace-settings.service.ts); all other tasks create new files |
| Migration tasks included when required       | ✅     | T004–T006: Drizzle schemas + migration file; schema_version 1.1.0→1.2.0                               |

**Overall:** COMPLIANT

---

## Open Risks

- **T018 scope**: Modifying `workspace-settings.service.ts` for language removal cascade requires careful merge with any concurrent workspace settings work. This is the only task that touches an existing non-trivially shared file.
- **Test infrastructure**: T024–T028 assume the integration test DB setup helper supports tenant DB isolation. If the test bootstrap for tenant DB is not stable, integration tests may have setup failures unrelated to the translation system itself.

---

## Next Step

Proceed to Step 5 — Analyze (Drift Detector).
