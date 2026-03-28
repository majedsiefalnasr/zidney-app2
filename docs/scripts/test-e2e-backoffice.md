# test:e2e:backoffice

## Command

```sh
bun run test:e2e:backoffice
```

Registered package.json runner:

```sh
bunx playwright test --config apps/backoffice/playwright.config.ts
```

## Purpose

Run Playwright end-to-end tests for the configured app.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml. It provides a stable root package.json interface over underlying tools or chained child runners.

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
- Used by other root scripts: `test:e2e`

## Audit Notes

- Not audited automatically: browser/end-to-end workflow.
