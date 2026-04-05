# arch:validate:brain

## Command

```sh
bun run arch:validate:brain
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: arch:guard, arch:guard:changed, arch:guard:ci. Its implementation lives in scripts/governance/validate-architecture-brain.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run arch:validate:brain`
- Implementation: scripts/governance/validate-architecture-brain.ts
- Metadata-backed script file: `scripts/governance/validate-architecture-brain.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: `arch:guard`, `arch:guard:changed`, `arch:guard:ci`

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
