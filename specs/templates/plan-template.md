Zidney Strict Plan Template (Implementation Enforcement)

Before generating any plan, validate against Zidney Constitution v1.2.0.

If any architectural violation is detected, STOP and explain conflict.

---

## Stage Alignment

Must specify:

- Phase:
- Stage:
- Related Spec File:
- Related ADR (if any):

Plan must not introduce architecture outside defined Stage scope.

---

## Architectural Scope Confirmation

Explicitly confirm:

- No cross-tenant data access
- No middleware bypass
- No direct DB instantiation
- No grading logic outside Worker
- No weakening of snapshot integrity
- No weakening of version enforcement
- No layer boundary violation

If any exception → ADR required before plan proceeds.

---

## Implementation Layers

Break plan into:

API Layer

- Routes introduced
- Middleware used (tenant resolver, license middleware)
- Validation package usage
- Transaction boundaries

Worker Layer (if applicable)

- Queue name
- Idempotency mechanism
- Transaction usage
- Retry strategy
- DLQ handling

Frontend Layer (if applicable)

- API consumption only
- No business logic
- No direct DB assumptions

MMC / Backoffice Scope (if applicable)

- Commercial authority only
- No runtime authority

---

## Database Impact

For each affected database:

Master DB

- Tables touched
- Migration required? (Yes/No)
- Version bump?

Tenant DB

- Tables touched
- Migration required? (Yes/No)
- schema_version change?
- product_version compatibility impact?

Must reference STAGE_02C_MIGRATION_AND_VERSIONING_MODEL.

---

## Transaction Design

For every mutating operation in this stage:

- Transaction required? (Yes/No)
- Atomic operations defined?
- Rollback behavior defined?
- Isolation level (SERIALIZABLE/REPEATABLE READ/READ COMMITTED)?
- Concurrency protection mechanism (FOR UPDATE/unique constraint/external lock)?

Must ensure no race conditions per clarifications from this stage.

---

## Idempotency Plan

If endpoint mutates state:

- Idempotency key header used?
- Unique constraint used?
- Replay-safe?
- Duplicate submission safe?
- Worker deduplication strategy?

Mandatory for all operations where:

- Attempt submission
- License transitions
- Provisioning
- Payments
- Grading

---

## Version Enforcement Strategy

Must define:

- Where schema_version validated
- Where product_version validated
- What happens on mismatch (426)
- Backward compatibility strategy

No silent assumptions allowed.

---

## Authoritative Time Handling

If feature involves time:

- Server clock used?
- Expiration validation?
- Soft lock enforcement?
- Deadline enforcement?
- Reconnection grace logic?

Client time must never be used for authority.

---

## Observability & Logging

Plan must define:

- Structured log format
- request_id propagation
- workspace_slug propagation
- attempt_id propagation (if runtime)
- Error contract adherence
- Metrics emitted (if critical performance path)

No console logs allowed in production code.

---

## Rate Limiting

If applicable to this stage, plan must specify:

- Endpoint classification
- Rate limit thresholds
- Abuse mitigation
- Worker queue protection

---

## Failure Modes

Explicitly define (as applicable to this stage):

- DB unavailable
- Version mismatch
- License blocked
- Worker failure
- Duplicate request
- Timeout
- Queue backlog
- Partial transaction failure

Must define recovery path for each mode.

---

## Security Review

Confirm:

- RBAC enforcement server-side
- No role checks in frontend
- No secrets exposed
- JWT workspace scope enforced
- No sensitive data in logs

---

## Test Strategy

Plan must include:

- Unit tests
- Integration tests
- Isolation tests
- Transaction rollback test
- Idempotency test
- Version mismatch test
- Concurrency test (if runtime feature)

No implementation without defined tests.

---

## Rollback Strategy

Define:

- How feature can be safely rolled back
- Migration rollback plan
- Feature flag (if needed)
- Data integrity preservation

---

## Non-Goals

Explicitly list what is not included.

Prevents scope creep.

---

## Final Compliance Statement

The plan must end with:

“Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.”

If violation exists: Plan must stop and describe conflict.
