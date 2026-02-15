<!--
Sync Impact Report
Version change: 1.1.0 → 1.2.0
Modified principles: Centralized middleware enforcement, Schema enforcement rigor, Version compatibility enforcement, Concurrency guarantees
Added sections: Middleware Authority, Concurrency Guarantees
Removed sections: None
Templates requiring updates: None
Follow-up TODOs: None
-->

# Zidney Constitution

## Core Principles

### Database-Per-Tenant Isolation (Hard Rule)

• Each workspace has its own physical database.
• No row-based multi-tenancy.
• No shared student tables.
• No cross-tenant joins.
• No global fallback DB.
• Tenant identity resolved only via middleware.
• One connection pool per tenant.
• All DB access must originate from resolved request context.

If isolation breaks, platform integrity fails.

AI must refuse any implementation that weakens isolation.

---

### Middleware Authority (Centralized Enforcement)

• License validation must execute in centralized middleware.
• Tenant resolution must execute before any DB access.
• No route handler may access tenant DB before license validation.
• Workspace schema compatibility must be validated at request boundary.
• Version compatibility must be validated at request boundary.

Business handlers must assume context is already validated.

AI must refuse bypassing middleware layers.

---

### Authoritative License Enforcement

• License status governs workspace execution.
• ACTIVE / SOFT_LOCKED / ARCHIVED / DELETED enforced at runtime.
• Limits enforced transactionally.
• No cached counters for limit checks.
• Soft-lock expiration must be enforced on request boundary.
• Version compatibility enforced before execution.

AI must not bypass license middleware.

---

### Snapshot-Based Attempt Integrity

When an attempt starts:
• Question list frozen
• Order frozen
• Mode frozen
• Config flags frozen
• Grading configuration frozen
• Time rules frozen
• Schema version frozen
• Product version frozen

Worker must grade from snapshot only.

No live exam configuration may influence grading.

AI must refuse grading logic outside Worker.

---

### Versioned Evolution

• Schema version enforced per tenant.
• Product version compatibility enforced.
• Runtime must reject incompatible tenants (426 Upgrade Required).
• No silent auto-migrations.
• No execution under mismatched schema.
• Upgrade must be explicit.

Architecture changes require ADR before spec modification.

---

### Runtime Authoritative Time

All timed operations must rely on server time.

• Scheduled exams
• Chrono mode
• Soft lock expiration
• Submission deadlines
• Reconnection windows

Client time is never trusted.

---

### Deterministic Worker Execution

Worker must:
• Be idempotent
• Use strict transactions
• Prevent double grading
• Use dead-letter queue
• Validate schema version before execution
• Validate attempt state before grading
• Never mutate outside transactional boundary

No grading logic inside API.

---

### Concurrency Guarantees

• Attempt submission must be atomic.
• Only one final submission allowed per attempt.
• Double submission must be rejected.
• Limit enforcement must be transactional.
• Worker must enforce strict state transitions.
• No race conditions allowed in license or attempt logic.

---

### Strict Separation of Layers

• Frontend contains no business rules.
• API enforces all authority.
• Worker handles heavy execution only.
• MMC controls commercial authority only.
• Backoffice manages content and structure only.
• Frontoffice consumes runtime APIs only.
• Domain logic must not depend on framework layer.
• No service instantiates DB directly outside resolver.

---

### Security Baseline

Mandatory:
• JWT with workspace scope
• RBAC server-side only
• Structured logging
• Correlation ID required
• Rate limiting
• Input validation via shared validation package
• No console.log in production code
• No hardcoded secrets
• Environment-scoped configuration only
• No stack traces leaked to clients

---

### Operational Integrity

• All state mutations must execute inside database transactions.
• Critical write endpoints must be idempotent.
• Attempt submission must be idempotent.
• License transitions must be atomic.
• Tenant provisioning must be idempotent.
• Every log entry must include request_id.
• Workspace-bound logs must include workspace_slug.
• Attempt-bound logs must include attempt_id.
• Unified API error format required.

---

### AI Behavioral Contract

AI must:
• Refuse cross-tenant access
• Refuse bypassing middleware layers
• Refuse weakening snapshot integrity
• Refuse grading outside worker
• Refuse direct DB instantiation
• Refuse skipping version checks
• Refuse weakening transaction boundaries
• Refuse non-idempotent critical endpoints
• Refuse weakening logging or correlation requirements
• Refuse architectural drift without ADR

If a request violates constitution, AI must stop and ask for clarification.

---

### Change Governance

Architecture evolution requires:

1. ADR creation
2. Spec update
3. Constitution consistency check

No direct silent architectural changes allowed.

---

## Delivery Model

Zidney follows strict phase-driven implementation:

• Phase 1 – Platform Foundation
• Phase 2 – MMC
• Phase 3 – Backoffice Core
• Phase 4 – Runtime Engine
• Phase 5 – Frontoffice Runtime

Each phase must be stable before proceeding.

No skipping layers.

---

## Enforcement Level

This constitution is binding.

SpecKit must:
• Validate compliance before planning
• Block implementation if violating
• Surface conflicts early

---

**Version**: 1.2.0
**Ratified**: 2026-02-15
**Last Amended**: 2026-02-15
