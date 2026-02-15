# STAGE 03 – Authentication System

Phase: 1 – Platform Foundation  
Status: Critical  
Scope: Workspace-isolated authentication, JWT governance & access enforcement

---

## Objective

Implement a secure, strictly isolated authentication system that guarantees:

- Zero cross-workspace token leakage
- License-aware login enforcement
- Schema-version-aware session validation
- RBAC enforcement at API level
- Forced token invalidation capability
- Audit-grade traceability

Authentication is Zidney’s second layer of institutional trust.

---

## Authentication Domains

Zidney has three isolated authentication domains:

1. MMC (Platform-level)
2. Backoffice (Workspace staff)
3. Frontoffice (Students)

These domains MUST NEVER share:

- User tables
- JWT scope
- Access endpoints
- Authorization middleware

Isolation is strict.

---

## MMC Authentication (Platform)

Stored in: `master_db`

Users:

- Platform administrators
- Internal operators

JWT claims:

- scope: "MMC"
- user_id
- role
- token_version
- issued_at
- expiration

MMC tokens:

- Must NOT contain workspace_id
- Must NOT access tenant APIs
- Must only access master-level routes

MMC runtime must reject any token containing workspace context.

---

## Backoffice Authentication (Workspace Staff)

Stored in: tenant database

Users:

- Staff
- Instructors
- Workspace administrators

JWT must contain:

- scope: "BACKOFFICE"
- workspace_id
- user_id
- role
- permissions (derived from role)
- token_version
- schema_version
- product_version
- issued_at
- expiration

Backoffice tokens are valid ONLY for their workspace.

---

## Frontoffice Authentication (Students)

Stored in: tenant database

Students:

- Belong to exactly one division
- Belong to exactly one workspace
- Subscription-bound

JWT must contain:

- scope: "FRONTOFFICE"
- workspace_id
- user_id
- role = STUDENT
- division_id
- subscription_status
- token_version
- schema_version
- product_version
- issued_at
- expiration

Students cannot belong to multiple workspaces.

---

## JWT Signing Model

Decision: Single global secret with mandatory workspace claim validation.

Requirements:

- HS256 or stronger
- Short-lived access tokens (recommended ≤ 15 min)
- Refresh tokens optional (Phase 2+)
- token_version mandatory
- workspace_id mandatory for tenant tokens
- schema_version mandatory
- product_version mandatory

No permanent tokens allowed.

---

## Workspace Isolation Enforcement

On every authenticated request:

1. Validate JWT signature
2. Validate expiration
3. Validate scope
4. Resolve tenant via resolver
5. Compare:
   - token.workspace_id == resolved.workspace_id
6. Reject if mismatch (401)
7. Validate token_version
8. Validate schema_version compatibility
9. Validate license state (middleware from Stage 04)

If ANY check fails → reject request.

Token from workspace A must NEVER function in workspace B.

---

## Token Versioning & Forced Invalidation

users table must include:

- token_version (integer)

JWT must include token_version.

On each request:

IF token.token_version != user.token_version  
→ Reject (401)

Increment token_version when:

- Password changes
- Role changes
- Security breach
- Manual logout-all
- Account suspension

This enables stateless invalidation.

---

## Schema & Product Version Validation

JWT must contain:

- schema_version
- product_version

On each request:

IF token.schema_version != tenant.schema_version  
→ Reject (426 Upgrade Required)

IF token.product_version incompatible  
→ Reject (426)

Prevents:

- Old sessions after workspace upgrade
- Runtime/schema drift

---

## Soft Lock & License Awareness

Authentication must consult License Engine middleware.

If license status:

ACTIVE → allow  
SOFT_LOCKED → reject login (423)  
ARCHIVED → reject (403)  
DELETED → reject (403)

Soft-lock enforcement must occur BEFORE token issuance.

No token issued if workspace not ACTIVE.

---

## Subscription Awareness (Frontoffice Only)

On login:

IF subscription expired:

- Allow login
- Restrict content access
- Allow certificate viewing
- subscription_status must be included in JWT

Subscription enforcement occurs at API permission layer.

---

## Login Protection Policy

Must implement:

- Failed login attempt counter
- Account lock after N failures
- Lock duration configurable
- Reset counter on success
- Log all failures

Optional:

- IP rate limiting
- Exponential backoff
- Captcha integration (future)

All events must be stored in tenant audit_logs.

---

## RBAC Enforcement

RBAC stored per workspace:

- roles
- role_permissions
- user_roles

Rules:

- Permission checks MUST occur in backend only
- Frontend must not enforce security
- No division-level override in Phase 1

Permission failure → 403

---

## Authentication Audit Logging

Every auth event must log:

- event_type
- correlation_id
- workspace_slug
- user_id (if known)
- ip_address
- user_agent
- timestamp
- result

Events include:

- login_success
- login_failed
- account_locked
- token_invalid
- token_version_mismatch
- workspace_mismatch
- license_blocked

Logs must be structured JSON (Pino format).

---

## What Is Strictly Forbidden

- Shared auth tables across tenants
- Token without workspace claim
- Long-lived tokens
- Frontend-only permission checks
- Silent token reuse after role change
- Skipping schema validation
- Issuing tokens for SOFT_LOCKED workspace

---

## Validation Criteria

Stage complete when:

- MMC login works
- Backoffice login works
- Frontoffice login works
- Workspace mismatch blocked
- Token version invalidation works
- Schema mismatch blocked
- License block enforced
- Subscription claim present
- RBAC enforced
- Failed login lock works
- Audit logs generated

---

### Stability Principle

Authentication protects institutional identity.

If a token can:

- Cross workspaces
- Survive upgrade incompatibility
- Bypass license state
- Ignore token_version

Zidney becomes insecure.

No further phase allowed until authentication is verified stable.
