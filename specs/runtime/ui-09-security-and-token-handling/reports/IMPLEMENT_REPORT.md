# Implement Report — STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING

**Step:** 6 — Implement  
**Timestamp:** 2026-03-02T14:10:00Z  
**Status:** COMPLETE

---

## Summary

All 57 implementation tasks completed across 5 user stories and 6 implementation phases. The
security and token handling hardening is fully implemented in all 3 apps (mmc, backoffice,
frontoffice). 31 test files pass with 273 tests. No deferred tasks.

---

## Inputs Reviewed

- `specs/runtime/ui-09-security-and-token-handling/tasks.md`
- `specs/runtime/ui-09-security-and-token-handling/plan.md`
- `specs/runtime/ui-09-security-and-token-handling/audits/VALIDATION_REPORT.md`

---

## Files Modified

| File Path                                                              | Change Type | Notes                                                                    |
| ---------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| apps/mmc/src/core/state/license-status.store.ts                        | Created     | License status reactive store (T001)                                     |
| apps/backoffice/src/core/state/license-status.store.ts                 | Created     | License status reactive store (T002)                                     |
| apps/frontoffice/src/core/state/license-status.store.ts                | Created     | License status reactive store (T003)                                     |
| apps/mmc/src/core/auth/token-redact.ts                                 | Created     | Token redaction pure functions (T004)                                    |
| apps/backoffice/src/core/auth/token-redact.ts                          | Created     | Token redaction pure functions (T005)                                    |
| apps/frontoffice/src/core/auth/token-redact.ts                         | Created     | Token redaction pure functions (T006)                                    |
| apps/mmc/src/core/auth/index.ts                                        | Modified    | Re-export token-redact (T007)                                            |
| apps/backoffice/src/core/auth/index.ts                                 | Modified    | Re-export token-redact (T008)                                            |
| apps/frontoffice/src/core/auth/index.ts                                | Modified    | Re-export token-redact (T009)                                            |
| apps/mmc/src/core/state/auth.store.ts                                  | Modified    | Add expireSession() action (T010)                                        |
| apps/backoffice/src/core/state/auth.store.ts                           | Modified    | Add expireSession() action (T011)                                        |
| apps/frontoffice/src/core/state/auth.store.ts                          | Modified    | Add expireSession() action (T012)                                        |
| apps/mmc/src/core/api/interceptors/error.interceptor.ts                | Created     | Error interceptor with 401/423/426 handling (T013)                       |
| apps/backoffice/src/core/api/interceptors/error.interceptor.ts         | Created     | Error interceptor (T014)                                                 |
| apps/frontoffice/src/core/api/interceptors/error.interceptor.ts        | Created     | Error interceptor (T015)                                                 |
| apps/mmc/src/core/api/client.ts                                        | Modified    | Extend createAppApiClient with errorInterceptor (T016)                   |
| apps/backoffice/src/core/api/client.ts                                 | Modified    | Extend createAppApiClient with errorInterceptor (T017)                   |
| apps/frontoffice/src/core/api/client.ts                                | Modified    | Extend createAppApiClient with errorInterceptor (T018)                   |
| apps/mmc/src/core/router/guards/auth.guard.ts                          | Modified    | Add redirect preservation query param (T019)                             |
| apps/backoffice/src/core/router/guards/auth.guard.ts                   | Modified    | Add redirect preservation query param (T020)                             |
| apps/frontoffice/src/core/router/guards/auth.guard.ts                  | Modified    | Add redirect preservation query param (T021)                             |
| apps/mmc/src/main.ts                                                   | Modified    | Wire errorInterceptor + licenseStatusStore (T022)                        |
| apps/backoffice/src/main.ts                                            | Modified    | Wire errorInterceptor + licenseStatusStore (T023)                        |
| apps/frontoffice/src/main.ts                                           | Modified    | Wire errorInterceptor + licenseStatusStore (T024)                        |
| eslint.config.mjs                                                      | Modified    | Enable vue/no-v-html as error (T025)                                     |
| apps/mmc/src/modules/licenses/components/LicenseQuotaDisplay.vue       | Modified    | Remove v-html usage (T025)                                               |
| apps/mmc/src/modules/licenses/components/SoftLockDisplay.vue           | Modified    | Remove v-html usage (T025)                                               |
| vitest.config.ts                                                       | Modified    | Add pinia/vue-router/vue/@zidney/api-client aliases for root test runner |
| package.json                                                           | Modified    | Add jsdom as dev dependency                                              |
| tests/unit/mmc/core/auth/token-redact.test.ts                          | Created     | Token redact unit tests T026                                             |
| tests/unit/backoffice/core/auth/token-redact.test.ts                   | Created     | T027                                                                     |
| tests/unit/frontoffice/core/auth/token-redact.test.ts                  | Created     | T028                                                                     |
| tests/unit/mmc/core/api/interceptors/error.interceptor.test.ts         | Created     | Error interceptor unit tests T029                                        |
| tests/unit/backoffice/core/api/interceptors/error.interceptor.test.ts  | Created     | T030                                                                     |
| tests/unit/frontoffice/core/api/interceptors/error.interceptor.test.ts | Created     | T031                                                                     |
| tests/unit/mmc/core/router/guards/auth.guard.redirect.test.ts          | Created     | Auth guard redirect unit tests T032                                      |
| tests/unit/backoffice/core/router/guards/auth.guard.redirect.test.ts   | Created     | T033                                                                     |
| tests/unit/frontoffice/core/router/guards/auth.guard.redirect.test.ts  | Created     | T034                                                                     |
| tests/unit/mmc/core/state/auth.store.test.ts                           | Created     | Auth store unit tests T035                                               |
| tests/unit/backoffice/core/state/auth.store.test.ts                    | Created     | T036                                                                     |
| tests/unit/frontoffice/core/state/auth.store.test.ts                   | Created     | T037                                                                     |
| tests/unit/mmc/core/auth/token-persistence-audit.test.ts               | Created     | Token persistence audit T040                                             |
| tests/unit/backoffice/core/auth/token-persistence-audit.test.ts        | Created     | T041                                                                     |
| tests/unit/frontoffice/core/auth/token-persistence-audit.test.ts       | Created     | T042                                                                     |
| tests/unit/mmc/core/api/client.test.ts                                 | Created     | Auth header injection tests T043                                         |
| tests/unit/backoffice/core/api/client.test.ts                          | Created     | T044                                                                     |
| tests/unit/frontoffice/core/api/client.test.ts                         | Created     | T045                                                                     |
| tests/integration/mmc/auth/401-race.test.ts                            | Created     | 401 race integration tests T046                                          |
| tests/integration/backoffice/auth/401-race.test.ts                     | Created     | T047                                                                     |
| tests/integration/frontoffice/auth/401-race.test.ts                    | Created     | T048                                                                     |
| tests/unit/mmc/core/state/license-status.store.test.ts                 | Created     | License status store tests T049                                          |
| tests/unit/backoffice/core/state/license-status.store.test.ts          | Created     | T050                                                                     |
| tests/unit/frontoffice/core/state/license-status.store.test.ts         | Created     | T051                                                                     |
| tests/unit/mmc/core/router/guards/route-coverage-audit.test.ts         | Created     | Route coverage audit T052                                                |
| tests/unit/backoffice/core/router/guards/route-coverage-audit.test.ts  | Created     | T053                                                                     |
| tests/unit/frontoffice/core/router/guards/route-coverage-audit.test.ts | Created     | T054                                                                     |
| tests/integration/mmc/auth/session-clear-wiring.test.ts                | Created     | Session clear wiring T055                                                |
| tests/integration/backoffice/auth/session-clear-wiring.test.ts         | Created     | T056                                                                     |
| tests/integration/frontoffice/auth/session-clear-wiring.test.ts        | Created     | T057                                                                     |

