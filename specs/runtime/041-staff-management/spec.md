# Feature Specification: Staff Management

**Feature Branch**: `spec/041-staff-management`
**Stage**: `STAGE_41_STAFF_MANAGEMENT`
**Phase**: `03_BACKOFFICE_CORE / 05_USER_MANAGEMENT`
**Created**: 2026-04-03
**Status**: DRAFT
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/05_USER_MANAGEMENT/STAGE_41_STAFF_MANAGEMENT.md`

---

## Feature Overview

This stage implements full Backoffice Staff lifecycle management within the Zidney tenant scope.
Staff users are workspace-scoped Backoffice accounts stored exclusively in the tenant database.

**What is being built:**

- A `status` VARCHAR(20) column on `backoffice_staff_users` (normalizing the `is_active` boolean
  into an `ACTIVE | DISABLED` enum for Stage 41 and beyond).
- A `staff_hierarchy_levels` join table enabling many-to-many staff-to-hierarchy-node assignment.
- Migration of `password_hash` column from `varchar(72)` to `text` to accommodate Argon2id hashes.
- Domain-core `staff` module (`packages/domain-core/src/staff/`) with Argon2id password hashing,
  license-limit enforcement, audit logging, and service layer business logic.
- Validation schemas in `packages/validation/src/staff.schema.ts`.
- Staff API router at `apps/api/src/routes/backoffice/staff/` providing full CRUD and status
  management:
  - `POST /staff` — Create staff (with transactional license-limit check)
  - `GET /staff` — List staff (paginated, filterable by status and division)
  - `GET /staff/:id` — Get one staff record
  - `PATCH /staff/:id` — Update name/email
  - `PATCH /staff/:id/disable` — Disable account (token invalidation, session revocation)
  - `PATCH /staff/:id/enable` — Re-enable a disabled account
  - `DELETE /staff/:id` — Transactional deletion with assignment cleanup
- Update `apps/api/src/routes/auth/backoffice-login.ts` to query `backoffice_staff_users` (correct
  table) with Argon2id password verification and `status` column check—replacing legacy raw-SQL
  queries against the old `users` table.
- Registration of `staffRouter` in `apps/api/src/app.ts`.
- Replacement of the dead-code `apps/api/src/routes/backoffice/users.ts` with the new staff router.

**Phase & Stage mapping:** Phase 03 Backoffice Core, User Management subdomain. All prior join
table stages (22 Divisions, 23 Departments, 24 Groups, 25 Hierarchy, 26 Teams) must already be
stable; this stage binds staff to those structures.

**Affected system areas:**

| Area                | Affected? | Notes                                                                       |
| ------------------- | --------- | --------------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | All tables are exclusively in tenant DB; no shared staff data               |
| License Enforcement | Yes       | `staff_limit` enforced transactionally on every staff creation              |
| Attempt Engine      | No        | Staff management does not touch snapshots or grading logic                  |
| Worker              | No        | All staff CRUD is synchronous; no async jobs introduced                     |
| Runtime             | No        | Staff is a Backoffice configuration concept; no exam runtime effect         |
| Frontoffice         | No        | Students are not affected by this stage                                     |
| Auth (Backoffice)   | Yes       | Login route updated to use `backoffice_staff_users` + Argon2id verification |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution**.

| Rule                                   | Compliance                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| No cross-tenant access                 | ✓ All tables reside exclusively within the tenant DB; `workspace_id` scopes every query    |
| No middleware bypass                   | ✓ Tenant resolver → license middleware → RBAC guard are mandatory before every staff route |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                          |
| No direct DB instantiation             | ✓ All DB access via `c.get('tenantDb')` — no pool or client constructed outside resolver   |
| No weakening of snapshot integrity     | ✓ Feature does not touch attempt snapshots                                                 |
| No weakening of transaction boundaries | ✓ Create, delete, and disable/enable are fully transactional; rollback on any failure      |
| No weakening of version enforcement    | ✓ Migration bumps `schema_version`; runtime rejects incompatible tenants                   |
| Server-authoritative time only         | ✓ `created_at` / `updated_at` set by PostgreSQL `NOW()`; client time never trusted         |
| No console.log allowed                 | ✓ All logging via `createLogger(name)` from `@zidney/logger`                               |
| Argon2id for staff passwords           | ✓ New `staff-password.ts` in `domain-core/auth/` uses `argon2` (argon2id variant)          |

No exceptions requiring an ADR were detected for this stage.

---

## Isolation Impact Analysis

- **Database accessed:** Tenant DB only. Resolved per workspace slug/subdomain context via the
  existing tenant resolver middleware.
- **Master DB access:** Only within the license limit check (`createUserWithLimitCheck` in
  `packages/domain-core/src/license/transaction-wrapper.ts`) — reads the `licenses` row with
  `SELECT FOR UPDATE` for atomic limit enforcement. No master DB access for CRUD reads/updates.
- **Tenant resolution:** Via existing tenant resolver middleware; all route handlers receive
  `c.get('tenantDb')` and `c.get('workspaceId')`.
- **Connection pool:** Obtained from the tenant-scoped connection pool map; no global singleton.
- **Resolver middleware:** Mandatory — no handler may access the DB before tenant and license
  validation.
- **Tables introduced or modified:**

  | Table                    | Operation | Notes                                                   |
  | ------------------------ | --------- | ------------------------------------------------------- |
  | `backoffice_staff_users` | ALTER     | ADD `status` VARCHAR(20), ALTER `password_hash` to TEXT |
  | `staff_hierarchy_levels` | CREATE    | New join table — staff × hierarchy_nodes many-to-many   |
  | `_schema_versions`       | UPDATE    | `schema_version` bumped `1.25.0 → 1.26.0`               |

**Confirmed:** No shared tenant data. No cross-tenant joins. `workspace_id` is derived from the
resolved tenant context, never from the request body.

---

## License & Version Enforcement

- **License middleware required:** Yes — all staff API routes require an active workspace license.
- **Allowed license states:**
  - `ACTIVE` → proceed
  - `SOFT_LOCKED` → 423 Locked
  - `ARCHIVED` → 403 Forbidden
  - `NOT_FOUND` → 404 Not Found
- **Staff limit enforcement required:** Yes — `staff_limit` from the workspace license is enforced
  transactionally during staff creation using `createUserWithLimitCheck` (already implemented in
  `packages/domain-core/src/license/transaction-wrapper.ts`).
  - Limit applies to total registered staff (any status), not concurrent active sessions.
  - Limit check uses a `SELECT FOR UPDATE` on the `licenses` row (SERIALIZABLE isolation) to
    prevent TOCTOU races.
  - If limit exceeded → 403 `STAFF_LIMIT_EXCEEDED`.
- **`schema_version` checked:** Yes — migration increments the version; runtime rejects
  incompatible tenants.
- **`product_version` checked:** Yes — enforced at the request boundary.

---

## Data Model Changes

### Migration: `apps/api/src/db/tenant/migrations/20260404_020_staff_management.ts`

**Schema version:** `1.25.0 → 1.26.0`

#### 1. ALTER `backoffice_staff_users`

```sql
-- Add status column (normalized from is_active boolean)
ALTER TABLE backoffice_staff_users
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CONSTRAINT bsu_status_check CHECK (status IN ('ACTIVE', 'DISABLED'));

