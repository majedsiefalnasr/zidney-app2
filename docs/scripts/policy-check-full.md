# policy:check:full

## Command

```sh
bun run policy:check:full
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as critical. Treat as protected. It is a primary quality, build, test, or governance entrypoint. Its implementation lives in scripts/policy-engine/cli.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run policy:check:full`
- Implementation: scripts/policy-engine/cli.ts
- Metadata-backed script file: `scripts/policy-engine/cli.ts`

## Flags

| Flag        | Type      | Description                                         | Example                             |
| ----------- | --------- | --------------------------------------------------- | ----------------------------------- |
| `--full`    | `boolean` | Run a full (non-incremental) analysis.              | `bun run policy:check -- --full`    |
| `--changed` | `boolean` | Only analyse files changed in the current git diff. | `bun run policy:check -- --changed` |
| `--json`    | `boolean` | Output results as JSON.                             | `bun run policy:check -- --json`    |

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Audit attempt failed in isolated worktree: bun run policy:check:full -- --ci exited non-zero before tracked file changes were observed. Output note: │ Policy violations detected │ error: script "policy:check:full" exited with code 1
