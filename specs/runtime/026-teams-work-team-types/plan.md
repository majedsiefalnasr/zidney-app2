# Technical Implementation Plan — Teams & Work Team Types

**Stage**: `STAGE_26_TEAMS`  
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`  
**Spec**: `specs/runtime/026-teams-work-team-types/spec.md`  
**Schema version bump**: `1.9.0 → 1.10.0`  
**Date**: 2026-03-19  
**Status**: PLAN

---

## 1 Overview

This plan covers the full backend implementation of Teams and Team Types for the Zidney Backoffice. Three new tenant-DB tables are introduced (`team_types`, `teams`, `staff_teams`). All business logic lives in `packages/domain-core/src/teams/`. API routes live under `apps/api/src/routes/backoffice/teams/`. One forward-only migration bumps `schema_version` to `1.10.0`. No existing tables are modified.

---

## 2 Architecture Invariants

| Rule                        | Enforcement                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Database-per-tenant         | All DB access from `tenant.pool` injected via Hono context; no global singleton                       |
| License middleware required | All routes: tenant resolver → license check → RBAC → handler                                          |
| No `console.log`            | All logging via `@zidney/logger` `createLogger()`                                                     |
| Server-authoritative time   | All `created_at`, `updated_at`, `deleted_at` set by `NOW()` at the DB layer                           |
| Soft delete only            | `deleted_at` timestamptz column; hard delete is forbidden                                             |
| Academic isolation          | `teams` / `team_types` MUST NOT appear in content, exam, advertisement, or student-visibility queries |
| Forward-only migration      | `down()` throws; rollback = snapshot restore                                                          |

---

## 3 File Inventory

### 3.1 New Files

| Path                                                                       | Purpose                               |
| -------------------------------------------------------------------------- | ------------------------------------- |
| `apps/api/src/db/tenant/migrations/20260319_004_teams.ts`                  | Forward-only DDL migration            |
| `apps/api/src/db/tenant/schemas/team-types.schema.ts`                      | Drizzle ORM schema for `team_types`   |
| `apps/api/src/db/tenant/schemas/teams.schema.ts`                           | Drizzle ORM schema for `teams`        |
| `apps/api/src/db/tenant/schemas/staff-teams.schema.ts`                     | Drizzle ORM schema for `staff_teams`  |
| `packages/domain-core/src/teams/teams.types.ts`                            | TypeScript types and interfaces       |
| `packages/domain-core/src/teams/teams.errors.ts`                           | Custom error class + error codes      |
| `packages/domain-core/src/teams/teams.repository.ts`                       | Raw SQL repository functions          |
| `packages/domain-core/src/teams/teams.service.ts`                          | Business logic service functions      |
| `packages/domain-core/src/teams/index.ts`                                  | Public barrel export                  |
| `packages/domain-core/src/teams/__tests__/teams.service.test.ts`           | Unit tests                            |
| `apps/api/src/routes/backoffice/teams/helpers.ts`                          | Shared route utilities + error mapper |
| `apps/api/src/routes/backoffice/teams/list-team-types.ts`                  | GET /team-types                       |
| `apps/api/src/routes/backoffice/teams/create-team-type.ts`                 | POST /team-types                      |
| `apps/api/src/routes/backoffice/teams/get-team-type.ts`                    | GET /team-types/:id                   |
| `apps/api/src/routes/backoffice/teams/update-team-type.ts`                 | PATCH /team-types/:id                 |
| `apps/api/src/routes/backoffice/teams/delete-team-type.ts`                 | DELETE /team-types/:id                |
| `apps/api/src/routes/backoffice/teams/list-teams.ts`                       | GET /teams                            |
| `apps/api/src/routes/backoffice/teams/create-team.ts`                      | POST /teams                           |
| `apps/api/src/routes/backoffice/teams/get-team.ts`                         | GET /teams/:id                        |
| `apps/api/src/routes/backoffice/teams/update-team.ts`                      | PATCH /teams/:id                      |
| `apps/api/src/routes/backoffice/teams/delete-team.ts`                      | DELETE /teams/:id                     |
| `apps/api/src/routes/backoffice/teams/get-team-members.ts`                 | GET /teams/:id/members                |
| `apps/api/src/routes/backoffice/teams/assign-staff-team.ts`                | POST /teams/:id/members               |
| `apps/api/src/routes/backoffice/teams/remove-staff-team.ts`                | DELETE /teams/:id/members/:staffId    |
| `apps/api/src/routes/backoffice/teams/index.ts`                            | Hono router factory                   |
| `apps/api/src/routes/backoffice/teams/__tests__/teams.integration.test.ts` | Integration tests                     |

### 3.2 Modified Files

| Path                                           | Change                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/db/tenant/schemas/index.ts`      | Add `export * from './team-types.schema'`, `export * from './teams.schema'`, `export * from './staff-teams.schema'` |
| `packages/domain-core/src/index.ts`            | Add `export * from './teams'`                                                                                       |
| `apps/api/src/routes/backoffice/<main router>` | Mount `teamsRouter` under `/backoffice`                                                                             |

