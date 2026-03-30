# Implementation Plan: GitNexus Context Integration and Agent Enablement

**Stage:** INFRA-024  
**Phase:** 01_PLATFORM_FOUNDATION  
**Branch:** `spec/infra-024-gitnexus-context-integration-and-agent-enablement`  
**Status:** PLAN COMPLETE  
**Planned:** 2026-03-18

---

## Technical Context

| Field            | Value                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Feature ID       | INFRA-024                                                                                                                              |
| Layer            | Infrastructure tooling (scripts, documentation, governance)                                                                            |
| DB changes       | None                                                                                                                                   |
| API changes      | None                                                                                                                                   |
| New packages     | `gitnexus` (devDependency, root `package.json`)                                                                                        |
| Modified scripts | `scripts/gitnexus-context.ts` (full replacement)                                                                                       |
| New scripts      | `scripts/validate/validate-gitnexus.ts`                                                                                                |
| New tests        | `tests/gitnexus-context.test.ts`                                                                                                       |
| New docs         | `docs/ai/gitnexus.md`, `docs/ai/gitnexus-context.schema.json`, `docs/scripts/gitnexus-context.md`, `docs/scripts/validate-gitnexus.md` |
| Modified files   | `AGENTS.md`, `.agents/agents/zidney-orchestrator.agent.md`, `package.json`                                                             |
| Trust chain      | Not applicable — infrastructure tooling only                                                                                           |
| Migration        | None required                                                                                                                          |

---

## Constitution Check

| Rule                                     | Status | Notes                                                                        |
| ---------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| Database-per-tenant isolation            | ✅ N/A | No database access at any point                                              |
| License middleware required for routes   | ✅ N/A | No API routes created or modified                                            |
| Schema + product version compatibility   | ✅ N/A | No schema_version changes                                                    |
| Attempt snapshot at start                | ✅ N/A | Attempt engine untouched                                                     |
| Server-authoritative time                | ✅ N/A | No time-sensitive runtime code                                               |
| No cross-tenant joins                    | ✅ N/A | No tenant data access                                                        |
| Worker-only grading                      | ✅ N/A | Worker not modified                                                          |
| Structured logging (no console.log)      | ✅ YES | All scripts must use `console.error` or `process.stdout.write` for JSON only |
| No secrets in output                     | ✅ YES | No credentials or tokens in any script                                       |
| Script governance (JSDoc, docs/, naming) | ✅ YES | All new/modified scripts comply                                              |
| Import boundary rules                    | ✅ YES | Scripts do not import from `apps/` or `packages/`                            |

**Pre-design verdict:** PASS — No constitutional violations detected.

---

## Phase 0: Research (Pre-Resolved)

All research was completed during Step 2 (Clarify) and Context7 MCP pre-plan lookup.

### Resolved Unknowns

| Unknown                                  | Resolution                                                                       | Ref     |
| ---------------------------------------- | -------------------------------------------------------------------------------- | ------- |
| GitNexus installation method             | `bun add -D gitnexus` (devDependency in root)                                    | RES-001 |
| GitNexus CLI output format               | Not structured JSON; use git commands + brain.json for data                      | RES-002 |
| Existing script replacement scope        | Full replacement — legacy brain-printing logic removed                           | RES-003 |
| Output file location                     | `docs/ai/context/gitnexus-context.json`                                          | RES-004 |
| `riskIndicators` object shape            | `{ module, riskScore: 0–100, reason, affectedBy: string[] }`                     | RES-005 |
| CI failure conditions                    | Fail only on non-zero exit, schema violation, or script error                    | RES-006 |
| `ai-architecture-brain.json` structure   | Fields confirmed: `modules`, `layers`, `dependencies`, `hotspots?`               | RES-007 |
| Existing `package.json` script conflicts | Keep `arch:context`, `arch:refresh`; add `gitnexus:context`, `gitnexus:validate` | RES-008 |
| Test strategy                            | Vitest + mocks; script exports testable functions                                | RES-009 |
| Architecture layer assignment            | Derived from brain `modules` + `layers` fields with prefix matching              | RES-011 |