---

## Tasks Completion

| Task ID   | Description                                                      | Layer               | Status |
| --------- | ---------------------------------------------------------------- | ------------------- | ------ |
| T001–T003 | License status stores (×3 apps)                                  | UI / State          | ✅     |
| T004–T009 | Token redact utility + re-exports (×3 apps)                      | UI / Auth           | ✅     |
| T010–T012 | expireSession() action in auth.store.ts (×3 apps)                | UI / State          | ✅     |
| T013–T015 | Error interceptor with 401/423/426 handling (×3 apps)            | UI / API            | ✅     |
| T016–T018 | Extend createAppApiClient with errorInterceptor (×3 apps)        | UI / API            | ✅     |
| T019–T021 | Auth guard redirect preservation (×3 apps)                       | UI / Router         | ✅     |
| T022–T024 | main.ts wiring (errorInterceptor + licenseStatusStore) (×3 apps) | UI / Bootstrap      | ✅     |
| T025      | ESLint vue/no-v-html enforcement + v-html elimination            | UI / Tools          | ✅     |
| T026–T037 | Unit tests all user stories (×3 apps each)                       | Tests               | ✅     |
| T038–T039 | Lint + TypeScript type check validation                          | Tools               | ✅     |
| T040–T042 | Token persistence audit tests (×3 apps)                          | Tests / Security    | ✅     |
| T043–T045 | Auth header injection tests (×3 apps)                            | Tests / Security    | ✅     |
| T046–T048 | Integration 401 race tests (×3 apps)                             | Tests / Integration | ✅     |
| T049–T051 | License status store unit tests (×3 apps)                        | Tests               | ✅     |
| T052–T054 | Route coverage audit tests (×3 apps)                             | Tests / Security    | ✅     |
| T055–T057 | Session clear wiring integration tests (×3 apps)                 | Tests / Integration | ✅     |

