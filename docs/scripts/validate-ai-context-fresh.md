# validate:ai-context-fresh

## Command

```sh
bun run validate:ai-context-fresh
```

## Purpose

Check that the AI context mini artifact exists and is not older than 24 hours

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: ai:context:validate. Its implementation lives in scripts/validate/ai-context-fresh.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run validate:ai-context-fresh`
- Implementation: scripts/validate/ai-context-fresh.ts
- Metadata-backed script file: `scripts/validate/ai-context-fresh.ts`

## Flags

| Flag   | Type      | Description                                                            | Example                                     |
| ------ | --------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| `--ai` | `boolean` | Emit machine-readable JSON to stdout instead of human-readable output. | `bun run validate:ai-context-fresh -- --ai` |

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: `ai:context:validate`

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
