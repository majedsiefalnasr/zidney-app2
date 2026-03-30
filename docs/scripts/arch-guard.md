# arch:guard

## Command

```sh
bun run arch:guard
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as critical. Not safe to remove directly. Other root scripts depend on it: governance:gate:changed. Its implementation lives in scripts/architecture-guard/architecture-guard.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run arch:guard`
- Implementation: scripts/architecture-guard/architecture-guard.ts
- Metadata-backed script file: `scripts/architecture-guard/architecture-guard.ts`

## CI Behavior

No explicit CI handling detected in the implementation.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: `governance:gate:changed`

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
