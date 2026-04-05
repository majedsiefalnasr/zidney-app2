# dev:analyze:file-sizes

## Command

```sh
bun run dev:analyze:file-sizes
```

## Purpose

Analyze repository files by size and line count to identify oversized files that need optimization.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/analyze-file-sizes.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:analyze:file-sizes`
- Implementation: scripts/dev/analyze-file-sizes.ts
- Metadata-backed script file: `scripts/dev/analyze-file-sizes.ts`

## CI Behavior

No explicit --ci handling detected in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: `ai:context:generate`, `ai:context:refresh`
- Used by other root scripts: None found

## Audit Notes

- Audit attempt failed in isolated worktree: bun run dev:analyze:file-sizes exited non-zero before tracked file changes were observed. Output note: │ Failed 278 (100%) │ error: script "dev:analyze:file-sizes" exited with code 1
