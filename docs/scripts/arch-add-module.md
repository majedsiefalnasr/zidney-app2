# arch:add-module

## Command

```sh
bun run arch:add-module
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/architecture/add-module.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run arch:add-module`
- Implementation: scripts/architecture/add-module.ts
- Metadata-backed script file: `scripts/architecture/add-module.ts`

## CI Behavior

Explicitly rejected in the implementation; this is a local mutation helper and must not run with --ci.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Audit attempt failed in isolated worktree: bun run arch:add-module -- --ci exited non-zero before tracked file changes were observed. Output note: error: script "arch:add-module" exited with code 1