-- Backfill status from is_active
UPDATE backoffice_staff_users
  SET status = CASE WHEN is_active THEN 'ACTIVE' ELSE 'DISABLED' END;

-- Widen password_hash to TEXT for Argon2id hashes (argon2id output ~95+ chars, exceeds varchar(72))
ALTER TABLE backoffice_staff_users
  ALTER COLUMN password_hash TYPE TEXT;

-- Index for status-filtered list queries
CREATE INDEX idx_bsu_status ON backoffice_staff_users (workspace_id, status);
```

**Note:** `is_active` column is NOT removed in this stage. It will be synchronized by the service
layer (set `is_active = false` when `status = 'DISABLED'`, `is_active = true` when
`status = 'ACTIVE'`). Removal of `is_active` is deferred to a future cleanup migration once all
dependent code is updated.

#### 2. CREATE `staff_hierarchy_levels`

```sql
CREATE TABLE IF NOT EXISTS staff_hierarchy_levels (
  staff_id          UUID  NOT NULL,
  hierarchy_node_id UUID  NOT NULL,
  workspace_id      UUID  NOT NULL,
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT staff_hierarchy_levels_pkey
    PRIMARY KEY (staff_id, hierarchy_node_id),
  CONSTRAINT staff_hierarchy_levels_staff_fkey
    FOREIGN KEY (staff_id) REFERENCES backoffice_staff_users(id) ON DELETE CASCADE,
  CONSTRAINT staff_hierarchy_levels_node_fkey
    FOREIGN KEY (hierarchy_node_id) REFERENCES hierarchy_nodes(id) ON DELETE CASCADE
);

