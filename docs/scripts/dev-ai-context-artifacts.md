# dev:ai:context-artifacts

## Command

```sh
bun run dev:ai:context-artifacts
```

## Purpose

Analyze AI context artifacts for size, compression, and redundancy to identify Phase 3 optimization opportunities.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/analyze-ai-context-artifacts.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:ai:context-artifacts`
- Implementation: scripts/dev/analyze-ai-context-artifacts.ts
- Metadata-backed script file: `scripts/dev/analyze-ai-context-artifacts.ts`

## CI Behavior

No explicit --ci handling detected in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: `ai:context:generate`, `ai:context:refresh`
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
