# SPEC – MMC Members & RBAC (STAGE_14)

**Phase:** 2 – Platform MMC  
**Stage:** STAGE_14_MMC_MEMBERS  
**Status:** Specification  
**Priority:** Critical  
**Feature Area:** Internal team management, role-based access control, secure member administration

---

## Feature Overview

### What Is Being Built

A secure internal member management system for Zidney Platform Operations (MMC) with deterministic role-based access control (RBAC).

Zidney MMC requires strict isolation from tenant databases and governance over platform operations. This stage implements:

- **Member lifecycle management:** Create, edit, disable, delete MMC internal users
- **Deterministic RBAC model:** One user → One role → Many permissions (no ABAC, no dynamic evaluation)
- **Seven permission domains:** ORGANIZATION_SETTINGS, PRODUCT_MANAGEMENT, LICENSE_MANAGEMENT, CLIENT_MANAGEMENT, AFFILIATE_MANAGEMENT, MEMBERS_MANAGEMENT, REPORTING
- **Permission enforcement:** Verified at API layer before business logic execution
- **Token isolation:** MMC JWT never accepted by tenant APIs; tenant JWT never accepted by MMC APIs
- **Session invalidation:** Role changes and member disablement instantly invalidate active sessions via token_version increment
- **Invite workflow:** One-time-token based member onboarding with password creation
- **Audit trail:** Immutable append-only audit log of all destructive actions and role changes
- **Concurrency guarantees:** Atomic role edits, member disablement, and permission changes

### Phase & Stage Mapping

- **Phase:** 2 – Platform MMC
- **Stage:** STAGE_14_MMC_MEMBERS
- **Prerequisite Stages:** STAGE_02A (Master DB), STAGE_02C (Versioning), STAGE_03 (Authentication)
- **Provides foundation for:** STAGE_15 (MMC Dashboard), STAGE_16 (Audit Dashboard)
- **Reference:** [STAGE_14_MMC_MEMBERS.md](../../../phases/02_PLATFORM_MMC/STAGE_14_MMC_MEMBERS.md)

### Affected Architectural Layers

- **Isolation:** Critical enforcement — MMC users and permissions exist in master_db only, never tenant_db; MMC operations bypass workspace resolver
- **License Enforcement:** Not applicable (MMC is platform control, not customer-dependent)
- **Attempt Engine:** Not applicable
- **Worker:** Not needed for Phase 2 (synchronous only)
- **Runtime:** Session management via token_version for forced invalidation
- **Frontoffice:** Not in scope (MMC is internal platform operations only)
- **Backoffice:** Not applicable (separate from backoffice staff)

---

## Constitutional Compliance Declaration

**Mandatory Compliance Confirmations:**

✓ **No cross-tenant access** — MMC never runs resolver middleware; cannot access tenant databases; all queries scoped to master_db  
✓ **No middleware bypass** — Correlation ID → MMC Authentication → Permission Enforcement → Route Handler  
✓ **No grading outside worker** — Not applicable to MMC  
✓ **No direct DB instantiation** — All MMC queries use global master_db connection pool  
✓ **No snapshot integrity weakening** — Not applicable to MMC  
✓ **No transaction boundary weakening** — Member disablement, role changes, permission edits atomically committed  
✓ **No version enforcement weakening** — No tenant schema versioning; MMC schema is platform versioned once globally

**Governance References:**

- ADR-0001: Database-per-tenant isolation (MMC corollary: master_db is context-isolated)
- ADR-0003: Master DB schema (MMC tables added here)
- ADR-0006: Runtime authoritative time (server time for audit timestamps)
- AGENTS.md § AI Behavioral Enforcement § Tenant Isolation Protection

**Status:** COMPLIANT — MMC is explicitly exempted from tenant resolver because it is explicitly defined as master context. No architectural exceptions required.

---

## Isolation Impact Analysis

### Database Layer Access

| Component       | Database  | Scope           | Resolver Used | Connection Pool    |
| --------------- | --------- | --------------- | ------------- | ------------------ |
| MMC Members     | master_db | Platform global | NO            | Global master pool |
| MMC Roles       | master_db | Platform global | NO            | Global master pool |
| MMC Permissions | master_db | Platform global | NO            | Global master pool |
| Audit Log       | master_db | Platform global | NO            | Global master pool |

