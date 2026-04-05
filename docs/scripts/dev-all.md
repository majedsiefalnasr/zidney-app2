# dev:all

## Command

```sh
bun run dev:all
```

## Purpose

Start multiple long-running development services in parallel.

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: dev. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run dev:all`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Not applicable as a --ci flag; this is a long-running wrapper or service launcher.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: `dev`, `dev:api`, `dev:backoffice`, `dev:frontoffice`, `dev:mmc`, `dev:worker`
- Used by other root scripts: `dev`

## Audit Notes

- Not audited automatically: long-running service launcher.
