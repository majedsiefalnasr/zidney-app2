# repo:onboard

## Command

```sh
bun run repo:onboard
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/repo-onboard.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run repo:onboard`
- Implementation: scripts/dev/repo-onboard.ts
- Metadata-backed script file: `scripts/dev/repo-onboard.ts`

## CI Behavior

Explicitly rejected in the implementation; this is a local bootstrap command and must not run with --ci.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: `ai:context:generate`, `ai:context:refresh`
- Used by other root scripts: None found

## Audit Notes

- Audit attempt failed in isolated worktree: bun run repo:onboard -- --ci exited non-zero before tracked file changes were observed. Output note: error: script "repo:onboard" exited with code 1
