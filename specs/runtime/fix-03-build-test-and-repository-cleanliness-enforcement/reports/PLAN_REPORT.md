# Plan Report — Build, Test, and Repository Cleanliness Enforcement

**Step:** 3 — Plan  
**Timestamp:** 2026-03-24T00:00:00Z  
**Status:** COMPLETE

---

## Summary

Technical plan completed for STAGE_FIX_03. The plan introduces a unified policy-engine-driven enforcement layer implemented entirely within the `scripts/` infra tooling layer. Nine `PolicyRule` implementations are defined in `scripts/policy-engine/rules/fix-03/`, plus four supporting scripts in `scripts/validate/`. The CI `build-verification` job is replaced with a `policy-gate` job that runs `validate:policy --full`. The Husky pre-push hook is updated to call `validate:policy --changed`. No domain packages, DB migrations, or architecture redesigns are introduced.

Both guardians returned `VERDICT: PASS` after addressing two plan refinements: the `AUTO_FIX_ATTEMPT` → `REPO_CLEAN` sequencing conflict (resolved via `PolicyContext.autoFixedPaths`) and the type migration atomicity label.

---

## Inputs Reviewed

- `specs/runtime/fix-03-build-test-and-repository-cleanliness-enforcement/spec.md`
- `specs/runtime/fix-03-build-test-and-repository-cleanliness-enforcement/plan.md`
- `specs/runtime/fix-03-build-test-and-repository-cleanliness-enforcement/research.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API       | N/A — no Hono routes, no middleware registration                                                                                                                                                                                        |
| Worker    | N/A — no background jobs                                                                                                                                                                                                                |
| Frontend  | N/A — no UI changes                                                                                                                                                                                                                     |
| DB Master | N/A — no migrations                                                                                                                                                                                                                     |
| DB Tenant | N/A — no migrations                                                                                                                                                                                                                     |
| Scripts   | `scripts/policy-engine/` (3 files modified), `scripts/policy-engine/rules/fix-03/` (9 new), `scripts/validate/` (4 new), `.github/workflows/ci.yml` (1 modified), `.husky/pre-push` (1 modified), `package.json` (4 new script entries) |

---

## Key Technical Decisions

| #   | Decision                                                      | Rationale                                                                                                                                    |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `PolicyContext.autoFixedPaths` field added                    | Resolves `AUTO_FIX_ATTEMPT` → `REPO_CLEAN` sequencing conflict; auto-fixed files are tracked and excluded from dirty-tree checks             |
| 2   | Exit codes 0 / 1 / 2 formalized                               | Differentiates clean pass (0), rule violations (1), and infra/runner failures (2); prevents ambiguous CI results                             |
| 3   | No `--rule=X` CLI flag in this stage                          | Single-rule invocation achieved by running the corresponding test file directly; avoids CLI complexity                                       |
| 4   | `RULE_FIX_03_COVERAGE_THRESHOLD` is `warning`-only            | Coverage breaches are non-blocking; documented via `DeferralReport` to prevent failed CI on legitimate coverage gaps                         |
| 5   | `types.ts` → `runner.ts` → `registry.ts` updated atomically   | Breaking type migration (removing `success`/`message`, adding `passed`/`messages[]`/`domain`) requires coordinated commit of all three files |
| 6   | CI migration: `policy-gate` job replaces `build-verification` | Eliminates duplicate direct `bun run build` invocation; `policy-gate.needs` runs after all prerequisite jobs pass                            |
| 7   | Hard fail on policy engine import failure (exit 2)            | No soft fallback to direct `bun run build/test`; preserves enforcement guarantee per clarification Q5                                        |
| 8   | GitNexus context artifact freshness check                     | `runner.ts` compares artifact mtime vs git HEAD commit time; regenerates if stale to avoid stale scope                                       |

---

## Migration Impact

| Item                  | Value | Notes                                                                                       |
| --------------------- | ----- | ------------------------------------------------------------------------------------------- |
| Migration required    | No    | Infra-only stage; no DB schema changes                                                      |
| `schema_version` bump | No    | N/A                                                                                         |
| Backward compatible   | Yes   | All type changes are internal to `scripts/`; no `apps/*` or `packages/*` consumers affected |

---

## Transaction Boundaries

- No mutating DB operations in this stage.
- `scripts/init-test-db.sh` uses PostgreSQL-level `DROP + CREATE` transactions internally (existing script, no changes).
- All supporting scripts are read-only (idempotent filesystem reads / service probes).

---

## Idempotency Strategy

- `repo:assert-clean` — reads `git status --porcelain` (read-only; identical output for identical state)
- `repo:detect-artifacts` — scans filesystem prohibited paths (read-only)
- `repo:hash-build` — hashes `dist/**` (read-only)
- `validate:runtime-env` — probes PG/Redis ports (read-only)
- Repeated invocations on identical repo state produce identical exit codes and output.

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                       |
| -------------------------------------- | ------ | --------------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | Infra tooling only; no data queries                                         |
| All writes are transactional by design | ✅     | No writes introduced; test-db reset uses existing transactional scripts     |
| Server-authoritative time enforced     | ✅     | `correlationId` timestamp is informational only; no business time decisions |
| License middleware enforced            | ✅     | No API routes added; existing license middleware untouched                  |
| Version compatibility enforced         | ✅     | `RULE_FIX_03_ENVIRONMENT_READY` checks Bun + Node version compatibility     |
| No architecture redesign without ADR   | ✅     | All changes confined to `scripts/` infra layer; no ADR required             |

**Overall:** COMPLIANT

---

## Guardian Verdicts

| Guardian              | Verdict | Notes                                                     |
| --------------------- | ------- | --------------------------------------------------------- |
| Architecture Guardian | PASS    | After fixing sequencing conflict and type migration label |
| API Designer          | PASS    | All 8 previously blocked violations resolved              |

---

## Open Risks

- `RULE_FIX_03_FLAKY_TEST_DETECTION` deferred — flaky test history tracking requires separate infrastructure not in scope here. `DeferralReport` will document this follow-up.
- Coverage threshold enforcement is `warning`-only — teams may accept ongoing coverage debt without correction. Accepted risk per design decision.

---

## Next Step

Proceed to Step 4 — Tasks.
