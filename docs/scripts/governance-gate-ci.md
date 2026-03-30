# governance:gate:ci

## Command

```sh
bun run governance:gate:ci
```

## Purpose

CI variant of the governance gate — runs gate.ts with GitHub Actions annotations

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml. Its implementation lives in scripts/governance/gate-ci.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run governance:gate:ci`
- Implementation: scripts/governance/gate-ci.ts
- Metadata-backed script file: `scripts/governance/gate-ci.ts`

## CI Behavior

Dedicated CI runner by name; this entrypoint is already the CI-specific variant.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Audit attempt failed in isolated worktree: bun run governance:gate:ci exited non-zero before tracked file changes were observed. Output note: ✖ ::error::Governance gate failed — see output above error: script "governance:gate:ci" exited with code 1
