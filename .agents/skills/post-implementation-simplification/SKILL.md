---
name: post-implementation-simplification
description: Use after implementation completes to run the code-simplifier subagent for dead code removal, duplicate consolidation, and readability-only refactors without changing behavior or scope.
---

# Post-Implementation Simplification

This skill governs the cleanup pass that happens after implementation and before final validation.

Use it when implementation has completed and the workflow needs a constrained refactoring pass through `code-simplifier`.

## Required Behavior

1. Run only after the implementation subagent completes.
2. Delegate the cleanup pass to `code-simplifier`.
3. Scope the handoff to files changed during implementation.
4. Forbid feature additions, scope expansion, architecture changes, and behavior changes.
5. Treat any proposed behavior change as a blocking workflow issue.

## Required Handoff Shape

```text
/handoff to=code-simplifier

Stage: <STAGE_NAME>
Scope: <files changed during implementation>
Constraints: No feature additions, no scope expansion, no architecture changes, behavior must remain aligned to plan.md and tasks.md.
```

## Exit Criteria

- Dead code removed where safe
- Duplicates consolidated where safe
- Readability improved without changing observable behavior
- Workflow proceeds to completeness and validation checks only after the cleanup pass returns successfully
