# Analyze Report — STAGE_28 Subjects

**Step:** 5 — Analyze (Drift Detector)
**Timestamp:** 2026-03-20T01:00:00.000Z
**Status:** PASS

---

## Summary

Full structural drift audit, security audit, performance audit, and QA coverage audit completed
against `spec.md`, `plan.md`, `tasks.md`, and `data-model.md`. All 9 constitutional criteria pass.
No cross-tenant joins, no license bypass, no missing transactions, no missing idempotency, no
snapshot integrity failure, no version enforcement gap, no API/Worker authority violation, no
logging deficiency, no security violation.

Three implementation-phase observations are documented (non-blocking, no constitutional violation):

1. **OBS-1**: Three error codes referenced in spec are absent from plan error contract
   (`SUBJECT_DIVISION_DISABLED`, `SUBJECT_MISSING_TRANSLATIONS`, `SUBJECT_INVALID_DEFAULT_LANGUAGE`).
   These are P2/P3 requirements that must be added to `subjects.errors.ts` during T004.

2. **OBS-2**: Spec US-04 uses error name `SUBJECT_ARCHIVED_IMMUTABLE`; plan's error contract uses
   `SUBJECT_ARCHIVED`. The shorter form is consistent with naming convention across other stages.
   Resolution: align to `SUBJECT_ARCHIVED` (already in plan) and update spec's acceptance criteria
   comment during implementation.

3. **OBS-3**: FR-18 (`translation_coverage` must be queryable) is P3 and depends on the translation
   infrastructure from STAGE_19. No translation coverage API surface is planned in STAGE_28. This
   is correctly deferred — the spec notes "Translation storage schema (handled by STAGE_19)".

**Implementation authorized. Observations must be resolved at task T004 (error codes) and T008/T010
(division-disabled guard logic) before route handler tasks begin.**

---

## Inputs Reviewed

- `specs/runtime/028-subjects/spec.md`
- `specs/runtime/028-subjects/plan.md`
- `specs/runtime/028-subjects/tasks.md`
- `specs/runtime/028-subjects/data-model.md`
- `specs/runtime/028-subjects/checklists/requirements.md`
- `specs/runtime/028-subjects/checklists/security.md`
- `specs/runtime/028-subjects/checklists/performance.md`

---

## Violations Detected

None — all 9 constitutional criteria pass.

| #   | Violation Type | Description | Severity | Owner | Remediation |
| --- | -------------- | ----------- | -------- | ----- | ----------- |
| —   | None           | —           | —        | —     | —           |

---

## Observations (Non-Blocking)

| #   | ID    | Domain         | Description                                                                                                                                                            | Resolution                                                                                        |
| --- | ----- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | OBS-1 | Error Contract | `SUBJECT_DIVISION_DISABLED`, `SUBJECT_MISSING_TRANSLATIONS`, `SUBJECT_INVALID_DEFAULT_LANGUAGE` are in spec acceptance criteria but absent from plan error codes table | Add to `subjects.errors.ts` (T004); handle in `createSubject`/`updateSubject` service (T008/T010) |
| 2   | OBS-2 | Error Naming   | US-04 acceptance 8 uses `SUBJECT_ARCHIVED_IMMUTABLE`; plan uses `SUBJECT_ARCHIVED`                                                                                     | Use `SUBJECT_ARCHIVED` (plan convention); acceptable inconsistency — plan naming wins             |
| 3   | OBS-3 | FR-18 P3       | `translation_coverage` queryable field not planned for STAGE_28                                                                                                        | Deferred to downstream stage; correctly out of scope per spec's deferral note                     |

---

## Audit Checklist

