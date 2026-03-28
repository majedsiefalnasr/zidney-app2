# arch:context:validate

## Command

```sh
bun run arch:context:validate
```

Registered package.json runner:

```sh
bun scripts/context/validate.ts
```

## Purpose

Validates docs/ai/context/gitnexus-context.json against docs/ai/gitnexus-context.schema.json. No external schema library (NFR-005). Validation order (stops at first failure): 1. Artifact file exists 2. Valid JSON 3. Schema file exists and is readable 4. All required fields present 5. schemaVersion matches schema.version 6. generatedAt is < maxAgeHours old (default: 24h)

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml. Its implementation lives in scripts/context/validate.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/context/validate.ts
- Metadata-backed script file: `scripts/context/validate.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: no tracked file changes.
