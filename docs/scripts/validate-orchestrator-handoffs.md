# validate:orchestrator:handoffs

## Command

```sh
bun run validate:orchestrator:handoffs
```

## Purpose

Validates orchestrator handoff targets against the declared agent registry and checks delegated skills are listed in the loaded-skills section.

## Why It Exists

Its implementation lives in scripts/validate/orchestrator-handoffs.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run validate:orchestrator:handoffs`
- Implementation: scripts/validate/orchestrator-handoffs.ts
- Metadata-backed script file: `scripts/validate/orchestrator-handoffs.ts`

## CI Behavior

No explicit root-level `--ci` contract was detected for this runner.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- No isolated execution audit note is currently recorded.
