# arch:context:impact

## Command

```sh
bun run arch:context:impact
```

Registered package.json runner:

```sh
bun scripts/context/impact.ts
```

## Purpose

Synthesizes risk indicators from docs/ai/context/gitnexus-context.json, filtered by the staged changed files recorded in context-changed.json. A risk indicator is included when its `affectedBy` set intersects the staged changed files. Writes the result to docs/ai/context/context-impact.json. If context-changed.json does not exist, falls back to the `changedFiles` array embedded in the main context artifact. Output mode: (default) one `indicator.module` per line, sorted alphabetically --json full riskIndicators array as JSON on stdout

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/context/impact.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/context/impact.ts
- Metadata-backed script file: `scripts/context/impact.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