| Domain             | Check                                                         | Status | Notes                                                                                                                                     |
| ------------------ | ------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Isolation          | No cross-tenant joins                                         | ✅     | `subjects` is tenant-DB-only; no master DB access; tenant resolver mandatory in middleware chain                                          |
| Isolation          | Tenant resolver required for tenant DB access                 | ✅     | Plan: correlationId → tenantResolver → licenseEnforcement → auth → handler                                                                |
| Isolation          | No row-based multi-tenancy or shared tenant tables            | ✅     | Database-per-tenant; `subjects` table in tenant schema only                                                                               |
| License            | License middleware enforced before tenant DB access           | ✅     | Plan Phase 3: license enforcement before all route handlers; SOFT_LOCKED returns 423                                                      |
| License            | Schema version enforcement present                            | ✅     | T001 bumps schema_version 1.11.0→1.12.0; middleware checks MIN_SCHEMA_VERSION                                                             |
| Transactions       | All write paths transactional                                 | ✅     | T008 createSubject, T010 updateSubject, T011 transitionSubjectStatus, T012 deleteSubject all use BEGIN/COMMIT/ROLLBACK                    |
| Transactions       | ROLLBACK on any error in write transaction                    | ✅     | Plan Phase 0 migration pattern: `try { ... COMMIT } catch { ROLLBACK; throw }` applied to service layer                                   |
| Idempotency        | Replay protection for write operations                        | ✅     | CAS in T011 (`UPDATE ... WHERE status = $expected`; 0 rows → 409); IF NOT EXISTS in T001                                                  |
| Idempotency        | Soft delete safe to replay                                    | ✅     | `softDeleteSubject` only soft-deletes when `deleted_at IS NULL`; re-GET 404 on second attempt                                             |
| Snapshot Integrity | Snapshot immutability preserved                               | N/A    | Feature does not touch attempt/grading/snapshot systems                                                                                   |
| API/Worker         | No grading or async finalization in route handler             | N/A    | Subject CRUD is synchronous; no worker involved                                                                                           |
| Versioning         | schema_version compatibility enforced                         | ✅     | Migration bumps to 1.12.0; license middleware validates MIN before handler                                                                |
| Observability      | Structured logs include `correlation_id` and `workspace_slug` | ✅     | Plan Phase 5: all handlers emit `correlation_id`, `workspace_id`, `workspace_slug`, `user_id`, `subject_id`, `action`                     |
| Observability      | No `console.log` permitted                                    | ✅     | Plan explicitly: "all logging via structured logger with required fields"                                                                 |
| Security           | No tenant override from request body                          | ✅     | Tenant context via middleware only; no request body field accepted for tenant                                                             |
| Security           | Parameterized queries only                                    | ✅     | Plan repository: all queries use `$1, $2` parameter binding; no string interpolation                                                      |
| Security           | No internal stack traces exposed to clients                   | ✅     | `subjectsErrorResponse` handles unknown → 500 INTERNAL_ERROR with no stack trace                                                          |
| Security           | Whitespace-only name prevention                               | ✅     | Zod `refine((s) => s.trim().length > 0)` in T014                                                                                          |
| Security           | Input length caps                                             | ✅     | name: 255, code: 100, description: 2000, default_language: 10 — all enforced in T014                                                      |
| Routing            | Routing authority registry                                    | N/A    | Stage does not modify agent/prompt/template routing authority                                                                             |
| Templates          | Canonical parity                                              | N/A    | Stage does not rewire template consumers                                                                                                  |
| Prompts            | Authoritative prompt surfaces                                 | N/A    | Stage does not modify prompt infrastructure                                                                                               |
| Guidance           | Stale legacy references                                       | N/A    | Stage does not modify governance infrastructure                                                                                           |
| Entrypoints        | Shell/loader path authority                                   | N/A    | Stage does not modify shell scripts or loaders                                                                                            |
| Validation Cadence | Governance suite reruns                                       | N/A    | Stage does not rewire routing                                                                                                             |
| Stage Authority    | Stage-file requirements reflected in analyzed artifacts       | ✅     | All 21 FRs (FR-01 to FR-21) have explicit task coverage; 3 OBS-1/OBS-3 items noted as non-blocking                                        |
| Support Surfaces   | In-scope support surfaces have explicit dispositions          | N/A    | Stage does not touch support surfaces                                                                                                     |
| Protected Surfaces | Protected governance files unchanged                          | ✅     | Only `apps/api/src/app.ts` (route registration), `packages/domain-core/`, `packages/validation/`, and tenant migration files are modified |

---

## FR Coverage Matrix

