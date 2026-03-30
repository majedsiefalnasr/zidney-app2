# arch:context:build

## Command

```sh
bun run arch:context:build
```

## Purpose

Generates docs/ai/context/gitnexus-context.json via assembleContext(). Uses atomic write (write to .tmp then renameSync) to prevent partial artifact state. Supports --dry-run (print to stdout only), --all (full workspace), --force (skip freshness check and always regenerate).

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml. Its implementation lives in scripts/context/build.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run arch:context:build`
- Implementation: scripts/context/build.ts
- Metadata-backed script file: `scripts/context/build.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
