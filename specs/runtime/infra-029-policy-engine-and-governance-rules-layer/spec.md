# Feature Specification: Policy Engine and Governance Rules Layer

**Feature Branch**: `spec/infra-029-policy-engine-and-governance-rules-layer`
**Stage ID**: INFRA-29
**Phase**: 01_PLATFORM_FOUNDATION
**Created**: 2026-03-25
**Status**: Draft
**Stage File**: `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_29_POLICY_ENGINE_AND_GOVERNANCE_RULES_LAYER.md`

---

## Overview

This stage establishes a centralized Policy Engine that becomes the single source of truth for all governance rules across the Zidney monorepo. It replaces scattered, overlapping validation logic (`arch:guard`, `type-safety-guard`, `validate:*`, CI-embedded checks) with a unified, deterministic system reachable via `bun run policy:check`. All existing enforcement systems are wrapped by adapters and delegated through the engine — no enforcement logic lives outside of registered policy rules.

---

## Stage Lineage

| Predecessor | What it delivered                  | What it left incomplete               |
| ----------- | ---------------------------------- | ------------------------------------- |
| INFRA-26    | Trivy security scanning            | No unified rule registry              |
| INFRA-27    | Unified governance execution gates | Rule definitions still distributed    |
| INFRA-28    | GitNexus context-aware governance  | Context available but no policy model |

INFRA-29 closes the gap: unified rule definition, unified execution, single entry point.

---

## User Scenarios & Testing

> For this infrastructure stage, "users" are platform engineers, the CI pipeline, Husky hooks, and the orchestrator agent. User stories are expressed as engineering workflows.

---

### User Story 1 — Single Command Governance Check (Priority: P1)

A platform engineer or CI system needs to validate the entire monorepo or a set of changed files against all registered governance rules without needing to know which individual scripts to call.

**Why this priority**: This is the core transformation of the stage. All other stories depend on this unified entry point existing and being correct.

**Independent Test**: Can be tested by running `bun run policy:check --full` against the repository and confirming that it exits non-zero when a known violation exists and zero when none exist — without requiring any other story to be complete.

**Acceptance Scenarios**:

1. **Given** the policy engine is installed, **When** a developer runs `bun run policy:check --full`, **Then** all registered rules across all domains are evaluated, results are output to the console, and the process exits with code 1 if any error-severity violations are found.
2. **Given** the policy engine is installed, **When** a developer runs `bun run policy:check --changed`, **Then** only rules relevant to files changed since the last commit are evaluated, and evaluation completes in under 2 seconds.
3. **Given** no violations exist in the codebase, **When** `bun run policy:check --full` runs, **Then** the process exits with code 0 and outputs a clean confirmation message.
4. **Given** a warning-severity violation exists, **When** `bun run policy:check --full` runs, **Then** the process still exits with code 0 but the warning is surfaced in the output.

---

### User Story 2 — Pre-Commit Governance Enforcement (Priority: P1)

A developer making a commit must receive fast, scoped governance feedback without waiting for a full repository scan.

**Why this priority**: Developer-loop speed is critical. A slow pre-commit hook breaks developer workflow and leads to bypassing hooks.

**Independent Test**: Can be tested by making a commit that introduces a known violation (e.g., a script naming violation), verifying the commit is blocked, and confirming the hook completes under 2 seconds on a scoped set of changed files.

**Acceptance Scenarios**:

1. **Given** a developer stages files that violate a policy rule, **When** they attempt `git commit`, **Then** the Husky pre-commit hook runs `bun run policy:check --changed`, surfaces the violation, and blocks the commit.
2. **Given** a developer stages files with no violations, **When** they attempt `git commit`, **Then** the hook completes in under 2 seconds and the commit proceeds.
3. **Given** only non-governed files are staged (e.g., markdown docs), **When** a commit is attempted, **Then** the policy check evaluates zero applicable rules and exits immediately.

---

### User Story 3 — Orchestrator Integration (Priority: P2)

The orchestrator agent uses the policy engine API programmatically during pre-commit diagnostics and stage closure gates — it does not implement any independent governance logic.

