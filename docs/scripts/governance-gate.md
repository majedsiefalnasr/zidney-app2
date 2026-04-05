# governance:gate

## Command

```sh
bun run governance:gate
```

## Purpose

Unified governance gate — composes all guards in sequence (report-all mode)

## Why It Exists

This runner is currently classified as critical. Treat as protected. It is a primary quality, build, test, or governance entrypoint. Its implementation lives in scripts/governance/gate.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run governance:gate`
- Implementation: scripts/governance/gate.ts
- Metadata-backed script file: `scripts/governance/gate.ts`

## CI Behavior

Supported explicitly in the implementation; --ci is forwarded to child runners.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Isolated worktree run failed; files touched before failure: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json, docs/architecture/ARCHITECTURE_DIAGRAMS.md, docs/architecture/graphs/architecture-graph.html, docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json, docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json, docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md, docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md, docs/reports/infra-audit-report.json. Output note: ✖ • Type Safety (validate:types) — exit code 2 error: script "governance:gate" exited with code 1
