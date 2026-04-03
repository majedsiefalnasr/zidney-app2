# Requirements Checklist: Student Management (Stage 42)

**Stage**: STAGE_42_STUDENT_MANAGEMENT
**Created**: 2026-04-03
**Phase**: 03_BACKOFFICE_CORE / 05_USER_MANAGEMENT

---

## Architecture Governance

- [x] Feature scope is confined to tenant DB (no master DB changes)
- [x] No cross-tenant logic exists in spec
- [x] License middleware enforced on all routes (student_limit validated transactionally)
- [x] No attempt engine modifications
- [x] No worker jobs required (all CRUD is synchronous)
- [x] All writes are transactional
- [x] Server-authoritative timestamps (PostgreSQL NOW())
- [x] No console.log — logger from @zidney/logger only
- [x] Error response format follows { success, data, error } contract
- [x] No stack traces exposed to client

## Identity & Auth

- [x] Argon2id is specified for password hashing (no MD5, bcrypt, or SHA variants)
- [x] token_version field specified for JWT invalidation on disable
- [x] frontoffice-login.ts migration from users → students table documented
- [x] DISABLED student blocked at login (status check in query)
- [x] password_hash excluded from all API responses
- [x] Account lock logic (failed_login_count, locked_until) migrated to students table
- [x] subscription_status included in JWT payload for runtime middleware

## Database Migration

- [x] Migration file name follows YYYYMMDD_NNN_description.ts format
- [x] Sequence 022 assigned (follows 021_add_staff_hierarchy_levels_fkey)
- [x] Date prefix 20260403 used
- [x] Migration is forward-only (down() throws; no rollback)
- [x] All DDL wrapped in single transaction (BEGIN/COMMIT)
- [x] ADD COLUMN IF NOT EXISTS used for idempotency
- [x] DB CHECK constraints for status enum enforced
- [x] DB CHECK constraints for subscription_status enum enforced
- [x] Indexes created for status, subscription_status (performance)
- [x] Index created for email (uniqueness, lookup)
- [x] schema_version bumped from 1.10.0 → 1.11.0

## Domain-Core Module

- [x] Module lives at packages/domain-core/src/students/
- [x] No HTTP imports in domain-core
- [x] No framework imports in domain-core (no Hono, no Express)
- [x] DbClient interface defined (no direct pg Pool import)
- [x] StudentRecord type does NOT include password_hash
- [x] StudentRow type is internal only (includes password_hash for auth use)
- [x] All service functions accept DbClient (not Pool)
- [x] SERIALIZABLE isolation used for create, bulk-import
- [x] Division active check is business logic (not DB FK only)
- [x] Department belongs to division validated
- [x] Group belongs to department/division validated
- [x] student_limit enforced before INSERT with FOR UPDATE count lock
- [x] BulkImportResult includes per-row error collection
- [x] bulkImportStudents processes in batches of 50
- [x] index.ts exports all public types and functions

## Validation

- [x] Validation schemas at packages/validation/src/student.schema.ts
- [x] Zod used (not class-validator, not yup)
- [x] createStudentSchema covers all required fields + email format
- [x] updateStudentSchema makes all fields optional (at least one required)
- [x] studentListQuerySchema covers pagination + all filter fields
- [x] bulkImportSchema limits max rows to 500
- [x] bulkImportRowSchema validates individual row structure
- [x] updateSubscriptionStatusSchema uses enum validation

## API Routes

- [x] POST /backoffice/students — create
- [x] GET /backoffice/students — list (paginated)
- [x] GET /backoffice/students/:id — get one
- [x] PATCH /backoffice/students/:id — update
- [x] PATCH /backoffice/students/:id/disable — disable
- [x] PATCH /backoffice/students/:id/enable — enable
- [x] DELETE /backoffice/students/:id — delete (soft)
- [x] PATCH /backoffice/students/:id/subscription — update subscription
- [x] POST /backoffice/students/bulk-import — bulk import
- [x] All routes protected by tenantResolver → licenseMiddleware → validateJwt → RBAC
- [x] Router registered in apps/api/src/app.ts
- [x] No business logic in route files (delegated to domain-core service)

## Error Codes

- [x] STUDENT_NOT_FOUND → 404
- [x] STUDENT_EMAIL_CONFLICT → 409
- [x] STUDENT_LIMIT_EXCEEDED → 422
- [x] STUDENT_DIVISION_REQUIRED → 422
- [x] STUDENT_DIVISION_INACTIVE → 422
- [x] STUDENT_DEPARTMENT_MISMATCH → 422
- [x] STUDENT_HAS_ATTEMPTS → 409
- [x] STUDENT_ALREADY_DISABLED → 409
- [x] STUDENT_ALREADY_ACTIVE → 409

## Testing

- [x] Unit tests specified for domain-core service (key scenarios documented)
- [x] Integration tests specified for all API routes
- [x] Frontoffice auth tests specified (login with students table)
- [x] Tenant isolation test scenario defined
- [x] student_limit enforcement test scenario defined

## Security

- [x] password_hash never returned in API responses (documented)
- [x] No enumeration attack vector (same error for unknown email vs wrong password at frontoffice)
- [x] Bulk import applies same limit as single create
- [x] Cross-tenant division override via body is prevented

## Logging & Observability

- [x] Structured logging via createLogger('students')
- [x] correlation_id propagated in all log entries
- [x] workspace_id in all log entries
- [x] performed_by (staff_id) in all mutating log entries
- [x] duration_ms logged for write operations

## Completeness

- [x] Acceptance criteria defined and measurable
- [x] All affected files documented (create, modify, register)
- [x] Clarifications section addresses all ambiguous decisions
- [x] No [NEEDS CLARIFICATION] markers remain in spec
