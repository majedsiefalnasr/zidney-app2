# repo:onboard

## Command

```sh
bun run repo:onboard
```

Registered package.json runner:

```sh
bun scripts/dev/repo-onboard.ts
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/repo-onboard.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/dev/repo-onboard.ts
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Explicitly rejected in the implementation; this is a local bootstrap command and must not run with --ci.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
