# arch:type-safety-guard

## Command

```sh
bun run arch:type-safety-guard
```

## Purpose

Unified architecture guard — runs type safety checks and validates import boundaries using the architecture contract.

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: validate:types. Its implementation lives in scripts/type-safety-guard.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run arch:type-safety-guard`
- Implementation: scripts/type-safety-guard.ts
- Metadata-backed script file: `scripts/type-safety-guard.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: `validate:types`

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