---

## 4 Migration File

**File**: `apps/api/src/db/tenant/migrations/20260319_004_teams.ts`

**Schema version**: `1.9.0 → 1.10.0`

### Structure

```
BEGIN
  STEP 1: CREATE TABLE team_types       (+ CHECK, indexes, partial unique index)
  STEP 2: CREATE TABLE teams            (+ CHECK, FK → team_types, indexes, partial unique index)
  STEP 3: CREATE TABLE staff_teams      (+ composite PK, FK cascades, index)
  STEP 4: UPDATE _schema_versions SET version = '1.10.0'
COMMIT
```

### STEP 1 — `team_types`

```sql
CREATE TABLE IF NOT EXISTS team_types (
  id            UUID         NOT NULL DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  status        VARCHAR(20)  NOT NULL DEFAULT 'ENABLED'
                  CONSTRAINT team_types_status_check
                    CHECK (status IN ('ENABLED', 'DISABLED')),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT team_types_pkey PRIMARY KEY (id)
);

-- Partial functional unique index: case-insensitive name uniqueness for live records only.
-- Soft-deleted records do not block name reuse (FR-002).
-- Drizzle cannot express partial functional indexes; owned by this migration alone.
CREATE UNIQUE INDEX IF NOT EXISTS team_types_name_lower_unique_active
  ON team_types (LOWER(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_team_types_status
  ON team_types (status);

CREATE INDEX IF NOT EXISTS idx_team_types_deleted_at
  ON team_types (deleted_at);

CREATE INDEX IF NOT EXISTS idx_team_types_created_at_id
  ON team_types (created_at ASC, id ASC);
```

### STEP 2 — `teams`

```sql
CREATE TABLE IF NOT EXISTS teams (
  id            UUID         NOT NULL DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  team_type_id  UUID,
  max_members   INTEGER
                  CONSTRAINT teams_max_members_check
                    CHECK (max_members IS NULL OR max_members > 0),
  description   TEXT,
  status        VARCHAR(20)  NOT NULL DEFAULT 'ENABLED'
                  CONSTRAINT teams_status_check
                    CHECK (status IN ('ENABLED', 'DISABLED')),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT teams_pkey
    PRIMARY KEY (id),
  CONSTRAINT teams_team_type_id_fkey
    FOREIGN KEY (team_type_id)
      REFERENCES team_types(id) ON DELETE SET NULL
);

-- Partial functional unique index: per-workspace name uniqueness for live teams only (FR-005).
CREATE UNIQUE INDEX IF NOT EXISTS teams_name_lower_unique_active
  ON teams (LOWER(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_teams_team_type_id
  ON teams (team_type_id);

CREATE INDEX IF NOT EXISTS idx_teams_status
  ON teams (status);

CREATE INDEX IF NOT EXISTS idx_teams_deleted_at
  ON teams (deleted_at);

CREATE INDEX IF NOT EXISTS idx_teams_created_at_id
  ON teams (created_at ASC, id ASC);
```

### STEP 3 — `staff_teams`

```sql
CREATE TABLE IF NOT EXISTS staff_teams (
  staff_id   UUID        NOT NULL,
  team_id    UUID        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT staff_teams_pkey
    PRIMARY KEY (staff_id, team_id),
  CONSTRAINT staff_teams_staff_id_fkey
    FOREIGN KEY (staff_id)
      REFERENCES backoffice_staff_users(id) ON DELETE CASCADE,
  CONSTRAINT staff_teams_team_id_fkey
    FOREIGN KEY (team_id)
      REFERENCES teams(id) ON DELETE CASCADE
);

-- Index for team member count queries and member-list endpoint.
-- Composite PK (staff_id, team_id) covers staff_id-prefix lookups without extra index.
CREATE INDEX IF NOT EXISTS idx_staff_teams_team_id
  ON staff_teams (team_id);
```

> **Architectural note — CASCADE vs soft-delete**: `teams` uses soft-delete. The `ON DELETE CASCADE` on `staff_teams.team_id` will not fire in normal operation because `teams` rows are never hard-deleted. The cascade exists solely as a safety net for manual DB maintenance. Service-layer logic must rely on soft-delete guards, not this FK cascade.

