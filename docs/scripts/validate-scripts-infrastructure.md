# validate:scripts:infrastructure

## Command

```sh
bun run validate:scripts:infrastructure
```

## Purpose

Validates that all scripts/\*.ts files have the mandatory 5-field metadata header (@script, @domain, @category, @description, @usage) and that the SCRIPT_REGISTRY.md is up-to-date (no drift vs. what the generator would produce). Reports all violations before exiting non-zero.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml. Its implementation lives in scripts/validate/script-infrastructure.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run validate:scripts:infrastructure`
- Implementation: scripts/validate/script-infrastructure.ts
- Metadata-backed script file: `scripts/validate/script-infrastructure.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