CREATE INDEX idx_shl_staff_id ON staff_hierarchy_levels (staff_id);
CREATE INDEX idx_shl_node_id  ON staff_hierarchy_levels (hierarchy_node_id);
```

#### 3. Schema Version Bump

```sql
UPDATE _schema_versions SET version = '1.26.0' WHERE name = 'schema_version';
```

### Drizzle Schema Files

| File                                                              | Change                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts` | ADD `status` text enum column, change `password_hash` to text |
| `apps/api/src/db/tenant/schemas/staff-hierarchy-levels.schema.ts` | NEW — join table Drizzle pgTable definition                   |
| `apps/api/src/db/tenant/schemas/index.ts`                         | Export `staffHierarchyLevels`                                 |

### Backward Compatibility

- `is_active` column retained — all existing middleware that reads `is_active` continues to work.
- `division_ids` UUID array retained — not the primary source for Stage 41 operations (join table
  is authoritative), but kept for backward compatibility with upstream code.
- `password_hash varchar(72) → text` is backward-compatible (existing bcrypt hashes are shorter
  than `text` max).

---

## API Endpoints

**Base path:** `/api/v1/backoffice/workspace` (same as all other backoffice routes)
**RBAC module:** `USERS`
**RBAC middleware:** `createPermissionGuard(logger, PermissionModule.USERS, action)`

### Endpoint Catalogue

| Method | Path                 | Permission | Description                                           |
| ------ | -------------------- | ---------- | ----------------------------------------------------- |
| POST   | `/staff`             | can_create | Create a new staff account with license limit guard   |
| GET    | `/staff`             | can_view   | List staff (paginated, filterable)                    |
| GET    | `/staff/:id`         | can_view   | Get a single staff record                             |
| PATCH  | `/staff/:id`         | can_edit   | Update name and/or email                              |
| PATCH  | `/staff/:id/disable` | can_edit   | Disable account; invalidate all active sessions       |
| PATCH  | `/staff/:id/enable`  | can_edit   | Re-enable a disabled staff account                    |
| DELETE | `/staff/:id`         | can_delete | Transactionally delete staff and clean up assignments |

**Out of scope (already implemented):**

- `PATCH /staff/:userId/role` — exists in `apps/api/src/routes/backoffice/roles.ts`
- Division assignment routes — in `apps/api/src/routes/backoffice/divisions/`
- Department / group / team assignment routes — in their respective route directories

### Request / Response Contracts

#### POST /staff

```text
Request body:  { email: string, name: string, password: string, role_id: string (uuid) }
Success (201): { success: true, data: StaffRecord, error: null }
Errors:        400 VALIDATION_ERROR | 409 STAFF_EMAIL_CONFLICT | 403 STAFF_LIMIT_EXCEEDED |
               403 ROLE_NOT_FOUND | 503 DB_ERROR
```

