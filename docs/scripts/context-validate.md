# context:validate

**Script:** `context:validate`  
**File:** `scripts/context/validate.ts`  
**Domain:** `context`  
**Category:** `governance`

## Description

Validates `docs/ai/context/gitnexus-context.json` against six ordered checks to ensure
the artifact is safe for AI context use. All checks must pass — the first failure exits
immediately with a descriptive error message.

This script is designed to be fast (no network, no subprocess) and is called during
pre-commit, the governance gate, and CI to block stale or malformed context artifacts.

## Validation Checks (in order)

| # | Check                        | Failure message                                      |
| - | ---------------------------- | ---------------------------------------------------- |
| 1 | Artifact file exists         | `artifact not found — run 'bun run context:build'`  |
| 2 | Valid JSON                   | `invalid JSON in artifact — <parse error>`           |
| 3 | Schema file exists           | `schema not found at <path>`                         |
| 4 | All required fields present  | `missing required field: <fieldName>`                |
| 5 | schemaVersion matches schema | `schemaVersion mismatch — artifact:<x> schema:<y>`   |
| 6 | Artifact age ≤ 24 hours      | `stale artifact — age: <N>h (max: 24h)`              |

## Usage

```bash
bun run context:validate
```

No flags are supported. The script always validates the canonical artifact path.

## Exit Codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| `0`  | All 6 checks passed.                 |
| `1`  | At least one check failed.           |

## Artifact

| Path                                    | Role                              |
| --------------------------------------- | --------------------------------- |
| `docs/ai/context/gitnexus-context.json` | Validated (read-only)             |
| `docs/ai/gitnexus-context.schema.json`  | Schema reference (read-only)      |

## Integration

This script is integrated into:

- **`.husky/pre-commit`** — blocks commits when artifact is invalid or stale
- **`scripts/governance/gate.ts`** — runs as the 2nd governance guard (after `context:build`)
- **CI `architecture-governance.yml`** — runs in step 4 after `context:build`

## Remediation

If validation fails with `stale artifact`:

```bash
bun run context:build --force
bun run context:validate
```

If validation fails with `missing required field` or `schemaVersion mismatch`:

```bash
bun run context:build --force
bun run context:validate
```

If validation fails with `artifact not found`:

```bash
bun run context:build
```

## Related Scripts

- `context:build` — generates the artifact validated by this script
- `context:changed` — resolves staged files that influence the artifact content
- `context:impact` — downstream consumer of the validated artifact

## Registry

- **Naming convention:** `<domain>:<action>` — `context:validate`
- **Documentation:** `docs/scripts/context-validate.md` (this file)
