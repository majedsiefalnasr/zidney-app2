# dev:mmc

## Command

```sh
bun run dev:mmc
```

## Purpose

Start a specific workspace development process.

## Why It Exists

This runner is currently classified as critical. Not safe to remove directly. Other root scripts depend on it: dev:all. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run dev:mmc`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Not applicable as a --ci flag; this is a long-running wrapper or service launcher.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: `dev:all`

## Audit Notes

- Not audited automatically: long-running service launcher.
