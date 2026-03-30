# ci:local:list

## Command

```sh
bun run ci:local:list
```

## Purpose

Run or inspect GitHub Actions workflows locally with act.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run ci:local:list`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level --ci flag.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: local GitHub Actions simulation wrapper.
