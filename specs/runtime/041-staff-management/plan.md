# Implementation Plan — Stage 41: Staff Management

**Stage**: `STAGE_41_STAFF_MANAGEMENT`  
**Phase**: `03_BACKOFFICE_CORE`  
**Plan Date**: 2026-04-03  
**Branch**: `spec/041-staff-management`  
**Schema Transition**: `1.25.0 → 1.26.0`  
**Next Migration**: `20260404_020_staff_management.ts`

---

## 1. Executive Summary

This stage delivers full backoffice staff lifecycle management across 7 secure RBAC-guarded API
endpoints, a new Argon2id password module, a typed domain-core staff service, and an updated login
route that migrates from the legacy `users` table to `backoffice_staff_users`.

### Deliverables

| Category   | Deliverable                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------- |
| DB         | Migration `20260404_020_staff_management.ts` (schema 1.25.0 → 1.26.0)                              |
| DB         | Drizzle schema updates: `backoffice-staff-users.schema.ts`, new `staff-hierarchy-levels.schema.ts` |
| Domain     | `packages/domain-core/src/staff/` — 5 files (types, errors, repository, service, index)            |
| Domain     | `packages/domain-core/src/auth/staff-password.ts` — Argon2id hash/verify/dummy                     |
| Validation | `packages/validation/src/staff.schema.ts` — 4 Zod schemas                                          |
| API        | `apps/api/src/routes/backoffice/staff/` — 8 route handlers + index + 3 test files                  |
| API        | Updated `backoffice-login.ts` — queries `backoffice_staff_users`, uses Argon2id verify             |
| API        | Updated `app.ts` — registers `staffRouter`                                                         |
| Cleanup    | Delete `apps/api/src/routes/backoffice/users.ts` (dead code, 449 lines)                            |
| Tests      | 3 test files: crud, isolation, limit                                                               |

---

## 2. Prerequisites

Before any implementation begins:

| Prerequisite                                        | Status           | Action                             |
| --------------------------------------------------- | ---------------- | ---------------------------------- |
| Branch `spec/041-staff-management`                  | ✅ exists        | —                                  |
| Migration `20260404_019_grading_core.ts` exists     | ✅ confirmed     | —                                  |
| Schema version `1.25.0` active in tenant DBs        | ✅ confirmed     | —                                  |
| `argon2` npm package in `apps/api`                  | ❌ not installed | `bun add argon2` inside `apps/api` |
| No existing `apps/api/src/routes/backoffice/staff/` | ✅ confirmed     | create new directory               |
| No existing `packages/domain-core/src/staff/`       | ✅ confirmed     | create new directory               |

---

## 3. Critical Architecture Decisions

### 3.1 — Login Column Gap Resolution

**Problem**: `backoffice-login.ts` currently queries `FROM users` with columns
`locked_until`, `failed_login_count`, `last_login`, `is_deleted`, `role` (string).
`backoffice_staff_users` has none of these extra columns.

**Decision**: Add the missing brute-force protection columns to `backoffice_staff_users` in the
Stage 41 migration. This preserves the existing security posture (5-attempt lock, 5-minute timeout)
on the new table.

Columns to ADD to `backoffice_staff_users`:

- `failed_login_count INT NOT NULL DEFAULT 0`
- `locked_until TIMESTAMPTZ NULL`
- `last_login TIMESTAMPTZ NULL`

### 3.2 — Role Name for JWT Claims

**Problem**: `signBackofficeToken` requires `role: 'ADMIN' | 'INSTRUCTOR' | 'STAFF'` (a string),
but `backoffice_staff_users` only has `role_id UUID FK → backoffice_roles`.

**Decision**: The updated login query JOINs `backoffice_roles` to fetch `br.name AS role_name`
for the JWT claim. The role name column in `backoffice_roles` contains the role string value
(e.g., `'ADMIN'`, `'INSTRUCTOR'`, `'STAFF'`) typed to match the JWT handler constraint.

### 3.3 — Argon2id Dummy Hash

**Problem**: After switching the login route to use `verifyStaffPassword`, the timing-attack
dummy hash must also be an Argon2id-format hash, not the existing bcrypt dummy from `password.ts`.

**Decision**: `staff-password.ts` exports `generateStaffDummyHash(): string` which returns a
**pre-computed constant** Argon2id hash string for timing attack prevention. It never calls
`argon2.hash()` synchronously at request time — it returns a literal string constant that was
pre-generated once.

