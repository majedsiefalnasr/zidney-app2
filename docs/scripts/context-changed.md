# arch:context:changed

## Command

```sh
bun run arch:context:changed
```

Registered package.json runner:

```sh
bun scripts/context/changed.ts
```

## Purpose

Resolves staged changed files via `git diff --cached` and writes the result to docs/ai/context/context-changed.json with a 5-minute freshness cache. Subsequent reads within the cache window skip the git invocation. A clean staging area (no changed files) is a valid state — the artifact is written with an empty changedFiles array rather than exiting non-zero.

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: governance:gate:changed. Its implementation lives in scripts/context/changed.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/context/changed.ts
- Metadata-backed script file: `scripts/context/changed.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: `governance:gate:changed`

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
