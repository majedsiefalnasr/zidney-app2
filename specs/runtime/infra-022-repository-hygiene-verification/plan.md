# INFRA-022 — Repository Hygiene Verification: Implementation Plan

Generated: 2026-03-16  
Branch: `spec/infra-022-repository-hygiene-verification`  
Research: `specs/runtime/infra-022-repository-hygiene-verification/research.md`

---

## Stage Alignment

- **Phase**: 01_PLATFORM_FOUNDATION
- **Stage**: STAGE_INFRA_22_REPOSITORY_HYGIENE_VERIFICATION
- **Related Spec File**: `specs/runtime/infra-022-repository-hygiene-verification/spec.md`
- **Related ADR**: None — no architectural changes; no ADR required or generated

Plan scope: verification scripts and a single committed report artifact only.

---

## Constitution Check

Validated against Zidney Constitution v1.2.0.

| Constraint                          | Status      | Notes                                                      |
| ----------------------------------- | ----------- | ---------------------------------------------------------- |
| No cross-tenant data access         | ✓ CONFIRMED | No DB access of any kind                                   |
| No middleware bypass                | ✓ CONFIRMED | No HTTP routes; no middleware touched                      |
| No direct DB instantiation          | ✓ CONFIRMED | Filesystem and subprocess reads only                       |
| No grading logic outside Worker     | ✓ CONFIRMED | No grading logic                                           |
| No weakening of snapshot integrity  | ✓ CONFIRMED | No attempt engine involvement                              |
| No weakening of version enforcement | ✓ CONFIRMED | No schema or product version changes                       |
| No layer boundary violation         | ✓ CONFIRMED | New scripts live under `scripts/dev/` — tooling layer only |

No ADR required. No constitution violation. Plan proceeds.

---

## Architectural Scope Confirmation

This is a **VERIFICATION-ONLY** stage. The implementation scope consists exclusively of:

1. Read-only Bun/TypeScript scripts that inspect filesystem, parse files, and spawn existing governance commands.
2. A single markdown report committed to `docs/reports/REPOSITORY_HYGIENE_REPORT.md`.
3. One new `package.json` script entry: `hygiene:report`.

**Explicitly out of scope:**

- No migrations (master or tenant DB)
- No API routes, middleware, or HTTP logic
- No frontend changes
- No Worker jobs
- No changes to `docs/architecture/`, ADRs, or governance documents
- No changes to `ROUTING_AUTHORITY_REGISTRY.md`
- No automatic deletion or destructive operations

---

## Implementation Layers

### Tooling Layer (Only Active Layer)

**Entry point**: `scripts/dev/hygiene-report-generator.ts`  
**Helper modules**: `scripts/dev/hygiene-checks/*.ts`  
**Output**: `docs/reports/REPOSITORY_HYGIENE_REPORT.md`  
**Package manager**: `bun`

All other layers (API, Worker, Frontend, MMC/Backoffice) are **not applicable** to this stage.

---

## Database Impact

**Master DB**: Not touched. No migration. No version bump.  
**Tenant DB**: Not touched. No migration. No `schema_version` change. No `product_version` impact.

---

## Transaction Design

No mutating database operations. All operations are read-only filesystem inspection and subprocess execution. No transactions required.

---

## New Files

| Path                                                                   | Purpose                             |
| ---------------------------------------------------------------------- | ----------------------------------- |
| `scripts/dev/hygiene-checks/types.ts`                                  | Shared `TaskResult` interface       |
| `scripts/dev/hygiene-checks/routing-authority-check.ts`                | T001 implementation                 |
| `scripts/dev/hygiene-checks/template-consolidation-check.ts`           | T002 implementation                 |
| `scripts/dev/hygiene-checks/dead-script-check.ts`                      | T003 implementation                 |
| `scripts/dev/hygiene-checks/dependency-hygiene-check.ts`               | T004 implementation                 |
| `scripts/dev/hygiene-checks/workspace-package-check.ts`                | T005 implementation                 |
| `scripts/dev/hygiene-checks/skill-surface-check.ts`                    | T006 implementation                 |
| `scripts/dev/hygiene-checks/ci-workflow-check.ts`                      | T007 implementation                 |
| `scripts/dev/hygiene-checks/ai-context-check.ts`                       | T008 implementation                 |
| `scripts/dev/hygiene-checks/arch-guard-check.ts`                       | T009 implementation                 |
| `scripts/dev/hygiene-report-generator.ts`                              | Orchestrator + report writer (T010) |
| `scripts/dev/hygiene-checks/__tests__/routing-authority-check.test.ts` | Unit test T001                      |
| `scripts/dev/hygiene-checks/__tests__/dead-script-check.test.ts`       | Unit test T003                      |
| `scripts/dev/hygiene-checks/__tests__/workspace-package-check.test.ts` | Unit test T005                      |
| `docs/reports/REPOSITORY_HYGIENE_REPORT.md`                            | Committed report artifact (T010)    |

