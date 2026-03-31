Zidney Strict Plan Template (Architecture Governance Enforced)

Before generating any plan, validate against Zidney Architecture Governance:

- `AGENTS.md` — platform rules and import boundaries
- `docs/architecture/ADR/` — binding architectural decisions (ADR-0001 through ADR-0009)
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` — architecture contract

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

- No cross-tenant data access (ADR-0001)
- No middleware bypass
- No direct DB instantiation (tenant resolver only)
- No grading logic outside Worker
- No weakening of snapshot integrity (ADR-0002)
- No weakening of version enforcement (ADR-0007, ADR-0008)
- No client-authoritative time (ADR-0006)
- No layer boundary violation

If any exception → ADR required before plan proceeds.

---

## Trust Chain Verification

Confirm the plan respects the Zidney trust chain order:

**Isolation → License → Authentication → Attempt → Runtime → Frontoffice**

- [ ] Isolation: Database-per-tenant preserved, no cross-tenant access
- [ ] License: License validation middleware enforced before workspace access
- [ ] Authentication: JWT scope validated, RBAC enforced server-side
- [ ] Attempt: Snapshot frozen at start, worker-only grading
- [ ] Runtime: Server-authoritative time only
- [ ] Frontoffice: No business logic, API consumption only

---

## Import Boundary Compliance

Plan must not violate import boundaries:

| Import Direction            | Allowed      |
| --------------------------- | ------------ |
| `apps/*` → `packages/*`     | ✅ Allowed   |
| `packages/*` → `packages/*` | ✅ Allowed   |
| `apps/*` → other `apps/*`   | ❌ Forbidden |
| `packages/*` → `apps/*`     | ❌ Forbidden |
| UI → DB schemas             | ❌ Forbidden |

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

## Error Contract

All API responses must follow:

```json
{
  "success": boolean,
  "data": object | null,
  "error": { "code": string, "message": string } | null
}
```

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

## Architecture Guard Validation

Plan must pass governance validation before proceeding:

```bash
bun run ai:guard && bun run arch:audit && bun run lint && bun run typecheck && bun run test
```

Individual checks:

```bash
bun scripts/infra-audit.ts    # Infrastructure audit
bun scripts/ai-guard.ts        # AI governance guard
```

---

## Non-Goals

Explicitly list what is not included.

Prevents scope creep.

---

## Final Compliance Statement

The plan must end with:

"Implementation plan compliant with Zidney Architecture Governance (AGENTS.md + ADRs) — No violations detected."

If violation exists: Plan must stop and describe conflict.
