# Plan Report — STAGE_TEST_01_UI_RUNTIME_VALIDATION

**Step:** 3 — Plan  
**Timestamp:** 2026-04-08T00:00:00Z  
**Status:** COMPLETE

---

## Summary

Technical plan complete for `STAGE_TEST_01_UI_RUNTIME_VALIDATION`. This is a **validation-only stage** — no new features, no database migrations, no new API endpoints. The plan maps 22 validation criteria across 8 areas against existing test suites, identifies 5 coverage gaps (G1–G5), and provides exact file paths and `it()` structures for all new tests.

Guardian validation passed (Architecture Guardian: PASS; API Designer: PASS after one remediation cycle that corrected a Test 4.1 error format mismatch — canonical RFC 7807 vs. actual Zidney `{ success, error: { code, message } }` envelope).

---

## Inputs Reviewed

- `specs/runtime/test-01-ui-runtime-validation/spec.md` (22 tests, 8 areas)
- `specs/runtime/test-01-ui-runtime-validation/plan.md` (5-phase execution plan)
- `specs/runtime/test-01-ui-runtime-validation/research.md` (14 covered / 3 partial / 5 GAPs)

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                   |
| --------- | --------------------------------------------------------------------------------- |
| API       | None — read-only validation stage                                                 |
| Worker    | None                                                                              |
| Frontend  | Test extensions only (extends existing `error-normalizer.spec.ts` for all 3 apps) |
| DB Master | None                                                                              |
| DB Tenant | None                                                                              |

---

## Key Technical Decisions

| #   | Decision                                                                                                        | Rationale                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Phase 0 runs all existing passing suites before adding new tests                                                | Confirms pre-existing baseline is clean; fails early without writing any new code                                                                                        |
| 2   | New static analysis test (`tests/validation/static-analysis.test.ts`) uses `rg` subprocess calls                | Grep-based assertions are the most direct way to codify structural constraints (no raw `fetch`, no `.env.production` in git, no `v-html`) without modifying runtime code |
| 3   | Test 4.1 validates Zidney `{ success, error: { code, message } }` envelope — NOT canonical RFC 7807             | Confirmed via `apps/mmc/src/core/errors/error-normalizer.ts` branch 4; RFC 7807 fields (`type`, `title`, `detail`, `instance`) are not emitted by the Zidney API         |
| 4   | GAP 5 (licenseStatus cleared on session expiry) addressed by adding assertion to `session-clear-wiring.test.ts` | Integration test already has spy harness in place; adding one assertion is lowest-risk extension                                                                         |
| 5   | All new test files are additive (append-only)                                                                   | No modifications to application source code; stage remains strictly validation                                                                                           |

---

## Migration Impact

| Item                  | Value | Notes                                    |
| --------------------- | ----- | ---------------------------------------- |
| Migration required    | No    | Validation-only stage; no schema changes |
| `schema_version` bump | No    | Not applicable                           |
| Backward compatible   | N/A   | No changes to production code            |

---

## Transaction Boundaries

None — no writes to the database or state layer. All plan phases produce test files only.

---

## Idempotency Strategy

Not applicable — this stage produces read-only test assertions. All tests are deterministic and produce identical results on repeated runs.

---

## Coverage Gap Summary

| GAP | Test(s)            | Description                                                                          | Resolution                                                                  |
| --- | ------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| G1  | 3.3                | No unit test confirms `applyCorrelationId()` writes `X-Correlation-ID` header        | New file: `tests/unit/api-client/interceptors/correlation-id.test.ts`       |
| G2  | 3.2                | 403, 429, 500 path not asserted through app-level `normalizeError()`                 | Extend each app's `error-normalizer.spec.ts` with HTTP status case tests    |
| G3  | 3.1, 5.3, 6.1, 7.1 | Structural/source hygiene not codified as runnable assertions                        | New file: `tests/validation/static-analysis.test.ts`                        |
| G4  | 5.1                | Store isolation (independent Pinia per app) not unit-asserted                        | New file: `tests/unit/store-isolation.test.ts`                              |
| G5  | 2.3, 5.2           | `licenseStatusStore.clearLicenseStatus()` not asserted in session-clear-wiring tests | Extend `tests/integration/*/auth/session-clear-wiring.test.ts` (all 3 apps) |

---

## Architecture Governance Compliance

| Check                                               | Status | Notes                                    |
| --------------------------------------------------- | ------ | ---------------------------------------- |
| No cross-tenant logic introduced (ADR-0001)         | ✅     | Validation-only; no tenant-scoped writes |
| All writes are transactional by design              | ✅     | No writes in this stage                  |
| Server-authoritative time enforced (ADR-0006)       | ✅     | Not applicable — no server interactions  |
| License middleware enforced                         | ✅     | Not applicable — no new routes           |
| Version compatibility enforced (ADR-0007, ADR-0008) | ✅     | No package changes                       |
| No architecture redesign without ADR                | ✅     | Architecture Guardian: PASS              |
| Trust chain respected                               | ✅     | No changes to auth/license/routing code  |
| Import boundaries respected                         | ✅     | Test files only; no app → app imports    |

---

## Guardian Verdicts

| Guardian              | Verdict | Notes                                                                                                                |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| Architecture Guardian | PASS    | All 7 checks passed; one advisory: add `rg --version` guard in static-analysis.test.ts (addressed in implementation) |
| API Designer          | PASS    | Initial BLOCKED on Test 4.1 RFC 7807 mismatch and `makeAdapter` excess property — both resolved before commit        |

---

## Execution Plan Overview

| Phase   | Description                                        | Target Tests                                                        |
| ------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| Phase 0 | Run existing suites — 18 test files, all must pass | Baseline for 1.1–1.4, 2.1–2.3, 3.2, 4.1–4.2, 5.2, 6.1, 7.1–7.2, 8.3 |
| Phase 1 | Static analysis test file (GAP 3)                  | Tests 3.1, 5.3, 6.1 (partial), 7.1                                  |
| Phase 2 | Extend `error-normalizer.spec.ts` (GAP 2)          | Test 3.2                                                            |
| Phase 3 | Correlation ID unit test (GAP 1)                   | Test 3.3                                                            |
| Phase 4 | Store isolation test (GAP 4)                       | Test 5.1                                                            |
| Phase 5 | Session-clear-wiring extension (GAP 5)             | Tests 2.3, 5.2                                                      |