### Authentication Domain Boundaries

**MMC (Platform Operations Only)**

- **Users:** Platform administrators, sales team, support team, operations staff
- **Database:** master_db only
- **Token scope:** MMC (no workspace_id)
- **Routes:** /mmc/\* endpoints only
- **Token rejection rules:**
  - If token contains workspace_id → 401 (tenant scope detected, not allowed)
  - If token issued by tenant issuer → 401 (cross-context token reuse attempted)
  - If token_version mismatches DB record → 401 (session invalidated)

### Tenant Resolver Bypass

**Critical Rule:** MMC operations bypass tenant resolver middleware entirely.

```
Request to /mmc/* arrives
  ↓
Correlation ID middleware (generate or extract)
  ↓
MMC Authentication middleware (validate JWT, no workspace_id allowed)
  ↓
MMC Permission enforcement (check role_permissions)
  ↓
Route handler (queries master_db only)
```

**Contrast with tenant routes:**

```
Request to /backoffice/* arrives
  ↓
Correlation ID middleware
  ↓
Tenant resolver middleware (extract workspace_slug, resolve workspace_id)
  ↓
License enforcement
  ↓
Tenant Authentication middleware (validate JWT with workspace_id)
  ↓
Route handler (queries tenant_db)
```

### Cross-Context Token Rejection

**Hard rule:** If an MMC endpoint receives a token with workspace_id attached, authentication fails immediately (401).

Reason: MMC must never accidentally execute tenant-scoped permissions.

### No MMC→Tenant Access

**Hard rule:** MMC services must not import tenant connection pools, tenant resolver, or tenant database modules.

Enforcement:

- Import boundary validation in linter
- Type system prevents tenant pool injection into MMC routes
- No global DB singleton that could be misused

---

## License & Version Enforcement

### Applicability to MMC

**License middleware:** Not required for MMC operations (MMC is platform control, not customer-dependent)

**Version enforcement:** Not required per-tenant (no tenant context exists)

**Schema version control:** Master schema is versioned globally once. All MMC platform operations use same schema version.

### Rationale

MMC controls product licenses, not controlled by them.  
License status changes are made by MMC, not enforced upon MMC.

---

## Data Model Changes

### New Tables (master_db)

#### Table: mmc_members

Purpose: Store MMC internal users with role assignments.

```sql
CREATE TABLE mmc_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,    -- immutable after creation
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,      -- Argon2 or bcrypt only
  role_id UUID NOT NULL REFERENCES roles(id),
  team_id UUID,                             -- logical grouping (nullable)
  group_id UUID,                            -- logical grouping (nullable)
  department_id UUID,                       -- logical grouping (nullable)
  token_version INTEGER DEFAULT 1,          -- incremented on role change or disablement
  status VARCHAR(50) DEFAULT 'ACTIVE',      -- ACTIVE | DISABLED
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES mmc_members(id),
  updated_by UUID REFERENCES mmc_members(id),

  CONSTRAINT username_immutable CHECK (username IS NOT NULL),
  CONSTRAINT valid_status CHECK (status IN ('ACTIVE', 'DISABLED'))
);

CREATE INDEX idx_mmc_members_role_id ON mmc_members(role_id);
CREATE INDEX idx_mmc_members_status ON mmc_members(status);
CREATE INDEX idx_mmc_members_email ON mmc_members(email);
```

#### Table: roles

Purpose: Define MMC role definitions (editable for future customization).

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,               -- role name (e.g., "Platform Administrator")
  description TEXT,
  status VARCHAR(50) DEFAULT 'ACTIVE',      -- ACTIVE | INACTIVE
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX idx_roles_status ON roles(status);
```

#### Table: role_permissions

Purpose: Deterministic permission matrix (one row per domain per role).

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  domain VARCHAR(100) NOT NULL,             -- see domain enum below
  can_view BOOLEAN DEFAULT FALSE,
  can_create BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(role_id, domain),
  CONSTRAINT valid_domain CHECK (domain IN (
    'ORGANIZATION_SETTINGS',
    'PRODUCT_MANAGEMENT',
    'LICENSE_MANAGEMENT',
    'CLIENT_MANAGEMENT',
    'AFFILIATE_MANAGEMENT',
    'MEMBERS_MANAGEMENT',
    'REPORTING'
  ))
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
```

