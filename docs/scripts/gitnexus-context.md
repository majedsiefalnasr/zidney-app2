# arch:gitnexus:context

## Command

```sh
bun run arch:gitnexus:context
```

## Purpose

Generates a structured GitNexus context JSON artifact from git state and ai-architecture-brain.json for AI orchestrators and CI gates.

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: arch:governance, ai:context:refresh-all. Its implementation lives in scripts/gitnexus-context.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run arch:gitnexus:context`
- Implementation: scripts/gitnexus-context.ts
- Metadata-backed script file: `scripts/gitnexus-context.ts`

## Flags

| Flag                   | Type      | Description                                           | Example                                                 |
| ---------------------- | --------- | ----------------------------------------------------- | ------------------------------------------------------- |
| `--changed-files-only` | `boolean` | —                                                     | `bun run arch:gitnexus:context -- --changed-files-only` |
| `--dry-run`            | `boolean` | Report what would be done without making any changes. | `bun run arch:gitnexus:context -- --dry-run`            |
| `--all`                | `boolean` | —                                                     | `bun run arch:gitnexus:context -- --all`                |

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: `arch:governance`, `ai:context:refresh-all`

## Audit Notes

- Observed in isolated worktree run: docs/ai/context/gitnexus-context.json.
