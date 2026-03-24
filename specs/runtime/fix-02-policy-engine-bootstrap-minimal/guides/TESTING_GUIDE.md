# Testing Guide — STAGE FIX 02 — Policy Engine Bootstrap Minimal

**Stage:** STAGE FIX 02 — Policy Engine Bootstrap Minimal  
**Phase:** 0X_FIXES  
**Stage Directory:** fix-02-policy-engine-bootstrap-minimal  
**Generated On:** 2026-03-24

---

## Purpose

This guide explains how to validate the Policy Engine bootstrap implementation end-to-end. The stage introduces a minimal CLI-based governance engine that executes rule-based checks via Bun.

---

## Summary of Delivered Behavior

The Policy Engine provides a foundation for executing registered rules sequentially with per-rule success/failure reporting and selective execution modes.

Key outcomes:

- CLI entry point accepts `--changed` flag to select execution mode
- Rules are registered in a central registry and executed sequentially
- Per-rule output formatted as `[PASS]` or `[FAIL] <message>`
- Exit code 0 on all-pass; exit code 1 if any error-severity rule fails
- Empty registry early-exits with informational message without failure

---

## Prerequisites

| Requirement             | Validation Command / Check                                     |
| ----------------------- | -------------------------------------------------------------- |
| Node.js installed       | `node --version` (v20+)                                        |
| Bun installed           | `bun --version` (v1+)                                          |
| Repository root checked | `git branch` includes `fix-02-policy-engine-bootstrap-minimal` |
| No staged changes       | `git status --porcelain` shows clean (except stage branch)     |

---

## Files in Scope

```text
scripts/policy-engine/types.ts       (15 LOC) — Interfaces
scripts/policy-engine/registry.ts    (10 LOC) — Rule registry
scripts/policy-engine/runner.ts      (30 LOC) — CLI executor
package.json                         (1 line added) — validate:policy script
```

No migrations. No API endpoints. No UI changes.

---

## Quick Verification Commands

```bash
# Navigate to repo root
cd /Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2

# Run the policy check in default mode
bun run validate:policy

# Expected output:
# [PASS] dummy
# Policy check passed
# Exit: 0
```

---

## Automated Validation Commands

```bash
# Type-check the entire project (including new files)
bun run typecheck

# Expected: no errors

# Lint the new policy-engine files
bun biome check scripts/policy-engine/

# Expected: 0 errors

# Run unit tests (if any test suites exist)
bun test

# Expected: all pass (or no tests yet if not applicable)
```

---

## Manual Test Scenarios

### Scenario 1 — Default Mode Execution

**Purpose:** Verify the policy engine runs all registered rules in full mode and reports results correctly.

1. Ensure you are on branch `spec/fix-02-policy-engine-bootstrap-minimal`
2. Run: `bun run validate:policy`
3. Observe the output contains exactly one line: `[PASS] dummy`
4. Confirm the final line is: `Policy check passed`
5. Verify exit code is 0: `echo $?` should output `0`

Expected: All passes, clean exit.

Troubleshooting: If exit code is 1, check for any error-severity rules in registry.ts. Dummy rule should have `success: true`.

---

### Scenario 2 — Changed Mode Execution

**Purpose:** Verify the `--changed` flag is parsed and mode context is set correctly.

1. Run: `bun run validate:policy --changed`
2. Observe the output contains exactly one line: `[PASS] dummy`
3. Confirm the final line is: `Policy check passed`
4. Verify exit code is 0

Expected: Identical output to Scenario 1 (dummy rule doesn't differentiate modes yet).

Troubleshooting: If `--changed` is not recognized, ensure runner.ts line 4 correctly parses `process.argv`.

---

### Scenario 3 — Empty Registry Handling

**Purpose:** Verify that an empty rule registry early-exits with informational message, not failure.

Manual test (requires code edit):

1. Temporarily edit `scripts/policy-engine/registry.ts`, line 10:
   ```ts
   export const rules: PolicyRule[] = [];
   ```
2. Run: `bun run validate:policy`
3. Observe output: `Policy check passed — no rules registered`
4. Verify exit code is 0

Expected: Early exit, message, exit 0 (no failure just because registry is empty).

Restore `registry.ts` line 10 to `export const rules: PolicyRule[] = [dummyRule];` after testing.

Troubleshooting: If exit code is 1, check runner.ts line 7 early-exit logic.

---

### Scenario 4 — Error-Severity Rule Failure

**Purpose:** Verify that an error-severity rule failure causes exit 1 and correct failure message.

Manual test (requires code edit):

1. Edit `scripts/policy-engine/registry.ts`, replace dummy rule (lines 3–7) with:
   ```ts
   const testRule: PolicyRule = {
     id: "failing-test",
     async run(_ctx) {
       return {
         ruleId: "failing-test",
         success: false,
         severity: "error",
         message: "test failure",
       };
     },
   };
   ```
2. Edit line 10: `export const rules: PolicyRule[] = [testRule];`
3. Run: `bun run validate:policy`
4. Observe output includes: `[FAIL] failing-test: test failure`
5. Observe final line: `Policy check failed`
6. Verify exit code is 1: `echo $?` should output `1`

Expected: Failure detected, correct message, exit 1.

Restore `registry.ts` to original after testing.

Troubleshooting: If exit code is 0 despite failure, check runner.ts line 23 severity check logic.

---

## Type Safety Verification

```bash
# Navigate to repo root and run full type-check
cd /Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2
bun run typecheck

# Should output nothing and exit 0 (no type errors)
```

---

## Code Review Checklist for QA

- [ ] All 3 TypeScript files exist: types.ts, registry.ts, runner.ts
- [ ] Total LOC ≤ 200 (actual: 55)
- [ ] Both manual scenarios 1 & 2 pass (default + --changed)
- [ ] `bun run validate:policy` exits 0 in default state
- [ ] Empty registry exits 0 with informational message
- [ ] Error-severity rule exits 1 (manual test scenario 4)
- [ ] Biome lint passes: `bun biome check scripts/policy-engine/` exits 0
- [ ] TypeScript typecheck passes: `bun run typecheck` exits 0
- [ ] package.json contains `"validate:policy"` script entry

---

## Troubleshooting

| Issue                               | Potential Cause                  | Resolution                                                       |
| ----------------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| `bun run validate:policy` not found | Script not added to package.json | Check root package.json for `validate:policy` entry              |
| Exit code 1 on default run          | Error-severity rule in registry  | Ensure dummy rule has `success: true`                            |
| `--changed` flag ignored            | runner.ts not parsing argv       | Verify line 4 of runner.ts: `process.argv.includes("--changed")` |
| Type errors in typecheck            | Import statements incorrect      | Verify `import type { ... } from "./types"` syntax               |
| Biome lint errors                   | Formatting/import order issues   | Run `bun biome check --write scripts/policy-engine/`             |

---

## Next Steps for Reviewers

1. Run all manual test scenarios (1–4) to verify behavior
2. Confirm exit codes match expectations
3. Check for any additional observability or debugging needs
4. Once approved, this stage merges to `develop` and becomes PRODUCTION HARDENED
5. STAGE_FIX_03 will add real policy rules to the empty registry

---

## Contact / Questions

Refer to the full workflow artifacts:

- Stage file: `specs/phases/0X_FIXES/STAGE_FIX_02_POLICY_ENGINE_BOOTSTRAP_MINIMAL.md`
- Implementation report: `specs/runtime/fix-02-policy-engine-bootstrap-minimal/reports/IMPLEMENT_REPORT.md`
- Plan: `specs/runtime/fix-02-policy-engine-bootstrap-minimal/plan.md`
