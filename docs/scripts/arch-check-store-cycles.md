# arch:check:store-cycles

## Command

```sh
bun run arch:check:store-cycles
```

Registered package.json runner:

```sh
bun scripts/check-store-cycles.ts
```

## Purpose

Runs madge on each app's src/core/state/ to assert zero circular dependencies. Exits with non-zero code on any detected cycle.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/check-store-cycles.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/check-store-cycles.ts
- Metadata-backed script file: `scripts/check-store-cycles.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
