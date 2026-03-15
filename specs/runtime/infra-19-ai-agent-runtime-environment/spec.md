# AI Agent Runtime Environment (STAGE_INFRA_19)

**Branch:** `spec/infra-19-ai-agent-runtime-environment`
**Phase:** 01_PLATFORM_FOUNDATION
**Stage:** INFRA_19
**Stage Status:** DRAFT
**Created:** 2026-03-15

---

## Feature Overview

STAGE_INFRA_19 introduces a **dedicated runtime environment for AI agents** operating inside the Zidney monorepo.

The goal is to make AI execution:

- deterministic — agents follow a structured bootstrap sequence, not ad-hoc scanning
- architecture-aware — agents always reason from authoritative architecture signals
- token-efficient — agents consume only the context they need via RTK and mini-context artifacts
- safe against hallucination paths — agents are bounded by governance rules and explicit skill contracts

This runtime layer standardizes how AI agents:

- load architecture context (Context Loader)
- activate skills (Skill Loader)
- query architecture intelligence (Architecture Intelligence Layer)
- route specialized tasks to correct MCP tools (MCP Routing Layer)
- execute terminal operations and orchestrated tasks (Deterministic Execution Layer)

The result is a **stable AI execution environment aligned with Zidney governance systems**, surfaced to developers and CI through a new runtime diagnostics command.

**In-Scope:**

- `scripts/ai-runtime/runtime-status.ts` — AI runtime diagnostics script
- Root `package.json` script registrations: `ai-runtime:status`, `ai-runtime:refresh`, `ai-runtime:validate`
- CI integration: GitHub Actions step running `bun ai-runtime:status`
- Documenting the 5-layer runtime model in the stage spec

**Out-of-Scope:**

- Changes to existing skill files under `.agents/skills/` (they are already complete and stable)
- Changes to MCP server configuration or MCP provider endpoints
- New packages under `packages/` — this is a scripts/tooling change only
- New apps under `apps/`
- Modifications to existing architecture governance scripts (`infra-audit.ts`, `ai-guard.ts`)
- Business logic of any kind
- Tenant database, license enforcement, or attempt engine modifications
- User-facing runtime or frontoffice features

---

## Constitutional Compliance Declaration

This is a **developer tooling stage** (AI runtime diagnostics layer). It does not affect:

- Tenant isolation or database-per-tenant model
- License enforcement or license middleware
- Attempt engine immutability or snapshot integrity
- Worker authority model
- Transaction boundaries or grading logic
- Server-authoritative time model

**Confirmed Compliance:**
✓ No cross-tenant data access introduced
✓ No middleware bypass
✓ No attempt snapshot integrity changes
✓ No direct DB instantiation
✓ No weakening of security boundaries
✓ No business logic embedded in scripts
✓ Server-authoritative time not applicable (tooling stage, no runtime time usage)
✓ No cross-app imports
✓ No modifications to architecture governance scripts
✓ All file operations are read-only — no destructive operations

**Non-Applicable Sections (with justification):**

- **Isolation Impact Analysis** — Script is developer tooling; no tenant database access
- **License & Version Enforcement** — No workspace-bound routes; no license middleware needed
- **Data Model Changes** — No schema changes; no migrations
- **Transaction Boundaries** — No state mutations in any tenant or master database
- **Authoritative Time Usage** — No time-sensitive operations; no runtime involvement
- **Idempotency Strategy** — Script is a read-only diagnostic runner; idempotency is naturally satisfied by re-running
- **Rate Limiting & Abuse Protection** — Local developer tooling and CI; not an exposed endpoint

---

## Runtime Architecture (5-Layer Model)

The AI runtime environment consists of five layers:

```
AI Agent Runtime
├── Layer 1: Context Loader
├── Layer 2: Skill Loader
├── Layer 3: Architecture Intelligence Layer
├── Layer 4: MCP Routing Layer
└── Layer 5: Deterministic Execution Layer
```

These layers ensure AI agents operate with **structured knowledge instead of raw repository scanning**.

---

### Layer 1 — Context Loader