### STEP 4 — schema_version bump

```sql
UPDATE _schema_versions
  SET version = '1.10.0'
  WHERE name = 'schema_version';
```

---

## 5 Drizzle ORM Schemas

See `data-model.md` for full TypeScript schema definitions.

Key design decisions:

- `status` columns use `varchar(20)` + DB `CHECK` constraint (not PG enum) — consistent with codebase convention (`groups`, `departments`, `divisions`).
- Partial functional unique indexes (`WHERE deleted_at IS NULL`) are owned by the migration only; no `uniqueIndex()` declaration in Drizzle to avoid generating a conflicting plain UNIQUE constraint.
- `team_types.id` FK in `teams` is declared with `onDelete: 'set null'` to reflect the DDL cascade; if the team type row is deleted from the DB it sets `team_type_id = null` (soft-delete guard runs first at service layer).

---

## 6 Domain Package — `packages/domain-core/src/teams/`

### 6.1 Error Codes

```typescript
export type TeamsErrorCode =
  | "TEAM_TYPE_NOT_FOUND" // 404
  | "TEAM_NOT_FOUND" // 404
  | "TEAM_STAFF_ASSIGNMENT_NOT_FOUND" // 404
  | "TEAM_TYPE_NAME_DUPLICATE" // 409
  | "TEAM_NAME_DUPLICATE" // 409
  | "TEAM_TYPE_DISABLED" // 422
  | "TEAM_TYPE_HAS_TEAMS" // 422
  | "TEAM_DISABLED" // 422
  | "TEAM_HAS_ASSIGNMENTS" // 422
  | "TEAM_REFERENCED_BY_REPORTING" // 422
  | "TEAM_MAX_MEMBERS_EXCEEDED" // 422
  | "VALIDATION_ERROR"; // 422
```

HTTP status mapping:

| Code                              | Status |
| --------------------------------- | ------ |
| `TEAM_TYPE_NOT_FOUND`             | 404    |
| `TEAM_NOT_FOUND`                  | 404    |
| `TEAM_STAFF_ASSIGNMENT_NOT_FOUND` | 404    |
| `TEAM_TYPE_NAME_DUPLICATE`        | 409    |
| `TEAM_NAME_DUPLICATE`             | 409    |
| `TEAM_TYPE_DISABLED`              | 422    |
| `TEAM_TYPE_HAS_TEAMS`             | 422    |
| `TEAM_DISABLED`                   | 422    |
| `TEAM_HAS_ASSIGNMENTS`            | 422    |
| `TEAM_REFERENCED_BY_REPORTING`    | 422    |
| `TEAM_MAX_MEMBERS_EXCEEDED`       | 422    |
| `VALIDATION_ERROR`                | 422    |

### 6.2 Repository Functions (`teams.repository.ts`)

```typescript
// Team Types
teamTypeNameExists(db, name, excludeId?): Promise<boolean>
findTeamTypeById(db, id): Promise<TeamTypeRow | null>
findTeamTypes(db, input): Promise<{ rows: TeamTypeRow[]; total: number }>
insertTeamType(db, data): Promise<TeamTypeRow>
updateTeamTypeRow(db, id, data): Promise<TeamTypeRow>
softDeleteTeamType(db, id): Promise<void>
countTeamsForType(db, teamTypeId): Promise<number>

// Teams
teamNameExists(db, name, excludeId?): Promise<boolean>
findTeamById(db, id): Promise<TeamRow | null>
findTeams(db, input): Promise<{ rows: TeamRow[]; total: number }>
insertTeam(db, data): Promise<TeamRow>
updateTeamRow(db, id, data): Promise<TeamRow>
softDeleteTeam(db, id): Promise<void>
lockTeamForUpdate(db, id): Promise<TeamRow | null>   // SELECT ... FOR UPDATE NOWAIT

// Staff Assignments
countStaffInTeam(db, teamId): Promise<number>
findStaffTeamAssignment(db, staffId, teamId): Promise<StaffTeamRow | null>
findTeamMembers(db, teamId, pagination: { limit: number; cursor?: string }): Promise<{ rows: StaffTeamRow[]; total: number }>
upsertStaffTeamAssignment(db, staffId, teamId): Promise<void>   // INSERT ... ON CONFLICT DO NOTHING
deleteStaffTeamAssignment(db, staffId, teamId): Promise<boolean>

// Reference checks
countReportingReferences(db, teamId): Promise<number>   // returns 0 until reporting tables exist
```

### 6.3 Service Functions (`teams.service.ts`)

#### Team Type Services

