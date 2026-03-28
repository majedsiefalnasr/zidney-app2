# test:e2e

## Command

```sh
bun run test:e2e
```

Registered package.json runner:

```sh
bun run test:e2e:mmc && bun run test:e2e:backoffice && bun run test:e2e:frontoffice
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Indirect wrapper; CI behavior depends on child runner(s): test:e2e:mmc, test:e2e:backoffice, test:e2e:frontoffice.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- When running repository quality checks before commit or push.

## Related Scripts

- Depends on: `test:e2e:frontoffice`, `test:e2e:backoffice`, `test:e2e:mmc`, `test`
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: browser/end-to-end workflow.