#### GET /staff

```text
Query params:  page? (default 1), limit? (default 20, max 100), status? (ACTIVE|INACTIVE|SUSPENDED),
               division_id? (UUID), search? (name/email substring)
Success (200): { success: true, data: { items: StaffRecord[], total: number, page: number,
               limit: number }, error: null }
```

#### GET /staff/:id

```text
Path params:   id (UUID)
Success (200): { success: true, data: StaffRecord, error: null }
Errors:        404 STAFF_NOT_FOUND
```

#### PUT /staff/:id

```text
Request body:  { name?: string, email?: string } (at least one required)
Success (200): { success: true, data: StaffRecord, error: null }
Errors:        400 VALIDATION_ERROR | 404 STAFF_NOT_FOUND | 409 STAFF_EMAIL_CONFLICT
```

#### PATCH /staff/:id/disable

```text
No body required.
Success (200): { success: true, data: StaffRecord, error: null }
Effects:       status = INACTIVE, is_active = false, token_version++ (invalidates JWT)
Errors:        404 STAFF_NOT_FOUND | 409 STAFF_ALREADY_DISABLED
```

#### PATCH /staff/:id/enable

```text
No body required.
Success (200): { success: true, data: { id: string, status: "ACTIVE" }, error: null }
Effects:       status = ACTIVE, is_active = true
Errors:        404 STAFF_NOT_FOUND | 409 STAFF_ALREADY_ACTIVE
```

#### DELETE /staff/:id

```text
No body required.
Success (200): { success: true, data: null, error: null }
Effects:       Soft delete — sets status = 'INACTIVE', is_active = false.
               Blocks if staff has authored content (exams, questions).
Errors:        404 STAFF_NOT_FOUND | 409 STAFF_HAS_AUTHORED_CONTENT (if content check fails)
Note:          Use /disable to revoke access without removing the record.
```

**StaffRecord shape (never includes password_hash):**

```typescript
{
  id: string;
  workspace_id: string;
  email: string;
  name: string;
  role_id: string | null;
  status: "ACTIVE" | "DISABLED";
  token_version: number;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}
```

---

## New & Modified Architecture Components

### `packages/domain-core/src/staff/` (NEW)

```
packages/domain-core/src/staff/
  ├── index.ts                — re-exports
  ├── staff.types.ts          — TypeScript interfaces (StaffRecord, CreateStaffInput, etc.)
  ├── staff.repository.ts     — Drizzle ORM queries (tenant DB only)
  ├── staff.service.ts        — business logic (create, update, status, delete)
  └── staff.errors.ts         — error codes and typed error classes
```

**`packages/domain-core/src/index.ts`** — Add:

```typescript
export * as staff from "./staff";
```

### `packages/domain-core/src/auth/staff-password.ts` (NEW)

Argon2id-based hash and verify functions for backoffice staff passwords.

```typescript
import * as argon2 from "argon2";

export async function hashStaffPassword(plaintext: string): Promise<string>;
export async function verifyStaffPassword(hash: string, plaintext: string): Promise<boolean>;
```

**Parameters:** `argon2id`, `memoryCost: 65536` (64 MiB), `timeCost: 3`, `parallelism: 4`.

### `packages/validation/src/staff.schema.ts` (NEW)

```typescript
export const createStaffBodySchema; // email, name, password, role_id
export const updateStaffBodySchema; // name?, email? (min 1 field)
export const staffListQuerySchema; // page?, limit?, status?, division_id?, search?
export const staffIdParamsSchema; // id (UUID)
```

Exported from `packages/validation/src/index.ts`.

### `apps/api/src/routes/backoffice/staff/` (NEW directory)

```
apps/api/src/routes/backoffice/staff/
  ├── index.ts                — Hono router composition
  ├── create-staff.ts
  ├── list-staff.ts
  ├── get-staff.ts
  ├── update-staff.ts
  ├── disable-staff.ts
  ├── enable-staff.ts
  ├── delete-staff.ts
  └── __tests__/
      ├── staff.crud.test.ts
      ├── staff.isolation.test.ts
      └── staff.limit.test.ts
```

