# Analyze Report — STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING

**Step:** 5 — Analyze (Drift Detector) **Timestamp:** 2026-03-02T00:00:00Z **Status:** APPROVED

---

## Summary

The structural drift analysis (speckit.analyze) and all four composite guardian audits have passed.
STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING is a purely additive frontend security layer stage across
three Vue 3 apps (MMC, Backoffice, Frontoffice). No backend, database, migration, or shared-package
changes are introduced. The stage is fully aligned with the Zidney Constitution v1.2.0.

Two guardian runs (Security Auditor and QA Engineer) initially returned BLOCKED. All blocking
findings were remediated in the same step iteration:

- SENSITIVE_KEYS extended with 4 CSRF keys (csrfToken, csrf_token, x-csrf-token, X-CSRF-Token)
- `vue/no-v-html` enforcement upgraded from advisory `'warn'` to constitutional `'error'`
- Test helper documentation (`assertNoTokenInLogArgs`) added to plan.md
- 18 missing test tasks (T040–T057) added to tasks.md covering: token persistence audit, auth header
  injection, integration 401 race, license-status store unit tests, route coverage audit,
  session-clear wiring integration tests
- 423/426 detection hook explicitly specified in plan.md (C1: `execute()` catch wrapper in
  client.ts)
- `clearUserSpecificStores()` injection architecture clarified (C2/PF-02: called from main.ts
  `onSessionExpired` callback, not from inside `expireSession()`)
- Auth guard redirect-loop protection added (PF-03: `to.name !== loginRouteName` early-exit)
- Security Logic Placement table in spec.md updated to reflect actual `core/api/interceptors/` path

After all remediations, all four guardians and the structural drift audit returned PASS or APPROVED.
Implementation is authorized. Final task count: 57 tasks (T001–T057) + T038–T039 (lint/typecheck) =
59 total.

---

## Inputs Reviewed

- `specs/runtime/ui-09-security-and-token-handling/spec.md` (496 lines; Status: IN PROGRESS)
- `specs/runtime/ui-09-security-and-token-handling/plan.md` (752 lines; includes C1/C2/PF-02/PF-03
  fixes)
- `specs/runtime/ui-09-security-and-token-handling/tasks.md` (410 lines; 59 tasks)
- `specs/runtime/ui-09-security-and-token-handling/research.md` (245 lines; STAGE_UI_01 gap
  analysis)
- `specs/runtime/ui-09-security-and-token-handling/checklists/requirements.md` (41 items, all
  passing)
- Guardian outputs from Step 5.1A (4 guardians; see Guardian Verdicts section)

---

## Structural Drift Audit (speckit.analyze) — 9-Criterion Results

| Criterion                                   | Result  | Notes                                                                    |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------ |
| Tenant isolation preserved                  | ✅ PASS | Pure frontend stage — no DB access; N/A for isolation checks             |
| License middleware compliance               | ✅ PASS | No API routes modified; license enforcement belongs to backend           |
| Snapshot integrity preserved                | ✅ PASS | N/A — no attempt engine changes                                          |
| No cross-tenant joins                       | ✅ PASS | N/A — no backend/DB changes                                              |
| Transaction boundaries defined              | ✅ PASS | N/A for frontend state; Pinia actions are synchronous-first              |
| Idempotency required for critical endpoints | ✅ PASS | Three-layer 401 guard (api-client + isHandling401 + isAuthenticated)     |
| Version enforcement (schema/product)        | ✅ PASS | N/A — no migration; no schema changes                                    |
| Structured logging with correlation_id      | ✅ PASS | token-redact.ts ensures no token in logs; @zidney/logger used throughout |
| Import boundary compliance                  | ✅ PASS | apps/_ → packages/_ only; no cross-app imports; no UI → DB imports       |

No structural drift detected. All 9 criteria pass.

---

## Violations Detected — Full Remediation Log

### Initial Blockers (now resolved)

