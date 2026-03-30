# ai:context:generate

## Command

```sh
bun run ai:context:generate
```

## Purpose

Generate AI context artifacts (architecture brain, module map, dependency graph). Supports incremental (default), forced, and validate-after-generation modes.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ai-context-validation.yml. Its implementation lives in scripts/generate-ai-context.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run ai:context:generate`
- Implementation: scripts/generate-ai-context.ts
- Metadata-backed script file: `scripts/generate-ai-context.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json.
