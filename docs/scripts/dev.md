# dev

## Command

```sh
bun run dev
```

Registered package.json runner:

```sh
bun run dev:all
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Indirect wrapper; CI behavior depends on child runner(s): dev:all.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.

## Related Scripts

- Depends on: `dev:all`
- Used by other root scripts: `dev:all`, `dev:demo-logger-features`

## Audit Notes

- Not audited automatically in the isolated execution pass.
