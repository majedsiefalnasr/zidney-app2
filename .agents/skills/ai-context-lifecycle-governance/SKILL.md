---
name: ai-context-lifecycle-governance
description: Use when a workflow must regenerate AI context artifacts, enforce freshness gates, apply deterministic source-of-truth ordering, or scope AI context to the current SpecKit stage.
---

# AI Context Lifecycle Governance

This skill governs AI context regeneration, validation, and deterministic context loading in Zidney workflows.

Use it when a workflow step depends on architecture intelligence artifacts under `docs/ai/context/` or when implementation must be blocked on stale AI context.

## Required Behavior

1. Regenerate AI context with `bun run ai:context:refresh-all` at workflow bootstrap, pre-implementation, post-implementation, and pre-closure.
2. Verify the required artifacts exist and validate with `bun run ai:context:validate` and `bun run arch:gitnexus:validate` after each refresh.
3. Block the workflow on missing, stale, or invalid context artifacts.
4. Enforce deterministic source-of-truth ordering: AI context artifacts, architecture map, architecture contract, ADRs, GitNexus context, then repository code.
5. Scope injected context to the current stage and step instead of loading the full workflow indiscriminately.

## Lifecycle Points

| Point | When | Why |
| --- | --- | --- |
| Workflow bootstrap | Before the first SpecKit step | Start from fresh architecture context |
| Pre-implementation | Before Step 6 | Prevent stale impact analysis during code generation |
| Post-implementation | After implementation commit | Refresh context after code changes |
| Pre-closure | Before closure reports | Keep final reports aligned to the latest state |

## Validation Contract

- Required artifacts must exist under `docs/ai/context/`
- Freshness validation must pass
- GitNexus context validation must pass
- Workflows must stop instead of continuing with stale or partial context

## Non-Goals

- This skill does not choose workflow order.
- This skill does not replace architecture governance or drift analysis.
- This skill does not authorize implementation on its own; it only governs context readiness.
