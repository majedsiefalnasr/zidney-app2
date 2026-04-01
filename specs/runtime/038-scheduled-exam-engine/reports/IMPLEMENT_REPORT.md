# Implement Report — Scheduled Exam Engine

**Step:** 6 — Implement  
**Timestamp:** 2025-07-30T18:00:00Z  
**Status:** COMPLETE

---

## Summary

All 40/40 tasks implemented across 6 phases (P0–P5). Implementation covers: database migrations, Drizzle schemas, domain-core package, validation schemas, API route handlers, Redis job queue, worker jobs, and test suites. All governance checks pass: TypeScript 0 errors, Biome lint 0 errors, AI Guard 100%, architecture audit score 100/100.

---

## Inputs Reviewed

- `specs/runtime/038-scheduled-exam-engine/tasks.md`
- `specs/runtime/038-scheduled-exam-engine/plan.md`
- `specs/runtime/038-scheduled-exam-engine/audits/ANALYZE_REPORT.md`

---

## Files Created (33)

| File Path                                                                                      | Change Type | Notes                                                           |
| ---------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------- |
| `apps/api/src/db/tenant/migrations/20260402_016_create_scheduled_exams.ts`                     | Created     | Two-phase: CREATE TABLE + CONCURRENT index                      |
| `apps/api/src/db/tenant/migrations/20260402_017_add_scheduled_fields_to_attempts.ts`           | Created     | 6 columns on attempts + 3 partial indexes                       |
| `apps/api/src/db/tenant/schemas/scheduled-exams.schema.ts`                                     | Created     | Drizzle pgTable with 20 columns                                 |
| `apps/api/src/db/tenant/schemas/attempts.schema.ts`                                            | Created     | Full Drizzle representation of attempts                         |
| `apps/api/src/db/tenant/migrations/__tests__/scheduled-exam-migrations.test.ts`                | Created     | Idempotency test for migrations 016+017                         |
| `packages/domain-core/src/scheduled-exam/scheduled-exam.types.ts`                              | Created     | Domain types and interfaces                                     |
| `packages/domain-core/src/scheduled-exam/scheduled-exam.errors.ts`                             | Created     | 14 error codes + HTTP status map                                |
| `packages/domain-core/src/scheduled-exam/scheduled-exam-hash.ts`                               | Created     | SHA-256 base exam content hash                                  |
| `packages/domain-core/src/scheduled-exam/scheduled-exam-time.ts`                               | Created     | Window/expiry/remaining-seconds helpers                         |
| `packages/domain-core/src/scheduled-exam/scheduled-exam-workflow.ts`                           | Created     | Pure state transition guards                                    |
| `packages/domain-core/src/scheduled-exam/scheduled-exam.repository.ts`                         | Created     | Pure pg query functions (12 queries)                            |
| `packages/domain-core/src/scheduled-exam/scheduled-exam.service.ts`                            | Created     | Business logic + advisory lock + idempotency                    |
| `packages/domain-core/src/scheduled-exam/index.ts`                                             | Created     | Barrel export                                                   |
| `packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-hash.test.ts`                | Created     | 5 hash scenarios                                                |
| `packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-time.test.ts`                | Created     | 10 time/window scenarios                                        |
| `packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-workflow.test.ts`            | Created     | 8 state-transition scenarios                                    |
| `packages/validation/src/backoffice/scheduled-exams.schemas.ts`                                | Created     | createScheduledExam, update, list, workflow, re-approve schemas |
| `apps/api/src/routes/backoffice/scheduled-exams/helpers.ts`                                    | Created     | getDb, buildAuditCtx, successResponse, error mapper             |
| `apps/api/src/routes/backoffice/scheduled-exams/create-scheduled-exam.ts`                      | Created     | POST → 201                                                      |
| `apps/api/src/routes/backoffice/scheduled-exams/list-scheduled-exams.ts`                       | Created     | GET → 200 with pagination                                       |
| `apps/api/src/routes/backoffice/scheduled-exams/get-scheduled-exam.ts`                         | Created     | GET → 200 with attempts_count                                   |
| `apps/api/src/routes/backoffice/scheduled-exams/update-scheduled-exam.ts`                      | Created     | PATCH → 200 (mutability enforced)                               |
| `apps/api/src/routes/backoffice/scheduled-exams/delete-scheduled-exam.ts`                      | Created     | DELETE → 204 (soft delete)                                      |
| `apps/api/src/routes/backoffice/scheduled-exams/workflow-transition.ts`                        | Created     | POST action:ENABLE state machine                                |
| `apps/api/src/routes/backoffice/scheduled-exams/re-approve.ts`                                 | Created     | POST → 200 re-approve after base exam modification              |
| `apps/api/src/routes/backoffice/scheduled-exams/start-attempt.ts`                              | Created     | POST → 201 with pg_try_advisory_xact_lock                       |
| `apps/api/src/routes/backoffice/scheduled-exams/heartbeat.ts`                                  | Created     | POST → 200 with remaining_seconds                               |
| `apps/api/src/routes/backoffice/scheduled-exams/submit-attempt.ts`                             | Created     | POST → 200 idempotent                                           |
| `apps/api/src/routes/backoffice/scheduled-exams/index.ts`                                      | Created     | Router factory createScheduledExamsRouter()                     |
| `apps/api/src/routes/backoffice/scheduled-exams/__tests__/scheduled-exams.integration.test.ts` | Created     | 30+ endpoint + tenant isolation scenarios                       |
| `apps/worker/src/jobs/auto-submit-scheduled-attempt.ts`                                        | Created     | Redis SET NX lock + SELECT FOR UPDATE guard                     |
| `apps/worker/src/jobs/scheduled-exam-dispatcher.ts`                                            | Created     | Per-tenant iteration + reason-code routing                      |
| `apps/worker/tests/unit/auto-submit-scheduled-attempt.test.ts`                                 | Created     | 5 idempotency + lock scenarios                                  |

