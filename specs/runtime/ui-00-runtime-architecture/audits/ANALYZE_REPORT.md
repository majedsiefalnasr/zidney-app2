# Analyze Report — STAGE_UI_00_RUNTIME_ARCHITECTURE

**Step:** 5 — Analyze (Drift Detector)  
**Timestamp:** 2026-02-28T01:30:00Z  
**Status:** APPROVED (after remediation — 2 rounds)

---

## Summary

Structural drift audit returned ALL 9/9 constitutional criteria PASS. Five consistency findings were detected (C1–C5); C1 (HIGH) and C2 (MEDIUM) were applied as mandatory fixes. Composite guardian audit Round 1 returned two BLOCKED verdicts (QA Engineer, Code Reviewer) with 7 total blocking findings. All 7 were remediated and Round 2 returned unanimous PASS across all 4 composite guardians. Final gate: APPROVED. Implementation authorized.

---

## Inputs Reviewed

- `specs/runtime/ui-00-runtime-architecture/spec.md`
- `specs/runtime/ui-00-runtime-architecture/plan.md`
- `specs/runtime/ui-00-runtime-architecture/tasks.md`
- `specs/runtime/ui-00-runtime-architecture/research.md`
- Guardian outputs from Step 5.1A (2 rounds)

---

## Structural Drift Audit (speckit.analyze)

All 9 constitutional criteria: **PASS**

| #   | Criterion                     | Result                                                                    |
| --- | ----------------------------- | ------------------------------------------------------------------------- |
| 1   | Tenant isolation enforced     | ✅ PASS — UI layer only; no DB access                                     |
| 2   | License middleware present    | ✅ N/A — No API routes in this stage                                      |
| 3   | Snapshot integrity preserved  | ✅ N/A — No attempt engine in this stage                                  |
| 4   | All write paths transactional | ✅ N/A — No backend writes                                                |
| 5   | Idempotency strategy defined  | ✅ N/A — No mutable backend state                                         |
| 6   | Version enforcement           | ✅ N/A — No schema changes                                                |
| 7   | Import boundaries enforced    | ✅ PASS — ESLint `import/no-restricted-paths` in Phase 4                  |
| 8   | Security model compliant      | ✅ PASS — No workspace override from body; workspace_slug from route only |
| 9   | Task completeness             | ✅ PASS — 161 tasks, 35 FRs covered 35/35, 15 NFRs covered 15/15          |

---

## Consistency Findings (C1–C5)

| #   | Severity | Description                                                                                                       | Resolution                                                                                                           |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| C1  | HIGH     | tasks.md summary table showed wrong phase ranges (T058–T120, 166 total) instead of correct (T058–T108, 158 total) | **FIXED** — summary table corrected                                                                                  |
| C2  | MEDIUM   | 29 test file paths used `.spec.ts` extension; project convention is `.test.ts`                                    | **FIXED** — sed batch replacement, all 33 paths now `.test.ts`                                                       |
| C3  | LOW      | `getApiClient()` lazy getter suggestion (optional)                                                                | Applied as mandatory fix after Code Reviewer BLOCKED on module-level singleton                                       |
| C4  | LOW      | NFR-07 (heavy component lazy-loading) N/A acknowledgement                                                         | Noted — no heavy components in this scaffolding stage                                                                |
| C5  | LOW      | "28 files" vs "35 delta rows" terminology in research.md                                                          | Acknowledged as non-blocking; 28 files = source files, 35 rows = MMC delta map entries including 7 directory entries |

---

## Round 1 Guardian Findings (BLOCKED — Remediated)

### Code Reviewer Round 1 — BLOCKED

| #    | Severity    | Finding                                                                                                                              | Remediation Applied                                                                                                |
| ---- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| CR-1 | 🔴 Critical | `export const apiClient = createApiClient(appConfig, useAuthStore())` — module-level `useAuthStore()` crashes before Pinia activates | Replaced with lazy `getApiClient()` getter in plan.md §3.3, spec.md FR-33 note, tasks.md T070–T072, T103–T105      |
| CR-2 | 🔴 Critical | FR-33 boot order wrong — spec mandated Pinia before Router, but static imports dictate opposite                                      | FR-33 updated to reflect true ES module order: env → Router → Pinia → createApp → use(pinia) → use(router) → mount |

### QA Engineer Round 1 — BLOCKED

| #    | Severity    | Finding                                                                                                                          | Remediation Applied                                                                 |
| ---- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| QA-1 | 🚨 Critical | No `vitest.config.ts` for apps/backoffice and apps/frontoffice — Phase 6 gates T153/T154 cannot run                              | Added T002a (MMC), T006a (backoffice), T012a (frontoffice) `vitest.config.ts` tasks |
| QA-2 | 🚨 Critical | No `afterEach(vi.resetAllMocks)` in api-client test specs — NFR-12 unenforceable; single-flight closure state leaks across tests | Added to T118/T119/T120 spec                                                        |
| QA-3 | ⚠️ High     | `credentials: 'include'` security requirement had no unit test — silent removal risk                                             | Added `credentials: 'include'` spy assertion to T118/T119/T120                      |
| QA-4 | ⚠️ High     | `AUTH_REFRESH_FAILED` router redirect not tested — FR-06 router push untested                                                    | Added `router.push('/login')` assertion to T118/T119/T120                           |
| QA-5 | ⚠️ Medium   | plan.md §5.1 listed 6 test files; tasks.md Phase 5 had 9 for MMC (missing useAuth, guard-pipeline, app-boot)                     | plan.md §5.1/5.2/5.3 updated to full explicit test file lists                       |