#### Table: mmc_member_invitations

Purpose: One-time invitation workflow for member onboarding.

```sql
CREATE TABLE mmc_member_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id),
  token_hash VARCHAR(255) NOT NULL UNIQUE,  -- SHA256 of one-time token
  status VARCHAR(50) DEFAULT 'PENDING',     -- PENDING | ACCEPTED | EXPIRED
  expires_at TIMESTAMP NOT NULL,
  invited_by UUID NOT NULL REFERENCES mmc_members(id),
  accepted_at TIMESTAMP,
  accepted_by_user_id UUID REFERENCES mmc_members(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED'))
);

CREATE INDEX idx_invitations_email ON mmc_member_invitations(email);
CREATE INDEX idx_invitations_status ON mmc_member_invitations(status);
CREATE INDEX idx_invitations_expires_at ON mmc_member_invitations(expires_at);
```

#### Table: mmc_audit_log

Purpose: Immutable append-only audit trail of all destructive and administrative actions.

```sql
CREATE TABLE mmc_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES mmc_members(id),  -- who performed the action
  action_type VARCHAR(100) NOT NULL,              -- e.g., MEMBER_CREATED, ROLE_UPDATED, MEMBER_DISABLED
  entity_type VARCHAR(100) NOT NULL,              -- e.g., MEMBER, ROLE, PERMISSION
  entity_id UUID,                                 -- the object that was modified
  previous_state JSONB,                           -- snapshot before change
  new_state JSONB,                                -- snapshot after change
  correlation_id UUID NOT NULL,                   -- link to request
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL,

  CONSTRAINT immutable AS (true) NOT UPDATE      -- prevent updates
);

CREATE INDEX idx_audit_actor ON mmc_audit_log(actor_user_id);
CREATE INDEX idx_audit_timestamp ON mmc_audit_log(timestamp);
CREATE INDEX idx_audit_entity ON mmc_audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_correlation ON mmc_audit_log(correlation_id);
```

### Table Relationships

```
mmc_members (many) → roles (one)
roles (one) → role_permissions (many)
mmc_members (many) → mmc_audit_log (actor)
mmc_member_invitations → roles (one)
mmc_member_invitations → mmc_members (one, invited_by)
```

### Migration Impact

- **Version bump required:** Yes (master schema version incremented)
- **Backward compatibility:** N/A (new tables only)
- **Rollback strategy:** Via snapshot restore only (no schema changes to existing tables)
- **Testing requirements:** Schema integrity tests, constraint validation tests

---

## Transaction Boundaries

### Atomic Operations (All Must Complete or Rollback Entirely)

#### Member Creation (Direct Add Mode)

```sql
BEGIN TRANSACTION
  1. Validate username unique
  2. Hash password (Argon2)
  3. INSERT into mmc_members
  4. INSERT into mmc_audit_log (action: MEMBER_CREATED)
COMMIT
```

On failure: Rollback both inserts.

#### Member Creation (Invite Mode)

```sql
BEGIN TRANSACTION
  1. Validate email not already invited
  2. Generate one-time token
  3. Hash token (SHA256)
  4. INSERT into mmc_member_invitations
  5. INSERT into mmc_audit_log (action: INVITATION_SENT)
COMMIT
```

Async: Send email (outside transaction; if email fails, invitation still exists but can be resent).

#### Invitation Acceptance

```sql
BEGIN TRANSACTION
  1. Fetch invitation by token_hash
  2. Validate not expired
  3. Hash provided password
  4. INSERT into mmc_members
  5. UPDATE mmc_member_invitations SET status='ACCEPTED', accepted_at=NOW()
  6. INSERT into mmc_audit_log (action: INVITATION_ACCEPTED)
COMMIT
```

On failure: Rollback all three operations.

#### Member Disablement

```sql
BEGIN TRANSACTION
  1. UPDATE mmc_members SET status='DISABLED', token_version = token_version + 1
  2. INSERT into mmc_audit_log (previous_state: {status: ACTIVE}, new_state: {status: DISABLED})
COMMIT
```