### 3.4 — staff.repository.ts Implementation Strategy

**Decision**: `staff.repository.ts` uses raw SQL via injected `DbClient` (same structural type as
`pg.Pool`), consistent with all other domain-core service files (divisions, teams, groups, etc.).
The Drizzle schema files (`backoffice-staff-users.schema.ts`) define the table structure for
tooling and type inference, but actual runtime queries use `db.query(sql, params)`.

### 3.5 — status / is_active Synchronization

**Decision**: Both `status` and `is_active` are maintained in sync by all service functions:

- `status = 'ACTIVE'` ↔ `is_active = true`
- `status = 'INACTIVE'` ↔ `is_active = false`

This is a backward-compatibility requirement documented in CLA-001. Services always write both
columns together in a single UPDATE statement.

### 3.6 — division_ids Column Strategy

**Decision** (CLA-004): `division_ids uuid[]` on `backoffice_staff_users` is used as-is for
storing division membership. The `staff_hierarchy_levels` join table is used separately for
hierarchy node assignments. No migration to a normalized join table for `division_ids` in Stage 41.

---

## 4. Implementation Groups

Implementation proceeds in strict dependency order:

```text
GROUP A: Package Install
  └── install argon2 in apps/api

GROUP B: Database Layer (Foundation)
  ├── B1: Write migration 20260404_020_staff_management.ts
  └── B2: Update Drizzle schemas (backoffice-staff-users, staff-hierarchy-levels, index)

GROUP C: Domain-Core Layer (requires B for type alignment)
  ├── C1: Create packages/domain-core/src/auth/staff-password.ts
  ├── C2: Update packages/domain-core/src/auth/index.ts (add staff-password exports)
  ├── C3: Create packages/domain-core/src/staff/staff.types.ts
  ├── C4: Create packages/domain-core/src/staff/staff.errors.ts
  ├── C5: Create packages/domain-core/src/staff/staff.repository.ts
  ├── C6: Create packages/domain-core/src/staff/staff.service.ts
  ├── C7: Create packages/domain-core/src/staff/index.ts
  └── C8: Update packages/domain-core/src/index.ts (add staff export)

GROUP D: Validation Layer (parallel with C)
  └── D1: Create packages/validation/src/staff.schema.ts
  └── D2: Update packages/validation/src/index.ts (add staff schema exports)

GROUP E: API Layer (requires C + D)
  ├── E1: Create apps/api/src/routes/backoffice/staff/index.ts
  ├── E2: Create apps/api/src/routes/backoffice/staff/create-staff.ts
  ├── E3: Create apps/api/src/routes/backoffice/staff/list-staff.ts
  ├── E4: Create apps/api/src/routes/backoffice/staff/get-staff.ts
  ├── E5: Create apps/api/src/routes/backoffice/staff/update-staff.ts
  ├── E6: Create apps/api/src/routes/backoffice/staff/disable-staff.ts
  ├── E7: Create apps/api/src/routes/backoffice/staff/enable-staff.ts
  ├── E8: Create apps/api/src/routes/backoffice/staff/delete-staff.ts
  ├── E9: Update apps/api/src/routes/auth/backoffice-login.ts
  ├── E10: Update apps/api/src/app.ts (import staffRouter + route registration)
  └── E11: Delete apps/api/src/routes/backoffice/users.ts

GROUP F: Tests (requires E)
  ├── F1: apps/api/src/routes/backoffice/staff/__tests__/staff.crud.test.ts
  ├── F2: apps/api/src/routes/backoffice/staff/__tests__/staff.isolation.test.ts
  └── F3: apps/api/src/routes/backoffice/staff/__tests__/staff.limit.test.ts
```

---

## 5. Database Layer Design

### 5.1 — Migration File

**File**: `apps/api/src/db/tenant/migrations/20260404_020_staff_management.ts`

**Pattern**: Single file, single transaction, `PoolClient`, JSDoc header, `BEGIN/COMMIT/ROLLBACK`.

```typescript
// JSDoc header block (file, stage, schema, changes)
export const description = "Stage 41: Staff Management — schema 1.25.0 to 1.26.0";

async function up(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
  try {
    // 1. ALTER password_hash to text (Argon2id hashes ~95 chars)
    // 2. ADD status column with check constraint
    // 3. ADD failed_login_count, locked_until, last_login columns
    // 4. Backfill: UPDATE status FROM is_active
    // 5. CREATE staff_hierarchy_levels join table
    // 6. Bump schema version
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}
```

