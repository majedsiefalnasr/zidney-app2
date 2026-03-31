Zidney Strict Clarify Template (Architecture Governance Enforced)

Before proceeding to Plan, the AI must validate against Zidney Architecture Governance:

- `AGENTS.md` — platform rules and import boundaries
- `docs/architecture/ADR/` — binding architectural decisions (ADR-0001 through ADR-0009)
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` — architecture contract

If any ambiguity introduces governance risk, STOP and explain conflict.

---

## Clarify Overview

Describe clearly:

- Which Phase this belongs to
- Which Stage this maps to
- What specification is being clarified
- Why Clarify gate is required
- Whether clarifications affect:
  - Isolation
  - License enforcement
  - Attempt engine
  - Worker
  - Runtime
  - Frontoffice

Must reference existing Stage file.

---

## Trust Chain Verification

Confirm the clarification respects the Zidney trust chain order:

**Isolation → License → Authentication → Attempt → Runtime → Frontoffice**

- [ ] Isolation: Tenant boundary preserved (database-per-tenant, no cross-tenant access)
- [ ] License: License validation middleware enforced before workspace access
- [ ] Authentication: JWT scope validated, RBAC enforced server-side
- [ ] Attempt: Snapshot integrity preserved (if applicable)
- [ ] Runtime: Server-authoritative time, worker-only grading
- [ ] Frontoffice: No business logic, API consumption only

Breaking this chain is a platform failure.

---

## Import Boundary Compliance

Confirm clarification does not violate import boundaries:

| Import Direction            | Allowed      |
| --------------------------- | ------------ |
| `apps/*` → `packages/*`     | ✅ Allowed   |
| `packages/*` → `packages/*` | ✅ Allowed   |
| `apps/*` → other `apps/*`   | ❌ Forbidden |
| `packages/*` → `apps/*`     | ❌ Forbidden |
| UI → DB schemas             | ❌ Forbidden |

---

## Architecture Governance Pre‑Check

Explicitly confirm that proposed clarification decisions:

- Do not introduce cross-tenant access (ADR-0001)
- Do not weaken middleware enforcement
- Do not bypass worker grading rules
- Do not introduce direct DB instantiation (tenant resolver only)
- Do not weaken snapshot integrity (ADR-0002)
- Do not weaken transaction guarantees
- Do not weaken version enforcement (ADR-0007, ADR-0008)
- Do not use client-authoritative time (ADR-0006)

If any clarification conflicts → ADR mandatory.

---

## Identified Ambiguities

List each ambiguity discovered during Specify review.

Each ambiguity must include:

- Context
- Architectural impact
- Options considered
- Recommended option
- Final approved decision

---

## Ambiguity 1 — {{Title}}

### Context

Describe the unclear area in the specification.

### Architectural Impact

Explain impact on:

- Isolation
- Transactions
- Idempotency
- Versioning
- License enforcement
- Concurrency
- Observability
- Security

### Options

Option A —  
Description

Option B —  
Description

Option C —  
Description

### Recommendation

State recommended option and reasoning.

### Final Decision

Approved Option: **_  
Rationale: _**

---

(Repeat ambiguity block as needed)

---

## Isolation Impact Analysis

State clearly:

- Which database is affected (master or tenant)
- Whether resolver middleware behavior changes
- Whether connection pooling changes
- Whether new tables are introduced
- Whether tenant data boundaries change

Must confirm: no shared tenant data introduced.

---

## License & Version Clarification

If relevant to this stage, clarify:

- License states affected
- Middleware order impact
- Limit enforcement impact
- schema_version equality or direction rules
- product_version compatibility rules

If clarification weakens enforcement → reject.

---

## Transaction & Concurrency Clarification

Define clearly (if affected):

- Isolation level required
- Locking strategy (SELECT FOR UPDATE / SERIALIZABLE / Hybrid)
- Lock timeout
- Retry policy
- Deadlock handling strategy
- Atomic operation boundaries
- Idempotency guarantees

Must align with Operational Integrity principle.

---

## Idempotency Clarification

If state mutation involved:

- Storage mechanism (Redis / DB / Hybrid)
- TTL duration
- Collision behavior
- Replay behavior
- Crash recovery guarantees
- Scope (per-workspace / global)

Mandatory for retry-safe operations.

---

## Error Contract Compliance

All API responses must follow the standard error contract:

```json
{
  "success": boolean,
  "data": object | null,
  "error": { "code": string, "message": string } | null
}
```

---

## Observability & Logging Clarification

Clarify:

- Error codes affected
- HTTP status mapping
- Structured log fields impacted
- request_id propagation
- workspace_slug inclusion
- Metrics or alerts affected

Must maintain error contract compliance.

---

## Security Impact Review

Confirm clarification does NOT:

- Expose tenant enumeration vectors
- Allow middleware bypass
- Trust client-supplied time
- Trust client-supplied workspace context
- Introduce injection risk
- Weaken RBAC evaluation model

If any risk introduced → Clarify gate fails.

---

## Failure Modes & Recovery Clarification

If applicable, define:

- DB failure handling
- Migration-in-progress behavior
- License expiration behavior
- Worker retry semantics
- DLQ handling
- Partial transaction rollback behavior

Must remain deterministic and safe.

---

## Test Impact

Clarify whether decisions require:

- New unit tests
- Integration tests
- Concurrency tests
- Idempotency tests
- Version compatibility tests
- Isolation tests
- Migration tests

List required test coverage impact.

---

## Explicit Non‑Goals

List what this clarification does NOT change.

Prevents scope drift.

---

## Clarify Gate Outcome

- [ ] All ambiguities resolved
- [ ] No governance violations
- [ ] API contracts stabilized
- [ ] Safe to proceed to Plan step

If ANY checkbox is false → Plan step blocked.

---

## Final Architecture Governance Statement

The AI must end with:

"Compliant with Zidney Architecture Governance (AGENTS.md + ADRs) — Clarify gate passed."

If not compliant: AI must stop and describe violation.
