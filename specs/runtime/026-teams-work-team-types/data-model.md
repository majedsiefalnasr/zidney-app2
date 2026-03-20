# Data Model — Teams & Work Team Types

**Stage**: `STAGE_26_TEAMS`  
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`  
**Schema version**: `1.9.0 → 1.10.0`  
**Date**: 2026-03-19

---

## Overview

Three new tables are introduced in the tenant database:

| Table         | Schema file                                            |
| ------------- | ------------------------------------------------------ |
| `team_types`  | `apps/api/src/db/tenant/schemas/team-types.schema.ts`  |
| `teams`       | `apps/api/src/db/tenant/schemas/teams.schema.ts`       |
| `staff_teams` | `apps/api/src/db/tenant/schemas/staff-teams.schema.ts` |

All tables reside exclusively in the tenant DB. No master DB changes. No existing tables modified.

---

## 1 `team_types` Schema

**File**: `apps/api/src/db/tenant/schemas/team-types.schema.ts`

```typescript
/**
 * Drizzle ORM Schema — Team Types (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/team-types.schema.ts
 * Stage: STAGE_26_TEAMS
 * Date: 2026-03-19
 *
 * Classification types for operational teams.
 *
 * Partial functional unique index:
 *   UNIQUE (LOWER(name)) WHERE deleted_at IS NULL
 *   is owned by migration 20260319_004_teams.ts (`team_types_name_lower_unique_active`).
 *   Drizzle cannot express a partial functional index; no uniqueIndex() declaration here
 *   to avoid generating a conflicting plain UNIQUE constraint.
 *
 * Soft-delete pattern:
 *   deleted_at IS NOT NULL = soft-deleted. Hard delete is forbidden.
 *   All list/lookup queries MUST filter WHERE deleted_at IS NULL.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 * ✓ Academic isolation: team_types must not appear in exam/content/student-visibility queries
 */

import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const teamTypes = pgTable(
  "team_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Team type display name.
     * Unique among active (non-soft-deleted) records — enforced by partial functional
     * index `team_types_name_lower_unique_active` (migration-owned, case-insensitive).
     */
    name: varchar("name", { length: 255 }).notNull(),

    /** Optional description. Nullable — no default. */
    description: text("description"),

    /**
     * Team type lifecycle status.
     * 'ENABLED'  → type is operational; teams may be created/associated with it.
     * 'DISABLED' → type is inactive; no new teams may reference it (TEAM_TYPE_DISABLED).
     *              Existing teams referencing this type remain unaffected.
     * CHECK constraint enforced at DB layer in migration.
     */
    status: varchar("status", { length: 20 }).notNull().default("ENABLED"),

    /**
     * Soft-delete timestamp.
     * NULL = active record.
     * Set to NOW() at deletion — record is hidden from list/lookup queries.
     * Hard delete is not allowed; rows are retained for audit trail.
     */
    deleted_at: timestamp("deleted_at", { withTimezone: true }),

    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** Status filter — list ENABLED/DISABLED team types. */
    statusIdx: index("idx_team_types_status").on(table.status),

    /**
     * Soft-delete filter.
     * All list/lookup queries include WHERE deleted_at IS NULL.
     */
    deletedAtIdx: index("idx_team_types_deleted_at").on(table.deleted_at),

    /**
     * Keyset pagination composite index (created_at, id).
     * Owned by migration: CREATE INDEX idx_team_types_created_at_id ON team_types (created_at ASC, id ASC)
     * Not declared via Drizzle index() to avoid conflicts.
     */
  }),
);

export type TeamTypeRow = typeof teamTypes.$inferSelect;
export type NewTeamType = typeof teamTypes.$inferInsert;
```

---

## 2 `teams` Schema

**File**: `apps/api/src/db/tenant/schemas/teams.schema.ts`

```typescript
/**
 * Drizzle ORM Schema — Teams (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/teams.schema.ts
 * Stage: STAGE_26_TEAMS
 * Date: 2026-03-19
 *
 * Operational staff grouping entity with optional team type classification
 * and configurable member capacity.
 *
 * Partial functional unique index:
 *   UNIQUE (LOWER(name)) WHERE deleted_at IS NULL
 *   is owned by migration 20260319_004_teams.ts (`teams_name_lower_unique_active`).
 *   Drizzle cannot express a partial functional index; no uniqueIndex() declaration here.
 *
 * FK teams.team_type_id → team_types(id) ON DELETE SET NULL:
 *   Hard-deleting a team_types row (manual maintenance only) sets team_type_id to null.
 *   In normal operation team_types use soft-delete; this FK fires only for manual cleanup.
 *
 * max_members CHECK:
 *   Must be a positive integer when set. Enforced at DB layer (migration).
 *   NULL = uncapped.
 *
 * Soft-delete pattern:
 *   deleted_at IS NOT NULL = soft-deleted. Hard delete is forbidden.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 * ✓ Academic isolation: teams must not appear in exam/content/student-visibility queries
 */

