Zidney Strict Implementation Gate

This template prevents unsafe execution.

Before generating code:

Confirm:

- Analyze step passed
- No constitutional violations
- No unresolved ambiguities

If not → STOP.

---

## Execution Scope Confirmation

State clearly:

- Phase:
- Stage:
- Files allowed to change:
- Files forbidden to change:

No file outside stage scope may be modified.

---

## Implementation Constraints

Enforce:

- Use tenant resolver only
- No direct DB instantiation
- All writes transactional
- Idempotency implemented where required
- Version enforcement active
- Worker-only grading
- Server-authoritative time
- Structured logging

---

## Forbidden Actions

Implementation must refuse:

- Architecture redesign
- Cross-tenant data access
- Shared runtime state
- Global mutable singletons
- Business logic in frontend
- License bypass
- Snapshot mutation
- Removing middleware

If request implies any of above → STOP.

---

## Runtime Safety Guarantees

Implementation must guarantee:

- Isolation preserved
- License enforcement active
- Snapshot integrity preserved
- Concurrency guarded
- Idempotency enforced
- Error format standardized
- Logging structured
- No stack traces exposed

---

## Code Generation Rules

Code must:

- Follow AGENTS.md contracts
- Follow lint rules
- Use validation package
- Use shared types package
- Respect layering boundaries
- Use shadcn-vue + Tailwind v4 in UI
- Never duplicate logic across layers

---

## Post-Implementation Checklist

After code generation:

Confirm (per this stage's tasks.md):

- All routes wrapped in required middleware
- All writes transactional (per plan.md)
- Idempotency tests included (per plan.md)
- Version checks active (if applicable to stage)
- Structured logs present
- No console.log
- No TODO left

---

## Final Implementation Declaration

Must end with:

“Implementation compliant with Zidney Constitution v1.2.0 — Safety guarantees preserved.”

If unable to comply → STOP and explain.