## Files Modified (7)

| File Path                                     | Change Type | Notes                                                                  |
| --------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| `apps/api/src/app.ts`                         | Modified    | Registered scheduledExamsRouter (T040)                                 |
| `apps/api/src/db/tenant/schemas/index.ts`     | Modified    | Added attempts + scheduled-exams exports                               |
| `apps/worker/src/grading/worker-startup.ts`   | Modified    | Wired dispatcher + shutdown cleanup (T030)                             |
| `packages/domain-core/package.json`           | Modified    | Added ./scheduled-exam export entry                                    |
| `packages/validation/src/backoffice/index.ts` | Modified    | Added scheduled-exams.schemas export                                   |
| `packages/job-queue/src/job-schema.ts`        | Modified    | Added AutoSubmitScheduledAttemptJob + ScheduledExamDispatcherJob types |
| `tsconfig.base.json`                          | Modified    | Added @zidney/domain-core/scheduled-exam path                          |

---

## Tasks Completion

| Task ID | Description                                                                     | Layer      | Status |
| ------- | ------------------------------------------------------------------------------- | ---------- | ------ |
| T001    | Migration 016 — create_scheduled_exams                                          | DB         | ✅     |
| T002    | Migration 017 — add_scheduled_fields_to_attempts                                | DB         | ✅     |
| T003    | scheduled-exams.schema.ts (Drizzle)                                             | DB         | ✅     |
| T004    | attempts.schema.ts (Drizzle)                                                    | DB         | ✅     |
| T005    | Export schemas from schemas/index.ts                                            | DB         | ✅     |
| T006    | scheduled-exam.types.ts                                                         | Domain     | ✅     |
| T007    | scheduled-exam.errors.ts                                                        | Domain     | ✅     |
| T008    | scheduled-exam-hash.ts                                                          | Domain     | ✅     |
| T009    | scheduled-exam-time.ts                                                          | Domain     | ✅     |
| T010    | scheduled-exam-workflow.ts                                                      | Domain     | ✅     |
| T011    | scheduled-exam.repository.ts                                                    | Domain     | ✅     |
| T012    | scheduled-exam.service.ts                                                       | Domain     | ✅     |
| T013    | domain-core barrel export index.ts                                              | Domain     | ✅     |
| T014    | Export ./scheduled-exam from domain-core package.json                           | Domain     | ✅     |
| T015    | scheduled-exams.schemas.ts (Zod validation)                                     | Validation | ✅     |
| T016    | Export from packages/validation/src/backoffice/index.ts                         | Validation | ✅     |
| T017    | helpers.ts                                                                      | API        | ✅     |
| T018    | create-scheduled-exam.ts                                                        | API        | ✅     |
| T019    | list-scheduled-exams.ts                                                         | API        | ✅     |
| T020    | get-scheduled-exam.ts                                                           | API        | ✅     |
| T021    | update-scheduled-exam.ts                                                        | API        | ✅     |
| T022    | delete-scheduled-exam.ts                                                        | API        | ✅     |
| T023    | start-attempt.ts (advisory lock)                                                | API        | ✅     |
| T024    | heartbeat.ts                                                                    | API        | ✅     |
| T025    | submit-attempt.ts (idempotent)                                                  | API        | ✅     |
| T026    | workflow-transition.ts                                                          | API        | ✅     |
| T027    | re-approve.ts                                                                   | API        | ✅     |
| T028    | scheduled-exams/index.ts (router)                                               | API        | ✅     |
| T029    | Register router in app.ts                                                       | API        | ✅     |
| T030    | Add AutoSubmitScheduledAttemptJob + ScheduledExamDispatcherJob to job-schema.ts | JobQueue   | ✅     |
| T031    | auto-submit-scheduled-attempt.ts worker handler                                 | Worker     | ✅     |
| T032    | scheduled-exam-dispatcher.ts worker cron handler                                | Worker     | ✅     |
| T033    | Wire dispatcher in worker-startup.ts                                            | Worker     | ✅     |
| T034    | Unit tests: scheduled-exam-hash.test.ts                                         | Tests      | ✅     |
| T035    | Unit tests: scheduled-exam-time.test.ts                                         | Tests      | ✅     |
| T036    | Unit tests: scheduled-exam-workflow.test.ts                                     | Tests      | ✅     |
| T037    | Integration tests: scheduled-exams.integration.test.ts                          | Tests      | ✅     |
| T038    | Worker test: auto-submit-scheduled-attempt.test.ts                              | Tests      | ✅     |
| T039    | Migration idempotency tests                                                     | Tests      | ✅     |
| T040    | Governance: typecheck + lint + AI guard + arch audit                            | Governance | ✅     |

