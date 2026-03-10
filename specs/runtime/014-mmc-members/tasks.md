# Tasks – STAGE_14_MMC_MEMBERS

**Stage:** STAGE_14_MMC_MEMBERS – MMC Members & RBAC  
**Feature Name:** Internal Member Management, Role-Based Access Control, Session Invalidation  
**Generated:** 2026-02-25  
**Task Format:** Atomic, sequentially-ordered, parallel-safe

---

## Phase 1: Database Migration & Schema Setup

Create all tables required for MMC member & RBAC system in `master_db`.

### Success Criteria

- All 6 tables created with correct constraints and indexes
- Migrations follow forward-only pattern (ADR-0008)
- Schema version incremented globally (master schema, not tenant-specific)
- Seed data (default roles + permissions) inserted

---

- [x] T001 Create master DB migration for `mmc_members` table in
      `apps/api/src/db/master/migrations/20260225_002_create_mmc_members.ts`
- [x] T002 Create master DB migration for `roles` table in
      `apps/api/src/db/master/migrations/20260225_001_create_roles.ts`
- [x] T003 Create master DB migration for `role_permissions` table in
      `apps/api/src/db/master/migrations/20260225_003_create_role_permissions.ts`
- [x] T004 Create master DB migration for `mmc_member_invitations` table in
      `apps/api/src/db/master/migrations/20260225_004_create_mmc_member_invitations.ts`
- [x] T005 Create master DB migration for `mmc_audit_log` table (immutable, append-only) in
      `apps/api/src/db/master/migrations/20260225_005_create_mmc_audit_log.ts`
- [x] T006 Create seed data migration with 7 permission domains and 3 default roles (Platform
      Administrator, Sales Team, Support) in
      `apps/api/src/db/master/migrations/20260225_006_seed_roles_and_permissions.ts`

---

## Phase 2: Infrastructure & Middleware (Blocking Prerequisites)

Implement request-scoped middleware and foundational utilities that all routes depend on.

### Success Criteria

- Correlation ID propagated through all requests
- MMC authentication validates JWT without workspace_id
- Permission enforcement blocks unauthorized actions with audit logging
- Token version invalidation enforced (session management)
- Standard error response structure defined and used globally

---

- [x] T007 Implement correlation ID middleware in
      `apps/api/src/middleware/correlation-id.middleware.ts` (extract or generate UUID, store in
      request.context)
- [x] T008 Implement MMC authentication middleware in
      `apps/api/src/middleware/mmc-auth.middleware.ts` (JWT validation, token_version check,
      workspace_id rejection, member status check)
- [x] T009 Implement MMC permission enforcement middleware in
      `apps/api/src/middleware/mmc-permission.middleware.ts` (domain × action mapping,
      role_permissions query, explicit deny on missing or false bits)
- [x] T010 [P] Create error response standardization utility in
      `packages/domain-core/src/errors/index.ts` (standard structure: success, data, error with
      code + message)
- [x] T011 [P] Create audit service in `packages/domain-core/src/services/audit.service.ts`
      (append-only logging with action_type, entity_type, previous_state, new_state, correlation_id
      tracking)
- [x] T012 [P] Implement request logging interceptor in
      `apps/api/src/middleware/request-logger.middleware.ts` (structured JSON logs with
      correlation_id, duration_ms, http_method, http_status)

---

## Phase 3: User Story 1 – Member Management (CRUD)

Implement member lifecycle: create, retrieve, update (non-destructive fields), disable (soft
delete).

### Success Criteria

- Member creation validates username/email uniqueness, password complexity, role existence
- Member retrieval returns augmented data (role_name, created_by_username)
- Member email/team/group/department updates tested
- Member disablement atomically increments token_version (invalidates sessions)
- All operations transactional; audit logged

### Independent Test Criteria for US1

- ✓ Create member with valid credentials → member record exists, password hashed, audit logged
- ✓ Create member with duplicate username → 409 Conflict
- ✓ Create member with invalid role_id → 400 Bad Request
- ✓ Get member by ID → returns correct data with role name and creator info
- ✓ Update member email → 200 OK; new email persisted
- ✓ Update member with duplicate email → 409 Conflict
- ✓ Disable member → status='DISABLED', token_version incremented, active sessions invalidated on
  next request
- ✓ All operations logged to audit table with actor_user_id, previous_state, new_state

---

- [x] T013 [US1] Implement MemberService in `packages/domain-core/src/services/member.service.ts`
      (createMember, getMember, listMembers, updateMember, disableMember using master DB
      transactions)
- [x] T014 [US1] Implement password validation in `packages/validation/src/password.validator.ts`
      (min 8 chars, uppercase + lowercase + digit + special char)
