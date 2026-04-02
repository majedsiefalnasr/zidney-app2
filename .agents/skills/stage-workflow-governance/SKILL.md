---
name: stage-workflow-governance
description: Use when a workflow mutates Stage Status blocks, evaluates locked or deprecated stages, escalates architecture decisions into ADRs, scores stage risk, or processes scope amendments after committed steps.
---

# Stage Workflow Governance

This skill governs stage-state transitions and change-control rules in Zidney SpecKit workflows.

Use it when the orchestrator is about to change `## Stage Status`, open or block a stage, require an ADR, or react to post-commit scope changes.

## Required Behavior

1. Apply the Stage Lifecycle Guard before mutating any `## Stage Status` block.
2. Treat `PRODUCTION READY`, `PRODUCTION HARDENED`, and `DEPRECATED` stages as locked according to Zidney lifecycle rules.
3. Allow `BACKEND CLOSED` stages to receive closure-only metadata updates, not structural scope changes.
4. Escalate architectural decisions into ADR creation before planning or implementation continues.
5. Compute and maintain stage risk using the agreed rubric when scope and implementation risk factors change.
6. Treat post-commit requirement changes as scope amendments that invalidate downstream artifacts and force regeneration from the earliest affected step.

## ADR Escalation Triggers

- New package or module outside current architecture inventory
- Layer-boundary changes or dependency rule exceptions
- Long-lived schema or tenancy strategy decisions
- New external integrations with architecture impact
- Changes to architecture contracts or maps

## Stage Lifecycle Guard

- `PRODUCTION READY` and `PRODUCTION HARDENED`: no modifications permitted
- `BACKEND CLOSED`: closure metadata only
- `DEPRECATED`: read-only after explicit deprecation is recorded
- Missing `## Stage Status`: block workflow until the stage file is fixed

## Scope Amendment Rules

- Record the amendment in `.workflow-state.json`
- Update the source spec before re-running invalidated steps
- Re-run the earliest invalidated step forward
- Do not carry stale plan, task, or analysis artifacts across the amendment boundary

## Non-Goals

- This skill does not replace task execution or implementation sequencing.
- This skill does not approve architectural changes without an ADR.
