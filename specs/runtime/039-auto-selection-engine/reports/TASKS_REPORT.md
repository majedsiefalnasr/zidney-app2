# Tasks Report - Auto Selection Engine

**Step:** 4 - Tasks  
**Timestamp:** 2026-04-02T00:13:37Z  
**Status:** COMPLETE

---

## Summary

Atomic implementation tasks were generated successfully from specification and plan artifacts. The task set is execution-ordered, user-story grouped, and includes explicit migration, idempotency, transaction, observability, and performance validation coverage.

---

## Inputs Reviewed

- `specs/runtime/039-auto-selection-engine/spec.md`
- `specs/runtime/039-auto-selection-engine/plan.md`
- `specs/runtime/039-auto-selection-engine/tasks.md`

---

## Task Breakdown

| Category       | Count  | Notes                                                                                                  |
| -------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Infrastructure | 11     | Setup + foundational schema/contracts/logging tasks (T001-T011)                                        |
| API            | 8      | Attempt-start + backoffice route integration and response mapping (T018-T021, T026-T028, T034)         |
| Worker         | 0      | Stage 39 intentionally does not change worker logic                                                    |
| Frontend       | 0      | No UI/business-logic shift; backoffice flow remains API-driven                                         |
| Observability  | 2      | Structured diagnostics helper + final validation/reporting hooks (T011, T038)                          |
| Testing        | 10     | Unit/integration/contract/load/performance coverage (T002, T012-T014, T022-T023, T030-T031, T035-T036) |
| **Total**      | **38** | Includes implementation, docs/polish, and cross-cutting governance tasks                               |

---

## Transactional Tasks

- T001, T004-T007: migration/schema work enabling atomic writes.
- T018-T019: attempt-start transaction orchestration + immutable persistence.
- T024-T027: publish/save validation transaction boundaries and blocking checks.

---

## Idempotency Tasks

- T020: explicit `Idempotency-Key` handling and conflict semantics.
- T021: response-envelope + error-code mapping for deterministic retry outcomes.
- T014: integration tests covering attempt-start behavior under retry/failure paths.

---

## Architecture Governance Compliance

| Check                                        | Status | Notes                                                                               |
| -------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | Migration, attempt start, and publish/save flows have explicit transactional tasks  |
| Idempotency tasks are defined where required | ✅     | Dedicated validator + error mapping tasks included                                  |
| Layer boundary rules are respected           | ✅     | Tasks target apps/api and packages/\* without forbidden cross-app imports           |
| No unrelated file modifications planned      | ✅     | All planned files are Stage 39 scope artifacts or directly affected runtime modules |
| Migration tasks included when required       | ✅     | Tenant migration + migration verification tasks are present                         |
| Trust chain respected                        | ✅     | Middleware-guarded route integration tasks keep order intact                        |
| Import boundaries respected                  | ✅     | Domain and validation changes remain package-scoped                                 |
| Architecture guard task included             | ✅     | Validation/reporting task (T038) captures gate evidence in stage reports            |

**Overall:** COMPLIANT

---

## Open Risks

- High parallelism in execution may create merge contention around `apps/api/src/routes/attempts/create.ts` and `packages/domain-core/src/attempts/auto-selection.service.ts`.
- Performance target tasks (T035/T036) depend on representative fixture realism and test-env stability.

---

## Risk-Ranked Task Summary

