# Tasks — Teams & Work Team Types

**Stage**: STAGE_26_TEAMS
**Phase**: 03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE
**Generated**: 2026-03-19

---

## Phase 0 — Foundation

- [ ] T001 [MigrationDB] Create forward-only DDL migration bumping schema_version 1.9.0 → 1.10.0 — `apps/api/src/db/tenant/migrations/20260319_004_teams.ts`
- [ ] T001b [Config] Update MIN_SCHEMA_VERSION constant from '1.2.0' to '1.10.0' in the schema-version middleware — `apps/api/src/middleware/schema-version.middleware.ts`
- [ ] T002 [P] [Schema] Create Drizzle ORM schema for `team_types` table — `apps/api/src/db/tenant/schemas/team-types.schema.ts`
- [ ] T003 [P] [Schema] Create Drizzle ORM schema for `teams` table (imports team-types.schema) — `apps/api/src/db/tenant/schemas/teams.schema.ts`
- [ ] T004 [P] [Schema] Create Drizzle ORM schema for `staff_teams` join table (imports teams.schema + backoffice-staff-users.schema) — `apps/api/src/db/tenant/schemas/staff-teams.schema.ts`
- [ ] T005 [Schema] Export all three new schemas from the tenant schemas barrel — `apps/api/src/db/tenant/schemas/index.ts`

## Phase 1 — Domain

- [ ] T006 [P] [Domain] Create TypeScript types and interfaces (DbClient, AuditContext, TeamStatus, row interfaces, input/result types) — `packages/domain-core/src/teams/teams.types.ts`
- [ ] T007 [P] [Domain] Create custom TeamsError class and all error codes (TEAM_NOT_FOUND, TEAM_TYPE_NOT_FOUND, TEAM_STAFF_ASSIGNMENT_NOT_FOUND, STAFF_NOT_FOUND, TEAM_TYPE_NAME_DUPLICATE, TEAM_NAME_DUPLICATE, TEAM_TYPE_DISABLED, TEAM_TYPE_HAS_TEAMS, TEAM_DISABLED, TEAM_HAS_ASSIGNMENTS, TEAM_REFERENCED_BY_REPORTING, TEAM_MAX_MEMBERS_EXCEEDED, TEAM_LOCK_CONTENTION, VALIDATION_ERROR) — `packages/domain-core/src/teams/teams.errors.ts`
- [ ] T008 [Domain] Create all repository functions for team types (teamTypeNameExists, findTeamTypeById, findTeamTypes, insertTeamType, updateTeamTypeRow, softDeleteTeamType, countTeamsForType) — `packages/domain-core/src/teams/teams.repository.ts`
- [ ] T009 [Domain] Add all team repository functions to the same file (teamNameExists, findTeamById, findTeams, insertTeam, updateTeamRow, softDeleteTeam, lockTeamForUpdate) — `packages/domain-core/src/teams/teams.repository.ts`
- [ ] T010 [Domain] Add all staff-assignment repository functions to the same file (countStaffInTeam, findStaffTeamAssignment, findTeamMembers with pagination, upsertStaffTeamAssignment, deleteStaffTeamAssignment, countReportingReferences, checkStaffExistsInWorkspace) — `packages/domain-core/src/teams/teams.repository.ts`
- [ ] T011 [Domain] Create team type service functions with transaction guards (listTeamTypes, createTeamType, getTeamTypeById, updateTeamType, deleteTeamType) — `packages/domain-core/src/teams/teams.service.ts`
- [ ] T012 [Domain] Add team service functions with transaction guards (listTeams, createTeam, getTeamById, updateTeam, deleteTeam) — `packages/domain-core/src/teams/teams.service.ts`
- [ ] T013 [Domain] Add staff assignment service functions with SELECT FOR UPDATE transaction (listTeamMembers with cursor pagination + ListTeamMembersResult envelope, assignStaffToTeam with staff-existence pre-check, removeStaffFromTeam) — `packages/domain-core/src/teams/teams.service.ts`
- [ ] T014 [Domain] Create public barrel export for the teams domain package — `packages/domain-core/src/teams/index.ts`
- [ ] T015 [Domain] Add `export * from './teams'` to the domain-core barrel — `packages/domain-core/src/index.ts`
- [ ] T016 [P] [Domain] Create Zod validation schemas for all team and team type input shapes — `packages/validation/src/backoffice/teams.schemas.ts`

