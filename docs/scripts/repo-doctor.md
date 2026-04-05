# repo:doctor

## Command

```sh
bun run repo:doctor
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml. Its implementation lives in scripts/dev/repo-doctor.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run repo:doctor`
- Implementation: scripts/dev/repo-doctor.ts
- Metadata-backed script file: `scripts/dev/repo-doctor.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: `ai:context:generate`, `ai:context:refresh`
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