AI agents must bootstrap from the repository AI context layer before taking any action.

**Primary bootstrap sequence:**

```
docs/ai/AI_BOOTSTRAP.md               ← must load first
docs/ai/AI_CONTEXT_INDEX.md           ← governance pipeline
docs/PROJECT_CONTEXT_PRIMER.md        ← architecture memory anchor
```

**Generated machine-readable artifacts (located at `docs/ai/context/`):**

| Artifact                     | Purpose                                           |
| ---------------------------- | ------------------------------------------------- |
| `ai-context-mini.json`       | Lightweight bootstrap context (always load first) |
| `ai-architecture-brain.json` | Full architecture intelligence artifact           |
| `ai-module-map.json`         | Module-to-layer mapping                           |
| `ai-layer-model.json`        | Layer model with allowed dependency directions    |
| `ai-runtime-map.json`        | Runtime service interaction map                   |
| `ai-dependency-graph.json`   | Machine-readable module dependency graph          |
| `ai-runtime-dependents.json` | Reverse dependency graph for blast-radius checks  |
| `ai-architecture-diff.json`  | Drift detection diff between audit snapshots      |

**Loading rule:** AI agents must load `ai-context-mini.json` first to minimize token consumption. Full brain is loaded only when deep architectural analysis is required.

**Freshness rule:** If `docs/ai/context/` artifacts are absent or stale, agents must trigger `bun ai-context:refresh` before proceeding.

---

### Layer 2 — Skill Loader

Skills are located in:

```
.agents/skills/
```

Each skill directory contains a `SKILL.md` file that defines the skill's capabilities, workflow, and activation rules.

**Activation rule:** Load only the skills relevant to the current task. Avoid loading unrelated skills to prevent unnecessary context inflation.

**Core runtime skills (always available):**

| Skill                       | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| `architecture-intelligence` | Architecture reasoning and boundary validation |
| `architecture-self-healing` | Detect and repair architectural drift          |
| `analysis-retry-engine`     | Intelligent retry and remediation strategy     |
| `subagent-parallelization`  | Parallel subagent execution strategy           |
| `terminal-safety`           | Safe and governed terminal command execution   |
| `rtk-execution-layer`       | Token-optimized terminal operations via RTK    |
| `mcp-routing`               | MCP tool routing and selection policy          |

**Skill integrity check:** The `runtime-status.ts` script validates that all core skill directories exist and contain a `SKILL.md` file.

---

### Layer 3 — Architecture Intelligence Layer

AI agents must **never infer architecture from raw directory structure**. All architectural reasoning must originate from authoritative governance artifacts.

**Primary sources:**

```
docs/architecture/intelligence/ARCHITECTURE_MAP.json   ← authoritative module contract
docs/architecture/ADR/                                 ← binding architectural decisions
docs/ai/context/ai-architecture-brain.json             ← generated intelligence artifact
```

**Architecture governance tools:**

| Tool                                                | Purpose                                        |
| --------------------------------------------------- | ---------------------------------------------- |
| `scripts/ai-guard.ts`                               | AI-specific import boundary enforcement        |
| `scripts/infra-audit.ts`                            | Full architecture audit and brain regeneration |
| `scripts/governance/validate-architecture-brain.ts` | Architecture brain integrity validation        |
| `scripts/architecture-guard/architecture-guard.ts`  | Module boundary enforcement                    |
| `scripts/type-safety-guard.ts`                      | TypeScript type safety enforcement             |

**Brain integrity rule:** `ai-architecture-brain.json` must be valid before any architectural reasoning. All dependency graph edges must have valid source and target module identifiers in format `packages/<name>` or `apps/<name>`. No relative paths or path segments beyond module root are allowed.

---

### Layer 4 — MCP Routing Layer

AI tools must route specialized tasks to the correct MCP provider.

**Routing policy authority:** `docs/ai/MCP_ACTIVATION_MATRIX.md`

**Routing table (summary):**

