# validate:scripts:ux

## Command

```sh
bun run validate:scripts:ux
```

Registered package.json runner:

```sh
bun scripts/validate/validate-scripts-ux.ts
```

## Purpose

Validates scripts for consistent UX, logging, and exit usage.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml. Its implementation lives in scripts/validate/validate-scripts-ux.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/validate/validate-scripts-ux.ts
- Metadata-backed script file: `scripts/validate/validate-scripts-ux.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
