# STAGE_22_DIVISIONS — Codebase Research

**Stage**: `STAGE_22_DIVISIONS`  
**Generated**: 2026-03-16  
**Purpose**: Document existing codebase patterns that STAGE_22 implementation must follow exactly.
All decisions below are derived from direct inspection of the codebase at HEAD.

---

## DECISION 1 — Schema Version

**Decision:** New migration MUST bump schema version from `1.4.0` → `1.5.0`.

**Rationale:** The caller's Technical Context stated `last known = 1.2.0, next = 1.3.0`. This is
stale. Direct inspection of
[`apps/api/src/db/tenant/migrations/20260302_001_rbac_role_permissions_complete.ts`](../../../apps/api/src/db/tenant/migrations/20260302_001_rbac_role_permissions_complete.ts)
shows the STAGE_21 migration bumped version `1.3.0 → 1.4.0`. The most recent migration at HEAD is
STAGE_21. Therefore the current live version is `1.4.0` and STAGE_22 must target `1.5.0`.

**Alternatives considered:** Using the stated `1.2.0 → 1.3.0` — rejected; would overwrite STAGE_21
version and corrupt the monotonic bump chain.

---

## DECISION 2 — Staff Table FK Target

**Decision:** The `staff_divisions` table FK for `staff_id` MUST reference
`backoffice_staff_users(id)`, not `staff_users(id)`.

**Rationale:** The spec data model table states `FOREIGN KEY (staff_id) REFERENCES staff_users(id)`
but the actual tenant DB contains `backoffice_staff_users`. Inspection of
[`apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts`](../../../apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts)
and
[`apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts`](../../../apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts)
confirms the table name. Using `staff_users` would cause a migration failure (table does not exist).

**Alternatives considered:** Creating a `staff_users` alias/view — rejected; adds unnecessary
complexity. Follow actual table name.

---

## DECISION 3 — Migration File Pattern

**Decision:** Follow the exact structure of `20260302_001_rbac_role_permissions_complete.ts`.

**Pattern extracted (authoritative):**

```typescript
// Header block: Stage, Purpose, Constitutional Compliance, ADR refs
import type { PoolClient } from "pg";

export const description = "Human-readable one-liner";

export async function up(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
  try {
    // STEP N: comment block
    await client.query(`
      CREATE TABLE IF NOT EXISTS ... (...)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_name ON table (col)
    `);
    // Final step: schema_version bump
    await client.query(`
      UPDATE schema_version
        SET version    = '1.5.0',
            applied_at = NOW()
      WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
    `);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function down(_client: PoolClient): Promise<void> {
  throw new Error(
    "STAGE_22_DIVISIONS migration is forward-only. " +
      "Rollback must be performed via database snapshot restore.",
  );
}
```

**Key rules:**

- Each DDL statement is its own `client.query()` call — no multi-statement strings.
- `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` everywhere for idempotency.
- `BEGIN` is first, `COMMIT` is last inside the try block.
- `ROLLBACK` is in the catch block before re-throwing.
- `down()` throws with the same message pattern already established.

---

## DECISION 4 — Drizzle Schema File Pattern

**Decision:** Follow the exact import set and column definition style of
`backoffice-staff-users.schema.ts` and `workspace-settings.schema.ts`.

**Import set for `divisions.schema.ts`:**

```typescript
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
```

**Import set for `staff-divisions.schema.ts`:**

```typescript
import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { divisions } from "./divisions.schema";
import { backofficeStaffUsers } from "./backoffice-staff-users.schema";
```

**Column definition rules (extracted from backoffice-staff-users.schema.ts):**

- UUID PK: `uuid('id').primaryKey().defaultRandom()`
- Varchar: `varchar('col', { length: NNN }).notNull()`
- Text (nullable): `text('col')` — no `.notNull()`, no `.default(null)`
- Boolean: `boolean('col').notNull().default(false)`
- Timestamps: `timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`
- `sql` tag from `drizzle-orm`: only needed for non-standard defaults (e.g., array `DEFAULT '{}'`)
- No `sql` inside column definitions for basic types
- Composite PK: use `primaryKey({ columns: [table.col1, table.col2] })` in the table callback

**File naming:** `kebab-case.schema.ts` — matches `backoffice-staff-users.schema.ts`.

**Alternatives considered:** Using DB-level `pgEnum` for status — rejected; codebase standard uses
`varchar` + CHECK constraint + application-level enum, as done for `backoffice_roles.status`.

