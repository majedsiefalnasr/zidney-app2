---
# Pull Request — Zidney Hard Mode

## 1. Stage & Phase

- Phase: 06 — UI Application Runtime
- Stage: STAGE_UI_00_RUNTIME_ARCHITECTURE
- Branch: `ui-00-runtime-architecture`
- Stage File: `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_00_RUNTIME_ARCHITECTURE.md`
- Stage Status Before PR: BACKEND CLOSED
- Stage Status After PR: PRODUCTION READY

---

## 2. PR Type

- [x] Feature
- [ ] Architectural Change
- [ ] Security Hardening
- [ ] Refactor (No Behavior Change)
- [ ] Documentation
- [ ] Test Coverage
- [ ] Bug Fix

---

## 3. Executive Summary

- Establishes the canonical SPA runtime architecture for all three Zidney UI apps (MMC, Backoffice,
  Frontoffice) — env config, error normalisation, token store, API client, guard pipeline, router,
  Pinia state, `useAuth` composable, and application bootstrap
- MMC is migrated from a flat `src/components/` + `src/views/` layout to a `src/modules/<domain>/`
  hierarchy; no functional regressions
- Backoffice and Frontoffice are scaffolded from scratch with the identical core layer pattern
- Architecture is safe: pure UI layer, no DB access, no tenant isolation logic modified, no API
  endpoint changes, no migrations
- Constitutional guarantees intact: `getApiClient()` lazy getter prevents Pinia activation race;
  `pendingRefresh` queue enforces token refresh idempotency; `NormalizedError` sealed type prevents
  stack trace leakage; boot order enforced
- ESLint migrated from v8 (`.eslintrc.json`) to v9 flat config (`eslint.config.mjs`); all original
  rules preserved
- 196 unit tests added across all three apps; all CI gates pass with exit 0

---

## 4. Workflow Completion Evidence

| Step      | Status      | Report Link                                                            |
| --------- | ----------- | ---------------------------------------------------------------------- |
| Specify   | ✅ Complete | `specs/runtime/ui-00-runtime-architecture/reports/SPECIFY_REPORT.md`   |
| Clarify   | ✅ Complete | `specs/runtime/ui-00-runtime-architecture/reports/CLARIFY_REPORT.md`   |
| Plan      | ✅ Complete | `specs/runtime/ui-00-runtime-architecture/reports/PLAN_REPORT.md`      |
| Tasks     | ✅ Complete | `specs/runtime/ui-00-runtime-architecture/reports/TASKS_REPORT.md`     |
| Analyze   | ✅ Complete | `specs/runtime/ui-00-runtime-architecture/audits/ANALYZE_REPORT.md`    |
| Implement | ✅ Complete | `specs/runtime/ui-00-runtime-architecture/reports/IMPLEMENT_REPORT.md` |
| Closure   | ✅ Complete | `specs/runtime/ui-00-runtime-architecture/reports/CLOSURE_REPORT.md`   |

---

## 5. Constitutional Compliance Checklist

- [x] ADR-0001 — Database-per-tenant isolation preserved (UI stage — no DB access)
- [x] ADR-0002 — Snapshot immutability enforced (N/A — no attempt engine interaction)
- [x] ADR-0006 — Server-authoritative time only (no client-side time logic)
- [x] ADR-0007 — Version compatibility enforced (N/A — API middleware responsibility)
- [x] ADR-0008 — Semantic versioning respected (foundational infrastructure, no version increments)
- [x] No cross-tenant access introduced
- [x] No middleware bypass created
- [x] No shared mutable global state introduced (`getApiClient()` lazy getter pattern)

---

## 6. Isolation & Security Verification

- [x] No cross-workspace joins (UI stage — no DB queries)
- [x] No default DB fallback (UI stage — no DB)
- [x] All queries scoped to workspace_id (workspace slug from `VITE_WORKSPACE_SLUG` env var)
- [x] Structured logging (no `console.log` in source files; `console.error` at boot failure only)
- [x] Error contract compliance — `NormalizedError { code, message, status }` sealed type
- [x] Sensitive data not logged (token store only holds string tokens; error normaliser strips stack
      traces)

---

## 7. Transaction & Concurrency Safety

- [x] All write operations wrapped in transactions (N/A — no DB writes)
- [x] Proper isolation level declared (N/A)
- [x] Explicit locking defined where required (N/A)
- [x] Idempotency guarantees preserved — `pendingRefresh` queue deduplicates concurrent refresh
      calls
- [x] No race conditions introduced — `getApiClient()` lazy getter prevents Pinia activation race on
      boot

---

## 8. Observability & Monitoring

- [x] Structured logging enforced (no console.log in source)
- [x] Correlation IDs propagated (via API client — pass-through to backend)
- [x] Metrics added or updated (N/A — frontend infrastructure stage)
- [x] Alerts updated (N/A)

---

## 9. Testing Coverage

- [x] Unit tests added — 196 total (MMC: 64, Backoffice: 70, Frontoffice: 62)
- [x] Integration tests (N/A — UI infrastructure; integration tested via Vite build + boot)
- [x] Edge cases covered — env validation failure, network error, duplicate refresh, role mismatch,
      workspace mismatch
- [x] Concurrency scenarios tested — `pendingRefresh` queue test in `api-client.test.ts`
- [x] Coverage threshold met — 100% of core layer covered by unit tests

Test Command:

```bash
bunx vitest run --config apps/mmc/vitest.config.ts
bunx vitest run --config apps/backoffice/vitest.config.ts
bunx vitest run --config apps/frontoffice/vitest.config.ts
```

---

## 10. Migration Impact

- [ ] New migrations included — **N/A** (UI stage — no schema changes)
- [x] Backward compatibility verified — existing MMC dashboard routes and components preserved under
      new module structure
- [x] Rollback strategy defined — revert this branch; no DB state to roll back
- [x] No untracked schema changes

---

## 11. Drift Analysis

- [x] speckit.analyze executed
- [x] No architectural violations
- [x] No cross-phase leakage
- [x] No unauthorized stage modification
- [x] `audits/ANALYZE_REPORT.md` confirms APPROVED

---

## 12. Stage Lifecycle Verification

- [x] Stage Status updated in
      `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_00_RUNTIME_ARCHITECTURE.md` → PRODUCTION
      READY
- [x] `.workflow-state.json` updated to `PRODUCTION READY`
- [x] README.md progress table complete — all 7 steps ✅
- [x] All step reports generated in `reports/`

---

## 13. Deployment Readiness

- [x] Safe for staging — UI infrastructure only; no DB migrations required
- [x] Safe for production — same reasoning; Vite builds verified for all three apps
- [x] No feature flags required
- [x] Runbook updated — N/A for this stage

---

## 14. Risk Assessment

Risk Level:

- [x] Low
- [ ] Medium
- [ ] High

This is a pure frontend infrastructure stage. No database, no API endpoint changes, no migrations.
The only risk is JavaScript runtime regression in MMC's reorganised module structure — fully
mitigated by 196 unit tests and Vite build verification.

---

## 15. Final Statement

This PR maintains Zidney architectural integrity and complies with Hard Mode governance.

All workflow steps completed. All reports generated. Stage lifecycle updated.

Reviewer Sign-off:

- [ ] Architecture Approved
- [ ] Security Approved
- [ ] Ready to Merge

---