| Task ID | Risk      | Description                                            |
| ------- | --------- | ------------------------------------------------------ |
| T001    | 🔴 HIGH   | Tenant migration for Stage 39 schema updates           |
| T002    | 🟢 LOW    | Migration verification test                            |
| T003    | 🟢 LOW    | Auto-selection fixture helpers                         |
| T004    | 🔴 HIGH   | Attempts schema deterministic seed/diagnostics columns |
| T005    | 🔴 HIGH   | Attempt-questions schema + unique indexes              |
| T006    | 🔴 HIGH   | MCQ auto-criteria schema extension                     |
| T007    | 🟡 MEDIUM | Schema exports update                                  |
| T008    | 🟡 MEDIUM | Stage 39 error codes in shared types                   |
| T009    | 🟡 MEDIUM | Criteria validation schema extension                   |
| T010    | 🟢 LOW    | Validation package export wiring                       |
| T011    | 🟡 MEDIUM | Structured selection diagnostics helper                |
| T012    | 🟢 LOW    | Deterministic shuffle unit tests                       |
| T013    | 🟢 LOW    | Pool insufficiency/duplicate guard tests               |
| T014    | 🟢 LOW    | Attempt-start integration tests                        |
| T015    | 🔴 HIGH   | Seeded selector primitives                             |
| T016    | 🔴 HIGH   | Auto-selection orchestration service                   |
| T017    | 🟢 LOW    | Domain-core Stage 39 API exports                       |
| T018    | 🔴 HIGH   | Integrate auto-selection in attempt create route       |
| T019    | 🔴 HIGH   | Immutable assignment persistence helper                |
| T020    | 🔴 HIGH   | `Idempotency-Key` validation + conflict behavior       |
| T021    | 🔴 HIGH   | Selection failure mapping to response envelope         |
| T022    | 🟢 LOW    | Auto-criteria validation contract tests                |
| T023    | 🟢 LOW    | Criteria save/publish blocking integration tests       |
| T024    | 🟡 MEDIUM | Criteria count-mode and total-match validation         |
| T025    | 🔴 HIGH   | Overlap-risk and undersized-uniqueness validator       |
| T026    | 🔴 HIGH   | Criteria mutation endpoint integration                 |
| T027    | 🔴 HIGH   | Publish-time blocking checks integration               |
| T028    | 🟡 MEDIUM | Validation error mapping helpers                       |
| T029    | 🟡 MEDIUM | Criteria repository filter-dimension updates           |
| T030    | 🟢 LOW    | Hybrid merge/uniqueness unit tests                     |
| T031    | 🟢 LOW    | Hybrid attempt-start integration tests                 |
| T032    | 🔴 HIGH   | Manual-ID exclusion and zero-auto edge handling        |
| T033    | 🟡 MEDIUM | Manual-first ordering merge logic                      |
| T034    | 🔴 HIGH   | Hybrid diagnostics + final-count enforcement           |
| T035    | 🟡 MEDIUM | 500-concurrency load test                              |
| T036    | 🟡 MEDIUM | Selection latency performance benchmark                |
| T037    | 🟢 LOW    | Quickstart operator verification update                |
| T038    | 🟢 LOW    | Tasks validation evidence report                       |

## Tasks with External Dependencies

None identified.

## High-Downstream-Impact Tasks

These tasks modify architectural hotspots - extra review attention recommended.

| Task ID | Module               | Centrality | Description                                |
| ------- | -------------------- | ---------- | ------------------------------------------ |
| T011    | packages/domain-core | HIGH       | Structured selection diagnostics helper    |
| T012    | packages/domain-core | HIGH       | Deterministic shuffle unit tests           |
| T013    | packages/domain-core | HIGH       | Pool/duplicate guard tests                 |
| T015    | packages/domain-core | HIGH       | Seeded selector primitives                 |
| T016    | packages/domain-core | HIGH       | Selection orchestration service            |
| T017    | packages/domain-core | HIGH       | Domain export updates                      |
| T024    | packages/domain-core | HIGH       | Count-mode and total-match validator       |
| T025    | packages/domain-core | HIGH       | Overlap-risk validation service            |
| T029    | packages/domain-core | HIGH       | Criteria repository updates                |
| T030    | packages/domain-core | HIGH       | Hybrid merge/uniqueness tests              |
| T032    | packages/domain-core | HIGH       | Manual exclusion + zero-auto edge handling |

---

## Next Step

Proceed to Step 5 - Analyze.
