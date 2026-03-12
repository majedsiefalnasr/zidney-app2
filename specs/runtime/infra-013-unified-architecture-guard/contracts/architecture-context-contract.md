# Contract: Architecture Context Generation

## Purpose

Defines required architecture context artifacts and validation expectations for governance and AI consumers.

## Producers

- `scripts/infra-audit.ts`
- `scripts/generate-ai-context.ts`

## Validator

- `scripts/validate-architecture-brain.ts`

## Required Artifacts

Output directory: `docs/ai/context/`

Required files:

- `ai-architecture-summary.md`
- `ai-module-map.json`
- `ai-layer-model.json`
- `ai-dependency-graph.json`
- `ai-runtime-map.json`
- `ai-runtime-dependents.json`
- `ai-architecture-brain.json`
- `ai-architecture-diff.json`
- `ai-context-mini.json`

## Contract Rules

- Generation must be reproducible from repository state.
- Artifacts are machine-readable and UTF-8 encoded.
- `ai-architecture-brain.json` must pass validator checks:
  - valid module path format (`apps/<name>` or `packages/<name>`)
  - valid edge source/target references
  - no malformed or relative module edge paths
- On validation failure, governance verdict is BLOCKED.

## Consumption Expectations

- Guard workflows can use context artifacts to improve rule resolution.
- Missing or stale artifacts in changed-files mode must trigger safe fallback strategy (regenerate or full scan).

## Scope Constraint

This contract governs metadata generation only; it does not modify runtime business behavior.
