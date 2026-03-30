# format:check

## Command

```sh
bun run format:check
```

## Purpose

Run both Biome and Prettier checks without writing changes.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run format:check`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level --ci flag.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- When running repository quality checks before commit or push.

## Related Scripts

- Depends on: `format:check:prettier`, `format:check:biome`, `format`
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
