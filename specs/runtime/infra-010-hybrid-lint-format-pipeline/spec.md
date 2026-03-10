# Spec: Hybrid Lint Format Pipeline

**Phase:** 01_PLATFORM_FOUNDATION **Stage:** STAGE_INFRA_10_HYBRID_LINT_FORMAT_PIPELINE **Stage
File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_10_HYBRID_LINT_FORMAT_PIPELINE.md`
**Branch:** `spec/infra-010-hybrid-lint-format-pipeline` **Date:** 2026-03-10 **Status:** DRAFT

---

## Feature Overview

This stage establishes a **Hybrid Lint/Format Pipeline** for the Zidney monorepo — a deterministic,
fast, and AI-safe code quality enforcement system.

**What is being built:**

A unified tooling layer that assigns linting and formatting responsibilities to the most capable
tool for each file type, eliminates tool overlap, integrates with Git hooks via Husky and
lint-staged, and enforces sub-second pre-commit performance across the full monorepo.

**Phase:** 01_PLATFORM_FOUNDATION — infrastructure foundation that enables reliable AI-assisted
development across all subsequent phases.

**Stage mapped to:** STAGE_INFRA_10_HYBRID_LINT_FORMAT_PIPELINE

**Does this stage affect:**

| Concern               | Affected? | Notes                                                           |
| --------------------- | --------- | --------------------------------------------------------------- |
| Tenant Isolation      | No        | Infrastructure tooling only; no database or tenant code path    |
| License Enforcement   | No        | No workspace-bound routes; no HTTP middleware involved          |
| Attempt Engine        | No        | No snapshot logic, no grading                                   |
| Worker                | No        | No background jobs; no async queues                             |
| Runtime (Frontoffice) | No        | Developer tooling only                                          |
| Frontoffice           | No        | No user-facing code path                                        |
| Build & Developer DX  | **Yes**   | Directly impacts all developer workflows and AI code generation |
| CI/CD pipeline        | **Yes**   | Pre-push hooks feed into CI enforcement                         |

---

## Problem Statement

The Zidney monorepo currently suffers from the following issues without a consolidated lint/format
pipeline:

1. **Tool overlap:** Using both ESLint and Prettier for TypeScript leads to duplicated rules,
   conflicting configurations, and confusing error output.
2. **Slow pre-commit hooks:** Running full-repository formatters on every commit blocks developer
   workflows, particularly in a large monorepo.
3. **Inconsistent formatting:** Without a single source of formatting truth, AI-generated code and
   human code diverge in style.
4. **Unsupported file types:** Biome does not fully handle Markdown, YAML, or GitHub Workflow files,
   requiring dedicated tools for those types.
5. **No AI compliance rules:** AI agents (Copilot, Claude, etc.) lack explicit guidance on which
   tools to use, making it likely they introduce conflicting tooling choices.

**Biome** resolves most issues for TypeScript/JavaScript/Vue code. A **hybrid model** adds
purpose-specific tools for remaining file types without overlap.

---

## Assumptions

- The monorepo uses Bun as its runtime and package manager.
- Husky is already installed or will be installed as part of this stage.
- The root `lint-staged.config.mjs` is the canonical location for lint-staged configuration (not
  inline in `package.json`).
- `yamllint` is executed as a system tool (available via `brew` or container setup); it is not a
  Node.js package.
- `actionlint` is executed as a system tool; it is not a Node.js package.
- Biome's Vue support is limited to `<script>` blocks; `<template>` and `<style>` blocks are outside
  Biome's scope.
- The target of `< 0.5s` applies to incremental execution via lint-staged, not full-repository
  scans.

---

## Constitutional Compliance Declaration

This stage is infrastructure tooling only. It does not touch runtime code paths, tenant databases,
or authentication flows.

| Rule                                   | Status | Notes                                         |
| -------------------------------------- | ------ | --------------------------------------------- |
| No cross-tenant access                 | ✅ N/A | No tenant database interaction                |
| No middleware bypass                   | ✅ N/A | No HTTP middleware involved                   |
| No grading outside worker              | ✅ N/A | No grading or attempt logic                   |
| No direct DB instantiation             | ✅ N/A | No database connections                       |
| No weakening of snapshot integrity     | ✅ N/A | No attempt engine interaction                 |
| No weakening of transaction boundaries | ✅ N/A | No transactional data operations              |
| No weakening of version enforcement    | ✅ N/A | No schema or product version gating           |
| Secrets not exposed to frontend        | ✅ N/A | Tooling config only; no secret handling       |
| Import boundaries respected            | ✅ Yes | No app-to-app or UI-to-DB cross-imports added |
| AI compliance rules defined            | ✅ Yes | Explicit rules documented in this spec        |

No ADR exception is required.

---

## Isolation Impact Analysis

This stage does not access any database.

| Question                           | Answer                        |
| ---------------------------------- | ----------------------------- |
| Which database is accessed?        | None                          |
| How is tenant resolved?            | N/A — no tenant context       |
| Where is connection pool obtained? | N/A                           |
| Is resolver middleware used?       | N/A                           |
| New tables introduced?             | None                          |
| Shared tenant data risk?           | None — pure developer tooling |

---

## License & Version Enforcement

This stage does not involve workspace-bound routes.

| Question                             | Answer |
| ------------------------------------ | ------ |
| Is license middleware required?      | No     |
| License states that must be allowed? | N/A    |
| Is limit enforcement required?       | No     |
| Is `schema_version` checked?         | No     |
| Is `product_version` checked?        | No     |

---

## Hybrid Tooling Architecture

### Design Principle

Formatting and linting responsibilities must be **strictly partitioned by file type**. No two tools
may process the same file type. This eliminates conflicting output, reduces configuration surface,
and ensures deterministic results.

### Primary Engine — Biome

Biome is the **single authoritative tool** for all TypeScript, JavaScript, and Vue files.

| Responsibility        | Command             |
| --------------------- | ------------------- |
| Formatting            | `biome format`      |
| Linting               | `biome check`       |
| Import ordering       | included in `check` |
| Unused code detection | included in `check` |

**File scope:**

```
*.ts
*.tsx
*.js
*.jsx
*.vue  (script blocks only)
```

**Biome replaces:**

- ESLint (for TypeScript/JavaScript)
- Prettier (for TypeScript/JavaScript/Vue)

### Secondary Tools — Narrow Scope Only

Secondary tools are used **exclusively for file types that Biome does not cover**.

#### Prettier — Markdown

| Property | Value                                  |
| -------- | -------------------------------------- |
| Tool     | Prettier                               |
| Scope    | `*.md`                                 |
| Purpose  | Format documentation, ADRs, spec files |
| Command  | `prettier --write`                     |

Prettier must **not** be configured to handle TypeScript, JavaScript, or Vue files. Any Prettier
configuration in the repository must explicitly exclude those file types.

#### yamllint — YAML Validation

| Property | Value                                       |
| -------- | ------------------------------------------- |
| Tool     | yamllint                                    |
| Scope    | `*.yml`, `*.yaml`                           |
| Purpose  | Validate infrastructure configs, CI configs |
| Command  | `yamllint`                                  |

yamllint performs **validation only** (not formatting). It reports structural and style violations
in YAML files.

#### actionlint — GitHub Workflow Validation

| Property | Value                                |
| -------- | ------------------------------------ |
| Tool     | actionlint                           |
| Scope    | `.github/workflows/*.yml`            |
| Purpose  | Detect invalid GitHub Actions syntax |
| Command  | `actionlint`                         |

actionlint operates as a **post-yamllint validator** specifically for GitHub Actions structure. It
fires in addition to yamllint for workflow files.

### Formatting Responsibility Matrix

| File Type          | Tool                  | Overlap Allowed? |
| ------------------ | --------------------- | ---------------- |
| `*.ts`             | Biome                 | No               |
| `*.tsx`            | Biome                 | No               |
| `*.js`             | Biome                 | No               |
| `*.jsx`            | Biome                 | No               |
| `*.vue`            | Biome (script blocks) | No               |
| `*.md`             | Prettier              | No               |
| `*.yml` / `*.yaml` | yamllint              | No               |
| `.github/**/*.yml` | actionlint + yamllint | Yes (additive)   |

**No tool overlap is allowed** except for GitHub workflow files receiving both yamllint (syntax) and
actionlint (semantics).

---

## Functional Requirements

### FR-01 — Biome as Primary Formatter/Linter

Biome must be configured as the authoritative tool for all TypeScript, JavaScript, JSX, TSX, and Vue
(script block) files in the repository. No other formatting or linting tool may be applied to these
file types.

**Acceptance:** `biome check` runs cleanly on `apps/*`, `packages/*`, and `scripts/*` without ESLint
or Prettier involvement.

### FR-02 — Prettier Scoped to Markdown Only

Prettier must be installed and configured to operate exclusively on `*.md` files. Its scope must be
restricted via `.prettierignore` or explicit glob patterns to prohibit processing TypeScript,
JavaScript, or Vue files.

**Acceptance:** `prettier --check "**/*.md"` passes; `prettier --check "**/*.ts"` is not invoked in
any automated workflow.

### FR-03 — yamllint Runtime Validation

yamllint must be executable on all `*.yml` and `*.yaml` files in the repository. A `.yamllint`
configuration file must be present at the repository root or in a discoverable location.

**Acceptance:** `yamllint .` runs without error on all YAML files in the repository (or explicitly
scoped paths).

### FR-04 — actionlint Validation for GitHub Workflows

actionlint must be executable on all files under `.github/workflows/`. It must validate GitHub
Actions schema and detect syntax errors in workflow definitions.

**Acceptance:** `actionlint .github/workflows/*.yml` reports no errors on all existing workflow
files.

### FR-05 — Husky Pre-Commit Hook via lint-staged

The Husky `pre-commit` hook must invoke `bunx lint-staged` as its only action. It must not manually
invoke Biome, Prettier, yamllint, or actionlint directly. The lint-staged configuration in
`package.json` must map each file pattern to its designated tool.

**Acceptance:** Running `git commit` triggers `bunx lint-staged`, which processes only staged files
through their respective tools in under 0.5 seconds.

### FR-06 — lint-staged Configuration in `lint-staged.config.mjs`

The root `lint-staged.config.mjs` file must define the lint-staged configuration. Each file pattern
must map to exactly one tool (or two for `.github/workflows/*.yml` files, which receive both
yamllint via the `*.{yml,yaml}` glob and actionlint via the explicit workflow glob). The
configuration must not invoke Biome on Markdown files or Prettier on TypeScript files.

**Required configuration shape:**

```javascript
// lint-staged.config.mjs
/** @type {import('lint-staged').Config} */
export default {
  "*.{ts,tsx,js,jsx,mjs,vue,json}": ["bun biome check --write"],
  "*.md": ["prettier --write"],
  "*.{yml,yaml}": ["yamllint"],
  ".github/workflows/*.yml": ["actionlint"],
};
```

**Acceptance:** `lint-staged.config.mjs` contains the above configuration at the repository root and
tool invocations execute successfully on their respective file types.

### FR-07 — Pre-Push Hook: Full Validation Pipeline

The Husky `pre-push` hook must run a stricter validation pipeline that covers the entire repository.
This pipeline runs **after** the incremental pre-commit check and is not subject to the 0.5s limit.

**Required sequence:**

1. Full Biome lint: `bun run lint` (equivalent to `bun biome check .`)
2. Architecture guard: `bun scripts/ai-guard.ts`
3. Infrastructure audit: `bun scripts/infra-audit.ts`
4. Full workflow validation: `actionlint .github/workflows/`

**Acceptance:** `git push` triggers the pre-push hook; all four commands execute in sequence; a
failure in any command aborts the push.

### FR-08 — Monorepo-Wide Tool Coverage

All tools must be configured to operate across the full monorepo:

```
apps/*
packages/*
scripts/*
```

Tool configurations must not be scoped to a single app or package.

**Acceptance:** Running each tool from the repository root processes files in all three directories
without configuration errors.

### FR-09 — No ESLint in TypeScript/JavaScript Scope

ESLint must not be configured, installed, or invoked for TypeScript or JavaScript files. If ESLint
is present in the repository for legacy reasons, it must be scoped exclusively to file types not
covered by Biome, or removed entirely.

**Acceptance:** `package.json` does not contain ESLint as a dev dependency for TS/JS scope, and no
lint-staged or CI script invokes ESLint on `.ts`, `.tsx`, `.js`, or `.jsx` files.

### FR-10 — Bun-Compatible Tool Execution

All tools must be executable via Bun. Tools that are Node.js packages (lint-staged, Prettier) must
be invokable with `bunx`. System tools (yamllint, actionlint) must be available in the development
environment and documented in the setup guide.

**Acceptance:** All lint-staged commands execute successfully when run via `bunx`.

---

## Non-Functional Requirements

### NFR-01 — Pre-Commit Performance

The lint-staged incremental execution **must complete within 0.5 seconds** for typical commits
touching 1–10 files.

| Scenario                               | Target Runtime |
| -------------------------------------- | -------------- |
| 1–3 TypeScript files staged            | < 100ms        |
| 5–10 mixed TypeScript/Vue files staged | < 300ms        |
| Full incremental lint-staged pass      | 50–150ms       |
| Full repository scan (CI / pre-push)   | 0.5–3 seconds  |

### NFR-02 — Deterministic Output

All formatting operations must be **deterministic**: running the same formatter twice on the same
file must produce identical output. There must be no non-deterministic whitespace, import-order
variance, or line-ending differences between operating systems.

### NFR-03 — Zero Configuration Drift

Tool configurations must be maintained in a single canonical location per tool:

| Tool        | Configuration File                         |
| ----------- | ------------------------------------------ |
| Biome       | `biome.json` (repository root)             |
| Prettier    | `.prettierrc` or `package.json`            |
| yamllint    | `.yamllint` (repository root)              |
| actionlint  | `.actionlint.yaml` (if needed)             |
| lint-staged | `lint-staged.config.mjs` (repository root) |
| Husky       | `.husky/` directory                        |

No per-package tool configuration is allowed unless explicitly required by a specific app's
constraints.

### NFR-04 — AI-Generated Code Compliance

AI agents generating code in this repository must produce output that passes `biome check` without
modification. The Biome configuration must be stricter than the AI agent's default output style so
that formatting is enforced, not assumed.

### NFR-05 — Tool Isolation

Each tool must be independently upgradable without affecting the others. A Biome version bump must
not require changes to the Prettier or yamllint configuration.

### NFR-06 — Failure Transparency

When a pre-commit or pre-push check fails, the error output must clearly identify:

- Which tool failed
- Which file caused the failure
- What the violation is

Generic error suppression or silent failure is not acceptable.

---

## Dependencies

| Tool        | Type          | Purpose                                | Scope            |
| ----------- | ------------- | -------------------------------------- | ---------------- |
| biome       | Dev dep (npm) | Primary formatter/linter for TS/JS/Vue | All environments |
| prettier    | Dev dep (npm) | Markdown formatter                     | All environments |
| lint-staged | Dev dep (npm) | Incremental pre-commit file processing | Dev only         |
| husky       | Dev dep (npm) | Git hook management                    | Dev only         |
| yamllint    | System tool   | YAML structural validation             | Dev + CI         |
| actionlint  | System tool   | GitHub Actions workflow validation     | Dev + CI         |
| bun         | Runtime       | Package manager and script runner      | All environments |

**System tools setup requirement:** Developer environment setup documentation must include
instructions for installing `yamllint` and `actionlint` (e.g., via Homebrew on macOS, apt on Linux,
or Docker image inclusion for CI).

---

## Scope

### In Scope

- Installing and configuring Biome as the primary lint/format engine for TS/JS/JSX/TSX/Vue
- Configuring Prettier exclusively for Markdown
- Configuring yamllint for all YAML files
- Configuring actionlint for GitHub workflow files
- Writing the lint-staged configuration block in root `package.json`
- Writing the Husky `pre-commit` hook (`bunx lint-staged`)
- Writing the Husky `pre-push` hook (Biome check + ai-guard + infra-audit)
- Documenting AI agent compliance rules
- Removing or scoping ESLint to prevent overlap with Biome

### Out of Scope

- Configuring Biome beyond the repository root `biome.json` (per-package overrides are excluded
  unless explicitly needed)
- Configuring CI pipeline jobs (CI checks are assumed to inherit from the same tool configs; CI job
  configuration is a separate concern)
- Installing or configuring monitoring, alerting, or metrics for lint failures
- Writing Biome-specific lint rules not already present in the default or existing `biome.json`
- Migrating or rewriting existing code to pass lint rules (existing violations must be addressed in
  a separate cleanup task or suppressed with justification)
- Setting up yamllint and actionlint in CI (addressed by CI pipeline stage)
- Modifying the `biome.json` configuration philosophy (rules management is a separate concern)

---

## User Scenarios & Acceptance Scenarios

### Scenario 1 — Developer commits a TypeScript file

**Given:** A developer has staged changes to `apps/api/src/routes/auth.ts` **When:** The developer
runs `git commit` **Then:** The pre-commit hook runs `bunx lint-staged`, which executes
`biome format --write` and `biome check` only on `apps/api/src/routes/auth.ts`, completes in under
150ms, and the commit succeeds.

### Scenario 2 — Developer commits a Vue file with formatting issues

**Given:** A developer has staged `apps/mmc/src/views/products/ProductTable.vue` with inconsistent
indentation in the `<script>` block **When:** The developer runs `git commit` **Then:** Biome
auto-formats the file, re-stages it, and the commit proceeds. If lint errors exist that cannot be
auto-fixed, the commit is blocked with a clear error message identifying the file and rule.

### Scenario 3 — Developer commits a Markdown file

**Given:** A developer has staged `docs/architecture/ADR/adr-0015.md` **When:** The developer runs
`git commit` **Then:** Prettier formats the Markdown file and re-stages it. Biome is not invoked on
this file. The commit succeeds.

### Scenario 4 — Developer commits a YAML file

**Given:** A developer has staged `.github/workflows/ci.yml` **When:** The developer runs
`git commit` **Then:** yamllint validates the YAML syntax. actionlint validates the GitHub Actions
structure. If both pass, the commit proceeds. If either fails, the commit is blocked with a
human-readable error.

### Scenario 5 — Developer pushes to remote

**Given:** A developer runs `git push` **When:** The pre-push hook fires **Then:** The full Biome
check runs across all applicable files, followed by `bun scripts/ai-guard.ts` and
`bun scripts/infra-audit.ts`. If the architecture guard detects violations, the push is aborted and
the developer receives a diagnostic report.

### Scenario 6 — AI agent generates TypeScript code

**Given:** An AI agent (Copilot, Claude) generates new TypeScript code in
`packages/domain-core/src/` **When:** The developer commits the AI-generated code **Then:**
lint-staged runs Biome check on the generated files. If the AI-generated code violates any Biome
rule, the commit is blocked and the developer is shown the specific violations.

### Scenario 7 — Developer adds a Prettier config for TypeScript (violation scenario)

**Given:** A developer tries to add a `.prettierrc` rule for `.ts` files **When:** The change is
committed **Then:** The no-overlap rule is enforced by documentation, code review, and AI compliance
rules. The lint-staged configuration does not invoke Prettier on `.ts` files, so the config has no
effect in automated runs.

---

## Success Criteria

All criteria are measurable and technology-agnostic:

| Criterion                                                               | Measurement Method                                   |
| ----------------------------------------------------------------------- | ---------------------------------------------------- |
| Pre-commit hook completes in under 0.5 seconds for typical commits      | Timed execution of `git commit` with staged files    |
| All code committed to the repository passes linting without suppression | CI pass rate for lint jobs over 2-week period        |
| AI-generated code requires zero manual formatting corrections           | Code review checklist over 2-week observation        |
| Developers can commit without manually running format commands          | Developer survey or commit log analysis              |
| Zero tool overlap in active configurations                              | Audit of lint-staged config and tool invocations     |
| Pre-push hook blocks architecture violations before they reach remote   | Verified by attempting a push with a known violation |

---

## Data Model Changes

None. This stage introduces no database tables, no migrations, and no schema changes.

---

## Transaction Boundaries

Not applicable. This stage involves no transactional data operations.

---

## Authoritative Time Usage

Not applicable. This stage involves no time-sensitive operations.

---

## Idempotency Strategy

All formatting operations are inherently idempotent: running `biome format` or `prettier --write` on
an already-formatted file produces no change. No additional idempotency controls are required.

---

## Observability Requirements

This stage does not introduce structured logging. Tool output (stdout/stderr) serves as the
observability mechanism. When a hook fails, the tool's output must be surfaced directly to the
developer terminal without suppression.

---

## Rate Limiting & Abuse Protection

Not applicable. This stage involves no network endpoints or external services.

---

## Layer Separation Confirmation

| Rule                                                    | Status |
| ------------------------------------------------------- | ------ |
| Frontend contains no business logic (modified by stage) | ✅ N/A |
| API contains no grading logic (modified by stage)       | ✅ N/A |
| Worker contains no HTTP logic (modified by stage)       | ✅ N/A |
| MMC does not access tenant DB (modified by stage)       | ✅ N/A |
| No direct DB creation outside provisioning              | ✅ N/A |

---

## AI Agent Compliance Rules

The following rules are **binding** for all AI agents (Copilot, Claude, GLM, and others) operating
in the Zidney repository after this stage is implemented:

| Rule ID | Rule                                                                                  | Enforcement            |
| ------- | ------------------------------------------------------------------------------------- | ---------------------- |
| AI-01   | Never introduce ESLint rules that duplicate Biome for TypeScript/JavaScript/Vue files | ai-guard.ts            |
| AI-02   | Never configure Prettier for TypeScript, JavaScript, JSX, or TSX files                | ai-guard.ts            |
| AI-03   | Never modify formatting rules without updating this stage specification               | Code review gate       |
| AI-04   | Always run `biome format` on generated TypeScript/JavaScript code before committing   | Pre-commit hook        |
| AI-05   | Never disable or bypass Husky hooks with `--no-verify` except in documented hotfixes  | Code review gate       |
| AI-06   | Never run full-repository Biome scans in pre-commit hooks (use lint-staged)           | Hook configuration     |
| AI-07   | Always respect the Formatting Responsibility Matrix defined in this spec              | Documentation + review |
| AI-08   | When adding a new file type, propose an update to this spec before adding a tool      | Code review gate       |

---

## Failure Modes & Recovery

| Failure Mode                                 | Detection                           | Recovery Strategy                                               |
| -------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| Biome check fails on staged file             | Pre-commit hook exits non-zero      | Developer fixes the violation; commit is blocked until resolved |
| Prettier fails on Markdown file              | Pre-commit hook exits non-zero      | Developer reviews Prettier output and fixes formatting          |
| yamllint fails on YAML file                  | Pre-commit hook exits non-zero      | Developer fixes YAML syntax error identified in output          |
| actionlint fails on workflow file            | Pre-commit hook exits non-zero      | Developer fixes GitHub Actions syntax error                     |
| Pre-push Biome check fails                   | Pre-push hook exits non-zero        | Developer resolves lint issues before re-pushing                |
| ai-guard.ts reports architecture violation   | Pre-push hook exits non-zero        | Developer follows self-healing workflow to repair architecture  |
| infra-audit.ts reports undeclared module     | Pre-push hook exits non-zero        | Developer runs `bun run arch:add-module` to register module     |
| yamllint not installed                       | Hook fails with "command not found" | Developer follows setup guide to install yamllint               |
| actionlint not installed                     | Hook fails with "command not found" | Developer follows setup guide to install actionlint             |
| lint-staged config missing from package.json | Pre-commit hook finds no config     | Developer reinstates the configuration block from this spec     |

---

## Test Strategy

### Unit Tests

- Unit test for each tool invocation in lint-staged: verify the correct tool is mapped to each file
  pattern.
- Unit test that Prettier configuration does not include TypeScript file patterns.

### Integration Tests

- Integration test: stage a TypeScript file with a known Biome violation → verify pre-commit hook
  blocks the commit.
- Integration test: stage a Markdown file with formatting issues → verify Prettier is invoked and
  the file is auto-formatted.
- Integration test: stage a YAML file with syntax errors → verify yamllint blocks the commit.
- Integration test: stage a GitHub workflow file with invalid Actions syntax → verify actionlint
  blocks the commit.
- Integration test: stage files across two different file types simultaneously → verify correct
  tools fire for each type.
- Integration test: push with a known architecture violation → verify pre-push hook blocks the push.

### Performance Tests

- Timed test: stage 1–5 TypeScript files and measure lint-staged runtime; must be under 150ms.
- Timed test: stage 10 mixed-type files and measure lint-staged runtime; must be under 500ms.

### Idempotency Tests

- Run `biome format` twice on the same file; verify no diff on second run.
- Run `prettier --write` twice on the same Markdown file; verify no diff on second run.

### No-Overlap Validation

- Automated check: verify no lint-staged config entry maps Prettier to `.ts` or `.js` patterns.
- Automated check: verify no ESLint config files exist with TS/JS scope.

---

## Explicit Non-Goals

This stage does **not**:

- Configure or modify CI pipeline job definitions (that is a separate infrastructure stage).
- Define or change Biome linting rules beyond enabling the pipeline (rule governance is a separate
  concern).
- Migrate existing code to comply with new lint rules (code cleanup is a separate task).
- Introduce per-package Biome or Prettier configurations.
- Configure code coverage, test runners, or test-related tools.
- Set up remote lint caching or distributed formatting infrastructure.
- Handle Sass/CSS/SCSS linting (if needed in future, a separate stage spec is required).
- Enforce commit message conventions (that is handled by commitlint in a separate stage).
- Install yamllint or actionlint in CI Docker images (that is an ops/CI stage concern).

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

This stage is infrastructure tooling only. It does not interact with tenant databases,
authentication middleware, license enforcement, attempt engine, or worker queues. No ADR exception
is required. All architectural boundaries defined in `ARCHITECTURE_MAP.json` remain respected. No
cross-tenant data access, no global DB singleton, no middleware bypass.

---

## Clarifications

### Session 2026-03-10

- **Q-01 ⚠️ CRITICAL — lint-staged config location: `package.json` inline vs
  `lint-staged.config.mjs`?** → **A: Use the existing `lint-staged.config.mjs` at the repository
  root** (not inline in `package.json`). → **Evidence:** The workspace already contains
  `lint-staged.config.mjs` using ESM `export default` syntax — lint-staged natively supports `.mjs`
  config files. FR-06 originally specified `package.json` inline without awareness of the existing
  file. NFR-03 designates `lint-staged.config.mjs` as the single canonical location. Implementation
  must update the existing file, not create a duplicate inline block in `package.json`. → **Sections
  updated:** Assumptions, NFR-03 Configuration Table, FR-06 heading and body.

- **Q-02 ⚠️ CRITICAL — Biome invocation in lint-staged: two commands (`biome format --write` +
  `biome check`) or single `bun biome check --write`?** → **A: Single `bun biome check --write`**
  per file pattern group. → **Evidence:** The existing `lint-staged.config.mjs` already uses
  `bun biome check --write`. `biome check --write` is the fix-mode command that applies format
  writes and auto-fixable lint fixes (import ordering, unused-variable stubs, etc.) in a single
  atomic pass. The spec's original two-command form ran `biome check` _without_ `--write`, leaving
  auto-fixable lint violations unremediated and blocking commits unnecessarily. `package.json`
  scripts also confirm the canonical invocation is `bun biome check`. → **Sections updated:** FR-06
  configuration shape.

- **Q-03 — Should `*.mjs` and `*.json` be included in the Biome lint-staged glob?** → **A: Yes —
  include both** in `*.{ts,tsx,js,jsx,mjs,vue,json}`. → **Evidence:** The existing
  `lint-staged.config.mjs` already includes `mjs` and `json`. Biome v2.4.6 (pinned in `biome.json`
  schema and `package.json`) supports `.mjs` as valid ES module JavaScript and `.json` for
  formatting/validation. The `biome.json` `files.includes` covers `**`, picking up both types.
  Excluding them from lint-staged creates an inconsistency where staged Biome-supported files bypass
  pre-commit checking. → **Sections updated:** FR-06 configuration shape.

- **Q-04 ⚠️ CRITICAL — Pre-push `biome check` invocation: bare `biome check`, `bun biome check`, or
  `bun run lint`?** → **A: `bun run lint`** (the defined npm script alias). → **Evidence:**
  `package.json` defines `"lint": "bun biome check ."` — using the script alias always includes the
  `.` path argument and is idiomatic in this monorepo. Bare `biome check` can fail if the `biome`
  binary is not on the system `PATH` (it resides in `node_modules/.bin/`). All other monorepo
  CI-relevant scripts use the `bun run <script>` pattern. → **Sections updated:** FR-07 required
  sequence.

- **Q-05 ⚠️ CRITICAL — actionlint scope: staged files only (lint-staged) or also a full scan on
  push?** → **A: Both.** Lint-staged runs actionlint on staged workflow files during pre-commit. The
  pre-push hook must additionally run `actionlint .github/workflows/` for full-repository coverage.
  → **Evidence:** FR-04 acceptance criterion states "reports no errors on _all existing workflow
  files_" — this implies full coverage, not just staged files. Since lint-staged by design only
  processes staged files, the pre-push hook must include a full actionlint pass to satisfy FR-04.
  This is consistent with FR-07's stated goal of "a stricter validation pipeline that covers the
  entire repository." FR-07 was updated to include this as step 4. → **Sections updated:** FR-07
  required sequence and acceptance criterion.

- **Q-06 (Confirmed Clear) — Biome Vue handling: `<script>` blocks only or full file?** → **A:
  `<script>` blocks only.** `<template>` and `<style>` are outside Biome's scope. → **Evidence:**
  Explicitly stated in the Assumptions section. Confirmed by `biome.json` which has a `**/*.vue`
  linter override (script-level processing) but no template/style handling. No spec change required.

- **Q-07 (Confirmed Clear) — yamllint: system dependency or npm package?** → **A: System tool** —
  installed via brew/apt/container, NOT an npm package. → **Evidence:** Explicitly stated in the
  Assumptions section and confirmed in the Dependencies table. `package.json` devDependencies does
  not include yamllint. No spec change required.

- **Q-08 (Confirmed Clear) — Biome installation: root only or also per-package?** → **A: Root
  only.** `@biomejs/biome` is a root-level devDependency only. → **Evidence:** `package.json`
  devDependencies has `"@biomejs/biome": "^2.4.6"` at root. NFR-03 prohibits per-package tool
  config. Scope section explicitly excludes per-package Biome configurations. No spec change
  required.
