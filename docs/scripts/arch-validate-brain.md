# arch:validate:brain

## Command

```sh
bun run arch:validate:brain
```

Registered package.json runner:

```sh
bun scripts/governance/validate-architecture-brain.ts
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/governance/validate-architecture-brain.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/governance/validate-architecture-brain.ts
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