```typescript
listTeamTypes(db, input: ListTeamTypesInput): Promise<ListTeamTypesResult>
createTeamType(db, input: CreateTeamTypeInput, audit: AuditContext): Promise<TeamTypeRow>
getTeamTypeById(db, id: string): Promise<TeamTypeRow>
updateTeamType(db, id: string, input: UpdateTeamTypeInput, audit: AuditContext): Promise<TeamTypeRow>
deleteTeamType(db, id: string, audit: AuditContext): Promise<void>
```

#### Team Services

```typescript
listTeams(db, input: ListTeamsInput): Promise<ListTeamsResult>
createTeam(db, input: CreateTeamInput, audit: AuditContext): Promise<TeamRow>
getTeamById(db, id: string): Promise<TeamRow>
updateTeam(db, id: string, input: UpdateTeamInput, audit: AuditContext): Promise<TeamRow>
deleteTeam(db, id: string, audit: AuditContext): Promise<void>
```

#### Assignment Services

```typescript
listTeamMembers(db, teamId: string): Promise<StaffTeamRow[]>
assignStaffToTeam(db, teamId: string, staffId: string, audit: AuditContext): Promise<void>
removeStaffFromTeam(db, teamId: string, staffId: string, audit: AuditContext): Promise<void>
```

---

## 7 Transaction Boundaries

### 7.1 Create Team Type

```
BEGIN
  teamTypeNameExists(db, name)  → throw TEAM_TYPE_NAME_DUPLICATE on true
  insertTeamType(db, data)
COMMIT
```

### 7.2 Update Team Type

```
BEGIN
  findTeamTypeById(db, id)       → throw TEAM_TYPE_NOT_FOUND on null / deleted
  teamTypeNameExists(db, name, excludeId=id)  → throw TEAM_TYPE_NAME_DUPLICATE on true
  updateTeamTypeRow(db, id, data)
COMMIT
```

### 7.3 Delete Team Type

```
BEGIN
  findTeamTypeById(db, id)       → throw TEAM_TYPE_NOT_FOUND on null / deleted
  countTeamsForType(db, id)      → throw TEAM_TYPE_HAS_TEAMS if count > 0
  softDeleteTeamType(db, id)
COMMIT
```

### 7.4 Create Team

```
BEGIN
  teamNameExists(db, name)       → throw TEAM_NAME_DUPLICATE on true
  if team_type_id provided:
    findTeamTypeById(db, team_type_id)  → throw VALIDATION_ERROR if not found
    if type.status === 'DISABLED': throw TEAM_TYPE_DISABLED
  insertTeam(db, data)
COMMIT
```

### 7.5 Update Team

```
BEGIN
  findTeamById(db, id)           → throw TEAM_NOT_FOUND on null / deleted
  teamNameExists(db, name, excludeId=id)  → throw TEAM_NAME_DUPLICATE on true
  if team_type_id provided:
    findTeamTypeById(db, team_type_id)  → throw VALIDATION_ERROR if not found
    if type.status === 'DISABLED': throw TEAM_TYPE_DISABLED
  updateTeamRow(db, id, data)
COMMIT
```

**Edge case — reducing `max_members` below current count**: silently allowed. The service does not check current member count during updates. Existing assignments are unchanged; new assignments will be blocked at assignment time.

### 7.6 Delete Team

```
BEGIN
  findTeamById(db, id)             → throw TEAM_NOT_FOUND on null / deleted
  countStaffInTeam(db, id)         → throw TEAM_HAS_ASSIGNMENTS if count > 0
  countReportingReferences(db, id) → throw TEAM_REFERENCED_BY_REPORTING if count > 0
  softDeleteTeam(db, id)
COMMIT
```

`countReportingReferences` executes a SAVEPOINT-guarded query that catches `42P01` (table does not exist) and returns `0` — forward-proof until reporting tables exist.

### 7.7 Assign Staff to Team (FR-014)

This is the most complex transaction. The lock fires **unconditionally first** to eliminate TOCTOU:

```
BEGIN
  1. lockTeamForUpdate(db, teamId)
     → SELECT id, status, max_members FROM teams WHERE id = $1 AND deleted_at IS NULL FOR UPDATE NOWAIT
     → throw TEAM_NOT_FOUND if null
  2. findStaffTeamAssignment(db, staffId, teamId)
     → if row EXISTS: COMMIT and return success (idempotent short-circuit — FR-016)
  3. if team.status === 'DISABLED': throw TEAM_DISABLED
  4. if team.max_members IS NOT NULL:
       countStaffInTeam(db, teamId)
       if count >= team.max_members: throw TEAM_MAX_MEMBERS_EXCEEDED
  5. upsertStaffTeamAssignment(db, staffId, teamId)
     → INSERT INTO staff_teams (staff_id, team_id) VALUES ($1, $2)
       ON CONFLICT (staff_id, team_id) DO NOTHING
COMMIT
```