**Output:** `research.md` — complete.

---

## Phase 1: Schema Design

**Prerequisites:** research.md complete  
**Produces:** `docs/ai/gitnexus-context.schema.json`, `data-model.md`

### 1.1 — JSON Schema Definition

Create `docs/ai/gitnexus-context.schema.json` with JSON Schema Draft-07.

**Required fields (9 fields: 6 data fields + 3 metadata fields):**

```
schemaVersion        string        "1.0.0"
generatedAt          string        ISO 8601 timestamp
analysisMode         string        "changed-only" | "full" — whether dependencyGraph is scoped to changed modules only or full workspace
changedFiles         string[]      relative file paths (may be empty)
impactedModules      string[]      module paths matching ^(apps|packages)/[a-z0-9-]+$
dependencyGraph      object        Record<module_path, module_path[]>
architectureLayerMap object        Record<module_path, layer_name>
recentCommits        object[]      [{hash, message, author, date}]
riskIndicators       object[]      [{module, riskScore, reason, affectedBy}]
```

**Schema constraints:**

- All 8 properties are `required`
- `changedFiles` items: `type: string`, no leading `/`
- `impactedModules` items: `type: string`, pattern `^(apps|packages)/`
- `dependencyGraph` additionalProperties: arrays of strings
- `architectureLayerMap` additionalProperties: enum of valid layer names
- `recentCommits` items: required `hash`, `message`, `author`, `date`; `hash` pattern `^[0-9a-f]{40}$`
- `riskIndicators` items: required `module`, `riskScore`, `reason`, `affectedBy`; `riskScore` type `number`, minimum `0`, maximum `100`
- `additionalProperties` at root level: omitted (not `false`) — allows schema extensibility, new fields can be added without breaking existing consumers

### 1.2 — Data Model Documentation

`data-model.md` — complete (written alongside research.md in this step).

### 1.3 — TypeScript Interfaces

The wrapper script exports these interfaces (used by tests):

```typescript
export interface RecentCommit {
  hash;
  message;
  author;
  date;
}
export interface RiskIndicator {
  module;
  riskScore;
  reason;
  affectedBy;
}
export interface GitNexusContext {
  schemaVersion;
  generatedAt;
  analysisMode: "changed-only" | "full";
  changedFiles;
  impactedModules;
  dependencyGraph;
  architectureLayerMap;
  recentCommits;
  riskIndicators;
}
```

### 1.4 — Test Fixtures

Create `tests/fixtures/gitnexus/` with:

- `mock-brain.json` — minimal valid ArchitectureBrain fixture (3 modules, 2 layers)
- `mock-git-changed.txt` — sample `git diff` output (2–3 file paths)
- `mock-git-log.txt` — sample `git log` output (3 commits)

---

## Phase 2: Core Implementation — Wrapper Script

**Prerequisites:** Phase 1 complete, `ai-architecture-brain.json` readable  
**Produces:** `scripts/gitnexus-context.ts` (full replacement)

### 2.1 — Script Architecture

The script is structured as a collection of **exported pure functions** + a `main()` entry point.

This enables direct unit testing without spawning a subprocess.

```
scripts/gitnexus-context.ts
├── JSDoc metadata header (@script, @domain, @description, @mode, @dependencies)
├── Type imports (internal interfaces)
├── detectChangedFiles(options): string[]
│     git diff --name-only HEAD~1 HEAD OR git status --porcelain
├── mapFilesToModules(files, brainModules): string[]
│     Maps file paths to module paths using prefix matching
├── buildDependencyGraph(modules, brain): Record<string, string[]>
│     Extracts dependency subgraph scoped to impacted modules
├── buildArchitectureLayerMap(modules, brain): Record<string, string>
│     Maps each module to its architecture layer
├── extractGitHistory(): RecentCommit[]
│     git log --format="%H|%s|%an|%ai" -10
├── computeRiskIndicators(modules, brain): RiskIndicator[]
│     Applies scoring heuristics (see RES-005)
├── checkGitNexusHealth(): { healthy: boolean; status: string }
│     Run: bun x gitnexus status; capture text output
├── assembleContext(options): GitNexusContext
│     Calls all above functions and assembles root object
└── main(): void
      Parse CLI args, call assembleContext, write JSON output
```

