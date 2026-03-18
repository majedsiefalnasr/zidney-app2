# Data Model: GitNexus Context Integration and Agent Enablement

**Stage:** INFRA-024  
**Phase:** 01_PLATFORM_FOUNDATION  
**Status:** FINAL  
**Database Changes:** NONE

---

## Overview

This stage introduces **no database schema changes**. No migrations are required. No `schema_version` bump is required.

The data model for this stage is entirely composed of:

1. A **JSON output schema** (the structured artifact produced by `scripts/gitnexus-context.ts`)
2. **TypeScript type interfaces** used within the scripts and test harness

All data is transient (regenerated per session) and stored in read-only context files under `docs/ai/context/`.

---

## Primary JSON Output Schema

**File:** `docs/ai/gitnexus-context.schema.json`  
**Produced at:** `docs/ai/context/gitnexus-context.json`  
**Schema Version:** `1.0.0`

### Top-Level Structure

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://zidney.internal/schemas/gitnexus-context.schema.json",
  "title": "GitNexus Context",
  "description": "Structured repository intelligence context for AI agent consumption",
  "type": "object",
  "version": "1.0.0",
  "required": [
    "schemaVersion",
    "generatedAt",
    "analysisMode",
    "changedFiles",
    "impactedModules",
    "dependencyGraph",
    "architectureLayerMap",
    "recentCommits",
    "riskIndicators"
  ],
  "properties": {
    "schemaVersion": "string",
    "generatedAt": "ISO 8601 timestamp",
    "analysisMode": "\"changed-only\" | \"full\"",
    "changedFiles": "string[]",
    "impactedModules": "string[]",
    "dependencyGraph": "Record<string, string[]>",
    "architectureLayerMap": "Record<string, string>",
    "recentCommits": "RecentCommit[]",
    "riskIndicators": "RiskIndicator[]"
  }
}
```

---

## Entity Definitions

### Entity: `GitNexusContext` (root output object)

| Field                  | Type                       | Required | Description                                                                                                                                                 |
| ---------------------- | -------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`        | `string`                   | Yes      | Schema version. Always `"1.0.0"` for this release.                                                                                                          |
| `generatedAt`          | `string` (ISO 8601)        | Yes      | Timestamp of context generation.                                                                                                                            |
| `analysisMode`         | `"changed-only" \| "full"` | Yes      | Whether `dependencyGraph` is scoped to changed modules only (`"changed-only"`) or the full workspace (`"full"`). Set to `"full"` when `--all` flag is used. |
| `changedFiles`         | `string[]`                 | Yes      | Relative file paths changed since last commit or in working tree. May be empty.                                                                             |
| `impactedModules`      | `string[]`                 | Yes      | Module paths (e.g., `"packages/domain-core"`) that contain or own changed files. May be empty.                                                              |
| `dependencyGraph`      | `Record<string, string[]>` | Yes      | Map of module path → array of modules it imports. Scoped to impacted modules.                                                                               |
| `architectureLayerMap` | `Record<string, string>`   | Yes      | Map of module path → architecture layer name (`"infrastructure"`, `"domain"`, `"runtime"`, `"ui"`).                                                         |
| `recentCommits`        | `RecentCommit[]`           | Yes      | Last 10 commits from `git log`. May be empty on fresh repos.                                                                                                |
| `riskIndicators`       | `RiskIndicator[]`          | Yes      | Risk descriptors for impacted modules. May be empty.                                                                                                        |

**Validation rules:**

- `changedFiles`: paths must not start with `/`; must be relative to repo root
- `impactedModules`: values must match pattern `^(apps|packages)/[a-z0-9-]+$`
- `dependencyGraph`: keys must be module paths; values must be arrays of module paths
- All arrays may be empty — empty arrays are a valid output state
- `generatedAt` must be a valid ISO 8601 string

---

### Entity: `RecentCommit`

Represents a single git commit entry from `git log`.

| Field     | Type     | Required | Description                                         |
| --------- | -------- | -------- | --------------------------------------------------- |
| `hash`    | `string` | Yes      | Full commit SHA-1 hash (40 characters).             |
| `message` | `string` | Yes      | Commit subject line (first line of commit message). |
| `author`  | `string` | Yes      | Author name from `git log %an`.                     |
| `date`    | `string` | Yes      | ISO 8601 commit date from `git log %ai`.            |

**Source:** `git log --format="%H|%s|%an|%ai" -10`

**Validation rules:**

- `hash`: must be a 40-character hex string
- `message`: must be a non-empty string
- `date`: must be a valid ISO 8601 date-time string

**Example:**

```json
{
  "hash": "6493a7d6e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6",
  "message": "feat(infra): add gitnexus context wrapper script",
  "author": "Majed Sief Al-Nasr",
  "date": "2026-03-18T10:00:00+03:00"
}
```

---

### Entity: `RiskIndicator`

Represents a risk assessment for a module impacted by the current change set.

