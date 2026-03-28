# validate:runtime:scripts

## Command

```sh
bun run validate:runtime:scripts
```

Registered package.json runner:

```sh
bun run scripts/validate/runtime-scripts.ts
```

## Purpose

CI guard: hard-blocks (exit 1) when any bun run <script> reference in the project (outside specs, .gitnexus, and reports) is absent from root package.json. References inside those dirs generate warnings but exit 0. Exits 0 when no critical issues found.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/validate/runtime-scripts.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/validate/runtime-scripts.ts
- Metadata-backed script file: `scripts/validate/runtime-scripts.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
