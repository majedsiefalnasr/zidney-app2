# arch:add-module

## Command

```sh
bun run arch:add-module
```

Registered package.json runner:

```sh
bun scripts/architecture/add-module.ts
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/architecture/add-module.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/architecture/add-module.ts
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Explicitly rejected in the implementation; this is a local mutation helper and must not run with --ci.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
