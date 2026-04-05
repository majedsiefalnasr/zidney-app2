# dev:ai:archive-snapshots

## Command

```sh
bun run dev:ai:archive-snapshots
```

## Purpose

Maintain a rolling archive of historical AI context snapshots, keeping the latest artifacts live and archiving older ones with indexes.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/archive-snapshot-strategy.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:ai:archive-snapshots`
- Implementation: scripts/dev/archive-snapshot-strategy.ts
- Metadata-backed script file: `scripts/dev/archive-snapshot-strategy.ts`

## CI Behavior

No explicit --ci handling detected in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: `ai:context:generate`, `ai:context:refresh`
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: docs/ai/context/ARCHIVE_INDEX.md, docs/ai/context/archive/INDEX.json.
