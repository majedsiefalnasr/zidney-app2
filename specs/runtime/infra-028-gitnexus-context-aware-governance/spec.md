# Spec: GitNexus Context-Aware Governance

**Stage:** INFRA-28 — GitNexus Context-Aware Governance
**Phase:** 01_PLATFORM_FOUNDATION
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_28_GITNEXUS_CONTEXT_AWARE_GOVERNANCE.md`
**Status:** DRAFT
**Date:** 2026-03-25

---

## Overview

This stage upgrades Zidney's governance system from **rule-based → context-aware enforcement** by promoting the existing `scripts/gitnexus-context.ts` script into a first-class, standardized `context:*` command surface and integrating it into the `governance:gate` pipeline established in INFRA-27.

Currently, `arch:gitnexus:context` generates a GitNexus context artifact (`docs/ai/context/gitnexus-context.json`) for AI orchestrators, but governance gate checks run against the full repository unconditionally. This causes false positives (checking unchanged modules), unnecessarily long CI runs, and limits the orchestrator's ability to make context-aware scoping decisions.

INFRA-28 addresses this by:

1. Creating a canonical `scripts/context/` directory with four typed Bun scripts
2. Registering four `context:*` commands in root `package.json`
3. Extending `governance:gate` to prepend `context:build` + `context:validate` before running guards
4. Providing scoped guard invocation based on the built context (changed files, impact graph)
5. Integrating `context:changed` into pre-commit and `context:validate` into CI

The stage must not replace or rewrite any existing guard. It is a composition and routing layer that feeds context into existing guards.

---

## Goals

- Establish `scripts/context/` as the canonical location for all GitNexus context scripts
- Register `context:build`, `context:changed`, `context:impact`, `context:validate` in root `package.json`
- Extend `governance:gate` to run `context:build` and `context:validate` as its first two steps
- Enable existing guards (`arch:guard`, `validate:scripts:runtime`) to receive scoped context via the built artifact
- Integrate `context:changed` into `.husky/pre-commit` for sub-second scope resolution
- Integrate `context:validate` into `.github/workflows/architecture-governance.yml` as a pre-gate integrity check
- Update the orchestrator to run `context:build` at Step 5 (Analyze) and pass context into skills
- All context outputs must be deterministic: same git state → same artifact
- Validate the existing `scripts/gitnexus-context.ts` is aliased/delegated to (not rewritten)

---

## Non-Goals

- Replacing or rewriting `scripts/gitnexus-context.ts` (existing artifact; wrap, do not rewrite)
- Implementing a full AI decision engine (deferred to a later stage)
- Connecting external context providers (e.g., remote dependency registries)
- Adding new governance guards not established in prior INFRA stages
- Database migrations or schema changes (pure tooling stage)
- Tenant isolation or license middleware changes

---

## Background

### What Exists (Pre-INFRA-28)

| Artifact                             | Location                                          | Owner Stage |
| ------------------------------------ | ------------------------------------------------- | ----------- |
| `scripts/gitnexus-context.ts`        | Generates `docs/ai/context/gitnexus-context.json` | INFRA-24    |
| `arch:gitnexus:context` script alias | `package.json`                                    | INFRA-24    |
| `arch:gitnexus:validate`             | Validates gitnexus-context.json schema            | INFRA-24    |
| `governance:gate`                    | Runs all guards unconditionally                   | INFRA-27    |
| `governance:gate:changed`            | Scoped changed-files variant                      | INFRA-27    |
| `arch:guard:changed`                 | Architecture guard scoped to diff                 | INFRA-11/16 |

### What Is Missing

- No canonical `context:*` command surface (current alias is `arch:gitnexus:context` — wrong domain prefix)
- No `scripts/context/` directory (scripts scattered under `scripts/`)
- `governance:gate` does not build or validate context before running guards
- No dedicated `context:changed` script for pre-commit scope extraction
- No `context:impact` script for dependency radius analysis
- No `context:validate` entry point separate from `arch:gitnexus:validate`

---

## User Stories

### US1 — Developer: Pre-Commit Context Scope (Priority: P1)

As a developer committing code, I want the pre-commit hook to resolve which files changed and surface only relevant governance violations, so that I receive fast, accurate feedback without false positives from unrelated modules.

**Why this priority**: Every commit touches this path. Eliminating false positives is the highest-value outcome of this stage.

**Independent Test**: Run `bun run arch:context:changed` after staging one file. Verify the output lists only that file (and its dependents). Then trigger the pre-commit hook and confirm the governance check completes in under 10 seconds.

**Acceptance Scenarios:**

1. **Given** a staged change to `packages/domain-core/src/license.ts`, **When** the pre-commit hook runs, **Then** `context:changed` resolves the changed file set and passes it to `arch:guard:changed` without scanning unmodified packages.
2. **Given** no staged changes, **When** `context:changed` is invoked, **Then** it exits with code `0` and outputs an empty changed-files list.
3. **Given** a malformed git state (no commits), **When** `context:changed` is invoked, **Then** it exits with code `1` and prints a clear diagnostic message.

---

### US2 — CI Pipeline: Context Integrity Before Gate (Priority: P1)

As a CI pipeline, I want `context:validate` to run before any guard in the governance gate, so that guards never operate on a stale or malformed context artifact.

**Why this priority**: A corrupt context artifact causes silent false-negatives in guards — undetected architecture violations.

**Independent Test**: Run `bun run arch:context:build` then manually corrupt `docs/ai/context/gitnexus-context.json`. Run `bun run arch:context:validate`. Confirm it exits with code `1` and describes the schema violation.

**Acceptance Scenarios:**

1. **Given** a clean repository with a fresh `context:build` run, **When** `context:validate` is invoked, **Then** it exits with code `0`.
2. **Given** a context artifact older than 24 hours, **When** `context:validate` is invoked, **Then** it exits with code `1` and emits a staleness diagnostic.
3. **Given** a context artifact with a missing required field (`changedFiles` absent), **When** `context:validate` is invoked, **Then** it exits with code `1` and names the missing field.

---

### US3 — Infrastructure Engineer: Dependency Impact Analysis (Priority: P2)

As an infrastructure engineer, I want `context:impact` to output a list of modules transitively affected by a change, so that I can assess blast radius before modifying shared infrastructure.

**Why this priority**: Impact analysis prevents undetected breakage in downstream modules; important but not blocking for daily commits.

**Independent Test**: Modify `packages/types/src/index.ts` (highly imported). Run `bun run arch:context:impact`. Verify the output includes all packages that import from `@zidney/types`.

**Acceptance Scenarios:**

1. **Given** a change to `packages/types`, **When** `context:impact` runs, **Then** it lists all packages and apps that transitively depend on `@zidney/types`.
2. **Given** a change to an isolated script with no dependents, **When** `context:impact` runs, **Then** the output lists only the changed file with an empty dependents set.
3. **Given** `--json` flag, **When** `context:impact` runs, **Then** the output is valid minified JSON matching the `RiskIndicator[]` schema in `scripts/gitnexus-context.ts`.

---

### US4 — Orchestrator: Context-Informed Reasoning at Step 5 (Priority: P2)

As the orchestrator executing a multi-step plan, I want `context:build` to run at Step 5 (Analyze) and produce a fresh artifact that skills can read, so that downstream decisions (which guards to run, which modules to inspect) are based on actual change scope rather than full-repo defaults.

**Why this priority**: Reduces orchestrator hallucination and unnecessary full-repo rescans during incremental work.

**Independent Test**: Using the orchestrator agent log, verify that Step 5 triggers `context:build`, that the artifact timestamp is updated, and that Step 6's `governance:gate:changed` reads from the same artifact.

**Acceptance Scenarios:**

1. **Given** an orchestrator session in Step 5, **When** `context:build` runs, **Then** `docs/ai/context/gitnexus-context.json` is written with a `generatedAt` timestamp within 5 seconds of the run.
2. **Given** an orchestrator session that skips Step 5, **When** governance:gate runs at Step 7, **Then** `context:validate` detects the stale artifact and fails the gate.
3. **Given** a `--dry-run` flag, **When** `context:build` runs, **Then** the artifact is printed to stdout and not written to disk.

---

### Edge Cases

- What happens when `docs/ai/context/ai-architecture-brain.json` does not exist when `context:build` runs? → Must fail gracefully with a diagnostic naming the missing upstream artifact and exit code `1`.
- What happens when `context:build` is called in a detached HEAD state (CI rebase)? → Must recover branch from `GITHUB_HEAD_REF` / `GITHUB_REF_NAME` env vars (same pattern as `scripts/ai-guard.ts`).
- What happens when two parallel CI jobs both run `context:build` simultaneously? → Writes are atomic (use write-then-rename). No partial reads.
- What happens when `context:validate` finds a schema version mismatch? → Emit a diagnostic with the found and expected version and exit `1`. Do not attempt auto-migration.
- What happens when `context:changed` returns 0 changed files (clean tree)? → Exit `0` with empty list. Downstream guards must treat empty list as "nothing to check" and also exit `0`.

---

## Functional Requirements

### FR-001 — `scripts/context/` Directory Structure

A `scripts/context/` directory MUST be created. It MUST contain exactly four implementation files:

| File                          | Purpose                             | Script Alias       |
| ----------------------------- | ----------------------------------- | ------------------ |
| `scripts/context/build.ts`    | Generate GitNexus context artifact  | `context:build`    |
| `scripts/context/changed.ts`  | Extract changed files from git diff | `context:changed`  |
| `scripts/context/impact.ts`   | Dependency impact analysis          | `context:impact`   |
| `scripts/context/validate.ts` | Validate context artifact integrity | `context:validate` |

All four files MUST be pure TypeScript targeting the Bun runtime. No framework imports (`apps/*` imports are forbidden per import boundary rules).

---

### FR-002 — `context:build` Script

`scripts/context/build.ts` MUST:

1. Delegate to the existing `scripts/gitnexus-context.ts` logic (call via `$` shell or `import`) — it MUST NOT duplicate the existing artifact generation logic.
2. Accept `--dry-run` flag: when set, print the artifact to stdout and do not write to `docs/ai/context/gitnexus-context.json`.
3. Accept `--all` flag: when set, generate a full-workspace scan (delegates to `--all` mode in `gitnexus-context.ts`).
4. Accept `--base-ref <ref>` flag: when set, compute diff against the specified git ref.
5. Exit code `0` on success, `1` on any failure.
6. Write the artifact atomically (write to a temp file then rename).

---

### FR-003 — `context:changed` Script

`scripts/context/changed.ts` MUST:

1. Read the `changedFiles` array from `docs/ai/context/gitnexus-context.json` if it exists and is fresh (< 5 minutes old).
2. If the artifact is absent or stale, invoke `git diff --name-only` against the appropriate base ref (staged changes for pre-commit, `HEAD` for CI).
3. Output the changed file list to stdout, one path per line.
4. Accept `--json` flag: when set, output a JSON array of strings instead of line-delimited paths.
5. Exit code `0` if changed files were resolved. Exit code `1` only on git invocation failure.
6. When the changed file set is empty, output an empty result and exit `0`.

---

### FR-004 — `context:impact` Script

`scripts/context/impact.ts` MUST:

1. Read the `dependencyGraph` and `changedFiles` from the context artifact.
2. Perform a breadth-first traversal of the dependency graph to compute all transitively affected modules from the changed file set.
3. Emit affected modules as one path per line on stdout.
4. Accept `--json` flag: output as JSON matching the `RiskIndicator[]` schema defined in `scripts/gitnexus-context.ts`.
5. Accept `--depth <n>` flag: limit traversal depth (default: unbounded).
6. Exit code `0` if analysis completes, regardless of whether affected modules were found. Exit code `1` on artifact read failure.

---

### FR-005 — `context:validate` Script

`scripts/context/validate.ts` MUST:

1. Read `docs/ai/context/gitnexus-context.json`.
2. Validate that all required fields are present: `schemaVersion`, `generatedAt`, `analysisMode`, `changedFiles`, `impactedModules`, `dependencyGraph`, `architectureLayerMap`, `recentCommits`, `riskIndicators`.
3. Validate `schemaVersion` is `"1.0.0"` (or the current version in `scripts/gitnexus-context.ts`).
4. Validate `generatedAt` is a valid ISO 8601 timestamp.
5. Fail with exit code `1` and a named diagnostic if the artifact is absent, any required field is missing, the schema version does not match, or `generatedAt` is older than 24 hours.
6. Exit code `0` if all checks pass.
7. This MUST NOT replace or alias `arch:gitnexus:validate` — both may coexist. `context:validate` is a superset that includes freshness checks.

---

### FR-006 — `package.json` Script Registration

Root `package.json` MUST register the following four entries in the `scripts` block:

```json
{
  "context:build": "bun run scripts/context/build.ts",
  "context:changed": "bun run scripts/context/changed.ts",
  "context:impact": "bun run scripts/context/impact.ts",
  "context:validate": "bun run scripts/context/validate.ts"
}
```

The existing `arch:gitnexus:context` and `arch:context` aliases MUST be preserved unchanged for backward compatibility. They MUST NOT be removed or redirected.

---

### FR-007 — Script Metadata Headers

All four `.ts` files under `scripts/context/` MUST include the 5-field metadata header required by the script-system-governance standard:

```
@script context:<action>
@domain context
@category governance
@description <one sentence>
@usage bun run context:<action>
```

The `context` domain must be treated as a new canonical domain. The script-system-governance skill file (`.agents/skills/script-system-governance/SKILL.md`) MUST be updated to add `context` as a recognized domain and `scripts/context/` to the Script Location Policy table.

---

### FR-008 — `governance:gate` Extension

`scripts/governance/gate.ts` MUST be updated to prepend two new steps before the existing guards:

```
Step 0: arch:context:build      — Generate fresh context artifact
Step 1: arch:context:validate   — Validate context artifact integrity
Step 2: arch:guard         (existing)
Step 3: validate:types     (existing)
Step 4: validate:scripts:runtime (existing)
Step 5: validate:scripts:usage    (existing)
Step 6: infra:security:ci        (existing)
Step 7: ai:context:validate      (existing)
```

If `context:build` or `context:validate` fail, the gate MUST exit immediately with code `1` and MUST NOT run the remaining guards (context integrity is a prerequisite). This is the only exception to the report-all behavior established in FR-011 of INFRA-27.

---

### FR-009 — `governance:gate:changed` Scoping Update

`governance:gate:changed` (defined in INFRA-27 as `arch:guard:changed && validate:scripts:runtime`) MUST be updated to prepend `context:changed` as an additional first step:

```
Step 0: arch:context:changed    — Resolve changed file scope
Step 1: arch:guard:changed (existing, reads context output)
Step 2: validate:scripts:runtime (existing)
```

The changed-files variant retains fail-fast semantics (short-circuit on first failure).

---

### FR-010 — Pre-Commit Integration

`.husky/pre-commit` MUST be extended to run `bun run arch:context:changed` before the `governance:gate:changed` invocation. The output of `context:changed` (a list of staged files) needs no explicit wiring — `governance:gate:changed` and `arch:guard:changed` read the shared context artifact file.

---

### FR-011 — CI Workflow Integration

`.github/workflows/architecture-governance.yml` MUST receive a new step positioned **before** the `Unified Governance Gate` step:

```yaml
- name: Build Context
  run: bun run arch:context:build

- name: Validate Context
  run: bun run arch:context:validate
```

These two steps replace any ad-hoc `arch:gitnexus:context` call that may already exist in the workflow. If no such call exists today, the steps are net-new additions.

---

### FR-012 — Orchestrator Integration

The orchestrator agent definition (`docs/AGENT_GOVERNANCE.md` or relevant orchestrator file) MUST be updated such that:

- **Step 5 (Analyze)**: runs `bun run arch:context:build` to generate a fresh artifact before skill invocation.
- **Step 6 (Implement — Pre-Execution)**: `governance:gate:changed` implicitly uses the step-5 artifact via `context:changed`.
- **Step 7 (Closure — Final Gate)**: `governance:gate` implicitly validates the artifact via `context:validate`.

The orchestrator MUST surface a normalized diagnostic if `context:build` fails at Step 5 (missing brain artifact, git failure, etc.).

---

### FR-013 — Determinism Guarantee

All four `context:*` scripts MUST be deterministic:

- Same git state + same brain artifact → same output artifact
- No randomness, no timestamps injected mid-logic (only at the final write step)
- No side effects on reads (`context:changed`, `context:impact`, `context:validate` are read-only; only `context:build` writes)
- `context:build` with `--dry-run` is side-effect-free

---

### FR-014 — Atomic Artifact Write

`context:build` MUST write the artifact atomically:

1. Write to a temp file (e.g., `gitnexus-context.json.tmp` in the same directory).
2. Rename to the target path once the write is complete.

This prevents partial artifact reads by concurrent processes.

---

### FR-015 — No Duplication of `gitnexus-context.ts` Logic

`scripts/context/build.ts` MUST delegate to `scripts/gitnexus-context.ts` rather than re-implementing context generation. Acceptable delegation strategies:

1. Import and call exported functions from `scripts/gitnexus-context.ts` directly.
2. Invoke `bun run arch:gitnexus:context` via `$` shell and propagate exit code.

Strategy (1) is preferred for type-safety. Strategy (2) is acceptable if `gitnexus-context.ts` does not export a callable function at the top level.

---

### FR-016 — `validate:scripts:runtime` Alignment

The new `scripts/context/*.ts` files MUST pass the `validate:scripts:runtime` (INFRA-25) check without exception. Specifically:

- Each file MUST have the `@script`, `@domain`, `@category`, `@description`, `@usage` header fields.
- Each `package.json` entry MUST match the file path exactly.
- No orphan scripts (files without a `package.json` entry).

---

## Non-Functional Requirements

### NFR-001 — Performance: `context:changed` Completion Time

`context:changed` MUST complete in under **2 seconds** on a standard developer machine for a typical diff of up to 50 changed files.

---

### NFR-002 — Performance: `context:build` Completion Time

`context:build` (changed-only mode) MUST complete in under **5 seconds** on a standard developer machine. Full mode (`--all`) MAY take longer and is not subject to this NFR.

---

### NFR-003 — Performance: `context:validate` Completion Time

`context:validate` MUST complete in under **1 second** (it is a JSON read + schema check with no external calls).

---

### NFR-004 — Idempotency

Running any `context:*` command multiple times with the same repository state MUST produce the same output and the same exit code. No state is accumulated between runs.

---

### NFR-005 — No New Runtime Dependencies

The `scripts/context/` implementation MUST use only:

- Bun built-ins (`bun:*`, `node:*` core APIs)
- Existing imports available in `scripts/gitnexus-context.ts`
- Zero new `package.json` dependencies added at the root workspace level

---

### NFR-006 — Security: No Shell Injection

Any CLI arguments passed to `context:*` scripts MUST be validated against an allowlist pattern before being passed to shell-executed commands (reference: `validateCliArg` pattern already in `scripts/gitnexus-context.ts`). Unrecognized flags MUST cause exit `1` with a diagnostic, not silent pass-through.

---

### NFR-007 — Backward Compatibility

- Existing `arch:gitnexus:context`, `arch:context`, and `arch:gitnexus:validate` script aliases MUST continue to work unchanged.
- The `gitnexus-context.json` artifact schema MUST NOT change. New fields may be added (additive), but existing required fields MUST NOT be removed or renamed.

---

## Acceptance Criteria

| ID    | Criterion                                                                                             | Verification                                           |
| ----- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| AC-01 | `scripts/context/` directory exists with all four `.ts` files                                         | `ls scripts/context/`                                  |
| AC-02 | All four `context:*` scripts are registered in root `package.json`                                    | `grep context: package.json`                           |
| AC-03 | All four scripts include 5-field metadata headers                                                     | `bun run validate:scripts:all` passes                  |
| AC-04 | `bun run arch:context:build` exits `0` and writes `docs/ai/context/gitnexus-context.json`             | Manual run + file check                                |
| AC-05 | `bun run arch:context:changed` exits `0` and outputs file list                                        | Manual run on a dirty tree                             |
| AC-06 | `bun run arch:context:impact` exits `0` and lists affected modules                                    | Manual run after a shared-package change               |
| AC-07 | `bun run arch:context:validate` exits `0` after a fresh `context:build`                               | Sequence test                                          |
| AC-08 | `bun run arch:context:validate` exits `1` on stale artifact (> 24h old)                               | Timestamp mutation test                                |
| AC-09 | `governance:gate` runs `context:build` + `context:validate` as first two steps                        | Inspect `scripts/governance/gate.ts`                   |
| AC-10 | `governance:gate` fails fast on `context:validate` failure (does not run subsequent guards)           | Unit test in `scripts/governance/`                     |
| AC-11 | `governance:gate:changed` runs `context:changed` as step 0                                            | Inspect `package.json` or `gate.ts`                    |
| AC-12 | `.husky/pre-commit` includes `bun run arch:context:changed`                                           | `cat .husky/pre-commit`                                |
| AC-13 | `.github/workflows/architecture-governance.yml` includes `context:build` and `context:validate` steps | YAML inspection                                        |
| AC-14 | Orchestrator agent spec updated with `context:build` at Step 5                                        | Inspect orchestrator definition file                   |
| AC-15 | `arch:gitnexus:context` still works after the stage is complete                                       | `bun run arch:gitnexus:context -- --dry-run` exits `0` |
| AC-16 | `bun run governance:gate` passes on a clean repository                                                | Full gate run                                          |
| AC-17 | `context:build --dry-run` does not write a file                                                       | Run + check `gitnexus-context.json` mtime unchanged    |
| AC-18 | Script-system-governance skill updated to include `context` domain                                    | Read skill file                                        |

---

## Out of Scope

- Replacing or modifying the logic in `scripts/gitnexus-context.ts` — it is a dependency, not a target
- Full AI decision engine (LLM-based gate decisions, score thresholds, dynamic rule injection)
- Context providers beyond git diff and architecture brain (no JIRA, no external SCA tools)
- Modifying any existing governance guard logic (arch:guard, validate:types, etc.)
- Database or schema changes
- New HTTP routes, tenant isolation logic, or license middleware
- UI changes in any app

---

## Dependencies

| Stage       | Artifact Required                                                     | Why                                     |
| ----------- | --------------------------------------------------------------------- | --------------------------------------- |
| INFRA-24    | `scripts/gitnexus-context.ts` (exists)                                | `context:build` delegates to it         |
| INFRA-24    | `docs/ai/context/gitnexus-context.json` schema                        | `context:validate` validates against it |
| INFRA-24    | `docs/ai/context/ai-architecture-brain.json`                          | Required input for `context:build`      |
| INFRA-25    | `validate:scripts:runtime` passes on all `scripts/context/*.ts` files | Script-system compliance                |
| INFRA-27    | `governance:gate` at `scripts/governance/gate.ts`                     | Extended by FR-008                      |
| INFRA-27    | `governance:gate:changed`                                             | Extended by FR-009                      |
| INFRA-11/16 | `arch:guard:changed`                                                  | Used inside `governance:gate:changed`   |

**All listed dependencies must exist and pass their own acceptance criteria before INFRA-28 implementation begins.**

---

## Risk Assessment

| Risk                                                                                                           | Likelihood   | Severity | Mitigation                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------- | ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context:build` delegates to `gitnexus-context.ts` but that script has no exported callable function           | **Resolved** | **Low**  | Strategy (1) confirmed: `assembleContext(options: AssembleOptions): GitNexusContext` is exported at line 318 of `gitnexus-context.ts` — direct import is the implementation path. Strategy (2) fallback no longer required. |
| Artifact staleness check (24h threshold in `context:validate`) triggers false failures in slow CI environments | Low          | Low      | Make threshold configurable via env var `CONTEXT_MAX_AGE_HOURS` (default: 24)                                                                                                                                               |
| Prepending `context:build` to `governance:gate` increases gate wall-clock time beyond acceptable limits        | Low          | Medium   | Profile `context:build` in changed-only mode; if > 5s, optimize or parallelize with first guard                                                                                                                             |
| Atomic write (temp + rename) fails on Windows CI runners                                                       | Very Low     | Low      | Not currently a concern (Zidney targets Linux CI), but document assumption                                                                                                                                                  |
| `governance:gate:changed` receives empty changed-files list and skips all guards silently                      | Low          | Medium   | Explicitly gate on empty list: treat empty as "skip guards" but log that no files changed, not as a silent pass                                                                                                             |

---

## Assumptions

1. ~~`scripts/gitnexus-context.ts` either exports callable functions or is invocable via `bun run arch:gitnexus:context` with flags propagated from `context:build`.~~ **Resolved (2026-03-25):** `assembleContext` and `AssembleOptions` are exported — Strategy (1) direct import is confirmed.
2. `docs/ai/context/ai-architecture-brain.json` is generated by INFRA-24 and present in the repository before `context:build` runs.
3. The Zidney CI environment is Linux-based and supports POSIX atomic file rename via `fs.renameSync`.
4. The orchestrator agent definition to update is located at `.agents/agents/zidney-orchestrator.agent.md` (or equivalent); the exact file path must be confirmed during implementation.
5. The `context` domain is not yet registered in the script-system-governance skill; registering it is an in-scope INFRA-28 deliverable.
6. The staleness threshold for `context:validate` defaults to 24 hours but should be overridable via an environment variable for local development flexibility.

---

## Clarifications

### Session 2026-03-25

- Q: How does `context:changed` differ from what `arch:guard:changed` already does, and is the double-invocation in pre-commit (FR-010 + FR-009) intentional? → A: They serve different roles. `arch:guard:changed` is an opaque guard that calls `git diff --cached` internally to scope its own validation. `context:changed` is a dedicated **shared context resolver** that caches the resolved changed-file set into `gitnexus-context.json` (< 5 min freshness) so all downstream steps in `governance:gate:changed` read the same source of truth without redundant git subprocess calls. The double call — once directly in the pre-commit hook (FR-010) and once inside `governance:gate:changed` (FR-009) — is intentional by design: the second call is a near-instant cache hit. FR-003 item 1 is authoritative: if the artifact is < 5 minutes old, `context:changed` returns the cached value immediately.

- Q: What exact output schema does `context:impact --json` produce? → A: `RiskIndicator[]`, matching the `export interface RiskIndicator { module: string; riskScore: number; reason: string; affectedBy: string[] }` type in `gitnexus-context.ts` (confirmed by `docs/ai/gitnexus-context.schema.json` `riskIndicators` schema). For BFS-computed transitives synthesize the fields as: `riskScore = BFS traversal depth`, `reason = "transitively affected via <direct_module>"`, `affectedBy = root changed file paths that triggered the traversal`. Without `--json`, output is one affected module path per line (stable-sorted). FR-004 item 4 is the canonical reference.

- Q: How does `context:validate` resolve its required field list and expected schema version — programmatic hardcoding or `docs/ai/gitnexus-context.schema.json`? → A: `docs/ai/gitnexus-context.schema.json` EXISTS and MUST be used as the authoritative source. `context:validate` reads the schema file's `required` array for the field list and the top-level `version` field (`"1.0.0"`) as the expected schema version against `artifact.schemaVersion`. No external JSON Schema library — validate using plain key enumeration (NFR-005 no-new-dependencies preserved). `SCHEMA_VERSION` is not exported from `gitnexus-context.ts` (`const`, not `export const`), so the schema file is the correct import path.

- Q: Can `context:build` use Strategy (1) direct import from `gitnexus-context.ts` given its exports? → A: YES — confirmed by code inspection. `gitnexus-context.ts` exports `assembleContext(options: AssembleOptions): GitNexusContext` at line 318, `AssembleOptions` interface, and all helper functions (`detectChangedFiles`, `mapFilesToModules`, `buildDependencyGraph`, `buildArchitectureLayerMap`, `computeRiskIndicators`). `context:build` MUST use Strategy (1): `import { assembleContext, AssembleOptions } from '../gitnexus-context.ts'`. The fallback risk in the Risk Assessment table (Strategy 2) is now resolved — update it to "Resolved / Strategy 1 confirmed". `SCHEMA_VERSION` is not exported; `context:build` does not need it since `assembleContext` sets it internally.

- Q: Is `context:build` a complete replacement for `arch:gitnexus:context`, a thin alias, or an independent superset wrapper? → A: `context:build` is an **independent superset wrapper**. It calls `assembleContext()` from `gitnexus-context.ts`, adds atomic write behavior (write-then-rename per FR-014), and carries the `context` domain metadata header. `arch:gitnexus:context` continues to point directly to `scripts/gitnexus-context.ts` unchanged — both coexist independently. The governance gate (`governance:gate`, `governance:gate:changed`) uses `context:build` exclusively going forward. Assumption 1 is now resolved: Strategy (1) is the implementation path.

---

## Risk Level

**Score: 1 — LOW**

| Factor                   | Points | Rationale                                                                                         |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| New table/column         | +0     | Pure tooling stage — no DB changes                                                                |
| Security-sensitive logic | +0     | Shell injection guard reuses existing `validateCliArg` pattern from `gitnexus-context.ts`         |
| Worker interaction       | +0     | No worker jobs involved                                                                           |
| Multi-tenant isolation   | +0     | No tenant logic; scripts operate at workspace level                                               |
| External API             | +0     | No external HTTP calls; reads from local git and JSON files only                                  |
| More than 10 tasks       | +1     | ~12 distinct deliverables: 4 scripts + 4 registrations + gate.ts + gate:changed + pre-commit + CI |
| More than 20 tasks       | +0     | Total < 20                                                                                        |
| New package dependency   | +0     | NFR-005 explicitly forbids new dependencies                                                       |
| **Total**                | **1**  | **LOW**                                                                                           |
