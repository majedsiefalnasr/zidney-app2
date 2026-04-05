# ai:context:refresh-all

## Command

```sh
bun run ai:context:refresh-all
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as critical. Treat as protected. It is a primary quality, build, test, or governance entrypoint. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run ai:context:refresh-all`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Indirect wrapper; CI behavior depends on child runner(s): arch:gitnexus:context, ai:context:validate, ai:context:refresh, arch:generate.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.

## Related Scripts

- Depends on: `ai:context:refresh`, `ai:context:validate`, `arch:generate`, `arch:gitnexus:context`
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