| Task Domain                | MCP Provider   | When to Use                                               |
| -------------------------- | -------------- | --------------------------------------------------------- |
| Code intelligence          | GitNexus MCP   | Understanding modules, dependency chains, refactor safety |
| Repository file operations | Filesystem MCP | Reading ADRs, specs, confirming directory structure       |
| CI/PR analysis             | GitHub MCP     | Checking PR status, commit history, branch state          |
| Library documentation      | Context7 MCP   | Third-party library APIs and framework documentation      |
| Terminal commands          | terminal tool  | Command execution, build, test, lint                      |

**MCP routing rule:** AI must prefer MCP-sourced context over training knowledge for all code, documentation, and architecture tasks. MCP usage is mandatory, not optional.

**GitNexus auto-trigger conditions:**

- Understanding how a Zidney feature, module, or service works
- Assessing blast radius of a proposed change
- Tracing a bug or unexpected behavior
- Performing or planning a refactor, rename, extraction, or split

---

### Layer 5 — Deterministic Execution Layer

AI execution must follow a **deterministic 5-step workflow** to minimize hallucination risk and unnecessary token consumption.

**Execution sequence:**

| Step | Action                      | Rule                                                 |
| ---- | --------------------------- | ---------------------------------------------------- |
| 1    | Load architecture context   | `ai-context-mini.json` first; full brain if needed   |
| 2    | Load required skills        | Only skills relevant to the current task             |
| 3    | Inspect repository state    | Use MCP tools; read only; form a complete picture    |
| 4    | Execute minimal changes     | Smallest possible scope; additive-only when possible |
| 5    | Validate architecture rules | Run `bun arch:guard` and `bun ai-runtime:validate`   |

**Forbidden behaviors in deterministic mode:**

- Speculative refactoring outside task scope
- Blind repository scanning without targeted queries
- Large unscoped modifications
- Inferring module boundaries from directory structure alone
- Guessing instead of escalating when ambiguity is detected

**Token optimization rule:** All terminal operations must use the RTK prefix to minimize output token consumption. See `rtk-execution-layer` skill for command reference.

---

## Command Specifications

### ai-runtime:status — AI Runtime Diagnostics

Runs automated checks across the AI runtime environment and reports the health of all five runtime layers.

**Checks performed:**

| Check                            | Layer                             | Action                                                                            |
| -------------------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| AI context artifacts exist       | Context Loader (Layer 1)          | Verify `docs/ai/context/` contains all required artifact files                    |
| AI context freshness             | Context Loader (Layer 1)          | Check artifact modification timestamps against configurable threshold             |
| Core skill directories exist     | Skill Loader (Layer 2)            | Verify each core skill directory exists under `.agents/skills/`                   |
| Core skills have SKILL.md        | Skill Loader (Layer 2)            | Verify each core skill directory contains a `SKILL.md` file                       |
| Architecture brain integrity     | Architecture Intelligence (L3)    | Verify `ai-architecture-brain.json` is parseable and non-empty                    |
| Architecture brain edge validity | Architecture Intelligence (L3)    | Sample check: no relative-path edges in dependency graph                          |
| Architecture map exists          | Architecture Intelligence (L3)    | Verify `docs/architecture/intelligence/ARCHITECTURE_MAP.json` exists              |
| MCP routing matrix exists        | MCP Routing (Layer 4)             | Verify `docs/ai/MCP_ACTIVATION_MATRIX.md` exists                                  |
| Runtime scripts exist            | Deterministic Execution (Layer 5) | Verify all governance scripts (`ai-guard.ts`, `infra-audit.ts`, etc.) are present |

**Expected output format:**

```
AI Runtime Status
-----------------
[✔] Context Loader:              AI context artifacts present and fresh
[✔] Skill Loader:                Core skills present (7/7)
[✔] Architecture Intelligence:   Brain valid, 0 edge violations
[✔] MCP Routing:                 MCP activation matrix present
[✔] Deterministic Execution:     Runtime governance scripts present

AI runtime environment: HEALTHY
```

Each check reports one of: `[✔] OK`, `[⚠] warning`, `[✗] error`. Exit code is non-zero if any error-level check fails.