**Why this priority**: Required for hard mode workflow compliance. The orchestrator cannot implement or duplicate any governance logic; it must delegate entirely.

**Independent Test**: Can be tested by invoking the orchestrator's closure gate for a stage with known violations, confirming the gate calls `policyEngine.check(context)` and blocks closure when errors are returned.

**Acceptance Scenarios**:

1. **Given** the orchestrator reaches a stage closure gate, **When** it calls `policyEngine.check(context)`, **Then** the engine evaluates all rules in scope and returns a `PolicyResult[]` array with no side-effects.
2. **Given** the policy engine returns one or more error-severity results, **When** the orchestrator receives the response, **Then** it halts the workflow step and surfaces the violations without re-evaluating them independently.
3. **Given** the orchestrator runs precommit-diagnostics, **When** it delegates to the policy engine, **Then** no validation logic is executed outside of registered policy rules.

---

### User Story 4 — Adapter-Based Migration of Existing Guards (Priority: P2)

Existing governance tools (`arch:guard`, `type-safety-guard`, `script-system-governance`, Trivy) continue to work but route their execution through the policy engine adapter layer — preserving outcomes while unifying entry points.

**Why this priority**: Adapter-first strategy is non-negotiable per the stage contract. Legacy tools must not be removed before adapters fully replicate their behavior.

**Independent Test**: Can be tested by running both the legacy tool and its adapter equivalent on the same codebase state and confirming identical violation output.

**Acceptance Scenarios**:

1. **Given** an architecture violation detectable by `arch:guard`, **When** `bun run policy:check --full` runs, **Then** the same violation is reported via the architecture-guard adapter.
2. **Given** a type-safety violation detectable by `type-safety-guard`, **When** the policy check runs, **Then** the violation appears in results with the correct domain tag (`types`) and severity.
3. **Given** a Trivy vulnerability is present, **When** the policy check runs with the security domain in scope, **Then** the Trivy adapter surfaces it as a `security` domain `PolicyResult`.
4. **Given** all four adapters are active, **When** a full policy check runs, **Then** no legacy tool is invoked directly by CI or the orchestrator outside of the engine.

---

### User Story 5 — Script System Unification (Priority: P2)

Platform engineers need all scripts to follow a unified naming convention, have a single authoritative definition, and be documented — with duplicates detected and removed.

**Why this priority**: Script sprawl is a direct cause of governance failures. Normalizing the script system is a prerequisite for deterministic policy enforcement.

**Independent Test**: Can be tested by running `bun run policy:check --full` on the current repo and confirming that all detected script naming violations are reported, and after remediation no violations remain.

**Acceptance Scenarios**:

1. **Given** a script exists in `package.json` that does not follow `<domain>:<action>[:scope]` naming, **When** the policy check runs, **Then** a warning or error is reported identifying the script and the expected format.
2. **Given** two or more scripts with identical or equivalent purpose exist, **When** the policy check runs, **Then** a duplicate-script violation is reported.
3. **Given** a script in `package.json` references a file path that does not resolve under `/scripts/`, **When** the policy check runs, **Then** a broken-reference violation is reported.
4. **Given** a script is defined and used only in `package.json` but has no entry in `docs/scripts/`, **When** the policy check runs, **Then** a documentation gap warning is reported.

---

### User Story 6 — JSON Reporting for CI Consumption (Priority: P3)

CI pipelines and audit tools need machine-readable output from policy checks to integrate results into dashboards, reports, and status checks.

**Why this priority**: Enables downstream tooling but does not block core governance enforcement.

**Independent Test**: Can be tested by running `bun run policy:check --full --reporter=json` and validating the output matches the `PolicyResult[]` schema.

**Acceptance Scenarios**:

1. **Given** violations exist, **When** `--reporter=json` is passed, **Then** output is a valid JSON array of `PolicyResult` objects written to stdout.
2. **Given** no violations exist, **When** `--reporter=json` is passed, **Then** output is an empty JSON array `[]`.
3. **Given** the JSON reporter is active, **When** both errors and warnings exist, **Then** all are included in the output with correct `severity` fields.

---

### Edge Cases