**SQL operations** (in order within transaction):

```sql
-- 1. Resize password_hash column for Argon2id (Argon2id hashes are ~95 chars)
ALTER TABLE backoffice_staff_users
  ALTER COLUMN password_hash TYPE TEXT;

-- 2. Add status enum column (with check constraint)
ALTER TABLE backoffice_staff_users
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
  CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'));

-- 3. Add brute-force protection columns (required by updated login route)
ALTER TABLE backoffice_staff_users
  ADD COLUMN failed_login_count INT NOT NULL DEFAULT 0,
  ADD COLUMN locked_until TIMESTAMPTZ NULL,
  ADD COLUMN last_login TIMESTAMPTZ NULL;

-- 4. Backfill status from is_active
UPDATE backoffice_staff_users
  SET status = CASE WHEN is_active = true THEN 'ACTIVE' ELSE 'INACTIVE' END;

-- 5. Create staff_hierarchy_levels join table
CREATE TABLE staff_hierarchy_levels (
  staff_id     UUID NOT NULL REFERENCES backoffice_staff_users(id) ON DELETE CASCADE,
  hierarchy_node_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_id, hierarchy_node_id)
);

-- 6. Bump schema version
UPDATE _schema_versions SET version = '1.26.0' WHERE name = 'schema_version';
```

### 5.2 — Drizzle Schema Updates

**File**: `apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts`  
**Changes**: Add `status`, `failedLoginCount`, `lockedUntil`, `lastLogin` columns;
change `passwordHash` from `varchar(72)` to `text`.

**File**: `apps/api/src/db/tenant/schemas/staff-hierarchy-levels.schema.ts`  
**Action**: NEW — define `staffHierarchyLevels` pgTable with composite PK.

**File**: `apps/api/src/db/tenant/schemas/index.ts`  
**Change**: Export `staffHierarchyLevels` from new schema file.

---

## 6. Domain-Core Module Design

### 6.1 — `packages/domain-core/src/auth/staff-password.ts`

```typescript
import * as argon2 from "argon2";

// Argon2id parameters per CLA-003
const ARGON2ID_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
};

// Pre-computed constant dummy hash (Argon2id format) — NEVER call argon2.hash() on requests
// This is for timing-attack prevention only. Verified once to return false by verifyStaffPassword.
const STAFF_DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$..."; // pre-generated value

export async function hashStaffPassword(plaintext: string): Promise<string>;
export async function verifyStaffPassword(hash: string, plaintext: string): Promise<boolean>;
export function generateStaffDummyHash(): string; // returns the constant above
```

**Key constraints**:

- `generateStaffDummyHash()` is synchronous — returns a string constant, no async
- `verifyStaffPassword` takes `(hash, plaintext)` — same arg order as `verifyPassword`
- Does not export anything related to bcrypt — bcrypt remains in `password.ts` exclusively

### 6.2 — `packages/domain-core/src/auth/index.ts` update

Add to auth barrel exports:

```typescript
export { generateStaffDummyHash, hashStaffPassword, verifyStaffPassword } from "./staff-password";
```

### 6.3 — `packages/domain-core/src/staff/staff.types.ts`

Key interfaces:

```typescript
// DB client (structural type — no pg import — same shape as divisions DbClient)
export interface DbClient {
  query<T>(sql, params?): Promise<{ rows: T[]; rowCount: number | null }>;
}

// Staff status
export type StaffStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

// Full DB row (includes all tenant columns — never exposed to API consumers)
export interface StaffRow {
  id: string;
  workspace_id: string;
  email: string;
  name: string;
  password_hash: string; // text — never in API responses
  token_version: number;
  is_active: boolean;
  status: StaffStatus;
  role_id: string;
  division_ids: string[];
  failed_login_count: number;
  locked_until: Date | null;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Safe public shape — password_hash NEVER included
export interface StaffRecord {
  id: string;
  workspace_id: string;
  email: string;
  name: string;
  token_version: number;
  is_active: boolean;
  status: StaffStatus;
  role_id: string;
  division_ids: string[];
  created_at: Date;
  updated_at: Date;
}

// Service function inputs
export interface CreateStaffInput {
  email: string;
  name: string;
  password: string; // plaintext — hashed by service before persist
  role_id: string;
  division_ids?: string[];
}

export interface UpdateStaffInput {
  name?: string;
  email?: string;
  division_ids?: string[];
}

export interface StaffListQuery {
  page?: number;
  limit?: number;
  status?: StaffStatus;
  division_id?: string;
  search?: string;
}

export interface StaffListResult {
  items: StaffRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditContext {
  user_id: string;
  request_id: string;
  workspace_slug: string;
  workspace_id: string;
}
```