Effect: All active sessions immediately invalidated (token_version mismatch detected on next request).

#### Role Edit with Permission Cascade

```sql
BEGIN TRANSACTION
  1. UPDATE roles SET ... WHERE id=role_id
  2. UPDATE role_permissions SET ... WHERE role_id=role_id
  3. Fetch all mmc_members WHERE role_id=role_id
  4. UPDATE mmc_members SET token_version = token_version + 1 FOR EACH member
  5. INSERT into mmc_audit_log (one entry per member updated)
COMMIT
```

Effect: All members with this role get new token_version; active sessions invalidated immediately.

#### Role Deletion Safety Check

```
1. SELECT COUNT(*) FROM mmc_members WHERE role_id=role_id
2. IF COUNT > 0: REJECT (409 Conflict)
3. ELSE: DELETE FROM role_permissions, DELETE FROM roles (in transaction)
```

Rationale: Never delete role while members assigned.

### Non-Transactional Operations

- **JWT issuance:** No transaction (read-only, idempotent)
- **Permission read-through:** No transaction (read-only)
- **Audit log queries:** No transaction (read-only, append-only)

### Isolation Level

- **All writes:** SERIALIZABLE or REPEATABLE_READ (PostgreSQL default: READ_COMMITTED is insufficient for critical sections)
- **Specific requirement:** Token_version increment must be serializable (no race condition where two edits increment to same value)

---

## Authoritative Time Usage

### Server Time for Timestamps

- **created_at:** NOW() at insert time (server NOT client)
- **updated_at:** NOW() at update time (server NOT client)
- **expires_at (invitations):** NOW() + interval (default 24 hours), computed server-side
- **timestamp (audit log):** NOW() at log write time

### Why Server Time Only

1. **No client clock drift:** Client time could be in future/past
2. **Audit trail integrity:** Audit logs must reflect actual server timestamp
3. **Invitation expiration:** Must not be bypassable by client clock manipulation

### Time Zones

- All times stored as UTC in PostgreSQL TIMESTAMP columns
- API returns ISO 8601 format with Z suffix (UTC)
- No client-side timezone conversion needed (ISO 8601 unambiguous)

---

## Idempotency Strategy

### Idempotent Operations

#### Member edits (non-destructive fields)

```
PUT /mmc/members/{id}
{
  "email": "new@example.com",
  "team_id": "team-123"
}
```

Idempotency: Safe to retry (PUT replaces entire record).

Enforcement: If field values identical to current DB state, return 200 (no-op accepted).

#### Permission reads

```
GET /mmc/members/{id}/permissions
```

Idempotency: Inherently idempotent (read-only).

#### Invitation resend

```
POST /mmc/invitations/{invitation_id}/resend
```

Idempotency: Safe to retry (same email, same role, new token generated).

Enforcement: Idempotency key optional; endpoint is naturally safe to retry.

### Non-Idempotent Operations (Protection Required)

#### Member creation (direct)

```
POST /mmc/members
```

Risk: Double POST could create duplicate member.

Protection:

- UNIQUE(username) constraint prevents duplicate username
- Idempotency key in request header (Idempotency-Key: uuid)
- Redis cache of recent requests (24h TTL):
  - Key: `mmc:idempotency:{idempotency_key}`
  - Value: Response from first attempt
  - On duplicate request: Return cached response

#### Role permission edit

```
PUT /mmc/roles/{id}/permissions
```

Risk: Double PUT could double-increment token_version.

Protection:

- Read current role state
- Calculate new permissions hash
- If permissions unchanged between read and write, skip token_version increment
- Atomic compare-and-set (or rely on transaction serialization)

---

## Observability Requirements

### Structured Logging Fields (All Requests)

Every log entry must include:

```json
{
  "timestamp": "2026-02-25T10:30:00.000Z",
  "level": "info|warn|error|debug",
  "service": "mmc-api",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "mmc_user_id": "user-uuid", // MMC user performing action
  "mmc_username": "admin.user",
  "mmc_role": "platform_admin",
  "action": "MEMBER_CREATED", // or API route
  "http_method": "POST",
  "http_path": "/mmc/members",
  "http_status": 201,
  "duration_ms": 125,
  "message": "Member created successfully"
}
```

