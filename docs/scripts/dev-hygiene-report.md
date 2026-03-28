# dev:hygiene:report

## Command

```sh
bun run dev:hygiene:report
```

Registered package.json runner:

```sh
bun scripts/dev/hygiene-report-generator.ts
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/hygiene-report-generator.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/dev/hygiene-report-generator.ts
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Isolated worktree run failed before any tracked file changes were observed.