- What happens when GitNexus index is stale or unavailable? → Engine falls back to file-system context only and surfaces a warning. No rules fail silently.
- What happens when a policy rule `evaluate()` function throws an uncaught exception? → The engine catches it, marks that rule as errored with severity `error`, and continues evaluating remaining rules.
- What happens when `--changed` is run but no files have changed? → Engine evaluates zero rules and exits 0 immediately.
- What happens when a new domain type is introduced that is not in the `PolicyRule.domain` union? → TypeScript type-check catches it at compile time; the engine rejects the rule at registration.
- What happens when two rules produce conflicting results for the same file? → Both results are emitted independently. Deduplication is not performed; each rule is authoritative for its own assertion.
- What happens when `policy:check --full` is run in CI and the Trivy adapter requires network access that is unavailable? → The adapter emits an `error` result indicating the check could not complete; the CI run fails with an explicit message.
- What happens when an adapter's spawned subprocess exits non-zero (e.g., the legacy tool crashes or returns an unexpected exit code)? → The adapter catches the subprocess failure, emits a single `error`-severity `PolicyResult` with a diagnostic message (including exit code and stderr excerpt), and returns. The engine continues evaluating remaining rules (consistent with FR-007).
- What happens when `--changed` is run but git cannot determine the working tree state? → The engine emits a `warning`-severity result indicating the fallback reason and proceeds with full evaluation (i.e., all rules run as if `--full` was specified). See FR-003.

---

## Requirements

### Functional Requirements

#### Engine Core

- **FR-001**: The system MUST provide a single CLI entry point `bun run policy:check` that executes all registered governance rules.
- **FR-002**: The CLI MUST support a `--full` flag that evaluates all rules across the entire repository.
- **FR-003**: The CLI MUST support a `--changed` flag that evaluates only rules applicable to files changed since the last git commit. When the git working tree state cannot be determined (e.g., detached HEAD with no prior commits, bare clone, non-git directory), the engine MUST emit a `warning`-severity result indicating the fallback reason and evaluate all rules as if `--full` was specified.
- **FR-004**: The engine MUST exit with code `1` if any rule with severity `error` produces a violation; otherwise exit with code `0`.
- **FR-005**: The engine MUST NOT exit with a non-zero code on `warning`-only results.
- **FR-006**: The engine MUST execute all registered rules deterministically — the same inputs MUST always produce the same outputs.
- **FR-007**: The engine MUST catch and isolate rule-level exceptions, reporting them as error-severity results without halting evaluation of other rules.

#### Rule Registry

- **FR-008**: The system MUST maintain a central rule registry where all `PolicyRule` definitions are registered.
- **FR-009**: Every active governance rule MUST be registered in the engine registry. No unregistered enforcement logic is permitted anywhere in the repository.
- **FR-010**: The rule registry MUST support rules organized by domain: `architecture`, `scripts`, `types`, `ai`, `security`.
- **FR-011**: Each rule MUST declare: `id`, `domain`, `description`, `severity`, and an `evaluate` function. Rules MAY declare an optional `sequential: true` flag to opt out of parallel execution (e.g., rules with shared mutable context requirements). The absence of this flag implies the rule is safe to run in parallel.
- **FR-012**: Rule IDs MUST be unique across the entire registry. Duplicate IDs MUST be rejected at registration time.

#### GitNexus Context Integration

- **FR-013**: The engine MUST load a `PolicyContext` object before executing rules, containing at minimum: `changedFiles`, `dependencyGraph`.
- **FR-014**: The context loader MUST source `changedFiles` from the current git working state.
- **FR-015**: The context loader MUST source `dependencyGraph` from the GitNexus index when available.
- **FR-016**: When GitNexus is unavailable or the index is stale, the context loader MUST construct a degraded context from the file system and emit a warning. The index is considered stale when its last-analyzed timestamp is older than the value of the `GITNEXUS_MAX_AGE_HOURS` environment variable (default: `24` hours). A missing index file is always treated as unavailable regardless of age threshold.
- **FR-017**: `PolicyContext` MUST support optional fields: `gitHistory`, `scripts`, `vulnerabilities`.

#### Adapter Layer

