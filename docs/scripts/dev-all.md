# dev:all

## Command

```sh
bun run dev:all
```

Registered package.json runner:

```sh
concurrently "bun run dev:api" "bun run dev:worker" "bun run dev:mmc" "bun run dev:backoffice" "bun run dev:frontoffice"
```

## Purpose

Start multiple long-running development services in parallel.

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: dev. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Not applicable as a --ci flag; this is a long-running wrapper or service launcher.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: `dev:frontoffice`, `dev:backoffice`, `dev:worker`, `dev:api`, `dev:mmc`, `dev`
- Used by other root scripts: `dev`

## Audit Notes

- Not audited automatically: long-running service launcher.
