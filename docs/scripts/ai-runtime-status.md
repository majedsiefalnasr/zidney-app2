# ai:runtime:status

## Command

```sh
bun run ai:runtime:status
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml. Its implementation lives in scripts/ai-runtime/runtime-status.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run ai:runtime:status`
- Implementation: scripts/ai-runtime/runtime-status.ts
- Metadata-backed script file: `scripts/ai-runtime/runtime-status.ts`

## CI Behavior

No explicit CI handling detected in the implementation.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
