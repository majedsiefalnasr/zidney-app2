# policy:check

## Command

```sh
bun run policy:check
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/policy-check.yml. Its implementation lives in scripts/policy-engine/cli.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run policy:check`
- Implementation: scripts/policy-engine/cli.ts
- Metadata-backed script file: `scripts/policy-engine/cli.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Audit attempt failed in isolated worktree: bun run policy:check -- --ci exited non-zero before tracked file changes were observed. Output note: │ Policy violations detected │ error: script "policy:check" exited with code 1
