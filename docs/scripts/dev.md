# dev

## Command

```sh
bun run dev
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: dev:all. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run dev`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Indirect wrapper; CI behavior depends on child runner(s): dev:all.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.

## Related Scripts

- Depends on: `dev:all`
- Used by other root scripts: `dev:all`

## Audit Notes

- Not audited automatically in the isolated execution pass.
