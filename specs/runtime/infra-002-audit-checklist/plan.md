# INFRA_AUDIT_CHECKLIST — Implementation Plan

**Stage:** INFRA_AUDIT_CHECKLIST  
**Phase:** 01_PLATFORM_FOUNDATION  
**Runtime Dir:** `specs/runtime/infra-002-audit-checklist/`  
**Branch:** `infra-002-audit-checklist`  
**Authored:** 2026-03-04  
**Package Manager:** bun  
**Plan Status:** COMPLETE

---

## 1. Overview

This plan delivers a complete, non-destructive infrastructure audit of the Zidney monorepo. The
outputs are:

1. **`scripts/infra-audit.ts`** — a repeatable Bun-compatible read-only script that collects audit
   data and writes `infra-audit-report.json`.
2. **`reports/GAP_REPORT.md`** — a structured document listing every gap between current state and
   target governance posture.
3. **`reports/RISK_CLASSIFICATION.md`** — a risk-level table (LOW/MEDIUM/HIGH/CRITICAL) with
   one-sentence rationale per gap.
4. **`reports/SAFE_ROLLOUT_PLAN.md`** — a sequenced remediation plan from lowest to highest risk.

No source code, configuration, schema, CI workflow, or test file is modified. The only permitted
write operations are creating `scripts/infra-audit.ts` and writing the ephemeral
`infra-audit-report.json` at runtime.

This stage is a prerequisite for `STAGE_INFRA_GOVERNANCE`. No governance enforcement work may begin
until all three report documents are present and approved.

---

## 2. Approach

This is a **read-only audit stage**. The execution strategy is:

1. **Run the audit script** (`scripts/infra-audit.ts`) to automate data collection for Vitest config
   inventory, ESLint config inventory, test file counts, README presence, and skipped/flaky test
   markers.
2. **Manually supplement** where the script cannot reach: ESLint rule severity values (require
   parsing flat config JS modules), CI workflow enforcement posture (YAML file reading), README
   section completeness, and Bun command exit codes.
3. **Produce written deliverables** by synthesising script output (`infra-audit-report.json`) and
   manual findings into the three report documents.

The script never modifies tracked files. All writes go to the ephemeral `infra-audit-report.json`
(gitignored). Report documents are new files under
`specs/runtime/infra-002-audit-checklist/reports/`, which is the only permitted output location for
committed artifacts.

---

## 3. Implementation Phases

### Phase 0: Research & Setup

**Goal:** Verify the environment is ready before any audit execution.

**Tasks:**

| ID    | Task                                                                          | Method               |
| ----- | ----------------------------------------------------------------------------- | -------------------- |
| P0-01 | Confirm `bun --version` ≥ 1.0 at repo root                                    | Terminal             |
| P0-02 | Confirm `infra-audit-report.json` is listed in `.gitignore`; add it if absent | File check           |
| P0-03 | Record current git commit SHA for audit timestamping                          | `git rev-parse HEAD` |
| P0-04 | Verify all 5 vitest configs exist (see research.md §3)                        | File check           |
| P0-05 | Verify all 4 ESLint configs exist (see research.md §4)                        | File check           |
| P0-06 | Verify all 4 GitHub workflow files exist (see research.md §5)                 | File check           |
| P0-07 | Confirm `specs/runtime/infra-002-audit-checklist/reports/` directory exists   | Directory check      |

**Exit criteria:** Bun ≥ 1.0 confirmed; `infra-audit-report.json` gitignored; `reports/` directory
present; git SHA recorded.

---

### Phase 1: Audit Script

**Goal:** Create `scripts/infra-audit.ts` and run it to produce `infra-audit-report.json`.

**File:** `scripts/infra-audit.ts` (the only new source file in this stage)

**Script responsibilities:**

The script must perform the following scans using only Bun/Node built-ins (`fs`, `path`, `process`).
No cross-app imports. No network requests.

#### 1.1 Filesystem Scanner (Core)

- Recursively walk the entire repository from `process.cwd()`.
- Skip directories: `node_modules`, `.git`, `.DS_Store`.
- Skip files matching secret patterns: `.env`, `.env.*`, `*.pem`, `*.key`, `*.secret`, `*.p12`,
  `*.pfx`, `docker-compose.override.yml` — log each as `"SKIPPED (secret pattern)"`.
- On file parse error: catch, log `"PARSE_ERROR"` with path and message, continue processing; do not
  abort.

#### 1.2 Vitest Config Inventory (FR-US1)

