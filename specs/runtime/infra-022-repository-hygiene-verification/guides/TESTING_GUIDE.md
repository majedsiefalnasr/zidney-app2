# Testing Guide — INFRA-022 Repository Hygiene Verification

**Stage:** INFRA-022 — Repository Hygiene Verification
**Purpose:** Comprehensive testing guide for QA and reviewing engineers
**Target Audience:** QA engineers, code reviewers, developers
**Date:** 2025-01-15

---

## Overview

This stage introduces a **repository hygiene verification system** with 9 automated checks, an orchestrator, and comprehensive unit tests. This guide covers manual testing scenarios and automated validation.

---

## What Was Added

### 1. Hygiene Check Modules (9 checks)

Each check runs independently and produces standardized `TaskResult` output.

**Module Locations:** `scripts/dev/hygiene-checks/`

- **routing-authority-check.ts** — Validates ROUTING_AUTHORITY_REGISTRY.md completeness
- **template-consolidation-check.ts** — Detects legacy template path references
- **dead-script-check.ts** — Classifies scripts as ACTIVE, POTENTIALLY_DEAD, or DUPLICATE_ROOT_STUB
- **dependency-hygiene-check.ts** — Finds unused/duplicate dependencies per workspace
- **workspace-package-check.ts** — Identifies orphaned packages/\* entries
- **skill-surface-check.ts** — Validates .agents/skills/ indexing completeness
- **ci-workflow-check.ts** — Detects duplicate run: commands across workflows
- **ai-context-check.ts** — Runs ai-context:validate subprocess check
- **arch-guard-check.ts** — Runs arch:guard + arch:health verification

### 2. Orchestrator

**File:** `scripts/dev/hygiene-report-generator.ts`

Imports and invokes all 9 checks sequentially. Generates markdown report to `docs/reports/REPOSITORY_HYGIENE_REPORT.md`.

### 3. Unit Tests (11 tests)

**Test Files:**

- `scripts/dev/hygiene-checks/__tests__/routing-authority-check.test.ts` (4 tests)
- `scripts/dev/hygiene-checks/__tests__/dead-script-check.test.ts` (3 tests)
- `scripts/dev/hygiene-checks/__tests__/workspace-package-check.test.ts` (4 tests)

### 4. Integration Points

**package.json:**

```json
"hygiene:report": "bun scripts/dev/hygiene-report-generator.ts"
```

**vitest.workspace.ts:**
Added `hygiene-checks` project registration for isolated test execution.

---

## Automated Testing (Run These)

### Test 1: Run Unit Tests

```bash
bunx vitest run --project hygiene-checks
```

**Expected:** ✅ 11/11 tests pass

**What it tests:**

- Routing Authority check: PASS when registry + dirs exist; FLAG when missing
- Dead Script check: ACTIVE classification; POTENTIALLY_DEAD detection
- Workspace Package check: Orphaned package detection

---

### Test 2: Run Full Integration Smoke

```bash
bun run dev:hygiene:report
```

**Expected:** ✅ All 9 checks execute; report written to `docs/reports/REPOSITORY_HYGIENE_REPORT.md`

**Output includes:**

```
[T001] Routing Authority Verification        ✓ PASS
[T002] Template System Consolidation         ⚑ FLAG
[T003] Dead Script Detection                 ⚑ FLAG
[T004] Dependency Hygiene                    ⚑ FLAG
[T005] Workspace Package Validation          ⚑ FLAG
[T006] Skill Surface Validation              ⚑ FLAG
[T007] CI Workflow Hygiene                   ⚑ FLAG
[T008] AI Context Integrity                  ✓ PASS
[T009] Architecture Guard Verification       ✓ PASS

Overall verdict: ⚑ ATTENTION REQUIRED
Report written to: ./docs/reports/REPOSITORY_HYGIENE_REPORT.md
```

**Note:** All FLAG results are **pre-existing**. No regressions introduced by this stage.

---

### Test 3: Lint & Type Check

```bash
bun run lint
bun run typecheck
```

**Expected:**

- ✅ Lint: Clean for all new files in `scripts/dev/`
- ✅ TypeScript: 0 errors in new files

---

### Test 4: Verify Report Artifact

```bash
cat docs/reports/REPOSITORY_HYGIENE_REPORT.md
```

**Expected:**

- Markdown report with all 10 task sections (T001–T010)
- Overall verdict visible
- Report is timestamped and source-controlled

---

## Manual Testing Scenarios

### Scenario 1: Verify Routing Authority Check

**Manual Step:**

