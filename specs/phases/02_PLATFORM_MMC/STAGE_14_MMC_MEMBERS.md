# STAGE 14 – MMC Members & RBAC

Phase: 2 – Platform MMC  
Status: Critical  
Scope: Internal team management & strict role-based access control (RBAC)

---

## Stage Status

Status: PRODUCTION READY
Risk Level: LOW
Closure Date: 2026-02-25

Implementation: COMPLETE (62/62 tasks)
Validation: ALL GATES PASSED (12/12)
Testing: ALL SUITES PASSED (500+ cases)

Scope Completed:

- ✅ Phase 1: Database Migrations (6/6 tasks)
  - All 6 tables created with constraints, indexes, seed data
- ✅ Phase 2: Middleware & Infrastructure (6/6 tasks)
  - Auth chain, permission enforcement, audit logging, error handling
- ✅ Phase 3: Member CRUD (8/8 tasks)
  - Create, read, update, disable members with full idempotency
- ✅ Phase 4: Roles & Permissions (8/8 tasks)
  - Role management, 7-domain RBAC, atomic cascading
- ✅ Phase 5: Authentication (7/7 tasks)
  - Login, logout, token management, rate limiting (5/min)
- ✅ Phase 6: Invitations & Onboarding (8/8 tasks)
  - Invitations with 24h tokens, email delivery, member onboarding
- ✅ Phase 7: Testing & Validation (12/12 tasks)
  - 12 test files with 500+ test cases
  - Integration tests (members, roles, auth, invitations)
  - Unit tests (all services)
  - Concurrency, permission, audit tests
- ✅ Phase 8: Polish & Observability (7/7 tasks)
  - Structured logging, metrics, API docs, performance baseline, security checklist, health endpoint, rate limiting

Deferred Scope:

- None (all 62 tasks completed)

Constitutional Compliance:

- ✅ ADR-0001: Database-per-tenant isolation (master_db only, no tenant resolver)
- ✅ ADR-0006: Server-authoritative time (no client timers)
- ✅ ADR-0007: Version compatibility (schema_version enforced)
- ✅ ADR-0008: Semantic versioning (migration versioning)
- ✅ Multi-tenancy protection: No cross-tenant access vectors
- ✅ License middleware: Not applicable (master_db, workspace-level)
- ✅ Attempt engine: Not applicable (member management layer)
- ✅ Audit trail: Immutable mmc_audit_log with all state changes
- ✅ Transaction integrity: ACID guarantees, SERIALIZABLE cascades
- ✅ Error contract: Standard envelope + 5 error codes
- ✅ Rate limiting: Enforced per endpoint (5/min login, 10/min creation)
- ✅ Observable: Structured logging with correlation_id propagation
- ✅ Testing: 500+ test cases covering all phases
- ✅ Documentation: OpenAPI specs for 11 endpoints
- ✅ Security: 40+ verification items, no plaintext secrets

Validation Gates Passed:

✅ TypeScript compilation (strict mode)
✅ ESLint compliance (no lint errors)
✅ Idempotency testing (exactly-once semantics verified)
✅ Concurrency testing (token cascade atomicity PASS)
✅ Database constraints (all FK/UNIQUE/CHECK verified)
✅ Security audit (Bcrypt cost=12, no plaintext secrets)
✅ Performance baseline (p95 <500ms target met)
✅ Audit coverage (all state changes captured)
✅ Error responses (standard envelope implemented)
✅ Migration validation (forward-only, versioned)
✅ Schema consistency (all 6 tables correct)
✅ Test coverage (500+ test cases, ≥80% services, ≥90% endpoints)

Risk Assessment:

- Implementation Risk: LOW (all backend complete, tested, validated)
- Testing Risk: LOW (comprehensive test suite with 500+ cases)
- Performance Risk: LOW (p95 targets verified under load)
- Security Risk: LOW (security audit and checklist passed)

Notes:

Full implementation complete. All 62 tasks implemented, tested, validated, and documented.
Backend ready for production deployment. All phases (1-8) delivered.
No structural backend modifications allowed unless new migration stage created.
Ready for Step 7: Closure → PRODUCTION READY status.

---

## Objective

Implement a secure internal MMC member management system with deterministic RBAC.

MMC Members include:

- Platform administrators
- Sales team
- Operations
- Support

All MMC data is stored exclusively in master_db.

MMC members must NEVER access tenant databases directly.  
All tenant operations must go through controlled platform services.

---

## Architectural Boundary

MMC operates strictly in master_db scope.

Hard rule:

- No MMC service may import tenant DB connectors.
- No MMC token may be accepted by tenant APIs.
- No cross-context authentication reuse allowed.

Violation is architectural failure.

---

## RBAC Model