**Concurrency guarantee**: `lockTeamForUpdate` uses `FOR UPDATE NOWAIT`. Concurrent transactions will acquire the lock sequentially. Once the second transaction acquires the lock, the first has already committed the new member; the count will be at capacity and `TEAM_MAX_MEMBERS_EXCEEDED` is returned. No race condition possible.

### 7.8 Remove Staff from Team

```
BEGIN
  findTeamById(db, teamId)                 → throw TEAM_NOT_FOUND on null / deleted
  findStaffTeamAssignment(db, staffId, teamId)
    → throw TEAM_STAFF_ASSIGNMENT_NOT_FOUND if null
  deleteStaffTeamAssignment(db, staffId, teamId)
COMMIT
```

---

## 8 API Routes

All routes are mounted as a sub-router within the Backoffice router.

**Base path**: `https://{workspace_slug}.zidney.app/api/v1/backoffice/` (tenant resolver sets context before any handler runs).

**Correlation ID**: Every request must carry an `X-Correlation-ID` response header set by the tenant resolver middleware. All error responses include `{ "correlationId": "..." }` inside the error object.

Middleware stack applied to every route:

```
tenantResolverMiddleware → licenseMiddleware → rbacMiddleware(permission) → handler
```

### 8.1 Team Types Endpoints

| Method   | Path              | Permission          | Handler                 |
| -------- | ----------------- | ------------------- | ----------------------- |
| `GET`    | `/team-types`     | `team_types:manage` | `listTeamTypesHandler`  |
| `POST`   | `/team-types`     | `team_types:manage` | `createTeamTypeHandler` |
| `GET`    | `/team-types/:id` | `team_types:manage` | `getTeamTypeHandler`    |
| `PATCH`  | `/team-types/:id` | `team_types:manage` | `updateTeamTypeHandler` |
| `DELETE` | `/team-types/:id` | `team_types:manage` | `deleteTeamTypeHandler` |

#### GET /team-types

Query params:

- `status?: 'ENABLED' | 'DISABLED'`
- `limit?: number` (default 50, max 200)
- `cursor?: string` (opaque pagination cursor)

Response:

```json
{
  "success": true,
  "data": {
    "items": [TeamTypeRow, ...],
    "total": 42,
    "nextCursor": "..."
  },
  "error": null
}
```

#### POST /team-types

Body:

```json
{ "name": "string", "description": "string | null" }
```

Response: `201` `{ "success": true, "data": TeamTypeRow, "error": null }`

#### GET /team-types/:id

Response: `200` `{ "success": true, "data": TeamTypeRow, "error": null }`  
Error: `404` `TEAM_TYPE_NOT_FOUND`

#### PATCH /team-types/:id

Body (all fields optional — partial update):

```json
{ "name": "string?", "description": "string | null?", "status": "ENABLED | DISABLED?" }
```

Response: `200` `{ "success": true, "data": TeamTypeRow, "error": null }`

#### DELETE /team-types/:id

Response: `200` `{ "success": true, "data": { "deleted": true }, "error": null }`  
Error: `422` `TEAM_TYPE_HAS_TEAMS`

---

### 8.2 Teams Endpoints

| Method   | Path         | Permission     | Handler             |
| -------- | ------------ | -------------- | ------------------- |
| `GET`    | `/teams`     | `teams:manage` | `listTeamsHandler`  |
| `POST`   | `/teams`     | `teams:manage` | `createTeamHandler` |
| `GET`    | `/teams/:id` | `teams:manage` | `getTeamHandler`    |
| `PATCH`  | `/teams/:id` | `teams:manage` | `updateTeamHandler` |
| `DELETE` | `/teams/:id` | `teams:manage` | `deleteTeamHandler` |

#### GET /teams

Query params:

- `status?: 'ENABLED' | 'DISABLED'`
- `team_type_id?: UUID`
- `limit?: number` (default 50, max 200)
- `cursor?: string`

Response:

```json
{
  "success": true,
  "data": {
    "items": [TeamRow, ...],
    "total": 100,
    "nextCursor": "..."
  },
  "error": null
}
```

#### POST /teams

Body:

```json
{
  "name": "string",
  "team_type_id": "UUID | null",
  "max_members": "integer | null",
  "description": "string | null"
}
```

Response: `201` `{ "success": true, "data": TeamRow, "error": null }`

#### GET /teams/:id

