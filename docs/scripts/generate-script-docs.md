# generate-script-docs

## Command

```sh
bun run generate-script-docs
```

## Purpose

Walks all TypeScript files under `scripts/**/*.ts` (excluding `__tests__/`), parses their
JSDoc metadata headers, and generates individual documentation pages under `docs/scripts/`
plus an updated `docs/scripts/SCRIPT_REGISTRY.md`. Exits 1 if any script's `@script` key
violates the `<domain>:<action>` naming convention (unless in the legacy allowlist).

## Why It Exists

Script documentation written manually drifts from the actual implementation. The metadata
header standard makes scripts self-documenting, and this generator ensures that the
`docs/scripts/` directory always reflects the current state of all scripts without manual editing.

## When to Run

- After adding or modifying script files with `@script` metadata headers
- During CI to regenerate and commit updated documentation
- After any significant script refactor
- Before releasing to ensure documentation is current

## Execution Mode

`manual` | `ci`

Exits 1 if any `@script` key fails the naming convention validation (not in LEGACY_ALLOWLIST).
Exits 0 on successful doc generation.

## Naming Convention Validation

All `@script` keys must match pattern: `/^[a-z][a-z0-9]+:[a-z][a-z0-9-]+$/`

**LEGACY_ALLOWLIST** (exempt from naming convention validation):

- `generate-script-docs`
- `validate-runtime-scripts`
- `seed-dashboard-test-data`

## Metadata Header Format

```typescript
/**
 * @script db:pool-status
 * @domain db
 * @description Check PostgreSQL connection pool health
 * @mode manual,ci
 * @dependencies postgres,packages/config
 */
```

## Dependencies

- `scripts/**/*.ts` source files with `@script` metadata headers
- No external runtime dependencies

## Example Usage

```sh
# Regenerate all script docs
bun run generate-script-docs
```

Expected output:

```json
{
  "level": "info",
  "message": "Script docs generation complete",
  "metadata": { "processed": 12, "written": 12, "violations": 0 }
}
```

## Known Failure Modes

| Scenario                                | Exit Code | Behavior                      |
| --------------------------------------- | --------- | ----------------------------- |
| Any naming violation (not in allowlist) | 1         | Lists all violation details   |
| Script file has no `@script` tag        | 0         | File is skipped with info log |
| `docs/scripts/` not writable            | 1         | Error with path info          |
| All docs generated                      | 0         | Completion log with counts    |
