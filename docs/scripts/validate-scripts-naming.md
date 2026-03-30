# validate:scripts:naming

## Command

```sh
bun run validate:scripts:naming
```

## Purpose

Validates all package.json script keys conform to the <domain>:<action>[:<scope>] naming convention. Allowed domains: db, arch, validate, ai, ci, repo, dev, infra, test, governance, policy. Lifecycle-exempt names are skipped. Reports ALL violations before exiting non-zero.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml. Its implementation lives in scripts/validate/script-naming.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run validate:scripts:naming`
- Implementation: scripts/validate/script-naming.ts
- Metadata-backed script file: `scripts/validate/script-naming.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