| Spec Ref | Requirement Summary                   | Plan Coverage                                                 | Task(s)          | Gap?                                                 |
| -------- | ------------------------------------- | ------------------------------------------------------------- | ---------------- | ---------------------------------------------------- |
| FR-01    | Unique name within workspace          | Service: subjectNameExists check in createSubject             | T006, T008, T017 | —                                                    |
| FR-02    | Optional unique code                  | Partial unique index + subjectCodeExists                      | T001, T006, T008 | —                                                    |
| FR-03    | default_language mandatory            | Zod schema: `z.string().min(2).max(10)`                       | T014, T017       | —                                                    |
| FR-04    | Division auto-assign when disabled    | Service: workspace settings check → division_id override      | T008, T017       | OBS-1 (SUBJECT_DIVISION_DISABLED error code missing) |
| FR-05    | Semester must belong to same division | Service: validateSemesterBelongsToDivision                    | T008, T010       | —                                                    |
| FR-06    | Full CRUD                             | 7 route handlers + service functions                          | T007–T022        | —                                                    |
| FR-07    | Soft delete only                      | deleteSubject sets deleted_at                                 | T012, T022       | —                                                    |
| FR-08    | Dependency check registry             | subjectDependencyRegistry (empty at launch)                   | T005, T012       | —                                                    |
| FR-09    | Soft-deleted excluded from queries    | All repository queries: `WHERE deleted_at IS NULL`            | T006             | —                                                    |
| FR-10    | DRAFT→ACTIVE→ARCHIVED machine         | Custom inline state machine in transitionSubjectStatus        | T011             | —                                                    |
| FR-11    | ACTIVE-only for runtime               | GET /subjects/runtime with forced status=ACTIVE               | T018, T023       | —                                                    |
| FR-12    | DRAFT hidden from runtime             | T018 forced status=ACTIVE excludes DRAFT                      | T018             | —                                                    |
| FR-13    | ARCHIVED preserved                    | softDeleteSubject only; ARCHIVED status preserved             | T012             | —                                                    |
| FR-14    | ARCHIVED terminal                     | State machine validation: ARCHIVED→anything = INVALID         | T011, T025       | —                                                    |
| FR-15    | subjects:manage permission            | Phase 3 middleware: RBAC check on all 7 handlers              | T015–T022        | —                                                    |
| FR-16    | Multi-language translations required  | Plan: is_multilanguage flag; translation storage via STAGE_19 | T003, T014       | OBS-1 (SUBJECT_MISSING_TRANSLATIONS missing)         |
| FR-17    | Translation fallback chain            | Plan mentions fallback; logging gap on partial                | T003             | —                                                    |
| FR-18    | Translation coverage queryable        | Deferred to downstream stage                                  | —                | OBS-3 (P3, correctly deferred)                       |
| FR-19    | Runtime enforces status=ACTIVE        | GET /subjects/runtime: status param omitted, ACTIVE forced    | T018             | —                                                    |
| FR-20    | Server-side division/semester filters | Filters applied in service/repository layer only              | T006, T016       | —                                                    |
| FR-21    | Admin can filter by any status        | listSubjectsQuerySchema: optional status enum                 | T014, T016       | —                                                    |

---

## State Machine Audit

The plan defines a **custom inline state machine** (not the global `WorkflowEngine`) consistent with
the academic-structural-entity pattern. The global WorkflowEngine targets
COMPLETED/UNDER_REVIEW/APPROVED/ENABLED — **incompatible** with the DRAFT/ACTIVE/ARCHIVED
academic structure lifecycle.

| Transition            | Valid       | Plan Coverage                   | Test Coverage                      |
| --------------------- | ----------- | ------------------------------- | ---------------------------------- |
| DRAFT → ACTIVE        | ✅          | T011 service                    | T025 unit, T026 integration        |
| ACTIVE → ARCHIVED     | ✅          | T011 service                    | T025 unit, T026 integration        |
| DRAFT → ARCHIVED      | ❌ INVALID  | T011 SUBJECT_INVALID_TRANSITION | T025 unit, T026 integration        |
| ACTIVE → DRAFT        | ❌ INVALID  | T011 SUBJECT_INVALID_TRANSITION | T025 unit, T026 integration        |
| ARCHIVED → anything   | ❌ TERMINAL | T011 SUBJECT_INVALID_TRANSITION | T025 unit, T026 integration        |
| Concurrent transition | 409 CAS     | T011 rowCount=0 check           | T025 unit (mock), T026 integration |

