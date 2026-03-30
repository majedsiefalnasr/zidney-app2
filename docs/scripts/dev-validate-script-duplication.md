# dev:validate:script-duplication

## Command

```sh
bun run dev:validate:script-duplication
```

## Purpose

Measure cross-file duplication within the scripts directory and validate that modularization stays within the target threshold.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/validate-script-duplication.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:validate:script-duplication`
- Implementation: scripts/dev/validate-script-duplication.ts
- Metadata-backed script file: `scripts/dev/validate-script-duplication.ts`

## CI Behavior

No explicit --ci handling detected in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
