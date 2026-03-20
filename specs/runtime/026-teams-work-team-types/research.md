# Research Notes — Teams & Work Team Types

**Stage**: `STAGE_26_TEAMS`  
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`  
**Date**: 2026-03-19

---

## Summary

No blocking unknowns require external research for this stage. All technical decisions were resolved by reading the spec (including the Clarifications section from Session 2026-03-19) and by inspecting the existing codebase patterns from prior stages (`STAGE_24_GROUPS`, `STAGE_23_DEPARTMENTS`, `STAGE_22_DIVISIONS`).

The findings below record confirmed decisions and their rationale.

---

## Resolved Decisions

### R-01 — RBAC Permission Codes

**Decision**: Three distinct codes — `team_types:manage`, `teams:manage`, `staff_teams:assign`.  
**Rationale**: Codified in FR-031 and confirmed in the Clarifications session. Holding `teams:manage` does NOT implicitly grant `staff_teams:assign`. Default admin holds all three; team coordinators may hold only `staff_teams:assign`.  
**Source**: spec.md Clarifications — Session 2026-03-19.

---

### R-02 — Idempotent Assignment Transaction Order

**Decision**: `SELECT FOR UPDATE` on `teams` row fires **unconditionally first**, before any pre-check for an existing assignment.  
**Rationale**: Eliminates the TOCTOU window entirely. Order: (1) lock, (2) idempotency check, (3) status check, (4) capacity check, (5) `INSERT ON CONFLICT DO NOTHING`.  
**Source**: spec.md Clarifications + FR-014.

---

### R-03 — Partial Unique Indexes on Name Columns

**Decision**: Both `team_types.name` and `teams.name` use `UNIQUE (LOWER(name)) WHERE deleted_at IS NULL` partial functional indexes.  
**Rationale**: Soft-deleted records must not block name reuse. Case-insensitive matching (via `LOWER()`) is consistent with the `groups` stage convention. `409` errors fire only when a live row with that name exists.  
**Source**: spec.md Clarifications + FR-002, FR-005.

---

### R-04 — schema_version Enforcement Semantics

**Decision**: Minimum-version check (`>= MIN_SCHEMA_VERSION`), not exact equality. Tenants below `1.10.0` receive `409 SCHEMA_VERSION_MISMATCH` before any team business logic runs. Tenants above `1.10.0` are forward-compatible.  
**Source**: spec.md Clarifications + License & Version Enforcement section.

---

### R-05 — NOT_FOUND Error Codes for Path Parameters

**Decision**: `TEAM_TYPE_NOT_FOUND` (404) for all GET/PUT/DELETE team-type-by-id operations. `TEAM_NOT_FOUND` (404) for all GET/PUT/DELETE team-by-id operations and for assignment/removal endpoints when the `team_id` does not resolve to a live record.  
**Source**: spec.md Clarifications + FR-032.

---

### R-06 — `status` Column Type Convention

**Decision**: `VARCHAR(20) + DB CHECK constraint` — not a PostgreSQL enum type.  
**Rationale**: Consistent with `groups`, `departments`, `divisions` convention in this codebase. PostgreSQL enums require DDL to add new values; VARCHAR + CHECK allows forward extension via migration only. Values validated at service layer before DB write.  
**Source**: Inspection of `20260319_001_groups.ts` and `groups.schema.ts`.

---

### R-07 — Migration File Numbering

**Decision**: `20260319_004_teams.ts` — the fourth migration file created on 2026-03-19.  
**Rationale**: Existing migrations on this date: `20260319_001_groups.ts`, `20260319_002_hierarchy_nodes.ts`, `20260319_003_add_hierarchy_node_id_to_users.ts`.  
**Source**: Inspection of `apps/api/src/db/tenant/migrations/`.

---

### R-08 — `countReportingReferences` Forward-Proof Stub

**Decision**: Implement `countReportingReferences(db, teamId)` as a SAVEPOINT-guarded query that catches PostgreSQL error `42P01` (undefined table) and returns `0`.  
**Rationale**: Reporting configuration tables do not exist in this stage (confirmed in spec Assumptions). The guard must compile and pass all tests today while being correct the moment reporting tables are introduced.  
**Source**: spec.md Assumptions — "TEAM_REFERENCED_BY_REPORTING is implemented as a forward-proof reference check that returns false (no block) until reporting tables are introduced."  
**Implementation pattern**:

```sql
SAVEPOINT check_reporting;
SELECT COUNT(*)::int FROM team_reporting_configurations WHERE team_id = $1;
-- on 42P01: ROLLBACK TO SAVEPOINT check_reporting → return 0
RELEASE SAVEPOINT check_reporting;
```

---

### R-09 — `FOR UPDATE NOWAIT` vs `FOR UPDATE`

**Decision**: Use `FOR UPDATE NOWAIT` on the `lockTeamForUpdate` query.  
**Rationale**: `NOWAIT` prevents a blocked transaction from waiting indefinitely for the lock. Under high concurrency, the second concurrent assignment immediately receives a lock-acquisition error, which the service translates into `TEAM_MAX_MEMBERS_EXCEEDED` after retrying the count check once the first transaction commits. This keeps API latency bounded.  
**Codebase pattern**: `groups.repository.ts` uses `SELECT ... FOR UPDATE` (without NOWAIT). Using NOWAIT is a minor improvement appropriate to the high-concurrency test requirement stated in the spec (10 simultaneous requests).

---

### R-10 — `teams.team_type_id` FK Delete Behavior

**Decision**: `ON DELETE SET NULL` on `teams.team_type_id → team_types(id)`.  
**Rationale**: If a `team_types` row were ever hard-deleted (manual maintenance), the associated teams gracefully become unclassified (`team_type_id = null`) rather than being cascade-deleted. This preserves existing team operational data. In normal operation, `team_types` use soft-delete, so this CASCADE fires only as a safety net.  
**Source**: spec.md Data Model — teams table definition.

---

### R-11 — Drizzle vs Raw SQL for Partial Functional Indexes

**Decision**: Partial functional UNIQUE indexes are **owned by the migration only** and are **not** re-declared via `uniqueIndex()` in Drizzle schema files.  
**Rationale**: Drizzle ORM cannot express `UNIQUE (LOWER(name)) WHERE deleted_at IS NULL`. Declaring a plain `uniqueIndex()` would generate a conflicting non-partial, case-sensitive UNIQUE constraint. This pattern is already established by `groups.schema.ts`.  
**Source**: Inspection of `apps/api/src/db/tenant/schemas/groups.schema.ts` (JSDoc note).

---

## No Remaining Unknowns

All NEEDS CLARIFICATION items from the initial spec pass-through have been resolved above. Implementation may proceed directly from `plan.md` and `data-model.md`.
