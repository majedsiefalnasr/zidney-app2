# validate-gitnexus

**Script:** `scripts/validate/validate-gitnexus.ts`  
**Domain:** gitnexus  
**Script key:** `gitnexus:validate`  
**Mode:** CLI

## Description

Validates the `gitnexus-context.json` artifact against the JSON Schema and performs structural
integrity and freshness checks. Designed to run as a CI gate after artifact generation and before
any downstream consumer (AI agent, architecture reporter, drift detector) processes the artifact.

## Usage

```bash
bun run gitnexus:validate
```

Exits with code `0` on success, `1` on any failure.

## Validation Pipeline

The script runs 5 sequential checks:

| Step | Name                   | Check                                                                  | Fatal? |
| ---- | ---------------------- | ---------------------------------------------------------------------- | ------ |
| 1    | `file-existence`       | Both `gitnexus-context.json` and `gitnexus-context.schema.json` exist  | Yes    |
| 2    | `json-parse`           | `gitnexus-context.json` is valid JSON                                  | Yes    |
| 3    | `required-fields`      | All 9 required fields present and correctly typed                      | Yes    |
| 4    | `semantic-constraints` | `analysisMode` enum; ISO timestamp; `riskScore` 0–100; SHA 40-char hex | Yes    |
| 5    | `freshness`            | Artifact generated within 24 hours                                     | Yes    |

## Output

On success (stdout):

```
[validate-gitnexus] PASSED — 5/5 checks passed
[validate-gitnexus] Context: /abs/path/to/docs/ai/context/gitnexus-context.json
```

On failure (stderr):

```
[validate-gitnexus] FAILED — 2 error(s) found
  [required-fields] Missing required field: "analysisMode"
  [freshness] gitnexus-context.json is 36h old (>24h). Run: bun run gitnexus:context

[validate-gitnexus] 3/5 checks passed
```

## Remediation

| Error step             | Remediation                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `file-existence`       | Run `bun run gitnexus:context`                                                                       |
| `json-parse`           | Delete artifact and run `bun run gitnexus:context`                                                   |
| `required-fields`      | Run `bun run gitnexus:context` to regenerate                                                         |
| `semantic-constraints` | Run `bun run gitnexus:context`; if persists, check schema alignment in `scripts/gitnexus-context.ts` |
| `freshness`            | Run `bun run gitnexus:context`                                                                       |

## Schema Reference

Validated against: `docs/ai/gitnexus-context.schema.json`

Required fields and their types:

| Field                  | Expected Type                |
| ---------------------- | ---------------------------- |
| `schemaVersion`        | string                       |
| `generatedAt`          | string (ISO 8601)            |
| `analysisMode`         | `"changed-only"` \| `"full"` |
| `changedFiles`         | array                        |
| `impactedModules`      | array                        |
| `dependencyGraph`      | object                       |
| `architectureLayerMap` | object                       |
| `recentCommits`        | array                        |
| `riskIndicators`       | array                        |

## Related

- `scripts/gitnexus-context.ts` — generates the artifact being validated
- `docs/ci/gitnexus-validation.md` — CI workflow integration guide
- `docs/ai/gitnexus.md` — full integration guide
- `docs/ai/gitnexus-context.schema.json` — JSON Schema (Draft-07)