Response: `200` `{ "success": true, "data": TeamRow, "error": null }`  
Error: `404` `TEAM_NOT_FOUND`

#### PATCH /teams/:id

Body (all fields optional — partial update): same fields as POST

Response: `200` `{ "success": true, "data": TeamRow, "error": null }`

#### DELETE /teams/:id

Response: `200` `{ "success": true, "data": { "deleted": true }, "error": null }`  
Errors: `422` `TEAM_HAS_ASSIGNMENTS` | `TEAM_REFERENCED_BY_REPORTING`

---

### 8.3 Staff Assignment Endpoints

| Method   | Path                          | Permission           | Handler                  |
| -------- | ----------------------------- | -------------------- | ------------------------ |
| `GET`    | `/teams/:id/members`          | `staff_teams:assign` | `getTeamMembersHandler`  |
| `POST`   | `/teams/:id/members`          | `staff_teams:assign` | `assignStaffTeamHandler` |
| `DELETE` | `/teams/:id/members/:staffId` | `staff_teams:assign` | `removeStaffTeamHandler` |

#### GET /teams/:id/members

Query params:

- `limit?: number` (default 50, max 200)
- `cursor?: string` (opaque pagination cursor — last `staff_id` of previous page)

Response:

```json
{
  "success": true,
  "data": {
    "items": [StaffTeamRow, ...],
    "total": 42,
    "nextCursor": "uuid-or-null"
  },
  "error": null
}
```

#### POST /teams/:id/members

Body: `{ "staff_id": "UUID" }`

Response: `200` `{ "success": true, "data": { "assigned": true }, "error": null }`  
Errors: `422` `TEAM_DISABLED` | `422` `TEAM_MAX_MEMBERS_EXCEEDED`  
Idempotent: re-posting same `(staff_id, team_id)` returns the same `200` success without a duplicate row.

#### DELETE /teams/:id/members/:staffId

Response: `200` `{ "success": true, "data": { "removed": true }, "error": null }`  
Error: `404` `TEAM_STAFF_ASSIGNMENT_NOT_FOUND`

---

## 9 Router Registration

**File**: `apps/api/src/routes/backoffice/teams/index.ts`

Route registration order (CRITICAL — exact routes before parameterized):

```typescript
// Team Types — exact routes first
router.get("/team-types", rbac("team_types:manage"), listTeamTypesHandler);
router.post("/team-types", rbac("team_types:manage"), createTeamTypeHandler);
router.get("/team-types/:id", rbac("team_types:manage"), getTeamTypeHandler);
router.patch("/team-types/:id", rbac("team_types:manage"), updateTeamTypeHandler);
router.delete("/team-types/:id", rbac("team_types:manage"), deleteTeamTypeHandler);

// Teams — list and create before detail
router.get("/teams", rbac("teams:manage"), listTeamsHandler);
router.post("/teams", rbac("teams:manage"), createTeamHandler);

// Teams — members sub-resource BEFORE /:id to prevent param conflict
router.get("/teams/:id/members", rbac("staff_teams:assign"), getTeamMembersHandler);
router.post("/teams/:id/members", rbac("staff_teams:assign"), assignStaffTeamHandler);
router.delete("/teams/:id/members/:staffId", rbac("staff_teams:assign"), removeStaffTeamHandler);

// Teams — detail
router.get("/teams/:id", rbac("teams:manage"), getTeamHandler);
router.patch("/teams/:id", rbac("teams:manage"), updateTeamHandler);
router.delete("/teams/:id", rbac("teams:manage"), deleteTeamHandler);
```

---

## 10 Middleware Layers

```
Request
  │
  ▼
tenantResolverMiddleware          ← resolves workspace from slug/subdomain; injects tenant.pool
  │
  ▼
licenseMiddleware                 ← checks status; returns 423/403/404/409 on non-ACTIVE
  │                                 (schema_version >= MIN_SCHEMA_VERSION enforced here)
  ▼
authMiddleware                    ← verifies JWT; injects user into context
  │
  ▼
rbacMiddleware(permission_code)   ← checks user holds required permission; 403 on failure
  │
  ▼
handler                           ← validates input, calls domain service
```

`MIN_SCHEMA_VERSION` must be updated to `1.10.0` in the license middleware constant after this migration is deployed.

---

## 11 Input Validation

Validation schemas live in `packages/validation/src/backoffice/teams.schemas.ts`.

| Field          | Rule                                         |
| -------------- | -------------------------------------------- |
| `name`         | `string`, min 1 char, max 255 chars, trimmed |
| `description`  | `string \| null`, optional                   |
| `status`       | `'ENABLED' \| 'DISABLED'`                    |
| `team_type_id` | valid UUID or `null`                         |
| `max_members`  | positive integer (`> 0`) or `null`           |
| `staff_id`     | valid UUID                                   |

