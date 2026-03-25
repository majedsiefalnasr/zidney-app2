# Spec: Unified Governance Gate System

**Stage:** INFRA-27 — Unified Governance Gate System
**Phase:** 01_PLATFORM_FOUNDATION
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md`
**Status:** DRAFT
**Date:** 2026-03-25

---

## Overview

This stage introduces a single composable entry point — the **Governance Gate System** — that unifies all existing enforcement guards (architecture, type safety, script system, security) into a deterministic, fail-fast pipeline callable from pre-commit, CI, and the orchestrator. It does not rewrite or replace any existing guard; it composes them into three well-defined invocation modes scoped to context (changed files, full, strict). Standardized exit codes and a human-readable report at `docs/governance/governance-report.md` complete the surface.

---

## Goals

- Provide a single `governance:gate` command that sequences all existing guards in a defined, repeatable order
- Provide a `governance:gate:ci` variant that runs in strict/blocking mode for CI pipelines
- Provide a `governance:gate:changed` variant scoped to changed files for fast pre-commit feedback
- Provide a `governance:report` command that generates a consolidated governance health report
- Extend `.husky/pre-commit` to invoke `governance:gate:changed` on every commit
- Add a `Unified Governance Gate` step to `.github/workflows/architecture-governance.yml` calling `governance:gate:ci`
- Require the orchestrator to call `governance:gate:changed` at Step 6 and `governance:gate` at Step 7
- Establish `scripts/governance/` as the canonical location for all gate implementation files
- Standardize exit codes: `0` = all checks pass, `1` = one or more checks failed; warnings never fail
- Produce output report at `docs/governance/governance-report.md`

---

## Non-Goals

- Rewriting, replacing, or modifying the logic of any composed guard (`arch:guard`, `validate:types`, etc.)
- Runtime monitoring or production observability
- External security tooling beyond Trivy (already established in INFRA-26)
- Database migrations or schema changes (this is a pure tooling stage)
- Tenant isolation logic changes
- Adding new guards not already implemented in prior INFRA stages
- Updating the canonical 9-domain list in the script-system-governance skill to include `governance` (tracked separately)

---

## User Stories

### US1 — Developer: Fast Feedback at Commit Time

As a developer committing code changes, I want the pre-commit hook to automatically run governance checks scoped to changed files only, so that I am blocked immediately if my changes violate architecture, type safety, or script governance rules — without waiting for a full CI run.

### US2 — CI Pipeline: Full Blocking Gate on Pull Requests

As a CI pipeline processing a pull request, I want a single mandatory workflow step that runs the full governance gate in strict mode, so that no PR can be merged if any architecture, type-safety, script-system, security, or AI-context violation exists.

### US3 — Orchestrator: Pre-Execution and Closure Gates

As the orchestrator managing a multi-step implementation session, I want to invoke a scoped governance gate before execution begins (Step 6) and a full governance gate at closure (Step 7), so that no implementation can proceed on a dirty state and no stage can be closed with outstanding violations.

### US4 — Infrastructure Engineer: Single Unified Command

As an infrastructure engineer, I want a single `governance:gate` command that composes all existing guards — architecture, type safety, script system, security, and AI-context — in a deterministic order, so that I can run a full governance check locally without knowing or remembering each individual guard's invocation syntax.

### US5 — Infrastructure Engineer: Governance Report Generation

As an infrastructure engineer, I want a `governance:report` command that generates a human-readable markdown report summarizing the current governance health of the repository, so that I can audit the platform state at any point and share findings with the team.

---

## Functional Requirements

### FR-001 — Governance Gate Command (US4)

A `governance:gate` script MUST be registered in root `package.json`. When invoked, it MUST execute the following guards in sequence, in this order:

1. `bun run arch:guard`
2. `bun run validate:types`
3. `bun run validate:runtime:scripts` _(canonical name — formerly listed as `validate:runtime-scripts`)_
4. `bun run validate:script:usage` _(canonical name — formerly listed as `script:usage-scan`)_
5. `bun run infra:security:ci` _(canonical name — formerly listed as `security:scan:ci`)_
6. `bun run ai-context:validate` _(alias must be created: chains `validate:ai-context-fresh && validate:ai-context-schemas`)_

If any guard exits with a non-zero code, `governance:gate` MUST exit with code `1`. If all guards exit with code `0`, `governance:gate` MUST exit with code `0`. Warnings emitted by any guard MUST be forwarded to stdout but MUST NOT change the exit code.

### FR-002 — CI Governance Gate Variant (US2)

A `governance:gate:ci` script MUST be registered in root `package.json`. It MUST invoke `governance:gate` and propagate its exit code unchanged. CI-specific behaviour (e.g., annotation formatting) may be implemented inside `scripts/governance/gate-ci.ts` without modifying the underlying guards.

### FR-003 — Changed-Files Governance Gate Variant (US1, US3)

A `governance:gate:changed` script MUST be registered in root `package.json`. It MUST run a scoped subset of guards over changed files only:

1. `bun run arch:guard:changed`
2. `bun run validate:runtime-scripts`

This command MUST complete in under 10 seconds on a standard developer machine for a typical pull request diff (≤ 50 changed files). Exit code semantics are identical to FR-001.

### FR-004 — Governance Report Command (US5)

A `governance:report` script MUST be registered in root `package.json`. When invoked, it MUST:

1. Execute `bun run arch:health`
2. Execute `bun run ai-context:validate`
3. Write a consolidated markdown report to `docs/governance/governance-report.md`

The report MUST include: run timestamp, pass/fail status per guard, any blocking violations, and any non-blocking warnings.

### FR-005 — Script File Location

All implementation files for the governance gate MUST reside under `scripts/governance/`:

| File                            | Purpose                                       |
| ------------------------------- | --------------------------------------------- |
| `scripts/governance/gate.ts`    | Full gate — composes all guards               |
| `scripts/governance/gate-ci.ts` | CI variant — invokes gate.ts, CI-mode wrapper |
| `scripts/governance/report.ts`  | Report generator                              |

`governance:gate:changed` MAY be implemented as a single-line `package.json` script (shell delegation) rather than a separate `.ts` file, given its simple composition.

### FR-006 — Script Metadata Headers

All `.ts` files under `scripts/governance/` MUST include the 5-field metadata header required by the script-system-governance skill:

```
@script governance:<action>[:<scope>]
@domain governance
@category governance
@description <one sentence>
@usage bun run governance:<action>[:<scope>]
```

### FR-007 — Pre-Commit Integration (US1)

`.husky/pre-commit` MUST be extended to include:

```bash
bun run governance:gate:changed
```

This line MUST be added after any existing `lint-staged` or individual guard invocations and MUST run on every commit regardless of which files are staged. If `governance:gate:changed` exits with code `1`, the commit MUST be blocked.

### FR-008 — CI Workflow Integration (US2)

`.github/workflows/architecture-governance.yml` MUST receive a new step:

```yaml
- name: Unified Governance Gate
  run: bun run governance:gate:ci
