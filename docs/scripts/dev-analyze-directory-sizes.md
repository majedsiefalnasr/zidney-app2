# dev:analyze:directory-sizes

## Command

```sh
bun run dev:analyze:directory-sizes
```

## Purpose

Measure key repository directory sizes and highlight the largest contributors to repository bloat.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/analyze-directory-sizes.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:analyze:directory-sizes`
- Implementation: scripts/dev/analyze-directory-sizes.ts
- Metadata-backed script file: `scripts/dev/analyze-directory-sizes.ts`

## CI Behavior

No explicit --ci handling detected in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
