# test

## Command

```sh
bun run test
```

## Purpose

Run Vitest for the configured scope.

## Why It Exists

This runner is currently classified as critical. Not safe to remove directly. Other root scripts depend on it: test:e2e. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run test`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level --ci flag.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- When running repository quality checks before commit or push.

## Related Scripts

- Depends on: None
- Used by other root scripts: `test:e2e`

## Audit Notes

- Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