---

## DECISION 5 — PermissionModule for Divisions

**Decision:** Divisions CRUD routes MUST use `PermissionModule.ACADEMIC_STRUCTURE` for all
`createPermissionGuard()` calls.

**Rationale:** Inspection of
[`packages/domain-core/src/rbac/rbac.types.ts`](../../../packages/domain-core/src/rbac/rbac.types.ts)
shows `PermissionModule.ACADEMIC_STRUCTURE = 'academic_structure'` already exists. The spec places
divisions in the `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE` phase. No new module registration is
needed.

**Alternatives considered:** Creating a new `PermissionModule.DIVISIONS` — rejected; adding a new
module requires a schema migration to seed permission rows. Using the existing
`ACADEMIC_STRUCTURE` module is consistent and migration-free.

---

## DECISION 6 — WORKSPACE_ADMIN Guard for disable-divisions

**Decision:** The `disable-divisions` handler checks `staffUser.role !== 'WORKSPACE_ADMIN'`
directly from the Hono context variable, not via `createPermissionGuard`.

**Rationale:** Inspection of
[`apps/api/src/routes/backoffice/types.ts`](../../../apps/api/src/routes/backoffice/types.ts)
reveals `StaffUserContext = { user_id: string; role: string }`. The `role` field is the role name
set by the auth middleware from the JWT. A simple string equality check against `'WORKSPACE_ADMIN'`
is the correct pattern. The existing `createPermissionGuard` checks boolean permission flags on
`backoffice_role_module_permissions`; there is no `isAdmin` flag there. Role-name-gating is the
appropriate pattern for the single destructive operation.

**Implementation:**

```typescript
const staffUser = c.get("staff_user");
if (!staffUser || staffUser.role !== "WORKSPACE_ADMIN") {
  return c.json(
    {
      success: false,
      data: null,
      error: { code: "FORBIDDEN", message: "Access denied", correlationId },
    },
    403,
  );
}
```

---

## DECISION 7 — divisions_enabled Feature Flag Storage

**Decision:** Add a flat boolean column `divisions_enabled BOOLEAN NOT NULL DEFAULT true` to
`workspace_settings` via `ADD COLUMN IF NOT EXISTS` in the migration. Update
`workspace-settings.schema.ts` to include the new field.

**Rationale:** The spec assumption states "A `workspace_settings` table with a `divisions_enabled`
flag exists or can be added." Inspection of
[`apps/api/src/db/tenant/schemas/workspace-settings.schema.ts`](../../../apps/api/src/db/tenant/schemas/workspace-settings.schema.ts)
shows the table uses both flat columns (e.g., `student_limit`, `staff_limit`) and JSONB columns.
A flat boolean is simpler, more queryable, and consistent with the other boolean-style feature
flags in the table. Storing in `general_settings` JSONB would require JSONB path updates and is
less performant for a simple flag check.

**Default value:** `true` — existing tenants are in divisions-enabled mode by default. The
disable-divisions operation sets it to `false`.

---

## DECISION 8 — Route File Structure

**Decision:** Use the multi-handler-file pattern (matching `translations/`) for the divisions
router: one `index.ts` that mounts all routes, plus individual handler files per endpoint group.

**Rationale:** The divisions feature has 10 endpoints across two resource namespaces
(`/divisions/*` and `/staff/:staff_id/divisions/*`). The `roles.ts` single-file pattern (9
endpoints) is also acceptable, but the translations pattern (`index.ts` + individual files)
produces clearer import boundaries and matches the declared plan structure better.

**Directory:** `apps/api/src/routes/backoffice/divisions/`

**Files:**

```
divisions/
  index.ts              — Hono router, mounts all routes
  get-list.ts           — GET /divisions
  get-detail.ts         — GET /divisions/:id
  post-create.ts        — POST /divisions
  put-update.ts         — PUT /divisions/:id
  patch-status.ts       — PATCH /divisions/:id/status
  delete-division.ts    — DELETE /divisions/:id
  post-disable.ts       — POST /divisions/disable-divisions  (rate-limited, WORKSPACE_ADMIN)
  staff-divisions.ts    — GET/POST/DELETE /staff/:staff_id/divisions/*
```

---

## DECISION 9 — Domain Service DbClient Type

**Decision:** Define `type DbClient` locally in `divisions.service.ts` matching the shape of
`Pool` from `pg`. Do not import `Pool` directly from `pg` in domain packages.

