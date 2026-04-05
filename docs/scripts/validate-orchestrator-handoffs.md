# validate:orchestrator:handoffs

## Command

```sh
bun run validate:orchestrator:handoffs
```

## Purpose

Validates orchestrator handoff targets against the declared agent registry and checks delegated skills are listed in the loaded-skills section.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/validate/orchestrator-handoffs.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run validate:orchestrator:handoffs`
- Implementation: scripts/validate/orchestrator-handoffs.ts
- Metadata-backed script file: `scripts/validate/orchestrator-handoffs.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
