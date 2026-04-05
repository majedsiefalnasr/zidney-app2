# typecheck

## Command

```sh
bun run typecheck
```

## Purpose

Run both source and test TypeScript checks.

## Why It Exists

This runner is currently classified as critical. Not safe to remove directly. Other root scripts depend on it: typecheck:tests, validate:types. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run typecheck`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Indirect wrapper; CI behavior depends on child runner(s): typecheck:src, typecheck:tests.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- When running repository quality checks before commit or push.

## Related Scripts

- Depends on: `typecheck:src`, `typecheck:tests`
- Used by other root scripts: `typecheck:tests`, `validate:types`

## Audit Notes

- Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