### Modified Files

| Path           | Change                                                                           |
| -------------- | -------------------------------------------------------------------------------- |
| `package.json` | Add `"hygiene:report": "bun scripts/dev/hygiene-report-generator.ts"` to scripts |

---

## Shared Types

**File**: `scripts/dev/hygiene-checks/types.ts`

```typescript
export type TaskStatus = "PASS" | "FLAG" | "WARNING" | "SKIP" | "INCONCLUSIVE";

export interface TaskFinding {
  item: string;
  note: string;
}

export interface TaskResult {
  taskId: string; // e.g. "T001"
  title: string; // e.g. "Routing Authority Verification"
  status: TaskStatus;
  summary: string; // one-line summary for the report table
  findings: TaskFinding[];
  rawOutput?: string; // captured stdout/stderr from subprocess commands
}
```

---

## Task Implementation Strategies

### T001 — Routing Authority Verification

**File**: `scripts/dev/hygiene-checks/routing-authority-check.ts`

**Algorithm**:

1. Read `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` as text.
2. For each of the three routing surface pairs (agents, prompts, templates):
   - Identify the authoritative root and legacy root from the registry.
   - Confirm the authoritative root directory exists (`fs.existsSync`).
   - If the legacy root directory also exists, confirm it is classified as a legacy/compatibility surface in the registry (expected and correct per INFRA-21). Flag if legacy root files are NOT listed in the registry's retirement policy.
   - Check that no file declares the legacy root as authoritative (parse for `Authoritative Root:` marker).
3. Confirm each surface type has exactly one authoritative declaration.
4. Return `PASS` if all surfaces have their authoritative root resolving correctly; `FLAG` if any surface is missing its authoritative directory or if a legacy path is incorrectly marked authoritative.

**Inputs**: `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md`, filesystem dir scan  
**Outputs**: TaskResult with per-surface pair findings

**Known context from research** (R003): Both authoritative and legacy directories exist as expected. `.github/agents/`, `.github/prompts/`, and `.specify/templates/` are retained intentionally as compatibility surfaces. T001 is expected to return PASS for all three pairs.

---

### T002 — Template System Consolidation Check

**File**: `scripts/dev/hygiene-checks/template-consolidation-check.ts`

**Algorithm**:

1. From ROUTING_AUTHORITY_REGISTRY.md, identify canonical root (`specs/templates/`) and legacy root (`.specify/templates/`).
2. Scan these reference surfaces for legacy-root path mentions:
   - `.specify/scripts/bash/*.sh` — grep for `.specify/templates/` path strings
   - `.github/workflows/*.yml` — grep for `.specify/templates/` path strings
   - Root `AGENTS.md`, `apps/*/AGENTS.md`, `docs/**/*.md` — grep for `.specify/templates/`
3. For each match: record as "legacy template consumer still active".
4. Check for files present in `.specify/templates/` that have no corresponding file in `specs/templates/` (template parity gap).
5. Return `PASS` if no legacy consumers found and no parity gaps; `FLAG` with list of consumers if found.

**Inputs**: `.specify/scripts/bash/`, `.github/workflows/`, documentation tree, both template directories  
**Outputs**: TaskResult listing any legacy-path consumers

---

### T003 — Dead Script Detection

**File**: `scripts/dev/hygiene-checks/dead-script-check.ts`

**Algorithm**:

1. Enumerate all files matching `**/*.ts` and `**/*.sh` under `scripts/` (recursive).
2. Build the reference corpus:
   - Parse `package.json` scripts values (root only — workspace-level packages do not have cross-script references).
   - Read all `.github/workflows/*.yml` content; extract `run:` block text.
   - Read all `.md` files in `docs/`, root `AGENTS.md`, `apps/*/AGENTS.md`, `specs/**/*.md` — extract any line containing `scripts/` path fragments.
   - Read all `.sh` files in the corpus — extract any invocation of another script path.
   - Read stage artifact files in `specs/runtime/infra-022-*/`.
3. For each enumerated script file:
   - Check if its path (or basename) appears in any reference surface.
   - Classify as `ACTIVE` (referenced), `DUPLICATE_ROOT_STUB` (root-level file with identical-name subdir counterpart — see R006), or `POTENTIALLY_DEAD` (no reference found in any surface).
4. Do NOT delete any file. Report only.
5. Return results grouped as: ACTIVE, DUPLICATE_ROOT_STUBS (flag for human review), POTENTIALLY_DEAD (flag for human review).
6. TaskResult status: `FLAG` if any POTENTIALLY_DEAD or DUPLICATE_ROOT_STUB found; `PASS` if all scripts are clearly referenced.

**Known context from research** (R006): 16 root-level scripts are duplicates of same-name files in subdirectories. Root-level versions ARE referenced by package.json. Subdir canonical versions may or may not be referenced directly. T003 flags both sets for human review.

**Inputs**: `scripts/**/*.ts`, `scripts/**/*.sh`, `package.json`, `.github/workflows/`, `docs/**`, `AGENTS.md`, `apps/*/AGENTS.md`, `specs/**`  
**Outputs**: TaskResult with three groups (ACTIVE / DUPLICATE_ROOT_STUBS / POTENTIALLY_DEAD)

---

### T004 — Dependency Hygiene

**File**: `scripts/dev/hygiene-checks/dependency-hygiene-check.ts`

**Algorithm**:

1. Collect all workspace roots: repo root + all directories under `packages/` + all directories under `apps/`.
2. For each workspace root that has a `package.json`:
   a. Parse `dependencies` and `devDependencies`.
   b. Determine source file scan root (e.g. `src/` if it exists, else workspace root).
   c. Collect all `.ts`, `.tsx`, `.vue` source files under the scan root (excluding `node_modules`, `dist`, `.nuxt`).
   d. For each declared dependency, search for its import name across all source files using regex: `from ['"]<package-name>` or `require(['"]<package-name>`.
   e. Mark dependency as UNUSED if no source file imports it.
   f. Also identify DUPLICATE packages: packages installed at multiple workspace levels with different versions (compare root lock vs workspace declarations).
3. Group findings by workspace root.
4. Note: this check is advisory (FLAG), not FAIL. Some devDependencies are referenced in config files or scripts, not source — perform a broader text search for the package name as a fallback before marking UNUSED.
5. Leverage `scripts/dev/verify-dependency-usage.ts` by invoking it as a subprocess for workspaces where it is applicable; supplement with direct scanning for the rest.

**Inputs**: All workspace `package.json` files, source files under each workspace  
**Outputs**: TaskResult with per-workspace unused/duplicate dependency lists

---

### T005 — Workspace Package Validation

**File**: `scripts/dev/hygiene-checks/workspace-package-check.ts`

**Algorithm**:

1. Enumerate all directories under `packages/`; read each `package.json` to get the package name (e.g. `@zidney/api-client`).
2. For each package, check if it appears as a dependency in any `apps/*/package.json` (`dependencies`, `devDependencies`, or `peerDependencies`).
3. As secondary check: scan `apps/*/src/**/*.ts` and `apps/*/src/**/*.vue` for `import ... from '@zidney/<pkg-name>'`.
4. Mark as ACTIVE (has at least one app consumer) or ORPHANED (no consumer found).
5. Return `PASS` if all packages have at least one consumer; `FLAG` if any package is orphaned.

**Known context from research** (R004): 9 packages exist. All are expected to have consumers but this must be verified.

**Inputs**: `packages/*/package.json`, `apps/*/package.json`, `apps/*/src/**`  
**Outputs**: TaskResult with active/orphaned classification per package

---

### T006 — Skill Surface Validation