- [x] T015 [US1] Implement POST /mmc/members endpoint in `apps/api/src/routes/members.routes.ts`
      (requires MEMBERS_MANAGEMENT.create, validates input, calls MemberService.createMember,
      returns 201 with created member)
- [x] T016 [US1] Implement GET /mmc/members/:id endpoint in `apps/api/src/routes/members.routes.ts`
      (requires MEMBERS_MANAGEMENT.view, calls MemberService.getMember, returns 200 with member
      details including role_name)
- [x] T017 [P] [US1] Implement PATCH /mmc/members/:id endpoint in
      `apps/api/src/routes/members.routes.ts` (requires MEMBERS_MANAGEMENT.edit, allows
      email/team_id/group_id/department_id changes, validates email uniqueness, returns 200 with
      updated fields)
- [x] T018 [P] [US1] Implement DELETE /mmc/members/:id endpoint in
      `apps/api/src/routes/members.routes.ts` (requires MEMBERS_MANAGEMENT.delete, soft-deletes by
      setting status='DISABLED' and incrementing token_version, returns 200 with new status)
- [x] T019 [P] [US1] Implement idempotency support in `apps/api/src/utils/idempotency.ts`
      (Redis-backed idempotency key cache with 24h TTL, fallback to request_log table)
- [x] T020 [P] [US1] Create TypeScript types for MMC entities in `packages/types/src/mmc.types.ts`
      (Member, Role, Permission, Invitation, AuditLog interfaces)

---

## Phase 4: User Story 2 – Role & Permission Management

Implement RBAC definition: role CRUD, permission matrix with cascading token version updates.

### Success Criteria

- Role list filtered by status (ACTIVE/INACTIVE)
- Permission matrix retrieved per role (7 domains × 4 bits)
- Permission updates cascade token_version increment to ALL members with that role atomically
- No members can be assigned INACTIVE roles
- Role deletion prevented if members assigned

### Independent Test Criteria for US2

- ✓ List roles → returns ACTIVE roles with member_count
- ✓ Get role by ID → returns role metadata
- ✓ Get role permissions → returns all 7 domains with can_view/create/edit/delete bits
- ✓ Update role permissions (single domain) → role_permissions updated, all 5 affected members get
  token_version incremented
- ✓ Update role permissions (multiple domains) → all updates in single transaction, all members
  incremented once, audit entries created
- ✓ Attempt update with invalid domain → 400 Bad Request
- ✓ Attempt role delete with members assigned → 409 Conflict (business logic check before DELETE)

---

- [x] T021 [US2] Implement RoleService in `packages/domain-core/src/services/role.service.ts`
      (getRoles, getRole, getPermissions, updatePermissions with member token_version cascade,
      cascadeTokenVersion)
- [x] T022 [US2] Implement PermissionService in
      `packages/domain-core/src/services/permission.service.ts` (checkPermission by domain+action,
      resolvePermissions for member, getPermissionsForRole)
- [x] T023 [US2] Implement GET /mmc/roles endpoint in `apps/api/src/routes/roles.routes.ts`
      (requires MEMBERS_MANAGEMENT.view, filters by status query param, returns role list with
      member_count)
- [x] T024 [US2] Implement GET /mmc/roles/:id endpoint in `apps/api/src/routes/roles.routes.ts`
      (requires MEMBERS_MANAGEMENT.view, returns single role with metadata)
- [x] T025 [US2] Implement GET /mmc/roles/:id/permissions endpoint in
      `apps/api/src/routes/roles.routes.ts` (requires MEMBERS_MANAGEMENT.view, returns 7 permission
      domains with bits)
- [x] T026 [US2] Implement PATCH /mmc/roles/:id/permissions endpoint in
      `apps/api/src/routes/roles.routes.ts` (requires MEMBERS_MANAGEMENT.edit, updates
      role_permissions, cascades token_version to all members, atomic transaction, returns
      affected_members count)
- [x] T027 [P] [US2] Create permission domain enum in `packages/types/src/permissions.ts`
      (ORGANIZATION_SETTINGS, PRODUCT_MANAGEMENT, LICENSE_MANAGEMENT, CLIENT_MANAGEMENT,
      AFFILIATE_MANAGEMENT, MEMBERS_MANAGEMENT, REPORTING)
- [x] T028 [P] [US2] Implement role deletion safety check in RoleService (query member count, reject
      DELETE if > 0 with 409, audit log deletion)

---

## Phase 5: User Story 3 – Authentication & Session Management via Token Versioning

Implement member login, JWT issuance, token_version-based session invalidation, and permission check
utility endpoint.

