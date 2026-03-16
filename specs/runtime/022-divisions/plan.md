# STAGE_22_DIVISIONS — Implementation Plan

**Stage**: `STAGE_22_DIVISIONS`  
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`  
**Branch**: `feat/stage-22-divisions`  
**Created**: 2026-03-16  
**Status**: READY FOR IMPLEMENTATION  
**Spec**: `specs/runtime/022-divisions/spec.md`  
**Research**: `specs/runtime/022-divisions/research.md`  
**Data Model**: `specs/runtime/022-divisions/data-model.md`

---

## Constitution Check

| Rule                         | Status | Notes                                                                                                         |
| ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| No cross-tenant access       | PASS   | All queries use `tenant.pool` from resolver context                                                           |
| No middleware bypass         | PASS   | All routes inherit correlationId → tenantResolver → licenseEnforcement → schemaVersion → rateLimit → auth-jwt |
| No direct DB instantiation   | PASS   | Domain service receives `db: DbClient` injected from route handler                                            |
| No row-based multi-tenancy   | PASS   | All tables reside in tenant DB; no shared division rows                                                       |
| No global DB singleton       | PASS   | `tenant.pool` from Hono context only                                                                          |
| Server-authoritative time    | PASS   | All timestamps use `NOW()` at DB level; `assigned_at` set server-side                                         |
| Forward-only migration       | PASS   | `down()` throws per ADR-0008                                                                                  |
| No console.log               | PASS   | All logging via `createLogger` from `@zidney/logger`                                                          |
| License middleware mandatory | PASS   | Inherited from backoffice group middleware chain                                                              |
| Attempt engine untouched     | PASS   | Feature does not touch attempt/grading/snapshot logic                                                         |

**Constitution gate: PASSED — implementation may proceed.**

---

## Phase 1: Data Layer

### 1.1 Migration File

**File:** `apps/api/src/db/tenant/migrations/20260316_001_divisions.ts`

See `data-model.md` for the full migration source. The 8 transactional steps are:

```
STEP 1  CREATE divisions table + CHECK constraint + 2 indexes
STEP 2  CREATE staff_divisions join table + composite PK + 2 FK constraints + 2 indexes
STEP 3  ALTER workspace_settings ADD COLUMN divisions_enabled BOOLEAN NOT NULL DEFAULT true
STEP 4  ALTER students ADD COLUMN division_id UUID (nullable)
STEP 5  UPDATE students SET division_id = (SELECT id FROM divisions WHERE is_default = true LIMIT 1) WHERE division_id IS NULL
STEP 6  ALTER students ALTER COLUMN division_id SET NOT NULL
STEP 7  ALTER students ADD CONSTRAINT students_division_id_fkey FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE RESTRICT
        CREATE INDEX idx_students_division_id ON students (division_id)
STEP 8  UPDATE schema_version SET version = '1.5.0'
```

**Pre-deploy checklist:**

- [ ] `students` table exists in tenant DB (from STAGE_17 bootstrap)
- [ ] At least one `divisions` row with `is_default = true` has been seeded (STAGE_17 bootstrap)
- [ ] Migration tested in staging with a tenant that has > 0 students
- [ ] Deployment window chosen to minimize `ACCESS EXCLUSIVE` lock on `students`

---

### 1.2 Drizzle Schema Files

#### `apps/api/src/db/tenant/schemas/divisions.schema.ts` (NEW)

Full source in `data-model.md §2`. Key columns:

| Drizzle field | DB column     | Type                                     | Notable                                       |
| ------------- | ------------- | ---------------------------------------- | --------------------------------------------- |
| `id`          | `id`          | `uuid PK DEFAULT gen_random_uuid()`      | `primaryKey().defaultRandom()`                |
| `name`        | `name`        | `varchar(255) NOT NULL UNIQUE`           | `uniqueIndex('divisions_name_unique')`        |
| `description` | `description` | `text nullable`                          | No `.notNull()`, no `.default(null)`          |
| `is_default`  | `is_default`  | `boolean NOT NULL DEFAULT false`         | `boolean().notNull().default(false)`          |
| `status`      | `status`      | `varchar(20) NOT NULL DEFAULT 'ENABLED'` | CHECK in migration only                       |
| `created_at`  | `created_at`  | `timestamptz NOT NULL DEFAULT now()`     | `timestamp({withTimezone:true}).defaultNow()` |
| `updated_at`  | `updated_at`  | `timestamptz NOT NULL DEFAULT now()`     | Same pattern                                  |

Exported types: `Division`, `NewDivision`.

#### `apps/api/src/db/tenant/schemas/staff-divisions.schema.ts` (NEW)

Full source in `data-model.md §3`. Key points:

- Composite PK via `primaryKey({ columns: [table.staff_id, table.division_id] })`
- FK `staff_id` → `backofficeStaffUsers.id` with `{ onDelete: 'cascade' }`
- FK `division_id` → `divisions.id` with `{ onDelete: 'restrict' }`

Exported types: `StaffDivision`, `NewStaffDivision`.

#### `apps/api/src/db/tenant/schemas/workspace-settings.schema.ts` (UPDATE)

Add one field to the `workspaceSettings` pgTable column map (after `security_settings`):

```typescript
divisions_enabled: boolean('divisions_enabled').notNull().default(true),
```

#### `apps/api/src/db/tenant/schemas/students.schema.ts` (UPDATE or CREATE)

Add `division_id` FK field and `divisionIdIdx` index. See `data-model.md §5` for exact code.
If the file does not exist, create it following the `backoffice-staff-users.schema.ts` pattern.

---

## Phase 2: Domain Layer

### 2.1 Directory

```
packages/domain-core/src/divisions/
  divisions.types.ts    — enums, interfaces, DbClient alias
  divisions.errors.ts   — DivisionsError class + all 12 error codes
  divisions.service.ts  — pure business logic functions
  index.ts              — public re-exports
```

---

### 2.2 `divisions.types.ts`

**File:** `packages/domain-core/src/divisions/divisions.types.ts`

```typescript
/**
 * Divisions Domain Types — STAGE_22
 *
 * File: packages/domain-core/src/divisions/divisions.types.ts
 * Stage: STAGE_22_DIVISIONS
 *
 * Pure TypeScript. No HTTP logic. No framework dependencies.
 */

// ---------------------------------------------------------------------------
// DB client interface (mirrors Pool.query signature — no pg import in domain)
// ---------------------------------------------------------------------------

export type DbClient = {
  query: <T = unknown>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
};

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum DivisionStatus {
  ENABLED = "ENABLED",
  DISABLED = "DISABLED",
}