CAS implementation is correct: `UPDATE subjects SET status=$new WHERE id=$id AND status=$expected`.
Zero rows affected → `SUBJECT_TRANSITION_CONFLICT`. No double-application possible.

---

## Security Audit (Guardian: zidney-security-auditor)

| Check                           | Status  | Evidence                                                                                  |
| ------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| SQL injection prevention        | ✅ PASS | All repository queries use parameterized `$1/$2` binding                                  |
| Whitespace-only name rejection  | ✅ PASS | Zod `refine((s) => s.trim().length > 0)` in createSubjectBodySchema                       |
| Description length cap          | ✅ PASS | `MAX_DESCRIPTION_LENGTH = 2000` in Zod schema                                             |
| Code length cap                 | ✅ PASS | `max(100)` in Zod `code` field                                                            |
| UUID parameter validation       | ✅ PASS | `subjectParamsSchema: z.string().uuid()`                                                  |
| No stack trace exposure         | ✅ PASS | `subjectsErrorResponse` handles unknown → 500 INTERNAL_ERROR                              |
| No tenant override from request | ✅ PASS | Tenant context is resolver-only; no request body tenant field                             |
| RBAC check before DB access     | ✅ PASS | `subjects:manage` permission check in middleware before handler                           |
| Cross-tenant isolation          | ✅ PASS | Tenant resolver provides pool; no cross-tenant join possible                              |
| Auth middleware mandatory       | ✅ PASS | Middleware chain: auth before route handler                                               |
| Rate limiting                   | ✅ PASS | Global rate-limit middleware; runtime endpoint: auth/runtime classification (600 req/min) |

**Security Verdict: PASS**

---

## Performance Audit (Guardian: zidney-performance-optimizer)

| Check                                | Status  | Evidence                                                               |
| ------------------------------------ | ------- | ---------------------------------------------------------------------- |
| Compound index (division_id, status) | ✅ PASS | `idx_subjects_division_status` in T001                                 |
| Compound index (semester_id, status) | ✅ PASS | `idx_subjects_semester_status` in T001                                 |
| Status filter index                  | ✅ PASS | `idx_subjects_status WHERE deleted_at IS NULL` in T001                 |
| Soft-delete scan optimization        | ✅ PASS | `idx_subjects_deleted_at` in T001                                      |
| Case-insensitive name uniqueness     | ✅ PASS | Partial functional unique index `LOWER(name)` in T001                  |
| Partial unique index for code        | ✅ PASS | `WHERE code IS NOT NULL AND deleted_at IS NULL` in T001                |
| Max page size enforced               | ✅ PASS | `MAX_LIMIT = 100` in listSubjectsQuerySchema                           |
| NOWAIT for concurrent lock           | ✅ PASS | `SELECT ... FOR UPDATE NOWAIT` in lockSubjectForUpdate; pg 55P03 → 503 |
| Count + list concurrent fetch        | ✅ PASS | `listSubjects` uses `Promise.all([count, find])`                       |
| Pagination offset strategy           | ✅ PASS | Offset-based `page`/`limit` consistent with other academic stages      |

**Performance Verdict: PASS**

---

## QA Engineering Audit (Guardian: zidney-qa-engineer)

