# arch:guard:ci

## Command

```sh
bun run arch:guard:ci
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/architecture-guard/architecture-guard.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run arch:guard:ci`
- Implementation: scripts/architecture-guard/architecture-guard.ts
- Metadata-backed script file: `scripts/architecture-guard/architecture-guard.ts`

## CI Behavior

Dedicated CI runner by name; this entrypoint is already the CI-specific variant.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: `ai:context:refresh`, `arch:audit`, `arch:validate:brain`
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: all generated files are attributed to dependency scripts.
