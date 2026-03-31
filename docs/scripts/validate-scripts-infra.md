# validate:scripts:all

## Command

```sh
bun run validate:scripts:all
```

## Purpose

Orchestrator that runs all script-system validators sequentially. Composes: runtime-scripts, detect-broken-scripts, spec-sync, docs-drift. Also enforces the Script Evolution Guard: if package.json scripts changed in the current git diff, the migration-map must have been updated too. Exits non-zero on the first failure. Prints a timing summary.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml. Its implementation lives in scripts/validate/index.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run validate:scripts:all`
- Implementation: scripts/validate/index.ts
- Metadata-backed script file: `scripts/validate/index.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