### 2.2 — CLI Arguments

| Argument               | Type   | Default                                 | Description                                            |
| ---------------------- | ------ | --------------------------------------- | ------------------------------------------------------ |
| `--changed-files-only` | flag   | false                                   | Only detect changed files; skip dep/arch analysis      |
| `--dry-run`            | flag   | false                                   | Print JSON to stdout, do NOT write output file         |
| `--output <path>`      | string | `docs/ai/context/gitnexus-context.json` | Override output file path                              |
| `--all`                | flag   | false                                   | Full-scan mode (analyze all modules, not just changed) |
| `--base-ref <ref>`     | string | `HEAD~1`                                | Base git ref for diff comparison                       |

### 2.3 — Error Handling

- `ai-architecture-brain.json` not found → `console.error` + `process.exit(1)` with actionable message: `"Run: bun run arch:audit"`
- `git` not available → `console.error` + `process.exit(1)`
- `gitnexus status` non-zero → `console.error` warning (non-fatal in dev; consider fatal in CI if `CI=true`)
- JSON parse failure on brain file → `console.error` + `process.exit(1)`
- Output directory not writable → `console.error` + `process.exit(1)`

### 2.4 — Output Behavior

- By default: writes minified JSON to `docs/ai/context/gitnexus-context.json`
- With `--dry-run`: writes pretty-printed JSON to stdout only (no file)
- No `console.log` usage anywhere in the script
- Structured error output to `console.error` on failure

### 2.5 — Determinism Guarantees (NFR-005)

- `changedFiles` sorted alphabetically (ascending)
- `impactedModules` sorted alphabetically
- `recentCommits` in chronological order (newest first, as returned by git log)
- `riskIndicators` sorted by `riskScore` descending, then `module` alphabetically
- `dependencyGraph` and `architectureLayerMap` keys sorted alphabetically

---

## Phase 3: Validation Script

**Prerequisites:** Phase 2 complete, schema file exists  
**Produces:** `scripts/validate/validate-gitnexus.ts`

### 3.1 — Script Architecture

```
scripts/validate/validate-gitnexus.ts
├── JSDoc metadata header (@script, @domain, @description, @mode, @dependencies)
├── Step 1: Load + validate schema file exists
├── Step 2: Run gitnexus-context.ts (via child_process or import)
│          → regenerates docs/ai/context/gitnexus-context.json
├── Step 3: Parse output JSON
├── Step 4: Schema structure validation (required keys, types)
├── Step 5: Field presence check (no undefined or null for required fields)
├── Step 6: Emit structured result to stdout
└── Exit: 0 (pass) | 1 (fail)
```

### 3.2 — Validation Steps in Detail

**Step 4 — Schema structure validation:**

- Checks each required field exists in the output
- Checks field types match schema (array, object, string)
- Does NOT require non-empty arrays — `changedFiles: []` is valid
- Checks `riskScore` values are integers in [0, 100] range
- Checks `hash` values match 40-char hex pattern

**Step 5 — Field presence check:**

- `schemaVersion` must be a non-empty string
- `generatedAt` must be a valid ISO 8601 string
- All 8 required top-level fields must be defined (not missing)

**Exit codes:**

- `0` — all validation steps passed (including valid empty arrays)
- `1` — any validation step failed
- `1` — script execution error (uncaught exception)

**Structured error output format (emitted to stderr on failure):**

```json
{
  "valid": false,
  "step": "schema_structure_validation",
  "error": "Missing required field: impactedModules",
  "field": "impactedModules"
}
```