- Locate all files named `vitest.config.ts`, `vitest.config.js`, `vitest.workspace.ts`,
  `vitest.workspace.js`.
- For each: record `path`, attempt to read `test.environment`, `globals`, coverage-enabled flag,
  custom reporters.
- Flag conflicts where two configs define different values for the same property.
- Classify consolidation risk: LOW (0–1 conflict), MEDIUM (2–3), HIGH (4+).

#### 1.3 ESLint Config Inventory (FR-US3-1)

- Locate all files matching `eslint.config.*`, `.eslintrc.*`, `.eslintrc.js`, `.eslintrc.json`,
  `.eslintrc.yaml`, `.eslintrc.yml`.
- For each: record `path`, format (flat vs legacy).
- Rule severity extraction is marked as a manual supplement (flat config files are ES modules and
  cannot be statically imported at scan time without executing them).
- Check `package.json` at root and per-app for presence of `eslint-config-prettier` and `prettier`
  in `devDependencies`.

#### 1.4 Test File Counter (FR-US2-1, FR-US2-2)

- Count files matching `**/*.test.ts` and `**/*.test.js` under `apps/*/src/` → unit test count per
  app.
- Count files under `tests/integration/` and `apps/*/tests/integration/` → integration test count.
- Count files matching `**/*.spec.ts` → spec test count (separate bucket).

#### 1.5 Playwright Config Detector (FR-US2-3)

- Locate all files named `playwright.config.ts`, `playwright.config.js`.
- Per app: record TRUE/FALSE for Playwright presence.
- If none found: record all apps as `"e2ePresent": false`.

#### 1.6 README Presence Scanner (FR-US6-1, FR-US6-2)

- For each directory directly under `apps/` and `packages/`:
  - Check for `README.md` (case-insensitive).
  - If present: scan for required sections (case-insensitive `#`–`###` headings):
    - `Purpose`, `Responsibilities`, `Dependencies`, `Public API` (packages only),
      `How to Run Tests`, `Environment Variables`, `Known Boundaries`.
  - For each section: classify as `PRESENT` (heading + non-blank body), `PRESENT_EMPTY` (heading
    only), or `MISSING`.
- If README absent: classify the entire directory as `README_MISSING`.

#### 1.7 Skipped & Flaky Test Scanner (FR-US7-3, FR-US7-4 via CL5)

- Scan all test source files for:
  - `.skip(` → skipped test marker
  - `.todo(` → todo test marker
  - `xit(`, `xdescribe(` → legacy skip patterns
  - `.retry(` → flaky test marker
  - `// flaky`, `// FLAKY`, `// unstable`, `// UNSTABLE` → comment markers
  - Vitest config key `retry:` with value ≥ 1
- Record counts per app with `"detectionMethod": "STATIC_SCAN_ONLY"`.

#### 1.8 JSON Output (AC-US9-3)

Write `infra-audit-report.json` to repo root with top-level keys:

```json
{
  "timestamp": "<ISO 8601>",
  "gitSha": "<commit SHA>",
  "vitestConfigs": [...],
  "eslintConfigs": [...],
  "playwrightConfigs": [...],
  "totalTestFiles": {...},
  "readmeAudit": {...},
  "skippedTests": {...},
  "flakyTests": {...},
  "consolidationRisk": "LOW|MEDIUM|HIGH",
  "prettierConflictRisk": "SAFE|NEEDS ALIGNMENT|CONFLICT PRESENT"
}
```

Overwrite silently on re-run (CL2). Exit code 0 as long as scan completes (CL4).

#### 1.9 Console Output (NFR-O1)

Emit structured section headers to stdout:

```
[INFRA AUDIT] Phase: Vitest Config Inventory...
[INFRA AUDIT] Phase: ESLint Config Inventory...
[INFRA AUDIT] Phase: Test File Counter...
[INFRA AUDIT] Phase: Playwright Detector...
[INFRA AUDIT] Phase: README Scanner...
[INFRA AUDIT] Phase: Skipped/Flaky Test Scanner...
[INFRA AUDIT] Writing infra-audit-report.json...
[INFRA AUDIT] ✓ Complete. Output: infra-audit-report.json
```

**Exit criteria:** `bun run scripts/infra-audit.ts` exits 0; `infra-audit-report.json` is present at
repo root; JSON contains all required keys from AC-US9-3.

---

### Phase 2: Manual Audit Supplements

The following audit areas cannot be fully automated by the script and require manual inspection
during implementation. Each must be incorporated into the written reports.