### Error Logging

```json
{
  "timestamp": "2026-02-25T10:30:00.000Z",
  "level": "error",
  "service": "mmc-api",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "mmc_user_id": "user-uuid",
  "error_code": "PERMISSION_DENIED",
  "error_message": "User does not have MEMBERS_MANAGEMENT.create permission",
  "requested_permission": "MEMBERS_MANAGEMENT.create",
  "entity_type": "MEMBER",
  "entity_id": "member-123",
  "http_status": 403
}
```

### Audit Events (Mandatory)

Every destructive action logged:

```json
{
  "timestamp": "2026-02-25T10:30:00.000Z",
  "level": "warn",
  "service": "mmc-api",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "audit_event": true,
  "actor_mmc_user_id": "user-uuid",
  "action_type": "MEMBER_DISABLED",
  "entity_type": "MEMBER",
  "entity_id": "member-456",
  "previous_state": { "status": "ACTIVE", "token_version": 5 },
  "new_state": { "status": "DISABLED", "token_version": 6 },
  "message": "Member disabled by admin"
}
```

### Forbidden Patterns

- ❌ NO plaintext passwords in logs
- ❌ NO raw JWT tokens in logs
- ❌ NO password hashes in logs
- ❌ NO email addresses in logs (use masked: "user@e\*\*\*.com")
- ❌ NO stack traces to client (error_code + message only)
- ❌ NO console.log (use structured logger only)

### Metrics (Optional but Recommended)

Emit metrics for:

- `mmc.members.created` (counter)
- `mmc.members.deleted` (counter)
- `mmc.roles.edited` (counter)
- `mmc.permission_checks.total` (counter)
- `mmc.permission_checks.denied` (counter)
- `mmc.auth.login_attempts` (counter)
- `mmc.auth.login_failures` (counter)

---

## Rate Limiting & Abuse Protection

### Endpoint Classification

| Endpoint              | Classification | Rate Limit | Notes                  |
| --------------------- | -------------- | ---------- | ---------------------- |
| POST /mmc/auth/login  | Public auth    | 5/min/IP   | Per-IP, no user bound  |
| GET /mmc/members      | Authenticated  | 60/min     | Per-authenticated user |
| POST /mmc/members     | Authenticated  | 10/min     | Per-authenticated user |
| PUT /mmc/members/{id} | Authenticated  | 20/min     | Per-authenticated user |
| DELETE /mmc/members   | Authenticated  | 5/min      | Per-authenticated user |

### Login Attempt Protection

```
POST /mmc/auth/login
  Rate limit: 5 failed attempts per minute per IP
  On 6th failure in minute: 429 Too Many Requests
  Lockout duration: 1 hour
  Log: Failed login attempt (IP + timestamp)
```

### Invitations Rate Limiting

```
POST /mmc/invitations
  Rate limit: 20 invitations per hour per user
  Reason: Prevent spam invitations
```

### Justification for Strict Limits

- MMC is internal operations only (small user base)
- Abuse by external attacker would be caught immediately
- Strict limits prevent accidental bulk requests
- Audit logs captured for all attempts

---

## Layer Separation Confirmation

### Frontend (MMC UI)

❌ **NO** permission enforcement in UI  
❌ **NO** business logic in UI  
❌ **NO** direct DB access  
❌ **NO** token validation logic  
✓ **YES** Display permission check results from API  
✓ **YES** Hide buttons for actions user cannot perform (UX only, not security)

### API Layer (/mmc/\* routes)

✓ **YES** Permission enforcement before business logic  
✓ **YES** Token validation  
✓ **YES** Route to domain services  
✓ **YES** Structured error responses  
✓ **YES** Audit logging  
❌ **NO** Direct password handling (hash immediately using utility function)  
❌ **NO** Business logic (delegate to domain services)

### Domain Services (packages/domain-core)

✓ **YES** Member lifecycle logic  
✓ **YES** Role permission evaluation  
✓ **YES** Token version invalidation logic  
❌ **NO** HTTP logic  
❌ **NO** Database instantiation (receive DB pool context)

### Database

