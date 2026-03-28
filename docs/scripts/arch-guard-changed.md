# arch:guard:changed

## Command

```sh
bun run arch:guard:changed
```

Registered package.json runner:

```sh
bun scripts/architecture-guard/architecture-guard.ts --changed
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: governance:gate:changed. Its implementation lives in scripts/architecture-guard/architecture-guard.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/architecture-guard/architecture-guard.ts
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

No explicit CI handling detected in the implementation.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: `governance:gate:changed`

## Audit Notes

- Not audited automatically in the isolated execution pass.
