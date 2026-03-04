# ADR-0004 – Single Unified Attempt Engine

## Status

Accepted

## Context

Zidney supports:

- MCQ
- Traditional exams
- Scheduled exams
- Exercises
- Assessments

Multiple attempt tables would create:

- Duplication
- Complexity
- Inconsistent analytics

---

## Decision

All exam types use:

Single Attempt table
With type flags and snapshot configs.

---

## Consequences

Pros:

- Unified analytics
- Simplified concurrency logic
- Consistent grading pipeline

Cons:

- More complex attempt schema
- Requires careful type handling
