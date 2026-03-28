# format:check:prettier

## Command

```sh
bun run format:check:prettier
```

Registered package.json runner:

```sh
prettier --check '**/*.{md,yaml,yml}'
```

## Purpose

Check Markdown and YAML-family files against Prettier formatting.

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: format:check. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level --ci flag.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- When running repository quality checks before commit or push.

## Related Scripts

- Depends on: None
- Used by other root scripts: `format:check`

## Audit Notes

- Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
