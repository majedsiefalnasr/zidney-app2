# arch:generate

## Command

```sh
bun run arch:generate
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/architecture/generate-architecture-map.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run arch:generate`
- Implementation: scripts/architecture/generate-architecture-map.ts
- Metadata-backed script file: `scripts/architecture/generate-architecture-map.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