---

## Phase 4: Test Harness

**Prerequisites:** Phase 2 complete  
**Produces:** `tests/gitnexus-context.test.ts`, `tests/fixtures/gitnexus/`

### 4.1 — Test Suite Structure

**File:** `tests/gitnexus-context.test.ts`  
**Framework:** Vitest  
**Pattern:** Import exported functions from `scripts/gitnexus-context.ts`; mock `execSync` and `readFileSync` using `vi.mock`.

### 4.2 — Required Test Cases (5)

**TC-001: Changed files detection**

```
Given: A mocked git diff output with 3 file paths
When:  detectChangedFiles() is called
Then:  Returns exactly those 3 file paths, sorted alphabetically
       Falls back to git status --porcelain if HEAD~1 doesn't exist
```

**TC-002: Dependency mapping accuracy**

```
Given: mock-brain.json fixture (apps/api imports packages/domain-core)
       Changed file: apps/api/src/routes/exam.ts
When:  buildDependencyGraph(["apps/api"], brain) is called
Then:  Returns { "apps/api": ["packages/domain-core", "packages/logger"] }
       Only returns dependencies for impacted modules, not full graph
```

**TC-003: Architecture mapping correctness**

```
Given: mock-brain.json fixture
       Impacted modules: ["apps/api", "packages/domain-core", "packages/logger"]
When:  buildArchitectureLayerMap(modules, brain) is called
Then:  Returns { "apps/api": "runtime", "packages/domain-core": "domain", "packages/logger": "infrastructure" }
```

**TC-004: Git history extraction**

```
Given: A mocked git log output with 3 commit entries
When:  extractGitHistory() is called
Then:  Returns an array of 3 RecentCommit objects
       Each object has all 4 required fields: hash, message, author, date
       hash is a 40-character string
       date is a valid ISO 8601 string
```

**TC-005: Output format stability (schema validation)**

```
Given: All mocked dependencies set up with valid data
When:  assembleContext(options) is called
Then:  Output satisfies all GitNexusContext interface requirements
       All 8 required fields are present
       No extra or missing top-level keys
       riskScore values are in [0, 100] range
       changedFiles array is sorted alphabetically
```

### 4.3 — Test Implementation Rules

- Use `vi.mock('node:child_process')` for `execSync`
- Use `vi.mock('node:fs')` for `readFileSync` / `existsSync`
- Fixture files under `tests/fixtures/gitnexus/` are read directly (no mocking needed for fixtures)
- No network calls
- No git state dependency — all git output is mocked
- Tests must pass on a clean git tree (no staged or unstaged changes)
- Tests must be deterministic on every run

---

## Phase 5: Orchestrator + AGENTS.md Integration

**Prerequisites:** Phase 1 complete (schema defined)  
**Produces:** Additions to `.agents/agents/zidney-orchestrator.agent.md`, `AGENTS.md`

### 5.1 — Orchestrator Integration (FR-005)

Add a **"Load GitNexus Context"** step to `.agents/agents/zidney-orchestrator.agent.md` at three points:

**Point 1 — Workflow start (before planning):**
Located in the **Deterministic Sources of Truth** section, add `gitnexus-context.json` as source #1a (before `ai-architecture-brain.json`).

Add a new subsection "GitNexus Context Bootstrap" immediately after the Deterministic Sources of Truth block:

```markdown
## GitNexus Context Bootstrap (Mandatory)

At every session start, the orchestrator MUST:

1. Execute: `bun run arch:gitnexus:context`
2. Verify output written to: `docs/ai/context/gitnexus-context.json`
3. Reference this file as the authoritative source for:
   - Which files changed in this session
   - Which modules are impacted
   - Dependency chain of impacted modules
   - Risk indicators for change validation

A stale `gitnexus-context.json` from a prior session MUST NOT be trusted.
Regeneration is mandatory at each orchestrator session start.

If context generation fails → STOP. Display error. Request manual resolution.
```

