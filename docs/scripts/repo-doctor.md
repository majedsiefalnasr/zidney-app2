# repo:doctor

## Command

```sh
bun run repo:doctor
```

Registered package.json runner:

```sh
bun scripts/dev/repo-doctor.ts
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/repo-doctor.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/dev/repo-doctor.ts
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
