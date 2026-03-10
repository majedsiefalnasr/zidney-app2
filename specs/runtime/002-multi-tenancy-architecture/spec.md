Zidney Strict Spec Template (Constitution Enforced)

Before generating any output, the AI must validate against Zidney Constitution v1.2.0.

If any violation is detected, STOP and explain conflict.

---

## Feature Overview

Describe clearly:

- What is being built: Multi-Tenancy Architecture implementing strict database-per-tenant isolation
  with tenant resolution middleware, license enforcement, schema version checking, and connection
  pooling.
- Which Phase it belongs to: 1 – Platform Foundation
- Which Stage it maps to: STAGE_02_MULTI_TENANCY_ARCHITECTURE
- Whether it affects:
  - Isolation: Yes
  - License enforcement: Yes
  - Attempt engine: No
  - Worker: No
  - Runtime: Yes (tenant resolution)
  - Frontoffice: Yes (via middleware)

Must reference existing Stage file:
specs/phases/01_PLATFORM_FOUNDATION/STAGE_02_MULTI_TENANCY_ARCHITECTURE.md

---

## Constitutional Compliance Declaration

Explicitly confirm:

- No cross-tenant access: Confirmed
- No middleware bypass: Confirmed
- No grading outside worker: Not applicable
- No direct DB instantiation: Confirmed
- No weakening of snapshot integrity: Not applicable
- No weakening of transaction boundaries: Confirmed
- No weakening of version enforcement: Confirmed

If any exception is required → ADR mandatory.

---

## Isolation Impact Analysis

State clearly:

- Which database is accessed? Master (for tenants_registry and licenses), Tenant (per workspace for
  future features)
- How tenant is resolved: Via middleware extracting workspace_slug from subdomain or path
- Where connection pool is obtained: In-memory map per tenant, shared across requests, lazy
  initialized, thread-safe in Bun/Node single-threaded model
- Whether resolver middleware is used: Yes, global for workspace-bound routes
  (/api/workspace/:slug/\*), executed before any route handler
- Any new tables introduced: tenants_registry in master DB

Must confirm: no shared tenant data.

---

## License & Version Enforcement

Must define:

- Is license middleware required? Yes
- What license states are allowed? ACTIVE (allow), SOFT_LOCKED (423), ARCHIVED (403), DELETED (404)
- Is limit enforcement required? Yes (transactional)
- Is schema_version checked? Yes
- Is product_version checked? Yes, by comparing license.product_version with
  PLATFORM_PRODUCT_VERSION environment variable using semantic versioning (same or lower major
  allowed)
- Security validations: Tenant existence, license status, schema and product version compatibility;
  authentication middleware runs after resolver

If omitted → reject plan.

---

## Data Model Changes

If applicable:

- List new tables: tenants_registry (master DB)
- List modified tables: None
- Migration impact: New migration for master DB to create tenants_registry table
- Version bump required? Yes (schema version increment)
- Backward compatibility strategy: N/A (new table)

Must align with STAGE_02C_MIGRATION_AND_VERSIONING_MODEL.

---

## Transaction Boundaries

Define clearly:

- Which operations require transactions: Provisioning operations (in future stage)
- What must be atomic: License state changes, tenant creation
- What must be idempotent: Tenant provisioning
- What happens on failure: Rollback, log error
- Retry policy (if async): N/A
- No transactions required for resolver read operations; uses Postgres default READ COMMITTED
  isolation

Must reference Operational Integrity principle.

---

## Authoritative Time Usage

If time involved:

- Which server clock source used: Server time for created_at, updated_at
- Where deadlines validated: N/A
- How drift is prevented: N/A
- Reconnection behavior (if runtime): N/A

Client time must not be trusted.

---

## Idempotency Strategy

If endpoint mutates state:

- Idempotency key used? No
- Unique constraint used? Yes (workspace_slug unique)
- Replay behavior defined? Yes (idempotent provisioning)
- Double submission protection? Yes

Mandatory for:

- Provisioning

---

## Observability Requirements

Must define:

- Structured log fields: timestamp, level, service, workspace_slug, workspace_id, user_id,
  correlation_id
