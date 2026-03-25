# Testing Guide — Teams & Work Team Types

**Stage:** STAGE_26_TEAMS  
**Branch:** `spec/026-teams-work-team-types`  
**Prepared for:** QA Engineers and Reviewing Developers

---

## Overview

This guide explains how to manually test the Teams & Work Team Types feature. This implements
two-level hierarchy: **Team Types** (classification) → **Teams** (groups) with **Staff Assignments**
(many-to-many join). All endpoints are under `/backoffice`.

All routes require:

- A valid authenticated session (backoffice user)
- License middleware to pass (workspace must not be SOFT_LOCKED or ARCHIVED)
- Schema version compatibility (`schema_version >= 1.10.0`)

---

## Running Automated Tests

```bash
# Unit tests only (domain service)
bun run test packages/domain-core/src/teams/__tests__/teams.service.test.ts

# Integration tests only (API route handlers)
bun run test apps/api/src/routes/backoffice/teams/__tests__/teams.integration.test.ts

# Both together
bun run test \
  packages/domain-core/src/teams/__tests__/teams.service.test.ts \
  apps/api/src/routes/backoffice/teams/__tests__/teams.integration.test.ts
```

Expected: 56 tests pass (28 unit + 28 integration).

---

# Database Setup

Ensure you have run the teams migration against a tenant database:

```bash
# Run tenant migrations (includes 20260319_004_teams.ts)
bun run db:migrate -- --workspace <workspace-slug>
```

Verify tables exist:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('team_types', 'teams', 'staff_teams');
```

---

## API Base URL

All examples below assume:

```
BASE_URL = http://localhost:3000
WORKSPACE = your-workspace-slug
AUTH_HEADER = Authorization: Bearer <your-token>
```

Replace accordingly for staging.

---

## Test Scenarios

### 1. Team Types — Full CRUD

#### 1.1 Create a Team Type

```bash
curl -X POST "$BASE_URL/$WORKSPACE/backoffice/team-types" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"name": "Academic Department", "description": "Top-level academic unit"}'
```

**Expected:**

- Status: `201`
- Body: `{ "success": true, "data": { "id": "<uuid>", "name": "Academic Department", "status": "ENABLED", ... }, "error": null }`

#### 1.2 List Team Types

```bash
curl "$BASE_URL/$WORKSPACE/backoffice/team-types?limit=10" \
  -H "$AUTH_HEADER"
```

**Expected:**

- Status: `200`
- Body: `{ "success": true, "data": { "items": [...], "nextCursor": null }, "error": null }`

#### 1.3 Get Team Type By ID

```bash
curl "$BASE_URL/$WORKSPACE/backoffice/team-types/<type-uuid>" \
  -H "$AUTH_HEADER"
```

**Expected:**

- Status: `200` with the team type object
- If ID does not exist → Status `404`, `error.code = "TEAM_TYPE_NOT_FOUND"`

#### 1.4 Update Team Type

```bash
curl -X PATCH "$BASE_URL/$WORKSPACE/backoffice/team-types/<type-uuid>" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Department Name"}'
```

**Expected:**

- Status: `200` with updated team type

#### 1.5 Delete Team Type (when no teams exist under it)

```bash
curl -X DELETE "$BASE_URL/$WORKSPACE/backoffice/team-types/<type-uuid>" \
  -H "$AUTH_HEADER"
```

**Expected:**

- Status: `200`, `data: { deleted: true }`

#### 1.6 Delete Team Type (when teams exist under it)

Create a team referencing the type first, then try to delete the type.

**Expected:**

- Status: `422`, `error.code = "TEAM_TYPE_HAS_TEAMS"`

#### 1.7 Duplicate Name Guard

Create two team types with the same name.

**Expected on second:**

- Status: `409`, `error.code = "TEAM_TYPE_NAME_DUPLICATE"`

---

### 2. Teams — Full CRUD

#### 2.1 Create a Team

```bash
curl -X POST "$BASE_URL/$WORKSPACE/backoffice/teams" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"name": "Engineering Team A", "team_type_id": "<type-uuid>", "max_members": 20}'
```

**Expected:**

- Status: `201`
- Body: `{ "success": true, "data": { "id": "<uuid>", "name": "Engineering Team A", ... }, "error": null }`

#### 2.2 Create a Team without Team Type

```bash
curl -X POST "$BASE_URL/$WORKSPACE/backoffice/teams" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"name": "Standalone Team"}'
```

**Expected:** Status `201` (team_type_id is optional)

#### 2.3 Create a Team with a Disabled Team Type

Set the team type status to DISABLED first, then try to create a team referencing it.

**Expected:**

- Status: `422`, `error.code = "TEAM_TYPE_DISABLED"`

#### 2.4 List Teams with Filter

```bash
# Filter by status
curl "$BASE_URL/$WORKSPACE/backoffice/teams?status=ENABLED&limit=20" \
  -H "$AUTH_HEADER"