**Internal check sequence:**

The script performs all checks independently. A check failure does not halt subsequent checks. Each result is collected and then printed together in the status table. This ensures a complete diagnostic picture even when multiple layers have issues.

---

### ai-runtime:refresh — Architecture Context Refresh

Delegates to the existing `ai-context:refresh` command:

```json
"ai-runtime:refresh": "bun ai-context:refresh"
```

This triggers `scripts/generate-ai-context.ts --force`, which regenerates all `docs/ai/context/` artifacts from source.

No new logic is introduced. The script alias provides a semantically clearer entry point aligned with the AI runtime vocabulary.

---

### ai-runtime:validate — Architecture Brain Validation

Delegates to the existing `arch:validate-brain` command:

```json
"ai-runtime:validate": "bun arch:validate-brain"
```

This runs `scripts/governance/validate-architecture-brain.ts`, which validates the structural integrity of `docs/ai/context/ai-architecture-brain.json`.

No new logic is introduced. The alias provides a single-command entry point for AI runtime validation.

---

## Script File Layout

The new script lives under `scripts/ai-runtime/`:

```
scripts/
  ai-runtime/
    runtime-status.ts    ← NEW — AI runtime diagnostics runner
```

Root `package.json` registrations (3 new scripts):

```json
"ai-runtime:status":   "bun scripts/ai-runtime/runtime-status.ts",
"ai-runtime:refresh":  "bun ai-context:refresh",
"ai-runtime:validate": "bun arch:validate-brain"
```

**Placement rationale:** The `scripts/ai-runtime/` subdirectory follows the same naming convention as `scripts/dev/`, `scripts/architecture/`, and `scripts/governance/`. It scopes all AI runtime tooling together.

---

## runtime-status.ts Technical Requirements

| Requirement              | Specification                                                                     |
| ------------------------ | --------------------------------------------------------------------------------- |
| Runtime                  | Bun (no Node-specific APIs)                                                       |
| File path                | `scripts/ai-runtime/runtime-status.ts`                                            |
| Output mechanism         | `process.stdout.write` with inline formatter (same pattern as `scripts/dev/`)     |
| No `console.log`         | Forbidden per platform logging rules                                              |
| No external dependencies | No new npm/bun packages required; use `node:fs`, `node:path` builtins only        |
| No backend imports       | Must not import from `packages/logger`, `packages/domain-core`, or any app        |
| Allowed imports          | `packages/types` (compile-time type definitions only), standard Bun/Node builtins |
| Error handling           | Each check runs independently; one check failure must not halt remaining checks   |
| Exit code                | Non-zero if any error-level check fails; zero if all checks pass or only warnings |
| Output format            | Structured status table with layer names and check results                        |
| Sensitive data           | Must never print secrets, tokens, database credentials, or file values            |

**AI Context Freshness Threshold:**

The freshness check compares the modification timestamp of `docs/ai/context/ai-context-mini.json` against a configurable threshold (default: 24 hours). If the artifact is older than the threshold, the check emits a warning (not an error), since context can still function but may be stale.

**Required artifact list for Context Loader check:**

```
docs/ai/context/ai-context-mini.json
docs/ai/context/ai-architecture-brain.json
docs/ai/context/ai-module-map.json
docs/ai/context/ai-layer-model.json
docs/ai/context/ai-runtime-map.json
docs/ai/context/ai-dependency-graph.json
```

**Required core skill directories for Skill Loader check:**

```
.agents/skills/architecture-intelligence/
.agents/skills/architecture-self-healing/
.agents/skills/analysis-retry-engine/
.agents/skills/subagent-parallelization/
.agents/skills/terminal-safety/
.agents/skills/rtk-execution-layer/
.agents/skills/mcp-routing/
```

**Required governance scripts for Deterministic Execution check:**

```
scripts/ai-guard.ts
scripts/infra-audit.ts
scripts/governance/validate-architecture-brain.ts
scripts/architecture-guard/architecture-guard.ts
scripts/type-safety-guard.ts
```

---

## CI Integration

