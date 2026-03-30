# governance:gate

## Command

```sh
bun run governance:gate
```

## Purpose

Unified governance gate — composes all guards in sequence (report-all mode)

## Why It Exists

This runner is currently classified as critical. Treat as protected. It is a primary quality, build, test, or governance entrypoint. Its implementation lives in scripts/governance/gate.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run governance:gate`
- Implementation: scripts/governance/gate.ts
- Metadata-backed script file: `scripts/governance/gate.ts`

## CI Behavior

Supported explicitly in the implementation; --ci is forwarded to child runners.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Audit attempt failed in isolated worktree: bun run governance:gate -- --ci exited non-zero before tracked file changes were observed. Failure path was expected: Type Safety via validate:types exited with code 2.
