# ai:run

## Command

```sh
bun run ai:run
```

Registered package.json runner:

```sh
bun scripts/ai-engine/run-task.ts
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/ai-engine/run-task.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/ai-engine/run-task.ts
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
