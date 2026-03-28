# dev:api

## Command

```sh
bun run dev:api
```

Registered package.json runner:

```sh
bun --cwd apps/api dev
```

## Purpose

Start a specific workspace development process.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

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
