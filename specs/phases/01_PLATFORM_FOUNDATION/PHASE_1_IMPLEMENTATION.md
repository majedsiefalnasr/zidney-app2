# PHASE 1 – IMPLEMENTATION PLAN

Phase: 01_PLATFORM_FOUNDATION  
Objective: Build stable multi-tenant core before any UI

---

## Execution Philosophy

Phase 1 must be implemented strictly in order.

Do NOT parallelize.  
Do NOT build UI.  
Do NOT move to Phase 2 until ALL validation criteria pass.

Foundation stability overrides feature speed.

---

## Step 1 – Monorepo & Environment

Implement:

1. Monorepo structure
2. Shared configuration (tsconfig, eslint, prettier)
3. Docker Compose (infra only):
   - Postgres (single instance, master + tenant DBs)
   - Redis
   - PgBouncer (optional if added now)
4. Backend boot structure
5. Environment separation:
   - development
   - production

VALIDATE:

- API boots
- Master DB connection works
- Redis connection works
- TypeScript passes
- Lint passes

STOP IF FAILS.

---

## Step 2 – Master Database Schema

Implement master database with:

- products
- licenses
- tenants_registry
- affiliates
- mmc_members
- roles
- role_permissions
- audit_logs
- platform_schema_version

Add:

- Migration system (idempotent)
- Migration locking mechanism
- Rollback capability

Platform must refuse to start if:

- Master schema version mismatches expected version

VALIDATE:

- Migrations run clean
- Rollback works
- Schema version tracked
- App blocks on version mismatch

STOP IF FAILS.

---

## Step 3 – Authentication Core

Implement:

- JWT generation
- JWT validation middleware
- Workspace-scoped tokens
- Password hashing (Argon2 or bcrypt)
- Token expiration
- Role permission injection

Security constraints:

- Fixed JWT signing algorithm
- No algorithm override
- No long-lived tokens
- No secrets in logs

VALIDATE:

- Protected routes block unauthorized
- Role permission enforced
- Disabled user blocked
- Cross-workspace token rejected

STOP IF FAILS.

---

## Step 4 – Tenant Resolution Middleware

Implement:

- workspace_slug extraction (subdomain + path support)
- tenants_registry lookup
- License state validation
- Schema version validation
- Product version compatibility check
- In-memory pool per tenant

Enforcement rules:

- ARCHIVED → 403
- SOFT_LOCKED → 423
- Schema mismatch → 426
- Product incompatibility → 426

VALIDATE:

- Correct DB resolved
- Cross-workspace access blocked
- Schema mismatch blocks request
- License status enforced
- Logs include workspace_slug + request_id

STOP IF FAILS.

---

## Step 5 – Provisioning Service

Implement asynchronous provisioning (job queue based):

License enters PROVISIONING state.

Provisioning job:

- Create tenant DB
- Run tenant migrations
- Seed baseline data
- Register in tenants_registry
- Mark license ACTIVE

On failure:

- Rollback DB
- Remove registry entry
- Mark license FAILED
- Log critical error

VALIDATE:

- DB created
- DB deleted on failure
- Registry consistent
- No orphan DB
- No orphan registry entry

STOP IF FAILS.

---

## Step 6 – License Lifecycle Engine

Implement:

- Soft lock logic (90 days)
- Automatic archive transition
- Archive metadata snapshot
- Restore flow
- Permanent deletion flow

Snapshot in Phase 1:

- Metadata only
- Snapshot reference integrity verified

All lifecycle transitions must be audited.

VALIDATE:

- Soft lock blocks login
- Archive blocks access
- Restore reactivates workspace
- Deletion irreversible
- Automatic archive after expiration enforced in middleware

STOP IF FAILS.

---

## Step 7 – Attempt Engine Foundation

Implement unified attempt model:

- Snapshot exam configuration at start
- Snapshot question list and order
- Snapshot grading configuration
- Store real-time progress
- Store attempt mode

All operations must be transactional:

- Attempt start in transaction
- Attempt submission in transaction
- Limit enforcement in transaction
- Row-level locking for submission

Implement:

- Idempotent submission
- Attempt state transitions
- Attempt locking

VALIDATE:

- Duplicate submission returns same result
- Config change after start does NOT affect attempt
- Attempt immutable after submission
- No race condition under concurrent submission

STOP IF FAILS.

---

## Step 8 – Observability Baseline

Implement:

- Structured logging (Pino)
- Correlation ID per request
- Workspace slug in all logs
- Attempt ID trace logging
- Standard error response shape
- No secret leakage

VALIDATE:

- Logs structured JSON
- Correlation ID propagated
- Errors consistent shape
- Sensitive fields never logged

STOP IF FAILS.

---

## Step 9 – Rate Limiting & Security

Implement:

- Login rate limiting
- Attempt start rate limiting
- Submission idempotency enforcement
- WebSocket authentication validation
- Strict CORS configuration
- Security headers
- Audit logs for security events
- Cross-workspace token rejection hard check

VALIDATE:

- Brute force blocked
- Double submission blocked
- Token replay rejected
- Cross-workspace token rejected
- Security events logged

STOP IF FAILS.

---

## Phase 1 Completion Checklist

You may move to Phase 2 ONLY IF:

- Tenant provisioning works
- Lifecycle enforcement stable
- Attempt snapshot model verified
- Schema version enforcement active
- Structured logs active
- Rate limiting active
- No cross-workspace leak possible
- No race condition in submission
- Version mismatch blocks runtime

---

## Strict Prohibition

Do NOT:

- Build MMC UI
- Build Backoffice
- Build Frontoffice
- Add features beyond foundation
- Bypass middleware for testing

Foundation must be stable before expansion.

Phase 1 defines institutional trust.

If foundation is unstable, stop development.
