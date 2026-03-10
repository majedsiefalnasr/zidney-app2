# Implement Report — TRANSLATION_SYSTEM

**Step:** 6 — Implement  
**Timestamp:** 2026-03-01T20:48:00Z  
**Status:** COMPLETE

---

## Summary

All 28 tasks for the TRANSLATION_SYSTEM stage have been implemented and validated. The
implementation covers the full translation lifecycle: translatable-field registry, error contract,
core domain service, coverage service with Redis caching, tenant-scoped repository, API route
handlers (upsert, list, coverage), workspace-settings language removal integration (sync + async
DRAIN path), worker job handler, and a comprehensive test suite (72 unit tests + 4 integration test
files).

No tasks were deferred.

---

## Inputs Reviewed

- `specs/runtime/019-translation-system/tasks.md` — 28/28 tasks completed
- `specs/runtime/019-translation-system/plan.md`
- `specs/runtime/019-translation-system/audits/VALIDATION_REPORT.md`

---

## Files Modified

| File Path                                                                   | Change Type | Notes                                     |
| --------------------------------------------------------------------------- | ----------- | ----------------------------------------- |
| `packages/domain-core/src/translation/translatable-fields.ts`               | Created     | T001: Entity-field registry               |
| `packages/domain-core/src/translation/translation.types.ts`                 | Created     | T002: Type definitions                    |
| `packages/domain-core/src/translation/translation.errors.ts`                | Created     | T003: Error contract + factory            |
| `packages/domain-core/src/translation/translation.service.ts`               | Created     | T007: Core domain service                 |
| `packages/domain-core/src/translation/coverage.service.ts`                  | Created     | T008: Coverage + cache service            |
| `packages/domain-core/src/index.ts`                                         | Modified    | T009: Export translation domain           |
| `packages/types/src/job-envelope.ts`                                        | Modified    | T019: DRAIN job types                     |
| `apps/api/src/db/tenant/migrations/20260301_001_translation_system.ts`      | Created     | T004: DB migration                        |
| `apps/api/src/db/tenant/schemas/translations.schema.ts`                     | Created     | T005: Schema types                        |
| `apps/api/src/db/tenant/schemas/translation-audit-logs.schema.ts`           | Created     | T006: Audit schema types                  |
| `apps/api/src/modules/translation/translation.repository.ts`                | Created     | T010: Repository layer                    |
| `apps/api/src/modules/translation/translation.context.ts`                   | Created     | T011: Context builder                     |
| `apps/api/src/modules/translation/translation.validation.ts`                | Created     | T012: Request validation schemas          |
| `apps/api/src/routes/backoffice/translations/post-upsert.ts`                | Created     | T013: POST /translations                  |
| `apps/api/src/routes/backoffice/translations/get-translations.ts`           | Created     | T014: GET /translations                   |
| `apps/api/src/routes/backoffice/translations/get-coverage.ts`               | Created     | T015: GET /translations/coverage          |
| `apps/api/src/routes/backoffice/translations/index.ts`                      | Created     | T016: Router registration                 |
| `apps/api/src/app.ts`                                                       | Modified    | T017: Mount translation routes            |
| `apps/api/src/modules/workspace-settings/workspace-settings.types.ts`       | Modified    | T018: Language status types               |
| `apps/api/src/modules/workspace-settings/workspace-settings.validation.ts`  | Modified    | T018: Language removal validation         |
| `apps/api/src/modules/workspace-settings/workspace-settings.errors.ts`      | Modified    | T018: Language removal error codes        |
| `apps/api/src/modules/workspace-settings/workspace-settings.service.ts`     | Modified    | T018: Language removal sync/async         |
| `apps/api/src/modules/workspace-settings/workspace-settings.routes.ts`      | Modified    | T018: Language removal route              |
| `apps/worker/src/jobs/drain-language-translations.ts`                       | Created     | T020: DRAIN worker job handler            |
| `tests/unit/translation/translatable-fields.test.ts`                        | Created     | T021: Unit tests                          |
| `tests/unit/translation/translation-service.test.ts`                        | Created     | T022: Unit tests                          |
| `tests/unit/translation/coverage-service.test.ts`                           | Created     | T023: Unit tests                          |
| `tests/unit/translation/drain-language-translations.test.ts`                | Created     | T028: Unit tests                          |
| `tests/integration/translation/translations-upsert.test.ts`                 | Created     | T024: Integration tests                   |
| `tests/integration/translation/translations-list.test.ts`                   | Created     | T025: Integration tests                   |
| `tests/integration/translation/translations-coverage.test.ts`               | Created     | T026: Integration tests                   |
| `tests/integration/translation/workspace-settings-language-removal.test.ts` | Created     | T027: Integration tests                   |
| `vitest.config.ts`                                                          | Modified    | Added `zod` module alias for worker tests |

---

## Tasks Completion