**Completed:** 57 / 57

---

## Tests Added or Updated

| Test File                                                          | Type         | Scope                                                                           |
| ------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------- |
| tests/unit/\*/core/auth/token-redact.test.ts (×3)                  | Unit         | 13 SENSITIVE_KEYS redaction coverage; looksLikeToken(); nested deep redaction   |
| tests/unit/\*/core/api/interceptors/error.interceptor.test.ts (×3) | Unit         | 401 idempotency guard; 423/426 license error routing; isHandling401 reset       |
| tests/unit/\*/core/router/guards/auth.guard.redirect.test.ts (×3)  | Unit         | Redirect preservation; preserveRedirect: false; login route passthrough         |
| tests/unit/\*/core/state/auth.store.test.ts (×3)                   | Unit         | expireSession() path + idempotency + navigation + authError code                |
| tests/unit/\*/core/state/license-status.store.test.ts (×3)         | Unit         | setWorkspaceLocked; setUpgradeRequired; clearLicenseStatus                      |
| tests/unit/\*/core/api/client.test.ts (×3)                         | Unit         | Authorization Bearer header injection; null token → no header                   |
| tests/unit/\*/core/auth/token-persistence-audit.test.ts (×3)       | Unit (jsdom) | localStorage.setItem / sessionStorage.setItem never called with token value     |
| tests/unit/\*/core/router/guards/route-coverage-audit.test.ts (×3) | Unit         | All non-public routes have requiresAuth: true; not-found catch-all present      |
| tests/integration/\*/auth/401-race.test.ts (×3)                    | Integration  | 3 concurrent 401s → expireSession fires exactly once; login-context 401 skipped |
| tests/integration/\*/auth/session-clear-wiring.test.ts (×3)        | Integration  | clearUserSpecificStores called once after expireSession; skipped for unauth 401 |

**Total: 31 test files, 273 tests**

---

## Constitutional Compliance

| Check                                             | Status | Notes                                                                                   |
| ------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| Tenant resolver context used for tenant DB access | N/A    | UI-only stage — no DB access                                                            |
| All write operations are transactional            | N/A    | No DB writes in this stage                                                              |
| Idempotency is enforced where required            | ✅     | expireSession() has isAuthenticated guard; handleAuthFailure() has \_isHandling401 flag |
| Structured logging is present                     | ✅     | All stores and interceptors use @zidney/logger                                          |
| `console.log` is absent                           | ✅     | No console.log in any implementation file                                               |
| No stack traces exposed to clients                | ✅     | Errors serialized to structured error objects only                                      |
| UI layer has no business logic                    | ✅     | Business logic in store actions and pure functions — UI is reactive only                |
| API error contract is preserved                   | ✅     | Error interceptor routes to callbacks; does not alter API response structure            |
| Token stored in-memory only                       | ✅     | tokenManager in-memory mock confirmed — no localStorage/sessionStorage writes           |
| Authorization header injected at single point     | ✅     | packages/api-client createApiFetchAdapter only                                          |
| vue/no-v-html enforced as error                   | ✅     | eslint.config.mjs updated; all v-html usages eliminated                                 |

**Overall:** COMPLIANT

---

## Open Risks

- **Root-level `bun run typecheck`**: Pre-existing `@/*` multi-app path resolution warnings. Not
  introduced by this stage. App-level builds pass with exit 0. See VALIDATION_REPORT.md for details.
- **Pre-existing `tests/unit/mmc/auth.service.test.ts`**: Cross-layer import of `hono/jwt` fails in
  root vitest. Pre-existing issue from STAGE_14_MMC_MEMBERS. Not in scope.

---

## Next Step

Proceed to Step 7 — Closure.
