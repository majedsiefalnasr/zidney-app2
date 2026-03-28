# arch:gitnexus:context

## Command

```sh
bun run arch:gitnexus:context
```

Registered package.json runner:

```sh
bun scripts/gitnexus-context.ts
```

## Purpose

Generates a structured GitNexus context JSON artifact from git state and ai-architecture-brain.json for AI orchestrators and CI gates.

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: arch:refresh. Its implementation lives in scripts/gitnexus-context.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/gitnexus-context.ts
- Metadata-backed script file: `scripts/gitnexus-context.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: `arch:refresh`

## Audit Notes

- Observed in isolated worktree run: docs/ai/context/gitnexus-context.json.
