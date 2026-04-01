# Plan Report — Scheduled Exam Engine

**Step:** 3 — Plan
**Timestamp:** 2026-04-01T00:30:00Z
**Status:** COMPLETE

---

## Summary

Technical implementation plan complete. 825-line `plan.md` covering 36 tasks across 7 phases.
No ADR required — all patterns operate within existing ADR-0001, ADR-0002, ADR-0006.

**Risk Level:** HIGH (score 16)

---

## Artifacts Generated

| Artifact      | Path                                                    | Lines |
| ------------- | ------------------------------------------------------- | ----- |
| plan.md       | `specs/runtime/038-scheduled-exam-engine/plan.md`       | 825   |
| research.md   | `specs/runtime/038-scheduled-exam-engine/research.md`   | 297   |
| data-model.md | `specs/runtime/038-scheduled-exam-engine/data-model.md` | 278   |

---

## Implementation Phases

| Phase                 | Tasks  | Key Deliverables                                                                                |
| --------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| P0: Setup & Schema    | 3      | 2 migration files, updated Drizzle schemas                                                      |
| P1: Domain Core       | 8      | `scheduled-exam/` module — types, errors, hash, time gates, workflow rules, repository, service |
| P2: API Routes        | 12     | 10 Hono handlers, router factory, validation schemas                                            |
| P3: Worker            | 3      | auto-submit worker, tenant dispatcher, queue registration                                       |
| P4: Job Queue Package | 1      | 2 new BaseJob extensions in `packages/job-queue`                                                |
| P5: Tests             | 6      | ~60 scenarios (unit, integration, worker, migration)                                            |
| P6: Validation        | 3      | typecheck, lint, arch:audit                                                                     |
| **Total**             | **36** | —                                                                                               |

---

## Database Schema Changes

### New Table: `scheduled_exams`

- 18 columns including `base_exam_snapshot_hash`, `base_exam_modified`, `deleted_at`
- Indexes: 5 B-tree + 1 CONCURRENT unique on `LOWER(code) WHERE deleted_at IS NULL`
- Migration 016: `20260402_016_create_scheduled_exams.ts`

### Modified Table: `attempts`

- 6 new columns: `is_scheduled`, `scheduled_exam_id`, `scheduled_end_time`, `last_heartbeat_at`, `auto_submitted`, `forced_submission_reason`
- 3 partial B-tree indexes
- Migration 017: `20260402_017_add_scheduled_fields_to_attempts.ts`

---

## API Endpoints Planned (10)

| Method | Path                                                | Actor   |
| ------ | --------------------------------------------------- | ------- |
| POST   | `/api/v1/:workspace/scheduled-exams`                | Admin   |
| GET    | `/api/v1/:workspace/scheduled-exams`                | Admin   |
| GET    | `/api/v1/:workspace/scheduled-exams/:id`            | Admin   |
| PATCH  | `/api/v1/:workspace/scheduled-exams/:id`            | Admin   |
| DELETE | `/api/v1/:workspace/scheduled-exams/:id`            | Admin   |
| POST   | `/api/v1/:workspace/scheduled-exams/:id/workflow`   | Admin   |
| POST   | `/api/v1/:workspace/scheduled-exams/:id/re-approve` | Admin   |
| POST   | `/api/v1/:workspace/scheduled-exams/:id/attempts`   | Student |
| POST   | `/api/v1/:workspace/attempts/:id/heartbeat`         | Student |
| POST   | `/api/v1/:workspace/attempts/:id/submit`            | Student |

---

## Key Architectural Decisions

| #   | Decision                                                                              | Justification                                                                  |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | `pg_try_advisory_xact_lock(hashtext(userId:scheduledExamId))` for single-attempt race | Correct PostgreSQL phantom-row prevention; `SELECT FOR UPDATE` is insufficient |
| 2   | Per-tenant BullMQ dispatcher + per-attempt worker job                                 | Required for database-per-tenant; worker receives `tenantSlug` per job         |
| 3   | Polymorphic `base_exam_id` + `exam_type` validated at app layer only                  | PostgreSQL cannot enforce polymorphic FK natively                              |
| 4   | Late submission returns HTTP 200 with `auto_submitted: true`                          | Student answers preserved; retry safety guaranteed                             |
| 5   | `BASE_EXAM_HASH_FIELDS` constant in `packages/domain-core`                            | Single source of truth for SHA-256 snapshot hash field list                    |

---

## ADR Requirements

**None.** All patterns aligned with existing ADRs:

- ADR-0001: Database-per-tenant isolation enforced
- ADR-0002: Snapshot integrity (base_exam_snapshot_hash)
- ADR-0006: Server-authoritative time

---

## Guardian Verdicts

| Guardian              | Verdict |
| --------------------- | ------- |
| Architecture Guardian | PASS    |
| API Designer          | PASS    |

Both guardians confirmed plan is compliant with tenant isolation, license middleware, error contract, and layering rules.

---

## Next Step

Proceed to Step 4 — Tasks.