`ai-runtime:status` is integrated into the CI pipeline as an AI environment health gate.

**GitHub Actions step:**

```yaml
- name: AI Runtime Validation
  run: bun ai-runtime:status
```

**Pipeline placement:** This step runs after existing architecture validation steps (`arch:guard`, `arch:validate-brain`) and before test/build steps. It ensures AI tooling context remains functional across all CI runs.

**CI requirements:**

- Must exit non-zero on any error-level check
- Warnings are non-blocking in CI (exit code remains zero if only warnings exist)
- CI must not run `ai-runtime:refresh` or `ai-runtime:validate` as part of the status step (those are separate operations)
- CI step must not produce sensitive output

---

## Observability Requirements

AI runtime scripts must use structured output for consistent diagnostic reporting.

| Requirement                 | Rule                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structured output           | Scripts must NOT use `console.log`                                                                                                                                    |
| Output mechanism            | `process.stdout.write` with inline symbol+label+status formatter defined within the script; `packages/logger` is forbidden (backend-scoped with service dependencies) |
| Output format               | Consistent structured table: `[symbol] Layer: status`                                                                                                                 |
| Error messages              | Provide actionable guidance (e.g., the command to run to resolve the issue: `bun ai-runtime:refresh`)                                                                 |
| Exit codes                  | Non-zero exit indicates at least one error-level check failed                                                                                                         |
| No sensitive data in output | Script must not print secrets, tokens, env var values, or database credentials                                                                                        |
| Correlation ID              | Not applicable (local developer tooling and CI; not a request-scoped operation)                                                                                       |

---

## Layer Separation Confirmation

✓ Script is developer tooling only — no business logic
✓ No database access of any kind
✓ No HTTP logic or API routes
✓ No license middleware interaction
✓ No tenant resolver involvement
✓ No attempt engine interaction
✓ No cross-layer imports — script may only import from `packages/types` (shared type definitions only); all domain, service, and backend packages (`packages/domain-core`, `packages/api-client`, `packages/job-queue`, `packages/redis-utils`, `packages/logger`, `packages/ui-system`, `packages/validation`) are forbidden imports
✓ No modifications to `scripts/infra-audit.ts`, `scripts/ai-guard.ts`, or any governance script
✓ UI layers unaffected
✓ No cross-app imports

---

## Test Strategy

| Test Type             | Requirement                                                                          |
| --------------------- | ------------------------------------------------------------------------------------ |
| Unit tests            | Required for each check function in `runtime-status.ts` (mock filesystem calls)      |
| Integration tests     | Required for `ai-runtime:status` end-to-end execution in a healthy local environment |
| Error coverage test   | Script must continue all checks after a single check failure (not fail-fast)         |
| Exit code test        | Verify exit code is non-zero when any error-level check fails                        |
| Warning test          | Verify exit code remains zero when only warning-level conditions exist               |
| Stale context test    | Verify freshness check reports warning when artifact timestamp exceeds threshold     |
| Missing artifact test | Verify correct error message and guidance suggestion when artifact is absent         |

---

## Failure Modes & Recovery

| Failure Scenario                         | Expected Behavior                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `docs/ai/context/` artifacts absent      | Report `[✗] error` for Context Loader; suggest `bun ai-runtime:refresh`               |
| AI context artifacts stale (> threshold) | Report `[⚠] warning` for Context Loader; suggest `bun ai-runtime:refresh`             |
| Core skill directory missing             | Report `[✗] error` for Skill Loader; list missing skill directories                   |
| `SKILL.md` absent in skill directory     | Report `[✗] error` for Skill Loader; list affected skill directories                  |
| Architecture brain unparseable or empty  | Report `[✗] error` for Architecture Intelligence; suggest `bun arch:audit`            |
| Architecture brain has edge violations   | Report `[⚠] warning` for Architecture Intelligence; suggest `bun arch:validate-brain` |
| `ARCHITECTURE_MAP.json` absent           | Report `[✗] error` for Architecture Intelligence; suggest `bun arch:generate`         |
| MCP activation matrix absent             | Report `[⚠] warning` for MCP Routing (documentation file; non-blocking)               |
| Governance script file absent            | Report `[✗] error` for Deterministic Execution; list missing scripts                  |
| Multiple checks fail simultaneously      | All checks complete; all errors reported together; single non-zero exit code          |
| CI `ai-runtime:status` step fails        | CI pipeline blocked at this step; developer must resolve before merge                 |

