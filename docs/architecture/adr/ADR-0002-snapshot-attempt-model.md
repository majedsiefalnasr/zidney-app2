# ADR-0002 – Snapshot-Based Attempt Execution

## Status

Accepted

## Context

Exams must remain stable during attempt execution.

Live configuration referencing may cause:

- Inconsistent grading
- Retroactive behavior changes
- Legal issues in certification environments

---

## Decision

At attempt start:

System snapshots:

- Question list
- Question order
- Mode
- Flags
- Time limits
- Grading config

Attempt execution references snapshot only.

---

## Alternatives Considered

### Live config reference

Rejected because:

- Dangerous under config edits
- Causes grading drift
- Breaks historical integrity

---

## Consequences

Pros:

- Deterministic grading
- Historical stability
- Safe exam edits

Cons:

- Slightly larger attempt table
- Requires careful snapshot schema design
