# STAGE_59_FRONTOFFICE_AUTH

Phase: 05_FRONTOFFICE_RUNTIME  
Scope: Student authentication per workspace  
Runtime: Backend API

---

## Objective

Implement secure, tenant-isolated authentication for Frontoffice (student users).

Authentication must:

- Be workspace-scoped
- Use JWT
- Be fully stateless
- Enforce subscription awareness
- Prevent cross-tenant token usage

Frontoffice authentication must never bypass tenant resolver.

---

## Authentication Flow

Login endpoint:

POST /workspace/:workspace_slug/student/signin

Flow:

1. Resolve workspace via tenant resolver middleware.
2. Validate license status = ACTIVE.
3. Validate workspace not ARCHIVED.
4. Query tenant database for student user.
5. Verify password hash.
6. Validate user status = ENABLED.
7. Issue JWT.

If license = SOFT_LOCKED:
Return 423.

If license = ARCHIVED:
Return 403.

If credentials invalid:
Return 401.

---

## Data Source

Students are stored inside tenant database only.

No master-level student table allowed.

Authentication must use:

- users table
- role = STUDENT
- status = ENABLED

---

## JWT Structure

JWT must include:

- user_id
- workspace_id
- workspace_slug
- role = STUDENT
- division_id
- subscription_status
- token_version
- issued_at
- expires_at

JWT must be signed using:

- Global secret with workspace claim
  OR
- Workspace-scoped secret

Recommended: Global secret with mandatory workspace claim validation.

---

## Token Rules

- Short-lived access token required.
- Refresh tokens optional (future stage).
- Token must include workspace_slug.
- Token without workspace_slug is invalid.
- Expired token must return 401.

No long-lived tokens allowed.

---

## Workspace Isolation Enforcement

On every authenticated request:

1. Validate JWT signature.
2. Extract workspace_slug.
3. Compare with resolver workspace.
4. Reject if mismatch.

Token from workspace A must not work in workspace B.

Cross-tenant access is forbidden.

---

## Subscription Awareness

Subscription enforcement happens after authentication.

JWT must include:

subscription_status:

- ACTIVE
- EXPIRED
- NONE

Login must not fail due to expired subscription.

Expired subscription behavior:

- Allow login
- Restrict dashboard access
- Allow certificate access
- Block exam start

Subscription enforcement handled in STAGE_60_SUBSCRIPTION_ENFORCEMENT.

---

## Password Security

- Passwords hashed with Argon2 or bcrypt.
- No plain text storage.
- Reset tokens must be hashed and time-limited.
- No password values logged.

Rate limiting must apply to login endpoint.

---

## Soft Lock Handling

If license status = SOFT_LOCKED:

- Login must be blocked.
- Return 423 Locked.

If renewed:

- Login restored immediately.

---

## Observability Requirements

Every login attempt must log:

- workspace_slug
- user_id (if exists)
- success or failure
- failure_reason
- request_id

Never log raw password.

---

## Validation Criteria

Stage complete when:

- Student login works per workspace.
- Cross-tenant token rejected.
- Soft lock blocks login.
- Archived workspace blocks login.
- Expired subscription still allows login.
- JWT contains required claims.
- Token expiration enforced.
- Rate limiting enforced on login.

---

## Forbidden

- Shared global student authentication.
- Token without workspace context.
- Authentication before tenant resolution.
- Role logic handled in frontend.
- Long-lived permanent tokens.

Authentication is the entry point to runtime security.
Tenant isolation rules apply strictly.