**File**: `scripts/dev/hygiene-checks/skill-surface-check.ts`

**Algorithm**:

1. Enumerate all immediate subdirectories of `.agents/skills/` (excluding `SKILLS_INDEX.md`).
2. For each directory:
   a. Check `SKILLS_INDEX.md` for mention of the directory name.
   b. Check root `AGENTS.md` for a reference to the skill path.
   c. Check each `apps/*/AGENTS.md` for references.
   d. Note: parent container directories (`aws-skills/`, `gitnexus/`) without a root `SKILL.md` are valid — the absence of `SKILL.md` at the parent level is expected and not a finding.
3. Flag directories that appear in neither SKILLS_INDEX.md nor any AGENTS.md.
4. Check for directories present in SKILLS_INDEX.md that do NOT exist as actual directories (stale index entries).
5. Return `PASS` if all directories are referenced; `FLAG` if any are unreferenced or if the index has stale entries.

**Inputs**: `.agents/skills/`, `.agents/skills/SKILLS_INDEX.md`, root `AGENTS.md`, `apps/*/AGENTS.md`  
**Outputs**: TaskResult with unreferenced skill directories and stale index entries

---

### T007 — CI Workflow Hygiene

**File**: `scripts/dev/hygiene-checks/ci-workflow-check.ts`

**Algorithm**:

1. Read all `.github/workflows/*.yml` files.
2. Extract all `run:` step commands (the text body of each step).
3. Normalize command strings (trim, collapse whitespace) for comparison.
4. Build a matrix: for each unique `run:` command, record which workflows contain it.
5. Flag duplicate `run:` commands appearing in more than one workflow file.
6. Additionally, compare `name:` step labels across workflows for semantic overlap (e.g., "Type check" appearing in multiple workflows).
7. Known overlaps from research (R007):
   - TypeScript type checking appears in both `ci.yml` and `ci-type-safety.yml`.
   - Type safety guard (`bun scripts/type-safety-guard.ts`) appears in both `architecture-governance.yml` and `ci-type-safety.yml`.
8. List candidates for consolidation; no changes made.
9. Return `FLAG` if duplicates found; `PASS` if all steps are non-redundant.

**Inputs**: `.github/workflows/*.yml`  
**Outputs**: TaskResult with duplicate step matrix and consolidation recommendations

---

### T008 — AI Context Integrity

**File**: `scripts/dev/hygiene-checks/ai-context-check.ts`

**Algorithm**:

```
1. Attempt: spawn `bun run ai:context:validate` from repo root.
2. Capture: stdout, stderr, exitCode.
3. Decision tree:
   - If spawn throws ENOENT or the process exits non-zero because the script file is missing:
       → status = SKIP
       → summary = "AI Context — Script Unavailable"
   - If process exits 0:
       → status = PASS
       → summary = "All artifacts passed validation"
   - If process exits non-zero AND the error output references actual artifact validation errors
     (mentions specific artifact files or malformed edges):
       → status = WARNING
       → summary = "Artifact validation errors found"
       → findings = parsed artifact error lines from output
4. The distinction between "missing script" and "actual validation error" is determined by:
   - Checking the stderr text for "Cannot find module" or "No such file" → SKIP
   - Exit code 1 with actual validation output → WARNING
```

**Note**: The `ai-context:validate` command maps to `bun scripts/generate-ai-context.ts --validate`. The script exists (confirmed in research R001). Expected outcome on a healthy repository: PASS.

**Artifacts validated by the script**:

- `docs/ai/context/ai-dependency-graph.json`
- `docs/ai/context/ai-module-map.json`
- `docs/ai/context/ai-layer-model.json` (canonical filename; spec references "ai-layer-map.json" but actual generated file is `ai-layer-model.json`)

**Inputs**: Result of `bun run ai:context:validate` subprocess  
**Outputs**: TaskResult with PASS / WARNING / SKIP status and captured output

---

### T009 — Architecture Guard Verification

**File**: `scripts/dev/hygiene-checks/arch-guard-check.ts`

**Algorithm**:

1. Spawn `bun run arch:guard` from repo root. Capture stdout, stderr, exitCode. Timeout: 120s.
2. Spawn `bun run arch:health` from repo root. Capture stdout, stderr, exitCode. Timeout: 120s.
3. For both commands:
   - If spawn fails (ENOENT): record "Command not found — script unavailable."
   - Capture all violation output.
