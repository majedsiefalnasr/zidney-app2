# dev:stale-test

## Command

```sh
bun run dev:stale-test
```

Registered package.json runner:

```sh
echo 'dev:stale-test placeholder'
```

## Purpose

Placeholder alias retained for compatibility or future implementation.

## Why It Exists

This runner is currently classified as low. Low-risk cleanup candidate, but verify no undocumented manual workflow still calls it. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

No dedicated --ci flag is exposed at this alias level.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