**Point 2 — During execution (Step 6 — Implement), add pre-implementation GitNexus refresh:**
Before 6.3-PRE Context7 lookup, add:

```markdown
### 6.2A — Refresh GitNexus Context

Execute: `bun run arch:gitnexus:context`

Use `docs/ai/context/gitnexus-context.json` to verify:

- Which modules are directly impacted by the task being implemented
- Whether the module being modified has a risk score above 50 (requires additional review)
```

**Point 3 — Before closure (Pre-Closure Guardian Validation, Section 6.6):**
Add GitNexus validation to the parallel guardian list:

```markdown
#### GitNexus Context Validation (Pre-Closure)

Execute: `bun run arch:gitnexus:validate`

BLOCK CLOSURE if:

- `gitnexus:validate` exits non-zero
- `docs/ai/context/gitnexus-context.json` does not reflect the current session's changes
- GitNexus context was not regenerated during this orchestrator session
```

### 5.2 — AGENTS.md Governance Rule (FR-012)

Add a new section to `AGENTS.md` titled **"GitNexus Context Usage Policy (Binding)"**:

```markdown
## GitNexus Context Usage Policy (Binding)

AI agents operating inside Zidney MUST use GitNexus context when:

1. **Evaluating changes in the codebase** — Before proposing any code modification,
   load `docs/ai/context/gitnexus-context.json` to understand the blast radius.

2. **Performing impact analysis** — Use `impactedModules` and `dependencyGraph` fields
   to trace what modules are affected by a given change.

3. **Making architecture decisions** — Cross-reference `architectureLayerMap` and
   `riskIndicators` before proposing structural modifications.

Execution mechanism: `bun run arch:gitnexus:context` (scripts/gitnexus-context.ts)

The auto-trigger behavior for GitNexus MCP (defined in the GitNexus MCP section above)
remains in effect. This policy adds the obligation to also execute the local context
generation script, which produces grounded, commit-level repository awareness beyond
what MCP tools provide.

Prohibited behaviors:

- Blind reasoning about change scope without loading GitNexus context
- Ignoring `riskIndicators` when modifying modules with riskScore > 50
- Using a stale `gitnexus-context.json` from a prior session without regenerating
```

---

## Phase 6: CI Gate + package.json Scripts

**Prerequisites:** Phases 2–3 complete  
**Produces:** `package.json` script additions, CI documentation reference

### 6.1 — package.json Script Additions

Two new script keys added to root `package.json`:

```json
"gitnexus:context": "bun scripts/gitnexus-context.ts",
"gitnexus:validate": "bun scripts/validate/validate-gitnexus.ts"
```

**Existing scripts that benefit from the replacement (preserved unchanged):**

```json
"arch:context": "bun scripts/gitnexus-context.ts",
"arch:refresh": "bun scripts/infra-audit.ts && bun scripts/gitnexus-context.ts"
```

### 6.2 — CI Gate Documentation

The CI gate `bun run arch:gitnexus:validate` must be documented. Reference from `docs/ci/` or create `docs/ci/gitnexus-validation.md` noting:

- Gate command: `bun run arch:gitnexus:validate`
- Failure conditions (non-zero exit, schema violation, script error)
- Pass condition (empty arrays are valid)
- Typical CI execution time: < 60 seconds (NFR-003)

**Note:** Actual CI YAML workflow changes are deferred if no `.github/workflows/` CI file currently defines a `validate-architecture` step that can be extended. The documentation reference is sufficient for this stage.

### 6.3 — `validate-runtime-scripts` Compliance

After adding new script keys, `bun run validate:scripts:all` must pass. The scripts follow `<domain>:<action>` naming:

- `gitnexus:context` ✅
- `gitnexus:validate` ✅ (follows `<domain>:<action>` format per script governance rules)

---

## Phase 7: Documentation

**Prerequisites:** Phases 2–4 complete  
**Produces:** `docs/ai/gitnexus.md`, `docs/scripts/gitnexus-context.md`, `docs/scripts/validate-gitnexus.md`

