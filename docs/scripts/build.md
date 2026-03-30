# build

## Command

```sh
bun run build
```

## Purpose

Run workspace build scripts across all workspaces.

## Why It Exists

This runner is currently classified as critical. Not safe to remove directly. Other root scripts depend on it: build:packages. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run build`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

No dedicated --ci flag is exposed at this alias level.

## When to Run

- When running repository quality checks before commit or push.

## Related Scripts

- Depends on: None
- Used by other root scripts: `build:packages`

## Audit Notes

- Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