- **FR-018**: The system MUST provide an adapter for `architecture-guard` that maps its output to `PolicyResult[]`.
- **FR-019**: The system MUST provide an adapter for `type-safety-guard` that maps its output to `PolicyResult[]`.
- **FR-020**: The system MUST provide an adapter for `script-system-governance` that maps its output to `PolicyResult[]`.
- **FR-021**: The system MUST provide an adapter for Trivy that maps CVE findings to `PolicyResult[]` with domain `security`.
- **FR-022**: Each adapter MUST produce identical violation coverage to the legacy tool it wraps, verified by parity testing.
- **FR-023**: Adapters MUST NOT be invoked directly by CI, the orchestrator, or Husky hooks — only through the engine.

#### Reporting

- **FR-024**: The engine MUST support a console reporter that outputs human-readable results to stdout grouped by domain.
- **FR-025**: The engine MUST support a JSON reporter (`--reporter=json`) that outputs a `PolicyResult[]` array to stdout.
- **FR-026**: Both reporters MUST include: rule ID, domain, severity, message, and file (when available).
- **FR-027**: The JSON reporter MUST produce valid JSON parseable by standard tooling.

#### Script System Unification

- **FR-028**: The policy engine MUST include a rule that detects scripts in `package.json` that do not follow the `<domain>:<action>[:scope]` naming convention.
- **FR-029**: The policy engine MUST include a rule that detects duplicate scripts — multiple scripts with equivalent purpose or identical implementation.
- **FR-030**: The policy engine MUST include a rule that detects scripts in `package.json` whose file paths do not resolve to an existing file under `/scripts/`.
- **FR-031**: The policy engine MUST include a rule that detects scripts lacking a corresponding documentation entry in `docs/scripts/`.
- **FR-032**: Every script MUST declare its invocation layer (CI, dev, orchestrator) in its documentation entry.
- **FR-033**: Generated artifacts MUST be classified as either: commit-required (e.g., architecture brain) or ignored (e.g., temp/cache files). The policy engine MUST enforce this classification.
- **FR-034**: The `.gitignore` file MUST be the authoritative source for ignored generated artifacts, and the policy engine MUST validate consistency between `.gitignore` and the artifact classification list.

#### CI Integration

- **FR-035**: The CI pipeline MUST invoke `bun run policy:check --full` as a required gate that fails the build on error-severity violations.
- **FR-036**: GitHub Workflow YAML files MUST NOT invoke legacy guard scripts (`arch:guard`, `type-safety-guard`, etc.) directly — all validation MUST route through `policy:check`.

#### Pre-Commit (Husky) Integration

- **FR-037**: The Husky `pre-commit` hook MUST invoke `bun run policy:check --changed` scoped to staged files.
- **FR-038**: The Husky `pre-commit` hook MUST complete in under 2 seconds on a typical changed-file set.
- **FR-039**: The Husky `pre-push` hook MAY invoke deeper or incremental checks beyond `--changed` scope.
- **FR-040**: No redundant validation logic MUST remain in Husky hooks outside of the `policy:check` invocation.

#### Orchestrator Integration

- **FR-041**: The orchestrator MUST call `policyEngine.check(context)` for all governance decisions — it MUST NOT implement local governance logic.
- **FR-042**: The orchestrator's precommit-diagnostics step MUST delegate entirely to the policy engine.
- **FR-043**: The orchestrator's stage closure gate MUST use the policy engine as its sole validation authority.

---

### Non-Functional Requirements

#### Performance

- **NFR-001**: `bun run policy:check --changed` MUST complete in under 2 seconds on a standard developer machine when evaluating a typical commit (1–15 changed files).
- **NFR-002**: `bun run policy:check --full` SHOULD complete in under 60 seconds on the full monorepo.
- **NFR-003**: Rules are executed in parallel by default via `Promise.all` — all rules are treated as parallelizable unless explicitly marked `sequential: true` on the `PolicyRule` interface. Rules declaring `sequential: true` are queued and executed after all parallel rules complete.
- **NFR-004**: Rules MUST scope their evaluation to `changedFiles` when running in `--changed` mode — no full-repo scans are permitted in this mode.

#### Determinism