### 7.1 — `docs/ai/gitnexus.md` (FR-011)

Required sections (all 5 per AC-011):

1. **What GitNexus is and why Zidney uses it** — Intelligence layer overview, problem solved
2. **How to run GitNexus locally** — Step-by-step: ensure brain is fresh → `bun run arch:audit` → `bun run arch:gitnexus:context`
3. **Output structure** — Field-by-field reference with link to `docs/ai/gitnexus-context.schema.json`
4. **How the orchestrator uses GitNexus context** — Lifecycle: session start → implementation → closure
5. **Troubleshooting** — Common failures and resolutions (brain not found, git errors, empty output, schema mismatch)

### 7.2 — `docs/scripts/gitnexus-context.md`

Script documentation required by Zidney Script Governance (NFR-001, AC-014).

Covers: purpose, CLI arguments, output file, dependencies, example invocations, error codes.

### 7.3 — `docs/scripts/validate-gitnexus.md`

Script documentation for `validate-gitnexus.ts`.

Covers: purpose, validation steps, exit codes, error output format, CI integration instructions.

---

## Post-Design Constitution Check

| Rule                          | Status | Verification                                                              |
| ----------------------------- | ------ | ------------------------------------------------------------------------- |
| All scripts in `scripts/`     | ✅     | Both scripts at `scripts/` root or subdirectory                           |
| JSDoc headers mandatory       | ✅     | All new/modified scripts include required JSDoc fields                    |
| `<domain>:<action>` naming    | ✅     | `gitnexus:context`, `gitnexus:validate` follow `<domain>:<action>` format |
| `docs/scripts/` documentation | ✅     | Both scripts have corresponding doc files in Phase 7                      |
| No `console.log`              | ✅     | Only `process.stdout.write` and `console.error` used                      |
| Import boundaries respected   | ✅     | Scripts only import from `node:*` and `docs/ai/context/`                  |
| No secrets                    | ✅     | Git commands are all local; no tokens required                            |
| Tests required                | ✅     | 5 deterministic test cases planned                                        |
| AGENTS.md backward compatible | ✅     | All changes are additive insertions                                       |

**Post-design verdict:** PASS — Plan is architecture-compliant. Implementation authorized.

---

## File Creation Matrix

| File                                           | Action            | Phase |
| ---------------------------------------------- | ----------------- | ----- |
| `docs/ai/gitnexus-context.schema.json`         | CREATE            | 1     |
| `tests/fixtures/gitnexus/mock-brain.json`      | CREATE            | 1     |
| `tests/fixtures/gitnexus/mock-git-changed.txt` | CREATE            | 1     |
| `tests/fixtures/gitnexus/mock-git-log.txt`     | CREATE            | 1     |
| `scripts/gitnexus-context.ts`                  | FULL REPLACE      | 2     |
| `scripts/validate/validate-gitnexus.ts`        | CREATE            | 3     |
| `tests/gitnexus-context.test.ts`               | CREATE            | 4     |
| `.agents/agents/zidney-orchestrator.agent.md`  | MODIFY (additive) | 5     |
| `AGENTS.md`                                    | MODIFY (additive) | 5     |
| `package.json`                                 | MODIFY (additive) | 6     |
| `docs/ai/gitnexus.md`                          | CREATE            | 7     |
| `docs/scripts/gitnexus-context.md`             | CREATE            | 7     |
| `docs/scripts/validate-gitnexus.md`            | CREATE            | 7     |
| `docs/ci/gitnexus-validation.md`               | CREATE            | 6     |

---

## Risk Analysis

