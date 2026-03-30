# ai:validate

## Command

```sh
bun run ai:validate
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml. Its implementation lives in scripts/ai-engine/validate-execution.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run ai:validate`
- Implementation: scripts/ai-engine/validate-execution.ts
- Metadata-backed script file: `scripts/ai-engine/validate-execution.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Audit attempt failed in isolated worktree: bun run ai:validate -- --ci exited non-zero before tracked file changes were observed. Output note: error: script "ai:validate" exited with code 4
