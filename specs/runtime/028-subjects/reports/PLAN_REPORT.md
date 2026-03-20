# Plan Report — Subjects

**Step:** 3 — Plan  
**Timestamp:** 2026-03-20T00:35:00.000Z  
**Status:** COMPLETE

---

## Summary

The technical plan for STAGE_28_SUBJECTS is complete. All implementation layers have been designed
following established codebase patterns from STAGE_27_SEMESTERS (closest predecessor). The plan
covers a forward-only tenant DB migration, Drizzle ORM schema, domain package with custom workflow
state machine (DRAFT→ACTIVE→ARCHIVED), validation schemas, 7 route handlers, and comprehensive
unit + integration test coverage.

The plan addresses all 5 open checklist gaps identified in Step 2 (Clarify): compound indexes for
`(division_id, status)` and `(semester_id, status)`, `MAX_LIMIT = 100` for pagination,
whitespace-only name guard, and `MAX_DESCRIPTION_LENGTH = 2000`.

---

## Inputs Reviewed

- `specs/runtime/028-subjects/spec.md` — 704 lines; 9 user stories; 21 functional requirements
- `specs/runtime/028-subjects/data-model.md` — new document generated in this step
- `specs/runtime/028-subjects/checklists/requirements.md` — 16 items all ✅
- `specs/runtime/028-subjects/checklists/security.md` — 46 items; gaps addressed in plan
- `specs/runtime/028-subjects/checklists/performance.md` — 34 items; gaps addressed in plan
- Reference pattern: `apps/api/src/db/tenant/migrations/20260320_005_semesters.ts`
- Reference pattern: `apps/api/src/db/tenant/schemas/semesters.schema.ts`
- Reference pattern: `packages/domain-core/src/semesters/` (service, repository, types, errors)
- Reference pattern: `packages/validation/src/backoffice/semesters.schemas.ts`
- Reference pattern: `apps/api/src/routes/backoffice/semesters/` (all 5 handlers + helpers)

---

## Architecture Layers Touched

| Layer          | Planned Changes                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| API            | 7 new route handlers under `apps/api/src/routes/backoffice/subjects/`; route registered in `apps/api/src/app.ts` |
| Worker         | None — subjects CRUD is fully synchronous                                                                        |
| Frontend       | None — Backoffice-only; no frontend changes in this stage                                                        |
| DB Master      | None — subjects table is tenant-scoped exclusively                                                               |
| DB Tenant      | New `subjects` table + 8 indexes + 2 partial unique indexes; schema_version `1.11.0` → `1.12.0`                  |
| Domain Package | New `packages/domain-core/src/subjects/` module (5 files + index + dependency registry)                          |
| Validation     | New `packages/validation/src/backoffice/subjects.schemas.ts` (5 schemas)                                         |

---

## Key Technical Decisions

| #   | Decision                                                                                                      | Rationale                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Custom inline state machine (DRAFT→ACTIVE→ARCHIVED) rather than global WorkflowEngine                         | Global engine uses COMPLETED/UNDER_REVIEW/APPROVED/ENABLED states which do not map to subjects' academic lifecycle                   |
| 2   | CAS (Compare-And-Swap) for workflow transitions: `WHERE id=$id AND status=$expected`                          | Zero-rows-affected = 409 SUBJECT_TRANSITION_CONFLICT; no separate `version` column needed                                            |
| 3   | Configurable dependency check registry (starts empty at STAGE_28)                                             | Downstream content stages (MCQ, exams, etc.) register their FK checks additively; no subjects schema change required                 |
| 4   | Partial functional unique index on `LOWER(name) WHERE deleted_at IS NULL` (migration-owned only)              | Drizzle ORM cannot represent partial functional indexes; consistent with divisions, teams, semesters pattern                         |
| 5   | Partial unique index on `code WHERE code IS NOT NULL AND deleted_at IS NULL` (migration-owned)                | Code is optional; NULL values must not trigger uniqueness violations                                                                 |
| 6   | Compound indexes `(division_id, status)` and `(semester_id, status)`                                          | Addresses performance checklist gap; serves primary runtime query: `WHERE division_id=$d AND status='ACTIVE' AND deleted_at IS NULL` |
| 7   | `GET /subjects/runtime` declared before `GET /subjects/:id` in router                                         | Prevents Hono treating literal string `"runtime"` as an `:id` path parameter                                                         |
| 8   | FK constraints on `division_id` and `semester_id` declared in migration DDL only (not Drizzle `references()`) | Avoids Drizzle FK/RESTRICT conflict with partial indexes; consistent with all prior academic stages                                  |
| 9   | `division_id` is nullable at DB level; auto-assigned at application layer when divisions disabled             | Decouples schema from workspace settings toggle; service resolves default division UUID at request time                              |
| 10  | `ARCHIVED` is terminal — no outbound transitions                                                              | Per FR-14 and assumption A-004; ADR required if business requirements change                                                         |