All validation failures return `422 VALIDATION_ERROR` with field-level messages.

---

## 12 Error Response Contract

All error responses follow the platform contract (no unstructured responses):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TEAM_DISABLED",
    "message": "Cannot assign staff to a disabled team.",
    "correlationId": "3f2a1b4c-0d9e-4f7a-b6c5-1a2b3c4d5e6f"
  }
}
```

---

## 13 Idempotency Strategy

| Operation        | Idempotency Mechanism                                              | Double-submit result           |
| ---------------- | ------------------------------------------------------------------ | ------------------------------ |
| Create team type | Partial unique index `(LOWER(name)) WHERE deleted_at IS NULL`      | 409 `TEAM_TYPE_NAME_DUPLICATE` |
| Create team      | Partial unique index `(LOWER(name)) WHERE deleted_at IS NULL`      | 409 `TEAM_NAME_DUPLICATE`      |
| Assign staff     | Composite PK check inside TX + `INSERT ... ON CONFLICT DO NOTHING` | 200 success, no duplicate      |
| Delete team type | `findTeamTypeById` inside TX → 404 if already deleted              | 404 `TEAM_TYPE_NOT_FOUND`      |
| Delete team      | `findTeamById` inside TX → 404 if already deleted                  | 404 `TEAM_NOT_FOUND`           |

---

## 14 Structured Logging Fields

Every service call must emit logs with these fields:

```typescript
{
  timestamp,       // ISO 8601 — set by logger
  level,           // 'info' | 'warn' | 'error'
  service,         // 'backoffice-api'
  workspace_slug,  // from AuditContext
  workspace_id,    // from AuditContext
  user_id,         // from AuditContext
  correlation_id,  // from AuditContext
  resource_type,   // 'team_type' | 'team'
  resource_id,     // UUID of entity (if known)
  action,          // 'create' | 'update' | 'delete' | 'assign' | 'remove' | 'list' | 'get'
}
```

---

## 15 Academic Isolation Guardrail

The following is a hard constitutional constraint. Any code review must check:

- No `teams` table join appears in any query involving `exams`, `advertisements`, `notifications`, `student_groups`, `divisions`, or `departments`.
- No `team_id` column or FK is added to any academic data table by this stage.
- No route handler returns team data in any student-facing or exam-facing response.

A failing academic regression test suite (`tests/academic-isolation-regression.ts`) must confirm zero contamination post-merge.

---

## 16 Test Strategy

### 16.1 Unit Tests (`packages/domain-core/src/teams/__tests__/teams.service.test.ts`)

| Test                                                                | Coverage target |
| ------------------------------------------------------------------- | --------------- |
| `createTeamType` — duplicate name → `TEAM_TYPE_NAME_DUPLICATE`      | FR-002          |
| `createTeamType` — empty name → `VALIDATION_ERROR`                  | FR-030          |
| `deleteTeamType` — has active teams → `TEAM_TYPE_HAS_TEAMS`         | FR-021          |
| `deleteTeamType` — no teams → success                               | FR-022          |
| `createTeam` — DISABLED type → `TEAM_TYPE_DISABLED`                 | FR-006, FR-023  |
| `createTeam` — `max_members = 0` → `VALIDATION_ERROR`               | FR-007          |
| `createTeam` — valid `max_members = null` → success                 | FR-007          |
| `assignStaffToTeam` — DISABLED team → `TEAM_DISABLED`               | FR-013          |
| `assignStaffToTeam` — same assignment twice → idempotent success    | FR-016          |
| `assignStaffToTeam` — at capacity → `TEAM_MAX_MEMBERS_EXCEEDED`     | FR-015          |
| `assignStaffToTeam` — `max_members = null` → no capacity block      | FR-007          |
| `deleteTeam` — has assignments → `TEAM_HAS_ASSIGNMENTS`             | FR-017          |
| `deleteTeam` — reporting reference → `TEAM_REFERENCED_BY_REPORTING` | FR-018          |
| Soft delete marker: deleted team not returned in `findTeamById`     | FR-020          |

### 16.2 Integration Tests (`apps/api/src/routes/backoffice/teams/__tests__/teams.integration.test.ts`)

| Scenario                                 | Assertions                                          |
| ---------------------------------------- | --------------------------------------------------- |
| Team type full CRUD lifecycle            | create → list → get → update → delete               |
| Team full CRUD lifecycle                 | create → list → get → update → delete               |
| Staff assignment happy path              | assign → get members → remove → not found           |
| Assign to DISABLED team                  | `422 TEAM_DISABLED`                                 |
| Assign to team at `max_members`          | `422 TEAM_MAX_MEMBERS_EXCEEDED`                     |
| Idempotent re-assignment                 | second POST returns `200`, row count stays 1        |
| Team delete blocked by assignment        | `422 TEAM_HAS_ASSIGNMENTS`                          |
| Team type delete blocked by team         | `422 TEAM_TYPE_HAS_TEAMS`                           |
| Soft-delete: list hides deleted entities | `total` decreases; detail returns `404`             |
| License SOFT_LOCKED workspace            | `423` on all team endpoints                         |
| License ARCHIVED workspace               | `403` on all team endpoints                         |
| Non-existent team GET/PUT/DELETE         | `404 TEAM_NOT_FOUND`                                |
| Non-existent team type GET/PUT/DELETE    | `404 TEAM_TYPE_NOT_FOUND`                           |
| Schema version mismatch                  | `409 SCHEMA_VERSION_MISMATCH` before business logic |
| Missing RBAC permission                  | `403 Forbidden`                                     |
| Filter by `status=DISABLED`              | only disabled records returned                      |
| Filter by `team_type_id`                 | only teams of that type returned                    |

### 16.3 Transaction Rollback Tests

| Scenario                                               | Assertion                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| 10 concurrent assigns to a team with `max_members = 1` | exactly 1 succeeds; 9 get `422`; `staff_teams` row count = 1 |
| Concurrent assign-and-delete race                      | no partial delete; state consistent after both calls         |

### 16.4 Isolation Tests

| Scenario                                                          | Assertion                              |
| ----------------------------------------------------------------- | -------------------------------------- |
| Tenant A creates teams; tenant B lists                            | tenant B sees zero of tenant A's teams |
| `staff_teams` rows from tenant A not accessible via tenant B pool | confirmed via direct DB query          |

### 16.5 Academic Regression Tests

| Assertion                                                                                               |
| ------------------------------------------------------------------------------------------------------- |
| No `team_id` column in `students`, `exams`, `groups`, `departments`, `divisions` tables after migration |
| No `teams` join in exam-targeting queries                                                               |
| No `teams` join in advertisement-targeting queries                                                      |

---

## 17 Architecture Decision Notes

| ID    | Decision                                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------- |
| AD-01 | `status` as `VARCHAR(20) + CHECK` not PG enum — consistent with groups/departments convention               |
| AD-02 | Partial functional unique index `(LOWER(name)) WHERE deleted_at IS NULL` — soft-deleted names can be reused |
| AD-03 | `lockTeamForUpdate` uses `FOR UPDATE NOWAIT` — concurrent transactions serialize; no deadlock               |
| AD-04 | `SELECT FOR UPDATE` fires unconditionally first in assignment transaction — TOCTOU-safe                     |
| AD-05 | `countReportingReferences` uses SAVEPOINT guard catching `42P01` — forward-proof stub returning 0           |
| AD-06 | `teams_team_type_id_fkey` uses `ON DELETE SET NULL` — deleting a team type orphans its teams gracefully     |
| AD-07 | `staff_teams_team_id_fkey` uses `ON DELETE CASCADE` — soft-delete guard fires first; cascade is safety net  |
| AD-08 | `holding teams:manage` does NOT implicitly grant `staff_teams:assign` — separate gateway per FR-031         |

---

## 18 Dependencies

| Dependency                          | Status                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `backoffice_staff_users` table      | Exists (`STAGE_21_RBAC`)                                                                               |
| `departments` table                 | Exists (`STAGE_23_DEPARTMENTS`)                                                                        |
| RBAC permission system (`STAGE_21`) | Exists — permission codes `team_types:manage`, `teams:manage`, `staff_teams:assign` must be registered |
| `@zidney/logger`                    | Exists                                                                                                 |
| `@zidney/validation`                | Exists — add `teams.schemas.ts`                                                                        |
| `@zidney/domain-core`               | Exists — add `teams/` subdomain                                                                        |

---

## 19 Deployment Notes

1. Run migration: schema_version bumps from `1.9.0` to `1.10.0`.
2. Update `MIN_SCHEMA_VERSION` constant in license middleware to `1.10.0`.
3. Register RBAC permission codes (`team_types:manage`, `teams:manage`, `staff_teams:assign`) in the permissions seed if not already present.
4. Rollback = snapshot restore only (per ADR-0008).

---

## 20 Open Items

None. All clarifications resolved in spec Session 2026-03-19. See `spec.md#Clarifications`.
