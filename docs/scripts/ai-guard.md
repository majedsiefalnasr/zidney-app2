# ai:guard

## Command

```sh
bun run ai:guard
```

## Purpose

Enforces architecture rules (import boundaries, contract compliance) before AI-generated commits and in CI.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml. Its implementation lives in scripts/ai-guard.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run ai:guard`
- Implementation: scripts/ai-guard.ts
- Metadata-backed script file: `scripts/ai-guard.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: `ai:context:refresh`
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
