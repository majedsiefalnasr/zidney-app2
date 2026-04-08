# Testing Guide — STAGE_UI_08_NOTIFICATION_AND_FEEDBACK

**Stage:** STAGE_UI_08_NOTIFICATION_AND_FEEDBACK  
**Phase:** 06_UI_APPLICATION_RUNTIME  
**Stage Directory:** ui-008-notification-and-feedback  
**Generated On:** 2025-07-22

---

## Purpose

This guide explains how to validate the notification and feedback layer end-to-end
across MMC, Backoffice, and Frontoffice apps.

---

## Summary of Delivered Behavior

This stage adds a unified notification system to all three frontend applications.
Every API action now produces a consistent visual response: errors show a toast,
success confirms the action, network outages show a persistent banner, and forms
prevent double-submission.

Key outcomes:

- Toast notifications for API errors — color-coded by severity (error=red, warning=yellow, info=blue, success=green)
- Persistent `OfflineBanner` when the browser loses internet connectivity
- Exam-mode suppression: `info` and `success` toasts are silenced during an active exam in Frontoffice
- Double-submit guard via `useFormSubmit`: the submit button disables until the request completes
- Workspace slug injected into error messages in Backoffice for multi-tenant context
- 400/network errors produce no toast (silenced); 401 redirects to `/login`

---

## Prerequisites

| Requirement                | Validation Command / Check                             |
| -------------------------- | ------------------------------------------------------ |
| Node.js installed          | `node --version` (v20+)                                |
| Bun installed              | `bun --version` (v1+)                                  |
| Docker running             | `docker ps`                                            |
| Environment file present   | Verify `.env` or `.env.local` exists                   |
| Correct branch checked out | `git branch` → `spec/ui-008-notification-and-feedback` |

---

## Files in Scope

```text
packages/ui-system/src/index.ts
packages/ui-system/src/types/common.ts
packages/ui-system/package.json

apps/mmc/src/core/state/notification.store.ts
apps/backoffice/src/core/state/notification.store.ts
apps/frontoffice/src/core/state/notification.store.ts

apps/mmc/src/composables/useNotify.ts
apps/backoffice/src/composables/useNotify.ts
apps/frontoffice/src/composables/useNotify.ts

apps/mmc/src/composables/useOfflineBanner.ts
apps/backoffice/src/composables/useOfflineBanner.ts
apps/frontoffice/src/composables/useOfflineBanner.ts

apps/mmc/src/composables/useFormSubmit.ts
apps/frontoffice/src/composables/useFormSubmit.ts

apps/mmc/src/components/OfflineBanner.vue
apps/backoffice/src/components/OfflineBanner.vue
apps/frontoffice/src/components/OfflineBanner.vue

apps/mmc/src/App.vue
apps/backoffice/src/App.vue
apps/frontoffice/src/App.vue
apps/backoffice/src/layouts/AppLayout.vue
apps/frontoffice/src/layouts/AppLayout.vue

apps/mmc/src/main.ts
apps/backoffice/src/main.ts
apps/frontoffice/src/main.ts

apps/frontoffice/src/core/state/attempt.store.ts

# Tests
apps/mmc/tests/unit/stores/notification.store.test.ts
apps/backoffice/tests/unit/stores/notification.store.test.ts
apps/frontoffice/tests/unit/stores/notification.store.test.ts
apps/mmc/tests/unit/composables/useNotify.test.ts
apps/backoffice/tests/unit/composables/useNotify.test.ts
apps/frontoffice/tests/unit/composables/useNotify.test.ts
apps/mmc/tests/unit/components/OfflineBanner.test.ts
apps/backoffice/tests/unit/components/OfflineBanner.test.ts
apps/frontoffice/tests/unit/components/OfflineBanner.test.ts
apps/mmc/tests/unit/composables/useFormSubmit.test.ts
apps/backoffice/tests/unit/composables/useFormSubmit.test.ts
apps/frontoffice/tests/unit/composables/useFormSubmit.test.ts
apps/mmc/tests/integration/notification-flow.test.ts
apps/backoffice/tests/integration/notification-flow.test.ts
apps/frontoffice/tests/integration/notification-flow.test.ts
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Start MMC (port 5173)
bun run dev:mmc

# Start Backoffice (port 5174)
bun run dev:backoffice

# Start Frontoffice (port 5175)
bun run dev:frontoffice
```

No migrations required — this is a UI-only stage.

---

## Automated Validation Commands

```bash
# All tests
bun vitest run

# Integration tests only
bun vitest run apps/mmc/tests/integration apps/backoffice/tests/integration apps/frontoffice/tests/integration

# TypeScript
bun run typecheck:src
bun run typecheck:tests

# Biome lint
bun biome check .

# Architecture guard
bun scripts/ai-guard.ts --ci
```

Expected outcome: all tests pass, 0 TypeScript errors, 0 Biome errors, 28/28 ai-guard checks.

---

## Manual Test Scenarios

### Scenario 1 — API Error produces a toast notification (MMC)

**Purpose:** Verify that a 409 Conflict response from the API renders a red error toast.

