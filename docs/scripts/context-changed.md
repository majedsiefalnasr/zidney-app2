# arch:context:changed

**Script:** `context:changed`  
**File:** `scripts/context/changed.ts`  
**Domain:** `context`  
**Category:** `governance`

## Description

Resolves staged changed files via `git diff --cached --name-only --diff-filter=ACM` and
writes the result to `docs/ai/context/context-changed.json`. Uses a 5-minute freshness
cache to avoid redundant git invocations within a single pre-commit run.

A clean staging area (no changed files) is a valid outcome — the artifact is written with
`changedFiles: []` rather than exiting non-zero.

## Usage

```bash
bun run arch:context:changed
```

No flags are supported. The script always reads the current staging area.

## Output

| Artifact                               | Description                          |
| -------------------------------------- | ------------------------------------ |
| `docs/ai/context/context-changed.json` | List of staged files with timestamp. |

### Artifact Schema

```json
{
  "generatedAt": "2024-01-01T00:00:00.000Z",
  "changedFiles": ["apps/api/src/routes/exam.ts", "packages/domain-core/src/exam.ts"]
}
```

## Exit Codes

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| `0`  | Staged files resolved and written (or cache hit). |
| `1`  | `git` is unavailable or the write failed.         |

## Caching

The artifact is considered fresh for **5 minutes** from its `generatedAt` timestamp.
If the artifact is fresh when the script runs, it exits immediately with a cache-hit log
line and does not invoke `git`.

## Integration

This script is integrated into:

- **`.husky/pre-commit`** — runs on every commit (before architecture guard)
- **`package.json` `governance:gate:changed`** — `bun run arch:context:changed && bun run arch:guard:changed`

## Related Scripts

- `context:build` — full artifact rebuild used by the governance gate
- `context:impact` — uses this artifact to filter risk indicators
- `context:validate` — validates the main `gitnexus-context.json` artifact

## Registry

- **Naming convention:** `<domain>:<action>` — `context:changed`
- **Documentation:** `docs/scripts/context-changed.md` (this file)