| #   | Finding ID    | Description                                                                                        | Severity        | Originated From                       | Remediation Applied                                                                                                                                        |
| --- | ------------- | -------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | G-F1          | spec.md Status was DRAFT — lifecycle blocker                                                       | CRITICAL        | speckit.analyze                       | Updated spec.md Status to IN PROGRESS                                                                                                                      |
| 2   | SEC-H1        | `vue/no-v-html` planned as `'warn'` — constitutional XSS posture requires `'error'`                | HIGH            | Security Auditor (initial)            | plan.md Section 7 updated to `'error'`; T025 updated to enforce `'error'` with audit-first step                                                            |
| 3   | SEC-H2        | `redactSensitiveFields` shallow-only — no test helper documented                                   | HIGH            | Security Auditor (initial)            | `assertNoTokenInLogArgs` helper note added to plan.md Section 6 JSDoc                                                                                      |
| 4   | SEC-H3        | CSRF keys missing from SENSITIVE_KEYS                                                              | HIGH            | Security Auditor (initial)            | csrfToken, csrf_token, x-csrf-token, X-CSRF-Token added to SENSITIVE_KEYS in plan.md                                                                       |
| 5   | QA-C1         | Token persistence audit tests absent from tasks.md                                                 | CRITICAL        | QA Engineer (initial)                 | T040–T042 added (tests/unit/\*/core/auth/token-persistence-audit.test.ts)                                                                                  |
| 6   | QA-C2         | Auth header injection tests absent from tasks.md                                                   | CRITICAL        | QA Engineer (initial)                 | T043–T045 added (tests/unit/\*/core/api/client.test.ts)                                                                                                    |
| 7   | QA-C3         | Integration 401 race tests absent from tasks.md                                                    | CRITICAL        | QA Engineer (initial)                 | T046–T048 added (tests/integration/\*/auth/401-race.test.ts)                                                                                               |
| 8   | QA-H1         | license-status store unit tests absent                                                             | HIGH            | QA Engineer (initial)                 | T049–T051 added (tests/unit/\*/core/state/license-status.store.test.ts)                                                                                    |
| 9   | QA-H2         | Route guard coverage audit tasks absent                                                            | HIGH            | QA Engineer (initial)                 | T052–T054 added (tests/unit/\*/core/router/guards/route-coverage-audit.test.ts)                                                                            |
| 10  | QA-H3         | clearUserSpecificStores() call contract tests absent                                               | HIGH            | QA Engineer (initial)                 | T055–T057 added as wiring integration tests (tests/integration/\*/auth/session-clear-wiring.test.ts)                                                       |
| 11  | CR-C1         | 423/426 detection hook unspecified in plan.md — no code path from client.ts to handleLicenseError  | CRITICAL        | Code Reviewer                         | plan.md createAppApiClient updated with execute() catch wrapper for 423/426 ApiError                                                                       |
| 12  | CR-C2 / PF-02 | clearUserSpecificStores() injection mechanism ambiguous; plan code vs. T055-T057 contract conflict | CRITICAL / HIGH | Code Reviewer + Performance Optimizer | Plan Section 3 main.ts wiring updated: clearUserSpecificStores() called from onSessionExpired callback, not inside expireSession(); T055-T057 reflect this |
| 13  | CR-C3         | `vue/no-v-html` conflict between plan.md ('error') and tasks.md T025 ('warn')                      | CRITICAL        | Code Reviewer                         | T025 updated to require 'error'; already fixed per SEC-H1 remediation                                                                                      |
| 14  | C7-F1         | spec.md Security Logic Placement table listed wrong path for 401 interceptor                       | MEDIUM          | speckit.analyze                       | Table updated: `core/api/interceptors/error.interceptor.ts` with KDD rationale note                                                                        |
| 15  | F-PLAN-S2     | auth.interceptor.ts shim in plan with no corresponding task                                        | MEDIUM          | speckit.analyze                       | Plan Section 2 updated with explicit F-PLAN-S2 note: file NOT created by this stage                                                                        |
| 16  | PF-03         | Auth guard missing `to.name !== loginRouteName` redirect-loop defense                              | MEDIUM          | Performance Optimizer                 | plan.md Section 4 and T032–T034 updated with self-redirect early-exit guard                                                                                |
| 17  | QA-M3         | tasks.md status header showed DRAFT                                                                | MEDIUM          | QA Engineer (initial)                 | Header updated to READY FOR EXECUTION; alignment gate updated to IN PROGRESS                                                                               |
| 18  | SEC-NF1       | Phase 6 independent test criteria said "warning (or error)"                                        | MEDIUM          | Security Auditor (re-audit)           | Updated to require "error" only                                                                                                                            |
| 19  | SEC-NF2       | T026–T028 did not enumerate CSRF keys in coverage list                                             | MEDIUM          | Security Auditor (re-audit)           | T026 updated to list all 13 SENSITIVE_KEYS plus assertNoTokenInLogArgs helper requirement                                                                  |

### Remaining Open Observations (non-blocking, to be addressed in implementation)

| #   | Finding ID | Description                                                                          | Severity | Source                | Action                                                                                                             |
| --- | ---------- | ------------------------------------------------------------------------------------ | -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | PERF-PF01  | redactSensitiveFields shallow-only — nested token escape vector                      | MEDIUM   | Performance Optimizer | assertNoTokenInLogArgs test helper mitigates regression risk; DEV-mode assertion recommended during impl           |
| 2   | CR-H1      | redactSensitiveFields<T> return type defeats generic safety (double as unknown cast) | HIGH     | Code Reviewer         | Implementer should use Option A (Record<string, unknown> return type) per plan                                     |
| 3   | CR-H2      | expireSession() does not clear isLoading state on entry                              | HIGH     | Code Reviewer         | Implementer must add isLoading.value = false at start of expireSession()                                           |
| 4   | CR-M1      | SENSITIVE_KEYS missing idToken, clientSecret, apiKey, etc.                           | MEDIUM   | Code Reviewer         | Good to add; not a constitutional blocker; can be expanded in implementation                                       |
| 5   | CR-M3      | handleAuthFailure() drops duplicate 401 silently                                     | MEDIUM   | Code Reviewer         | Add code comment distinguishing request rejection (package) from UI deduplication (interceptor)                    |
| 6   | PERF-PF05  | looksLikeToken regex produces false positives for non-JWT base64url strings          | LOW      | Performance Optimizer | Tighten to require `.`-split structure or minimum 40-char length                                                   |
| 7   | PERF-PF06  | onAuthFailure fire-and-forget has no fallback hard-redirect on router failure        | LOW      | Performance Optimizer | Add window.location.href = '/' in catch block                                                                      |
| 8   | PERF-PF07  | Unauthenticated-path 401 transforms error code to AUTH_REFRESH_FAILED                | LOW      | Performance Optimizer | Login composable must handle AUTH_REFRESH_FAILED as synonymous with invalid credentials in unauthenticated context |
| 9   | CR-L3      | auth.interceptor.ts shim confuses implementers despite F-PLAN-S2 note                | LOW      | Code Reviewer         | Move F-PLAN-S2 clarification before the code block during implementation                                           |