> **Plan-to-Tasks Sub-group Mapping (M3 remediation):** During task decomposition, Phase 2 expanded
> to 8 sub-groups. The 4 additional sub-groups not named as separate plan sub-phases are: Vitest
> Config Detail (tasks T020–T025, maps to US1), Test Distribution Verification (T026, maps to US2),
> Skipped/Flaky Test Verification (T047, maps to US7), and Enforcement Readiness Score Synthesis
> (T048–T049, maps to US8). These are covered by FR-US1, FR-US2, FR-US7, and FR-US8 respectively.

| tasks.md Sub-group                  | Plan Section                                     | US Labels |
| ----------------------------------- | ------------------------------------------------ | --------- |
| §2.1 Vitest Config Detail           | Derived from script output (FR-US1)              | US1       |
| §2.2 Test Distribution Verification | Derived from script output (FR-US2)              | US2       |
| §2.3 ESLint Rule Severity           | §2.1 ESLint Rule Severity Scan                   | US3       |
| §2.4 CI Pipeline Audit              | §2.2 CI Pipeline Enforcement Posture             | US4       |
| §2.5 README Completeness            | §2.3 README Section Completeness                 | US6       |
| §2.6 Command Execution              | §2.4 Technical Debt Snapshot — Command Execution | US5, US7  |
| §2.7 Skipped/Flaky Verification     | Derived from script output (FR-US7-4)            | US7       |
| §2.8 Readiness Score                | Synthesis of §2.1–§2.7 (FR-US8)                  | US8       |

#### 2.1 ESLint Rule Severity Scan (FR-US3-2)

**Why manual:** Flat config files (`eslint.config.mjs`, `eslint.config.js`) are ES modules.
Statically parsing rule severity without executing them is not reliable.

**Method:** Open each ESLint config file and extract severity for:

- `no-unused-vars`
- `@typescript-eslint/no-explicit-any`
- `no-console`
- `vue/multi-word-component-names`

**Files to inspect:**

- `eslint.config.mjs` (root)
- `apps/backoffice/eslint.config.js`
- `apps/frontoffice/eslint.config.js`
- `apps/mmc/eslint.config.js`

**Output:** Rule severity table per config in Gap Report §ESLint.

#### 2.2 CI Pipeline Enforcement Posture (FR-US4)

**Why manual:** YAML parsing is feasible but job step interpretation requires understanding of the
specific workflow structure.

**Method:** Read each workflow file and identify per-job whether these steps are Present / Absent /
Informational (non-failing):

- Lint
- Type Check
- Unit Tests
- Integration Tests
- E2E Tests
- Coverage Gate

**Files to inspect:**

- `.github/workflows/test-stage-001.yml`
- `.github/workflows/typecheck.yml`
- `.github/workflows/mmc-dashboard-deploy.yml`
- `.github/workflows/hard-mode-guard.yml`

**Output:** Workflow audit table in Gap Report §CI.

#### 2.3 README Section Completeness (partial — AC-US6-2)

The script confirms presence/absence and runs the section heading check. The manual step is to
verify quality of body content for the 2 present READMEs (`packages/types`, `packages/ui-system`)
beyond what the script can infer.

#### 2.4 Technical Debt Snapshot — Command Execution (FR-US7-1, FR-US7-2, FR-US5)

These commands must be run manually (read-only) and their output recorded:

| Command                          | Records                                       |
| -------------------------------- | --------------------------------------------- |
| `bun install`                    | Exit code; any compatibility warnings         |
| `bun run typecheck:src --noEmit` | TypeScript error count                        |
| `bun run lint`                   | ESLint error count, warning count             |
| `bun test --coverage`            | Exit code; raw coverage Lines/Fn/Stmt/Branch% |
| `bun run build`                  | Exit code; any build errors                   |

**Rules (from CL1):** Run full test suite; record DB-gated failures as `"DB-GATED"` entries; do not
filter by test type; record partial coverage.

**Output:** Debt snapshot table in Gap Report §Technical Debt; Bun compatibility verdict in Gap
Report §Bun.

---

### Phase 3: Written Deliverables

Three markdown documents must be authored under `specs/runtime/infra-002-audit-checklist/reports/`.
Each must include a "Related Documents" section at the top with relative markdown links to the other
two (CL8).

#### 3.1 Gap Report (`reports/GAP_REPORT.md`)

Structure:

```
# Gap Report — INFRA_AUDIT_CHECKLIST
## Related Documents
## Audit Metadata (timestamp ISO 8601, git SHA, auditor)
## §1 Vitest Configuration Inventory
## §2 Test Distribution Audit
## §3 ESLint Configuration Audit
## §4 CI Pipeline Audit
## §5 Bun Compatibility Check
## §6 README Coverage Audit
## §7 Technical Debt Snapshot
## §8 Enforcement Readiness Score
```

**Enforcement Readiness Score verdict rule (CL7, must appear verbatim above the table):**

- 0 NEEDS WORK → `READY FOR ENFORCEMENT`
- 1–3 NEEDS WORK → `PARTIAL — FIX REQUIRED`
- 4–6 NEEDS WORK → `NOT READY`

Must contain ≥ 1 finding per audit area (AC-US10-1).

#### 3.2 Risk Classification (`reports/RISK_CLASSIFICATION.md`)

Structure:

```
# Risk Classification — INFRA_AUDIT_CHECKLIST
## Related Documents
## Classification Table
  | Gap ID | Gap Description | Risk Level | Rationale |
## Summary Counts
```

Risk levels: LOW / MEDIUM / HIGH / CRITICAL. One-sentence rationale per entry (AC-US10-2).

Known pre-classified gaps from research (before script runs):

- All 5 `apps/*` READMEs missing → HIGH
- 6 of 8 `packages/*` READMEs missing → HIGH
- No Playwright config in any app → MEDIUM (E2E not configured)
- No `vitest.workspace.*` at root → MEDIUM (config fragmentation risk)
- ESLint configs absent for `apps/api`, `apps/worker`, all packages → MEDIUM

#### 3.3 Safe Rollout Plan (`reports/SAFE_ROLLOUT_PLAN.md`)

Structure:

```
# Safe Rollout Plan — INFRA_AUDIT_CHECKLIST
## Related Documents
## Sequencing Rationale
## Phase 1: LOW-Risk Remediation (pre-requisites)
## Phase 2: MEDIUM-Risk Remediation (requires Phase 1 complete)
## Phase 3: HIGH/CRITICAL Remediation (requires Phase 2 verified)
## Governance Gate: Requirements Before STAGE_INFRA_GOVERNANCE
```

Must sequence from lowest to highest risk. Must not allow any step before its predecessor is
verified complete (AC-US10-3).

Mandatory governance gate: No `STAGE_INFRA_GOVERNANCE` task may be opened until all three documents
are present and reviewed (FR-US10-5, AC-US10-5).

---

## 4. File Inventory

### Files Created (New — This Stage Only)

| File Path                                                                | Type           | Phase   | Committed?      |
| ------------------------------------------------------------------------ | -------------- | ------- | --------------- |
| `scripts/infra-audit.ts`                                                 | Source (TS)    | Phase 1 | YES             |
| `specs/runtime/infra-002-audit-checklist/plan.md`                        | Spec Artifact  | —       | YES             |
| `specs/runtime/infra-002-audit-checklist/research.md`                    | Spec Artifact  | —       | YES             |
| `specs/runtime/infra-002-audit-checklist/quickstart.md`                  | Spec Artifact  | —       | YES             |
| `specs/runtime/infra-002-audit-checklist/reports/GAP_REPORT.md`          | Audit Report   | Phase 3 | YES             |
| `specs/runtime/infra-002-audit-checklist/reports/RISK_CLASSIFICATION.md` | Audit Report   | Phase 3 | YES             |
| `specs/runtime/infra-002-audit-checklist/reports/SAFE_ROLLOUT_PLAN.md`   | Audit Report   | Phase 3 | YES             |
| `infra-audit-report.json` (repo root, ephemeral)                         | Runtime Output | Phase 1 | NO (.gitignore) |

**Total new committed files: 7**  
**Total new ephemeral files: 1**

### Files Modified (Existing)

| File Path    | Modification                                                                      | Phase   |
| ------------ | --------------------------------------------------------------------------------- | ------- |
| `.gitignore` | Add `infra-audit-report.json` entry if not already present (Phase 0 verification) | Phase 0 |

> Note: `.gitignore` modification is a one-line additive append only, strictly to prevent the
> ephemeral output file from being committed (R7 mitigation). If the entry already exists, no
> modification is made.

### Files NOT Modified

All of the following are READ-ONLY during this stage:

- All `apps/*/src/**` files
- All `packages/*/src/**` files
- All `vitest.config.*` files
- All `eslint.config.*` files
- All `.github/workflows/*.yml` files
- All `tsconfig*.json` files
- All `package.json` files
- All migration files
- All test files

---

## 5. Security & Constitutional Constraints

