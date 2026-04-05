# arch:governance

## Command

```sh
bun run arch:governance
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run arch:governance`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Indirect wrapper; CI behavior depends on child runner(s): arch:gitnexus:context, arch:audit.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: `arch:audit`, `arch:gitnexus:context`
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