### Success Criteria

- Login validates username, password, member status (ACTIVE only)
- JWT issued with token_version for session tracking
- Token acceptance requires token.token_version === db.token_version
- Role changes or member disablement immediately invalidate all sessions
- Rate limiting prevents brute force (5 failed attempts/min/IP)
- Permission check endpoint returns current user's permissions (UX optimization)

### Independent Test Criteria for US3

- ✓ Login with valid credentials → 200 OK with access_token, token_type='Bearer', expires_in=3600
- ✓ Login with invalid password → 401 Unauthorized (no user enumeration)
- ✓ Login with disabled member → 401 Unauthorized
- ✓ Failed login increments rate limit counter (Redis)
- ✓ 6th failed attempt from same IP within 60s → 429 Too Many Requests
- ✓ Valid login clears failed attempt counter
- ✓ JWT token contains sub (user ID), issuer='mmc', role_id, token_version, exp; no workspace_id
- ✓ Subsequent request with token where token_version !== db.token_version → 401 Unauthorized
- ✓ Logout endpoint returns 200, logs audit event
- ✓ GET /mmc/permissions/check returns current user's permissions for queried domains

---

- [x] T029 [US3] Implement AuthService in `packages/domain-core/src/services/auth.service.ts`
      (authenticateMember, issueToken, verifyToken using JWT with HS256)
- [x] T030 [US3] Implement rate limiting middleware in
      `apps/api/src/middleware/rate-limit.middleware.ts` (Redis-backed per-IP failed login tracking,
      5 attempts/min limit)
- [x] T031 [US3] Implement POST /mmc/auth/login endpoint in `apps/api/src/routes/auth.routes.ts`
      (public endpoint, validates username+password, calls AuthService.authenticateMember, returns
      JWT + user metadata, audit logs attempt)
- [x] T032 [US3] Implement POST /mmc/auth/logout endpoint in `apps/api/src/routes/auth.routes.ts`
      (authenticated, logs audit event, returns 200 with message)
- [x] T033 [US3] Implement GET /mmc/permissions/check endpoint in
      `apps/api/src/routes/auth.routes.ts` (authenticated only, accepts comma-separated domains
      query param, returns permission matrix for current user, no security check—returns own
      permissions)
- [x] T034 [P] [US3] Implement JWT utilities in `apps/api/src/utils/jwt.ts` (sign, verify with
      issuer validation, expiration check, token_version embedding)
- [x] T035 [P] [US3] Create password hashing utilities in
      `packages/domain-core/src/utils/password.ts` (bcrypt with cost=12 for hash, comparison
      function)

---

## Phase 6: User Story 4 – Invitations & Onboarding Workflow

Implement one-time token-based member invitation, expiration, and acceptance with password creation.

### Success Criteria

- Invitation sent to email with one-time token, expires in 24 hours
- Token hash stored in DB (plaintext token in email only)
- Acceptance validates token not expired, not already used
- Generated username from email prefix + random suffix on acceptance
- Email sending asynchronous (non-blocking)
- Permission check endpoint returns current user's permissions (UX optimization)

### Independent Test Criteria for US4

- ✓ Create invitation with valid email + role → 201 Created with invitation ID, invitation email
  sent asynchronously
- ✓ Create invitation with email already MMC member → 409 Conflict
- ✓ Create invitation with pending invite for same email → 409 Conflict (or allow resend)
- ✓ Create invitation with invalid role_id → 400 Bad Request
- ✓ Accept invitation before expiration with valid password → 201 Created with new member record,
  username generated, mmc_member_invitations status='ACCEPTED'
- ✓ Accept invitation after expiration → 401 Unauthorized
- ✓ Accept invitation with weak password → 400 Bad Request (complexity check)
- ✓ Accept same invitation token twice → 401 Unauthorized (status no longer PENDING)
- ✓ List invitations filtered by status (PENDING, ACCEPTED, EXPIRED)
- ✓ Audit log captures: INVITATION_SENT, INVITATION_ACCEPTED

---

- [x] T036 [US4] Implement InvitationService in
      `packages/domain-core/src/services/invitation.service.ts` (sendInvitation, acceptInvitation,
      getInvitations, resendInvitation)
- [x] T037 [US4] Implement token generation & hashing in `apps/api/src/utils/tokens.ts` (32-byte
      random token, SHA256 hashing, store hash in DB)
- [x] T038 [US4] Implement email sending utility in `packages/domain-core/src/utils/email.ts`
      (sendInvitationEmail with template, async queue or direct SMTP)
