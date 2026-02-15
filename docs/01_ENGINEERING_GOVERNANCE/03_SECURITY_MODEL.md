# Security Model

Phase Alignment: Platform-wide  
Applies To: API, Worker, MMC, Backoffice, Frontoffice

This document defines Zidney’s mandatory security baseline.  
All services and future features must comply.

---

## Authentication Model

Authentication is strictly workspace-isolated.

Three authentication domains exist:

- MMC (platform-level, master_db)
- Backoffice (tenant DB – staff)
- Frontoffice (tenant DB – students)

Rules:

- JWT must always include workspace_id (except MMC scope)
- Tokens are short-lived
- Refresh tokens stored securely (HTTP-only cookies if applicable)
- Token signature validated on every request
- Token_version enforced for revocation

Hard requirements:

- No shared authentication across workspaces
- Token from workspace A must never work in workspace B
- Workspace context must match resolved tenant

Password storage:

- Argon2id preferred (bcrypt acceptable if standardized)
- No plain text storage
- No password in logs
- Reset tokens time-limited and stored hashed

---

## Authorization Model (RBAC)

RBAC is enforced server-side only.

Per workspace:

- roles table
- role_permissions table
- user_roles relation

Rules:

- Permission checks mandatory in API layer
- No frontend-only protection
- Status transitions must require explicit permission
- Role creation/modification restricted to privileged roles

Division-level overrides are not supported in Phase 1.

---

## Tenant Isolation

Isolation level: Database-per-tenant.

Guarantees:

- No row-based multi-tenancy
- No shared runtime data tables
- No cross-database joins
- No cross-tenant references
- No fallback default DB

All DB access must come from tenant resolver context.

Connection pools:

- One pool per tenant
- No global shared pool for tenant data

Schema version enforced before request execution.

---

## License Enforcement

Every workspace-bound request must validate:

- License exists
- Status != ARCHIVED
- Status != DELETED
- Soft-lock window respected
- Schema version compatible
- Product version compatible

No route may access tenant DB before license validation middleware.

---

## Rate Limiting & Abuse Protection

Mandatory limits:

- Login attempts (IP + user)
- Exam submission endpoints
- Scheduled exam start endpoints
- Public endpoints

WebSocket throttling required.

Limits must:

- Be enforced server-side
- Be configurable
- Produce structured logs on violation

---

## Attempt & Exam Security

Exam runtime must enforce:

- Server-side time authority
- Submission idempotency
- Concurrency guard (single active attempt per user per exam)
- Reconnection window enforcement (scheduled exams)

Client-side time is never authoritative.

Auto-submit must be server-driven.

---

## Sensitive Data Handling

Encrypted at rest:

- Password hashes
- Payment credentials
- Third-party API secrets

Never log:

- JWT tokens
- Passwords
- Payment details
- Full request bodies containing answers

Logs must be structured and sanitized.

---

## Secrets Management

Development:

- .env files (never committed)
- .env.example required

Production:

- Environment variables
- No hardcoded credentials
- No secrets inside repository

Future upgrade path:

- Docker secrets or vault integration

---

## Backup & Recovery Security

- Each tenant has separate backup
- Backups encrypted at rest
- Archive snapshots version-tagged
- Restore must validate schema compatibility

Permanent deletion requires manual confirmation and audit log entry.

---

## Logging & Trace Security

Every request must include:

- request_id
- workspace_slug (if applicable)
- user_id (if authenticated)

Security events that must be logged:

- Failed login attempts
- Permission violations
- License state violations
- Schema mismatch
- Rate limit breaches

Logs must never contain sensitive payloads.

---

## Non-Negotiable Rules

Not allowed:

- Cross-tenant data access
- Global student tables
- Token without workspace claim
- Long-lived permanent JWT
- Role checks in frontend only
- DB access without resolver context
- Secrets committed to repository

Security is not optional.

If isolation or enforcement fails, Zidney fails.
