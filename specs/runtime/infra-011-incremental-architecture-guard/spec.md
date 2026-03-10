# Specification: Incremental Architecture Guard

**Stage:** STAGE_INFRA_11  
**Phase:** 01_PLATFORM_FOUNDATION  
**Feature ID:** infra-011-incremental-architecture-guard  
**Status:** DRAFT  
**Initiated:** 2026-03-10

---

## Executive Summary

The **Incremental Architecture Guard** introduces a smart, change-aware architecture validation system that validates **only modules affected by a change** rather than scanning the entire Zidney monorepo on every commit.

This feature maintains strict architecture enforcement while dramatically reducing validation latency from 800–1000ms (full scan) to 50–200ms (incremental validation) for typical developer commits.

### Key Outcomes

- Pre-commit validation completes in **<200ms** (vs. current 800–1000ms)
- Architecture rules remain **strictly enforced**
- CI continues to run **full validation** for ultimate safety
- AI agents **cannot bypass** architecture restrictions
- Developers receive **architectural impact feedback** immediately

**Non-Technical Success Criteria:**

- Developers can commit code confident that their changes won't break architecture rules
- The feedback loop for architecture violations is <1 second
- CI validation coverage remains 100% while local validation is fast enough for daily use

---

## Feature Overview

### What is Being Built

The Incremental Architecture Guard is a **validation optimization system** that intelligently determines which modules need architecture validation based on Git changes. It consists of:

1. **Change Detection** – Identify files modified in the current commit
2. **Module Mapping** – Map changed files to their architecture modules
3. **Dependency Impact Resolution** – Determine all modules affected by the change
4. **Incremental Validation** – Run architecture checks only on impacted modules
5. **Smart Fallback** – Escalate to full validation when necessary
6. **Architecture Impact Report** – Provide visibility into what was validated

### Which Phase & Stage

- **Phase:** 01_PLATFORM_FOUNDATION (Platform stability and governance)
- **Stage:** STAGE_INFRA_11_INCREMENTAL_ARCHITECTURE_GUARD
- **Stage Directory:** `specs/runtime/infra-011-incremental-architecture-guard/`

### Integration Points

This feature integrates with existing architecture governance systems:

- **`ARCHITECTURE_MAP.json`** – Authoritative module registry and dependency metadata
- **`scripts/ai-guard.ts`** – Architecture validation engine (add `--incremental` and `--full` modes)
- **`scripts/infra-audit.ts`** – Dependency graph generation and module detection (provide graph cache)
- **`docs/ai/context/`** – Cache storage for dependency graph and architecture metadata
- **Husky pre-commit hooks** – Run incremental validation locally
- **CI pipeline** – Continue full validation in GitHub Actions
- **Git dependency tracking** – Reverse dependency graph for impact resolution

### Affected Systems

This feature **does not** introduce new systems. It optimizes existing ones:

- ✅ **Architecture Governance** – Enhanced with incremental validation
- ✅ **Pre-commit Hooks** – Integrated for fast local feedback
- ✅ **CI/CD Pipeline** – Continues to enforce full validation
- ✅ **AI Agent Compliance** – Remains impossible to bypass

### Does NOT Affect

- ❌ Database isolation (no changes to multi-tenancy model)
- ❌ License enforcement (no changes to middleware order)
- ❌ Attempt engine (no changes to grading or snapshots)
- ❌ Worker system (no changes to background jobs)
- ❌ Runtime (no changes to attempt execution)
- ❌ Frontoffice (no changes to student-facing UI)

---

## Constitutional Compliance Declaration

This specification is **fully compliant** with the Zidney Constitution v1.2.0:

✅ **No cross-tenant access** – This feature only validates code architecture; no database access occurs

✅ **No middleware bypass** – License and authentication middleware remain untouched

✅ **No grading changes** – Attempt engine and worker remain untouched

✅ **No direct DB instantiation** – No new database connections introduced

✅ **Snapshot integrity preserved** – Attempt snapshots remain immutable

✅ **Transaction boundaries unchanged** – No modifications to transaction handling

✅ **Version enforcement maintained** – Schema and product version checks unchanged

✅ **Layer separation maintained** – All changes are in governance scripts, not business logic

**Compliance Statement:** This feature is compliant with Zidney Constitution v1.2.0 — No violations detected.

---