**Rationale:** Domain packages must have no framework dependencies. The existing pattern in
`rbac.service.ts` defines a local `DbClient` interface and imports it from `rbac.audit.ts`. Follow
the same pattern: the service receives a `db: DbClient` parameter and the API layer passes
`tenant.pool`.

**Type:**

```typescript
export type DbClient = {
  query: <T = unknown>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
};
```

---

## DECISION 10 — Rate Limit for disable-divisions

**Decision:** Implement the 1 req/min/workspace rate limit for `disable-divisions` using a simple
Redis key with TTL, checked inside the route handler before any business logic.

**Rationale:** No generic per-route rate-limit middleware with workspace-specific keys was found in
the scanned middleware files. The simplest safe pattern is to compute
`rate_limit:disable_divisions:{workspace_id}`, call `redis.set(key, 1, 'EX', 60, 'NX')`, and
return 429 if the key already exists. This is consistent with using `tenant.redis` (available on
`TenantContext`) and requires no new middleware.

**Redis key pattern:** `rate_limit:disable_divisions:{tenant.id}`

---

## DECISION 11 — Audit Log for Mutations

**Decision:** Write structured audit log entries using `createLogger` from `@zidney/logger` with
`logger.info(event, fields)`. Write to the logger only (not a DB audit table) for standard CRUD
events. For the `disable-divisions` operation, also persist a row in an `audit_logs`-equivalent
table if one is already seeded; otherwise logger-only is acceptable for STAGE_22.

**Rationale:** The spec requires "structured audit log entry containing triggering user id,
timestamp, affected counts." The existing codebase uses `@zidney/logger` structured logging for
audit events (e.g., `DIVISION_CREATED` event). Creating a new DB audit table is out of scope for
this stage. Logger-based audit trail satisfies the spec requirement while staying within STAGE_22
scope.

---

## NEEDS CLARIFICATION — Resolved

| #   | Unknown                           | Resolution                                                                                                                                                                                                                                                               |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Current schema version            | `1.4.0` — confirmed from `20260302_001_rbac_role_permissions_complete.ts`                                                                                                                                                                                                |
| 2   | Staff table name in FK            | `backoffice_staff_users` — confirmed from schema file                                                                                                                                                                                                                    |
| 3   | WORKSPACE_ADMIN check mechanism   | `staffUser.role` field on `StaffUserContext`                                                                                                                                                                                                                             |
| 4   | `divisions_enabled` flag location | New flat column on `workspace_settings`                                                                                                                                                                                                                                  |
| 5   | PermissionModule for divisions    | `PermissionModule.ACADEMIC_STRUCTURE` (existing)                                                                                                                                                                                                                         |
| 6   | Students table name               | `students` — referenced in spec; no schema file found in `/schemas/` — migration uses `ALTER TABLE students` which will fail if the table does not exist from prior bootstrap stage. **Risk:** Implementer must verify `students` table exists before running migration. |
| 7   | Disable-divisions rate limiting   | Redis NX key pattern — `tenant.redis` available on `TenantContext`                                                                                                                                                                                                       |

---

## Codebase Patterns Summary (Quick Reference)

| Pattern             | Source File                                      | Key Detail                                                                |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Migration structure | `20260302_001_rbac_role_permissions_complete.ts` | BEGIN/try/COMMIT/catch ROLLBACK                                           |
| Drizzle schema      | `backoffice-staff-users.schema.ts`               | `uuid().primaryKey().defaultRandom()`                                     |
| Composite PK        | N/A (pattern)                                    | `primaryKey({ columns: [t.a, t.b] })` in table callback                   |
| Route handler       | `roles.ts`                                       | `new Hono<BackofficeEnv>()`, `c.get('tenant')`, `c.get('staff_user')`     |
| Permission guard    | `backoffice-permission-guard-v2.ts`              | `createPermissionGuard(logger, module, action)`                           |
| Domain service      | `rbac.service.ts`                                | `db.query('BEGIN')` / `db.query('COMMIT')` / `catch ROLLBACK`             |
| Error class         | `rbac.service.ts`                                | `class XError extends Error { code: string }`                             |
| Logger              | All service files                                | `const logger = createLogger('service-name')`                             |
| Error response      | `roles.ts`                                       | `{ success: false, data: null, error: { code, message, correlationId } }` |
| BackofficeEnv       | `types.ts`                                       | `TenantContext`, `StaffUserContext`, `correlationId`                      |