**Completed:** 40 / 40

---

## Tests Added or Updated

| Test File                                                                                      | Type        | Scope                                                                    |
| ---------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-hash.test.ts`                | Unit        | SHA-256 hash correctness (5 scenarios)                                   |
| `packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-time.test.ts`                | Unit        | Window/expiry/remaining-seconds (10 scenarios)                           |
| `packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-workflow.test.ts`            | Unit        | State transitions, immutable fields (8 scenarios)                        |
| `apps/api/src/routes/backoffice/scheduled-exams/__tests__/scheduled-exams.integration.test.ts` | Integration | All 10 endpoints + cross-tenant isolation (30+ scenarios)                |
| `apps/worker/tests/unit/auto-submit-scheduled-attempt.test.ts`                                 | Unit        | Idempotency, lock contention, concurrent workers, ROLLBACK (5 scenarios) |
| `apps/api/src/db/tenant/migrations/__tests__/scheduled-exam-migrations.test.ts`                | Migration   | Idempotency of migrations 016 and 017                                    |

---

## Architecture Governance Compliance

| Check                                                        | Status | Notes                                                                                                                      |
| ------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | ----- |
| Tenant resolver context used for tenant DB access (ADR-0001) | ✅     | `c.get('db')` via middleware — no direct db instantiation                                                                  |
| All write operations are transactional                       | ✅     | BEGIN/COMMIT in migrations; service methods use tx-scoped queries                                                          |
| Idempotency is enforced where required                       | ✅     | submitAttempt returns HTTP 200 {autoSubmitted:true} on re-submit; auto-submit worker uses Redis SET NX + SELECT FOR UPDATE |
| Structured logging is present                                | ✅     | Logger used in workers and service layer                                                                                   |
| `console.log` is absent                                      | ✅     | No console.log in implementation files                                                                                     |
| No stack traces exposed to clients                           | ✅     | scheduledExamErrorResponse maps to error codes only                                                                        |
| UI layer has no business logic                               | ✅     | No frontend changes in this stage                                                                                          |
| API error contract preserved                                 | ✅     | All responses: `{ success, data, error: { code, message } }`                                                               |
| Trust chain respected                                        | ✅     | Isolation → License → Auth → Attempt → Runtime                                                                             |
| Import boundaries respected                                  | ✅     | apps/api → packages/\*; no circular or cross-app imports                                                                   |
| Architecture guard passed (ai:guard)                         | ✅     | 1670/1670 passed (100%)                                                                                                    |
| Architecture audit passed (arch:audit)                       | ✅     | Score 100/100, 0 violations                                                                                                |
| TypeScript typecheck                                         | ✅     | 0 errors                                                                                                                   |
| Biome lint                                                   | ✅     | 0 errors (post-fix of infra-audit-report.json formatting)                                                                  |
| Advisory lock for concurrent attempt starts                  | ✅     | `pg_try_advisory_xact_lock(hashtext($1                                                                                     |     | ':' |     | $2))` |
| Snapshot integrity (ADR-0002)                                | ✅     | `startScheduledAttempt` calls `createAttempt()` — never raw INSERT                                                         |
| Server-authoritative time (ADR-0006)                         | ✅     | `NOW()` in SQL; no client-side timestamps                                                                                  |

**Overall:** COMPLIANT

---

## Open Risks

- Integration tests (`scheduled-exams.integration.test.ts`) require a test database with migrations 016+017 applied — these will be validated in CI only. Running locally requires `bun run test:integration` with a configured tenant test DB.
- `scheduled-exam-dispatcher.ts` iterates all active tenants from master DB — in environments with many tenants this may need pagination; flagged as a future scalability concern, not a blocker.

---

## Next Step

Proceed to Step 7 — Closure (requires mandatory Pre-Closure Review Gate approval).