### 6.4 — `packages/domain-core/src/staff/staff.errors.ts`

```typescript
export type StaffErrorCode =
  | 'STAFF_NOT_FOUND'
  | 'STAFF_EMAIL_CONFLICT'
  | 'STAFF_LIMIT_EXCEEDED'
  | 'STAFF_ALREADY_DISABLED'
  | 'STAFF_ALREADY_ACTIVE'
  | 'STAFF_HAS_AUTHORED_CONTENT'

export const STAFF_ERROR_HTTP: Record<StaffErrorCode, number> = {
  STAFF_NOT_FOUND: 404,
  STAFF_EMAIL_CONFLICT: 409,
  STAFF_LIMIT_EXCEEDED: 403,
  STAFF_ALREADY_DISABLED: 409,
  STAFF_ALREADY_ACTIVE: 409,
  STAFF_HAS_AUTHORED_CONTENT: 409,
}

export class StaffError extends Error {
  code: StaffErrorCode
  httpStatus: number
  constructor(code: StaffErrorCode, message: string) { ... }
}
```

### 6.5 — `packages/domain-core/src/staff/staff.repository.ts`

Raw SQL via injected `DbClient`. Key queries:

| Function                    | SQL Operation                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `findStaffByEmailForUpdate` | `SELECT ... FROM backoffice_staff_users WHERE email=$1 AND workspace_id=$2 FOR UPDATE`                                             |
| `findStaffById`             | `SELECT ... FROM backoffice_staff_users WHERE id=$1 AND workspace_id=$2`                                                           |
| `countActiveStaff`          | `SELECT COUNT(*) FROM backoffice_staff_users WHERE workspace_id=$1 AND status='ACTIVE'`                                            |
| `insertStaff`               | `INSERT INTO backoffice_staff_users (...) VALUES (...) RETURNING id,...`                                                           |
| `updateStaff`               | `UPDATE backoffice_staff_users SET ... WHERE id=$1 AND workspace_id=$2 RETURNING id,...`                                           |
| `updateStaffStatus`         | `UPDATE backoffice_staff_users SET status=$1, is_active=$2, updated_at=NOW() WHERE ...`                                            |
| `softDeleteStaff`           | `UPDATE backoffice_staff_users SET status = 'INACTIVE', is_active = false, updated_at = NOW() WHERE workspace_id = $1 AND id = $2` |
| `listStaff`                 | Full-text search + status filter + keyset pagination on (created_at, id)                                                           |
| `checkAuthoredContent`      | Check whether removing staff would orphan content                                                                                  |

All SELECT projections exclude `password_hash`, `failed_login_count`, `locked_until`, `last_login`
(security-sensitive columns never returned to API consumer layer).

### 6.6 — `packages/domain-core/src/staff/staff.service.ts`

Service functions (all take injected `DbClient` + `AuditContext`):

| Function                                              | Description                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `createStaff(db, input, staffLimit, audit)`           | Hash password, check email uniqueness, check limit, INSERT, return `StaffRecord` |
| `listStaff(db, query, audit)`                         | Paginated list with optional status/division/search filters                      |
| `getStaffById(db, staffId, workspaceId, audit)`       | Single staff record or throw `STAFF_NOT_FOUND`                                   |
| `updateStaff(db, staffId, workspaceId, input, audit)` | Partial update (name, email, division_ids), check email conflict                 |
| `disableStaff(db, staffId, workspaceId, audit)`       | Set `status=INACTIVE, is_active=false`; guard `STAFF_ALREADY_DISABLED`           |
| `enableStaff(db, staffId, workspaceId, audit)`        | Set `status=ACTIVE, is_active=true`; guard `STAFF_ALREADY_ACTIVE`                |
| `deleteStaff(db, staffId, workspaceId, audit)`        | Check authored content, then soft delete (status → INACTIVE)                     |

**Transaction discipline**:

- `createStaff`: Wrapped in `BEGIN SERIALIZABLE` — limit check + INSERT atomically
- `disableStaff` / `enableStaff`: `BEGIN READ COMMITTED` — single row UPDATE
- `updateStaff`: `BEGIN READ COMMITTED` — optional email uniqueness check + UPDATE
- `deleteStaff`: `BEGIN READ COMMITTED` — content check + soft-delete (status update)
- `listStaff` / `getStaffById`: Read-only, no transaction wrapper

**staff_limit enforcement** (in `createStaff`):

```text
1. Lock with FOR UPDATE: SELECT COUNT(*) FROM backoffice_staff_users WHERE workspace_id=$1 AND status='ACTIVE' FOR UPDATE
2. If count >= staffLimit → throw StaffError('STAFF_LIMIT_EXCEEDED')
3. Proceed with INSERT
```

### 6.7 — `packages/domain-core/src/staff/index.ts`

```typescript
export * from "./staff.errors";
export * from "./staff.service";
export {
  type StaffRecord,
  type CreateStaffInput,
  type UpdateStaffInput,
  type StaffListQuery,
  type StaffListResult,
  type AuditContext,
  type StaffStatus,
  StaffError,
} from "./staff.types";
```

### 6.8 — `packages/domain-core/src/index.ts` update

Add after the `teams` export line:

```typescript
export * as staff from "./staff";
```

---

## 7. Validation Layer Design

### `packages/validation/src/staff.schema.ts`

```typescript
import { z } from "zod";

// POST /staff — create
export const createStaffBodySchema = z.object({
  email: z.string().email().max(320),
  name: z.string().min(1).max(256).trim(),
  password: z.string().min(8).max(128),
  role_id: z.string().uuid(),
  division_ids: z.array(z.string().uuid()).optional().default([]),
});

// PUT /staff/:id — update (at least one field required)
export const updateStaffBodySchema = z
  .object({
    name: z.string().min(1).max(256).trim().optional(),
    email: z.string().email().max(320).optional(),
    division_ids: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (name, email, or division_ids) must be provided",
  });

// GET /staff — list query
export const staffListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  division_id: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
});

// GET /staff/:id, PATCH /staff/:id/disable, etc.
export const staffIdParamsSchema = z.object({
  id: z.string().uuid(),
});
```

**Update `packages/validation/src/index.ts`** — add named exports:

```typescript
export {
  createStaffBodySchema,
  staffIdParamsSchema,
  staffListQuerySchema,
  updateStaffBodySchema,
} from "./staff.schema";
```

---

## 8. API Layer Design

### 8.1 — Route Table

All routes mounted at `/api/v1/backoffice/workspace` via `staffRouter`.

| Method | Path                 | Handler              | RBAC               |
| ------ | -------------------- | -------------------- | ------------------ |
| POST   | `/staff`             | `handleCreateStaff`  | `USERS can_create` |
| GET    | `/staff`             | `handleListStaff`    | `USERS can_view`   |
| GET    | `/staff/:id`         | `handleGetStaff`     | `USERS can_view`   |
| PUT    | `/staff/:id`         | `handleUpdateStaff`  | `USERS can_edit`   |
| PATCH  | `/staff/:id/disable` | `handleDisableStaff` | `USERS can_edit`   |
| PATCH  | `/staff/:id/enable`  | `handleEnableStaff`  | `USERS can_edit`   |
| DELETE | `/staff/:id`         | `handleDeleteStaff`  | `USERS can_delete` |

**Route registration order in `index.ts`** (disambiguation critical):

1. `PATCH /staff/:id/disable` — BEFORE `PATCH /staff/:id/enable` (fixed paths before param)
2. `PATCH /staff/:id/enable`
3. `DELETE /staff/:id`
4. `GET /staff/:id`
5. `PUT /staff/:id`
6. `POST /staff`
7. `GET /staff`

### 8.2 — Route Handler Pattern

Each handler follows the established division pattern:

```typescript
export async function handleCreateStaff(c: Context<BackofficeEnv>): Promise<Response> {
  try {
    const db = getDb(c); // c.get('tenant').pool
    const audit = buildAuditCtx(c);
    const staffLimit = c.get("staff_limit"); // from license enforcement middleware

    const body = await c.req.json();
    const parseResult = createStaffBodySchema.safeParse(body);
    if (!parseResult.success) {
      /* return 422 */
    }

    const staff = await createStaff(db, parseResult.data, staffLimit, audit);
    return c.json({ success: true, data: staff, error: null }, 201);
  } catch (err) {
    return staffErrorResponse(c, err);
  }
}
```