- [x] T039 [US4] Implement POST /mmc/invitations endpoint in
      `apps/api/src/routes/invitations.routes.ts` (requires MEMBERS_MANAGEMENT.create, validates
      email not member, validates role_id, generates token, inserts invitation, sends email async,
      returns 201 with invitation)
- [x] T040 [US4] Implement POST /mmc/invitations/:token/accept endpoint in
      `apps/api/src/routes/invitations.routes.ts` (public, validates token hash, checks expiration,
      creates member with generated username, updates invitation status, returns 201 with member)
- [x] T041 [US4] Implement GET /mmc/invitations endpoint in
      `apps/api/src/routes/invitations.routes.ts` (requires MEMBERS_MANAGEMENT.view, filters by
      status, pagination with limit/offset, returns invitation list)
- [x] T042 [P] [US4] Implement username generation in `packages/domain-core/src/utils/username.ts`
      (from email prefix + 8-char random suffix, verify uniqueness before use)
- [x] T043 [P] [US4] Implement invitation expiration logic (24h TTL, checked on acceptance
      validation, background job optional for status update to EXPIRED)

---

## Phase 7: Testing & Validation

Comprehensive test coverage for all functional requirements, edge cases, and concurrency scenarios.

### Success Criteria

- Integration tests cover all API endpoints with correct/incorrect permissions
- Unit tests cover all services with transaction rollback scenarios
- Permission enforcement tested (permission bits checked correctly)
- Token version invalidation tested (role change cascades correctly)
- Concurrency tests validate serializable isolation (race conditions prevented)
- Audit log immutability tested (no updates or deletes)

---

- [x] T044 Write integration tests for member management API in
      `tests/integration/mmc/members.test.ts` (POST/GET/PATCH/DELETE /mmc/members/{id}, permission
      checks, conflict detection) ✓
- [x] T045 Write integration tests for role & permission management in
      `tests/integration/mmc/roles.test.ts` (GET /mmc/roles, GET /mmc/roles/{id}/permissions, PATCH
      with cascade) ✓
- [x] T046 Write integration tests for authentication & session in
      `tests/integration/mmc/auth.test.ts` (POST /mmc/auth/login, rate limiting, token_version
      invalidation, logout) ✓
- [x] T047 Write integration tests for invitations workflow in
      `tests/integration/mmc/invitations.test.ts` (POST /mmc/invitations, POST
      /mmc/invitations/{token}/accept, GET /mmc/invitations) ✓
- [x] T048 Write unit tests for MemberService in `tests/unit/mmc/member.service.test.ts`
      (transaction rollback, audit logging, validation logic) ✓
- [x] T049 [P] Write unit tests for RoleService in `tests/unit/mmc/role.service.test.ts` (permission
      cascade, token_version increment, role deletion checks) ✓
- [x] T050 [P] Write unit tests for AuthService in `tests/unit/mmc/auth.service.test.ts` (JWT
      issuance, token verification, password validation) ✓
- [x] T051 [P] Write unit tests for InvitationService in `tests/unit/mmc/invitation.service.test.ts`
      (token generation, expiration logic, acceptance validation) ✓
- [x] T052 Write permission enforcement tests in `tests/unit/mmc/permissions.test.ts` (permission
      bits checked correctly, implicit deny, audit log on denial) ✓
- [x] T053 Write token version invalidation tests in `tests/unit/mmc/token-version.test.ts` (member
      disablement increments version, role edit cascades to all members, middleware rejects
      mismatched version) ✓
- [x] T054 Write concurrency tests in `tests/integration/mmc/concurrency.test.ts` (two simultaneous
      role edits, token version race conditions, serializable isolation validated) ✓
- [x] T055 Write audit log immutability tests in `tests/integration/mmc/audit.test.ts` (audit
      entries appended, no direct updates/deletes possible, all actions logged) ✓

---

## Phase 8: Polish, Observability & Security Hardening

Complete structured logging, metrics, security validation, and API documentation.

### Success Criteria

- All logs structured (JSON with correlation_id, mmc_user_id, service name)
- Metrics emitted for success/failure rates, latency
- No plaintext passwords, tokens, or emails in logs
- OpenAPI/Swagger documentation for /mmc/\* routes
- Security checklist: no permission bypasses, no cross-tenant token acceptance, no leaked secrets

---

- [x] T056 Implement comprehensive structured logging in all services using `packages/logger` in
      `packages/domain-core/src/services/` ✓
- [x] T057 Add metrics emission in `apps/api/src/middleware/metrics.middleware.ts` (counters:
      members_created, members_deleted, login_attempts, permission_checks, permission_denials, etc.)
      ✓
- [x] T058 Add API documentation in `apps/api/src/routes/` as OpenAPI/Swagger comments or separate
      `docs/mmc-api.openapi.yaml` ✓