### `apps/api/src/routes/auth/backoffice-login.ts` (MODIFY)

Current state: queries `FROM users` (wrong legacy table) with bcrypt `verifyPassword`.

Changes:

- Update SQL to query `FROM backoffice_staff_users WHERE email = $1 AND workspace_id = $2`
- Replace `verifyPassword` with `verifyStaffPassword` (Argon2id)
- Replace `is_active` check with `status = 'ACTIVE'` check
- Token version lookup unchanged

### `apps/api/src/routes/backoffice/users.ts` (DELETE / REPLACE)

This 449-line file is dead code:

- NOT registered in `apps/api/src/app.ts`
- Queries wrong `users` table
- Uses raw SQL instead of Drizzle ORM

Stage 41 deletes this file. The functionality is replaced by the new `staff/` directory.

### `apps/api/src/app.ts` (MODIFY)

Register the new staff router:

```typescript
import { staffRouter } from "./routes/backoffice/staff";
// ... existing registrations ...
app.route("/api/v1/backoffice/workspace", staffRouter);
```

---

## Transaction Boundaries

| Operation        | Transaction Required | Boundary                                                                                        |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| Create staff     | Yes — SERIALIZABLE   | License limit check (SELECT FOR UPDATE on licenses) → insert backoffice_staff_users → audit log |
| Update staff     | Yes — READ COMMITTED | Update row + audit log atomically                                                               |
| Disable staff    | Yes — READ COMMITTED | SET status + increment token_version + audit log                                                |
| Enable staff     | Yes — READ COMMITTED | SET status + audit log                                                                          |
| Delete staff     | Yes — READ COMMITTED | Remove from all 5 assignment tables → delete user → audit log                                   |
| List / Get staff | No                   | Read-only; no transaction needed                                                                |

**Failure handling:** Any transaction that rolls back returns the appropriate 4xx/5xx HTTP code.
The client receives a JSON error response per the error contract.

**Idempotency notes:**

- `POST /staff`: Email uniqueness constraint prevents duplicate creation.
- `PATCH /staff/:id/disable`: Guard against double-disable with 409 `STAFF_ALREADY_DISABLED`.
- `DELETE /staff/:id`: Not idempotent — second call returns 404 `STAFF_NOT_FOUND`.

---

## Authoritative Time Usage

- All `created_at` / `updated_at` columns default to `NOW()` in PostgreSQL.
- `assigned_at` in `staff_hierarchy_levels` defaults to `NOW()` in PostgreSQL.
- Audit log `timestamp` field set by the server via `new Date().toISOString()` — never from client.
- No client-supplied timestamps accepted.

---

## Idempotency Strategy

| Endpoint                 | Idempotency Mechanism                                       |
| ------------------------ | ----------------------------------------------------------- |
| POST /staff              | Unique constraint `(workspace_id, email)` → 409 on retry    |
| PATCH /staff/:id         | Last-write-wins; safe to retry (same payload = same result) |
| PATCH /staff/:id/disable | Check current status first; 409 if already DISABLED         |
| PATCH /staff/:id/enable  | Check current status first; 409 if already ACTIVE           |
| DELETE /staff/:id        | 404 on second call — delete is not idempotent               |

---

## Observability Requirements

All route handlers use `createLogger('backoffice-staff')`.

**Structured log fields (every log entry):**

- `correlation_id` — from `c.get('correlationId')`
- `workspace_id` — from `c.get('workspaceId')`
- `staff_id` — present for /staff/:id routes
- `action` — e.g. `staff.create`, `staff.disable`, `staff.delete`
- `result` — `success | failure`
- `error_code` — on failure

**Audit log (per action) written to `audit_logs` in tenant DB:**