| Field        | Type       | Required | Description                                                         |
| ------------ | ---------- | -------- | ------------------------------------------------------------------- |
| `module`     | `string`   | Yes      | Module path identifier, e.g., `"packages/domain-core"`.             |
| `riskScore`  | `number`   | Yes      | Numeric risk score 0–100. Higher = more risky to change.            |
| `reason`     | `string`   | Yes      | Human-readable rationale for the risk score (AI agent consumption). |
| `affectedBy` | `string[]` | Yes      | Modules in the dependency chain that contribute to this risk.       |

**Risk scoring rules (deterministic):**

| Condition                                        | Score Contribution  |
| ------------------------------------------------ | ------------------- |
| Module has 0 dependents (`imported_by` is empty) | 0                   |
| Module has 1–2 modules depending on it           | +25                 |
| Module has 3–5 modules depending on it           | +50                 |
| Module has 6+ modules depending on it            | +75                 |
| Module appears in `brain.hotspots`               | +25 (capped at 100) |

**Validation rules:**

- `riskScore`: `number`, range [0, 100] — integer values only by convention; TypeScript has no integer type, so `number` is used with an integer-only contract
- `module`: must match pattern `^(apps|packages)/[a-z0-9-]+$`
- `affectedBy`: must be an array (may be empty if no dependents)

**Example:**

```json
{
  "module": "packages/domain-core",
  "riskScore": 75,
  "reason": "This module is imported by 5 other modules (apps/api, apps/worker, packages/validation, ...) and appears as an architecture hotspot.",
  "affectedBy": [
    "apps/api",
    "apps/worker",
    "packages/validation",
    "packages/api-client",
    "packages/types"
  ]
}
```

---

## TypeScript Interface Definitions

These interfaces are used within the scripts and tests. They are NOT exported to packages — they live within `scripts/` scope only.

```typescript
export interface RecentCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface RiskIndicator {
  module: string;
  riskScore: number;
  reason: string;
  affectedBy: string[];
}

export interface GitNexusContext {
  schemaVersion: string;
  generatedAt: string;
  /** Whether dependencyGraph is scoped to changed modules only or the full workspace. */
  analysisMode: "changed-only" | "full";
  changedFiles: string[];
  impactedModules: string[];
  dependencyGraph: Record<string, string[]>;
  architectureLayerMap: Record<string, string>;
  recentCommits: RecentCommit[];
  riskIndicators: RiskIndicator[];
}
```

---

## Script-Internal Types

### `ArchitectureBrain` (subset used by wrapper)

Represents the relevant portion of `docs/ai/context/ai-architecture-brain.json` consumed by the wrapper script.

```typescript
interface BrainModule {
  imports: string[];
  imported_by: string[];
  violations: string[];
}

interface BrainLayer {
  name: string;
  description: string;
  order: number;
}

interface BrainHotspot {
  module: string;
  score: number;
}

interface ArchitectureBrain {
  schema_version: string;
  generated_at: string;
  modules: string[];
  layers: BrainLayer[];
  dependencies: Record<string, BrainModule>;
  hotspots?: BrainHotspot[];
}
```

---

## File Relationships

```
docs/ai/gitnexus-context.schema.json          ← Schema definition (static, version-controlled)
docs/ai/context/gitnexus-context.json         ← Runtime output (generated, not version-controlled)
docs/ai/context/ai-architecture-brain.json    ← Input source (read-only by wrapper)
scripts/gitnexus-context.ts                   ← Producer of gitnexus-context.json
scripts/validate-gitnexus.ts                  ← Consumer + validator of gitnexus-context.json
tests/gitnexus-context.test.ts                ← Tests (uses fixtures, not live files)
tests/fixtures/gitnexus/                      ← Test fixtures (mock brain + mock git output)
```

---

## Fixture Data: Test brain.json (summary)

For deterministic testing, `tests/fixtures/gitnexus/mock-brain.json` will contain a minimal but structurally valid `ArchitectureBrain` with:

- 3 modules: `packages/domain-core`, `apps/api`, `packages/logger`
- 2 layers: `domain`, `runtime`, `infrastructure`
- `dependencies`: `apps/api` imports `packages/domain-core` and `packages/logger`; `packages/domain-core` is imported by `apps/api`
- 1 hotspot: `packages/domain-core` with score 80

This fixture enables deterministic testing of all 5 required test cases without git state dependency.

---

## State Transitions

```
[scripts/infra-audit.ts runs]
    → writes: docs/ai/context/ai-architecture-brain.json

[scripts/gitnexus-context.ts runs]
    → reads: docs/ai/context/ai-architecture-brain.json
    → reads: git diff / git log (local machine state)
    → writes: docs/ai/context/gitnexus-context.json

[scripts/validate-gitnexus.ts runs]
    → reads: docs/ai/gitnexus-context.schema.json
    → reads: docs/ai/context/gitnexus-context.json (or regenerates)
    → validates schema
    → exits 0 (pass) or non-zero (fail)
```

---

## Migration Requirements

**None.** No database schema changes. No `schema_version` bump. No migration files required.