| Constraint           | Rule                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| No secrets in output | Script skips `.env`, `.env.*`, `*.pem`, `*.key`, `*.secret`, `*.p12`, `*.pfx`, `docker-compose.override.yml`                 |
| No network requests  | Script uses only `fs` and `path` — no `fetch`, no HTTP                                                                       |
| No config changes    | Zero modifications to any ESLint, Vitest, TypeScript, or Docker config                                                       |
| No test changes      | Zero modifications to any test file                                                                                          |
| No schema changes    | No migrations, no DB access, no tenant resolver invoked                                                                      |
| Import boundaries    | `scripts/infra-audit.ts` imports only Bun/Node built-ins (`fs`, `path`, `process`). No imports from `apps/*` or `packages/*` |
| Ephemeral output     | `infra-audit-report.json` is gitignored before its first write                                                               |
| Trust Chain          | No portion of this stage touches the Isolation → License → Authentication chain                                              |

---

## 6. Validation Plan

All of the following must pass before this stage may be marked complete:

| Check                                 | Method                                                  | Pass Criteria                                                                                                |
| ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Audit script executes                 | `bun run scripts/infra-audit.ts`                        | Exit code 0; `infra-audit-report.json` present                                                               |
| JSON output keys present              | `cat infra-audit-report.json \| bun -e "..."` or manual | Contains `vitestConfigs`, `eslintConfigs`, `playwrightConfigs`, `totalTestFiles`, `readmeAudit`, `timestamp` |
| Lint passes                           | `bun run lint`                                          | 0 new errors introduced by `scripts/infra-audit.ts`                                                          |
| Type check passes                     | `bun run typecheck:src --noEmit`                        | 0 new TypeScript errors introduced                                                                           |
| Gap Report present and valid          | File check                                              | `reports/GAP_REPORT.md` non-empty, ≥ 1 finding per audit area                                                |
| Risk Classification present           | File check                                              | `reports/RISK_CLASSIFICATION.md` non-empty, risk level per gap                                               |
| Safe Rollout Plan present             | File check                                              | `reports/SAFE_ROLLOUT_PLAN.md` non-empty, steps sequenced                                                    |
| Cross-references valid                | Manual review                                           | Each report has "Related Documents" section with relative links to the other two                             |
| No tracked files modified             | `git diff --diff-filter=M`                              | Output shows ONLY `.gitignore` (if amended) — no other tracked file modified                                 |
| New files only in permitted locations | `git diff --name-only --diff-filter=A`                  | Only `scripts/infra-audit.ts` and `specs/runtime/infra-002-audit-checklist/**`                               |
| Enforcement Readiness Score present   | Review Gap Report §8                                    | Table with 6 rows; overall verdict assigned; verdict rule documented verbatim                                |

---

## 7. Risk Assessment

**Overall Stage Risk: LOW**

| Risk ID | Risk Description                                                       | Likelihood | Impact | Mitigation                                                                                   |
| ------- | ---------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------- |
| R1      | Coverage run fails due to pre-existing test errors                     | MEDIUM     | HIGH   | Record partial coverage; document broken tests as DB-GATED debt; do not block audit          |
| R2      | Flaky tests produce non-deterministic counts                           | LOW        | MEDIUM | Label counts as approximate; run twice if variance detected                                  |
| R3      | Vitest configs missed by traversal                                     | LOW        | MEDIUM | Script uses full recursive walk; confirmed 5 configs exist from filesystem scan              |
| R4      | ESLint flat config cannot be statically parsed for rule severity       | MEDIUM     | LOW    | Manual supplement in Phase 2; script captures file location only, not severity               |
| R5      | Bun incompatibility with Node-only packages surfaces during `bun test` | LOW        | MEDIUM | Record non-zero exit codes with full error; classify as INCOMPATIBLE if blocking             |
| R6      | Engineers begin remediation before Gap Report is approved              | MEDIUM     | HIGH   | Governance gate in SAFE_ROLLOUT_PLAN.md; workflow-state.json `implementation_allowed: false` |
| R7      | `infra-audit-report.json` accidentally committed                       | LOW        | LOW    | Phase 0 ensures entry in `.gitignore` before first run                                       |
| R8      | TypeScript error count disputed as representing wrong codebase state   | LOW        | MEDIUM | Git SHA recorded in `infra-audit-report.json` and Gap Report audit metadata                  |

**Rollback:** Delete the 4 new committed files (`scripts/infra-audit.ts` + 3 report documents).
Revert any `.gitignore` amendment. No runtime impact; no DB state changes.