## Problem Statement

### Current State

The Zidney monorepo currently performs **full architecture validation** on every commit:

```bash
bun scripts/ai-guard.ts  # scans entire repository
```

**Impact:**

- Validation latency: **800–1000ms** per commit
- Validation scope: **100% of modules** (all 5 apps + 8 packages = 13 modules)
- Developer feedback loop: Slow, interrupts workflow
- Pre-commit hooks fail due to timeout (if enforced)

### Motivation

In a growing monorepo, **most commits affect only 1–2 modules**:

```
Developer commits change:
  apps/mmc/src/views/products/ProductList.vue

Current validation:
  • Scans apps/api
  • Scans apps/backoffice
  • Scans apps/frontoffice
  • Scans apps/mmc          ← relevant
  • Scans apps/worker
  • Scans packages/* (8 modules)

Result: 12 unnecessary validations
```

### Business Impact

- Developers delay committing code (waiting for validation)
- Architecture governance feels "heavy" versus truly scalable
- AI agents wait for full scans before proceeding, slowing task execution
- Pre-commit enforcement becomes impractical due to latency

### Solution

Only validate modules **directly and transitively affected** by the change:

```
Changed: apps/mmc
Affected: apps/mmc (direct effect)
          + any modules that import from apps/mmc (transitive effect)

Validation scope: 2–3 modules instead of 13
Latency: 50–200ms instead of 800–1000ms
```

This maintains strict architecture enforcement while enabling fast developer feedback.

---

## Architecture Design

### Validation Pipeline

The Incremental Guard implements a **Change → Module → Impact → Validation** pipeline:

```
┌─────────────────────────────────────────────────────────────┐
│ Developer commits code                                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Detect Changed Files                                │
│ (pre-commit: git diff --cached --name-only)                 │
│ (CI/pre-push: git diff --name-only $(git merge-base ...))   │
│                                                              │
│ Output: [file paths] (empty list → exit 0 immediately)      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Map Files to Modules                                │
│ (Using ARCHITECTURE_MAP.json)                               │
│                                                              │
│ Output: [module identifiers]                                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Dependency Impact Resolution                        │
│ (Using cached ai-dependency-graph.json)                     │
│                                                              │
│ Output: [changed modules + all dependent modules]           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Incremental Validation                              │
│ (ai-guard.ts --incremental --modules <list>)               │
│                                                              │
│ Output: validation results, architecture impact report      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Smart Fallback (if needed)                          │
│ • ARCHITECTURE_MAP.json changed? → full validation          │
│ • dependency graph stale? → full validation                 │
│ • new module detected? → full validation                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Validation Complete                                         │
│ Exit code: 0 (pass) or 1 (fail)                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Step 1: Change Detection

**Input:** Git repository state  
**Output:** List of changed file paths  
**Implementation:**

The command is **context-dependent** — the correct form depends on where the guard runs:

```bash
# Pre-commit hooks: commit does not exist yet; use staged index
git diff --cached --name-only

