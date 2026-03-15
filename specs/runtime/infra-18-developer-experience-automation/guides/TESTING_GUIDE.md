# Testing Guide — INFRA-18 Developer Experience Automation

**Stage:** INFRA-18 — Developer Experience Automation  
**Branch:** `spec/infra-18-developer-experience-automation`  
**Author:** Zidney Orchestrator (Step 7 — Closure)  
**Date:** 2025-07-15

---

## Overview

This guide covers how to manually test, re-run automated tests, and verify the four
developer CLI scripts introduced in this stage. Share with any QA engineer or
reviewing developer before PR approval.

---

## Pre-requisites

```bash
bun --version      # must satisfy >=1.3.9
git status         # should be on spec/infra-18-developer-experience-automation
```

---

## Automated Test Suites

### Unit Tests (81 tests)

```bash
bun vitest run tests/unit/dev-scripts/ --reporter=verbose
```

Expected output:

```
✓ tests/unit/dev-scripts/repo-doctor.test.ts (22 tests) passed
✓ tests/unit/dev-scripts/repo-fix.test.ts (19 tests) passed
✓ tests/unit/dev-scripts/repo-onboard.test.ts (23 tests) passed
✓ tests/unit/dev-scripts/repo-status.test.ts (17 tests) passed

Test Files  4 passed (4)
Tests      81 passed (81)
```

### Integration Test (CLI Smoke Test)

```bash
bun vitest run tests/integration/dev-scripts/ --reporter=verbose
```

Expected output: smoke tests for `repo:doctor` printing valid output with 7+ check
lines, an `N/7` summary line, and no sentinel values like `[REDACTED]` or `undefined`.

---

## Manual CLI Tests

### 1. Repo Doctor — Health Check

```bash
bun repo:doctor
```

Expected: colored list of 7 health checks, summary line `N/7 checks passed`.
Exit code: `0` (success) or non-zero if any error checks fail.

Check each row appears:

- Dependencies check
- Workspace links check
- Architecture guard check
- Architecture brain check
- AI context check
- .env file check
- TypeScript check

### 2. Repo Fix — Automated Repair

```bash
bun repo:fix
```

Expected: 5 steps execute in sequence. Each prints a spinner-style status.
`repo:fix` continues even if a step fails (continue-on-error). Safe to re-run.

Verify idempotency:

```bash
bun repo:fix && bun repo:fix   # run twice, should produce same output both times
```

### 3. Repo Onboard — New Developer Setup

```bash
bun repo:onboard
```

Expected: 7 steps checking Bun version, installing dependencies, running DB migrations,
seeding, running doctors, etc. Step 1 (Bun version check) will abort the entire process
if the installed Bun version doesn't satisfy `>=1.3.9`.

Simulate version mismatch by temporarily testing `satisfiesSemver()` directly — do NOT
modify the actual version check in production.

### 4. Repo Status — Read-only Summary

```bash
bun repo:status
```

Expected: always exits 0, no side effects. Prints a padded table of status strings.
Output format: `<name padded 23 chars> : <value>` with a separator at column 23.

Verify always exits 0:

```bash
bun repo:status; echo "Exit code: $?"   # should always print "Exit code: 0"
```

---

## Security Contract Verification

### H-01 — Status String Allowlist (`repo-status.ts`)

The `safeStatus()` function must:

- Strip non-printable characters (anything outside `[\x20-\x7E]`)
- Truncate to max 32 characters
- Only allow values from `KNOWN_STATUSES`; return `"unknown"` for anything else

Test: `tests/unit/dev-scripts/repo-status.test.ts` → `safeStatus` describe block (5 tests)

### H-02 — Detail Sanitization (all scripts)

The `sanitizeDetail()` functions in all 4 scripts must:

- Extract only the first line of subprocess output
- Strip non-printable characters via `[^\x20-\x7E]`
- Truncate to max 120 characters

Test: `tests/unit/dev-scripts/repo-doctor.test.ts`, `repo-fix.test.ts`, `repo-onboard.test.ts` → `sanitizeDetail` describe blocks

### M-01 — Semver Comparison Safety (`repo-onboard.ts`)

The `satisfiesSemver()` function must:

- Strip pre-release suffixes before comparison
- Use numeric comparison (not string comparison)
- On parse failure, treat as satisfying (continue)

Test: `tests/unit/dev-scripts/repo-onboard.test.ts` → `satisfiesSemver` describe block (9 cases including edge cases)

### M-02 — Path Traversal Boundary (`repo-fix.ts`)

The `safeDel()` function must:

- Resolve real path via `realpathSync` before deletion
- Verify the real path starts with the repository root
- Refuse deletion if the path is outside the repo root

Test: `tests/unit/dev-scripts/repo-fix.test.ts` → `safeDel` describe block (M-02 boundary cases)

### L-01 — .env Value Blindness (`repo-doctor.ts`)

The `checkEnvFile()` function must:

- Compare key names only (not values) between `.env.example` and `.env`
- Never log or expose actual `.env` values

Test: `tests/unit/dev-scripts/repo-doctor.test.ts` → `checkEnvFile` describe block

---

## CI/CD Verification

Check that the `repo-doctor` job runs in the CI pipeline:

1. Push the branch to GitHub
2. Navigate to the Actions tab on GitHub
3. Find the PR or branch run
4. Verify a `repo-doctor` job appears in GROUP 1: CODE QUALITY (runs in parallel with lint, typecheck, etc.)
5. The job should execute `bun repo:doctor`

---

## Rollback Procedure

If any issue is found after merge, this stage introduces only developer tooling scripts.
No production code paths, DB schemas, or API routes were modified. Rollback is as simple
as reverting the commit or deleting the 4 scripts. No migration rollback required.

---

## Files to Review in This PR

| File                                                            | Purpose                      | Reviewer Focus                  |
| --------------------------------------------------------------- | ---------------------------- | ------------------------------- |
| `scripts/dev/formatter.ts`                                      | Shared output formatter      | API surface, color codes        |
| `scripts/dev/repo-doctor.ts`                                    | Health check runner          | Security H-01, H-02, L-01       |
| `scripts/dev/repo-fix.ts`                                       | Repair runner                | Security M-02 boundary check    |
| `scripts/dev/repo-onboard.ts`                                   | Onboarding runner            | Security M-01, hard-abort logic |
| `scripts/dev/repo-status.ts`                                    | Status summary               | Always-exits-0 contract         |
| `tests/unit/dev-scripts/*.test.ts`                              | 81 unit tests                | Coverage completeness           |
| `tests/integration/dev-scripts/repo-doctor.integration.test.ts` | CLI smoke test               | End-to-end validity             |
| `package.json`                                                  | Script entries + engines.bun | Version constraint correct      |
| `.github/workflows/ci.yml`                                      | CI job                       | Job group, parallel execution   |
| `README.md`                                                     | Developer docs               | Commands table accuracy         |