| Risk ID  | Description                                            | Likelihood | Impact | Mitigation                                                        |
| -------- | ------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------- |
| RISK-001 | GitNexus produces incorrect context                    | Medium     | High   | Schema validation in validate-gitnexus.ts + 5 deterministic tests |
| RISK-002 | `ai-architecture-brain.json` not present at runtime    | Low        | High   | Script exits with actionable error: `"Run: bun run arch:audit"`   |
| RISK-003 | Git commands fail in CI (shallow clone)                | Medium     | Medium | Fallback: from `HEAD~1` to `git status --porcelain` on error      |
| RISK-004 | Schema drift between wrapper output and schema file    | Low        | High   | validate-gitnexus.ts runs schema check in CI                      |
| RISK-005 | `bun x gitnexus` not found (package not installed)     | Low        | Low    | CI installs devDependencies; `gitnexus --help` is AC-001          |
| RISK-006 | Orchestrator integration conflicts with existing steps | Low        | Medium | Additive only — no steps removed or reordered (NFR-006)           |
| RISK-007 | Test flakiness from subprocess mocking                 | Low        | Medium | All git commands mocked with `vi.mock`; no live git state         |
| RISK-008 | `riskIndicators` hotspot field missing from brain      | Low        | Low    | Brain `hotspots` field access guarded with optional chaining      |

---

## Dependency Order

Implementation must follow this sequence to avoid blockers:

```
Phase 0 (research) → Phase 1 (schema) → Phase 2 (wrapper) → Phase 3 (validator) → Phase 4 (tests)
                                                                                     ↓
Phase 5 (orchestrator + AGENTS) can run in parallel with Phases 3-4 after Phase 1 is done
Phase 6 (package.json + CI docs) can run in parallel with Phase 5
Phase 7 (documentation) requires Phase 2 complete
```

Minimum sequential path: Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 7  
Phases 5 and 6 can be parallelized with Phases 3–4.

---

## Implementation Notes for speckit.implement

1. **Do not preserve legacy brain-printing logic** from the old `scripts/gitnexus-context.ts`. Full replacement — confirmed in Q1 clarification.

2. **Export functions** from `scripts/gitnexus-context.ts` so they can be unit-tested without subprocess. The `main()` function is the only entry point that writes files.

3. **Git shallow clone handling**: In CI environments, `git diff HEAD~1 HEAD` may fail if the repository was checked out with `--depth=1`. Add a try/catch that falls back to `git status --porcelain` for changed files detection.

4. **`bun x gitnexus status`**: This command returns human-readable text. Parse the output as a string for health check purposes only — do not attempt JSON.parse on it.

5. **Architecture layer derivation**: The `brain.json` does not contain explicit per-module layer assignments. Derive from `brain.modules` array and known prefix rules (see RES-011). The mapping must be hardcoded in the script as a named constant with a comment pointing to `docs/architecture/intelligence/ARCHITECTURE_MAP.json` as the authority.

6. **Schema file path**: The JSON Schema at `docs/ai/gitnexus-context.schema.json` is a design-time artifact (not loaded at runtime by the wrapper). Only `validate-gitnexus.ts` loads the schema at runtime for validation.

7. **`additionalProperties`** in the schema: Not set to `false` at root level — allows schema extensibility without breaking changes. Future fields can be added without invalidating existing consumers. Individual sub-objects (items within `recentCommits` and `riskIndicators`) use `additionalProperties: false` for strict inner validation.

8. **AGENTS.md sections are additive**: Insert new policy section without removing or reordering any existing content.

---

## Guardian Readiness Verdict

**Architecture compliance:** PASS  
**Constitution alignment:** PASS  
**Scope clarity:** PASS (all 12 FRs and 6 NFRs have concrete implementation approaches)  
**Risk mitigation:** PASS (all 8 identified risks have mitigations)  
**Dependency order:** PASS (no circular dependencies)  
**Test coverage:** PASS (5 deterministic test cases covering all FR-007 requirements)  
**CI gate:** PASS (validate-gitnexus exits 0 on empty arrays, non-zero on failures only)  
**Backward compatibility:** PASS (all AGENTS.md and orchestrator changes are additive)

## GUARDIAN READINESS: ✅ PASS

> Plan is complete, architecture-compliant, and ready for Step 4 — Tasks generation.