- request_id included: Yes
- workspace_slug included: Yes
- attempt_id included (if applicable): N/A
- Error contract compliance: Yes, with format { "error": { "code": "ERROR_CODE", "message": "Human
  readable message", "workspace": "workspace_slug", "request_id": "uuid" } }
- Metrics emitted (if critical path): Connection pool metrics

---

## Rate Limiting & Abuse Protection

Must define:

- Endpoint classification: Workspace-bound endpoints
- Rate limit policy: Standard limits
- Replay attack mitigation: Idempotency
- Worker queue protection: N/A

---

## Layer Separation Confirmation

Confirm:

- Frontend contains no business logic: Confirmed
- API contains no grading logic: Confirmed
- Worker contains no HTTP logic: Confirmed
- MMC does not access tenant DB: Confirmed
- No direct DB creation outside provisioning: Confirmed

If violated → reject plan.

---

## Failure Modes & Recovery

Define:

- What happens on DB failure: 503
- What happens on version mismatch: 426
- What happens on license block: 423/403/404
- What happens on worker failure: N/A
- What happens on timeout: Retry or fail
- DLQ behavior (if async): N/A
- Error response format: { "error": { "code": "ERROR_CODE", "message": "Human readable message",
  "workspace": "workspace_slug", "request_id": "uuid" } }

---

## Test Strategy

Must include:

- Unit tests required: Yes
- Integration tests required: Yes
- Transaction rollback test: Yes
- Idempotency test: Yes
- Version compatibility test: Yes
- Isolation test: Yes

If runtime feature:

- Concurrency test required: No

---

## Explicit Non-Goals

List what this feature does NOT change.

- Does not implement provisioning (Stage 5)
- Does not change existing DB structure
- Does not introduce row-based tenancy
- Does not allow cross-tenant joins

Prevents scope creep.

---

## Clarifications

### Session 2026-02-15

- Q: What is the exact mechanism for checking product version compatibility in the tenant resolver
  middleware? Where is the expected product version stored (e.g., in the master DB, environment
  variable, or hardcoded), and how is it compared against the tenant's product_version? → A: Product
  version compatibility is enforced inside the tenant resolver middleware. Source of truth:
  license.product_version → stored in master_db.licenses, PLATFORM_PRODUCT_VERSION → environment
  variable in API runtime. Comparison rule (Semantic Versioning): Same MAJOR → allowed, Lower
  MINOR/PATCH → allowed, Higher MAJOR → blocked, Lower MAJOR → blocked. If incompatible: Return 426
  Upgrade Required. No hardcoded versions. Runtime environment is authoritative.
- Q: Is the tenant resolver middleware applied automatically to all workspace-bound routes in the
  API layer, or does it require explicit configuration per route? If per-route, what are the
  criteria for applying it? → A: Tenant resolver middleware is global for all workspace-bound
  routes. Routing rule: /api/mmc/_ → No tenant resolver, /api/workspace/:slug/_ → Tenant resolver
  required. Resolver must execute before any route handler. No route may access tenant DB without
  resolver context. No per-route opt-out allowed.
- Q: How does the system ensure thread-safety for the in-memory connection pool map under concurrent
  requests for the same tenant? Is the pool shared across requests, and what synchronization
  mechanisms are used? → A: Connection strategy: One connection pool per tenant, Stored in in-memory
  map, Shared across requests. Implementation model: Lazy initialization, Pool reused for all future
  requests, Created only once per tenant. Concurrency safety: Bun/Node single-threaded event loop,
  No parallel thread mutation, No additional locking required at <100 tenants scale. Pools destroyed
  only on process shutdown.
- Q: Are there any transactional requirements for reading the tenants_registry and licenses tables
  in the resolver? If so, what isolation level is required and why? → A: No transaction required for
  resolver reads. Reason: tenants_registry and licenses are read-only during request, State changes
  are rare, Postgres default isolation (READ COMMITTED) is sufficient. Resolver must not use table
  locks. License state updates apply on next request cycle.
- Q: What additional security validations (beyond license state and version checks) are performed in
  the tenant resolver middleware, such as authentication token validation or IP-based restrictions?
  → A: Resolver enforces: Tenant existence, License status validation, Schema version compatibility,
  Product version compatibility. Resolver does NOT: Validate JWT, Perform authentication, Apply
  RBAC, Apply IP restrictions. Authentication middleware runs AFTER resolver. Resolver is
  infrastructure guard only.
- Q: Confirm the error response format follows the standard {success, data, error} structure. → A:
  All resolver errors must follow standard error format: { "error": { "code": "ERROR_CODE",
  "message": "Human readable message", "workspace": "workspace_slug", "request_id": "uuid" } }.
  Status codes: 404 → Tenant not found, 403 → Archived, 423 → Soft locked, 426 → Version mismatch,
  503 → Database unavailable.

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.