| Category                                   | Coverage                                             | Status                      |
| ------------------------------------------ | ---------------------------------------------------- | --------------------------- |
| Unit tests: state machine                  | All 6 transitions + CAS conflict                     | ✅ PASS                     |
| Unit tests: SUBJECT_ARCHIVED guard         | updateSubject + deleteSubject                        | ✅ PASS                     |
| Unit tests: dependency registry empty      | deleteSubject no-deps path                           | ✅ PASS                     |
| Integration: full CRUD lifecycle           | Create→Read→Update→Delete                            | ✅ PASS                     |
| Integration: duplicate name/code           | 409 responses                                        | ✅ PASS                     |
| Integration: runtime endpoint ACTIVE-only  | Seed DRAFT + ARCHIVED, confirm excluded              | ✅ PASS                     |
| Integration: cross-tenant isolation        | Two-tenant parallel fetch                            | ✅ PASS                     |
| Integration: auth/authz                    | 401, 403, 423 scenarios                              | ✅ PASS                     |
| Integration: pagination                    | Default, custom page/limit, beyond total             | ✅ PASS                     |
| Integration: filters                       | status, division_id, semester_id, search             | ✅ PASS                     |
| Integration: workflow transitions          | DRAFT→ACTIVE, ACTIVE→ARCHIVED, ARCHIVED→ACTIVE (422) | ✅ PASS                     |
| Integration: soft delete                   | Delete + re-GET returns 404                          | ✅ PASS                     |
| Integration: schema version mismatch       | 409 SCHEMA_VERSION_MISMATCH                          | ✅ PASS                     |
| Integration: SOFT_LOCKED license           | 423 response                                         | ✅ PASS                     |
| Integration: division-disabled auto-assign | 201 with auto-assigned division_id                   | ✅ PASS                     |
| Missing: concurrent transition conflict    | T026 should include concurrent CAS scenario          | ⚠️ Recommend adding to T026 |

**QA Verdict: PASS** (with recommendation to add concurrent transition scenario to T026)

---

## Code Review Audit (Guardian: zidney-code-reviewer)

| Check                                                  | Status  | Notes                                                                 |
| ------------------------------------------------------ | ------- | --------------------------------------------------------------------- |
| Domain package barrel export pattern                   | ✅ PASS | Plan follows semesters/index.ts pattern                               |
| No Drizzle `references()` for FK (migration-owned FKs) | ✅ PASS | Plan explicitly: FK constraints migration-DDL-only                    |
| No partial functional index in Drizzle `uniqueIndex()` | ✅ PASS | Plan explicitly: partial/functional indexes migration-owned only      |
| Route registration order (static before param)         | ✅ PASS | `/subjects/runtime` declared before `/subjects/:id` in T023           |
| Error response contract shape                          | ✅ PASS | Plan: `{ success, data, error }` for all responses                    |
| No business logic in frontoffice                       | N/A     | Feature is backoffice-only; no frontoffice changes                    |
| pkg→pkg import allowed, app→app forbidden              | ✅ PASS | Subjects package: no apps dependency; app routes import from packages |

**Code Review Verdict: PASS**

---

## Guardian Verdicts

| Guardian                     | Verdict | Key Findings                                                                                |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| zidney-security-auditor      | PASS    | All 11 security checks pass; no SQL injection exposure; whitespace-only name guard in place |
| zidney-performance-optimizer | PASS    | All 10 performance checks pass; compound indexes added for runtime query pattern            |
| zidney-qa-engineer           | PASS    | 15/16 QA categories pass; concurrent transition test scenario recommended for T026          |
| zidney-code-reviewer         | PASS    | Route order, FK ownership, barrel pattern, error contract all correct                       |

---

## Composite Verdict

- Structural audit: ✅ PASS (0 violations)
- Security guardian: ✅ PASS
- Performance guardian: ✅ PASS
- QA guardian: ✅ PASS
- Code review guardian: ✅ PASS

## Final Gate Decision

`PASS — Implementation authorized.`

`drift_passed = true` — all 9 constitutional criteria and all 4 guardian audits return PASS.

**OBS-1 resolution is mandatory before T016–T022 (route handlers) commence:**

- Add `SUBJECT_DIVISION_DISABLED` (422) to `subjects.errors.ts` → T004
- Add `SUBJECT_MISSING_TRANSLATIONS` (422) to `subjects.errors.ts` → T004
- Add `SUBJECT_INVALID_DEFAULT_LANGUAGE` (422) to `subjects.errors.ts` → T004
- Handle `SUBJECT_DIVISION_DISABLED` in `createSubject`/`updateSubject` → T008, T010

---

## Next Step

Proceed to Step 6 — Implement.