- **NFR-005**: Given identical `PolicyContext` inputs, the engine MUST produce identical `PolicyResult[]` outputs on every run.
- **NFR-006**: Rule evaluation order MUST NOT affect the set of results produced (rules are independent).
- **NFR-007**: The JSON reporter output MUST be stable and produce identical output for identical inputs (no timestamp, random IDs, or unstable ordering in results).

#### Extensibility

- **NFR-008**: Adding a new policy rule MUST require only: implementing the `PolicyRule` interface and registering it in the registry — no changes to the engine core.
- **NFR-009**: Adding a new domain MUST require only: extending the `domain` union type and creating a new rules directory — no changes to the engine execution loop.
- **NFR-010**: Adapters MUST be independently testable without requiring the full engine to be initialized.

#### Reliability

- **NFR-011**: A failure in one rule MUST NOT prevent other rules from executing. The engine MUST continue and report the failed rule as an error result.
- **NFR-012**: A missing or unavailable GitNexus index MUST NOT cause the engine to crash — it MUST degrade gracefully and produce a warning result.
- **NFR-013**: The engine MUST be idempotent — running it twice in succession without any code changes MUST produce identical results.

#### Maintainability

- **NFR-014**: Every registered rule MUST include a human-readable `description` field that explains what it validates and why.
- **NFR-015**: The rule registry MUST be the canonical catalog of all governance rules — no governance logic is scattered across CI YAML, Husky config, or orchestrator code.
- **NFR-016**: Rule `id` values MUST follow the format `<DOMAIN>-<NNN>` (e.g., `ARCH-001`, `SCRIPTS-003`) to be human-identifiable.

#### Security

- **NFR-017**: The policy engine MUST NOT execute arbitrary shell commands from rule definitions — rules evaluate programmatically against `PolicyContext` data only.
- **NFR-018**: The Trivy adapter MUST NOT transmit vulnerability report data outside the local process — all processing is local.
- **NFR-019**: Rule `evaluate()` functions MUST be pure with respect to external I/O — they receive `PolicyContext` as input and return `PolicyResult[]` as output, with no side effects.
- **NFR-020**: The policy engine MUST NOT accept rule definitions from runtime user input — the registry is compile-time only.
- **NFR-021**: The engine MUST enforce a 2,000ms execution timeout per invocation in `--changed` mode and a 30,000ms timeout in `--full` mode. On timeout, the engine MUST abort remaining rule evaluation, emit an `error`-severity `PolicyResult` with `ruleId: 'ENGINE-001'` (conforming to the `<DOMAIN>-<NNN>` format from NFR-016; domain `ENGINE` is reserved for internal engine-generated results) and a message describing which mode timed out, and exit with code 1.

---

## Key Entities

- **PolicyRule**: A governance rule with an `id`, `domain`, `description`, `severity`, and an `evaluate` function. The atomic unit of governance enforcement.
- **PolicyContext**: The input data object passed to every rule's `evaluate` function. Contains `changedFiles`, `dependencyGraph`, and optional fields (`gitHistory`, `scripts`, `vulnerabilities`).
- **PolicyResult**: The output of a rule evaluation. Contains `ruleId`, `severity`, `message`, and optional `file` and `suggestion`.
- **Rule Registry**: The central catalog of all registered `PolicyRule` instances. The sole source of enforcement truth.
- **Policy Engine**: The runtime that loads context, iterates the registry, executes rules, and dispatches results to reporters.
- **Adapter**: A wrapper that translates the output of a legacy governance tool into `PolicyResult[]` objects and exposes them as a registered `PolicyRule`.
- **Reporter**: A result formatter — either console (human-readable) or JSON (machine-readable).
- **Script Authority Chain**: The traceability path from a script's name in `package.json` → its file in `/scripts/` → its documentation entry in `docs/scripts/`.

---

## Architecture Constraints

1. **Adapter-first migration only**: Existing governance tools (`arch:guard`, `type-safety-guard`, Trivy, `script-system-governance`) MUST NOT be removed. They MUST be wrapped by adapters that expose them as policy rules. Deletion is out of scope for this stage.

