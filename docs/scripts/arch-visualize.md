# arch:visualize

## Command

```sh
bun run arch:visualize
```

Registered package.json runner:

```sh
bun scripts/architecture/visualize.ts
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/architecture/visualize.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/architecture/visualize.ts
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: docs/architecture/visualization/README.md.
