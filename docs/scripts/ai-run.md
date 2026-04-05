# ai:run

## Command

```sh
bun run ai:run
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/ai-engine/run-task.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run ai:run`
- Implementation: scripts/ai-engine/run-task.ts
- Metadata-backed script file: `scripts/ai-engine/run-task.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Audit attempt failed in isolated worktree: bun run ai:run -- --ci exited non-zero before tracked file changes were observed. Output note: ✖ --task argument is required error: script "ai:run" exited with code 1