- [x] T059 Performance testing & query optimization in `tests/performance/mmc.perf.test.ts` (member
      lookup < 5ms, role permissions < 3ms, permission check < 10ms) ✓
- [x] T060 Security review checklist in `docs/STAGE_14_SECURITY_REVIEW.md` (verify: no plaintext
      passwords, no workspace_id in MMC tokens, no permission bypasses, audit trail completeness) ✓
- [x] T061 [P] Implement health check endpoint in `apps/api/src/routes/health.ts` (master DB
      connectivity, Redis connectivity, migrations current) ✓
- [x] T062 [P] Add rate limiting to endpoints in `apps/api/src/middleware/rate-limit.middleware.ts`
      (GET /mmc/members: 60/min, POST /mmc/members: 10/min, DELETE /mmc/members: 5/min, POST
      /mmc/invitations: 20/hour) ✓

---

## Additional Context

### Dependency Chain

```
Phase 1 (Migrations)
  ↓
Phase 2 (Middleware & Infrastructure)
  ↓
Phase 3 (Member CRUD)
  ↓
Phase 4 (Role & Permission Management)
  ↓
Phase 5 (Authentication & Session)
  ↓
Phase 6 (Invitations & Onboarding)
  ↓
Phase 7 (Testing)
  ↓
Phase 8 (Polish & Observability)
```

### Parallel Opportunities

**Within US1 (Members):**

- T017 (PATCH endpoint) can run parallel to T016 (GET endpoint)
- T018 (DELETE endpoint) can run parallel to T017 & T016
- T019 (idempotency) can run parallel to T015 (POST endpoint)
- T020 (TypeScript types) can start immediately after T013 (MemberService)

**Within US2 (Roles):**

- T023 (GET /mmc/roles) can run parallel to T024 (GET /mmc/roles/:id)
- T025 (GET permissions) can run parallel to both
- T027 (Permission enum) can start after design review
- T028 (Role deletion safety) can run parallel to T026

**Within US3 (Auth):**

- T034 (JWT utilities) can start immediately
- T035 (Password utilities) can start immediately
- T030 (Rate limiting) can run parallel to T031 (login endpoint)

**Within US4 (Invitations):**

- T042 (Username generation) can start after service design
- T043 (Expiration logic) can run parallel to T036 (InvitationService)

**Test Phases (Phase 7):**

- T048-T055 can run in parallel (no cross-dependencies between test files)

**Polish Phase (Phase 8):**

- T056-T062 can run mostly in parallel (observability vs. security vs. documentation)

### Implementation Strategy

**MVP Scope (User Story 1 only - Phase 3):**

- Phase 1: Migrations
- Phase 2: Middleware
- Phase 3: Member CRUD
- Tests for Phase 3

This delivers a minimal MMC member system with create/read/update/disable, suitable for Phase 2
delivery.

**Incremental Expansion:**

1. ✓ US1 complete (MVP)
2. Add US2 (Roles & Permissions) — enables RBAC
3. Add US3 (Authentication) — enables login flow
4. Add US4 (Invitations) — enables onboarding
5. Polish & testing

---

## Total Task Count

- **Phase 1:** 6 tasks (migrations & seed data)
- **Phase 2:** 6 tasks (middleware & infrastructure)
- **Phase 3:** 8 tasks (US1 – Member CRUD)
- **Phase 4:** 8 tasks (US2 – Role & Permissions)
- **Phase 5:** 7 tasks (US3 – Authentication & Session)
- **Phase 6:** 8 tasks (US4 – Invitations)
- **Phase 7:** 12 tasks (Testing)
- **Phase 8:** 7 tasks (Polish & Observability)

**Total: 62 tasks** (all atomic, 1–4 hours each, total project ~248 hours or ~6 person-weeks at 40
hrs/week)

---

## Constraint Validation Summary

✓ **Task atomicity:** Each task 1–4 hours, < 200 LOC per task (indication to split further if
needed)  
✓ **No implementation details:** Task descriptions are concrete but not step-by-step pseudocode  
✓ **Full spec coverage:** All endpoints, services, middleware, tables, audit logging, permissions
covered  
✓ **Correct sequencing:** Migrations → Middleware → Services → Endpoints → Testing → Polish  
✓ **Parallelization marked:** [P] flag applied to independent tasks  
✓ **User story labels:** [US1], [US2], [US3], [US4] applied correctly to story-specific phases  
✓ **File paths explicit:** All tasks include exact destination file paths  
✓ **Critical path clarity:** MVP achievable by completing phases 1–3 + Phase 7 (minimum)
