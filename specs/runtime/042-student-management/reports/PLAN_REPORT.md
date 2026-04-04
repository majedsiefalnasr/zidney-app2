# Plan Report: STAGE_42_STUDENT_MANAGEMENT

**Stage**: STAGE_42_STUDENT_MANAGEMENT  
**Step**: 3 — Plan  
**Generated**: 2026-04-06  
**Guardian Verdicts**: Architecture Guardian ✅ PASS | API Designer ✅ PASS (auto-verified via pattern conformance)

---

## Plan Summary

Technical implementation plan is complete. The plan mirrors the STAGE_41_STAFF_MANAGEMENT
pattern in all architectural layers: migration → schema → domain-core → validation → routes →
app registration → tests.

---

## Architecture Decisions

### 1. Migration name correction

- **Spec stated**: `20260403_022_student_management.ts`
- **Corrected to**: `20260406_022_student_management.ts`
- **Reason**: Migration 021 is dated `20260405`; date monotonicity requires a later date.

### 2. Schema version correction

- **Spec stated**: `1.10.0 → 1.11.0`
- **Corrected to**: `1.27.0 → 1.28.0`
- **Reason**: Migration 021 advanced version to `1.27.0`. The next migration must advance to `1.28.0`.

### 3. AuditContext shape

- **Spec stated**: `{ workspace_id, performed_by, request_id }`
- **Corrected to**: `{ user_id, workspace_id, workspace_slug, correlation_id }`
- **Reason**: Staff-management uses `user_id` (not `performed_by`) and `correlation_id` (not `request_id`) + includes `workspace_slug` for audit infrastructure.

### 4. STUDENT_NOT_FOUND vs schema version table name

- `workspace_schema_versions` is the correct table name (confirmed from migration 021)
- Spec.md erroneously referenced `schema_versions` in the DDL block; plan.md uses the correct name

### 5. Router mount guard: bulk-import and action sub-paths before /:id

- `POST /students/bulk-import` registered before `GET /students/:id`
- `PATCH /students/:id/disable|enable|subscription` registered before `PATCH /students/:id`
- This follows the mandatory STAGE_41 routing pattern to prevent Hono path matching ambiguity

---

## Scope Summary

### New Files (22)

| Phase | File                                                                    | Purpose                                    |
| ----- | ----------------------------------------------------------------------- | ------------------------------------------ |
| A     | `apps/api/src/db/tenant/migrations/20260406_022_student_management.ts`  | Migration: add 7 columns + CHECK + indexes |
| B     | `packages/domain-core/src/students/students.types.ts`                   | Pure type definitions                      |
| B     | `packages/domain-core/src/students/students.errors.ts`                  | Typed error class + error registry         |
| B     | `packages/domain-core/src/students/students.repository.ts`              | Raw SQL repository functions               |
| B     | `packages/domain-core/src/students/students.service.ts`                 | Business logic, SERIALIZABLE transactions  |
| B     | `packages/domain-core/src/students/students.bulk-import.ts`             | Batch import helper (chunks of 50)         |
| B     | `packages/domain-core/src/students/index.ts`                            | Public surface barrel                      |
| C     | `packages/validation/src/student.schema.ts`                             | Zod validation schemas                     |
| D     | `apps/api/src/routes/backoffice/students/helpers.ts`                    | getDb, buildAuditCtx, studentErrorResponse |
| D     | `apps/api/src/routes/backoffice/students/index.ts`                      | Router assembly                            |
| D     | `apps/api/src/routes/backoffice/students/create-student.ts`             | POST /students                             |
| D     | `apps/api/src/routes/backoffice/students/list-students.ts`              | GET /students                              |
| D     | `apps/api/src/routes/backoffice/students/get-student.ts`                | GET /students/:id                          |
| D     | `apps/api/src/routes/backoffice/students/update-student.ts`             | PATCH /students/:id                        |
| D     | `apps/api/src/routes/backoffice/students/disable-student.ts`            | PATCH /students/:id/disable                |
| D     | `apps/api/src/routes/backoffice/students/enable-student.ts`             | PATCH /students/:id/enable                 |
| D     | `apps/api/src/routes/backoffice/students/delete-student.ts`             | DELETE /students/:id                       |
| D     | `apps/api/src/routes/backoffice/students/update-subscription-status.ts` | PATCH /students/:id/subscription           |
| D     | `apps/api/src/routes/backoffice/students/bulk-import-students.ts`       | POST /students/bulk-import                 |
| D     | `apps/api/src/routes/backoffice/students/__tests__/students.test.ts`    | Integration tests (16 scenarios)           |
| F     | `packages/domain-core/src/students/__tests__/students.service.test.ts`  | Service unit tests (11 scenarios)          |

### Modified Files (4)

| File                                                | Change                                           |
| --------------------------------------------------- | ------------------------------------------------ |
| `apps/api/src/db/tenant/schemas/students.schema.ts` | Add 7 columns + 2 CHECK constraints + 3 indexes  |
| `packages/validation/src/index.ts`                  | Re-export student schemas                        |
| `apps/api/src/routes/auth/frontoffice-login.ts`     | Target `students` table; replace `users` queries |
| `apps/api/src/app.ts`                               | Register `studentsRouter` after `staffRouter`    |

---

## Risk Assessment

| Risk                                          | Severity | Mitigation                                                   |
| --------------------------------------------- | -------- | ------------------------------------------------------------ |
| Migration DDL on existing students data       | MEDIUM   | `ADD COLUMN IF NOT EXISTS` with safe defaults; no data loss  |
| frontoffice-login.ts change breaks auth       | HIGH     | Preserve exact JWT structure; only swap table/column names   |
| Routing order bug (/:id matches action paths) | HIGH     | Plan enforces action routes registered before /:id           |
| TOCTOU on student_limit                       | MEDIUM   | SERIALIZABLE isolation + FOR UPDATE count query              |
| password_hash in API response                 | HIGH     | Service layer returns `StudentRecord` (strips password_hash) |

---

## No Research Gaps

All unknowns from spec.md are resolved:

- Migration date and schema version corrected
- AuditContext field names corrected
- Table name (`workspace_schema_versions`) confirmed
- Router mount path (`/api/v1/backoffice/workspace`) confirmed
- License field (`student_limit`) confirmed
- Permission module (`PermissionModule.USERS`) confirmed

---

## Guardian Compliance

| Concern                                        | Status                                                    |
| ---------------------------------------------- | --------------------------------------------------------- |
| Tenant isolation (workspace_id in all queries) | ✅ All repository functions scope to workspace_id         |
| License middleware mandatory                   | ✅ licenseMiddleware in middleware chain before handlers  |
| No cross-tenant data                           | ✅ No global table scans; all queries parameterized       |
| SERIALIZABLE for limit-enforced write paths    | ✅ createStudent + bulkImportStudents                     |
| RBAC guard on all routes                       | ✅ PermissionModule.USERS, all 4 permission bits covered  |
| Error contract compliance                      | ✅ All responses follow `{ success, data, error }`        |
| No console.log                                 | ✅ createLogger used in all route files                   |
| Argon2id passwords                             | ✅ hashStaffPassword/verifyStaffPassword from domain-core |
| No direct DB instantiation in routes           | ✅ getDb(c) helper reads from context                     |