4. Since this stage introduces **no code changes**, any violations found are **pre-existing by definition**.
5. Classification rule (per spec clarification):
   - Violations found → `DOCUMENT ONLY` — record under "Architecture Guard — Pre-existing Violations Found"
   - Status = `FLAG` (not `FAIL`) — stage completion is not blocked
6. If both commands exit 0 with no violations: status = `PASS`.

**Inputs**: `bun run arch:guard` and `bun run arch:health` subprocess results  
**Outputs**: TaskResult with guard output, health score, and any pre-existing violations documented

---

### T010 — Repository Hygiene Report

**File**: `scripts/dev/hygiene-report-generator.ts` (orchestrator + report writer)

**Algorithm**:

1. Import and invoke each check module (T001–T009) in sequence.
2. Collect all `TaskResult[]`.
3. Determine overall verdict:
   - `CLEAN` if all tasks are PASS or SKIP.
   - `ATTENTION REQUIRED` if any task is FLAG, WARNING, or INCONCLUSIVE.
4. Render markdown report (see Report Format section below).
5. Write to `docs/reports/REPOSITORY_HYGIENE_REPORT.md` (overwrite if exists).
6. Print summary to stdout.
7. Exit with code 0 (verification report generation succeeds regardless of findings — findings are purely informational).

**Package.json entry to add**:

```json
"hygiene:report": "bun scripts/dev/hygiene-report-generator.ts"
```

---

## Report Format Specification

**File**: `docs/reports/REPOSITORY_HYGIENE_REPORT.md`