import { index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { teamTypes } from "./team-types.schema";

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Team display name.
     * Unique among active (non-soft-deleted) teams — enforced by partial functional
     * index `teams_name_lower_unique_active` (migration-owned, case-insensitive).
     */
    name: varchar("name", { length: 255 }).notNull(),

    /**
     * Optional classification via Team Type.
     * NULL = unclassified team — valid and fully operational.
     * FK → team_types(id) ON DELETE SET NULL:
     *   hard-delete of a team_types row sets this to null (safety net only;
     *   team_types use soft-delete in normal operation).
     * When provided, the referenced team type MUST have status = 'ENABLED'
     * at team creation and re-assignment time (enforced at service layer).
     */
    team_type_id: uuid("team_type_id").references(() => teamTypes.id, {
      onDelete: "set null",
    }),

    /**
     * Maximum number of staff members assignable to this team.
     * NULL = uncapped.
     * Positive integer only — CHECK (max_members IS NULL OR max_members > 0) in migration.
     * Enforcement uses SELECT FOR UPDATE on the teams row inside the assignment transaction.
     */
    max_members: integer("max_members"),

    /** Optional description. Nullable — no default. */
    description: text("description"),

    /**
     * Team lifecycle status.
     * 'ENABLED'  → team is operational and accepting new staff assignments.
     * 'DISABLED' → team is inactive; existing assignments preserved,
     *              new assignments rejected (TEAM_DISABLED error).
     * CHECK constraint enforced at DB layer in migration.
     */
    status: varchar("status", { length: 20 }).notNull().default("ENABLED"),

    /**
     * Soft-delete timestamp.
     * NULL = active team.
     * Set to NOW() at deletion — team is hidden from list/lookup queries.
     * Hard delete is not allowed; rows are retained for audit trail.
     */
    deleted_at: timestamp("deleted_at", { withTimezone: true }),

    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Team type filter — list teams scoped to a type.
     * Also serves the TEAM_TYPE_HAS_TEAMS deletion guard scan.
     */
    teamTypeIdIdx: index("idx_teams_team_type_id").on(table.team_type_id),

    /** Status filter — list ENABLED/DISABLED teams. */
    statusIdx: index("idx_teams_status").on(table.status),

    /**
     * Soft-delete filter.
     * All list/lookup queries include WHERE deleted_at IS NULL.
     */
    deletedAtIdx: index("idx_teams_deleted_at").on(table.deleted_at),

    /**
     * Keyset pagination composite index (created_at, id).
     * Owned by migration: CREATE INDEX idx_teams_created_at_id ON teams (created_at ASC, id ASC)
     * Not declared via Drizzle index() to avoid conflicts.
     */
  }),
);

export type TeamRow = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
```

---

## 3 `staff_teams` Schema

**File**: `apps/api/src/db/tenant/schemas/staff-teams.schema.ts`

```typescript
/**
 * Drizzle ORM Schema — Staff Teams Join Table (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/staff-teams.schema.ts
 * Stage: STAGE_26_TEAMS
 * Date: 2026-03-19
 *
 * Many-to-many join between backoffice staff users and teams.
 * Composite primary key: (staff_id, team_id).
 *
 * FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE:
 *   Deleting a staff user removes all their team assignments.
 *
 * FK team_id → teams(id) ON DELETE CASCADE:
 *   ARCHITECTURAL NOTE: teams use soft-delete (deleted_at). This CASCADE will not
 *   fire in normal operation because teams rows are never hard-deleted. The CASCADE
 *   exists solely as a safety net for manual DB maintenance. Service-layer logic
 *   must rely on soft-delete guards, not this FK cascade.
 *
 * Idempotency:
 *   The composite PK enables `INSERT ... ON CONFLICT (staff_id, team_id) DO NOTHING`
 *   as a DB-level safety net for the idempotent assignment endpoint.
 *
 * No separate idx_staff_teams_staff_id is needed:
 *   The composite PK (staff_id, team_id) has staff_id as the leading column, so
 *   PostgreSQL can use it for all staff_id-prefix lookups without a redundant index.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

import { backofficeStaffUsers } from "./backoffice-staff-users.schema";
import { teams } from "./teams.schema";

export const staffTeams = pgTable(
  "staff_teams",
  {
    /** FK → backoffice_staff_users(id) ON DELETE CASCADE */
    staff_id: uuid("staff_id")
      .notNull()
      .references(() => backofficeStaffUsers.id, { onDelete: "cascade" }),

    /**
     * FK → teams(id) ON DELETE CASCADE (soft-delete safety net — see file JSDoc).
     * Service layer must check team existence via soft-delete guard before this fires.
     */
    team_id: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),

    /** Server-set assignment timestamp (ADR-0006 — client time not trusted). */
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Composite PK enforces uniqueness of (staff_id, team_id) at DB level.
     * Enables idempotent ON CONFLICT DO NOTHING upsert at service layer.
     */
    pk: primaryKey({ columns: [table.staff_id, table.team_id] }),

    /**
     * idx_staff_teams_staff_id is intentionally NOT declared here.
     * The composite PK (staff_id, team_id) has staff_id as leading column,
     * so PostgreSQL can use it for all staff_id prefix queries without a separate index.
     */

    /**
     * Index for team member count queries and TEAM_HAS_ASSIGNMENTS deletion guard.
     * Used by: countStaffInTeam(), findTeamMembers().
     */
    teamIdIdx: index("idx_staff_teams_team_id").on(table.team_id),
  }),
);

