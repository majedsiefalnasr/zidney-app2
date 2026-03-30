# dev:generate:package-docs

## Command

```sh
bun run dev:generate:package-docs
```

## Purpose

Refresh root package.md from package.json, repo invocation scans, and optional detached-worktree audit evidence.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/generate/package-docs.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:generate:package-docs`
- Implementation: scripts/generate/package-docs.ts
- Metadata-backed script file: `scripts/generate/package-docs.ts`

## CI Behavior

Explicitly rejected in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
