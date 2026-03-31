# \_other

## Command

```sh
bun run _other
```

## Purpose

Execute the registered repository runner for this workflow.

## Why It Exists

It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run _other`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

No explicit root-level `--ci` contract was detected for this runner.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- No isolated execution audit note is currently recorded.