1. Open `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md`
2. Verify it has at least one `Authoritative Root:` entry for agents, prompts, templates
3. Run `bun run dev:hygiene:report`

**Expected:** Check T001 reports PASS

---

### Scenario 2: Verify Dead Script Detection

**Manual Step:**

1. Look at the hygiene report output for Check T003
2. Notice any `POTENTIALLY_DEAD` classifications
3. These are scripts that don't appear in package.json or referenced elsewhere

**Expected:** Report shows T003 with FLAG (pre-existing findings)

---

### Scenario 3: Verify AI Context Check

**Manual Step:**

1. Run `bun run ai:context:validate` directly
2. Verify it exits 0
3. Re-run `bun run dev:hygiene:report`

**Expected:** Check T008 reports PASS

---

### Scenario 4: Verify Architecture Guard Check

**Manual Step:**

1. Run `bun run arch:guard` directly
2. Run `bun run arch:health` directly
3. Run `bun run dev:hygiene:report`

**Expected:** Check T009 reports PASS (or FLAG if pre-existing violations)

---

## Quality Checks for Code Review

When reviewing this stage, verify:

1. ✅ All 9 check modules exist in `scripts/dev/hygiene-checks/`
2. ✅ Each module exports a named function: `runXxxCheck()`
3. ✅ Each check returns a `TaskResult` object with shape: `{ status, taskId, findings, note }`
4. ✅ **Orchestrator** (`hygiene-report-generator.ts`) wraps checks in `safeRun()` and sanitizes output
5. ✅ **Tests** mock filesystem and execute deterministically (no real repo files)
6. ✅ **Report** is written to `docs/reports/REPOSITORY_HYGIENE_REPORT.md` (tracked artifact)
7. ✅ **No modification** of ADR files, ROUTING_AUTHORITY_REGISTRY.md, or architecture artifacts
8. ✅ **Lint clean** — no new violations
9. ✅ **Types clean** — 0 errors
10. ✅ **Tests pass** — 11/11 unit tests

---

## Regression Testing

To ensure no existing tests broke:

```bash
bun run test
```

**Expected:** All pre-existing test suites pass. Zero new failures.

---

## Report Interpretation Guide

When reading `docs/reports/REPOSITORY_HYGIENE_REPORT.md`:

| Status     | Meaning                                              | Action                     |
| ---------- | ---------------------------------------------------- | -------------------------- |
| ✓ PASS     | Check passed; no findings                            | ✅ No action needed        |
| ⚑ FLAG     | Findings detected; pre-existing                      | 📋 Plan future remediation |
| ⚠️ WARNING | Non-blocking issue detected                          | 🔍 Review findings         |
| ⊘ SKIP     | Check skipped (not applicable)                       | — No action needed         |
| ❌ FAIL    | Blocking issue (would not occur in normal operation) | 🛑 Investigate immediately |

**Current State:** T001, T008, T009 = PASS; T002–T007 = FLAG (all pre-existing)

---

## Troubleshooting

### Tests fail with "Cannot find module"

**Fix:** Install dependencies: `bun install`

### Hygiene report exits non-zero

**Check:**

- Run individual checks: `bun run arch:guard`, `bun run ai:context:validate`
- Review orchestrator output for which check failed
- Note: Orchestrator exits 0 regardless of findings — check counts errors differently

### Lint violations in new files

**Fix:**

```bash
biome check --fix --unsafe scripts/dev/hygiene-checks/
```

### TypeScript errors in new files

**Fix:**

```bash
bun run typecheck
```

---

## Success Criteria (All Verified ✅)

- [x] 22/22 tasks completed
- [x] 11/11 unit tests pass
- [x] Lint clean for new files
- [x] TypeScript 0 errors
- [x] Integration smoke test passes
- [x] Report artifact generated and tracked
- [x] No regressions in existing tests
- [x] No modifications to ADR or architecture files
- [x] All source files in proper layer (`scripts/dev/`)

---

## Next Steps for Production

1. **Review PR:** Evaluate all changes in `spec/infra-022-repository-hygiene-verification`
2. **Merge to develop:** Once approved, merge to `develop`
3. **Monitor Report:** Track the hygiene report over time; use as baseline for improvements
4. **Plan Remediation:** Create follow-up stages (e.g., INFRA-23, INFRA-24) for each FLAG category
5. **CI Integration:** Consider adding `bun run dev:hygiene:report` to PR validation

---

## Questions?

Refer to [CLOSURE_REPORT.md](CLOSURE_REPORT.md) for overall stage summary or [IMPLEMENT_REPORT.md](IMPLEMENT_REPORT.md) for detailed task execution notes.