---

## Violations Detected (Post-Remediation)

| #    | Violation Type    | Description                                                                             | Severity | Status                                                                        |
| ---- | ----------------- | --------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| C3   | Consistency       | `getApiClient()` lazy getter optional suggestion                                        | LOW      | Addressed as part of CR-1 fix                                                 |
| M-01 | Security boundary | CSRF SameSite cookie contract not explicitly specified in frontend-to-backend interface | MEDIUM   | Non-blocking — backend STAGE_03 responsibility, not a frontend spec violation |
| L-01 | Observability     | Silent logout failure not logged at warn level                                          | LOW      | Non-blocking recommendation                                                   |

**No post-remediation blocking violations.** All CRITICAL and HIGH findings resolved.

---

## Audit Checklist

| Domain             | Check                                         | Status                                                                  | Notes                                                                                      |
| ------------------ | --------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Isolation          | No cross-tenant joins                         | ✅ N/A                                                                  | UI only — no DB access                                                                     |
| Isolation          | Tenant resolver required for tenant DB access | ✅ N/A                                                                  | Frontend layer                                                                             |
| Isolation          | workspace_slug from route params only         | ✅ PASS                                                                 | NFR-03; WorkspaceGuard reads `to.params['slug']` only                                      |
| License            | License middleware enforced                   | ✅ N/A                                                                  | No API routes                                                                              |
| Transactions       | All write paths transactional                 | ✅ N/A                                                                  | No backend writes                                                                          |
| Idempotency        | Replay protection defined                     | ✅ N/A — `Idempotency-Key` header in API client for consuming endpoints | Header attached by client                                                                  |
| Snapshot Integrity | Snapshot immutability                         | ✅ N/A                                                                  | No attempt engine                                                                          |
| Versioning         | Schema/product compatibility checks           | ✅ N/A                                                                  | No schema changes                                                                          |
| Observability      | Structured logs include correlation_id        | ⚡ N/A                                                                  | Frontend structured logging deferred to later stages; `X-Correlation-ID` header propagated |
| Security           | No token logging                              | ✅ PASS                                                                 | NFR-02; authInterceptor explicitly never logs token                                        |
| Security           | Access token memory-only                      | ✅ PASS                                                                 | NFR-01; Pinia state only, no browser storage                                               |
| Security           | `credentials: 'include'` enforced             | ✅ PASS                                                                 | FR-05; BASE_FETCH_OPTIONS; tested in T118–T120                                             |
| Import Boundaries  | No cross-app imports                          | ✅ PASS                                                                 | ESLint `import/no-restricted-paths` in Phase 4                                             |
| Import Boundaries  | No `import.meta.env` outside env.ts           | ✅ PASS                                                                 | FR-32; ESLint rule enforced                                                                |

---

## Guardian Verdicts

| Guardian                      | Round 1     | Round 2  | Key Findings                                                                                           |
| ----------------------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------ |
| Architecture Checker (Step 3) | BLOCKED     | **PASS** | Remediated in Plan step: credentials:include, singleton, useAuth deps                                  |
| API Designer (Step 3)         | BLOCKED     | **PASS** | Remediated in Plan step: contentTypeInterceptor, QueueEntry type                                       |
| Security Auditor              | —           | **PASS** | No critical/high security violations; 1 medium (CSRF SameSite — backend responsibility); 2 low         |
| Performance Optimizer         | —           | **PASS** | No critical/high performance violations; 1 medium (bundle size enforcement gap for @zidney/ui); 3 low  |
| QA Engineer                   | **BLOCKED** | **PASS** | 5 findings remediated: vitest.config ×3, afterEach reset, credentials test, redirect test, plan tables |
| Code Reviewer                 | **BLOCKED** | **PASS** | 2 critical findings remediated: lazy getter replacing module-level singleton, FR-33 corrected          |

**Composite Score: 6/6 PASS (Round 2)**

---

## Remediation Summary

Total changes applied during Step 5:

| File       | Changes                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `spec.md`  | FR-33 boot order corrected; `getApiClient()` lazy getter note added                                                                                                                                                                  |
| `plan.md`  | §3.3 singleton → lazy getter; §5.1/5.2/5.3 test tables completed; §9 completion gate updated; §10 decisions table updated; vitest.config.ts added to backoffice/frontoffice config sections                                          |
| `tasks.md` | C1: summary table phase ranges corrected; C2: 29× `.spec.ts` → `.test.ts`; T002a/T006a/T012a vitest.config tasks added; T070–T072 lazy getter; T103 bootstrap order comment; T118–T120 3 new assertions + afterEach; total 158 → 161 |

---

## Final Gate Decision

`APPROVED — Implementation authorized.`

All 7 blocking findings remediated. All 6 guardian verdicts PASS in Round 2. 9/9 constitutional criteria PASS. 161 tasks covering 35 FRs and 15 NFRs. Stage is clear to proceed to implementation.

---

## Next Step

Proceed to Step 6 — Implement (161 tasks across 6 phases).
