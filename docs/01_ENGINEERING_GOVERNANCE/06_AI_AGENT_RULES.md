# AI Agent Operational Rules

Purpose

This document defines mandatory behavioral constraints for any AI system generating code inside Zidney.

These rules are not advisory.
They are architectural enforcement contracts.

---

Scope

These rules apply to:

- Copilot
- Claude-based agents
- GLM-based agents
- Any automated refactoring tool
- Any code-generation workflow

If a generated change violates this document, the change must be rejected.

---

Core Principles

AI must operate stage-by-stage.
AI must never assume missing architecture.
AI must never invent structure outside approved specs.
AI must not perform speculative refactors.

All generated code must align strictly with:

- specs/
- docs/
- ADR decisions
- AGENTS.md contracts

If ambiguity exists, AI must stop and request clarification.

---

Mandatory Workflow Before Code Generation

For every task:

1. Identify the Phase
2. Identify the Stage
3. Read the exact stage specification file
4. Confirm dependencies are implemented
5. Generate code only for that stage
6. Do not modify unrelated files

AI must never generate code for future stages.

---

Architectural Enforcement

AI must respect strict layering:

- apps may import only from packages
- packages must never import from apps
- No cross-app imports
- UI layer must not access database types directly
- Services must not instantiate DB connections manually
- Tenant DB must only be accessed through resolver context

Violation equals architectural failure.

---

Database Rules

AI must:

- Use Drizzle migrations only
- Never alter schema without a migration file
- Never modify past migrations
- Never hardcode database names
- Never assume default tenant

Schema version enforcement must remain intact.

Attempt tables are immutable after submission.

---

Security Rules

AI must:

- Enforce RBAC checks in API handlers
- Validate license status in middleware
- Validate subscription status where required
- Preserve tenant isolation guarantees
- Use structured logging

AI must not:

- Bypass permission checks
- Expose internal provisioning endpoints
- Leak tenant data across boundaries
- Disable rate limiting

---

Runtime Integrity Rules

AI must:

- Snapshot exam configuration at attempt start
- Use server time as authority
- Implement idempotent submission endpoints
- Preserve concurrency guards
- Preserve reconnection logic

AI must not:

- Modify attempt after submission
- Trust client time
- Accept duplicate submission without idempotency key

---

Refactoring Restrictions

AI must not:

- Refactor across phases
- Rename domain entities without spec update
- Collapse modules for convenience
- Introduce new global state

Structural refactors require explicit stage creation.

---

Testing Requirements

AI-generated feature code must include:

- Unit tests for domain logic
- Integration tests for API endpoints
- Validation tests for schema constraints

No feature is complete without tests.

---

Definition of Stop Condition

AI must stop generation when:

- It reaches scope boundary
- It encounters missing dependency
- It detects architectural conflict
- The stage specification is ambiguous

AI must not "fill gaps" with assumptions.

---

Enforcement Priority

If a user instruction conflicts with:

1. Isolation model
2. License lifecycle rules
3. Attempt immutability
4. Snapshot architecture

The AI must reject the instruction and explain why.

Architecture has higher priority than convenience.
