# validate:scripts:usage

## Command

```sh
bun run validate:scripts:usage
```

Registered package.json runner:

```sh
bun scripts/validate/script-usage.ts
```

## Purpose

Scans all .ts, .json, .yml, .yaml, .md, and .sh files for "bun run <name>" references and validates that every referenced name exists in a package.json scripts block. Reports all broken/orphan references before exiting non-zero.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml. Its implementation lives in scripts/validate/script-usage.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/validate/script-usage.ts
- Metadata-backed script file: `scripts/validate/script-usage.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