# Filter by team type
curl "$BASE_URL/$WORKSPACE/backoffice/teams?team_type_id=<type-uuid>" \
  -H "$AUTH_HEADER"
```

**Expected:** Status `200`, filtered list in `data.items`

#### 2.5 Get Team By ID

```bash
curl "$BASE_URL/$WORKSPACE/backoffice/teams/<team-uuid>" \
  -H "$AUTH_HEADER"
```

**Expected:** Status `200` with team object or `404` if not found.

#### 2.6 Update Team

```bash
curl -X PATCH "$BASE_URL/$WORKSPACE/backoffice/teams/<team-uuid>" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"max_members": 50, "status": "DISABLED"}'
```

**Expected:** Status `200` with updated team.

#### 2.7 Delete Team (when no staff assigned)

```bash
curl -X DELETE "$BASE_URL/$WORKSPACE/backoffice/teams/<team-uuid>" \
  -H "$AUTH_HEADER"
```

**Expected:** Status `200`, `data: { deleted: true }`

#### 2.8 Delete Team (when staff is assigned)

Assign a staff member first, then delete.

**Expected:**

- Status: `422`, `error.code = "TEAM_HAS_ASSIGNMENTS"`

---

### 3. Staff Assignment

#### 3.1 Assign Staff to Team

```bash
curl -X POST "$BASE_URL/$WORKSPACE/backoffice/teams/<team-uuid>/members" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"staffId": "<staff-uuid>"}'
```

Wait — `staffId` is taken from URL params in this implementation:

```bash
curl -X POST "$BASE_URL/$WORKSPACE/backoffice/teams/<team-uuid>/members/<staff-uuid>" \
  -H "$AUTH_HEADER"
```

**Expected:** Status `200`, `data: { assigned: true }`

**Idempotency:** Re-submitting the same assignment returns the same `200` response without error.

#### 3.2 Assign to Disabled Team

Disable the team first, then try to assign.

**Expected:**

- Status: `422`, `error.code = "TEAM_DISABLED"`

#### 3.3 Assign Non-Existent Staff

Use a UUID that does not match any backoffice staff record.

**Expected:**

- Status: `404`, `error.code = "STAFF_NOT_FOUND"`

#### 3.4 Exceed Max Members

Create a team with `max_members: 1`. Assign the first staff member (succeeds). Assign a second.

**Expected on second:**

- Status: `422`, `error.code = "TEAM_MAX_MEMBERS_EXCEEDED"`

#### 3.5 List Team Members

```bash
curl "$BASE_URL/$WORKSPACE/backoffice/teams/<team-uuid>/members?limit=20" \
  -H "$AUTH_HEADER"
```

**Expected:** Status `200`, list of staff members in `data.items`, cursor pagination.

#### 3.6 Remove Staff from Team

```bash
curl -X DELETE "$BASE_URL/$WORKSPACE/backoffice/teams/<team-uuid>/members/<staff-uuid>" \
  -H "$AUTH_HEADER"
```

**Expected:** Status `200`, `data: { removed: true }`

#### 3.7 Remove Non-Existent Assignment

```bash
curl -X DELETE "$BASE_URL/$WORKSPACE/backoffice/teams/<team-uuid>/members/<nonexistent-staff-uuid>" \
  -H "$AUTH_HEADER"
```

**Expected:** Status `404`, `error.code = "TEAM_STAFF_ASSIGNMENT_NOT_FOUND"`

---

### 4. Pagination Verification

#### 4.1 Cursor Pagination for Team Types

```bash
# First page
RESULT=$(curl -s "$BASE_URL/$WORKSPACE/backoffice/team-types?limit=2" -H "$AUTH_HEADER")
CURSOR=$(echo $RESULT | jq -r '.data.nextCursor')

# Next page
curl "$BASE_URL/$WORKSPACE/backoffice/team-types?limit=2&cursor=$CURSOR" -H "$AUTH_HEADER"
```

**Expected:** Second page returns next 2 records (no overlap with first page).
When no more records, `nextCursor` is `null`.

---

### 5. Error Contract Verification

Every error response must follow the standard envelope:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TEAM_TYPE_NOT_FOUND",
    "message": "Team type not found"
  }
}
```

Verify this format holds for all error scenarios listed above.

---

### 6. Tenant Isolation Verification

1. Create a team type in Workspace A.
2. Authenticate as a user in Workspace B.
3. Attempt to GET the team type created in Workspace A using its UUID.

**Expected:**

- Status: `404` (not visible in this workspace — tenant isolation enforced at DB level).

---

## DB Tables Created

| Table         | Purpose                                                          |
| ------------- | ---------------------------------------------------------------- |
| `team_types`  | Team type classification (soft-delete, per-workspace)            |
| `teams`       | Team instances linked to team types (soft-delete, per-workspace) |
| `staff_teams` | Many-to-many join between teams and backoffice staff             |

---

## Schema Version

After migration, `schema_version` in the workspace record should be `1.10.0`.
The `MIN_SCHEMA_VERSION` constant in `schema-version.middleware.ts` is now `1.10.0`.
