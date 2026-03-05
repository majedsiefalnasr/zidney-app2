# Plan Report — Infra Governance

**Step:** 3 — Plan
**Timestamp:** 2026-03-05T00:03:00.000Z
**Status:** COMPLETE

---

## Summary

The technical plan for the Infra Governance stage has been completed and validated. Research identified 11 pre-existing gaps against the 12 functional requirements. The plan produces 7 targeted work items (T001–T007) that are additive, backward-compatible, and do not modify any existing passing tests or architectural runtime behavior. Guardian validation returned **VERDICT: PASS** from both the Architecture Checker and (N/A for this tooling stage) the API Designer.

---

## Inputs Reviewed

- `specs/runtime/infra-governance/spec.md`
- `specs/runtime/infra-governance/plan.md`
- `specs/runtime/infra-governance/research.md`

---

## Architecture Layers Touched

| Layer                                     | Planned Changes                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| API                                       | None                                                                                                                           |
| Worker                                    | None                                                                                                                           |
| Frontend (MMC / Backoffice / Frontoffice) | None — existing per-app Playwright configs already compliant                                                                   |
| DB Master                                 | None                                                                                                                           |
| DB Tenant                                 | None                                                                                                                           |
| CI / DevOps                               | `.github/workflows/ci.yml` — add E2E per-app jobs, coverage-validation job, build-verification job                             |
| Tooling                                   | `vitest.config.ts`, `package.json`, `lint-staged.config.mjs`, `.husky/pre-commit`, `.husky/pre-push`, `scripts/infra-audit.ts` |

---

## Key Technical Decisions

| #   | Decision                                                     | Rationale                                                                                 |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 1   | `@vitest/coverage-v8` as coverage provider                   | Native V8 coverage — no Babel transform needed, compatible with Bun runtime               |
| 2   | Husky v9 (not v8)                                            | v8 `.husky/_/` pattern was never set up; v9 is simpler and correct for a fresh install    |
| 3   | lint-staged in `lint-staged.config.mjs` (not `package.json`) | Cleaner separation; avoids inline JSON limits; supports comments                          |
| 4   | Explicit E2E jobs (3 jobs) vs matrix strategy                | Each app has different ports, env vars, and wait conditions — matrix would add complexity |
| 5   | Coverage Validation gates on unit tests only                 | Per FR-10 clarification: integration coverage is informational only in this stage         |
| 6   | `--quick` flag guards `mkdirSync` blocks in infra-audit.ts   | Pre-commit must not write to filesystem — quick mode must be truly read-only              |

---

## Work Item Summary

| ID   | Work Item                                         | Files                              | FR      |
| ---- | ------------------------------------------------- | ---------------------------------- | ------- |
| T001 | Coverage thresholds + `@vitest/coverage-v8`       | `vitest.config.ts`, `package.json` | FR-05.6 |
| T002 | Add Husky + lint-staged + `prepare` script        | `package.json`                     | FR-08   |
| T003 | Create `lint-staged.config.mjs`                   | `lint-staged.config.mjs` (new)     | FR-08.2 |
| T004 | Rewrite `.husky/pre-commit` (Husky v9 format)     | `.husky/pre-commit`                | FR-08   |
| T005 | Create `.husky/pre-push`                          | `.husky/pre-push` (new)            | FR-09   |
| T006 | Add `--quick` flag to `scripts/infra-audit.ts`    | `scripts/infra-audit.ts`           | FR-08.4 |
| T007 | Update CI workflow (E2E split + coverage + build) | `.github/workflows/ci.yml`         | FR-10   |

---

## Migration Impact

| Item                   | Value | Notes                                                 |
| ---------------------- | ----- | ----------------------------------------------------- |
| Migration required     | No    | Tooling-only stage; no database changes               |
| `schema_version` bump  | No    | Not applicable                                        |
| `product_version` bump | No    | Not applicable                                        |
| Backward compatible    | Yes   | Existing passing tests unmodified; no rules escalated |

---

## Transaction Boundaries

Not applicable — this stage introduces no database writes.

---

## Idempotency Strategy

Not applicable — no API endpoints. The pre-commit scripts (`ai-guard.ts`, `infra-audit.ts --quick`) must be idempotent (re-running produces the same result without side effects). This is verified in T006.

---

## Guardian Validation Results

| Guardian                    | Verdict       | Notes                                                                                                    |
| --------------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS       | No architectural violations; 2 high-priority recommendations (coverage gap for API, duplicate test runs) |
| Zidney API Designer         | ✅ N/A / PASS | No API endpoints introduced — not applicable                                                             |

**Key recommendation accepted:** T006 implementation must explicitly guard `mkdirSync` blocks (lines ~41–57 of `infra-audit.ts`) with `if (!QUICK_MODE)` — not just `writeFileSync` calls.

---

## Open Risks

- **Coverage gap for `apps/api`** — the `test:unit` script excludes `apps/api` because its vitest config mixes unit and integration tests. API backend coverage is not threshold-enforced in this stage. A follow-on stage must address this.
- **wait-on may not be in devDependencies** — T007 references `bunx wait-on`; this should be added to devDependencies and installed via lockfile before use.

---

## Next Step

Proceed to Step 4 — Tasks.
