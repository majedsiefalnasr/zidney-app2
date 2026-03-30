# build:api

## Command

```sh
bun run build:api
```

## Purpose

Build a specific workspace.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run build:api`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

No dedicated --ci flag is exposed at this alias level.

## When to Run

- When running repository quality checks before commit or push.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
