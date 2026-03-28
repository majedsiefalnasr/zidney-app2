# dev:generate:script-docs

## Command

```sh
bun run dev:generate:script-docs
```

Registered package.json runner:

```sh
bun scripts/generate/script-docs.ts
```

## Purpose

Walk scripts/\*_\/_.ts, parse @script metadata headers, generate docs/scripts/SCRIPT_REGISTRY.md. Exits 1 on missing required metadata fields.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml. Its implementation lives in scripts/generate/script-docs.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/generate/script-docs.ts
- Metadata-backed script file: `scripts/generate/script-docs.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: docs/scripts/SCRIPT_REGISTRY.md.
