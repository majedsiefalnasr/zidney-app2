# context:build

**Script:** `context:build`  
**File:** `scripts/context/build.ts`  
**Domain:** `context`  
**Category:** `governance`

## Description

Generates `docs/ai/context/gitnexus-context.json` by invoking `assembleContext()` from
`scripts/gitnexus-context.ts`. Writes the artifact atomically (`.tmp` file ➜ `renameSync`)
to prevent partial-write corruption.

Skips regeneration when the artifact is ≤24 hours old unless `--force` is supplied.

## Usage

```bash
# Standard rebuild (skips if artifact is fresh)
bun run context:build

# Force rebuild regardless of artifact age
bun run context:build -- --force

# All-workspace analysis (not just changed files)
bun run context:build -- --all

# Dry-run: print context JSON to stdout without writing
bun run context:build -- --dry-run
```

## Options

| Flag        | Effect                                                              |
| ----------- | ------------------------------------------------------------------- |
| `--dry-run` | Print the assembled context JSON to stdout. Does not write to disk. |
| `--all`     | Run full-workspace analysis (`changedFilesOnly: false`).            |
| `--force`   | Bypass the 24-hour freshness check and always regenerate.           |

## Output

| Artifact                                | Description                          |
| --------------------------------------- | ------------------------------------ |
| `docs/ai/context/gitnexus-context.json` | GitNexus context artifact (primary). |

## Exit Codes

| Code | Meaning                                        |
| ---- | ---------------------------------------------- |
| `0`  | Artifact written (or skipped — already fresh). |
| `1`  | `assembleContext()` or atomic write failed.    |

## Related Scripts

- `context:validate` — validates the artifact written by this script
- `context:changed` — resolves staged files consumed by `assembleContext()`
- `context:impact` — synthesizes risk indicators from this artifact
- `arch:gitnexus:context` — lower-level alias for `scripts/gitnexus-context.ts`

## Registry

- **Naming convention:** `<domain>:<action>` — `context:build`
- **Documentation:** `docs/scripts/context-build.md` (this file)
