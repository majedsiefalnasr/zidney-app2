# STAGE LIFECYCLE POLICY

This document defines the lifecycle and governance rules for all stages under /specs.

This policy is mandatory.

---

## Purpose

Prevent architectural drift.
Prevent silent rewrites.
Prevent uncontrolled scope mutation.
Enforce constitutional stability.

---

## Stage Status Vocabulary

Each stage MUST declare one of the following:
• DRAFT
• IN PROGRESS
• BACKEND CLOSED
• PRODUCTION READY
• PRODUCTION HARDENED
• DEPRECATED

No other status allowed.

---

## Status Definitions

DRAFT

Specification incomplete.
May change freely.
No implementation allowed.

---

## IN PROGRESS

Implementation ongoing.
Breaking changes allowed within stage scope.
Must not affect CLOSED stages.

---

## BACKEND CLOSED

Backend implementation complete.
No breaking structural changes allowed.
UI scope may still evolve.

---

## PRODUCTION READY

All tasks completed.
Tests passing.
No known constitutional violations.
Safe for deployment.

---

## PRODUCTION HARDENED

Production-tested.
Monitoring in place.
Failure modes validated.
Security hardening complete.

This status is reserved for isolation, licensing, and runtime-critical stages.

---

## DEPRECATED

Stage replaced or superseded.
Must reference replacement stage.

---

## Closure Requirements

Before marking stage CLOSED or higher: 1. All tasks complete 2. Drift audit executed 3. Constitutional compliance verified 4. No TODOs left in critical path 5. Status block appended to stage file 6. Git commit message references stage closure

---

## Change Control After Closure

If stage status is:

BACKEND CLOSED or higher:
• Structural DB changes require new migration stage
• Middleware logic changes require new stage
• Breaking changes require ADR update
• Silent edits forbidden

---

## Freeze Rule

Once stage is PRODUCTION READY or PRODUCTION HARDENED:
• File content is frozen
• Only documentation clarifications allowed
• No scope expansion
• No feature creep

Any enhancement must:
• Create new stage
• Reference previous stage
• Preserve compatibility

---

## Constitutional Enforcement

All stages must respect:
• Database-per-tenant isolation
• Snapshot immutability
• Server-authoritative time
• Semantic versioning
• Structured logging
• No cross-layer authority violations

Violation of constitutional principles requires:
• Immediate halt
• Drift analysis
• ADR update before continuation

---

## Relationship With SpecKit

SpecKit must:
• Never overwrite CLOSED stages
• Never regenerate completed stages
• Only operate on DRAFT or IN PROGRESS stages
• Respect status blocks

---

## Governance Level

Zidney is an institutional SaaS platform.
Spec maturity must match enterprise-grade expectations.

Architecture stability > speed.
