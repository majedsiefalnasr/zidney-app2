# Specify Report: Student Management

**Stage**: STAGE_42_STUDENT_MANAGEMENT
**Step**: 1 — Specify
**Completed**: 2026-04-03
**Branch**: `spec/042-student-management`
**Phase**: 03_BACKOFFICE_CORE / 05_USER_MANAGEMENT

---

## Summary

The specification for Stage 42 Student Management has been authored based on a complete
codebase archaeology of the existing students table, staff management patterns (Stage 41),
frontoffice login routes, and tenant migration history.

---

## Feature Snapshot

| Dimension          | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| Feature Name       | Student Management                                          |
| Domain             | Backoffice → User Management                                |
| Tenant Layer       | Tenant DB only                                              |
| Auth Impact        | Frontoffice login migrated from `users` to `students` table |
| License Impact     | `student_limit` enforced on every create / bulk-import      |
| Schema Version     | 1.10.0 → 1.11.0                                             |
| Migration Sequence | 022                                                         |
| Migration File     | `20260403_022_student_management.ts`                        |
| New Files          | ~20                                                         |
| Modified Files     | 5                                                           |

---

## Schema Gap Found

The existing `students` table in the tenant DB was created by migration 004
(`004-create-core-application-tables.sql`) as a minimal structure:

- id, external_id, email, first_name, last_name
- division_id (FK), department_id (FK), group_id (FK), semester_id (FK)
- created_at, updated_at

**Missing columns that Stage 42 must add:**

| Column                | Type                                  | Required               |
| --------------------- | ------------------------------------- | ---------------------- |
| `phone`               | VARCHAR(50) NULL                      | Optional contact       |
| `password_hash`       | TEXT NOT NULL DEFAULT ''              | Argon2id credential    |
| `subscription_status` | VARCHAR(20) NOT NULL DEFAULT 'NONE'   | ACTIVE\|EXPIRED\|NONE  |
| `status`              | VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' | ACTIVE\|DISABLED       |
| `token_version`       | INTEGER NOT NULL DEFAULT 0            | JWT invalidation       |
| `failed_login_count`  | INTEGER NOT NULL DEFAULT 0            | Brute-force protection |
| `locked_until`        | TIMESTAMPTZ NULL                      | Account lock expiry    |

---

## Frontoffice Auth Gap Found

`apps/api/src/routes/auth/frontoffice-login.ts` currently queries the legacy `users` table:

```sql
SELECT id, email, password_hash, token_version, locked_until, role
FROM users
WHERE email = $1 AND role = 'student'
FOR UPDATE
```

This must be migrated to query the `students` table after the 022 migration adds the required
columns. The `users` table will no longer be the source of truth for student authentication.

All `UPDATE users` statements in `frontoffice-login.ts` (for account lock updates,
failed_login_count increments) must also be updated to target `students`.

---

## Files Affected

### New Files (to be created)

| File                                                                    | Purpose                                  |
| ----------------------------------------------------------------------- | ---------------------------------------- |
| `apps/api/src/db/tenant/migrations/20260403_022_student_management.ts`  | Migration: add columns to students table |
| `packages/domain-core/src/students/students.types.ts`                   | Domain types                             |
| `packages/domain-core/src/students/students.errors.ts`                  | Typed error class                        |
| `packages/domain-core/src/students/students.repository.ts`              | Raw SQL repository                       |
| `packages/domain-core/src/students/students.service.ts`                 | Business logic                           |
| `packages/domain-core/src/students/students.bulk-import.ts`             | Bulk import logic                        |
| `packages/domain-core/src/students/index.ts`                            | Public re-exports                        |
| `packages/validation/src/student.schema.ts`                             | Zod validation schemas                   |
| `apps/api/src/routes/backoffice/students/index.ts`                      | Hono router assembly                     |
| `apps/api/src/routes/backoffice/students/create-student.ts`             | Route handler                            |
| `apps/api/src/routes/backoffice/students/list-students.ts`              | Route handler                            |
| `apps/api/src/routes/backoffice/students/get-student.ts`                | Route handler                            |
| `apps/api/src/routes/backoffice/students/update-student.ts`             | Route handler                            |
| `apps/api/src/routes/backoffice/students/disable-student.ts`            | Route handler                            |
| `apps/api/src/routes/backoffice/students/enable-student.ts`             | Route handler                            |
| `apps/api/src/routes/backoffice/students/delete-student.ts`             | Route handler                            |
| `apps/api/src/routes/backoffice/students/update-subscription-status.ts` | Route handler                            |
| `apps/api/src/routes/backoffice/students/bulk-import-students.ts`       | Route handler                            |
| `apps/api/src/routes/backoffice/students/__tests__/students.test.ts`    | Integration tests                        |
| `packages/domain-core/src/students/__tests__/students.service.test.ts`  | Unit tests                               |