### 8.3 — `helpers.ts` for staff routes

File: `apps/api/src/routes/backoffice/staff/helpers.ts`

Provides:

- `getDb(c)` — extracts `c.get('tenant').pool`
- `buildAuditCtx(c)` — builds `AuditContext` from Hono Variables
- `staffErrorResponse(c, err)` — maps `StaffError` to JSON response using `STAFF_ERROR_HTTP` map
- `isValidUuid(value)` — UUID format guard (reuse UUID_PATTERN from divisions pattern)

### 8.4 — `app.ts` Update

**Import**:

```typescript
import { staffRouter } from "./routes/backoffice/staff/index";
```

**Route registration** (after `rolesRouter`, before or after `divisionsRouter`):

```typescript
app.route("/api/v1/backoffice/workspace", staffRouter);
```

---

## 9. Login Route Update Design

### 9.1 — Updated Query

Replace the `FROM users` query with a joined query against `backoffice_staff_users`:

```sql
SELECT
  bsu.id,
  bsu.email,
  bsu.password_hash,
  bsu.token_version,
  bsu.status,
  bsu.failed_login_count,
  bsu.locked_until,
  br.name AS role_name
FROM backoffice_staff_users bsu
JOIN backoffice_roles br ON br.id = bsu.role_id
WHERE bsu.email = $1
  AND bsu.workspace_id = $2
FOR UPDATE OF bsu
```

Notes:

- `FOR UPDATE OF bsu` — locks only the staff row, not the roles row
- `workspace_id` extracted from `c.get('workspaceId')` (set by tenant resolver)
- No `is_deleted` filter needed (staff rows use `status` for soft-disable)

### 9.2 — Password Verification Update

```typescript
// OLD:
import { generateDummyHash, verifyPassword } from "@zidney/domain-core/auth";
const passwordHash = user ? user.password_hash : generateDummyHash();
const passwordValid = await verifyPassword(password, passwordHash);

// NEW:
import { generateStaffDummyHash, verifyStaffPassword } from "@zidney/domain-core/auth";
const passwordHash = user ? user.password_hash : generateStaffDummyHash();
const passwordValid = await verifyStaffPassword(passwordHash, password);
```

### 9.3 — Status Check Update

```typescript
// OLD: check is_active
if (!user || !user.is_active) { ... }

// NEW: check status
if (!user || user.status !== 'ACTIVE') { ... }
```

### 9.4 — Lock Check Update

```typescript
// Points to same logic (locked_until now exists on backoffice_staff_users)
if (user.locked_until && new Date() < new Date(user.locked_until)) { ... }
```

### 9.5 — JWT Claims Update

```typescript
// OLD:
role: user.role; // string from users table

// NEW:
role: user.role_name as "ADMIN" | "INSTRUCTOR" | "STAFF";
```

### 9.6 — UPDATE queries target `backoffice_staff_users`

```sql
-- Failed login increment (OLD: UPDATE users ... NEW:)
UPDATE backoffice_staff_users
  SET failed_login_count = $1, updated_at = NOW()
  WHERE id = $2

-- Lock (OLD: UPDATE users ... NEW:)
UPDATE backoffice_staff_users
  SET failed_login_count = $1, locked_until = $2, updated_at = NOW()
  WHERE id = $3

-- Success reset (OLD: UPDATE users ... NEW:)
UPDATE backoffice_staff_users
  SET failed_login_count = 0, last_login = NOW(), updated_at = NOW()
  WHERE id = $1
```

---

## 10. Transaction Boundaries

| Operation      | Isolation                 | Scope                                               |
| -------------- | ------------------------- | --------------------------------------------------- |
| `createStaff`  | `SERIALIZABLE`            | Count check + INSERT in single transaction          |
| `disableStaff` | `READ COMMITTED`          | Single-row UPDATE                                   |
| `enableStaff`  | `READ COMMITTED`          | Single-row UPDATE                                   |
| `updateStaff`  | `READ COMMITTED`          | Email uniqueness check (if provided) + UPDATE       |
| `deleteStaff`  | `READ COMMITTED`          | Content check + soft-delete (status update)         |
| Login success  | `SERIALIZABLE` (existing) | SELECT FOR UPDATE + UPDATE(reset) + COMMIT          |
| Login failure  | `SERIALIZABLE` (existing) | SELECT FOR UPDATE + UPDATE(increment/lock) + COMMIT |

