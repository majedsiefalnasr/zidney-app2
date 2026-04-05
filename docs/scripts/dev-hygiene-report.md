# dev:hygiene:report

## Command

```sh
bun run dev:hygiene:report
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/hygiene-report-generator.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:hygiene:report`
- Implementation: scripts/dev/hygiene-report-generator.ts
- Metadata-backed script file: `scripts/dev/hygiene-report-generator.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: `ai:context:generate`, `ai:context:refresh`
- Used by other root scripts: None found

## Audit Notes

- Audit attempt failed in isolated worktree: bun run dev:hygiene:report -- --ci exited non-zero before tracked file changes were observed. Output note: ReferenceError: ROOT is not defined error: script "dev:hygiene:report" exited with code 1