```

This step MUST be positioned after all individual guard steps that currently exist in the workflow. The step MUST result in a failed workflow run if `governance:gate:ci` exits non-zero.

### FR-009 — Orchestrator Integration (US3)

The orchestrator definition MUST be updated such that:

- **Step 6 (Implement — Pre-Execution)**: calls `bun run governance:gate:changed` and blocks if the result is non-zero.
- **Step 7 (Closure — Final Gate)**: calls `bun run governance:gate` and blocks if the result is non-zero.

The orchestrator MUST surface a normalized diagnostic report when either gate blocks.

### FR-010 — No Duplicate Validation Logic

The governance gate scripts MUST NOT re-implement any validation logic already present in the composed guards. All logic changes to architecture, type safety, script, security, or AI-context validation belong in the respective upstream guard packages. The gate is an orchestration layer only.

### FR-011 — Exit Code Policy

| Code | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| `0`  | All composed guards passed; warnings may have been emitted   |
| `1`  | One or more composed guards failed with a blocking violation |

No other exit codes are permitted. The gate MUST NOT swallow non-zero exit codes from its sub-commands.

---

## Technical Constraints

- **Import boundary**: `scripts/governance/` files are standalone Bun scripts. They MUST NOT import from `apps/*`. They invoke guards via `bun run <script>` shell delegation only.
- **No framework dependencies**: Gate scripts are pure Bun process orchestration. No Hono, no Drizzle, no UI frameworks.
- **No DB access**: This stage introduces no database connections, queries, or migrations.
- **No tenant isolation surface**: No workspace routes, no tenant resolution logic.
- **No license middleware**: Not applicable — this stage introduces no HTTP routes.
- **Script naming**: All new scripts MUST follow `governance:<action>[:<scope>]` pattern per stage mandate. Note: `governance` is not in the current 9-domain list in `script-system-governance/SKILL.md` — implementation MUST document this as a tracked exception pending skill update.
- **Idempotency**: Running `governance:gate` multiple times with the same repository state MUST produce the same exit code.
- **Fail-fast vs. report-all**: `governance:gate` runs each guard sequentially and reports all failures before exiting. It MUST NOT short-circuit after the first failing guard (report-all mode).

---

## Dependencies

| Stage    | What It Provides                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------ |
| INFRA-16 | `arch:guard` — architecture boundary enforcement                                                 |
| INFRA-21 | `validate:types` — type-safety-guard                                                             |
| INFRA-22 | `ai-context:validate` — AI context validation                                                    |
| INFRA-25 | `validate:runtime:scripts`, `validate:script:usage` — script system governance (canonical names) |
| INFRA-26 | `infra:security:ci` — Trivy security scanning (canonical name)                                   |

All five upstream guards MUST be implemented and passing before `governance:gate` implementation begins. The gate MUST NOT be treated as a workaround for broken upstream guards.

---

## Success Criteria

1. `bun run governance:gate` exits `0` on the main branch with all guards passing.
2. `bun run governance:gate` exits `1` when any single composed guard is made to fail (verified by injecting a known violation for each guard type in isolation).
3. `bun run governance:gate:changed` completes in under 10 seconds for a diff of ≤ 50 changed files.
4. Committing a file that introduces an architecture violation is blocked by the pre-commit hook (`governance:gate:changed` exits `1`).
5. A pull request introducing a type-safety violation is blocked by CI (`governance:gate:ci` exits `1`, the `Unified Governance Gate` workflow step fails).
6. A pull request with no violations has the `Unified Governance Gate` step exit `0`.
7. `bun run governance:report` produces a valid markdown file at `docs/governance/governance-report.md` containing per-guard pass/fail status and a run timestamp.
8. All four `governance:*` scripts are present and correctly registered in the root `package.json`.
9. All files under `scripts/governance/` carry valid 5-field metadata headers.
10. `governance:gate` does not duplicate any validation logic — all logic resides in the upstream guards.
11. The orchestrator correctly blocks at Step 6 when `governance:gate:changed` fails and at Step 7 when `governance:gate` fails.

---

## Risks

| Risk                                                                                                | Likelihood | Impact | Mitigation                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One or more upstream guards (INFRA-16, 21, 22, 25, 26) not yet implemented                          | Medium     | High   | Gate implementation is blocked until all five upstream scripts resolve to exit 0 on clean state. Verify each guard independently before wiring the gate.                                     |
| `governance:gate:changed` exceeds 10-second target due to `arch:guard:changed` performance          | Medium     | Medium | Profile `arch:guard:changed` independently; if it exceeds budget, the scoped gate may be narrowed to only `validate:runtime-scripts` for the pre-commit context with a documented rationale. |
| `governance` domain name conflicts with future expansion of the 9-domain naming policy              | Low        | Low    | Document `governance` as a tracked exception in the spec and in the script metadata. A separate task to update `script-system-governance/SKILL.md` is out of scope.                          |
| Pre-commit hook slowdowns frustrate developer workflow                                              | Low        | Medium | `governance:gate:changed` is scoped to changed files only and skips full scans. Monitor p95 pre-commit time; adjust scope if needed.                                                         |
| Report file (`docs/governance/governance-report.md`) committed accidentally to main with stale data | Low        | Low    | **Required:** Add `docs/governance/governance-report.md` to `.gitignore` as a mandatory deliverable of this stage. Confirmed NOT currently in `.gitignore` (see Clarifications Q3).          |

---

## Clarifications

### Session 2026-03-25

**Q1: Do all upstream guard scripts referenced in FR-001 exist in root `package.json` under those exact names?**

A: **No — four of the six names in FR-001 do not exist under the names stated.** Codebase evidence from root `package.json`:

| FR-001 Name (spec)         | Actual Canonical Name in package.json                                                    | Status                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `arch:guard`               | `arch:guard` → `bun scripts/architecture-guard/architecture-guard.ts`                    | ✅ Exists                                                    |
| `validate:types`           | `validate:types` → `bun typecheck && bun arch:type-safety-guard --json`                  | ✅ Exists                                                    |
| `validate:runtime-scripts` | Actual name: `validate:runtime:scripts` → `bun run scripts/validate/runtime-scripts.ts`  | ❌ Name mismatch                                             |
| `script:usage-scan`        | Actual name: `validate:script:usage` → `bun scripts/validate/script-usage.ts`            | ❌ Name mismatch                                             |
| `security:scan:ci`         | Actual name: `infra:security:ci` → `bun scripts/security/scan-ci.ts`                     | ❌ Name mismatch                                             |
| `ai-context:validate`      | No single script; split into `validate:ai-context-fresh` + `validate:ai-context-schemas` | ❌ Missing alias; must be created or split reference updated |

**Resolution:** FR-001 MUST be updated before implementation. The gate script at `scripts/governance/gate.ts` MUST reference the canonical names: `validate:runtime:scripts`, `validate:script:usage`, `infra:security:ci`. For `ai-context:validate`, a new alias MUST be created in `package.json` that chains `validate:ai-context-fresh && validate:ai-context-schemas`, OR the gate.ts implementation must call them as two sequential steps documented as one logical guard. The governance `package.json` scripts (`governance:gate`, `governance:gate:ci`, `governance:gate:changed`, `governance:report`) do not yet exist and must all be created.

---

**Q2: Does `arch:guard:changed` exist in `package.json`?**

A: **Yes — it exists.** `arch:guard:changed` → `bun scripts/architecture-guard/architecture-guard.ts --changed`. FR-003's dependency on `arch:guard:changed` is satisfied. No fallback to `arch:guard` is required. The performance risk noted in the spec Risks table remains valid (profile independently), but no naming substitution is needed.

---

**Q3: Is `docs/governance/governance-report.md` protected from accidental commits by `.gitignore`?**

A: **No.** The `.gitignore` file contains entries for `docs/ai/context/architecture-impact-report.json`, `docs/architecture/health/ai-execution-logs/*.json`, and `docs/architecture/health/ai-plans/*.md`, but has **no entry** for `docs/governance/` or `docs/governance/governance-report.md`. The Risk row in this spec ("Report file committed accidentally") is therefore **unmitigated at this time**. **Resolution:** The implementation MUST add `docs/governance/governance-report.md` to `.gitignore` as part of this stage. This is a required deliverable, not optional.

---

**Q4: Does `.github/workflows/architecture-governance.yml` already have a `Unified Governance Gate` step?**

A: **No.** The workflow (10 numbered steps currently) contains no step named "Unified Governance Gate" and no invocation of `governance:gate:ci`. Steps 5–8 run individual guards (`ai-guard.ts`, `infra-audit.ts`, `architecture-diff.ts`, `arch:health:ci`) plus an AI execution validation step. FR-008 has **not** been partially satisfied. The new step must be inserted **after step 11** (`Run AI Execution Validation`) — or after the last existing individual guard step — as specified in FR-008.

---

**Q5: Does `scripts/governance/` already exist with partial implementation?**

A: **Yes — partially.** The directory exists with:

- `scripts/governance/core/governance-validator.ts` — a governance validator utility
- `scripts/governance/type-safety-guard.ts` — type-safety guard script
- `scripts/governance/validate-architecture-brain.ts` — architecture brain validator (also referenced by the pre-commit hook)

The three files mandated by FR-005 (`gate.ts`, `gate-ci.ts`, `report.ts`) do **not** exist yet. The existing files are support utilities; none implements the gate orchestration layer. **Resolution:** Implementation must create the three missing files without disturbing the existing `validate-architecture-brain.ts` (already wired into pre-commit). The `core/governance-validator.ts` utility MAY be imported by `gate.ts` if applicable; review its exports before writing new orchestration logic.

---

**Audit Note — Transaction Boundaries, Idempotency, Error Contract, Isolation (N/A Confirmation)**

As declared in Technical Constraints, this is a pure tooling stage. Confirmed N/A:

- **Transaction boundaries:** No database or transactional operations. N/A.
- **Idempotency:** Satisfied by design — running `governance:gate` multiple times on unchanged state produces the same exit code (deterministic sub-process delegation). No state is mutated.
- **Version enforcement logic:** Not applicable — no package versioning logic introduced.
- **Error contract:** The `{ success, data, error }` API contract applies to HTTP routes only. Exit codes `0`/`1` per FR-011 serve as the equivalent contract for CLI tooling. No HTTP surface introduced.
- **Isolation boundaries:** No tenant resolution, no workspace routes, no license middleware. N/A.