---

## Success Criteria

All criteria are technology-agnostic and measurable without knowledge of implementation details:

| Criterion                   | Target                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| Status command functional   | `bun ai-runtime:status` exits 0 in a healthy Zidney repository                              |
| Refresh command functional  | `bun ai-runtime:refresh` triggers context regeneration (delegates to `ai-context:refresh`)  |
| Validate command functional | `bun ai-runtime:validate` validates architecture brain (delegates to `arch:validate-brain`) |
| Layer coverage              | All 5 runtime layers have at least one check in the status output                           |
| Individual check isolation  | A single check failure does not block remaining checks from running                         |
| Exit code contract          | Exit code is non-zero if and only if at least one error-level check fails                   |
| Actionable output           | Every `[✗] error` result includes a suggested remediation command                           |
| CI integration              | `ai-runtime:status` step runs successfully in GitHub Actions without error                  |
| No new dependencies         | Zero new npm/bun packages are added to the project                                          |
| Import boundary compliance  | Script imports no backend packages; passes `arch:guard` unchanged                           |

---

## Architecture Impact

| Change Type    | Target                                        | Details                              |
| -------------- | --------------------------------------------- | ------------------------------------ |
| New file       | `scripts/ai-runtime/runtime-status.ts`        | New diagnostics script               |
| Modified file  | `package.json`                                | 3 new scripts added                  |
| New CI step    | `.github/workflows/` (existing workflow file) | New `AI Runtime Validation` step     |
| No DB changes  | —                                             | No schema changes, no migrations     |
| No API changes | —                                             | No new routes, middleware, or models |
| No UI changes  | —                                             | No frontend modifications            |

**Risk Level: LOW** — This is an additive-only change. No existing files are structurally modified (only `package.json` receives new script entries). No destructive operations. No tenant data access. No governance script modifications.

---

## Assumptions

- All referenced governance scripts (`arch:guard`, `arch:validate-brain`, `type-safety-guard`, `ai-context:validate`, `ai-context:refresh`, `arch:generate`, `arch:audit`) already exist and are stable
- Bun is the runtime and package manager for all scripts
- The CI platform is GitHub Actions
- The `.agents/skills/` directory structure is stable; skill directories will not be renamed between spec and implementation
- `docs/ai/context/` artifacts are generated by `scripts/generate-ai-context.ts` and regenerated via `bun ai-context:refresh`
- The freshness threshold for AI context artifacts (default: 24 hours) is a sensible default for CI environments; it may be overridable via an environment variable in a future enhancement
- Machine-parseable JSON output mode for `ai-runtime:status` is out of scope for this stage

---

## Explicit Non-Goals

- No modifications to existing skill files under `.agents/skills/`
- No changes to MCP server configuration or MCP provider settings
- No new packages under `packages/` or new apps under `apps/`
- No modifications to architecture governance scripts (`infra-audit.ts`, `ai-guard.ts`, `architecture-guard.ts`, `validate-architecture-brain.ts`)
- No automated context regeneration triggered by `ai-runtime:status` (status is read-only; refresh is a separate command)
- No automated skill regeneration
- No GUI, dashboard, or web interface for AI runtime health
- No changes to tenant database, license enforcement, attempt engine, or worker
- No automated production deployments
- JSON output mode for `ai-runtime:status` (deferred to future enhancement)
- Windows/WSL platform-specific considerations

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

This stage introduces developer tooling only. It operates entirely outside the tenant isolation, license enforcement, attempt engine, and worker models. No architectural boundaries are crossed. All changes are additive. All file operations within the script are read-only.

Architecture Trust Chain is unaffected: Isolation → License → Authentication → Attempt → Runtime → Frontoffice.