✓ **YES** Constraints enforce data integrity  
✓ **YES** UNIQUE, NOT NULL, CHECKs enforced  
✓ **YES** Foreign keys enforced  
✓ **YES** Audit log immutability (stored as table property)

### Forbidden Crossing

- ❌ UI → Database schemas
- ❌ API → Direct tenant DB access
- ❌ Domain → HTTP logic
- ❌ Worker → Grading logic (not applicable here)

---

## Failure Modes & Recovery

### Database Failure Handling

| Failure Mode              | Response Code | Recovery                                                   |
| ------------------------- | ------------- | ---------------------------------------------------------- |
| Connection pool exhausted | 503           | Retry after exponential backoff (client)                   |
| Deadlock detected         | 500           | Retry transaction (API layer, max 3x)                      |
| Constraint violation      | 409           | Return descriptive error (e.g., "username already exists") |
| FK violation              | 400           | Return error (e.g., "role_id does not exist")              |

### Transaction Rollback

On any operation failure during transaction:

1. PostgreSQL auto-rollbacks (ACID)
2. Audit log entry NOT created (partial failure preserved)
3. API returns 500 (if system failure) or 400/409 (if validation failure)
4. Log error with correlation_id for debugging

### Password Hash Failure

If Argon2/bcrypt fails during member creation:

1. Transaction rollbacks
2. Return 500 ("Internal server error")
3. Log error with stack trace (server-side only)
4. Never expose hash algorithm details to client

### Token Version Mismatch Handling

On request with invalidated token (token_version mismatch):

1. Authorization middleware detects mismatch
2. Return 401 Unauthorized
3. Client must re-authenticate (re-login required)
4. Log event as "session_invalidated" (audit trail, not error)

### Invitation Expiration

If invitation expires before user clicks link:

1. User clicks link → token validation fails
2. Return 401 ("Invitation expired")
3. User must request new invitation
4. Old invitation record stays in DB (immutable audit trail)

### Concurrent Role Edit Race Condition

Scenario: Two admins edit role permissions simultaneously.

Solution (via SERIALIZABLE isolation):

1. First transaction acquires lock on role_permissions rows
2. Second transaction waits for lock
3. First commits successfully
4. Second retries, re-reads updated permissions, continues
5. Both succeed (no data corruption, but second might operate on stale read)

Alternative via Compare-and-Set:

1. Read role + permissions, compute hash
2. Update only if hash still matches
3. If not: Return 409 (Conflict), client must re-read and retry

---

## User Scenarios & Testing

### Scenario 1: New Member Onboarding (Invite Flow)

**Actor:** Platform Administrator  
**Goal:** Invite new sales team member

**Flow:**

1. Admin navigates to MMC Members page
2. Admin clicks "Invite Member"
3. Admin enters: email, role (Sales Team)
4. System generates invitation, sends email
5. Sales person clicks email link
6. System validates one-time token
7. Sales person creates password
8. Account activated, user logs in
9. Permissions loaded from role_permissions table
10. User can now access PRODUCT_MANAGEMENT and CLIENT_MANAGEMENT domains only (per Sales role)

**Success Criteria:**

- Invitation email received
- One-time link valid for 24 hours
- Password requirement enforced (min 8 chars, complexity)
- User immediately operational in assigned role

### Scenario 2: Role Permission Update with Session Invalidation

**Actor:** Platform Administrator  
**Goal:** Remove AFFILIATE_MANAGEMENT.delete from Sales role (policy change)

**Flow:**

1. Admin edits "Sales Team" role
2. Admin unchecks "Delete Affiliates" under AFFILIATE_MANAGEMENT domain
3. System updates role_permissions table
4. System increments token_version for ALL members with Sales role (e.g., 5 → 6)
5. Two sales people currently logged in:
   - Person A: Next request fails with 401 (token_version mismatch)
   - Person B: Must re-login
6. Both re-login, get new token with updated permissions

**Success Criteria:**

- Permission change effective immediately (no session lingering)
- Audit log shows old permissions + new permissions
- Re-authentication flow seamless
- No manual token revocation needed

### Scenario 3: Member Disablement (Compliance)

**Actor:** Compliance Officer  
**Goal:** Disable departing employee

**Flow:**