// ---------------------------------------------------------------------------
// Row shapes (typed results from parametrized SQL)
// ---------------------------------------------------------------------------

export interface DivisionRow {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface StaffDivisionRow {
  staff_id: string;
  division_id: string;
  assigned_at: Date;
}

// ---------------------------------------------------------------------------
// Service input/output types
// ---------------------------------------------------------------------------

export interface CreateDivisionInput {
  name: string;
  description?: string | null;
}

export interface UpdateDivisionInput {
  name: string;
  description?: string | null;
}

export interface UpdateDivisionStatusInput {
  status: DivisionStatus;
}

export interface DisableDivisionsResult {
  students_reassigned: number;
  staff_divisions_reassigned: number;
  divisions_disabled: number;
}

export interface AuditContext {
  user_id: string | null;
  request_id: string;
  workspace_slug: string;
  workspace_id: string;
}

// ---------------------------------------------------------------------------
// Pagination types
// ---------------------------------------------------------------------------

export interface ListDivisionsInput {
  limit?: number;
  cursor?: string | null;
  status?: "ENABLED" | "DISABLED" | "all";
}

export interface ListDivisionsResult {
  items: DivisionRow[];
  nextCursor: string | null;
  total: number;
}
```

---

### 2.3 `divisions.errors.ts`

**File:** `packages/domain-core/src/divisions/divisions.errors.ts`

```typescript
/**
 * Divisions Domain Errors — STAGE_22
 *
 * File: packages/domain-core/src/divisions/divisions.errors.ts
 * Stage: STAGE_22_DIVISIONS
 *
 * Single typed error class for all division domain violations.
 * Route handlers switch on `error.code` to produce the correct HTTP status.
 */

export class DivisionsError extends Error {
  constructor(
    public readonly code: DivisionsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DivisionsError";
  }
}

export type DivisionsErrorCode =
  | "DIVISION_NOT_FOUND" // 404
  | "DIV_STAFF_ASSIGNMENT_NOT_FOUND" // 404
  | "DIVISION_NAME_CONFLICT" // 409
  | "DEFAULT_DIVISION_IMMUTABLE" // 422
  | "DIVISION_IN_USE" // 422
  | "DIVISION_DISABLED" // 422
  | "DIVISION_REQUIRED" // 422
  | "STAFF_MINIMUM_DIVISION_REQUIRED" // 422
  | "DESTRUCTIVE_CONFIRMATION_REQUIRED" // 422
  | "DIVISIONS_FEATURE_DISABLED" // 423
  | "DIVISIONS_FEATURE_LOCKED" // 423
  | "VALIDATION_ERROR"; // 422

export const DIVISIONS_ERROR_HTTP_STATUS: Record<DivisionsErrorCode, number> = {
  DIVISION_NOT_FOUND: 404,
  DIV_STAFF_ASSIGNMENT_NOT_FOUND: 404,
  DIVISION_NAME_CONFLICT: 409,
  DEFAULT_DIVISION_IMMUTABLE: 422,
  DIVISION_IN_USE: 422,
  DIVISION_DISABLED: 422,
  DIVISION_REQUIRED: 422,
  STAFF_MINIMUM_DIVISION_REQUIRED: 422,
  DESTRUCTIVE_CONFIRMATION_REQUIRED: 422,
  DIVISIONS_FEATURE_DISABLED: 423,
  DIVISIONS_FEATURE_LOCKED: 423,
  VALIDATION_ERROR: 422,
};

export const DIVISIONS_ERROR_MESSAGES: Record<DivisionsErrorCode, string> = {
  DIVISION_NOT_FOUND: "Division not found.",
  DIV_STAFF_ASSIGNMENT_NOT_FOUND: "The specified division is not assigned to this staff member.",
  DIVISION_NAME_CONFLICT: "A division with this name already exists in this workspace.",
  DEFAULT_DIVISION_IMMUTABLE: "The default division cannot be deleted or disabled.",
  DIVISION_IN_USE: "This division has active student or staff assignments and cannot be deleted.",
  DIVISION_DISABLED: "Cannot assign an entity to a disabled division.",
  DIVISION_REQUIRED: "A valid division_id is required.",
  STAFF_MINIMUM_DIVISION_REQUIRED: "Staff members must be assigned to at least one division.",
  DESTRUCTIVE_CONFIRMATION_REQUIRED:
    'This operation requires the confirmation token "DISABLE_DIVISIONS".',
  DIVISIONS_FEATURE_DISABLED:
    "The workspace is in single-division mode. This operation is not permitted.",
  DIVISIONS_FEATURE_LOCKED:
    "The divisions feature is locked. Re-enabling requires an operator migration.",
  VALIDATION_ERROR: "Request body failed field-level validation.",
};
```

---

### 2.4 `divisions.service.ts`

**File:** `packages/domain-core/src/divisions/divisions.service.ts`

All functions follow the `rbac.service.ts` pattern: receive `db: DbClient`, wrap writes in
`BEGIN/COMMIT/ROLLBACK`, throw `DivisionsError` for domain violations.

```typescript
/**
 * Divisions Domain Service — STAGE_22
 *
 * File: packages/domain-core/src/divisions/divisions.service.ts
 * Stage: STAGE_22_DIVISIONS
 *
 * Stateless domain service functions for Division CRUD, staff-division
 * assignment management, and the disable-divisions system operation.
 *
 * All DB access via injected DbClient (tenant pool from request context).
 * All writes are transactional.
 * No HTTP logic. No framework dependencies.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure domain functions
 * ✓ All DB access via injected db parameter
 * ✓ All writes wrapped in BEGIN/COMMIT/ROLLBACK
 * ✓ Structured logging via @zidney/logger
 * ✓ Server-authoritative timestamps (NOW() at DB level, ADR-0006)
 * ✓ No cross-tenant joins
 */

import { createLogger } from "@zidney/logger";
import { DivisionsError } from "./divisions.errors";
import type {
  AuditContext,
  CreateDivisionInput,
  DbClient,
  DisableDivisionsResult,
  DivisionRow,
  ListDivisionsInput,
  ListDivisionsResult,
  StaffDivisionRow,
  UpdateDivisionInput,
  UpdateDivisionStatusInput,
} from "./divisions.types";
import { DivisionStatus } from "./divisions.types";

const logger = createLogger("divisions-service");

// ---------------------------------------------------------------------------
// isDivisionsEnabled — check workspace feature flag
// ---------------------------------------------------------------------------

export async function isDivisionsEnabled(db: DbClient): Promise<boolean> {
  const result = await db.query<{ divisions_enabled: boolean }>(
    `SELECT divisions_enabled FROM workspace_settings LIMIT 1`,
  );
  return result.rows[0]?.divisions_enabled ?? true;
}

// ---------------------------------------------------------------------------
// listDivisions — cursor-based pagination
// ---------------------------------------------------------------------------

export async function listDivisions(
  db: DbClient,
  input: ListDivisionsInput = {},
): Promise<ListDivisionsResult> {
  const limit = Math.min(input.limit ?? 20, 100);
  const status = input.status ?? "all";

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (status !== "all") {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  if (input.cursor) {
    // Cursor is the id of the last item on the previous page.
    // Look up its created_at to use keyset pagination (created_at ASC, id ASC).
    const cursorRow = await db.query<{ created_at: Date }>(
      `SELECT created_at FROM divisions WHERE id = $1`,
      [input.cursor],
    );
    if (cursorRow.rows[0]) {
      conditions.push(`(created_at, id) > ($${paramIdx++}, $${paramIdx++})`);
      params.push(cursorRow.rows[0].created_at, input.cursor);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Fetch limit + 1 to detect whether a next page exists
  const result = await db.query<DivisionRow>(
    `SELECT id, name, description, is_default, status, created_at, updated_at
       FROM divisions
      ${where}
      ORDER BY created_at ASC, id ASC
      LIMIT $${paramIdx}`,
    [...params, limit + 1],
  );

  const hasNextPage = result.rows.length > limit;
  const items = hasNextPage ? result.rows.slice(0, limit) : result.rows;
  const nextCursor = hasNextPage ? (items[items.length - 1]?.id ?? null) : null;

  // Total count respects status filter but ignores cursor
  const countConditions: string[] = [];
  const countParams: unknown[] = [];
  if (status !== "all") {
    countConditions.push(`status = $1`);
    countParams.push(status);
  }
  const countWhere = countConditions.length > 0 ? `WHERE ${countConditions.join(" AND ")}` : "";
  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM divisions ${countWhere}`,
    countParams,
  );
  const total = parseInt(countResult.rows[0]?.count ?? "0");

  return { items, nextCursor, total };
}

// ---------------------------------------------------------------------------
// getDivisionById
// ---------------------------------------------------------------------------

export async function getDivisionById(db: DbClient, id: string): Promise<DivisionRow> {
  const result = await db.query<DivisionRow>(
    `SELECT id, name, description, is_default, status, created_at, updated_at
       FROM divisions
      WHERE id = $1`,
    [id],
  );
  if (!result.rows[0]) {
    throw new DivisionsError("DIVISION_NOT_FOUND", "Division not found.");
  }
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// createDivision
// ---------------------------------------------------------------------------

export async function createDivision(
  db: DbClient,
  input: CreateDivisionInput,
  audit: AuditContext,
): Promise<DivisionRow> {
  const enabled = await isDivisionsEnabled(db);
  if (!enabled) {
    throw new DivisionsError("DIVISIONS_FEATURE_DISABLED", "Workspace is in single-division mode.");
  }

  await db.query("BEGIN");
  try {
    // Case-insensitive name conflict check
    const conflict = await db.query<{ id: string }>(
      `SELECT id FROM divisions WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [input.name.trim()],
    );
    if (conflict.rows.length > 0) {
      throw new DivisionsError(
        "DIVISION_NAME_CONFLICT",
        "A division with this name already exists.",
      );
    }

    const result = await db.query<DivisionRow>(
      `INSERT INTO divisions (name, description, is_default, status)
       VALUES ($1, $2, false, 'ENABLED')
       RETURNING id, name, description, is_default, status, created_at, updated_at`,
      [input.name.trim(), input.description ?? null],
    );
    const division = result.rows[0]!;

    await db.query("COMMIT");

    logger.info("DIVISION_CREATED", {
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      correlation_id: audit.request_id,
      division_id: division.id,
    });

    return division;
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// updateDivision — name and description only; is_default is silently ignored
// ---------------------------------------------------------------------------

export async function updateDivision(
  db: DbClient,
  id: string,
  input: UpdateDivisionInput,
  audit: AuditContext,
): Promise<DivisionRow> {
  const enabled = await isDivisionsEnabled(db);
  if (!enabled) {
    throw new DivisionsError("DIVISIONS_FEATURE_DISABLED", "Workspace is in single-division mode.");
  }

  await db.query("BEGIN");
  try {
    const existing = await db.query<DivisionRow>(
      `SELECT id, is_default FROM divisions WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!existing.rows[0]) {
      throw new DivisionsError("DIVISION_NOT_FOUND", "Division not found.");
    }

    const conflict = await db.query<{ id: string }>(
      `SELECT id FROM divisions WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1`,
      [input.name.trim(), id],
    );
    if (conflict.rows.length > 0) {
      throw new DivisionsError(
        "DIVISION_NAME_CONFLICT",
        "A division with this name already exists.",
      );
    }

    const result = await db.query<DivisionRow>(
      `UPDATE divisions
          SET name = $1, description = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING id, name, description, is_default, status, created_at, updated_at`,
      [input.name.trim(), input.description ?? null, id],
    );

    await db.query("COMMIT");

    logger.info("DIVISION_UPDATED", {
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      correlation_id: audit.request_id,
      division_id: id,
    });

    return result.rows[0]!;
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// updateDivisionStatus
// ---------------------------------------------------------------------------

export async function updateDivisionStatus(
  db: DbClient,
  id: string,
  input: UpdateDivisionStatusInput,
  audit: AuditContext,
): Promise<DivisionRow> {
  const enabled = await isDivisionsEnabled(db);
  if (!enabled) {
    throw new DivisionsError("DIVISIONS_FEATURE_DISABLED", "Workspace is in single-division mode.");
  }

  await db.query("BEGIN");
  try {
    const existing = await db.query<DivisionRow>(
      `SELECT id, is_default FROM divisions WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!existing.rows[0]) {
      throw new DivisionsError("DIVISION_NOT_FOUND", "Division not found.");
    }
    if (existing.rows[0].is_default && input.status === DivisionStatus.DISABLED) {
      throw new DivisionsError(
        "DEFAULT_DIVISION_IMMUTABLE",
        "Cannot disable the default division.",
      );
    }

    const result = await db.query<DivisionRow>(
      `UPDATE divisions
          SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, name, description, is_default, status, created_at, updated_at`,
      [input.status, id],
    );

    await db.query("COMMIT");

    logger.info("DIVISION_STATUS_UPDATED", {
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      correlation_id: audit.request_id,
      division_id: id,
      new_status: input.status,
    });

    return result.rows[0]!;
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// deleteDivision
// ---------------------------------------------------------------------------

export async function deleteDivision(db: DbClient, id: string, audit: AuditContext): Promise<void> {
  const enabled = await isDivisionsEnabled(db);
  if (!enabled) {
    throw new DivisionsError("DIVISIONS_FEATURE_DISABLED", "Workspace is in single-division mode.");
  }

  await db.query("BEGIN");
  try {
    const existing = await db.query<DivisionRow>(
      `SELECT id, is_default FROM divisions WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!existing.rows[0]) {
      throw new DivisionsError("DIVISION_NOT_FOUND", "Division not found.");
    }
    if (existing.rows[0].is_default) {
      throw new DivisionsError("DEFAULT_DIVISION_IMMUTABLE", "Cannot delete the default division.");
    }

    const studentCount = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM students WHERE division_id = $1`,
      [id],
    );
    const staffCount = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM staff_divisions WHERE division_id = $1`,
      [id],
    );
    const total =
      parseInt(studentCount.rows[0]?.count ?? "0") + parseInt(staffCount.rows[0]?.count ?? "0");
    if (total > 0) {
      throw new DivisionsError("DIVISION_IN_USE", `Division has ${total} active assignments.`);
    }

    await db.query(`DELETE FROM divisions WHERE id = $1`, [id]);
    await db.query("COMMIT");

    logger.info("DIVISION_DELETED", {
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      correlation_id: audit.request_id,
      division_id: id,
    });
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// disableDivisions — SERIALIZABLE transaction
// ---------------------------------------------------------------------------

export async function disableDivisions(
  db: DbClient,
  audit: AuditContext,
): Promise<DisableDivisionsResult> {
  // Check if already locked — fast pre-check to avoid acquiring SERIALIZABLE tx unnecessarily
  const settings = await db.query<{ divisions_enabled: boolean }>(
    `SELECT divisions_enabled FROM workspace_settings LIMIT 1`,
  );
  if (!settings.rows[0]?.divisions_enabled) {
    throw new DivisionsError("DIVISIONS_FEATURE_LOCKED", "Divisions feature is already locked.");
  }

  // SERIALIZABLE isolation prevents phantom reads during full-set reassignment
  await db.query("BEGIN");
  await db.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
  try {
    // 1. Identify default division
    const defaultResult = await db.query<{ id: string }>(
      `SELECT id FROM divisions WHERE is_default = true LIMIT 1`,
    );
    const defaultId = defaultResult.rows[0]?.id;
    if (!defaultId) {
      throw new Error("No default division found — tenant bootstrap may not have run.");
    }

    // 2. Reassign all students not already on the default division
    const studentsResult = await db.query<{ count: string }>(
      `WITH updated AS (
         UPDATE students
            SET division_id = $1, updated_at = NOW()
          WHERE division_id != $1
          RETURNING id
       ) SELECT COUNT(*) AS count FROM updated`,
      [defaultId],
    );
    const studentsReassigned = parseInt(studentsResult.rows[0]?.count ?? "0");

    // 3. Delete non-default staff_divisions, re-insert for those staff on default
    //    Uses CTE to capture affected staff_ids before deletion, then idempotent INSERT
    const staffResult = await db.query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM staff_divisions
          WHERE division_id != $1
          RETURNING staff_id
       ),
       reinserted AS (
         INSERT INTO staff_divisions (staff_id, division_id, assigned_at)
         SELECT DISTINCT staff_id, $1, NOW()
           FROM deleted
         ON CONFLICT (staff_id, division_id) DO NOTHING
         RETURNING staff_id
       )
       SELECT COUNT(*) AS count FROM deleted`,
      [defaultId],
    );
    const staffDivisionsReassigned = parseInt(staffResult.rows[0]?.count ?? "0");

    // 4. Disable all non-default divisions
    const disabledResult = await db.query<{ count: string }>(
      `WITH updated AS (
         UPDATE divisions
            SET status = 'DISABLED', updated_at = NOW()
          WHERE is_default = false AND status != 'DISABLED'
          RETURNING id
       ) SELECT COUNT(*) AS count FROM updated`,
    );
    const divisionsDisabled = parseInt(disabledResult.rows[0]?.count ?? "0");

    // 5. Set workspace feature flag
    await db.query(`UPDATE workspace_settings SET divisions_enabled = false, updated_at = NOW()`);

    await db.query("COMMIT");

    logger.info("DIVISIONS_FEATURE_DISABLED", {
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      correlation_id: audit.request_id,
      students_reassigned: studentsReassigned,
      staff_divisions_reassigned: staffDivisionsReassigned,
      divisions_disabled: divisionsDisabled,
    });

    return {
      students_reassigned: studentsReassigned,
      staff_divisions_reassigned: staffDivisionsReassigned,
      divisions_disabled: divisionsDisabled,
    };
  } catch (err) {
    await db.query("ROLLBACK");
    logger.error("DIVISIONS_FEATURE_DISABLE_FAILED", {
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      correlation_id: audit.request_id,
      error: String(err),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// getStaffDivisions
// ---------------------------------------------------------------------------

export async function getStaffDivisions(db: DbClient, staffId: string): Promise<DivisionRow[]> {
  const result = await db.query<DivisionRow>(
    `SELECT d.id, d.name, d.description, d.is_default, d.status, d.created_at, d.updated_at
       FROM divisions d
       JOIN staff_divisions sd ON sd.division_id = d.id
      WHERE sd.staff_id = $1
      ORDER BY d.is_default DESC, d.name ASC`,
    [staffId],
  );
  return result.rows;
}

// ---------------------------------------------------------------------------
// assignStaffDivision — idempotent
// ---------------------------------------------------------------------------

export async function assignStaffDivision(
  db: DbClient,
  staffId: string,
  divisionId: string,
  audit: AuditContext,
): Promise<DivisionRow[]> {
  const enabled = await isDivisionsEnabled(db);
  if (!enabled) {
    throw new DivisionsError("DIVISIONS_FEATURE_DISABLED", "Workspace is in single-division mode.");
  }

  await db.query("BEGIN");
  try {
    const division = await db.query<DivisionRow>(`SELECT id, status FROM divisions WHERE id = $1`, [
      divisionId,
    ]);
    if (!division.rows[0]) {
      throw new DivisionsError("DIVISION_NOT_FOUND", "Division not found.");
    }
    if (division.rows[0].status === DivisionStatus.DISABLED) {
      throw new DivisionsError("DIVISION_DISABLED", "Cannot assign a disabled division.");
    }

    // Idempotent upsert — composite PK conflict = already assigned = success
    await db.query(
      `INSERT INTO staff_divisions (staff_id, division_id, assigned_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (staff_id, division_id) DO NOTHING`,
      [staffId, divisionId],
    );

    await db.query("COMMIT");

    logger.info("STAFF_DIVISION_ASSIGNED", {
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      correlation_id: audit.request_id,
      staff_id: staffId,
      division_id: divisionId,
    });

    return getStaffDivisions(db, staffId);
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// removeStaffDivision — min-one guard
// ---------------------------------------------------------------------------

export async function removeStaffDivision(
  db: DbClient,
  staffId: string,
  divisionId: string,
  audit: AuditContext,
): Promise<DivisionRow[]> {
  await db.query("BEGIN");
  try {
    // Verify the assignment exists
    const assignment = await db.query<StaffDivisionRow>(
      `SELECT staff_id FROM staff_divisions WHERE staff_id = $1 AND division_id = $2`,
      [staffId, divisionId],
    );
    if (!assignment.rows[0]) {
      // Also verify the division itself exists for a cleaner 404 signal
      const divExists = await db.query<{ id: string }>(`SELECT id FROM divisions WHERE id = $1`, [
        divisionId,
      ]);
      if (!divExists.rows[0]) {
        throw new DivisionsError("DIVISION_NOT_FOUND", "Division not found.");
      }
      throw new DivisionsError(
        "DIV_STAFF_ASSIGNMENT_NOT_FOUND",
        "The specified division is not assigned to this staff member.",
      );
    }

    // Min-one guard
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM staff_divisions WHERE staff_id = $1`,
      [staffId],
    );
    if (parseInt(countResult.rows[0]?.count ?? "0") <= 1) {
      throw new DivisionsError(
        "STAFF_MINIMUM_DIVISION_REQUIRED",
        "Staff members must be assigned to at least one division.",
      );
    }

    await db.query(`DELETE FROM staff_divisions WHERE staff_id = $1 AND division_id = $2`, [
      staffId,
      divisionId,
    ]);

    await db.query("COMMIT");

    logger.info("STAFF_DIVISION_REMOVED", {
      workspace_slug: audit.workspace_slug,
      workspace_id: audit.workspace_id,
      user_id: audit.user_id,
      correlation_id: audit.request_id,
      staff_id: staffId,
      division_id: divisionId,
    });

    return getStaffDivisions(db, staffId);
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}
```

---

### 2.5 `index.ts`

**File:** `packages/domain-core/src/divisions/index.ts`

```typescript
export {
  createDivision,
  deleteDivision,
  disableDivisions,
  getDivisionById,
  getStaffDivisions,
  assignStaffDivision,
  isDivisionsEnabled,
  listDivisions,
  removeStaffDivision,
  updateDivision,
  updateDivisionStatus,
} from "./divisions.service";
export {
  DivisionsError,
  DIVISIONS_ERROR_HTTP_STATUS,
  DIVISIONS_ERROR_MESSAGES,
} from "./divisions.errors";
export type {
  DbClient,
  DivisionRow,
  StaffDivisionRow,
  DisableDivisionsResult,
  AuditContext,
  ListDivisionsInput,
  ListDivisionsResult,
} from "./divisions.types";
export { DivisionStatus } from "./divisions.types";
```

---

## Phase 3: API Layer

### 3.1 Directory Structure

```
apps/api/src/routes/backoffice/divisions/
  index.ts            — Hono router + route registrations
  get-list.ts         — GET /divisions
  get-detail.ts       — GET /divisions/:id
  post-create.ts      — POST /divisions
  put-update.ts       — PUT /divisions/:id
  patch-status.ts     — PATCH /divisions/:id/status
  delete-division.ts  — DELETE /divisions/:id
  post-disable.ts     — POST /divisions/disable-divisions
  staff-divisions.ts  — GET/POST/DELETE /staff/:staff_id/divisions[/:division_id]
```

---

### 3.2 `index.ts`

**File:** `apps/api/src/routes/backoffice/divisions/index.ts`

The router is mounted at the backoffice group-scoped URL. The middleware chain
`correlationId → tenantResolver → licenseEnforcement → schemaVersion → rateLimit(60) → auth-jwt`
is inherited from `app.ts`. Per-route guards are applied inline.

```typescript
/**
 * Division Routes — STAGE_22
 *
 * Mounted at /api/v1/backoffice/workspace/divisions (and /staff/:staffId/divisions).
 * Inherits full backoffice middleware chain from app.ts.
 */

import { createLogger } from "@zidney/logger";
import { Hono } from "hono";
import type { BackofficeEnv } from "../types";
import { handleGetList } from "./get-list";
import { handleGetDetail } from "./get-detail";
import { handlePostCreate } from "./post-create";
import { handlePutUpdate } from "./put-update";
import { handlePatchStatus } from "./patch-status";
import { handleDeleteDivision } from "./delete-division";
import { handlePostDisable } from "./post-disable";
import {
  handleGetStaffDivisions,
  handlePostStaffDivision,
  handleDeleteStaffDivision,
} from "./staff-divisions";
import { createPermissionGuard } from "../../middleware/backoffice-permission-guard-v2";
import { PermissionModule } from "@zidney/domain-core/rbac";

export const divisionsRouter = new Hono<BackofficeEnv>();

const logger = createLogger("backoffice-divisions-router");

// Division CRUD — /divisions/*
// NOTE: disable-divisions MUST be registered before /:id routes to avoid conflict
divisionsRouter.post("/divisions/disable-divisions", handlePostDisable);
divisionsRouter.get(
  "/divisions",
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, "can_view"),
  handleGetList,
);
divisionsRouter.get(
  "/divisions/:id",
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, "can_view"),
  handleGetDetail,
);
divisionsRouter.post(
  "/divisions",
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, "can_create"),
  handlePostCreate,
);
divisionsRouter.put(
  "/divisions/:id",
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, "can_edit"),
  handlePutUpdate,
);
divisionsRouter.patch(
  "/divisions/:id/status",
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, "can_edit"),
  handlePatchStatus,
);
divisionsRouter.delete(
  "/divisions/:id",
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, "can_delete"),
  handleDeleteDivision,
);

// Staff division assignment — /staff/:staffId/divisions/*
divisionsRouter.get(
  "/staff/:staffId/divisions",
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, "can_view"),
  handleGetStaffDivisions,
);
divisionsRouter.post(
  "/staff/:staffId/divisions",
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, "can_edit"),
  handlePostStaffDivision,
);
divisionsRouter.delete(
  "/staff/:staffId/divisions/:divisionId",
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, "can_edit"),
  handleDeleteStaffDivision,
);
```

---

### 3.3 Shared handler helpers (inline in index.ts or a `helpers.ts`)

```typescript
// Reusable across all handler files

import type { Context } from "hono";
import type { BackofficeEnv } from "../types";
import type { DivisionsErrorCode } from "@zidney/domain-core/divisions";
import {
  DIVISIONS_ERROR_HTTP_STATUS,
  DIVISIONS_ERROR_MESSAGES,
} from "@zidney/domain-core/divisions";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function getRequestContext(c: Context<BackofficeEnv>) {
  const correlationId = c.get("correlationId") as string;
  const tenant = c.get("tenant");
  const staffUser = c.get("staff_user");
  const userId: string | null = staffUser?.user_id ?? null;
  return { correlationId, tenant, userId, staffUser };
}

export function divisionErrorResponse(
  c: Context<BackofficeEnv>,
  code: DivisionsErrorCode,
  correlationId: string,
  overrideMessage?: string,
) {
  return c.json(
    {
      success: false as const,
      data: null,
      error: {
        code,
        message: overrideMessage ?? DIVISIONS_ERROR_MESSAGES[code],
        correlationId,
      },
    },
    DIVISIONS_ERROR_HTTP_STATUS[code] as ContentfulStatusCode,
  );
}

export function auditCtx(
  correlationId: string,
  userId: string | null,
  tenant: { slug: string; id: string },
) {
  return {
    user_id: userId,
    request_id: correlationId,
    workspace_slug: tenant.slug,
    workspace_id: tenant.id,
  };
}
```

---

### 3.4 Handler file templates

Each handler file follows this exact pattern (example: `post-create.ts`):

```typescript
/**
 * POST /divisions — Create Division
 * Stage: STAGE_22_DIVISIONS
 */

import { createDivision, DivisionsError } from "@zidney/domain-core/divisions";
import type { Context } from "hono";
import type { BackofficeEnv } from "../types";
import { auditCtx, divisionErrorResponse, getRequestContext } from "./helpers";

export async function handlePostCreate(c: Context<BackofficeEnv>) {
  const { correlationId, tenant, userId } = getRequestContext(c);

  let body: { name?: string; description?: string | null };
  try {
    body = await c.req.json();
  } catch {
    return divisionErrorResponse(c, "VALIDATION_ERROR", correlationId, "Invalid JSON body");
  }

  const name = body.name?.trim();
  if (!name || name.length === 0 || name.length > 255) {
    return divisionErrorResponse(
      c,
      "VALIDATION_ERROR",
      correlationId,
      "name is required and must be 1-255 characters",
    );
  }
  // Control character check
  if (/[\x00-\x1F\x7F]/.test(name)) {
    return divisionErrorResponse(
      c,
      "VALIDATION_ERROR",
      correlationId,
      "name must not contain control characters",
    );
  }

  try {
    const division = await createDivision(
      tenant.pool,
      { name, description: body.description ?? null },
      auditCtx(correlationId, userId, tenant),
    );
    return c.json({ success: true, data: division, error: null }, 201);
  } catch (err) {
    if (err instanceof DivisionsError) {
      return divisionErrorResponse(c, err.code, correlationId);
    }
    return c.json(
      {
        success: false,
        data: null,
        error: { code: "INTERNAL_ERROR", message: "An internal error occurred", correlationId },
      },
      500,
    );
  }
}
```

All other handler files follow the same structure. Key variations:

| File                 | Method          | Path                                      | Permission            | Key logic                                                                                                                                                |
| -------------------- | --------------- | ----------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get-list.ts`        | GET             | `/divisions`                              | `can_view`            | Parse `limit`, `cursor`, `status` from query params; call `listDivisions(tenant.pool, { limit, cursor, status })`; return `{ items, nextCursor, total }` |
| `get-detail.ts`      | GET             | `/divisions/:id`                          | `can_view`            | Call `getDivisionById(tenant.pool, id)`                                                                                                                  |
| `put-update.ts`      | PUT             | `/divisions/:id`                          | `can_edit`            | Validate name, call `updateDivision`                                                                                                                     |
| `patch-status.ts`    | PATCH           | `/divisions/:id/status`                   | `can_edit`            | Validate `status` is `ENABLED\|DISABLED`, call `updateDivisionStatus`                                                                                    |
| `delete-division.ts` | DELETE          | `/divisions/:id`                          | `can_delete`          | Call `deleteDivision`, return `{ deleted: true }`                                                                                                        |
| `staff-divisions.ts` | GET/POST/DELETE | `/staff/:staffId/divisions[/:divisionId]` | `can_view`/`can_edit` | Delegate to staff division functions                                                                                                                     |

---

### 3.5 `post-disable.ts` — disable-divisions handler (special)

```typescript
/**
 * POST /divisions/disable-divisions
 * Stage: STAGE_22_DIVISIONS
 *
 * Authorization: staffUser.role === 'WORKSPACE_ADMIN'
 * Rate limit: 1 req/min/workspace (Redis NX key)
 * Confirmation: body.confirmation === 'DISABLE_DIVISIONS' (constant-time compare)
 * Transaction isolation: SERIALIZABLE (set inside service)
 */

import { disableDivisions, DivisionsError } from "@zidney/domain-core/divisions";
import { timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import type { BackofficeEnv } from "../types";
import { auditCtx, divisionErrorResponse, getRequestContext } from "./helpers";

const CONFIRMATION_TOKEN = "DISABLE_DIVISIONS";
const RATE_LIMIT_KEY_PREFIX = "rate_limit:disable_divisions:";

function timingSafeStringEqual(a: string, b: string): boolean {
  // Constant-time comparison to prevent timing attacks on the confirmation token
  const aBuf = Buffer.from(a.padEnd(32));
  const bBuf = Buffer.from(b.padEnd(32));
  return timingSafeEqual(aBuf.slice(0, 32), bBuf.slice(0, 32)) && a.length === b.length;
}

export async function handlePostDisable(c: Context<BackofficeEnv>) {
  const { correlationId, tenant, userId, staffUser } = getRequestContext(c);

  // 1. WORKSPACE_ADMIN role check (role name from JWT context)
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

  // 2. Rate limit: 1 req/min/workspace (FAIL-CLOSED: Redis unavailable = block request)
  const redis = tenant.redis;
  if (!redis) {
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Rate limiting service is unavailable. Please try again later.",
          correlationId,
        },
      },
      503,
    );
  }
  try {
    const rateLimitKey = `${RATE_LIMIT_KEY_PREFIX}${tenant.id}`;
    const set = await redis.set(rateLimitKey, "1", "EX", 60, "NX");
    if (!set) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "disable-divisions may be called at most once per minute per workspace",
            correlationId,
          },
        },
        429,
      );
    }
  } catch {
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Rate limiting service is unavailable. Please try again later.",
          correlationId,
        },
      },
      503,
    );
  }

  // 3. Parse and validate confirmation token
  let body: { confirmation?: string };
  try {
    body = await c.req.json();
  } catch {
    return divisionErrorResponse(c, "DESTRUCTIVE_CONFIRMATION_REQUIRED", correlationId);
  }

  const confirmation = body.confirmation ?? "";
  if (!timingSafeStringEqual(confirmation, CONFIRMATION_TOKEN)) {
    return divisionErrorResponse(c, "DESTRUCTIVE_CONFIRMATION_REQUIRED", correlationId);
  }

  // 4. Execute destructive operation
  try {
    const result = await disableDivisions(tenant.pool, auditCtx(correlationId, userId, tenant));
    return c.json({ success: true, data: result, error: null }, 200);
  } catch (err) {
    if (err instanceof DivisionsError) {
      return divisionErrorResponse(c, err.code, correlationId);
    }
    return c.json(
      {
        success: false,
        data: null,
        error: { code: "INTERNAL_ERROR", message: "An internal error occurred", correlationId },
      },
      500,
    );
  }
}
```

---

### 3.6 App.ts Mount

Add the following to `apps/api/src/app.ts` in the backoffice group section (after roles router):

```typescript
import { divisionsRouter } from "./routes/backoffice/divisions/index";

// Inside backoffice group:
backofficeGroup.route("/", divisionsRouter);
```

---

## Phase 4: Validation Layer

All input validation is performed inline in each handler file. Validation rules per endpoint:

| Endpoint                            | Field            | Rule                                                                                                                   |
| ----------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `POST /divisions`                   | `name`           | Required, string, 1-255 chars, no control characters                                                                   |
| `POST /divisions`                   | `description`    | Optional, string or null, max 1000 chars                                                                               |
| `PUT /divisions/:id`                | `name`           | Same as POST                                                                                                           |
| `PUT /divisions/:id`                | `description`    | Same as POST                                                                                                           |
| `PATCH /divisions/:id/status`       | `status`         | Must be exactly `'ENABLED'` or `'DISABLED'` — return 422 `VALIDATION_ERROR` otherwise                                  |
| `POST /divisions/disable-divisions` | `confirmation`   | Must equal `'DISABLE_DIVISIONS'` via constant-time compare                                                             |
| `POST /staff/:staffId/divisions`    | `division_id`    | Required, valid UUID format (regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`)               |
| All `:id` params                    | UUID path params | Validate UUID format before calling domain; return 404 `DIVISION_NOT_FOUND` for malformed UUIDs to avoid SQL injection |

**UUID validation helper** (define once in `helpers.ts`):

```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUuid(s: string): boolean {
  return UUID_RE.test(s);
}
```

---

## Phase 5: Tests

### 5.1 Unit Tests

**File:** `packages/domain-core/src/divisions/__tests__/divisions.service.test.ts`

Test the domain service in isolation using a mock `DbClient`. Cover all business rule branches:

```typescript
// Test groups required:

describe("createDivision", () => {
  it("creates a division with valid input");
  it("throws DIVISION_NAME_CONFLICT on case-insensitive name duplicate");
  it("throws DIVISIONS_FEATURE_DISABLED when workspace is locked");
  it("rolls back on DB error during INSERT");
});

describe("updateDivision", () => {
  it("updates name and description");
  it("silently ignores is_default in input");
  it("throws DIVISION_NOT_FOUND for unknown id");
  it("throws DIVISION_NAME_CONFLICT on name collision with another division");
});

describe("updateDivisionStatus", () => {
  it("disables a non-default division");
  it("re-enables a disabled division");
  it("throws DEFAULT_DIVISION_IMMUTABLE when trying to disable the default");
  it("throws DIVISION_NOT_FOUND for unknown id");
  it("throws VALIDATION_ERROR for invalid status value (test at handler level)");
});

describe("deleteDivision", () => {
  it("deletes a non-default, unreferenced division");
  it("throws DEFAULT_DIVISION_IMMUTABLE for default division");
  it("throws DIVISION_IN_USE when students are assigned");
  it("throws DIVISION_IN_USE when staff are assigned");
});

describe("disableDivisions", () => {
  it("reassigns all students to default division");
  it("clears and re-inserts staff_divisions for default only");
  it("disables all non-default divisions");
  it("sets divisions_enabled = false in workspace_settings");
  it(
    "returns correct counts for students_reassigned, staff_divisions_reassigned, divisions_disabled",
  );
  it("rolls back entirely on partial failure — no partial state");
  it("throws DIVISIONS_FEATURE_LOCKED if already locked");
});

describe("assignStaffDivision", () => {
  it("assigns a division to a staff member");
  it("is idempotent — re-assigning returns success without duplicate row");
  it("throws DIVISION_NOT_FOUND for unknown division");
  it("throws DIVISION_DISABLED for disabled division");
  it("throws DIVISIONS_FEATURE_DISABLED when workspace is locked");
});

describe("removeStaffDivision", () => {
  it("removes a staff division assignment");
  it("throws DIV_STAFF_ASSIGNMENT_NOT_FOUND if division is not assigned");
  it("throws DIVISION_NOT_FOUND if division does not exist at all");
  it("throws STAFF_MINIMUM_DIVISION_REQUIRED when removing the last division");
});
```

---

### 5.2 Integration Tests

**File:** `tests/integration/divisions.test.ts`

Test all 10 endpoints through the HTTP layer with a real test tenant DB.

```typescript
// Test groups required:

describe("GET /api/v1/backoffice/workspace/:slug/divisions", () => {
  it("200 with division list for authenticated staff with can_view");
  it("403 for staff without can_view");
  it("401 for unauthenticated request");
  it("423 license SOFT_LOCKED → 423");
  it("403 license ARCHIVED → 403");
  it("200 default pagination: limit=20, nextCursor=null when <= 20 divisions exist");
  it("200 cursor-based pagination: nextCursor returned when more pages exist");
  it("200 cursor from previous page returns correct next page, no duplicates");
  it("200 nextCursor is null on last page");
  it("200 status=ENABLED filter returns only ENABLED divisions");
  it("200 status=DISABLED filter returns only DISABLED divisions");
  it("200 status=all (default) returns all divisions regardless of status");
  it("200 total reflects status-filtered count independent of cursor");
  it("200 respects limit param; clamps to 100 max");
});

describe("GET /api/v1/backoffice/workspace/:slug/divisions/:id", () => {
  it("200 with single division");
  it("404 DIVISION_NOT_FOUND for unknown id");
  it("403 without can_view");
});

describe("POST /api/v1/backoffice/workspace/:slug/divisions", () => {
  it("201 creates division with valid name");
  it("409 DIVISION_NAME_CONFLICT on duplicate name (case-insensitive)");
  it("422 VALIDATION_ERROR on missing name");
  it("422 VALIDATION_ERROR on name > 255 chars");
  it("422 VALIDATION_ERROR on name with control characters");
  it("403 without can_create");
  it("423 DIVISIONS_FEATURE_DISABLED when workspace is locked");
});

describe("PUT /api/v1/backoffice/workspace/:slug/divisions/:id", () => {
  it("200 updates name and description");
  it("200 accepts update on default division (name only)");
  it("409 DIVISION_NAME_CONFLICT on name collision");
  it("404 DIVISION_NOT_FOUND for unknown id");
  it("does NOT change is_default (silently ignores is_default in body)");
  it("423 DIVISIONS_FEATURE_DISABLED when workspace is locked");
});

describe("PATCH /api/v1/backoffice/workspace/:slug/divisions/:id/status", () => {
  it("200 disables a non-default division");
  it("200 re-enables a disabled division");
  it("422 DEFAULT_DIVISION_IMMUTABLE for default division");
  it("422 VALIDATION_ERROR for invalid status value");
  it("404 DIVISION_NOT_FOUND for unknown id");
  it("423 DIVISIONS_FEATURE_DISABLED when workspace is locked");
});

describe("DELETE /api/v1/backoffice/workspace/:slug/divisions/:id", () => {
  it("200 { deleted: true } for unreferenced non-default division");
  it("422 DEFAULT_DIVISION_IMMUTABLE for default division");
  it("422 DIVISION_IN_USE when students assigned");
  it("422 DIVISION_IN_USE when staff assigned");
  it("404 DIVISION_NOT_FOUND for unknown id");
  it("FK constraint test: DB also rejects deletion when students assigned");
});

describe("POST /api/v1/backoffice/workspace/:slug/divisions/disable-divisions", () => {
  it("200 with correct counts on successful operation");
  it("422 DESTRUCTIVE_CONFIRMATION_REQUIRED without confirmation token");
  it("422 DESTRUCTIVE_CONFIRMATION_REQUIRED with wrong confirmation value");
  it("423 DIVISIONS_FEATURE_LOCKED on re-invocation after lock");
  it("403 for non-WORKSPACE_ADMIN staff");
  it("429 on second call within 60 seconds (rate limit)");
  it("503 when Redis is unavailable (fail-closed rate limit)");
  it("full rollback test: inject DB error mid-transaction → state unchanged");
  it("isolation test: tenant A lock does not affect tenant B");
  it("after lock: all students reference default division only");
  it("after lock: all staff_divisions reference default division only");
  it("after lock: all non-default divisions status = DISABLED");
});

describe("GET /staff/:staffId/divisions", () => {
  it("200 with list of assigned divisions");
  it("403 without can_view on ACADEMIC_STRUCTURE");
});

describe("POST /staff/:staffId/divisions", () => {
  it("200 assigns division; returns updated list");
  it("200 idempotent — duplicate assignment returns success");
  it("404 DIVISION_NOT_FOUND");
  it("422 DIVISION_DISABLED for disabled division");
  it("423 DIVISIONS_FEATURE_DISABLED when workspace is locked");
});

describe("DELETE /staff/:staffId/divisions/:divisionId", () => {
  it("200 removes assignment; returns updated list");
  it("422 STAFF_MINIMUM_DIVISION_REQUIRED on last division");
  it("404 DIV_STAFF_ASSIGNMENT_NOT_FOUND if not assigned");
  it("404 DIVISION_NOT_FOUND if division does not exist");
});

describe("Student FK enforcement", () => {
  it("422 DIVISION_REQUIRED when creating student without division_id");
  it("DB rejects student insert without division_id (NOT NULL constraint)");
  it("DB rejects student reference to non-existent division_id (FK constraint)");
});
```

---

## Phase Summary

| Phase            | Files to Create/Update                                                           | Complexity |
| ---------------- | -------------------------------------------------------------------------------- | ---------- |
| 1 – Data Layer   | 1 migration, 2 new schemas, 2 schema updates                                     | Medium     |
| 2 – Domain Layer | 4 new files in `packages/domain-core/src/divisions/`                             | High       |
| 3 – API Layer    | 9 new files in `apps/api/src/routes/backoffice/divisions/`, 1 update to `app.ts` | High       |
| 4 – Validation   | Inline in handler files                                                          | Low        |
| 5 – Tests        | 1 unit test file, 1 integration test file                                        | High       |

---

## Implementation Order

Execute phases in sequence. Do not begin Phase 3 before Phase 2 compiles cleanly.

```
1. Write and run migration 20260316_001_divisions.ts against test DB
2. Write divisions.schema.ts + staff-divisions.schema.ts
3. Update workspace-settings.schema.ts + students.schema.ts
4. Write divisions.types.ts + divisions.errors.ts
5. Write divisions.service.ts — run unit tests
6. Write all handler files (get-list, get-detail, post-create, put-update, patch-status,
   delete-division, post-disable, staff-divisions)
7. Write divisions/index.ts + mount in app.ts
8. Run integration tests against test DB
9. Run: bun run lint && bun run type-check && bun run test
10. Run: bun scripts/infra-audit.ts (verify no architecture boundary violations)
```

---

## Validation Checklist

Before marking stage complete:

- [ ] Migration runs idempotently (run twice — no errors on second run)
- [ ] `bun run type-check` — zero errors
- [ ] `bun run lint` — zero violations
- [ ] Unit tests: all pass
- [ ] Integration tests: all pass including rollback and isolation tests
- [ ] `bun scripts/infra-audit.ts` — zero violations
- [ ] No `console.log` anywhere in new files
- [ ] All audit log events fire for every mutation (manual spot-check)
- [ ] `disable-divisions` rate limit works (second call within 60s → 429)
- [ ] Post-disable: create division returns 423
- [ ] Students table `division_id` NOT NULL enforced at DB level
- [ ] Default division cannot be deleted (DB FK and API both reject)
