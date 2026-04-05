# dev:demo:logger

## Command

```sh
bun run dev:demo:logger
```

## Purpose

Demonstrates all available logger customization options and features

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/demo-logger-features.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:demo:logger`
- Implementation: scripts/dev/demo-logger-features.ts
- Metadata-backed script file: `scripts/dev/demo-logger-features.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: `ai:context:generate`, `ai:context:refresh`
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
