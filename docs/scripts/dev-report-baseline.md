# dev:report:baseline

## Command

```sh
bun run dev:report:baseline
```

## Purpose

Generate a consolidated baseline diagnostics report for Phase 1 analysis and write it to docs/audit-reports.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/generate-baseline-report.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:report:baseline`
- Implementation: scripts/dev/generate-baseline-report.ts
- Metadata-backed script file: `scripts/dev/generate-baseline-report.ts`

## CI Behavior

No explicit --ci handling detected in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