All write operations use explicit `BEGIN` / `COMMIT` / `ROLLBACK`.  
Read operations (`listStaff`, `getStaffById`) are read-only — no transaction wrapper.

---

## 11. License Limit Enforcement

**`staff_limit`** is available in the Hono context via the license enforcement middleware:

```typescript
const staffLimit = c.get("staff_limit"); // from BackofficeVariables
```

Passed as a parameter to `createStaff(db, input, staffLimit, audit)`.

Inside `createStaff`:

1. Acquire `FOR UPDATE` lock on relevant rows via `SELECT COUNT(*) ... FOR UPDATE`
2. Check `count >= staffLimit` → if so, throw `StaffError('STAFF_LIMIT_EXCEEDED')`
3. Else proceed with INSERT within the same SERIALIZABLE transaction

---

## 12. Error Response Mapping

| StaffErrorCode               | HTTP Status | Trigger                             |
| ---------------------------- | ----------- | ----------------------------------- |
| `STAFF_NOT_FOUND`            | 404         | Staff ID not in workspace           |
| `STAFF_EMAIL_CONFLICT`       | 409         | Duplicate email in tenant           |
| `STAFF_LIMIT_EXCEEDED`       | 403         | Active staff count >= `staff_limit` |
| `STAFF_ALREADY_DISABLED`     | 409         | Disable on already-disabled staff   |
| `STAFF_ALREADY_ACTIVE`       | 409         | Enable on already-active staff      |
| `STAFF_HAS_AUTHORED_CONTENT` | 409         | Delete blocked by authored content  |
| `VALIDATION_ERROR`           | 422         | Zod safeParse failure               |
| `INTERNAL_ERROR`             | 500         | Unexpected/unclassified error       |

---

## 13. Testing Strategy

### Unit Tests (not applicable — pure logic lives in service)

### Integration Tests (3 test files in `__tests__/`)

**`staff.crud.test.ts`** — all 7 endpoints, success + all error paths:

- POST /staff: success (201), email conflict (409), limit exceeded (403), validation error (422)
- GET /staff: success (200), pagination, status filter, search filter
- GET /staff/:id: found (200), not found (404), cross-tenant isolation
- PUT /staff/:id: success (200), not found (404), email conflict (409)
- PATCH /staff/:id/disable: success (200), already disabled (409), not found (404)
- PATCH /staff/:id/enable: success (200), already active (409), not found (404)
- DELETE /staff/:id: success (204), not found (404), authored content (409)

**`staff.isolation.test.ts`** — tenant isolation assertions:

- Staff record from workspace A is not visible from workspace B
- PATCH /staff/:id in workspace A returns 404 if ID belongs to workspace B
- DELETE /staff/:id cross-tenant returns 404
- Login with staff from workspace B's email in workspace A context returns 401

**`staff.limit.test.ts`** — license limit enforcement:

- At exact limit: POST returns 403 `STAFF_LIMIT_EXCEEDED`
- At limit - 1: POST succeeds (201)
- Disabled staff do NOT count toward limit
- Concurrent creation at limit: at most one succeeds (SERIALIZABLE test)

---

## 14. Rollback Strategy

If migration or implementation must be reverted:

1. The migration is additive-only (ALTER ADD + CREATE TABLE).  
   Rollback SQL (emergency only, manual execution):

   ```sql
   -- Remove added columns from backoffice_staff_users
   ALTER TABLE backoffice_staff_users
     DROP COLUMN IF EXISTS status,
     DROP COLUMN IF EXISTS failed_login_count,
     DROP COLUMN IF EXISTS locked_until,
     DROP COLUMN IF EXISTS last_login;
   ALTER TABLE backoffice_staff_users
     ALTER COLUMN password_hash TYPE VARCHAR(72);

   -- Drop new table
   DROP TABLE IF EXISTS staff_hierarchy_levels;

   -- Revert schema version
   UPDATE _schema_versions SET version = '1.25.0' WHERE name = 'schema_version';
   ```

2. `backoffice-login.ts` can be reverted to the `FROM users` query if `backoffice_staff_users` login cannot proceed. This is a git revert operation on that specific file.

3. All new files (`staff/`, `staff-password.ts`, `staff.schema.ts`) can be deleted without side effects since they are only referenced from new import statements in `app.ts`, `auth/index.ts`, `domain-core/index.ts`, and `validation/index.ts`.