## Phase 2 — Routes

- [ ] T017 [Routes] Create shared route utilities and TeamsError-to-HTTP error mapper including PostgreSQL error code handling: PG 55P03 (lock_not_available) → 422 TEAM_LOCK_CONTENTION, PG 23503 (foreign_key_violation) → 404 STAFF_NOT_FOUND — `apps/api/src/routes/backoffice/teams/helpers.ts`
- [ ] T018 [P] [Routes] Create handler for GET /team-types (list with status filter and keyset pagination) — `apps/api/src/routes/backoffice/teams/list-team-types.ts`
- [ ] T019 [P] [Routes] Create handler for POST /team-types (create with 201 response) — `apps/api/src/routes/backoffice/teams/create-team-type.ts`
- [ ] T020 [P] [Routes] Create handler for GET /team-types/:id (get by ID, 404 on not found) — `apps/api/src/routes/backoffice/teams/get-team-type.ts`
- [ ] T021 [P] [Routes] Create handler for PATCH /team-types/:id (partial update) — `apps/api/src/routes/backoffice/teams/update-team-type.ts`
- [ ] T022 [P] [Routes] Create handler for DELETE /team-types/:id (soft delete, 422 guard) — `apps/api/src/routes/backoffice/teams/delete-team-type.ts`
- [ ] T023 [P] [Routes] Create handler for GET /teams (list with status and team_type_id filters, keyset pagination) — `apps/api/src/routes/backoffice/teams/list-teams.ts`
- [ ] T024 [P] [Routes] Create handler for POST /teams (create with team type validation, 201 response) — `apps/api/src/routes/backoffice/teams/create-team.ts`
- [ ] T025 [P] [Routes] Create handler for GET /teams/:id (get by ID, 404 on not found) — `apps/api/src/routes/backoffice/teams/get-team.ts`
- [ ] T026 [P] [Routes] Create handler for PATCH /teams/:id (partial update) — `apps/api/src/routes/backoffice/teams/update-team.ts`
- [ ] T027 [P] [Routes] Create handler for DELETE /teams/:id (soft delete, 422 guards for assignments and reporting) — `apps/api/src/routes/backoffice/teams/delete-team.ts`
- [ ] T028 [P] [Routes] Create handler for GET /teams/:id/members (list members with keyset pagination) — `apps/api/src/routes/backoffice/teams/get-team-members.ts`
- [ ] T029 [P] [Routes] Create handler for POST /teams/:id/members (idempotent staff assignment, 422 guards) — `apps/api/src/routes/backoffice/teams/assign-staff-team.ts`
- [ ] T030 [P] [Routes] Create handler for DELETE /teams/:id/members/:staffId (remove assignment, 404 on not found) — `apps/api/src/routes/backoffice/teams/remove-staff-team.ts`
- [ ] T031 [Routes] Create Hono router factory registering all 13 routes in dependency-safe order (members sub-routes before /:id detail routes) — `apps/api/src/routes/backoffice/teams/index.ts`
- [ ] T032 [Routes] Mount `teamsRouter` under `/backoffice` in the main backoffice router — `apps/api/src/routes/backoffice/<main router>`

## Phase 3 — Tests

- [ ] T033 [Tests] Create unit tests covering all service business rules (14 scenarios: duplicate names, disabled type/team guards, capacity enforcement, idempotent assignment, soft-delete visibility, deletion guards) — `packages/domain-core/src/teams/__tests__/teams.service.test.ts`
- [ ] T034 [Tests] Create integration tests covering full CRUD lifecycles, assignment flows, license status responses, RBAC enforcement, pagination filters, tenant isolation, and concurrent assignment race conditions — `apps/api/src/routes/backoffice/teams/__tests__/teams.integration.test.ts`

---

## Task Summary

- Total tasks: 35
- Parallel-safe tasks: 19 (T002, T003, T004, T006, T007, T016, T018, T019, T020, T021, T022, T023, T024, T025, T026, T027, T028, T029, T030)
- Phases: Foundation | Domain | Routes | Tests