1. Start the MMC app: `bun run dev:mmc`
2. Trigger an action that causes a 409 response (e.g., create a duplicate entity in the UI)
3. Observe the toast appear in the top-right corner

Expected: A red toast titled "Error" with the server-provided message. The toast
auto-dismisses after 5 seconds. The `useNotificationStore` `notifications` array
contains one entry with `type: 'error'`.

Troubleshooting: If no toast appears, check `apps/mmc/src/main.ts` for the
`app.config.errorHandler` and verify `useNotify().error()` is called.

---

### Scenario 2 — 401 Unauthorized redirects to /login (all apps)

**Purpose:** Verify that a 401 response immediately navigates the user to the login page without showing a toast.

1. Open browser DevTools → Network tab
2. Simulate a 401 by clearing your session token and performing any authenticated action
3. Observe: no toast appears and the router navigates to `/login`

Expected: URL changes to `/login`. The notification store remains empty (no toast pushed).

Troubleshooting: Check `apps/mmc/src/main.ts` — the error handler checks
`NormalizedError.status === 401` and calls `router.push('/login')` without
calling `useNotify()`.

---

### Scenario 3 — OfflineBanner appears when offline (all apps)

**Purpose:** Verify the persistent offline indicator renders when the browser disconnects.

1. Open any running app in the browser
2. Open DevTools → Network → set throttling to "Offline"
3. Observe the banner

Expected: A yellow/red banner appears at the top of the page with a WiFi-off icon
and text indicating the connection is lost. The banner has `role="status"` for
screen readers.

Troubleshooting: Check `apps/mmc/src/components/OfflineBanner.vue` and verify
it is mounted in `App.vue`. Verify `useOnline()` from `@vueuse/core` is working
by checking its return in the browser console.

---

### Scenario 4 — OfflineBanner disappears when back online

**Purpose:** Verify the banner auto-hides when connectivity is restored.

1. Follow Scenario 3 to trigger the offline banner
2. Remove the "Offline" throttle in DevTools
3. Observe the banner

Expected: The banner hides automatically within 1–2 seconds. No page reload required.

---

### Scenario 5 — Backoffice workspace slug appears in error toast (Backoffice only)

**Purpose:** Verify workspace context is injected into error messages.

1. Start the Backoffice app logged in to workspace `acme-corp`
2. Trigger a 409 Conflict error
3. Read the toast message

Expected: The error toast message includes `(workspace: acme-corp)` appended.
For example: `Duplicate record (workspace: acme-corp)`.

Troubleshooting: Check `apps/backoffice/src/composables/useNotify.ts` — the
`error()` method reads `useWorkspaceStore().workspace?.slug` and appends it.

---

### Scenario 6 — Exam-mode suppresses info/success toasts (Frontoffice only)

**Purpose:** Verify non-critical notifications are silent during an active exam.

1. Start the Frontoffice app
2. Via DevTools console, set `useAttemptStore().isExamActive = true`
3. Trigger a success action (e.g., a successful API call that would normally show a green toast)

Expected: No toast appears. The notification store remains empty.

4. Trigger an error action (e.g., a 500 from the API)

Expected: A red error toast appears as normal.

Troubleshooting: Check `apps/frontoffice/src/composables/useNotify.ts` — the
`success()` and `info()` methods early-return when `isExamActive` is `true`.
`error()` and `warning()` are not guarded.

---

### Scenario 7 — useFormSubmit prevents double-submit

**Purpose:** Verify that clicking a submit button twice while a request is in-flight only fires once.

1. Find any form that uses `useFormSubmit` (e.g., a login or create form in MMC)
2. Open DevTools → add a 3-second artificial delay to the POST request
3. Click the submit button twice rapidly

Expected: The second click is ignored. The button is disabled while `isSubmitting.value === true`.
After the request completes, the button re-enables.

Troubleshooting: Inspect the form's submit handler — it should use `useFormSubmit().submit(fn)`.
Check `isSubmitting.value` in the browser console via the Pinia devtools panel.

---

### Scenario 8 — Deduplication prevents duplicate toasts

**Purpose:** Verify the 2-second dedup window suppresses identical back-to-back errors.

1. Open browser DevTools console on MMC
2. Using Pinia devtools, call `useNotificationStore().push({ type: 'error', message: 'Test error', duration: 5000 })` twice in rapid succession
3. Count the toasts on screen

Expected: Only 1 toast appears despite 2 push calls within the dedup window.

---

## Known Limitations

- The Frontoffice `useAttemptStore` stub only exposes `isExamActive`. Full exam engine
  integration is handled by STAGE_UI_XX_EXAM_RUNTIME (future stage).
- `useFormSubmit` is not yet wired into specific form components — consumers add it per-form.
- Notification history / center (US coming later) is not surfaced in this stage.

---

## Regression Check

After applying this stage to a branch that previously had no notification system:

- [ ] Existing forms still submit correctly (no double-submit regressions)
- [ ] Existing error handling in Vue components still works alongside the new global handler
- [ ] No existing test breaks after adding the notification store to Pinia

Run `bun vitest run` to confirm all tests from prior stages still pass.
