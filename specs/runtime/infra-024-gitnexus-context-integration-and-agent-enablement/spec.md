# Specification: GitNexus Context Integration and Agent Enablement

**Feature ID:** INFRA-024  
**Phase:** 01_PLATFORM_FOUNDATION  
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_24_GITNEXUS_CONTEXT_INTEGRATION_AND_AGENT_ENABLEMENT.md`  
**Branch:** `spec/infra-024-gitnexus-context-integration-and-agent-enablement`  
**Status:** DRAFT  
**Created:** 2026-03-18

---

## Feature Overview

This feature integrates **GitNexus** as a first-class intelligence layer inside the Zidney monorepo. The goal is to eliminate blind AI reasoning by providing AI agents — especially the Zidney orchestrator — with deterministic, structured, and contextually-grounded repository awareness.

GitNexus will serve as the authoritative source of:

- which files changed and why
- what modules are impacted by any given change
- how modules relate through the dependency graph
- the recent commit history and git diff context

This intelligence layer **complements** (does not replace) the existing AI-context system and architecture guard. It upgrades Zidney from an AI-assisted platform to a **context-aware intelligent development platform** where every agent decision is backed by real repository state.

**Affected system areas:**

- Scripts layer (`scripts/`)
- Orchestrator agent (`.agents/agents/zidney-orchestrator.agent.md`)
- CI pipeline (validation gate)
- Documentation (`docs/ai/`)
- AI governance rules (`AGENTS.md`)

This feature does **not** affect:

- Tenant isolation model
- License enforcement middleware
- Attempt engine
- Worker jobs
- Frontoffice or Backoffice runtime

---

## Constitutional Compliance Declaration

- ✅ No cross-tenant data access — this feature operates entirely at the infrastructure/tooling layer
- ✅ No middleware bypass — no API routes are created or modified
- ✅ No grading logic outside worker — not applicable to this stage
- ✅ No direct DB instantiation — this feature does not access any database
- ✅ No weakening of snapshot integrity — attempt engine is untouched
- ✅ No weakening of transaction boundaries — no database transactions involved
- ✅ No weakening of version enforcement — schema_version and product_version are not affected

This stage is **architecture tooling only**. No tenant runtime code is modified.

---

## Isolation Impact Analysis

| Concern                | Answer                                       |
| ---------------------- | -------------------------------------------- |
| Database accessed?     | None — no database access at any point       |
| Tenant resolver used?  | Not applicable — infrastructure tooling only |
| Connection pool used?  | Not applicable                               |
| New tables introduced? | None                                         |
| Shared tenant data?    | No — confirmed not applicable                |

---

## License & Version Enforcement

| Concern                         | Answer                            |
| ------------------------------- | --------------------------------- |
| License middleware required?    | No — tooling layer, no API routes |
| License state checks required?  | Not applicable                    |
| Limit enforcement required?     | Not applicable                    |
| schema_version check required?  | Not applicable                    |
| product_version check required? | Not applicable                    |

---

## Scope

### In Scope

1. GitNexus package installation (global or project-local)
2. Wrapper script standardization at `scripts/gitnexus-context.ts`
3. Context scope definition: changed files, dependency graph, architecture map, git history
4. Structured JSON output contract with schema at `docs/ai/gitnexus-context.schema.json`
5. Orchestrator agent integration — GitNexus context load step added
6. Agent execution policy — GitNexus usage rules for impact analysis and reasoning
7. Deterministic test harness at `tests/gitnexus-context.test.ts`
8. Validation script at `scripts/validate-gitnexus.ts`
9. CI integration: `bun run gitnexus:validate` gate
10. Closure gate enforcement — orchestrator blocks closure without GitNexus validation
11. Documentation at `docs/ai/gitnexus.md`
12. Governance rule update in `AGENTS.md`

### Out of Scope

- Full repository indexing beyond the defined context scope (changed files, dependency graph, architecture map, git history)
- Replacing or modifying the existing AI-context system (`scripts/generate-ai-context.ts`)
- Replacing or modifying architecture guard (`scripts/ai-guard.ts`) or infra audit (`scripts/infra-audit.ts`)
- Adding new API endpoints or HTTP routes
- Any tenant database schema changes
- Any worker job modifications
- Real-time or event-driven context refresh

### Deferred

- GitNexus MCP server integration beyond the existing AGENTS.md guidance (already handled by MCP auto-trigger rules)
- Remote repository analysis or cross-repository context
- Automated context refresh on file watch

---

## Functional Requirements

### FR-001 — GitNexus Installation

GitNexus must be installed and available in the Zidney workspace.

**Acceptance criteria:**

- `gitnexus --help` exits with code 0 after installation
- Installation method (global or project-local) must be documented
- Installation must not introduce dependency conflicts with existing packages
- `package.json` must reflect the dependency if installed project-locally

---

### FR-002 — Wrapper Script: `scripts/gitnexus-context.ts`

A canonical wrapper script must exist at `scripts/gitnexus-context.ts` to standardize access to GitNexus context generation.

**Acceptance criteria:**

- File exists at `scripts/gitnexus-context.ts`
- Script includes a JSDoc metadata header with `@script`, `@domain`, `@description`, `@mode`, and `@dependencies` fields
- Script is registered in root `package.json` under a key following `<domain>:<action>` format (e.g., `gitnexus:context`)
- Script is documented in `docs/scripts/gitnexus-context.md`
- Script does not use `console.log` for structured output — uses structured logger or JSON output methods
- Script accepts CLI arguments to scope analysis (e.g., `--changed`, `--deps`, `--arch`, `--history`)

---

### FR-003 — Context Scope Definition

The wrapper script must generate context covering exactly four domains:

1. **Changed files** — files modified relative to HEAD or a specified base ref
2. **Dependency graph** — module-to-module dependency relationships for impacted files
3. **Architecture map** — layer assignment of impacted modules
4. **Git history** — recent commits and diffs relevant to the analysis scope

**Acceptance criteria:**

- Each domain produces defined output fields in the JSON result
- Analysis is scoped to changed files by default (not full repository scan)
- Empty results for a domain are represented as empty arrays/objects (not null or undefined)
- Full-scan mode is explicitly opt-in and documented

---

### FR-004 — Structured Output Schema

A strict JSON schema must be defined and published at `docs/ai/gitnexus-context.schema.json`.

**Acceptance criteria:**

- Schema file exists at `docs/ai/gitnexus-context.schema.json`
- Schema defines all mandatory fields:
  - `changedFiles` (array of file paths)
  - `impactedModules` (array of module identifiers)
  - `dependencyGraph` (object mapping module → dependencies)
  - `architectureLayerMap` (object mapping module → layer name)
  - `recentCommits` (array of commit objects with hash, message, author, date)
  - `riskIndicators` (array of risk descriptor objects, each with shape: `{ module: string, riskScore: number, reason: string, affectedBy: string[] }`) — see Clarifications Q3
- Schema includes type definitions, required fields, and description annotations
- All GitNexus wrapper script outputs must validate against this schema
- Schema version is declared in the schema file itself

---

### FR-005 — Orchestrator Integration

The Zidney orchestrator agent (`.agents/agents/zidney-orchestrator.agent.md`) must be updated to load GitNexus context as a mandatory step.

**Acceptance criteria:**

- A "Load GitNexus Context" step is added to the orchestrator workflow
- The step appears in three orchestrator phases:
  1. Before planning (step executed at workflow start)
  2. During execution (on-demand, when evaluating impacted scope)
  3. Before closure (validation confirmation)
- The step specifies: execute `scripts/gitnexus-context.ts`, write output to `docs/ai/context/gitnexus-context.json`, and use that file as the authoritative context source for understanding change scope, identifying impacted modules, and guiding execution decisions (See Clarifications Q4.)
- The orchestrator blocks execution if GitNexus context is unavailable and cannot be generated
- A stale `docs/ai/context/gitnexus-context.json` from a prior session must not be trusted — regeneration is mandatory at each orchestrator session start

---

### FR-006 — Agent Execution Policy

A binding policy must define when AI agents are required to use GitNexus.

**Acceptance criteria:**

- Policy is documented in `AGENTS.md` under a clearly labeled section
- Policy mandates GitNexus use for:
  - Impact analysis before any code change
  - Dependency reasoning when tracing module relationships
  - Change validation before proposing modifications
  - Risk detection during architectural reasoning
- Policy explicitly prohibits:
  - Blind reasoning without context when GitNexus is available
  - Ignoring GitNexus output when it has been loaded

---

### FR-007 — Deterministic Test Harness

A test file must exist at `tests/gitnexus-context.test.ts` with deterministic, reproducible test cases.

**Acceptance criteria:**

- Test file exists at `tests/gitnexus-context.test.ts`
- Test suite includes the following test cases:
  1. Changed files detection — verifies that modified files are correctly identified
  2. Dependency mapping accuracy — verifies correct module dependencies are returned
  3. Architecture mapping correctness — verifies modules are assigned to correct layers
  4. Git history extraction — verifies recent commits are returned with required fields
  5. Stable output format — verifies output conforms to `docs/ai/gitnexus-context.schema.json`
- All test cases pass deterministically (no flakiness)
- Failure of any test case constitutes a stage failure
- Tests use fixtures or mocks where necessary to avoid git state dependency

---

### FR-008 — Validation Script

A validation script must exist at `scripts/validate-gitnexus.ts` that verifies GitNexus context output integrity.

**Acceptance criteria:**

- File exists at `scripts/validate-gitnexus.ts`
- Script includes a JSDoc metadata header with `@script`, `@domain`, `@description`, `@mode`, and `@dependencies` fields
- Script is registered in root `package.json` as `validate-gitnexus`
- Script is documented in `docs/scripts/validate-gitnexus.md`
- Script performs:
  1. GitNexus context generation
  2. Schema validation against `docs/ai/gitnexus-context.schema.json`
  3. Required field presence check (no critical fields empty)
  4. Exit code 0 on success, non-zero on any failure
- Script emits structured error output describing which validation step failed

---

### FR-009 — CI Integration

The validation script must be integrated into the CI pipeline as a required gate.

**Acceptance criteria:**

- Root `package.json` includes a script entry `validate-gitnexus` that executes `scripts/validate-gitnexus.ts`
- CI configuration calls `bun run gitnexus:validate`
- CI fails if:
  - GitNexus CLI command fails (non-zero exit code)
  - Schema structure validation fails (invalid types, missing required keys)
  - Script execution throws an unhandled error
- CI does **not** fail if output arrays are empty (e.g., `changedFiles: []` on a clean tree) — empty arrays are a valid output state (See Clarifications Q5.)
- CI gate is documented in `docs/ci/` or referenced from the existing CI documentation

---

### FR-010 — Closure Gate Enforcement

The orchestrator closure step must be blocked unless GitNexus context has been generated and validated.

**Acceptance criteria:**

- Orchestrator agent file includes a pre-closure check for GitNexus context
- Closure is blocked (workflow cannot proceed to PRODUCTION READY) if:
  - GitNexus context generation has not been executed in the current session
  - GitNexus output failed schema validation
  - GitNexus output is not referenced in the closure confirmation
- Failure condition is clearly documented in the orchestrator file with the BLOCK CLOSURE label

---

### FR-011 — Documentation

Reference documentation must be created at `docs/ai/gitnexus.md`.

**Acceptance criteria:**

- File exists at `docs/ai/gitnexus.md`
- Document includes:
  1. What GitNexus is and why Zidney uses it
  2. How to run GitNexus locally (step-by-step)
  3. Output structure (with reference to schema file)
  4. How the orchestrator uses GitNexus context
  5. Troubleshooting section (common failure modes and resolutions)
- Document does not contain secrets, credentials, or environment-specific values

---

### FR-012 — Governance Rule Update

`AGENTS.md` must be updated with a binding AI governance rule requiring GitNexus context usage.

**Acceptance criteria:**

- A clearly labeled section is added to `AGENTS.md`
- The rule states that AI agents MUST use GitNexus context when:
  - Evaluating changes in the codebase
  - Performing impact analysis
  - Making architecture decisions
- The rule references the auto-trigger behavior already defined in the GitNexus MCP section of `AGENTS.md`
- The rule is enforceable — it references `scripts/gitnexus-context.ts` as the execution mechanism

---

## Non-Functional Requirements

### NFR-001 — Script Governance Compliance

All scripts introduced by this stage must fully comply with Zidney script governance.

**Acceptance criteria:**

- Each script includes the mandatory JSDoc metadata header:
  ```
  @script     <script-name>
  @domain     <domain-name>
  @description <description>
  @mode       <cli|background|ci>
  @dependencies <list>
  ```
- Script keys in `package.json` follow `<domain>:<action>` format
- Scripts reside under `scripts/` root (not inside `packages/*/src/` or `apps/*/src/`)
- Each script has a corresponding documentation file under `docs/scripts/`
- `validate-runtime-scripts` passes after scripts are registered

---

### NFR-002 — No `console.log` Usage

Scripts must not use `console.log` for structured runtime output.

**Acceptance criteria:**

- `console.log` is not present in `scripts/gitnexus-context.ts` or `scripts/validate-gitnexus.ts`
- Structured output uses JSON serialization directly to stdout or the project-standard logger
- Error output uses `console.error` or the structured logger with appropriate log level

---

### NFR-003 — Performance: Scoped Analysis Only

GitNexus context generation must remain scoped to minimize execution time.

**Acceptance criteria:**

- Default execution mode analyzes only changed files (not the full repository)
- Full-scan mode requires an explicit opt-in flag
- Context generation completes in under 30 seconds on a standard developer machine under normal changed-files load (< 50 files)
- CI gate completes in under 60 seconds

---

### NFR-004 — No Secrets in Scripts

Scripts must not contain, reference, or log secrets, tokens, or credentials.

**Acceptance criteria:**

- No hardcoded tokens, API keys, or credentials in any script introduced by this stage
- Environment variables used for any configuration values (if needed)
- No secret is logged or emitted in script output

---

### NFR-005 — JSON Output Determinism

The wrapper script output must be deterministic for equivalent input states.

**Acceptance criteria:**

- Running the script twice against the same git state produces identical JSON output
- Output field ordering is stable
- Arrays are sorted consistently (alphabetical for file paths, chronological for commits)

---

### NFR-006 — Backward Compatibility

Additions to `AGENTS.md` and the orchestrator agent must be backward compatible.

**Acceptance criteria:**

- Existing orchestrator workflow steps are not removed or reordered
- New GitNexus steps are additive — they insert into the existing flow without displacing existing steps
- `AGENTS.md` additions do not contradict or override existing rules

---

## System Context and Dependencies

### Internal Dependencies

| Dependency                                             | Purpose                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `scripts/infra-audit.ts`                               | Generates `ai-architecture-brain.json` consumed by wrapper |
| `docs/ai/context/ai-architecture-brain.json`           | Source of architecture context for the wrapper script      |
| `docs/architecture/intelligence/ARCHITECTURE_MAP.json` | Architecture layer authority                               |
| `.agents/agents/zidney-orchestrator.agent.md`          | Target for integration (orchestrator step)                 |
| `AGENTS.md`                                            | Target for governance rule addition                        |

### External Dependencies

| Dependency | Version | Purpose                                   |
| ---------- | ------- | ----------------------------------------- |
| `gitnexus` | latest  | Core context engine — repository analysis |

### Assumes Existing

- `docs/ai/context/` directory exists and contains architecture brain artifacts
- `scripts/infra-audit.ts` is functional and produces valid `ai-architecture-brain.json`
- Root `package.json` script registration pattern is established

---

## Data Model Changes

**No database schema changes.** This stage introduces only:

- New files under `scripts/`
- New files under `tests/`
- New files under `docs/ai/`
- Modifications to `AGENTS.md` and `.agents/agents/zidney-orchestrator.agent.md`
- New script entries in root `package.json`

No migration is required. No `schema_version` bump is required.

---

## Observability Requirements

| Requirement               | Detail                                                              |
| ------------------------- | ------------------------------------------------------------------- |
| Structured log fields     | `timestamp`, `level`, `service: gitnexus-context`, `correlation_id` |
| Validation failure output | Structured JSON describing which validation rule failed             |
| CI output                 | Exit code + structured error message on failure                     |
| `console.log` forbidden   | See NFR-002                                                         |

---

## Constraints

### AGENTS.md Architectural Constraints

1. **Script location rule**: All scripts must reside under `scripts/` — not inside `packages/*/src/` or `apps/*/src/`
2. **JSDoc header requirement**: All scripts must include `@script`, `@domain`, `@description`, `@mode`, `@dependencies` metadata
3. **Package.json naming**: Script keys must follow `<domain>:<action>` format
4. **Documentation requirement**: Every script must have a corresponding `docs/scripts/<script>.md`
5. **No secrets**: No credentials or tokens hardcoded or logged
6. **No `console.log`**: Use structured logging or direct JSON stdout

### Platform Trust Chain Constraints

This stage operates **outside** the runtime trust chain (Isolation → License → Authentication → Attempt → Runtime → Frontoffice). It is pure infrastructure tooling. No trust chain validation applies.

---

## Acceptance Criteria Summary

| ID     | Criterion                                                                | Verifiable? |
| ------ | ------------------------------------------------------------------------ | ----------- |
| AC-001 | `gitnexus --help` exits 0 after installation                             | ✅          |
| AC-002 | `scripts/gitnexus-context.ts` exists with JSDoc header                   | ✅          |
| AC-003 | Script registered in `package.json` with `<domain>:<action>` key         | ✅          |
| AC-004 | `docs/ai/gitnexus-context.schema.json` exists with all 6 required fields | ✅          |
| AC-005 | Wrapper script output validates against schema                           | ✅          |
| AC-006 | Orchestrator has "Load GitNexus Context" step at 3 phases                | ✅          |
| AC-007 | All 5 test cases in `tests/gitnexus-context.test.ts` pass                | ✅          |
| AC-008 | `scripts/validate-gitnexus.ts` exists with JSDoc header                  | ✅          |
| AC-009 | `bun run gitnexus:validate` passes in CI                                 | ✅          |
| AC-010 | Closure gate blocks if GitNexus context not validated                    | ✅          |
| AC-011 | `docs/ai/gitnexus.md` exists with all 5 required sections                | ✅          |
| AC-012 | `AGENTS.md` governance rule references `scripts/gitnexus-context.ts`     | ✅          |
| AC-013 | No `console.log` in any introduced script                                | ✅          |
| AC-014 | All scripts have `docs/scripts/<script>.md` documentation                | ✅          |

---

## Risk Register

| Risk ID  | Risk                                                   | Likelihood | Impact | Mitigation                                                                |
| -------- | ------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------- |
| RISK-001 | GitNexus produces incorrect context                    | Medium     | High   | Schema validation + deterministic test harness (FR-007)                   |
| RISK-002 | Performance overhead slows CI                          | Low        | Medium | Scoped analysis by default (NFR-003)                                      |
| RISK-003 | Agents ignore GitNexus context                         | Medium     | High   | Governance rule in AGENTS.md (FR-012) + orchestrator enforcement (FR-005) |
| RISK-004 | Schema drift between wrapper and schema file           | Low        | High   | CI validation gate fails on mismatch (FR-009)                             |
| RISK-005 | `ai-architecture-brain.json` not present               | Low        | High   | Wrapper script exits with clear error + CI fails (FR-008)                 |
| RISK-006 | Script registered with incorrect naming                | Low        | Low    | `validate-runtime-scripts` catches naming violations                      |
| RISK-007 | Orchestrator integration conflicts with existing steps | Low        | Medium | Additive integration only — no steps removed (NFR-006)                    |

---

## Explicit Non-Goals

- This stage does NOT replace the existing AI-context system (`scripts/generate-ai-context.ts`)
- This stage does NOT replace architecture guard (`scripts/ai-guard.ts`) or infra audit (`scripts/infra-audit.ts`)
- This stage does NOT introduce any API routes, middleware, or database access
- This stage does NOT affect tenant isolation, license enforcement, attempt engine, or worker jobs
- This stage does NOT implement full repository indexing outside the defined context scope
- This stage does NOT implement real-time or event-driven context refresh
- This stage does NOT configure the GitNexus MCP server (already handled by existing AGENTS.md guidance)

---

## Assumptions

1. GitNexus CLI is installed as a project devDependency via `bun add -D gitnexus` and is listed in root `package.json` under `devDependencies`. Global installation is not used. (See Clarifications Q2.)
2. The orchestrator agent file `.agents/agents/zidney-orchestrator.agent.md` exists and follows an additive modification pattern
3. `docs/ai/context/ai-architecture-brain.json` is available locally at time of wrapper script execution
4. The existing `scripts/gitnexus-context.ts` file (which currently provides architecture brain context) will be **fully replaced** with a new GitNexus CLI wrapper implementation. No legacy brain-reading logic is carried forward. The brain-reading functionality already exists in `scripts/generate-ai-context.ts` and is not duplicated here. (See Clarifications Q1.)
5. CI pipeline already supports `bun run <script>` execution pattern
6. No secrets or API keys are required for GitNexus local/project usage

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

This stage is infrastructure tooling only. It introduces no tenant data access, no middleware modifications, no database schema changes, no attempt engine modifications, and no runtime trust chain violations. All scripts comply with Zidney script governance rules.

---

## Clarifications

### Session 2026-03-18

**Q1:** When updating `scripts/gitnexus-context.ts`, should the existing brain-reading functionality (reading `docs/ai/context/ai-architecture-brain.json`) be preserved alongside the new GitNexus CLI context generation, or should the script be fully replaced with the new GitNexus-centric implementation only?  
**A1:** Full replacement. The existing brain-reading logic is already covered by `scripts/generate-ai-context.ts` and is redundant in this new context. The new script must exclusively wrap the GitNexus CLI and produce the structured JSON output defined by `docs/ai/gitnexus-context.schema.json`. No legacy brain-printing logic is carried forward.

**Q2:** Should `gitnexus` be installed as a project devDependency (pinned in `package.json`) or as a global CLI tool?  
**A2:** Project devDependency via `bun add -D gitnexus`. This is consistent with Zidney's `bun`-managed reproducibility model. The dependency must appear in root `package.json` under `devDependencies`, ensuring every developer and CI runner operates against the exact same pinned version without manual global installation steps.

**Q3:** What fields must each object in the `riskIndicators` array contain in `docs/ai/gitnexus-context.schema.json`?  
**A3:** Each risk descriptor object must contain: `{ module: string, riskScore: number, reason: string, affectedBy: string[] }`. `module` identifies the impacted module, `riskScore` is a numeric value (0–100) enabling sorting and thresholding, `reason` is a human-readable explanation for AI agent consumption, and `affectedBy` lists the contributing dependency chain (array of module identifier strings).

**Q4:** How should the orchestrator deliver GitNexus context to sub-agents during execution?  
**A4:** Write to a well-known file at `docs/ai/context/gitnexus-context.json`. This is consistent with the existing Zidney pattern (`ai-architecture-brain.json` already resides at `docs/ai/context/`). Sub-agents reference the context by file path. The orchestrator step must document this path explicitly. The file must be regenerated at each orchestrator session start — stale files from prior sessions must not be trusted.

**Q5:** When `changedFiles` is empty (clean git tree, no staged or unstaged changes), should `scripts/validate-gitnexus.ts` exit 0 (pass) or non-zero (fail)?  
**A5:** Exit 0. Empty arrays are a valid output state — a clean tree legitimately produces `changedFiles: []`. The CI gate (`bun run gitnexus:validate`) must fail only on: (a) non-zero exit code from the GitNexus CLI itself, (b) JSON schema structure violations (invalid types, missing required keys), or (c) script execution errors. An empty-but-structurally-valid output is always a passing condition.