```markdown
# Repository Hygiene Report

**Stage**: INFRA-022 — Repository Hygiene Verification  
**Generated**: <ISO timestamp>  
**Branch**: <git branch name>  
**Verdict**: CLEAN | ATTENTION REQUIRED

---

## Executive Summary

| Task | Description                    | Status            |
| ---- | ------------------------------ | ----------------- |
| T001 | Routing Authority Verification | PASS/FLAG         |
| T002 | Template System Consolidation  | PASS/FLAG         |
| T003 | Dead Script Detection          | PASS/FLAG         |
| T004 | Dependency Hygiene             | PASS/FLAG         |
| T005 | Workspace Package Validation   | PASS/FLAG         |
| T006 | Skill Surface Validation       | PASS/FLAG         |
| T007 | CI Workflow Hygiene            | PASS/FLAG         |
| T008 | AI Context Integrity           | PASS/WARNING/SKIP |
| T009 | Architecture Guard             | PASS/FLAG         |
| T010 | Report Generation              | PASS              |

---

## T001 — Routing Authority Verification

**Status**: PASS | FLAG  
**Summary**: <one-line summary>

### Findings

| Surface   | Authoritative Path   | Legacy Path                           | Registry Alignment |
| --------- | -------------------- | ------------------------------------- | ------------------ |
| agents    | `.agents/agents/` ✓  | `.github/agents/` (compatibility)     | ✓ aligned          |
| prompts   | `.agents/prompts/` ✓ | `.github/prompts/` (compatibility)    | ✓ aligned          |
| templates | `specs/templates/` ✓ | `.specify/templates/` (compatibility) | ✓ aligned          |

---

## T002 — Template System Consolidation

**Status**: PASS | FLAG  
**Summary**: <one-line summary>

### Findings

<list of legacy consumers found, or "No legacy template consumers detected.">

---

## T003 — Scripts Flagged for Review

**Status**: PASS | FLAG  
**Summary**: <N> scripts across <M> categories

### Active Scripts (referenced)

<bulleted list of scripts confirmed active in package.json / workflows / docs>

### Duplicate Root Stubs (flagged for human review)

These scripts exist at the root of `scripts/` AND in a subdirectory under `scripts/`. The root-level
versions are referenced by `package.json`. The subdirectory versions may be superseded copies.

| Root stub           | Subdir counterpart               |
| ------------------- | -------------------------------- |
| scripts/ai-guard.ts | scripts/architecture/ai-guard.ts |
| ...                 | ...                              |

### Potentially Dead Scripts (flagged for human review)

<bulleted list of scripts with no detected references in package.json, workflows, docs, or shell scripts>

---

## T004 — Dependency Hygiene

**Status**: PASS | FLAG  
**Summary**: <N> unused dependencies found across <M> workspaces

### Root (`package.json`)

<unused devDependencies list or "None found">

### packages/api-client

<unused dependencies list or "None found">

### packages/config

<...>

### apps/api

<...>

<!-- one section per workspace -->

---

## T005 — Workspace Package Validation

**Status**: PASS | FLAG

| Package            | Consumers Found                        | Status |
| ------------------ | -------------------------------------- | ------ |
| @zidney/api-client | apps/frontoffice, apps/backoffice, ... | ACTIVE |
| ...                | ...                                    | ...    |

<"No orphaned packages found." or list of orphaned packages>

---

## T006 — Skill Surface Validation

**Status**: PASS | FLAG

| Skill Directory | In SKILLS_INDEX.md | In AGENTS.md | Status |
| --------------- | ------------------ | ------------ | ------ |
| ai-terminal     | ✓                  | ✓            | ACTIVE |
| ...             | ...                | ...          | ...    |

<"No unreferenced or superseded skill directories found." or list of flagged dirs>

### Stale SKILLS_INDEX.md Entries

<entries in the index that have no corresponding directory, or "None found">

---

## T007 — CI Workflow Redundancy

**Status**: PASS | FLAG

### Duplicate Step Matrix

| Command / Step                     | Workflows                                       |
| ---------------------------------- | ----------------------------------------------- |
| `bun run typecheck`                | ci.yml, ci-type-safety.yml                      |
| `bun scripts/type-safety-guard.ts` | architecture-governance.yml, ci-type-safety.yml |
| ...                                | ...                                             |

### Consolidation Candidates

<list of workflow pairs recommended for consolidation, or "No overlapping steps found">

---

## T008 — AI Context Integrity

**Status**: PASS | WARNING | SKIP

<If SKIP:>
**AI Context — Script Unavailable**: `bun run ai:context:validate` could not be executed.
Reason: <captured error>
Stage completion is not blocked by this result.

<If PASS:>
All AI context artifacts passed structural validation.
Artifacts checked: ai-dependency-graph.json, ai-module-map.json, ai-layer-model.json

<If WARNING:>
Artifact validation errors detected. Stage completion is not blocked.
Findings:
- <artifact name>: <error description>
...

---

## T009 — Architecture Guard

**Status**: PASS | FLAG

### arch:guard Result

Exit code: <0 or N>  
<captured output summary>

### arch:health Result

Exit code: <0 or N>  
Health score: <score if available>  
<captured output summary>

### Architecture Guard — Pre-existing Violations Found

> All violations below are pre-existing (not introduced by this stage). They are documented for
> human review and do not block stage completion.

<list of violations, or "No violations found">

---

## T010 — Report Generation

**Status**: PASS  
**Artifact**: `docs/reports/REPOSITORY_HYGIENE_REPORT.md`  
**Committed**: Yes (tracked source control artifact)

---

## Overall Verdict: CLEAN | ATTENTION REQUIRED

<If ATTENTION REQUIRED:>
The following tasks require human review before final cleanup actions are taken:
- T00X: <reason>

No automated destructive operations were performed. All flagged items require explicit human approval before remediation.
```

---

## Testing Plan

### Unit Tests (required per spec)

Three unit test files covering the checks with the most deterministic internal logic:

**`scripts/dev/hygiene-checks/__tests__/routing-authority-check.test.ts`**  
Tests:

- Returns PASS when registry declares two surfaces and both authoritative dirs exist.
- Returns FLAG when an authoritative dir is missing on disk.
- Returns FLAG when the registry parser cannot find an `Authoritative Root:` entry for a surface.
- Does NOT flag a legacy dir that is correctly classified as compatibility surface.

**`scripts/dev/hygiene-checks/__tests__/dead-script-check.test.ts`**  
Tests:

- Classifies a script as ACTIVE when its path appears in package.json scripts value.
- Classifies a script as POTENTIALLY_DEAD when it appears in no reference surface.
- Classifies a script as DUPLICATE_ROOT_STUB when root-level file has same basename as a subdir file.
- Handles empty `scripts/` directory without throwing.