---

## Migration Impact

| Item                  | Value | Notes                                                        |
| --------------------- | ----- | ------------------------------------------------------------ |
| Migration required    | Yes   | `apps/api/src/db/tenant/migrations/20260320_006_subjects.ts` |
| `schema_version` bump | Yes   | `1.11.0` → `1.12.0`                                          |
| Backward compatible   | Yes   | Adds new table only; no existing tables modified             |
| Tables modified       | None  | `divisions` and `semesters` tables untouched                 |
| Downtime risk         | None  | New table creation does not lock existing tables             |
| Rollback supported    | No    | Forward-only per ADR-0008                                    |

---

## Transaction Boundaries

| Operation                         | Transaction                   | Notes                                                            |
| --------------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| `createSubject`                   | YES — `BEGIN/COMMIT/ROLLBACK` | Name + code uniqueness check + INSERT as single atomic unit      |
| `updateSubject`                   | YES — `BEGIN/COMMIT/ROLLBACK` | Lock + uniqueness guards + UPDATE as single atomic unit          |
| `transitionSubjectStatus`         | YES — `BEGIN/COMMIT/ROLLBACK` | Lock + CAS UPDATE as single atomic unit                          |
| `deleteSubject`                   | YES — `BEGIN/COMMIT/ROLLBACK` | Lock + dependency check + `deleted_at` set as single atomic unit |
| `listSubjects` / `getSubjectById` | NO                            | Read-only; snapshot isolation sufficient                         |

---

## Idempotency Strategy

| Operation           | Key                  | Constraint                          | Replay Behaviour                         |
| ------------------- | -------------------- | ----------------------------------- | ---------------------------------------- |
| Create              | `name` per-tenant    | `subjects_name_lower_unique_active` | Duplicate → 409 `SUBJECT_NAME_DUPLICATE` |
| Create with code    | `code` per-tenant    | `subjects_code_unique_non_null`     | Duplicate → 409 `SUBJECT_CODE_DUPLICATE` |
| Workflow transition | `(id, target_state)` | CAS status check                    | Already in target → 200 (safe)           |
| Update              | None                 | Name + code uniqueness checks       | Identical payload → 200 (unchanged row)  |
| Soft delete         | `deleted_at` check   | `deleted_at IS NULL` guard          | Already deleted → 404                    |

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                                                      |
| -------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | `subjects` table in tenant DB only; no cross-tenant joins                                                  |
| All writes are transactional by design | ✅     | `BEGIN/COMMIT/ROLLBACK` in every write operation                                                           |
| Server-authoritative time enforced     | ✅     | `created_at`, `updated_at`, `deleted_at` set by `NOW()` / `DEFAULT NOW()`                                  |
| License middleware enforced            | ✅     | All 7 routes in middleware chain: tenantResolver → licenseEnforcement                                      |
| Version compatibility enforced         | ✅     | `schema_version 1.12.0` checked by license middleware per Constitution rule                                |
| No architecture redesign without ADR   | ✅     | Custom subjects state machine is an inline decision consistent with existing patterns; no new ADR required |
| No direct DB instantiation             | ✅     | All DB access via `c.get('tenant').pool` from tenant resolver context                                      |
| No business logic in frontend          | ✅     | All subject visibility, workflow, and filtering enforced at API layer                                      |
| No worker involvement                  | ✅     | Fully synchronous CRUD; no background jobs                                                                 |
| Soft-delete only                       | ✅     | Hard delete forbidden; `deleted_at` pattern followed                                                       |

**Overall:** COMPLIANT