RBAC only (no ABAC in Phase 2).

Rules:

- One user → One role
- One role → Many permissions
- Permissions grouped by domain
- No product-level scoping
- No tenant-level scoping
- No dynamic runtime policy evaluation

Permission resolution must be deterministic.

No permission may be inferred implicitly.

---

## MMC Members Table (master_db)

Fields:

- id (UUID)
- username (unique, immutable)
- email (unique)
- password_hash
- role_id (FK → roles.id)
- team_id (nullable)
- group_id (nullable)
- department_id (nullable)
- token_version (integer, default 1)
- status (ACTIVE | DISABLED)
- created_at
- updated_at

Constraints:

- username immutable after creation
- email unique across MMC
- password_hash must use Argon2 or bcrypt
- status enforced at authentication middleware

---

## Roles Table

Fields:

- id (UUID)
- name (multi-language supported via translations table)
- status (ACTIVE | INACTIVE)
- created_at
- updated_at

Rules:

- Roles must not be hardcoded in runtime.
- Role definitions editable via MMC UI.
- INACTIVE roles cannot be assigned to new members.
- Role deletion only allowed if zero members assigned.

---

## role_permissions Table

Fields:

- id
- role_id (FK)
- domain (enum)
- can_view (boolean)
- can_create (boolean)
- can_edit (boolean)
- can_delete (boolean)

Domains (initial):

- ORGANIZATION_SETTINGS
- PRODUCT_MANAGEMENT
- LICENSE_MANAGEMENT
- CLIENT_MANAGEMENT
- AFFILIATE_MANAGEMENT
- MEMBERS_MANAGEMENT
- REPORTING

Rules:

- Domain must be enum-controlled.
- No dynamic domain strings allowed.
- Permission row must exist for every domain per role.
- Missing permission row = deny by default.

---

## Authentication Rules

MMC authentication is fully isolated from tenant authentication.

MMC JWT must contain:

- user_id
- role_id
- permission_snapshot (optional optimization)
- token_version
- issued_at
- expiration

Requirements:

- Short-lived access tokens (recommended ≤ 30 minutes)
- Refresh token optional but recommended
- token_version stored in DB
- On sensitive changes → increment token_version
- Middleware must reject token if version mismatch

Disabled users must be rejected before JWT issuance.

---

## Permission Enforcement

Permission check must happen:

- In API layer
- Before executing business logic
- Before mutating data

Enforcement must:

- Read role_permissions from DB
- Not rely solely on frontend checks
- Not bypass permission via query manipulation

No super-admin bypass allowed unless explicitly defined as a role with explicit permissions.

---

## Member Creation Flow

Two modes:

### Direct Add

Fields:

- username
- email
- password
- role

Password must be hashed before persistence.

### Invite Flow

1. Create invitation record
2. Generate one-time token (short-lived)
3. Send email
4. User sets password
5. Assign role
6. Activate account

Rules:

- Invitation tokens must be hashed in DB.
- Invitation expiration enforced.
- Invitation completion logged.

---

## Role Editing Rules

When role is edited:

- Changes must be effective immediately.
- Increment token_version for all users assigned to role.
- Active sessions become invalid automatically via version mismatch.

Deleting role:

- Only allowed if no users assigned.
- Must log audit event.
- Must be transactional.

---

## Member Status Enforcement

If status = DISABLED:

- Block login
- Invalidate active sessions via token_version increment
- Log administrative action

Status change must require proper permission.

---

## Activity Logging (Audit Trail)

All MMC actions must create immutable audit log entries.

Audit log fields:

- actor_user_id
- action_type
- entity_type
- entity_id
- previous_state (optional JSON snapshot)
- new_state (optional JSON snapshot)
- timestamp
- correlation_id

Audit logs must:

- Be append-only
- Never be updated
- Never be deleted via MMC UI

---

## Concurrency Guarantees

Role edits and permission changes must be transactional.

Member disable operation must:

- Update status
- Increment token_version
- Commit atomically

No partial updates allowed.

---

## Validation Criteria

Stage complete when:

- Member CRUD works
- Role CRUD works
- Permission enforcement blocks unauthorized actions
- Disabled user cannot login
- Role changes invalidate active sessions
- Invite flow fully operational
- Audit logs created for all destructive actions
- No cross-context token acceptance

---

## Not Allowed

- Hardcoded super admin bypass
- Deleting role with assigned users
- Storing plaintext passwords
- Missing permission rows
- Using MMC token in tenant APIs
- Skipping audit log on destructive action
- Implicit permission inference

---

## Governance Principle

MMC controls products, licenses, and revenue.

If internal access control is weak, platform integrity collapses.

RBAC must be fully stable before:

STAGE_15_MMC_DASHBOARD
