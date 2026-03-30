# validate:scan:packages

## Command

```sh
bun run validate:scan:packages
```

## Purpose

Walk all runtime spec docs and extract unique script references

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/validate/scan-package-scripts.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run validate:scan:packages`
- Implementation: scripts/validate/scan-package-scripts.ts
- Metadata-backed script file: `scripts/validate/scan-package-scripts.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/runtime-script-scan.json.