---

## 15. File Change Manifest

### CREATE (new files)

| File                                                                     | Group |
| ------------------------------------------------------------------------ | ----- |
| `apps/api/src/db/tenant/migrations/20260404_020_staff_management.ts`     | B     |
| `apps/api/src/db/tenant/schemas/staff-hierarchy-levels.schema.ts`        | B     |
| `packages/domain-core/src/auth/staff-password.ts`                        | C     |
| `packages/domain-core/src/staff/staff.types.ts`                          | C     |
| `packages/domain-core/src/staff/staff.errors.ts`                         | C     |
| `packages/domain-core/src/staff/staff.repository.ts`                     | C     |
| `packages/domain-core/src/staff/staff.service.ts`                        | C     |
| `packages/domain-core/src/staff/index.ts`                                | C     |
| `packages/validation/src/staff.schema.ts`                                | D     |
| `apps/api/src/routes/backoffice/staff/index.ts`                          | E     |
| `apps/api/src/routes/backoffice/staff/helpers.ts`                        | E     |
| `apps/api/src/routes/backoffice/staff/create-staff.ts`                   | E     |
| `apps/api/src/routes/backoffice/staff/list-staff.ts`                     | E     |
| `apps/api/src/routes/backoffice/staff/get-staff.ts`                      | E     |
| `apps/api/src/routes/backoffice/staff/update-staff.ts`                   | E     |
| `apps/api/src/routes/backoffice/staff/disable-staff.ts`                  | E     |
| `apps/api/src/routes/backoffice/staff/enable-staff.ts`                   | E     |
| `apps/api/src/routes/backoffice/staff/delete-staff.ts`                   | E     |
| `apps/api/src/routes/backoffice/staff/__tests__/staff.crud.test.ts`      | F     |
| `apps/api/src/routes/backoffice/staff/__tests__/staff.isolation.test.ts` | F     |
| `apps/api/src/routes/backoffice/staff/__tests__/staff.limit.test.ts`     | F     |

### MODIFY (existing files)

| File                                                              | Change Summary                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts` | ADD status, failedLoginCount, lockedUntil, lastLogin; change passwordHash to text |
| `apps/api/src/db/tenant/schemas/index.ts`                         | Export staffHierarchyLevels                                                       |
| `apps/api/src/routes/auth/backoffice-login.ts`                    | Query backoffice_staff_users + JOIN roles; use verifyStaffPassword + status check |
| `apps/api/src/app.ts`                                             | Import + register staffRouter                                                     |
| `packages/domain-core/src/auth/index.ts`                          | Add staff-password exports                                                        |
| `packages/domain-core/src/index.ts`                               | Add `export * as staff from './staff'`                                            |
| `packages/validation/src/index.ts`                                | Add staff schema exports                                                          |

### DELETE

| File                                      | Reason                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `apps/api/src/routes/backoffice/users.ts` | Dead code — 449 lines, not registered in app.ts, queries wrong users table |

---

## 16. Compliance Checklist

- [x] **ADR-0001**: Database-per-tenant — all queries use injected tenant `pool`, no cross-tenant queries
- [x] **ADR-0006**: Server-authoritative time — all timestamps use `NOW()` in SQL; no JS `new Date()` writes
- [x] **ADR-0007**: Version compatibility — migration bumps schema from `1.25.0` to `1.26.0`
- [x] **ADR-0008**: Semantic versioning — patch bump within 1.x, forward-only
- [x] **Security**: `password_hash` never returned in `StaffRecord` or any API response
- [x] **Security**: Timing-attack prevention maintained via `generateStaffDummyHash()` constant
- [x] **Security**: RBAC guard `createPermissionGuard(logger, PermissionModule.USERS, action)` on all 7 routes
- [x] **Isolation**: `workspace_id` always in WHERE clause for all staff queries
- [x] **Idempotency**: `PATCH /staff/:id/disable` guards `STAFF_ALREADY_DISABLED`; `DELETE` is non-idempotent (returns 404 on second call)
- [x] **Transaction safety**: All writes wrapped in explicit BEGIN/COMMIT/ROLLBACK
- [x] **Logging**: `createLogger` from `@zidney/logger` — `console.log` forbidden
- [x] **Error contract**: All responses follow `{ success, data, error }` shape
- [x] **No business logic in routes**: Route handlers only validate input and call service functions
