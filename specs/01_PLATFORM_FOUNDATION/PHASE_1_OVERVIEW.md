# PHASE 1 – Platform Foundation

Version: 1.1  
Status: Authoritative  
Scope: Infrastructure, Isolation, Runtime Core (No UI)

---

## Purpose

Phase 1 establishes the non-negotiable architectural foundation of Zidney.

This phase defines:

- Database-per-tenant isolation
- License lifecycle authority
- Tenant provisioning model
- Workspace-scoped authentication
- Snapshot-based attempt engine
- Observability standards
- Security and rate limiting baseline
- Forward-only migration model

No UI implementation is allowed in this phase.

Phase 1 is infrastructure hardening only.

---

## Architectural Invariants (Must Never Change)

The following rules are permanent platform guarantees:

- Multi-tenancy is database-per-tenant (not row-based).
- All tenant access is resolved through middleware.
- No cross-tenant data access is possible.
- License state is enforced at runtime on every request.
- Attempts are snapshot-based (never live-referenced).
- Migrations are forward-only.
- Workspace identity is immutable.
- Deletion is manual and irreversible.

Any violation of these invariants invalidates platform integrity.

---

## Core Components

### Master Database

The master database contains only platform-level entities:

- products
- licenses
- tenants_registry
- mmc_users
- platform_settings
- platform_schema_version

The master database must never store:

- student data
- attempts
- exams
- certificates
- subscriptions
- tenant runtime content

Tenant runtime data lives exclusively inside tenant databases.

---

### Tenant Resolution Layer

For every workspace-bound request:

1. Extract workspace slug (subdomain or path).
2. Resolve tenant record from tenants_registry.
3. Validate license state.
4. Resolve tenant database connection.
5. Attach tenant context to request.

Failure cases:

- Not found → 404
- Archived → 403
- Soft locked → 423
- Schema mismatch → 426
- DB unavailable → 503

No service may access a tenant database outside resolver context.

---

### License Engine

A License connects Product → Workspace.

License contains:

- product_id
- workspace_slug (globally unique and immutable)
- schema_version
- product_version
- student_limit
- staff_limit
- status (ACTIVE | SOFT_LOCKED | ARCHIVED | DELETED)
- soft_lock_until
- archive_snapshot_reference

State transitions:

ACTIVE → SOFT_LOCKED → ARCHIVED → DELETED

Rules:

- Soft lock duration: 90 days
- Renewal during soft lock restores immediately
- Archive requires full snapshot
- Deletion requires manual confirmation
- DELETED is terminal

License validation must execute in middleware on every request.

---

### Tenant Provisioning Service

Internal service only.

Responsibilities:

- Create tenant database
- Run baseline schema migrations
- Seed minimal structural data
- Register tenant in master database
- Handle archival snapshots
- Handle permanent deletion

Provisioning must be:

- Idempotent
- Auditable
- Transaction-safe
- Failure-safe

Database and registry must never diverge.

---

### Authentication Isolation

Three isolated domains:

- MMC (master DB)
- Backoffice (tenant DB)
- Frontoffice (tenant DB)

Rules:

- JWT must contain workspace_id for tenant scopes
- Tokens cannot cross workspaces
- No shared session store across tenants
- License state validated before authentication finalization

Authentication is workspace-bound and database-bound.

---

### Attempt Engine Foundation

All attempts are unified and snapshot-based.

At attempt start, snapshot:

- Question IDs
- Question order
- Mode (Relax | Chrono | Rush)
- Config flags
- Grading configuration
- Time limits
- product_version
- schema_version

During grading:

- Never reference live exam configuration
- Never re-read question config from exam entity

Submission must be:

- Idempotent
- Worker-finalized
- Server-authoritative

---

### Observability Baseline

Mandatory:

- Structured logging (Pino)
- correlation_id per request
- workspace_slug tagging
- workspace_id tagging
- attempt_id tagging
- job_id tagging (worker)

No unstructured logs allowed.

All critical operations must be traceable.

---

### Rate Limiting & Security Baseline

Redis-backed rate limiting must protect:

- Login endpoints
- Attempt start endpoints
- Submission endpoints
- Websocket channels

Submission must enforce idempotency keys.

Security must include:

- Password hashing (Argon2 or equivalent)
- No plaintext secrets
- No direct DB exposure
- No bypass of middleware validation

---

### Migration Model

Rules:

- Forward-only migrations
- One migration per feature change
- Never modify historical migrations
- Schema version tracked per tenant
- Platform version compared at runtime

Rollback strategy:

- Restore snapshot
- Never reverse-migrate

---

## Explicitly Out of Scope

Phase 1 excludes:

- MMC UI
- Backoffice UI
- Frontoffice UI
- Content management
- Ads
- Certificates UI
- Analytics dashboards

Only infrastructure and runtime engines are built here.

---

## Completion Criteria

Phase 1 is complete when:

- Master DB operational
- Tenant provisioning verified
- License lifecycle validated
- Tenant isolation tested
- Attempt snapshot integrity validated
- Worker finalization validated
- Structured logs verified
- Rate limiting tested
- Migration reproducibility validated
- Local environment mirrors production

No Phase 2 development may begin before all criteria are met.

---

## Stability Principle

Platform stability precedes UI velocity.

If Phase 1 is unstable, every higher phase collapses.

This phase defines Zidney’s trust contract with institutions.
