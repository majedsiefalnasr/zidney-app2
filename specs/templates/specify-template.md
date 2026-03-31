Zidney Strict Spec Template (Architecture Governance Enforced)

Before generating any output, the AI must validate against Zidney Architecture Governance:

- `AGENTS.md` — platform rules and import boundaries
- `docs/architecture/ADR/` — binding architectural decisions (ADR-0001 through ADR-0009)
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` — architecture contract

If any violation is detected, STOP and explain conflict.

---

## Feature Overview

Describe clearly:

- What is being built
- Which Phase it belongs to
- Which Stage it maps to
- Whether it affects:
- Isolation
- License enforcement
- Attempt engine
- Worker
- Runtime
- Frontoffice

Must reference existing Stage file.

---

## Architecture Governance Declaration

Explicitly confirm:

- No cross-tenant access (ADR-0001)
- No middleware bypass
- No grading outside worker
- No direct DB instantiation (tenant resolver only)
- No weakening of snapshot integrity (ADR-0002)
- No weakening of transaction boundaries
- No weakening of version enforcement (ADR-0007, ADR-0008)
- No client-authoritative time (ADR-0006)

If any exception is required → ADR mandatory.

---

## Trust Chain Verification

Confirm the feature respects the Zidney trust chain order:

**Isolation → License → Authentication → Attempt → Runtime → Frontoffice**

- [ ] Tenant isolation is the first gate (slug-based, database-per-tenant)
- [ ] License validation occurs before any workspace operation
- [ ] Authentication is checked after tenant resolution
- [ ] Attempt engine (if applicable) operates on frozen snapshots
- [ ] Runtime enforces server-authoritative time
- [ ] Frontoffice receives only presentation data — no business logic

Breaking this chain is a platform failure.

---

## Import Boundary Compliance

Confirm the feature respects import boundaries:

- `apps/*` → `packages/*` ✅
- `packages/*` → `packages/*` ✅
- `apps/*` → other `apps/*` ❌ FORBIDDEN
- `packages/*` → `apps/*` ❌ FORBIDDEN
- UI → DB schemas ❌ FORBIDDEN

---

## Isolation Impact Analysis

State clearly:

- Which database is accessed? (master or tenant)
- How tenant is resolved
- Where connection pool is obtained
- Whether resolver middleware is used
- Any new tables introduced

Must confirm: no shared tenant data.

---

## License & Version Enforcement

Must define:

- Is license middleware required?
- What license states are allowed?
- Is limit enforcement required?
- Is schema_version checked?
- Is product_version checked?

If omitted → reject plan.

---

## Data Model Changes

If applicable:

- List new tables
- List modified tables
- Migration impact
- Version bump required? (Yes/No)
- Backward compatibility strategy

Must align with project versioning strategy (see STAGE_02C_MIGRATION_AND_VERSIONING_MODEL or
equivalent).

---

## Transaction Boundaries

Define clearly (per this stage's requirements):

- Which operations require transactions
- Atomic operation boundaries
- Which operations must be idempotent
- Failure handling and rollback paths
- Retry policy (if async/worker involved)

Must reference Operational Integrity principle.

---

## Authoritative Time Usage

If time involved:

- Which server clock source used
- Where deadlines validated
- How drift is prevented
- Reconnection behavior (if runtime)

Client time must not be trusted.

---

## Idempotency Strategy

If endpoint mutates state:

- Idempotency key used? (Yes/No)
- Unique constraint used? (Yes/No)
- Replay behavior defined? (Yes/No)
- Double submission protection? (Yes/No)

Mandatory for all operations that must be safe to retry:

- Financial transactions
- State transitions
- Resource allocation
- External integrations
- (Per clarifications from this stage)

---

## Observability Requirements

Must define:

- Structured log fields
- request_id included
- workspace_slug included
- attempt_id included (if applicable)
- Error contract compliance
- Metrics emitted (if critical path)

---

## Rate Limiting & Abuse Protection

If applicable to this stage, must define:

- Endpoint classification (public/auth/admin)
- Rate limit policy (per endpoint)
- Replay attack mitigation
- Worker queue protection (if messaging involved)
- (Per clarifications from this stage)

---

## Layer Separation Confirmation

Confirm:

- Frontend contains no business logic
- API contains no grading logic
- Worker contains no HTTP logic
- MMC does not access tenant DB
- No direct DB creation outside provisioning

If violated → reject plan.

---

## Failure Modes & Recovery

Define (as applicable to this stage):

- DB failure handling
- Version mismatch handling (if version checks active)
- License enforcement handling (if license middleware required)
- Worker failure recovery (if async operations)
- Timeout behavior
- DLQ/error queue handling (if worker involved)
- Partial transaction failure recovery

---

## Test Strategy

Must include:

- Unit tests required
- Integration tests required
- Transaction rollback test
- Idempotency test
- Version compatibility test
- Isolation test

If runtime feature:

- Concurrency test required

---

## Error Contract

All API responses must follow:

```json
{ "success": boolean, "data": object | null, "error": { "code": "ERROR_CODE", "message": "Human-readable message" } | null }
```

---

## Explicit Non-Goals

List what this feature does NOT change.

Prevents scope creep.

---

## Final Architecture Governance Statement

The AI must end with:

"Compliant with Zidney Architecture Governance (AGENTS.md + ADRs) — No violations detected."

If not compliant: AI must stop and describe violation.