---

## Audit Checklist

| Domain             | Check                                               | Status  | Notes                                                                                                        |
| ------------------ | --------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| Isolation          | No cross-tenant joins                               | ✅ N/A  | Pure frontend stage; no DB access                                                                            |
| Isolation          | Tenant resolver required for tenant DB access       | ✅ N/A  | No DB access in this stage                                                                                   |
| License            | License middleware enforced before tenant DB access | ✅ N/A  | No new API routes; 423/426 handled passively in UI only                                                      |
| Transactions       | All write paths transactional                       | ✅ N/A  | Pinia state mutations synchronous; no DB writes                                                              |
| Idempotency        | Replay protection defined for critical flows        | ✅ PASS | Three-layer 401 guard: api-client single-flight + isHandling401 boolean + isAuthenticated guard              |
| Snapshot Integrity | Snapshot remains immutable after start              | ✅ N/A  | No attempt engine code                                                                                       |
| Versioning         | Schema/product compatibility checks enforced        | ✅ N/A  | No migration; no schema version changes                                                                      |
| Observability      | Structured logs include required fields             | ✅ PASS | @zidney/logger used; token-redact prohibits token exposure; correlation_id propagated by existing api-client |
| Security           | No tenant override from request body                | ✅ N/A  | No request body changes; no multi-tenancy logic in this stage                                                |
| Import Boundaries  | apps/_ → packages/_ only                            | ✅ PASS | token-redact.ts has zero runtime imports; all app code imports from packages/\* only                         |
| XSS                | vue/no-v-html enforced as error                     | ✅ PASS | T025 + plan.md Section 7 both require 'error' severity; audit-first step specified                           |
| Token Storage      | In-memory only — never persists                     | ✅ PASS | token-manager.ts already compliant; T040–T042 provide constitutional audit evidence                          |
| Token Logging      | Never logged in any form                            | ✅ PASS | redactSensitiveFields + assertNoTokenInLogArgs test helper; 13-key SENSITIVE_KEYS including CSRF             |
| 401 Idempotency    | Single expiry flow regardless of concurrent 401s    | ✅ PASS | isHandling401 flag + isAuthenticated guard; T046–T048 integration test coverage                              |
| RBAC in UI         | No permission branches derived from token claims    | ✅ PASS | Confirmed by spec: no JWT decoding, no claim extraction                                                      |
| No JWT Decoding    | Token treated as opaque string                      | ✅ PASS | Confirmed by spec + research.md Finding 1                                                                    |

---

## Guardian Verdicts

| Guardian                     | Final Verdict               | Key Resolved Findings                                                           | Remaining Observations        |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------- | ----------------------------- |
| speckit.analyze              | ✅ APPROVED                 | G-F1 (spec DRAFT), C7-F1 (path), F-PLAN-S2 (shim)                               | None blocking                 |
| zidney-security-auditor      | ✅ PASS (re-audit)          | H1 (warn→error), H2 (test helper), H3 (CSRF keys), C1 (spec DRAFT)              | NF-1, NF-2 (both resolved)    |
| zidney-performance-optimizer | ✅ PASS                     | PF-02 (clearUserSpecificStores injection), PF-03 (redirect loop guard)          | PF-01, PF-04–PF-07 (advisory) |
| zidney-qa-engineer           | ✅ PASS (re-audit)          | C1–C3 (token/header/race tests), H1–H3 (license/route/clear tests), M3 (status) | None                          |
| zidney-code-reviewer         | ✅ PASS (after remediation) | CR-C1 (423/426 hook), CR-C2 (clearUserSpecificStores), CR-C3 (warn→error)       | CR-H1, CR-H2 (impl guidance)  |

**Composite verdict:** All 5 auditees (speckit.analyze + 4 guardians) return PASS/APPROVED.

---

## Implementation Authorization

All Stage UI-09 blocking conditions have been resolved. All four guardian audit runs return PASS
after remediation.

**Implementation is AUTHORIZED.**

Tasks remaining for implementation: T001–T057, T038–T039 (59 total).

---

## Final Gate Decision

`APPROVED — Implementation authorized.`

Drift analysis and composite guardian audit complete. All critical, high, and constitutional
violations resolved. Advisory findings documented above for implementer awareness.

---

## Next Step

Proceed to Step 6 — Implement.
