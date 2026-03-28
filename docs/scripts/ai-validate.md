# ai:validate

## Command

```sh
bun run ai:validate
```

Registered package.json runner:

```sh
bun scripts/ai-engine/validate-execution.ts
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/ai-engine/validate-execution.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/ai-engine/validate-execution.ts
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Audit attempt failed in isolated worktree: bun run ai:validate -- --ci exited non-zero before tracked file changes were observed. Output note: error: script "ai:validate" exited with code 4