### Modified Files

| File                                                | Change                                           |
| --------------------------------------------------- | ------------------------------------------------ |
| `apps/api/src/db/tenant/schemas/students.schema.ts` | Add 7 new columns + indexes                      |
| `apps/api/src/routes/auth/frontoffice-login.ts`     | Query `students` table; update all auth SQL      |
| `apps/api/src/app.ts`                               | Register `studentsRouter`                        |
| `apps/api/src/db/tenant/schemas/index.ts`           | Verify students export is current                |
| `packages/domain-core/src/index.ts`                 | Export students module (if not already exported) |

---

## Constitutional Compliance

All constitutional rules verified at specification time:

| Rule                          | Status  | Notes                                              |
| ----------------------------- | ------- | -------------------------------------------------- |
| Database-per-tenant isolation | ✅ Pass | All student data in tenant DB exclusively          |
| License middleware mandatory  | ✅ Pass | student_limit check on every create                |
| No direct DB instantiation    | ✅ Pass | DbClient interface; getTenantPool via context      |
| Argon2id passwords            | ✅ Pass | hashStaffPassword utility reused                   |
| Server-authoritative time     | ✅ Pass | PostgreSQL NOW() only                              |
| Transactional writes          | ✅ Pass | SERIALIZABLE for create/bulk-import/disable/delete |
| No attempt engine changes     | ✅ Pass | Out of scope                                       |
| No worker involvement         | ✅ Pass | All operations synchronous                         |
| No console.log                | ✅ Pass | createLogger('students') throughout                |
| Error contract                | ✅ Pass | { success, data, error } format defined            |

---

## Risk Assessment

| Risk                                             | Level  | Mitigation                                            |
| ------------------------------------------------ | ------ | ----------------------------------------------------- |
| frontoffice-login migration breaks existing auth | MEDIUM | Full auth test suite; no users table removal          |
| Empty password_hash for existing rows            | LOW    | Default '' prevents login until admin sets password   |
| Bulk import limit race condition                 | MEDIUM | SERIALIZABLE isolation per batch prevents race        |
| Division validation performance                  | LOW    | Index on division_id already exists                   |
| student_limit enforcement correctness            | MEDIUM | SELECT FOR UPDATE + SERIALIZABLE; same as staff model |

**Overall Risk Level**: MEDIUM

---

## Patterns Reference

Stage 42 follows the exact same patterns established in:

- **Stage 41** (Staff Management): `packages/domain-core/src/staff/` as reference module
- **Stage 22-27** (Academic hierarchy): `division_id`, `department_id`, `group_id`, `semester_id` FK patterns
- **Migration 021**: Template for migration file format and schema_version update

---

## Next Step

No [NEEDS CLARIFICATION] markers remain. Clarifications section is pre-populated in spec.md
with the 5 key architectural decisions made during specification. The feature is ready for
the Clarify step.

Artifacts:

- `specs/runtime/042-student-management/spec.md` ✅
- `specs/runtime/042-student-management/checklists/requirements.md` ✅
