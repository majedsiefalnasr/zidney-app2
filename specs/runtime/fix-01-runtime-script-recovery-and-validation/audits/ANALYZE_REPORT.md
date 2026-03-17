# Analyze Report — Runtime Script Recovery and Validation

**Stage:** STAGE_FIX_01_RUNTIME_SCRIPT_RECOVERY_AND_VALIDATION  
**Phase:** 0X_FIXES  
**Date:** 2026-03-17  
**Step:** 5 — Analyze (Drift Detector)  
**Final Gate:** APPROVED | Implementation: AUTHORIZED

---

## Structural Drift Analysis (speckit.analyze)

**Runs Required:** 3  
**Final Result:** PASS (9/9)

### Criteria Results

| #   | Criterion                 | Result  | Evidence                                                                                                                       |
| --- | ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Isolation Violations      | ✅ PASS | No tenant DB access; all scripts connect to master DB via DATABASE_URL only; no tenant resolver bypass                         |
| 2   | License Middleware Bypass | ✅ PASS | No HTTP routes created; scripts are standalone operational tools — N/A                                                         |
| 3   | Snapshot Integrity        | ✅ PASS | No attempt engine code touched; scope excludes grading/snapshot logic entirely                                                 |
| 4   | Missing Transactions      | ✅ PASS | All DB operations are read-only SELECTs; db:migrate defers to API migration runner — no write paths                            |
| 5   | Missing Idempotency       | ✅ PASS | File outputs use overwrite semantics (inherently idempotent); no stateful production writes                                    |
| 6   | Version Enforcement Gaps  | ✅ PASS | No schema alterations; db:migrate delegates to existing API runner — schema_version preserved                                  |
| 7   | API vs Worker Authority   | ✅ PASS | All new code in scripts/ layer; no business logic in wrong layer                                                               |
| 8   | Logging Deficiencies      | ✅ PASS | All scripts use createLogger + correlationId + service fields; console.log unconditionally banned; T009/T034 mandate migration |
| 9   | Security Violations       | ✅ PASS | No hardcoded secrets; DATABASE_URL guarded before use; spawnSync uses array args (no shell injection)                          |

---

## Remediation History

### Round 1 → Round 2 (BLOCKED → PASS on Criteria 1+8)

| Fix           | Criterion    | Description                                                                                                                                                |
| ------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FIX-R01       | Criteria 1   | `scripts/db/console.ts` — removed `--workspace=` arg, removed `connectUrl` derivation; `spawnSync("psql", [databaseUrl])` now uses `DATABASE_URL` directly |
| FIX-R02       | Criteria 8   | `plan.md` T004 deferral → mandatory `createLogger('seed:dashboard-test-data')` migration; T009/T034 in tasks.md updated to require FR-05 compliance        |
| T030 advisory | Non-blocking | `tasks.md` T030 editorial residue removed (`--workspace= arg` reference replaced with `psql PATH dependency only`)                                         |

### Round 2 → Round 3 (Advisory fixes after guardian audit)

| Fix     | Guardian                  | Description                                                                                                                                                                                                         |
| ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FIX-R03 | Performance + Code Review | Replaced `new URL("../../../", import.meta.url).pathname` with `process.cwd()` in all 5 scripts — matches codebase convention (20+ existing scripts confirmed); prevents REPO_ROOT resolving to parent of repo root |
| FIX-R04 | QA                        | T024 updated to include `vitest.workspace.ts` project entry registration for `scripts/validate/__tests__/` — matching ai-engine/hygiene-checks precedent                                                            |
| FIX-R05 | Code Review               | Removed unused `import { spawnSync }` from `db/migrate.ts` section — prevents `bun run lint` failure at T046                                                                                                        |
| FIX-R06 | Code Review               | Added `"generate-script-docs"`, `"validate-runtime-scripts"`, `"seed-dashboard-test-data"` to `LEGACY_ALLOWLIST` — prevents documentation generator from exiting 1 on its own `@script` tags                        |

---

## Composite Guardian Audit Results

All 4 guardians evaluated in parallel after Round 3 fixes.

| Guardian                     | Verdict | Critical | High | Medium | Low |
| ---------------------------- | ------- | -------- | ---- | ------ | --- |
| Zidney Security Auditor      | ✅ PASS | 0        | 0    | 2      | 3   |
| Zidney Performance Optimizer | ✅ PASS | 0        | 0    | 2      | 2   |
| Zidney QA Engineer           | ✅ PASS | 0        | 0    | 0      | 3   |
| Zidney Code Reviewer         | ✅ PASS | 0        | 0    | 0      | 2   |

### Notable Medium Findings (non-blocking, advisory)

**Security M1** — `db:console.ts` passes DATABASE_URL (potentially containing embedded password) as a psql CLI positional arg; visible in `ps aux` for the session lifetime. Documented in db-console.md Known Failure Modes (T030). Mitigated by `@mode manual` scope — developer-only tool, no HTTP surface.

**Security M2** — pg driver error messages may include username/host fragments. Recommendation: log `error.code` + generic category only. Acceptable for infrastructure scripts; no tenant data exposed.

**Performance M1** — pg Pool missing `connectionTimeoutMillis` in pool-status.ts and validate-licenses.ts; defaults to infinite wait. Recommendation: set `connectionTimeoutMillis: 5000`. Medium risk — CI may hang if DB is unreachable.

**Performance M2** — pg client not released in catch paths (missing `finally` block). Recommendation: use `try/finally { client.release(); await pool.end(); }`. Consistent with canonical seed script pattern.

---

## Final Composite Verdict

```
speckit.analyze:          PASS (9/9)
Security Auditor:         PASS
Performance Optimizer:    PASS
QA Engineer:              PASS
Code Reviewer:            PASS

═══════════════════════════════════
FINAL GATE:    APPROVED
IMPLEMENTATION: AUTHORIZED
═══════════════════════════════════
```

---

## Constitutional Compliance

- ✅ Database-per-tenant isolation preserved (scripts operate on master DB only)
- ✅ License middleware untouched
- ✅ Attempt engine snapshot integrity unaffected
- ✅ Server-authoritative time — N/A (no timing logic)
- ✅ Worker-only grading — N/A (no grading logic)
- ✅ No cross-tenant joins
- ✅ All structured logging enforced (FR-05)
- ✅ No secrets in code
- ✅ Import boundaries respected (scripts/ → core/ only)
