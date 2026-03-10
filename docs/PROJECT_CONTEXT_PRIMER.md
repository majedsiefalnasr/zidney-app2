# PROJECT_CONTEXT_PRIMER.md

## Purpose

This document is the architectural memory anchor for Zidney.

It compresses the core architectural, governance, and enforcement principles of the platform into a
single authoritative context reference.

All AI agents, engineers, and reviewers must treat this document as the high-level alignment source
before proposing changes.

If any major architectural decision changes, this file must be updated in the same pull request.

---

## Platform Identity

Zidney is a stability-first, database-per-tenant, white-label SaaS platform for institutions.

Primary Identity: White-label SaaS for institutions (B2B2C) with exams as the architectural core.

Core Philosophy:

- Isolation over convenience
- Stability over speed
- Determinism over magic
- Explicit governance over implicit behavior

---

## Architectural Model

### Multi-Tenancy

- Database-per-tenant (PostgreSQL)
- One connection pool per tenant
- No row-based multi-tenancy
- No shared student or attempt tables
- No cross-tenant joins

Tenant resolution is mandatory middleware.

Isolation failure = platform failure.

---

### Backend Stack

- Runtime: Bun
- Framework: Hono
- Database: PostgreSQL
- ORM: Drizzle
- Queue: Redis-based worker
- Logging: Structured JSON (Pino target)
- Versioning: Semantic Versioning (SemVer)

---

### Middleware Order (Authoritative)

1. Correlation ID middleware
2. Tenant resolver middleware
3. License enforcement middleware
4. Schema version enforcement middleware
5. Route handler

No route may bypass tenant + license validation.

---

## License Model

Relationship: Product → License → Workspace (Tenant DB)

Rules:

- One License = One Workspace
- One License = One Product
- Workspace slug immutable
- License status enforced on every request

States:

- ACTIVE
- SOFT_LOCKED
- ARCHIVED
- DELETED

SOFT_LOCK blocks access but preserves data. ARCHIVED requires snapshot. DELETED is terminal.

---

## Versioning Model

- Semantic Versioning enforced (MAJOR.MINOR.PATCH)
- Forward-only migrations
- No destructive schema rollback
- Schema version stored per tenant
- Product version compatibility enforced in middleware

If schema version incompatible: → Reject request (426 or 503 depending on context)

Migrations are:

- Transactional
- Checksum-validated (SHA256)
- Worker-executed
- Idempotent

---

## Attempt Engine Principles

Attempts are immutable records.

At attempt start:

- Snapshot of configuration stored
- Snapshot of question list stored
- Snapshot of grading config stored

No live exam config references after start.

Submission is:

- Idempotent
- Worker-finalized
- Server-authoritative time

No double grading allowed.

---

## Worker Authority Model

API:

- Enqueues tasks
- Never executes DDL
- Never performs schema mutations

Worker:

- Executes migrations
- Executes provisioning
- Executes grading
- Handles retry + DLQ

Retry policy:

- Max 3 retries
- Exponential backoff
- Checksum mismatch → NO RETRY (security incident)

---

## Idempotency Model

Hybrid pattern:

- Redis cache (fast path, 24h TTL)
- Database fallback (true source of truth)
- UNIQUE constraints enforce final protection

Duplicate submissions must not create duplicate grading.

---

## Observability Requirements

- Structured JSON logging
- correlation_id on every request
- workspace_slug on every tenant-bound log
- No DB passwords in logs
- Metrics exposed for provisioning + migrations + attempts

Console logging must be replaced by structured logger abstraction (Pino).

---

## Security Rules

- Slug extraction from host/path only
- Never trust client body for tenant selection
- Parameterized queries only
- No dynamic SQL interpolation
- No direct DB connections outside pool manager
- No cross-tenant references

---

## Governance Model

Authority Order: ADR → Specs → PROJECT_CONTEXT_PRIMER.md → AGENTS.md → Code

SpecKit Hard Mode workflow enforced.

Stage Lifecycle enforced:

- DRAFT
- IN PROGRESS
- BACKEND CLOSED
- PRODUCTION READY
- PRODUCTION HARDENED
- DEPRECATED

Closed stages must not be mutated.

Architectural drift is considered a defect.

---

## Frontend Principles

UI stack:

- Vue 3
- shadcn-vue components
- Tailwind v4

Rules:

- Use shadcn-vue components first
- Tailwind for composition only
- Theme tokens controlled per workspace
- White-label affects visual identity only
- No business logic in UI
- No permission enforcement in UI

All enforcement is server-side.

---

## Non-Negotiable Constraints

The following are never allowed:

- Row-based multi-tenancy
- Cross-tenant joins
- Direct schema changes outside migrations
- Long-lived JWTs
- Hardcoded DB credentials
- Breaking changes without ADR
- Stage mutation after closure

---

## Primer Update Rule

If any of the following change, this document must be updated in the same PR:

- Multi-tenancy model
- License enforcement model
- Attempt lifecycle
- Versioning strategy
- Worker authority model
- Governance model
- Isolation guarantees
- Middleware execution order

Failure to update this file when architecture changes is considered governance drift.

---

## Final Principle

Zidney is built for institutional trust.

Stability > Features. Isolation > Performance shortcuts. Determinism > Convenience. Governance >
Speed.

All AI-generated or human-written code must align with this foundation.