2. **Engine lives in `scripts/policy-engine/`**: The engine runtime, rule registry, context loader, adapters, and reporters all reside under `scripts/policy-engine/`. No engine logic is placed in `apps/` or `packages/`.

3. **No import boundary violations**: `scripts/policy-engine/` MUST NOT import from `apps/*`. It may import from `packages/*` for shared types only.

4. **TypeScript strict mode**: All engine code MUST be TypeScript with strict mode enabled. The `domain` union in `PolicyRule` is the compile-time enforcement gate for new domains.

5. **No embedded business rules**: The policy engine evaluates structural and governance rules only. It MUST NOT contain domain business logic (e.g., tenant isolation checks, exam scoring rules).

6. **Bun runtime**: All scripts and the engine run under Bun. Node.js-specific APIs that are incompatible with Bun's runtime MUST NOT be used.

7. **No UI surface**: The engine has no web dashboard, no HTTP server, no interactive UI. Output is CLI-only (console or JSON to stdout).

8. **Rule registration is compile-time**: The registry is populated at module initialization time. Dynamic rule loading from external files at runtime is not permitted.

---

## Security Considerations

- **Input validation**: The `PolicyContext` is assembled from controlled sources (git working tree, GitNexus index, local file system). No user-supplied input flows into rule evaluation without sanitization.
- **No shell injection**: Rules MUST evaluate against data structures in `PolicyContext`, not by spawning shell commands from rule logic. Adapters that invoke legacy tools spawn them via controlled process calls with fixed argument shapes — not interpolated user data.
- **Trivy adapter isolation**: Vulnerability data from Trivy is processed in-process and never written to shared state, external APIs, or logs beyond structured `PolicyResult` output.
- **Reproducibility as a security property**: Deterministic outputs prevent governance drift — the same codebase state cannot produce different enforcement outcomes across environments.
- **No secrets in context**: `PolicyContext` MUST NOT include secrets, credentials, or environment-specific tokens. If context loaders encounter secrets in the environment, they MUST not propagate them into the context object passed to rules.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All governance checks that previously ran as separate scripts or CI steps are reachable via `bun run policy:check`, with no direct invocations of legacy tools in CI YAML or Husky hooks.
- **SC-002**: `bun run policy:check --changed` completes in under 2 seconds on a typical commit set (1–15 files) on standard developer hardware.
- **SC-003**: Running the legacy governance tool and its adapter equivalent on the same codebase state produces identical violation sets (100% parity).
- **SC-004**: Zero duplicate rule definitions exist — each governance concern is encoded in exactly one registered `PolicyRule`.
- **SC-005**: The orchestrator contains zero lines of independent validation logic — all governance delegation routes through `policyEngine.check()`.
- **SC-006**: Every script in `package.json` resolves to an existing file, follows the `<domain>:<action>[:scope]` naming convention, and has a documentation entry in `docs/scripts/`.
- **SC-007**: The CI pipeline passes the full policy check gate (`--full`) on the main branch after the stage is complete.
- **SC-008**: Adding a new policy rule requires changes only to the rule file and registry registration — the engine, CLI, and reporters require no modification.

---

## Assumptions

- GitNexus is already indexed for the repository (INFRA-28 delivered this). The context loader assumes an accessible local index; network-based GitNexus access is not assumed.
- Bun ≥ 1.x is available in all execution environments (CI, local dev). Node.js compatibility shims are not required.
- The four legacy tools (architecture-guard, type-safety-guard, script-system-governance, Trivy) are all currently functional and can be invoked programmatically or via shell within the adapter layer.
- `package.json` is the canonical source for script names; any script only referenced in CI YAML or Husky config without a `package.json` entry is considered undeclared and will be flagged.
- Pre-commit timing budget of 2 seconds is measured on an Apple M-series or equivalent developer machine with a warm file-system cache.
- The `scripts/` directory is the canonical home for all script implementations. Scripts in other directories will be treated as misplaced.
- TypeScript compilation is not part of the pre-commit path — the engine runs as TypeScript source via Bun's native TS runner, not compiled JS.

---

## Out of Scope