export type StaffTeamRow = typeof staffTeams.$inferSelect;
export type NewStaffTeam = typeof staffTeams.$inferInsert;
```

---

## 4 TypeScript Types (`teams.types.ts`)

```typescript
/**
 * Teams Domain — Types & Interfaces
 *
 * File: packages/domain-core/src/teams/teams.types.ts
 * Stage: STAGE_26_TEAMS
 * Date: 2026-03-19
 */

// ---------------------------------------------------------------------------
// DbClient — structural interface (no pg import in domain layer)
// ---------------------------------------------------------------------------

export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

// ---------------------------------------------------------------------------
// AuditContext
// ---------------------------------------------------------------------------

export interface AuditContext {
  user_id: string;
  correlation_id: string;
  workspace_slug: string;
  workspace_id: string;
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum TeamStatus {
  ENABLED = "ENABLED",
  DISABLED = "DISABLED",
}

// ---------------------------------------------------------------------------
// Row interfaces (mirror DB schema)
// ---------------------------------------------------------------------------

export interface TeamTypeRow {
  id: string;
  name: string;
  description: string | null;
  status: "ENABLED" | "DISABLED";
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface TeamRow {
  id: string;
  name: string;
  team_type_id: string | null;
  max_members: number | null;
  description: string | null;
  status: "ENABLED" | "DISABLED";
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface StaffTeamRow {
  staff_id: string;
  team_id: string;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ListTeamTypesInput {
  status?: "ENABLED" | "DISABLED";
  limit: number;
  cursor?: string;
}

export interface ListTeamTypesResult {
  items: TeamTypeRow[];
  total: number;
  nextCursor: string | null;
}

export interface CreateTeamTypeInput {
  name: string;
  description?: string | null;
}

export interface UpdateTeamTypeInput {
  name?: string;
  description?: string | null;
  status?: "ENABLED" | "DISABLED";
}

export interface ListTeamsInput {
  status?: "ENABLED" | "DISABLED";
  team_type_id?: string;
  limit: number;
  cursor?: string;
}

export interface ListTeamsResult {
  items: TeamRow[];
  total: number;
  nextCursor: string | null;
}

export interface CreateTeamInput {
  name: string;
  team_type_id?: string | null;
  max_members?: number | null;
  description?: string | null;
}

export interface UpdateTeamInput {
  name?: string;
  team_type_id?: string | null;
  max_members?: number | null;
  description?: string | null;
  status?: "ENABLED" | "DISABLED";
}
```

---

## 5 Entity Relationship Diagram

```
backoffice_staff_users (existing)
  │
  │ staff_id (FK, ON DELETE CASCADE)
  ▼
staff_teams ──────────────────── team_id (FK, ON DELETE CASCADE) ──▶ teams
  (composite PK: staff_id, team_id)                                    │
  created_at                                                            │ team_type_id
                                                                        │ (FK, ON DELETE SET NULL)
                                                                        ▼
                                                                    team_types
```

### Cardinalities

| Relationship                                           | Cardinality | Notes                               |
| ------------------------------------------------------ | ----------- | ----------------------------------- |
| `backoffice_staff_users` → `staff_teams`               | 1:N         | Staff may be in many teams          |
| `teams` → `staff_teams`                                | 1:N         | Team may have many staff            |
| `team_types` → `teams`                                 | 1:N         | Type groups many teams; nullable FK |
| `teams` → `backoffice_staff_users` (via `staff_teams`) | M:N         | Many-to-many                        |

---

## 6 Indexes Summary

### `team_types`

| Index name                            | Columns                                  | Type             | Purpose                          |
| ------------------------------------- | ---------------------------------------- | ---------------- | -------------------------------- |
| `team_types_pkey`                     | `id`                                     | PRIMARY KEY      | Row identity                     |
| `team_types_name_lower_unique_active` | `LOWER(name)` WHERE `deleted_at IS NULL` | UNIQUE (partial) | Name uniqueness for live records |
| `idx_team_types_status`               | `status`                                 | B-tree           | Status filter                    |
| `idx_team_types_deleted_at`           | `deleted_at`                             | B-tree           | Soft-delete filter               |
| `idx_team_types_created_at_id`        | `created_at ASC, id ASC`                 | B-tree           | Keyset pagination                |

### `teams`

| Index name                       | Columns                                  | Type             | Purpose                          |
| -------------------------------- | ---------------------------------------- | ---------------- | -------------------------------- |
| `teams_pkey`                     | `id`                                     | PRIMARY KEY      | Row identity                     |
| `teams_name_lower_unique_active` | `LOWER(name)` WHERE `deleted_at IS NULL` | UNIQUE (partial) | Name uniqueness for live records |
| `idx_teams_team_type_id`         | `team_type_id`                           | B-tree           | Team type filter + FK scan       |
| `idx_teams_status`               | `status`                                 | B-tree           | Status filter                    |
| `idx_teams_deleted_at`           | `deleted_at`                             | B-tree           | Soft-delete filter               |
| `idx_teams_created_at_id`        | `created_at ASC, id ASC`                 | B-tree           | Keyset pagination                |

### `staff_teams`

| Index name                | Columns               | Type        | Purpose                                     |
| ------------------------- | --------------------- | ----------- | ------------------------------------------- |
| `staff_teams_pkey`        | `(staff_id, team_id)` | PRIMARY KEY | Composite uniqueness + staff-prefix lookups |
| `idx_staff_teams_team_id` | `team_id`             | B-tree      | Member count + member list queries          |

---

## 7 Schema Barrel Update

**File**: `apps/api/src/db/tenant/schemas/index.ts`

Add the following lines (in alphabetical order of filename):

```typescript
export * from "./staff-teams.schema";
export * from "./team-types.schema";
export * from "./teams.schema";
```

---

## 8 Domain Core Barrel Update

**File**: `packages/domain-core/src/index.ts`

Add:

```typescript
export * from "./teams";
```

**File**: `packages/domain-core/src/teams/index.ts`

```typescript
export * from "./teams.errors";
export * from "./teams.service";
export {
  type AuditContext,
  type CreateTeamInput,
  type CreateTeamTypeInput,
  type DbClient,
  type ListTeamsInput,
  type ListTeamsResult,
  type ListTeamTypesInput,
  type ListTeamTypesResult,
  type StaffTeamRow,
  type TeamRow,
  TeamStatus,
  type TeamTypeRow,
  type UpdateTeamInput,
  type UpdateTeamTypeInput,
} from "./teams.types";
```

---

## 9 Soft Delete Convention

Consistent with `groups`, `departments`, `divisions` convention in this codebase:

- `deleted_at TIMESTAMPTZ` column, nullable. `NULL` = active.
- Set to `NOW()` at soft-delete time inside the write transaction.
- All `find*` and `list*` repository functions filter `WHERE deleted_at IS NULL`.
- `findById` queries treat a non-null `deleted_at` as "not found" (returns `null`).
- `INSERT ... ON CONFLICT DO NOTHING` is safe because soft-deleted rows remain in the table; only the partial unique index scopes uniqueness to live rows.

---

## 10 Constitutional Compliance

| Constraint                      | Status                                               |
| ------------------------------- | ---------------------------------------------------- |
| All tables in tenant DB only    | ✓                                                    |
| No cross-tenant joins           | ✓                                                    |
| No global DB singleton          | ✓ — `DbClient` injected                              |
| Server-authoritative timestamps | ✓ — `DEFAULT NOW()`                                  |
| Soft delete only                | ✓ — `deleted_at` column                              |
| Academic isolation              | ✓ — no FK into academic tables                       |
| `max_members` DB-layer CHECK    | ✓ — `CHECK (max_members IS NULL OR max_members > 0)` |
| Forward-only migration          | ✓ — `down()` throws                                  |
| `schema_version` bumped         | ✓ — `1.9.0 → 1.10.0`                                 |
