# ADR-0006: Runtime Authoritative Time

## Status

Accepted

---

## Context

Zidney supports:

- Timed exams
- Rush mode (per-question timer)
- Scheduled exams
- Grace period reconnection
- Auto submission

Exam timing integrity is critical for:

- Institutional trust
- Fairness
- Auditability
- Concurrency control

---

## Decision

All runtime time validation is server-authoritative.

Client time is visual only.

The backend:

- Validates scheduled start window
- Validates exam end time
- Enforces auto-submit
- Enforces grace reconnection period
- Calculates duration

---

## Rules

1. Client cannot extend time.
2. Client cannot submit after deadline.
3. Server stores:
   - started_at
   - expires_at
   - submitted_at
4. Grace period logic handled server-side.
5. All grading uses server timestamps.

---

## Consequences

- Prevents time manipulation
- Prevents cheating via clock tampering
- Ensures consistent grading
- Simplifies audit trail

---

## Related ADR

- ADR-0002 Snapshot Attempt Model
- ADR-0004 Single Runtime Engine