**`scripts/dev/hygiene-checks/__tests__/workspace-package-check.test.ts`**  
Tests:

- Returns PASS when all packages/ dirs appear as deps in at least one apps/ package.json.
- Returns FLAG with orphaned package name when a package has no consumers.
- Handles packages/ empty directory without throwing.

Tests use local fixture directories (not the real repo workspace files) for determinism.

---

## Agent Context Update

After plan/research generation, run:

```bash
bun .specify/scripts/bash/update-agent-context.sh copilot
```

This updates `.github/agents/copilot-instructions.md` (the compatibility output) with any new technology context introduced by this plan. Technology introduced by this stage:

- No new third-party packages (all checks use Node.js/Bun built-ins: `fs`, `path`, `Bun.spawn`)
- No new frameworks

The agent context update confirms zero new technology additions for this stage.

---

## Implementation Order

1. Create `scripts/dev/hygiene-checks/types.ts`
2. Create per-task check modules (T001–T009) in `scripts/dev/hygiene-checks/`
3. Create `scripts/dev/hygiene-report-generator.ts` (orchestrator + T010)
4. Add `"hygiene:report"` entry to root `package.json` scripts
5. Create unit test files
6. Run: `bun run dev:hygiene:report` — executes all checks, writes report
7. Commit `docs/reports/REPOSITORY_HYGIENE_REPORT.md` as tracked artifact
8. Run: `bun .specify/scripts/bash/update-agent-context.sh copilot`
9. Verify: `git diff --name-only` confirms no writes to `docs/architecture/` governance paths

---

## Safety Gates

Before marking stage complete:

- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] Unit tests pass (`bun run test`)
- [ ] `docs/reports/REPOSITORY_HYGIENE_REPORT.md` exists and contains all ten task sections
- [ ] Git diff confirms zero changes to `docs/architecture/`, ADR files, or `ROUTING_AUTHORITY_REGISTRY.md`
- [ ] No destructive operations were performed (no file deletions, no dependency removals)

Must ensure no race conditions per clarifications from this stage.

---

## Idempotency Plan

If endpoint mutates state:

- Idempotency key header used?
- Unique constraint used?
- Replay-safe?
- Duplicate submission safe?
- Worker deduplication strategy?

Mandatory for all operations where:

- Attempt submission
- License transitions
- Provisioning
- Payments
- Grading

---

## Version Enforcement Strategy

Must define:

- Where schema_version validated
- Where product_version validated
- What happens on mismatch (426)
- Backward compatibility strategy

No silent assumptions allowed.

---

## Authoritative Time Handling

If feature involves time:

- Server clock used?
- Expiration validation?
- Soft lock enforcement?
- Deadline enforcement?
- Reconnection grace logic?

Client time must never be used for authority.

---

## Observability & Logging

Plan must define:

- Structured log format
- request_id propagation
- workspace_slug propagation
- attempt_id propagation (if runtime)
- Error contract adherence
- Metrics emitted (if critical performance path)

No console logs allowed in production code.

---

## Rate Limiting

If applicable to this stage, plan must specify:

- Endpoint classification
- Rate limit thresholds
- Abuse mitigation
- Worker queue protection

---

## Failure Modes

Explicitly define (as applicable to this stage):

- DB unavailable
- Version mismatch
- License blocked
- Worker failure
- Duplicate request
- Timeout
- Queue backlog
- Partial transaction failure

Must define recovery path for each mode.

---

## Security Review

Confirm:

- RBAC enforcement server-side
- No role checks in frontend
- No secrets exposed
- JWT workspace scope enforced
- No sensitive data in logs

---

## Test Strategy

Plan must include:

- Unit tests
- Integration tests
- Isolation tests
- Transaction rollback test
- Idempotency test
- Version mismatch test
- Concurrency test (if runtime feature)

No implementation without defined tests.

---

## Rollback Strategy

Define:

- How feature can be safely rolled back
- Migration rollback plan
- Feature flag (if needed)
- Data integrity preservation

---

## Non-Goals

Explicitly list what is not included.

Prevents scope creep.

---

## Final Compliance Statement

The plan must end with:

“Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.”

If violation exists: Plan must stop and describe conflict.
