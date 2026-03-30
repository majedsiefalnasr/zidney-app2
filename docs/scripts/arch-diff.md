# arch:diff

## Command

```sh
bun run arch:diff
```

## Purpose

Detect architecture violations in the current change set (PR/staged diff) by comparing changed imports against ARCHITECTURE_CONTRACT.json rules.

## Why It Exists

This runner is currently classified as medium. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml. Its implementation lives in scripts/architecture-diff.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run arch:diff`
- Implementation: scripts/architecture-diff.ts
- Metadata-backed script file: `scripts/architecture-diff.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
