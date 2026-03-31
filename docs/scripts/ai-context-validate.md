# ai:context:validate

## Command

```sh
bun run ai:context:validate
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ai-context-validation.yml. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Package runner: `bun run ai:context:validate`
- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Indirect wrapper; CI behavior depends on child runner(s): validate:ai-context-fresh, validate:ai-context-schemas.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.

## Related Scripts

- Depends on: `validate:ai-context-schemas`, `validate:ai-context-fresh`
- Used by other root scripts: `ai:context:refresh-all`

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
