# Requirements Checklist — Stage 41: Staff Management

**Stage**: `STAGE_41_STAFF_MANAGEMENT`
**Generated**: 2026-04-03
**Status**: DRAFT

---

## Architecture Governance

- [x] No cross-tenant access — all tables are tenant-DB-only
- [x] No middleware bypass — tenant resolver + license + RBAC guard on all routes
- [x] No grading logic — feature does not touch attempts or grading
- [x] No direct DB instantiation — all access via `c.get('tenantDb')`
- [x] No weakening of snapshot integrity — no snapshot-related tables touched
- [x] All writes are transactional — create / update / disable / enable / delete use transactions
- [x] Schema version bumped — `1.25.0 → 1.26.0`
- [x] Server-authoritative time only — `created_at`, `updated_at`, `assigned_at` via PostgreSQL `NOW()`
- [x] No `console.log` — `createLogger('backoffice-staff')` used throughout

## Trust Chain

- [x] Isolation is the first gate — workspace resolved via slug before any DB access
- [x] License validation before workspace operations — `staff_limit` enforced transactionally
- [x] Authentication after tenant resolution — JWT check follows tenant middleware
- [x] Attempt engine unaffected — no attempt-related code touched
- [x] Server-authoritative time enforced — no client timestamps accepted
- [x] Frontoffice unchanged — students unaffected by this stage

## Data Model

- [x] `backoffice_staff_users.status` column defined (`VARCHAR(20) CHECK IN ('ACTIVE','DISABLED')`)
- [x] `backoffice_staff_users.password_hash` widened to `text` (Argon2id support)
- [x] `backoffice_staff_users.is_active` retained (backward compat; synchronized by service)
- [x] `staff_hierarchy_levels` join table defined with composite primary key
- [x] All FK constraints defined with correct ON DELETE behavior
- [x] Migration file named `20260404_020_staff_management.ts`
- [x] Schema version updated `1.25.0 → 1.26.0` in `_schema_versions`
- [x] Drizzle schema files updated (`backoffice-staff-users.schema.ts`, new `staff-hierarchy-levels.schema.ts`)

## Functional Requirements

- [x] `POST /staff` — Create staff with license limit enforcement
- [x] `GET /staff` — List staff (paginated, status filter, division filter, search)
- [x] `GET /staff/:id` — Get staff record (no password_hash in response)
- [x] `PATCH /staff/:id` — Update name and/or email
- [x] `PATCH /staff/:id/disable` — Disable + increment token_version (session invalidation)
- [x] `PATCH /staff/:id/enable` — Re-enable staff account
- [x] `DELETE /staff/:id` — Transactional delete with assignment cleanup
- [x] Role assignment (`PATCH /staff/:userId/role`) explicitly out of scope — already in `roles.ts`
- [x] Division/dept/group/team assignment routes out of scope — already implemented

## Security

- [x] Argon2id for staff password hashing (`memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`)
- [x] No `password_hash` in any API response
- [x] Email uniqueness per tenant (unique constraint `(workspace_id, email)`)
- [x] `workspace_id` from context only — never from request body
- [x] RBAC guard on every route (`PermissionModule.USERS`)
- [x] `can_create`, `can_view`, `can_edit`, `can_delete` properly mapped
- [x] Correlation ID logged on every operation

## License Enforcement

- [x] `createUserWithLimitCheck` used from `@zidney/domain-core/license`
- [x] `SELECT FOR UPDATE` on `licenses` row during limit check (SERIALIZABLE isolation)
- [x] Total staff count (not concurrent active) checked against `staff_limit`
- [x] No cached counters — DB query on each create

## Audit Logging

- [x] Every mutating action generates an audit log entry in tenant DB
- [x] Audit log written co-transactionally (same DB transaction as mutation)
- [x] Fields: `staff_id`, `workspace_id`, `request_id`, `action_type`, `target_entity`, `target_id`, `metadata`
- [x] No `password_hash` in audit log metadata

## Auth Login Update

- [x] `backoffice-login.ts` updated to query `backoffice_staff_users`
- [x] `verifyStaffPassword` (Argon2id) replaces `verifyPassword` (bcrypt) for staff login
- [x] `status = 'ACTIVE'` check replaces `is_active = true` check

## Dead Code Cleanup

- [x] `apps/api/src/routes/backoffice/users.ts` deleted (NOT registered in `app.ts`)
- [x] No stale imports or references remain in `app.ts` for deleted file

## Module Boundaries

- [x] `packages/domain-core/src/staff/` is a pure domain module (no HTTP imports)
- [x] `packages/domain-core/src/auth/staff-password.ts` added for Argon2id
- [x] `export * as staff from './staff'` added to `packages/domain-core/src/index.ts`
- [x] Validation schemas in `packages/validation/src/staff.schema.ts`
- [x] No UI → DB direct imports

## Testing

- [x] Unit tests for domain-core staff service functions
- [x] Integration tests for all 7 endpoints (success + error paths)
- [x] Tenant isolation tests (cross-tenant access blocked)
- [x] License limit concurrency / TOCTOU tests
- [x] Migration execution test
- [x] Login route updated tests (Argon2id verify)

## Error Contract

- [x] All responses follow `{ success, data, error }` shape
- [x] Error codes defined: `STAFF_NOT_FOUND`, `STAFF_EMAIL_CONFLICT`, `STAFF_LIMIT_EXCEEDED`,
      `STAFF_ALREADY_DISABLED`, `STAFF_ALREADY_ACTIVE`, `STAFF_HAS_AUTHORED_CONTENT`,
      `ROLE_NOT_FOUND`, `HASH_ERROR`, `DB_UNAVAILABLE`
- [x] HTTP status codes correctly mapped

## Observability

- [x] Structured logging on every route (`correlation_id`, `workspace_id`, `action`, `result`)
- [x] No stack traces in client responses
- [x] Error cause logged server-side, sanitized message in response