| Task ID | Description                                                     | Layer  | Status |
| ------- | --------------------------------------------------------------- | ------ | ------ |
| T001    | Translatable-fields registry                                    | Domain | ✅     |
| T002    | Translation type definitions                                    | Domain | ✅     |
| T003    | Error contract + factory functions                              | Domain | ✅     |
| T004    | DB migration — translations + audit tables                      | DB     | ✅     |
| T005    | translations schema types                                       | DB     | ✅     |
| T006    | translation_audit_logs schema types                             | DB     | ✅     |
| T007    | Core domain service (upsert, list, delete, audit)               | Domain | ✅     |
| T008    | Coverage service + Redis SCAN invalidation                      | Domain | ✅     |
| T009    | Export translation domain from domain-core                      | Domain | ✅     |
| T010    | Translation repository (tenant-scoped)                          | API    | ✅     |
| T011    | Translation context builder                                     | API    | ✅     |
| T012    | Request validation schemas                                      | API    | ✅     |
| T013    | POST /translations route handler                                | API    | ✅     |
| T014    | GET /translations route handler                                 | API    | ✅     |
| T015    | GET /translations/coverage route handler                        | API    | ✅     |
| T016    | Translation router index                                        | API    | ✅     |
| T017    | Mount translation routes in app.ts                              | API    | ✅     |
| T018    | Workspace-settings language removal (sync + async)              | API    | ✅     |
| T019    | DRAIN job type definitions                                      | Types  | ✅     |
| T020    | DRAIN worker job handler                                        | Worker | ✅     |
| T021    | Unit tests — translatable-fields.test.ts                        | Tests  | ✅     |
| T022    | Unit tests — translation-service.test.ts                        | Tests  | ✅     |
| T023    | Unit tests — coverage-service.test.ts                           | Tests  | ✅     |
| T024    | Integration tests — translations-upsert.test.ts                 | Tests  | ✅     |
| T025    | Integration tests — translations-list.test.ts                   | Tests  | ✅     |
| T026    | Integration tests — translations-coverage.test.ts               | Tests  | ✅     |
| T027    | Integration tests — workspace-settings-language-removal.test.ts | Tests  | ✅     |
| T028    | Unit tests — drain-language-translations.test.ts                | Tests  | ✅     |

**Completed:** 28 / 28

---

## Tests Added or Updated

| Test File                                                                   | Type        | Scope                                    |
| --------------------------------------------------------------------------- | ----------- | ---------------------------------------- |
| `tests/unit/translation/translatable-fields.test.ts`                        | Unit        | Field registry, error factory — 25 tests |
| `tests/unit/translation/translation-service.test.ts`                        | Unit        | Domain service — 20 tests                |
| `tests/unit/translation/coverage-service.test.ts`                           | Unit        | Coverage + cache — 19 tests              |
| `tests/unit/translation/drain-language-translations.test.ts`                | Unit        | Worker batch drain — 14 tests            |
| `tests/integration/translation/translations-upsert.test.ts`                 | Integration | POST /translations API flow              |
| `tests/integration/translation/translations-list.test.ts`                   | Integration | GET /translations API flow               |
| `tests/integration/translation/translations-coverage.test.ts`               | Integration | GET /translations/coverage API flow      |
| `tests/integration/translation/workspace-settings-language-removal.test.ts` | Integration | Language removal sync/async paths        |

---

## Constitutional Compliance

| Check                                             | Status | Notes                                                    |
| ------------------------------------------------- | ------ | -------------------------------------------------------- |
| Tenant resolver context used for tenant DB access | ✅     | `buildTranslationContext` resolves tenant via middleware |
| All write operations are transactional            | ✅     | upsert, delete, audit all within transactions            |
| Idempotency is enforced where required            | ✅     | `ON CONFLICT DO UPDATE`, DRAIN re-entrant                |
| Structured logging is present                     | ✅     | `createLogger` used; `console.log` absent                |
| `console.log` is absent                           | ✅     | Verified across all new files                            |
| No stack traces exposed to clients                | ✅     | Error responses use TRANSLATION_ERROR_CODES              |
| UI layer has no business logic                    | ✅     | UI layer untouched                                       |
| API error contract is preserved                   | ✅     | `{ success, data, error: { code, message } }`            |
| Server-authoritative time (ADR-0006)              | ✅     | All timestamps use `NOW()`                               |
| Database-per-tenant isolation                     | ✅     | All DB access via tenant pool only                       |
| Worker finalizes async operations                 | ✅     | DRAIN worker handles language removal cleanup            |
| Redis SCAN (never KEYS)                           | ✅     | `invalidateWorkspaceCoverage` uses cursor-based SCAN     |

**Overall:** COMPLIANT

---

## Open Risks

None. All tasks completed without deferral.

---

## Next Step

Proceed to Pre-Closure Review Gate → Step 7 — Closure.