```typescript
{
  staff_id: string; // acting staff (from JWT)
  workspace_id: string;
  request_id: string; // correlation_id
  action_type: string; // 'staff.create' | 'staff.update' | 'staff.disable' | ...
  target_entity: string; // 'backoffice_staff_users'
  target_id: string; // target staff UUID
  metadata: object; // relevant changed fields (no password_hash)
}
```

Audit log is written co-transactionally with the mutation (same DB transaction).

---

## Rate Limiting & Abuse Protection

- Staff routes are classified as **authenticated admin** routes.
- Rate limiting follows the existing backoffice route policy (`X-RateLimit-*` headers).
- Password hashing (Argon2id with memoryCost 65536, timeCost 3) provides inherent timing
  resistance on login.
- Dummy hash computation at login for non-existent users (carried over from current login route)
  prevents email enumeration.

---

## Layer Separation Confirmation

| Layer       | Confirmed Rule                                                               |
| ----------- | ---------------------------------------------------------------------------- |
| UI          | No business logic in Vue components; staff data consumed via API client only |
| API         | Route handlers delegate all business logic to `@zidney/domain-core/staff`    |
| Domain-core | Pure functions only; no Hono Context dependency; no HTTP import              |
| Worker      | Not involved in this stage                                                   |
| DB          | Drizzle ORM queries in repository layer; no ad-hoc SQL in route handlers     |

---

## Failure Modes & Recovery

| Scenario                           | Behavior                                                      |
| ---------------------------------- | ------------------------------------------------------------- |
| DB unavailable at create           | Rollback; return 503 `DB_UNAVAILABLE`                         |
| License count query times out      | Rollback; return 503 `LICENSE_CHECK_TIMEOUT`                  |
| Duplicate email on create          | Unique constraint violation → 409 `STAFF_EMAIL_CONFLICT`      |
| Role not found on create           | FK check at service layer → 403 `ROLE_NOT_FOUND`              |
| Staff limit exceeded               | Rollback; return 403 `STAFF_LIMIT_EXCEEDED`                   |
| Assignment cleanup fails on delete | Rollback entire delete transaction; staff record preserved    |
| Argon2 hash fails                  | Return 503 `HASH_ERROR`; plaintext never logged               |
| Version mismatch                   | License middleware rejects with 426 `SCHEMA_VERSION_MISMATCH` |

---

## Test Strategy

| Layer             | Test Type               | Coverage Target                                                          |
| ----------------- | ----------------------- | ------------------------------------------------------------------------ |
| Domain-core staff | Unit tests              | Service functions, hash/verify, limit logic, status transitions          |
| API — CRUD        | Integration tests       | All 7 endpoints; success + all error paths                               |
| API — Isolation   | Tenant isolation tests  | `workspace_id` never leaked; cross-tenant access blocked                 |
| API — Limit       | License limit tests     | Concurrent creates respecting `staff_limit`; TOCTOU prevention           |
| Migration         | Migration rollback test | `up()` applies cleanly; `down()` throws per ADR-0002                     |
| Login (updated)   | Integration tests       | Argon2id verify works; status=DISABLED blocks login; ACTIVE allows login |

---

## Error Contract

All API responses follow the standard Zidney error contract:

```json
{ "success": boolean, "data": object | null, "error": { "code": "ERROR_CODE", "message": "..." } | null }
```

**Error code registry for this stage:**

| Code                         | HTTP Status | Condition                                          |
| ---------------------------- | ----------- | -------------------------------------------------- |
| `VALIDATION_ERROR`           | 400         | Zod schema failure on request body/query           |
| `STAFF_NOT_FOUND`            | 404         | Staff ID not found in workspace                    |
| `STAFF_EMAIL_CONFLICT`       | 409         | Email already in use within tenant                 |
| `STAFF_LIMIT_EXCEEDED`       | 403         | `staff_limit` from license reached                 |
| `STAFF_ALREADY_DISABLED`     | 409         | Attempt to disable an already-disabled account     |
| `STAFF_ALREADY_ACTIVE`       | 409         | Attempt to enable an already-active account        |
| `STAFF_HAS_AUTHORED_CONTENT` | 409         | Hard delete blocked by authored content dependency |
| `ROLE_NOT_FOUND`             | 403         | `role_id` does not exist in workspace              |
| `HASH_ERROR`                 | 503         | Argon2id hash operation failed                     |
| `DB_UNAVAILABLE`             | 503         | Database transaction failed                        |

