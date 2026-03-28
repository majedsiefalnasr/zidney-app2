# validate:scripts:broken

## Command

```sh
bun run validate:scripts:broken
```

Registered package.json runner:

```sh
bun run scripts/validate/detect-broken-scripts.ts
```

## Purpose

Detect missing or broken TypeScript script files referenced in root package.json

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/validate/detect-broken-scripts.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/validate/detect-broken-scripts.ts
- Metadata-backed script file: `scripts/validate/detect-broken-scripts.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
