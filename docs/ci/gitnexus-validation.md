# GitNexus Validation CI Gate

## Purpose

The `gitnexus:validate` script (`scripts/validate/validate-gitnexus.ts`) provides a CI-ready
validation gate that confirms the `gitnexus-context.json` artifact is present, structurally sound,
and semantically valid before it is consumed by AI orchestrators or architecture tooling.

## When It Runs

- Locally, before any SpecKit Step 6 (Implement) begins.
- In CI, after `gitnexus:context` runs and before downstream steps that consume the artifact.
- As part of `bun run ci:local` / `bun run ci:test` pre-flight checks (if wired).

## Usage

```bash
# Generate the context artifact first
bun run arch:gitnexus:context

# Then validate
bun run arch:validate:gitnexus
```

Exit codes:

| Code | Meaning                                            |
| ---- | -------------------------------------------------- |
| 0    | All 5 checks passed — artifact is valid            |
| 1    | One or more checks failed — see stderr for details |

## Validation Pipeline (5 Steps)

| Step | Check                                                                                           | Fatal?       |
| ---- | ----------------------------------------------------------------------------------------------- | ------------ |
| 1    | `gitnexus-context.json` and `gitnexus-context.schema.json` exist on disk                        | Yes          |
| 2    | `gitnexus-context.json` is valid JSON                                                           | Yes          |
| 3    | All 9 required fields present and correctly typed                                               | Yes          |
| 4    | Semantic constraints: `analysisMode` enum, ISO timestamp, `riskScore` range, commit SHA pattern | Yes          |
| 5    | Freshness: artifact no older than 24 hours                                                      | Yes (blocks) |

## Output Format

On success:

```
[validate-gitnexus] PASSED — 5/5 checks passed
[validate-gitnexus] Context: /path/to/docs/ai/context/gitnexus-context.json
```

On failure (stderr):

```
[validate-gitnexus] FAILED — 2 error(s) found
  [required-fields] Missing required field: "analysisMode"
  [freshness] gitnexus-context.json is 36h old (>24h). Run: bun run arch:gitnexus:context
```

## Remediation

| Error Step             | Fix                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `file-existence`       | Run `bun run arch:gitnexus:context`                                                           |
| `json-parse`           | Delete artifact and regenerate: `bun run arch:gitnexus:context`                               |
| `required-fields`      | Regenerate: `bun run arch:gitnexus:context`                                                   |
| `semantic-constraints` | Regenerate: `bun run arch:gitnexus:context`; if persists, check `scripts/gitnexus-context.ts` |
| `freshness`            | Run `bun run arch:gitnexus:context`                                                           |

## Schema Reference

The artifact must conform to `docs/ai/gitnexus-context.schema.json` (JSON Schema Draft-07).

Required fields:

- `schemaVersion` — string
- `generatedAt` — ISO 8601 timestamp
- `analysisMode` — `"changed-only"` | `"full"`
- `changedFiles` — string array (sorted)
- `impactedModules` — string array (sorted)
- `dependencyGraph` — object (module → deps array)
- `architectureLayerMap` — object (module → layer name)
- `recentCommits` — array of `{ hash, message, author, date }`
- `riskIndicators` — array of `{ module, riskScore, reason, affectedBy }`

## Adding to CI Workflow

In `.github/workflows/*.yml`, add a step after `arch:context`:

```yaml
- name: Validate GitNexus context artifact
  run: bun run arch:validate:gitnexus
```
