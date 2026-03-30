# arch:governance

## Command

```sh
bun run arch:governance
```

## Purpose

Execute the registered repository runner for this workflow.

## Why It Exists

It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run arch:governance`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

No explicit root-level `--ci` contract was detected for this runner.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: `arch:gitnexus:context`, `arch:audit`
- Used by other root scripts: None found

## Audit Notes

- No isolated execution audit note is currently recorded.
