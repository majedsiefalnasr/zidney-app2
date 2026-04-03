# Analyze Report — Stage 41: Staff Management

**Stage**: `STAGE_41_STAFF_MANAGEMENT`
**Phase**: `03_BACKOFFICE_CORE / 05_USER_MANAGEMENT`
**Branch**: `spec/041-staff-management`
**Analyzed At**: 2026-04-03T15:05:00Z
**Verdict**: ✅ APPROVED — All 9 drift criteria passed

---

## Structural Drift Audit

### Target Path Verification

All implementation target paths verified clear (no pre-existing files):

| Target Path                                                          | Status                              |
| -------------------------------------------------------------------- | ----------------------------------- |
| `apps/api/src/routes/backoffice/staff/`                              | ✅ CLEAR — directory does not exist |
| `packages/domain-core/src/staff/`                                    | ✅ CLEAR — directory does not exist |
| `packages/domain-core/src/auth/staff-password.ts`                    | ✅ CLEAR — file does not exist      |
| `packages/validation/src/staff.schema.ts`                            | ✅ CLEAR — file does not exist      |
| `apps/api/src/db/tenant/migrations/20260404_020_staff_management.ts` | ✅ CLEAR — file does not exist      |

### Pre-existing Codebase State

| Component                                             | Finding                                                               | Assessment                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/api/src/routes/backoffice/users.ts` (449 lines) | EXISTS — `backofficeUsersRouter` defined but NOT imported in `app.ts` | ✅ Dead code — safe to delete per T027                                          |
| `apps/api/src/routes/auth/backoffice-login.ts`        | EXISTS — queries `FROM users` table with bcrypt                       | ✅ Needs update per plan — T026                                                 |
| `packages/domain-core/src/auth/password.ts`           | EXISTS — bcrypt `verifyPassword`, `generateDummyHash`                 | ✅ Must NOT be modified — staff uses separate `staff-password.ts`               |
| `packages/validation/src/index.ts`                    | Has `staffDepartmentsParamsSchema`, `staffDivisionsParamsSchema`      | ✅ Pre-existing unrelated schemas from Divisions/Departments stages — NOT drift |
| `backoffice_staff_users` Drizzle schema               | `password_hash: varchar(72)` — needs TEXT for Argon2id                | ✅ Addressed by migration T002 + schema update T003                             |
| `PermissionModule.USERS`                              | Already defined in `roles.ts`                                         | ✅ Available for RBAC guard registration — no changes needed                    |

---

## Criteria Audit (9/9)

### 1 — Tenant Isolation ✅ PASS

All repository queries in plan include `workspace_id` in WHERE clauses:

- `findStaffById(workspaceId, id)` — enforced
- `listStaff(workspaceId, query)` — enforced
- `insertStaff(workspaceId, input)` — enforced
- `updateStaff(workspaceId, id, input)` — enforced
- `softDeleteStaff(workspaceId, id)` — enforced
- `countActiveStaff(workspaceId)` — enforced (license limit check)

No cross-tenant joins introduced. `UNIQUE(workspace_id, email)` constraint preserved.

### 2 — Migration Safety ✅ PASS

- Filename: `20260404_020_staff_management.ts` — follows `YYYYMMDD_NNN_description.ts` pattern
- Sequence: Immediately follows `20260404_019_grading_core.ts` — no gaps
- Schema transition: `1.25.0 → 1.26.0` — single increment
- Pattern: Single transaction with `BEGIN/COMMIT/ROLLBACK` — forward-only
- Operations: `ALTER COLUMN`, `ADD COLUMN`, `UPDATE` backfill, `CREATE TABLE` — all reversible-safe (no destructive drops)
- No existing migration file modified

### 3 — License Middleware ✅ PASS

- License middleware enforced on all staff routes via parent router inheritance
- `staff_limit` available via `c.get('staff_limit')` in `BackofficeVariables`
- `createStaff` service checks `countActiveStaff(workspaceId) >= staff_limit` → throws `STAFF_LIMIT_EXCEEDED` (403) before insert
- All routes use `createPermissionGuard(logger, PermissionModule.USERS, action)` — no bypass

### 4 — No Architecture Violation ✅ PASS

- Database-per-tenant preserved — all DB access through injected `DbClient`
- No global DB singleton introduced
- No cross-app imports (`packages/*` → `apps/*` forbidden — plan complies)
- No business logic in UI layer (frontend not touched)
- Worker not involved — no async job required for synchronous CRUD

### 5 — Snapshot Integrity ✅ PASS (Not Applicable)

Stage 41 does not touch the exam attempt engine. No snapshot, no grading, no worker finalization path.

### 6 — Transaction Boundaries ✅ PASS

- `createStaff` service: single transaction `BEGIN` → license check → insert → `COMMIT/ROLLBACK`
- Migration: single transaction wrapping all DDL + DML
- All write operations use transactional patterns

### 7 — Idempotency Strategy ✅ PASS

- Create: `INSERT ... RETURNING` with (workspace_id, email) UNIQUE constraint — duplicate produces `STAFF_EMAIL_CONFLICT` (409), not data corruption
- Update: SELECT for existence check → UPDATE with optimistic lock on `updated_at` — 404 on missing
- Delete: Hard DELETE with WHERE workspace_id + id — safe to call once
- Enable/Disable: Checked transitions — `STAFF_ALREADY_ACTIVE` / `STAFF_ALREADY_DISABLED` (409) prevent double-processing

### 8 — Logging & Observability ✅ PASS

- All route handlers use `createLogger(name)` from `@zidney/logger`
- No `console.log` anywhere in plan
- Correlation ID propagated via `c.get('correlationId')` in context
- Audit log events: `staff_created`, `staff_updated`, `staff_disabled`, `staff_enabled`, `staff_deleted`
- `password_hash` never logged — explicit redaction per existing `redaction.ts` middleware

### 9 — Error Contract ✅ PASS

All endpoints return `{ success: boolean, data: object | null, error: { code, message } | null }`:

- `StaffError.code` mapped to HTTP status via `STAFF_ERROR_HTTP` record
- Standard error codes: `STAFF_NOT_FOUND (404)`, `STAFF_EMAIL_CONFLICT (409)`, `STAFF_LIMIT_EXCEEDED (403)`, `STAFF_ALREADY_DISABLED (409)`, `STAFF_ALREADY_ACTIVE (409)`, `STAFF_HAS_AUTHORED_CONTENT (409)`
- Unexpected errors: 500 with sanitized message (no stack traces to client)

---

## Guardian Verdicts

| Guardian              | Verdict | Notes                                                                                                          |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| Architecture Guardian | ✅ PASS | No new modules, no import boundary violations, tenant isolation preserved                                      |
| Security Auditor      | ✅ PASS | Argon2id (mem=64MiB, t=3, p=4), no `password_hash` in responses, timing-attack dummy hash, brute-force lockout |
| Performance Optimizer | ✅ PASS | Keyset pagination on (created_at, id), composite index on (workspace_id, email), indexed role_id FK            |
| QA Engineer           | ✅ PASS | 3 test files planned: CRUD, tenant isolation, license limit; 34 atomic tasks                                   |

**Composite Verdict**: ✅ APPROVED — ALL CRITERIA PASS

---

## Final Gate

```text
Implementation: AUTHORIZED
drift_passed: true
```

All 9 drift criteria passed. No violations detected. Implementation gate is open.