1. Officer navigates to member details
2. Officer clicks "Disable" (requires MEMBERS_MANAGEMENT.edit)
3. Member status changed to DISABLED
4. Member token_version incremented
5. Email notification sent to member (optional)
6. Any active sessions from that member now invalid
7. Login attempts from disabled member blocked at authentication step

**Success Criteria:**

- Member cannot login immediately
- Active sessions invalidated instantly
- Audit log captures who disabled and when
- Account can be re-enabled by admin (reversible)

### Scenario 4: Permission Check Enforcement

**Actor:** Support Team Member  
**Goal:** View but cannot edit product configurations

**Flow:**

1. Support person logs in, token issued with permissions
2. Support person views PRODUCTs (can_view=true) → 200 OK
3. Support person attempts DELETE /mmc/products/{id} → Permission check happens in API layer
4. API queries role_permissions (PRODUCT_MANAGEMENT domain)
5. Check fails: can_delete=false
6. Return 403 Forbidden ("Insufficient permissions for PRODUCT_MANAGEMENT.delete")
7. Audit log: Permission check failed

**Success Criteria:**

- Permission denial logged
- No business logic executed
- Clear error message returned
- Business invariants protected

---

## Functional Requirements

### F1: Member Management

**Requirement:** Create MMC members via direct add or invitation

**Details:**

- Direct add: Provides username, email, password (hashed immediately)
- Invite flow: Generates one-time token, sends email, user sets password on click
- Username immutable after creation (enforced by constraint)
- Email unique across all MMC members

**Testable:** Given member creation request, verify (a) member record exists, (b) password hashed, (c) audit logged

### F2: Role Assignment

**Requirement:** Assign one role per member; role must exist and be active

**Details:**

- One member: exactly one role (not nullable)
- Cannot assign INACTIVE role
- Role must exist in roles table
- Foreign key enforced

**Testable:** Attempt to assign non-existent role → 400 error; attempt to assign INACTIVE role → 400 error

### F3: Deterministic Permission Resolution

**Requirement:** Permissions resolved from role_permissions table; no implicit inheritance or runtime evaluation

**Details:**

- Member → role_id → role_permissions rows (one per domain)
- If permission row missing for domain: DENY by default
- can_view, can_create, can_edit, can_delete are sufficient (no role inheritance)
- No ABAC rules

**Testable:** Query role_permissions for member's role; verify exact match to API enforcement

### F4: Token Version Enforcement

**Requirement:** Session invalidation via token_version mismatch

**Details:**

- token_version incremented: (a) member disabled, (b) role changed, (c) manual reset by admin
- On each request: middleware compares token.token_version with DB mmc_members.token_version
- Mismatch → 401 Unauthorized (session invalidated)

**Testable:** Increment member token_version; next request with old token fails with 401

### F5: Atomic Member Disablement

**Requirement:** Member status change and token_version increment atomic

**Details:**

- Single transaction: UPDATE mmc_members SET status='DISABLED', token_version = token_version + 1
- On failure: entire operation rolls back

**Testable:** Kill connection mid-transaction; verify no partial state

### F6: Atomic Role Edit with Cascade

**Requirement:** Role permission changes cascade to all members; all get incremented token_version

**Details:**

- Single transaction: UPDATE role, UPDATE role_permissions, UPDATE all mmc_members
- All changes committed atomically
- If any UPDATE fails: entire transaction rolls back

**Testable:** Verify all affected members get new token_version; no member skipped

### F7: Invitation Expiration

**Requirement:** One-time invitation tokens expire after 24 hours

**Details:**

- expires_at computed as NOW() + 24 hours at creation
- Acceptance validates: status='PENDING' AND expires_at > NOW()
- Expired invitation cannot be accepted

**Testable:** Create invitation; wait past expiration; attempt acceptance → 401

### F8: Audit Trail

**Requirement:** All destructive actions logged immutably

**Details:**

- Member creation logged
- Role edit logged (with before/after values)
- Member disablement logged
- Audit log append-only (no updates or deletes via API)

**Testable:** Perform action; query mmc_audit_log; verify entry exists with correct data

### F9: Login Authorization

**Requirement:** Disabled members cannot login; token_version checked

**Details:**

