# arch:context:impact

**Script:** `context:impact`  
**File:** `scripts/context/impact.ts`  
**Domain:** `context`  
**Category:** `governance`

## Description

Synthesizes risk indicators from `docs/ai/context/gitnexus-context.json` filtered by
the staged changed files recorded in `context-changed.json`. A risk indicator is included
when its `affectedBy` set intersects the staged changed files.

If `context-changed.json` does not exist, falls back to the `changedFiles` array embedded
in the main context artifact.

Results are written atomically to `docs/ai/context/context-impact.json`. Output can be
printed in two formats: plain module names (one per line, default) or full JSON.

## Usage

```bash
# Default — one affected module name per line (sorted alphabetically)
bun run arch:context:impact

# JSON — full riskIndicators array on stdout
bun run arch:context:impact -- --json
```

## Options

| Flag     | Effect                                                   |
| -------- | -------------------------------------------------------- |
| `--json` | Print the full `riskIndicators` array as JSON to stdout. |

## Output

| Artifact                              | Description                                          |
| ------------------------------------- | ---------------------------------------------------- |
| `docs/ai/context/context-impact.json` | Filtered risk indicators for current staged changes. |

### Artifact Schema

```json
{
  "generatedAt": "2024-01-01T00:00:00.000Z",
  "riskIndicators": [
    {
      "module": "packages/domain-core",
      "riskScore": 8,
      "reason": "High coupling — 12 dependents",
      "affectedBy": ["packages/domain-core/src/exam.ts"]
    }
  ]
}
```

## Exit Codes

| Code | Meaning                                                               |
| ---- | --------------------------------------------------------------------- |
| `0`  | Risk indicators resolved and artifact written.                        |
| `1`  | `gitnexus-context.json` not found or unreadable. Run `context:build`. |

## Prerequisites

- `docs/ai/context/gitnexus-context.json` must exist (run `bun run arch:context:build` first)
- `docs/ai/context/context-changed.json` is optional — falls back to embedded `changedFiles`

## Related Scripts

- `context:build` — generates the main `gitnexus-context.json` artifact
- `context:changed` — generates the staged-files artifact consumed by this script
- `context:validate` — validates the main artifact

## Registry

- **Naming convention:** `<domain>:<action>` — `context:impact`
- **Documentation:** `docs/scripts/context-impact.md` (this file)
