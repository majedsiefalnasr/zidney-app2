# CLARIFY REPORT — UI Runtime Validation

**Stage:** UI Runtime Validation (STAGE_TEST_01)
**Phase:** 06_UI_APPLICATION_RUNTIME
**Step:** 2 — Clarify
**Status:** Complete
**Date:** 2026-04-08

---

## Summary

All `[NEEDS CLARIFICATION]` markers from the Specify step have been resolved through codebase inspection. No ambiguities remain. Technical planning is authorized.

---

## Resolved Clarifications

### Session 2026-04-08

---

**Clarification 1 — Test 3.3: Correlation ID header name**

> **Question:** Is the outgoing header standardized as `x-request-id` across all three apps, or does it vary per app?

**Resolution:** The header is **`X-Correlation-ID`**, uniform across all three apps.

All three `createAppApiClient()` factories delegate to the shared `@zidney/api-client` package, which applies `headers['X-Correlation-ID'] = correlationId ?? crypto.randomUUID()` via `applyCorrelationId()` in `packages/api-client/src/interceptors.ts`. No per-app variation.

**Impact on spec:** Test 3.3 step 3 updated to use `X-Correlation-ID`.

---

**Clarification 2 — Test 5.2: `clearUserSpecificStores()` enumeration**

> **Question:** What stores are enrolled in each app's `main.ts` logout reset?

**Resolution:** `clearUserSpecificStores()` callback is an **empty stub in all three apps**. Explicit resets occur before the stub fires:

- `authStore.expireSession()` → `user === null`
- `licenseStatusStore` reset to initial state

Backoffice-only: `useBackofficeWorkspaceStore` (has `$reset()`) — not yet wired.
Frontoffice-only: `useAttemptStore` — not yet wired.

**Impact on spec:** Test 5.2 scope = confirm callback executes + `authStore.user === null` + `licenseStatusStore` reset.

---

**Clarification 3 — Testing approach**

- **Vitest unit tests**: existing suites in `apps/*/src/core/guards/__tests__/` and `apps/*/src/core/errors/__tests__/` can be extended
- **Playwright E2E**: per-app smoke tests at `apps/*/tests/e2e/smoke.spec.ts` and `tests/e2e/app-load.spec.ts` exist as baseline

---

**Clarification 4 — STAGE_UI_07 / STAGE_UI_08 coverage**

No dedicated test areas needed:

- STAGE_UI_07 Layout: implicitly covered by Area 8 (Test 8.3 — console/runtime errors)
- STAGE_UI_08 Notifications: implicitly covered by Tests 4.1, 4.2, and 3.2 (error handling and toast display)

---

## Risk Assessment

- **Risk Level:** LOW
- No architectural redesign required
- Validation only — no new code paths introduced
- All clarifications resolved via codebase inspection, no user input required

---

## Authorization

All clarifications resolved. Technical planning is authorized.

**Next step:** Step 3 — Plan
