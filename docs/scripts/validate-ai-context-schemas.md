# validate:ai-context-schemas

## Command

```sh
bun run validate:ai-context-schemas
```

## Purpose

Validate that all required AI context JSON artifacts exist and are valid JSON

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: ai:context:validate. Its implementation lives in scripts/validate/ai-context-schemas.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run validate:ai-context-schemas`
- Implementation: scripts/validate/ai-context-schemas.ts
- Metadata-backed script file: `scripts/validate/ai-context-schemas.ts`

## Flags

| Flag   | Type      | Description                                                            | Example                                       |
| ------ | --------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| `--ai` | `boolean` | Emit machine-readable JSON to stdout instead of human-readable output. | `bun run validate:ai-context-schemas -- --ai` |

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: `ai:context:validate`

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