- Authentication endpoint checks: status='ACTIVE'
- Token issued only if status='ACTIVE' AND password_hash matches
- TokenVersion enforced on every subsequent request

**Testable:** Attempt login with disabled member → 401; attempt login with wrong password → 401

### F10: Permission Enforcement at API Layer

**Requirement:** Permission checks executed before business logic

**Details:**

- Middleware queries role_permissions
- Enforces can_view, can_create, can_edit, can_delete per domain
- Returns 403 if check fails
- Audit logs permission denials

**Testable:** User lacking permission attempts action → 403; action not executed

---

## Success Criteria

### User Experience Metrics

1. **Member onboarding time:** New member operational within 5 minutes of invitation acceptance
2. **Permission application time:** Role changes effective within 30 seconds across all active users
3. **Error clarity:** Permission denial errors include specific domain + action (e.g., "PRODUCT_MANAGEMENT.create")

### Security Metrics

1. **Zero cross-tenant token acceptance:** MMC tokens with workspace_id rejected at authentication layer
2. **Session invalidation:** Role/disablement changes invalidate sessions within 1 second
3. **Audit trail completeness:** 100% of destructive actions logged with actor, timestamp, and change snapshot

### Operational Metrics

1. **Database consistency:** No orphaned members (FK constraints enforced)
2. **Concurrency safety:** Token_version increment is serializable (no race conditions)
3. **Availability:** MMC endpoints respond in < 500ms p95

### Security Validation

1. **No implicit super-admin bypass:** All permissions must be explicit in role_permissions table
2. **No plaintext secrets:** All passwords hashed; all tokens signed
3. **No cross-context reuse:** MMC token rejected by tenant endpoints; vice versa

### Compliance

1. **Audit logged:** All member changes, role edits, permission denials logged with correlation_id
2. **Role immutability:** INACTIVE roles prevent assignment; deleted roles with zero members only
3. **RBAC determinism:** Permission resolution uses table lookup only; no runtime policy evaluation

---

## Not Allowed

- ❌ Hardcoded super-admin bypass (all permissions must be in role_permissions table)
- ❌ Deleting role if members assigned (FK constraint + business logic check)
- ❌ Plaintext passwords (must be hashed before persistence)
- ❌ Missing permission rows for a role (UNIQUE constraint enforces one row per domain per role)
- ❌ MMC tokens accepted by tenant APIs (middleware rejects if workspace_id present)
- ❌ Audit log updates or deletes via API (append-only)
- ❌ Implicit permission inference (role_permissions table is source of truth, permissions not in table = denied)
- ❌ Client-side permission checks as security boundary (UI hints only; API enforces)

---

## Assumptions

1. **Bcrypt or Argon2 available:** Assumed password hashing library pre-installed in dependencies
2. **PostgreSQL version 13+:** UNIQUE, CHECK, FK constraints fully supported
3. **Bun + Hono routing:** Middleware can be stacked (correlation ID → auth → permission → route)
4. **Master DB connection pool singleton:** Assumed available as `getMasterPool()` utility
5. **Email service available:** Assumed invitation emails can be sent asynchronously (no blocking)
6. **24-hour invitation TTL acceptable:** No customization per environment in Phase 2
7. **One role per member sufficient:** Phase 2 does not require multi-role or dynamic role assignment
8. **No external RBAC system:** All authorization data lives in Zidney (not delegated to external IdP)
9. **Server time synchronized:** Assumed NTP sync on all Zidney servers (clock drift < 1 second)

---

## Dependencies

### Internal Dependencies

- **Master DB schema:** Assumes STAGE_02A completed (master_db exists)
- **Authentication system:** Assumes STAGE_03 completed (JWT issuer available)
- **Logging package:** Assumes `packages/logger` available with structured logging
- **Validation package:** Assumes `packages/validation` available with password + email validators

### External Dependencies

- **PostgreSQL 13+:** For UNIQUE, CHECK, FK enforcement
- **Bcrypt or Argon2:** Password hashing library
- **Email service:** SMTP or cloud email provider for invitation sending

### Blocked By

- None (can proceed after Master DB schema ready)

### Blocks

- STAGE_15 (MMC Dashboard) — requires MMC member & permission system operational
