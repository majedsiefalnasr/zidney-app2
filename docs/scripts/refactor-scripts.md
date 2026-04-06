# refactor-scripts

## Command

```sh
bun run dev:refactor:scripts
```

## Purpose

Applies the migration map to rename all "bun run <old>" references across the repository. Supports both JSON format (docs/scripts/migration-map.json, preferred) and Markdown format (docs/scripts/SCRIPT_MIGRATION_MAP.md, legacy). Builds the old→new rename index, then rewrites all matching files in-place. Supports --dry-run to preview changes without writing. Exits 1 if any unresolved references remain. Writes reports to both reports/SCRIPT_REFACTOR_REPORT.md and docs/reports/script-refactor-report.json.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/refactor-scripts.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:refactor:scripts`
- Implementation: scripts/dev/refactor-scripts.ts
- Metadata-backed script file: `scripts/dev/refactor-scripts.ts`

## CI Behavior

Explicitly rejected in the implementation.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: `ai:context:generate`, `ai:context:refresh`
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: mutates repository state.
