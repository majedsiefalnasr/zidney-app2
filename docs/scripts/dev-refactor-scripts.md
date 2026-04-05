# dev:refactor:scripts

## Command

```sh
bun run dev:refactor:scripts
```

## Purpose

Applies the SCRIPT_MIGRATION_MAP to rename all "bun run <old>" references across the repository. Reads docs/scripts/SCRIPT_MIGRATION_MAP.md, builds the old→new rename index, then rewrites all matching files in-place. Supports --dry-run to preview changes without writing. Exits 1 if any unresolved references remain after the run. Writes a summary report to reports/SCRIPT_REFACTOR_REPORT.md.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/refactor-scripts.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:refactor:scripts`
- Implementation: scripts/dev/refactor-scripts.ts
- Metadata-backed script file: `scripts/dev/refactor-scripts.ts`

## CI Behavior

Explicitly rejected in the implementation; this runner rewrites repository files and must not run with --ci.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: `ai:context:generate`, `ai:context:refresh`
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
