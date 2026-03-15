# PR Summary — INFRA-18 Developer Experience Automation

## Title

`feat(infra-18): add developer experience automation scripts (repo:doctor, repo:fix, repo:onboard, repo:status)`

---

## PR Description

### What does this PR do?

Introduces a standardized Developer Experience (DX) automation layer for the Zidney monorepo.
Four new CLI scripts provide health diagnostics, automated repair, new developer onboarding,
and a read-only health summary. All scripts share a common output formatter and follow a strict
security contract (H-01 through L-01).

### Why?

New contributors currently have no reliable way to verify their local environment is correctly
set up. Experienced developers have no quick way to audit repo health or run automated repairs.
These scripts close both gaps while remaining safe and idempotent.

---

## Changes

### New Files

| File                                                            | Purpose                                                                    |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `scripts/dev/formatter.ts`                                      | Shared output formatter: `CheckStatus`, `line()`, `section()`, `summary()` |
| `scripts/dev/repo-doctor.ts`                                    | 7-check health diagnostic — exits non-zero on errors                       |
| `scripts/dev/repo-fix.ts`                                       | 5-step automated repair runner — idempotent, continue-on-error             |
| `scripts/dev/repo-onboard.ts`                                   | 7-step onboarding runner — hard abort on Bun version mismatch              |
| `scripts/dev/repo-status.ts`                                    | Read-only health summary — always exits 0                                  |
| `tests/unit/dev-scripts/repo-doctor.test.ts`                    | 22 unit tests                                                              |
| `tests/unit/dev-scripts/repo-fix.test.ts`                       | 19 unit tests                                                              |
| `tests/unit/dev-scripts/repo-onboard.test.ts`                   | 23 unit tests                                                              |
| `tests/unit/dev-scripts/repo-status.test.ts`                    | 17 unit tests                                                              |
| `tests/integration/dev-scripts/repo-doctor.integration.test.ts` | CLI smoke test                                                             |

### Modified Files

| File                       | Change                                                  |
| -------------------------- | ------------------------------------------------------- |
| `package.json`             | Added `engines.bun: ">=1.3.9"` + 4 `repo:*` npm scripts |
| `.github/workflows/ci.yml` | Added `repo-doctor` quality job to GROUP 1              |
| `README.md`                | Added Developer Quick Commands reference table          |

---

## How to Test

```bash
# All automated tests (81 unit + integration)
bun vitest run tests/unit/dev-scripts/ tests/integration/dev-scripts/

# Individual scripts
bun repo:doctor     # health check
bun repo:status     # read-only summary, always exits 0
bun repo:fix        # run automated repairs
bun repo:onboard    # new developer setup
```

For full testing instructions including security contract verification, see:
`specs/runtime/infra-18-developer-experience-automation/guides/TESTING_GUIDE.md`

---

## Security Contracts Implemented

| Contract | Location                              | Description                                     |
| -------- | ------------------------------------- | ----------------------------------------------- |
| H-01     | `repo-status.ts` `safeStatus()`       | Status allowlist, non-printable strip, max 32   |
| H-02     | All scripts `sanitizeDetail()`        | First-line only, `[^\x20-\x7E]` strip, max 120  |
| M-01     | `repo-onboard.ts` `satisfiesSemver()` | Pre-release strip, numeric compare, fail-open   |
| M-02     | `repo-fix.ts` `safeDel()`             | `realpathSync` + repo-root boundary enforcement |
| L-01     | `repo-doctor.ts` `checkEnvFile()`     | Key-name-only comparison, value blindness       |

---

## Validation Evidence

| Check                | Result                         |
| -------------------- | ------------------------------ |
| Unit tests           | ✅ 81 / 81 passed              |
| Integration test     | ✅ CLI smoke test passed       |
| Biome lint           | ✅ 0 errors across 1745 files  |
| TypeScript typecheck | ✅ 0 errors                    |
| Architecture guard   | ✅ Import boundaries respected |

---

## Constitutional Compliance

- No database access, no API routes, no production code paths changed
- Import boundary: only `packages/types` + Node.js built-ins (no cross-layer violations)
- `console.log` absent in all scripts — `process.stdout.write` only
- No secrets, no environment variables accessed
- All scripts run under `import.meta.main` guard — safe to import in tests

---

## Stage Tracking

- **Stage file:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md`
- **Stage runtime:** `specs/runtime/infra-18-developer-experience-automation/`
- **Tasks:** 13 / 13 completed
- **Status:** PRODUCTION READY

---

## Reviewers

Please review the security contracts particularly:

1. `safeDel()` in `repo-fix.ts` — path traversal prevention (M-02)
2. `safeStatus()` in `repo-status.ts` — injection prevention (H-01)
3. `checkEnvFile()` in `repo-doctor.ts` — value blindness (L-01)

All security contracts are covered by dedicated unit tests.