---

## Explicit Non-Goals

- **Role assignment** (`PATCH /staff/:userId/role`) — already implemented in `roles.ts` (Stage 21).
- **Division assignment** routes — already implemented in Stage 22.
- **Department/group/team assignment** routes — already implemented in Stages 23/24/26.
- **Removing `is_active` column** — deferred to a future cleanup stage.
- **Removing `division_ids` array** from `backoffice_staff_users` — deferred to a future stage.
- **Frontoffice or student auth** — not affected by this stage.
- **Password reset / change-password flow** — out of scope; handled by separate auth stage.
- **Bulk staff import** — out of scope for Stage 41.

---

## Clarifications

### Session 2026-04-03

**Q1: Should `is_active` be removed in this migration?**
A: No. Stage 41 adds `status` and backfills it, but `is_active` is retained for backward
compatibility with existing middleware code (e.g., `backoffice-permission-guard-v2`). The service
layer keeps both columns synchronized. Removal is a future cleanup.

**Q2: Should Stage 41 update `backoffice-login.ts` to use `backoffice_staff_users`?**
A: Yes — this is mandatory. The existing login route queries the `users` table (legacy Stage 3
artifact) with bcrypt. Since all staff created via Stage 41 will be in `backoffice_staff_users`
with Argon2id hashes, the login route MUST be updated in this stage or staff will be unable to
log in. Login update is IN SCOPE for Stage 41.

**Q3: Which password hashing algorithm for staff passwords — Argon2id or bcrypt?**
A: Argon2id as explicitly stated in the stage spec. A new
`packages/domain-core/src/auth/staff-password.ts` file is added. The existing
`packages/domain-core/src/auth/password.ts` (bcrypt-based) is NOT changed — it continues to serve
other auth flows.

**Q4: Should `division_ids` UUID array be removed from `backoffice_staff_users`?**
A: No, not in Stage 41. The stage spec says "No division_id column directly in users table" (no
single FK column), which is already satisfied (the `division_ids` array is a denormalized cache, not
a direct FK). Stage 41 operations use the `staff_divisions` join table as the authoritative source.
Removal of the array requires a separate cleanup migration.

**Q5: Should `apps/api/src/routes/backoffice/users.ts` (dead code) be deleted?**
A: Yes. It is not registered in `app.ts`, queries the wrong table, and uses ad-hoc SQL violating
module boundaries. Stage 41 deletes it and replaces its intended functionality with the new
`apps/api/src/routes/backoffice/staff/` directory.

---

## Final Architecture Governance Statement

Compliant with Zidney Architecture Governance (AGENTS.md + ADRs) — No violations detected.

- **ADR-0001 (Database-per-tenant):** All tables in tenant DB; `workspace_id` scoped; no shared data.
- **ADR-0002 (Snapshot Immutability):** Migration `down()` throws; forward-only per policy.
- **ADR-0006 (Server-authoritative time):** All timestamps via PostgreSQL `NOW()`.
- **ADR-0007/0008 (Version enforcement):** Schema version bumped `1.25.0 → 1.26.0`.
- **Import boundaries:** `apps/api` → `packages/domain-core`, `packages/validation` only.
  No `packages/*` → `apps/*` imports.
- **No middleware bypass:** Tenant resolver → license middleware → RBAC guard on all routes.
- **No console.log:** `createLogger()` throughout.
- **Response contract:** All endpoints follow `{ success, data, error }` shape.