# CI and pre-push: commit already exists; compare branch to main baseline
git diff --name-only $(git merge-base HEAD main)..HEAD
```

**Rules:**

- Pre-commit context uses the staging index (`--cached`); `HEAD` does not point to the new commit yet
- CI/pre-push context uses the merge-base approach to capture all commits on the branch
- If the changed files list is **empty** (e.g., `git commit --allow-empty`), validation exits immediately with code `0`; no modules are validated and the Architecture Impact Report records `modules_validated: 0`
- Baseline for CI/pre-push: merge-base with `main` branch

**Data Structure:**

```json
{
  "changed_files": [
    "apps/mmc/src/views/products/ProductList.vue",
    "packages/api-client/src/client.ts",
    "docs/architecture/ARCHITECTURE_MAP.json"
  ]
}
```

#### Step 2: Module Mapping

**Input:** Changed file paths  
**Output:** Changed module identifiers  
**Source:** `docs/architecture/intelligence/ARCHITECTURE_MAP.json`  
**Implementation:**

For each changed file, find the longest matching module prefix:

```javascript
// Pseudo-code
for (const file of changedFiles) {
  const module = ARCHITECTURE_MAP.modules.find((m) => file.startsWith(m.path));
  if (!module) {
    // File is outside any declared module (e.g. docs/, .github/, tooling/).
    // Silently skip — no validation scope, no error, no fallback triggered.
    skippedUnmappedCount++;
    continue;
  }
  changedModules.add(module.id);
}
```

**Unmapped File Behaviour:** Files whose paths do not match any `apps/*` or `packages/*` module prefix (e.g. `docs/`, `.github/`, `tooling/`) are silently skipped and do not contribute to the validation scope. The new-module fallback is triggered only when a **directory** under `apps/*` or `packages/*` exists on disk but is absent from `ARCHITECTURE_MAP.json` — not for arbitrary unmapped paths. The Architecture Impact Report must include a `skipped_unmapped_files` counter for observability.

**Data Structure:**

```json
{
  "changed_modules": [
    { "id": "apps/mmc", "type": "app", "layer": "frontoffice" },
    { "id": "packages/api-client", "type": "package", "layer": "domain" }
  ]
}
```

#### Step 3: Dependency Impact Resolution

**Input:** Changed modules  
**Output:** All affected modules (changed + dependents)  
**Source:** Cached `docs/ai/context/ai-dependency-graph.json`  
**Implementation:**

For each changed module, find all **dependent modules** (modules that import from it):

```javascript
// Pseudo-code
const affected = new Set(changedModules);

for (const module of changedModules) {
  const dependents = dependencyGraph.getReverseDependencies(module.id);
  for (const dependent of dependents) {
    affected.add(dependent);
  }
}
```

**Example:**

```
Changed: packages/domain-core

Reverse dependency graph shows:
  apps/api imports packages/domain-core ✓ affected
  apps/worker imports packages/domain-core ✓ affected
  packages/api-client imports packages/domain-core ✓ affected
  apps/backoffice does not import ✗ not affected

Affected modules: [packages/domain-core, apps/api, apps/worker, packages/api-client]
```

**Data Structure:**

```json
{
  "changed_modules": ["packages/domain-core"],
  "dependent_modules": ["apps/api", "apps/worker", "packages/api-client"],
  "validation_scope": ["packages/domain-core", "apps/api", "apps/worker", "packages/api-client"],
  "module_count": 4
}
```

#### Step 4: Incremental Validation

**Input:** Affected modules list  
**Output:** Validation results  
**Implementation:**

```bash
bun scripts/ai-guard.ts --incremental --modules apps/api,apps/worker,packages/domain-core,packages/api-client
```

**Validation Checks:**

For each affected module, validate against architecture rules:

- ✅ **Forbidden Dependency Check** – Module doesn't import from forbidden modules
- ✅ **Layer Violation Check** – All imports respect layering rules
- ✅ **Cross-Layer Import Check** – Lower layers don't import from higher layers
- ✅ **Circular Dependency Check** – No circular imports detected
- ✅ **Architecture Contract Compliance** – Module imports align with declared dependencies

**Output:**

```json
{
  "status": "pass" | "fail",
  "duration_ms": 156,
  "modules_validated": 4,
  "violations": [],
  "impact_report": {
    "changed_modules": ["packages/domain-core"],
    "affected_modules": ["apps/api", "apps/worker", "packages/api-client"],
    "validation_scope": 4,
    "validation_mode": "incremental"
  }
}
```

#### Step 5: Smart Fallback

**Purpose:** Detect conditions when incremental validation may be incomplete and escalate to full validation

**Fallback Triggers:**

The system automatically escalates to full validation if any of these occur:

| Condition                         | Reason                                                         |
| --------------------------------- | -------------------------------------------------------------- |
| `ARCHITECTURE_MAP.json` changed   | Module topology may have changed; must re-validate all modules |
| Dependency graph stale or missing | Impact resolution may be incomplete; must rescan               |
| New module detected               | Module may not be in ARCHITECTURE_MAP; must rescan all         |

These are the only conditions that require full re-validation. Other changes (code modifications, documentation updates, configuration file tweaks) do not affect architectural validity and do not require re-scanning the dependency graph.

**Implementation:**

```typescript
// After Step 3, before Step 4:

if (
  changedFiles.includes("ARCHITECTURE_MAP.json") ||
  changedFiles.includes("docs/architecture/*") ||
  dependencyGraphIsStale() ||
  newModuleDetected()
) {
  // Escalate to full validation
  return await runFullValidation();
}

// Otherwise, proceed with incremental validation
```

**Fallback Command:**

```bash
bun scripts/ai-guard.ts --full
```

> **Scope Note:** When the smart fallback triggers, full validation means **ALL modules declared in `ARCHITECTURE_MAP.json`** — not a larger-than-incremental subset. It is identical to what runs in CI. The Architecture Impact Report must set `validation_mode: "full"` and `modules_skipped: 0` when full validation runs via fallback.

### Guard Execution Modes

#### Incremental Mode

**When:** Pre-commit hooks, local development  
**Command:**

```bash
bun scripts/ai-guard.ts --incremental
```

**Behavior:**

- Detects changed files
- Maps to affected modules
- Validates only affected modules
- Returns immediately
- Escalates to full mode if triggers detected

**Performance Target:**

- 50–200ms for typical commits (1–2 modules changed)
- <500ms for large commits (5+ modules changed)

**Output:**

- Architecture validation result (pass/fail)
- Architecture Impact Report (modules validated)
- Error messages if violations found

#### Full Mode

**When:** CI pipelines, pre-push hooks, full audits  
**Command:**

```bash
bun scripts/ai-guard.ts --full
```

**Behavior:**

- Scans all modules in the repository
- Applies all architecture rules
- No shortcuts or optimizations
- Comprehensive validation coverage

**Performance Target:**

- <1000ms for current monorepo size
- Acceptable for CI (not blocking pre-commit)

**Output:**

- Complete validation results for all modules
- Full module dependency graph visualization
- Comprehensive architecture assessment

---

## Dependency Graph Cache System

### Motivation

Even incremental validation requires knowledge of module dependencies. Recomputing the dependency graph on every validation run introduces unnecessary overhead.

A **cached dependency graph** allows architecture validation to remain fast even as the monorepo grows.

### Cache File Location

```
docs/ai/context/ai-dependency-graph.json
```

**Generated by:**

```bash
bun scripts/infra-audit.ts --generate-graph
```

**Consumed by:**

```bash
bun scripts/ai-guard.ts --incremental
bun scripts/ai-guard.ts --full
```

### Cache Schema

```json
{
  "version": "1.0",
  "generated_at": "2026-03-10T14:30:00Z",
  "module_count": 13,
  "modules": [
    {
      "id": "apps/api",
      "type": "app",
      "layer": "api",
      "path": "apps/api",
      "imports": ["packages/domain-core", "packages/logger", "packages/types"]
    }
  ],
  "dependencies": [
    {
      "from": "apps/api",
      "to": "packages/domain-core",
      "count": 23
    }
  ],
  "reverse_dependencies": {
    "packages/domain-core": ["apps/api", "apps/worker", "packages/api-client"]
  }
}
```

### Cache Refresh Rules

The cache is automatically regenerated when:

| Condition                     | Detection                                                                          | Action                                |
| ----------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| New module added              | Directory `apps/*` or `packages/*` exists but not in ARCHITECTURE_MAP.json         | Run `infra-audit.ts --generate-graph` |
| ARCHITECTURE_MAP.json changed | File in git diff                                                                   | Run `infra-audit.ts --generate-graph` |
| Dependencies changed          | Import statement modifications detected                                            | Run `infra-audit.ts --generate-graph` |
| Cache missing                 | `ai-dependency-graph.json` not found                                               | Run `infra-audit.ts --generate-graph` |
| Cache stale                   | Generated >24 hours ago (default); override via `ARCH_GRAPH_MAX_AGE_HOURS` env var | Run `infra-audit.ts --generate-graph` |

**Implementation (in ai-guard.ts):**

```typescript
// Before validation, check if graph needs refresh
const shouldRefresh =
  changedFiles.some((f) => f.includes("ARCHITECTURE_MAP.json")) ||
  changedFiles.some((f) => f.includes("package.json")) ||
  !graphCacheExists() ||
  graphIsStale();

if (shouldRefresh) {
  await exec("bun scripts/infra-audit.ts --generate-graph");
}

const graph = loadGraphCache();
```

### Performance Impact

| Operation                         | Runtime   | Improvement       |
| --------------------------------- | --------- | ----------------- |
| Full dependency graph scan        | 300–800ms | baseline          |
| Cached graph reuse                | <10ms     | **96–99% faster** |
| Incremental validation with cache | 50–200ms  | **5–10x faster**  |

### Governance Rule

**Critical Rule:** AI agents must never directly edit the cached dependency graph (`ai-dependency-graph.json`).

The file must only be generated by:

```bash
bun scripts/infra-audit.ts
```

Manual modification would:

- Invalidate architecture guarantees
- Cause incomplete impact resolution
- Allow undetected architecture violations

---

## Architecture Impact Report

### Purpose

To improve visibility of architectural effects caused by changes, every validation run generates an **Architecture Impact Report**.

This report:

- Shows developers what was validated
- Provides AI agents with reasoning context
- Enables faster debugging of architecture issues
- Documents the validation scope for CI/CD

### Report Output Example

**Console Output:**

```
Architecture Impact Report
--------------------------

Changed modules:
  • packages/domain-core

Affected modules (reverse dependencies):
  • apps/api (4 imports from packages/domain-core)
  • apps/worker (2 imports from packages/domain-core)
  • packages/api-client (6 imports from packages/domain-core)

Validation scope:
  • 4 modules analyzed
  • 12 rules checked per module
  • 48 total checks performed

Validation mode:
  • incremental

Duration: 145ms
```

### Report JSON Output

When running in CI, the report is also written to:

```
docs/ai/context/architecture-impact-report.json
```

**Schema:**

```json
{
  "timestamp": "2026-03-10T14:32:00Z",
  "mode": "incremental" | "full",
  "git_context": {
    "branch": "feature/something",
    "commit_hash": "abc1234",
    "changed_files_count": 3
  },
  "analysis": {
    "changed_modules": ["packages/domain-core"],
    "affected_modules": ["apps/api", "apps/worker", "packages/api-client"],
    "validation_scope": 4,
    "modules_skipped": 9,
    "efficiency_ratio": 0.31
  },
  "validation": {
    "status": "pass" | "fail",
    "violations": [],
    "rules_checked": 48,
    "duration_ms": 145
  }
}
```

### Generation

The report is generated automatically by:

```bash
bun scripts/ai-guard.ts --incremental
bun scripts/ai-guard.ts --full
```

**Implementation:**

Both commands must output the report to stdout and, in CI context, write to the JSON file.

### CI Integration

When running in CI:

1. Generate the report (automatic)
2. Write to `docs/ai/context/architecture-impact-report.json`
3. Make available for PR annotations
4. Include in build artifacts for debugging

### Governance Rule

**Critical Rule:** The Architecture Impact Report must be generated for every validation run.

AI agents must **not suppress** this output because it is part of the architecture governance system.

---

## Integration Points

### Pre-Commit Hook Integration

**Hook File:** `.husky/pre-commit`
**Command:**

```bash
bun scripts/ai-guard.ts --incremental
```

**Behavior:**

- Runs automatically before each commit
- Fails the commit if violations detected (exit code 1)
- Passes silently if no violations (exit code 0)
- Reports architecture impact to developer

**Performance Requirement:** Complete within 200ms to avoid blocking workflow

### Pre-Push Hook Integration

**Hook File:** `.husky/pre-push`
**Command:**

```bash
bun scripts/ai-guard.ts --full
```

**Behavior:**

- Runs automatically before pushing to remote
- Performs comprehensive validation
- Fails push if violations detected
- Ensures all architecture rules enforced before code leaves developer machine

### CI/CD Pipeline Integration

**Pipeline File:** `.github/workflows/ci.yml`
**Step:**

```yaml
- name: Architecture Validation
  run: bun scripts/ai-guard.ts --full
```

**Behavior:**

- Runs on every pull request
- Performs full validation (no shortcuts)
- Blocks PR merge if violations detected
- Provides artifacts for debugging

**Enforcement:** PR cannot merge without passing full architecture validation

### Scripts Modified

#### `scripts/ai-guard.ts`

**New Features:**

- `--incremental` flag – enable incremental validation mode
- `--full` flag – enable full validation mode
- `--modules <list>` – validate only specified modules
- `--output json` – output architecture impact report as JSON
- Dependency graph cache integration
- Smart fallback detection and escalation

**Backward Compatibility:** Existing invocations continue to work (defaults to full mode)

#### `scripts/infra-audit.ts`

**New Features:**

- `--generate-graph` – regenerate and cache dependency graph
- `--refresh-graph` – update graph cache with latest changes
- Reverse dependency graph computation
- Cache generation and validation

**No Breaking Changes:** Existing functionality preserved

### New Files

**No new modules created.** All changes are within existing scripts and governance files.

**New Cache Files:**

- `docs/ai/context/ai-dependency-graph.json`
- `docs/ai/context/architecture-impact-report.json` (CI only)

---

## Acceptance Criteria

The Incremental Architecture Guard stage is **complete and ready for production** when:

### Functional Requirements

| ID  | Requirement                                   | Verification                                                               |
| --- | --------------------------------------------- | -------------------------------------------------------------------------- |
| F1  | `ai-guard.ts` supports `--incremental` mode   | `bun scripts/ai-guard.ts --incremental` completes in <200ms                |
| F2  | `ai-guard.ts` supports `--full` mode          | `bun scripts/ai-guard.ts --full` completes in <1000ms                      |
| F3  | Changed files map correctly to modules        | File paths in {apps,packages}/\* correctly identified to parent module     |
| F4  | Dependency impact resolution works            | Reverse dependencies accurately identified from cache                      |
| F5  | Smart fallback to full validation implemented | Fallback triggers on ARCHITECTURE_MAP.json change, graph stale, new module |
| F6  | Pre-commit runtime < 200ms                    | Average case: 2-module change validates in <200ms                          |
| F7  | Architecture Impact Report generated          | Report output produced for all validation runs                             |
| F8  | Dependency graph caching works                | Graph cache reuses <10ms, avoids 300-800ms scan                            |

### Performance Requirements

| Metric                          | Target  | Verification Method                                  |
| ------------------------------- | ------- | ---------------------------------------------------- |
| Pre-commit validation latency   | <200ms  | Time complete validation run with 1-2 module changes |
| Pre-push validation latency     | <1000ms | Time complete validation run with all modules        |
| Dependency graph cache hit time | <10ms   | Time to load and query cached graph                  |
| Average cache refresh time      | <500ms  | Time to regenerate graph from scratch                |
| CI full validation latency      | <1000ms | Measure in CI pipeline                               |

### Architectural Requirements

| Requirement                             | Verification                                            |
| --------------------------------------- | ------------------------------------------------------- |
| Backward compatibility maintained       | Existing scripts and configurations continue to work    |
| No new external dependencies introduced | Only uses existing tools (Bun, TypeScript, Node.js)     |
| No database access required             | Feature is purely file-system and code-analysis based   |
| No security implications                | Operates only on committed code, no credentials handled |
| Governance rules unchanged              | ARCHITECTURE_MAP.json structure preserved               |

### Deployment Requirements

| Deployment Phase  | Requirements                                 |
| ----------------- | -------------------------------------------- |
| **Pre-merge**     | All tests pass, no architecture violations   |
| **Merge to main** | No ongoing changes to ARCHITECTURE_MAP.json  |
| **Post-deploy**   | Verify pre-commit hooks execute in <200ms    |
| **Monitoring**    | Track validation latency, fallback frequency |

### Quality Assurance

| Test Type                    | Required | Coverage                                            |
| ---------------------------- | -------- | --------------------------------------------------- |
| Unit tests                   | Yes      | Change detection, module mapping, impact resolution |
| Integration tests            | Yes      | Full pipeline (git diff → validation → report)      |
| Performance tests            | Yes      | Latency targets for incremental and full modes      |
| Backward compatibility tests | Yes      | Existing scripts continue to work                   |
| Fallback trigger tests       | Yes      | All fallback conditions detected correctly          |

---

## Dependencies & Constraints

### External Dependencies

| System     | Dependency                    | Criticality                                       |
| ---------- | ----------------------------- | ------------------------------------------------- |
| Git        | `git diff`, `git merge-base`  | Critical – changed files detection depends on Git |
| Bun        | Runtime execution environment | Critical – scripts run via Bun                    |
| TypeScript | Type safety and compilation   | Critical – scripts written in TypeScript          |
| Node.js    | JavaScript runtime            | Critical – Bun depends on Node.js                 |

### Internal Dependencies

| Component                  | What it provides             | Criticality                                          |
| -------------------------- | ---------------------------- | ---------------------------------------------------- |
| `ARCHITECTURE_MAP.json`    | Module registry and metadata | Critical – defines validation scope                  |
| `ai-dependency-graph.json` | Cached module dependencies   | Critical – enables incremental validation            |
| `scripts/infra-audit.ts`   | Graph generation             | Critical – must support `--generate-graph`           |
| `scripts/ai-guard.ts`      | Validation engine            | Critical – must support `--incremental` and `--full` |
| `.husky/`                  | Git hooks                    | Important – integrates validation into workflow      |

### Constraints

#### Functional Constraints

| Constraint                                                   | Reason                                          |
| ------------------------------------------------------------ | ----------------------------------------------- |
| Can only validate modules in ARCHITECTURE_MAP.json           | Prevents validation of undeclared modules       |
| Must preserve backward compatibility                         | Existing workflows cannot break                 |
| Incremental mode must escalate to full when metadata changes | Ensures completeness when key files changed     |
| Dependency graph must be accurate                            | Incomplete graph = incomplete impact resolution |

#### Performance Constraints

| Constraint                                    | Reason                                       |
| --------------------------------------------- | -------------------------------------------- |
| Pre-commit validation must complete in <200ms | Cannot block developer workflow              |
| Pre-push validation must complete in <1000ms  | Reasonable timeout for comprehensive check   |
| Dependency graph cache must be <10MB          | File should be small and fast to load        |
| No new build steps introduced                 | Validation must run without additional setup |

#### Operational Constraints

| Constraint                               | Reason                                       |
| ---------------------------------------- | -------------------------------------------- |
| No secrets or credentials accessed       | Validation operates on code only             |
| No external service calls                | Validation must be deterministic and offline |
| No database access                       | Validation is build-time, not runtime        |
| No modification of ARCHITECTURE_MAP.json | Manual edits could invalidate cache          |

#### Development Constraints

| Constraint                                    | Reason                                     |
| --------------------------------------------- | ------------------------------------------ |
| TypeScript implementation required            | Consistency with existing scripts          |
| Must use existing architecture tool ecosystem | No new tools or frameworks introduced      |
| Tests required before merge                   | Prevents incomplete implementation         |
| Must document all new flags and behavior      | Developer experience critical for adoption |

---

## Out of Scope

Explicitly **NOT addressed** by this stage:

❌ **Runtime performance optimization** – This is build-time validation only  
❌ **New modules** – No new packages or apps created  
❌ **Database schema changes** – No schema modifications  
❌ **Architecture rule changes** – Existing rules remain unchanged  
❌ **Migration strategies** – Data migration not involved  
❌ **UI changes** – Frontoffice unaffected  
❌ **License enforcement changes** – Middleware order unchanged  
❌ **Attempt engine modifications** – Grading logic untouched  
❌ **Worker system changes** – Background jobs unaffected  
❌ **Cross-tenant logic** – Multi-tenancy isolation preserved

---

## Success Criteria

### User-Facing Success

✅ **Developers experience faster feedback** – Pre-commit validation completes in <200ms instead of 800-1000ms  
✅ **Architecture remains unbreakable** – Rules enforced consistently; impossible to bypass  
✅ **Confidence in code quality** – Architecture impact visible immediately after commit  
✅ **Reduced context switching** – Faster validation enables sustained focus on development

### Operational Success

✅ **Deployment velocity increased** – Faster pre-commit hooks enable more commits per hour  
✅ **CI quality maintained** – Full validation in CI ensures comprehensive coverage  
✅ **Monorepo sustainability** – System scales efficiently as modules grow  
✅ **AI agent compliance** – Validation cannot be bypassed programmatically

### Technical Success

✅ **50-200ms pre-commit validation** – Meets performance targets consistently  
✅ **Backward compatible** – Existing workflows unchanged  
✅ **Comprehensive test coverage** – Unit, integration, and performance tests included  
✅ **Zero false negatives** – Smart fallback prevents incomplete validation

---

## Implementation Assumptions

The following reasonable defaults are assumed:

1. **Start with incremental mode** – Pre-commit uses `--incremental` by default; full validation in CI
2. **Git main branch is authoritative** – Merge-base with `main` determines changed files
3. **All modules in ARCHITECTURE_MAP.json** – No undeclared modules exist in repository
4. **Dependency graph is accurate** – infra-audit.ts correctly identifies all dependencies
5. **Cache refresh on ARCHITECTURE_MAP.json change** – Fallback detects this automatically
6. **< 200ms is acceptable for pre-commit** – Matches industry best practices
7. **< 1000ms is acceptable for pre-push/CI** – Reasonable for comprehensive validation
8. **No changes to validation rules** – Same architecture rules applied, just more efficiently

---

## Next Steps

1. **Clarify Phase** (`/speckit.clarify`) – Review and address any ambiguities
2. **Plan Phase** (`/speckit.plan`) – Create detailed implementation tasks
3. **Implement Phase** – Develop and test the incremental guard system
4. **Validate Phase** – Verify against acceptance criteria
5. **Deploy Phase** – Release to pre-commit and CI/CD pipelines

---

## Clarifications

### Session 2026-03-10

- Q: Which git diff command should the pre-commit hook use — `git diff --name-only HEAD~1..HEAD`, `git diff --name-only $(git merge-base HEAD main)..HEAD`, or `git diff --cached --name-only`? → A: Pre-commit hooks must use `git diff --cached --name-only` because the commit has not been created yet and `HEAD` still points to the previous commit. CI and pre-push hooks use `git diff --name-only $(git merge-base HEAD main)..HEAD`. The `HEAD~1..HEAD` form previously shown in the pipeline diagram was incorrect and has been replaced.

  **Impact on implementation:** `ai-guard.ts --incremental` must detect its execution context (pre-commit vs. CI/pre-push) and select the correct git command. Detection is reliable via the `HUSKY` or `GIT_PARAMS` environment variables that Husky injects, or via an explicit `--context pre-commit|ci` flag.

- Q: Where is the 24-hour cache staleness threshold configured? → A: Via the environment variable `ARCH_GRAPH_MAX_AGE_HOURS` (default: `24`). No separate config file is required; reading directly from the environment aligns with the no-secrets-in-code policy and keeps configuration portable across developer machines and CI environments.

  **Impact on implementation:** The `graphIsStale()` helper reads `Number(process.env.ARCH_GRAPH_MAX_AGE_HOURS ?? 24)` when computing the staleness threshold. The cache table row has been updated to reflect this.

- Q: What happens when a changed file does not match any declared module prefix in `ARCHITECTURE_MAP.json` (e.g., files in `docs/`, `.github/`, `tooling/`)? → A: Unmapped files are silently skipped. They produce no validation scope and no error. The new-module fallback is triggered only when a **directory** matching `apps/*` or `packages/*` exists on disk but is absent from `ARCHITECTURE_MAP.json` — not for arbitrary unmapped file paths outside those prefixes.

  **Impact on implementation:** The module-mapping loop must handle a `null` module result gracefully (skip the file, no throw). The Architecture Impact Report must include a `skipped_unmapped_files` counter. The module mapping pseudo-code in the spec has been updated to reflect this null-safe handling.

- Q: When the smart fallback triggers, does "full validation" mean ALL modules or only a larger-than-incremental subset? → A: Full validation triggered by the smart fallback always means **ALL declared modules in `ARCHITECTURE_MAP.json`** — identical to what CI runs via `bun scripts/ai-guard.ts --full`. There is no intermediate "partial-full" mode.

  **Impact on implementation:** The fallback path calls `runFullValidation()` with no module filter. The Architecture Impact Report must set `validation_mode: "full"` and `modules_skipped: 0` when full validation runs via fallback. A note clarifying this has been added to the Smart Fallback section.

- Q: How should empty commits (`git commit --allow-empty`) and merge commits be handled by the change detection step? → A: Empty commits (staged diff produces an empty list) cause validation to exit immediately with code `0` — no modules to validate, no possible violations. The Architecture Impact Report must record `modules_validated: 0`, `status: "pass"`, and `validation_mode: "incremental"` in this case. Merge commits in CI are handled correctly by the `git merge-base HEAD main` approach, which resolves the common ancestor regardless of the number of parents; no special-casing is needed.

  **Impact on implementation:** Add a short-circuit check at the start of change detection: `if (changedFiles.length === 0) return earlyPassReport()`. The Component Step 1 rules have been updated to document this behaviour explicitly.

---

## Document Version History

| Date       | Status | Notes                                    |
| ---------- | ------ | ---------------------------------------- |
| 2026-03-10 | DRAFT  | Initial specification from stage outline |
| 2026-03-10 | DRAFT  | Clarifications session added (5 items)   |

---

**End of Specification**