- Removing or deprecating any legacy governance tool (adapter-first only; removal is a future stage).
- Providing a web UI, dashboard, or interactive report viewer for policy results.
- Cross-tenant validation logic (not applicable for an infrastructure governance stage).
- Automatic remediation of violations (the engine reports; it does not fix).
- Policy rule authoring UI or DSL — rules are authored as TypeScript code.
- Integration with external policy systems (OPA, etc.) — this is an internal Zidney-native engine.

---

## Dependencies

| Dependency               | Stage          | Required For                                     |
| ------------------------ | -------------- | ------------------------------------------------ |
| GitNexus index available | INFRA-28       | `PolicyContext.dependencyGraph` population       |
| Unified governance gate  | INFRA-27       | CI gate structure that `policy:check` plugs into |
| Trivy integration exists | INFRA-26       | Trivy adapter wrapping                           |
| Bun runtime              | Infra baseline | Engine execution                                 |

---

## Validation Gates

All four gates MUST pass before this stage is considered closed:

| Gate                             | Criterion                                                                                                  | Verified By                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Gate 1 — Parity                  | All legacy guard tools produce identical findings when run through their adapters                          | Automated parity test comparing direct and adapter outputs          |
| Gate 2 — Determinism             | Running `policy:check --full` twice on the same commit produces byte-identical JSON output                 | Determinism test: diff of two sequential runs                       |
| Gate 3 — Coverage                | All five domains (architecture, scripts, types, ai, security) have at least one registered and active rule | Registry introspection test                                         |
| Gate 4 — Orchestrator Dependency | Zero direct governance calls exist in orchestrator code outside of `policyEngine.check()`                  | Static analysis rule SCRIPTS-ORCH-001 enforced by the engine itself |

---

## Clarifications

### Session 2026-03-25

**Q: What timeout strategy should the Policy Engine enforce to satisfy NFR-001 (2s pre-commit budget) while avoiding false-positive timeouts on full CI runs?**
**A: Two-tier timeout — 2,000ms for `--changed` mode, 30,000ms for `--full` mode. On timeout, engine aborts, emits `ENGINE-001` error result (domain `ENGINE` reserved for internal results, conforming to NFR-016 `<DOMAIN>-<NNN>` format), exits code 1.**
**Impact: NFR-001 (enforced via 2,000ms limit in --changed), NFR-002 (bounded by 30,000ms in --full), NFR-021 (new requirement added).**

---

**Q: When `--changed` is invoked but the git working tree state cannot be determined (detached HEAD, bare clone, non-git directory), what should the engine do?**
**A: Fall back to `--full` evaluation automatically and emit a `warning`-severity result explaining the reason for the fallback. No abort, no silent no-op.**
**Impact: FR-003 (fallback behavior specified inline), Edge Cases section (new entry added for git-tree-unavailable scenario).**

---

**Q: How are policy rules marked as safe for parallel execution (NFR-003 requires parallel evaluation of eligible rules)?**
**A: All rules are parallelizable by default (they are pure functions by contract). Rules opt out by declaring `sequential: true` on the `PolicyRule` interface. Parallel batch runs via `Promise.all`; sequential rules run after.**
**Impact: NFR-003 (updated to reflect default-parallel with opt-out), FR-011 (sequential flag added to interface definition).**

---

**Q: When an adapter's spawned subprocess (e.g., Trivy, arch:guard CLI) exits non-zero or crashes, how should the adapter surface this failure?**
**A: Adapter catches the subprocess failure, emits a single `error`-severity `PolicyResult` with a diagnostic message (including exit code and stderr excerpt), and returns. Engine continues evaluating remaining rules — consistent with FR-007 exception isolation.**
**Impact: Edge Cases section (new entry added for adapter subprocess failure), aligns with existing FR-007 exception-isolation contract.**

---

**Q: What threshold defines a GitNexus index as "stale" for the purpose of FR-016 degraded-context fallback?**
**A: Index is stale when its last-analyzed timestamp is older than `GITNEXUS_MAX_AGE_HOURS` env var (default: 24 hours). A missing index file is always treated as unavailable regardless of age threshold.**
**Impact: FR-016 (stale threshold and env var specified inline).**
