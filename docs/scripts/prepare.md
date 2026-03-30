# prepare

## Command

```sh
bun run prepare
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as critical. Treat as protected. It is a primary quality, build, test, or governance entrypoint. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run prepare`
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

- Not audited automatically in the isolated execution pass.
