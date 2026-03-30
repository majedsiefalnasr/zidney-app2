# arch:gitnexus:validate

## Command

```sh
bun run arch:gitnexus:validate
```

## Purpose

Validates the gitnexus-context.json artifact for file presence, structure, semantics, and freshness.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/validate/validate-gitnexus.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run arch:gitnexus:validate`
- Implementation: scripts/validate/validate-gitnexus.ts
- Metadata-backed script file: `scripts/validate/validate-gitnexus.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
