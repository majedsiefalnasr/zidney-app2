# Quickstart - Unified Architecture Guard

This quickstart is scoped to infrastructure governance workflows only.

## Prerequisites

- Bun installed.
- Repository dependencies installed.
- Current branch checked out for this stage.

## 1) Strict Validation (CI-equivalent)

Run full strict architecture and governance checks:

```bash
bun run arch:guard:ci
```

Expected behavior:

- Runs full rule set.
- Fails on violations.
- Emits deterministic violation output.

## 2) Changed-Files Validation (Pre-push fast path)

Run incremental validation for changed files:

```bash
bun run arch:guard:changed
```

Expected behavior:

- Evaluates changed scope first.
- Falls back to full scan when incremental prerequisites are not safe (for example map/graph issues).
- Preserves strict rule consistency.

## 3) JSON Reporting Output

Request machine-readable output:

```bash
bun run arch:guard -- --output json
```

Expected behavior:

- Includes validation mode, fallback reason, scope counts, verdict, and violation records.

## 4) Architecture Context Regeneration

Refresh architecture intelligence artifacts:

```bash
bun scripts/infra-audit.ts
bun scripts/generate-ai-context.ts --validate
bun scripts/validate-architecture-brain.ts
```

Expected behavior:

- Required context files regenerated under `docs/ai/context/`.
- Architecture brain passes validation before CI/commit usage.

## 5) Minimum Governance Pipeline for Stage Validation

```bash
bun run arch:guard:ci
bun scripts/infra-audit.ts
bun run lint
bun run typecheck
bun run test:unit:boundaries
```

## 6) Required Artifact Presence Check

```bash
test -f docs/ai/context/ai-architecture-summary.md
test -f docs/ai/context/ai-module-map.json
test -f docs/ai/context/ai-layer-model.json
test -f docs/ai/context/ai-dependency-graph.json
test -f docs/ai/context/ai-runtime-map.json
test -f docs/ai/context/ai-runtime-dependents.json
test -f docs/ai/context/ai-architecture-brain.json
test -f docs/ai/context/ai-architecture-diff.json
test -f docs/ai/context/ai-context-mini.json
```

## Scope Guardrails

- Do not change tenant DB model or resolver behavior.
- Do not change license middleware semantics.
- Do not change attempt engine/runtime business behavior.
- Keep all changes within infrastructure governance orchestration and reporting.
