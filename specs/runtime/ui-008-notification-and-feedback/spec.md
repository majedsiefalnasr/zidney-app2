# Feature Specification: Unified Notification and Feedback System

**Feature Branch**: `spec/ui-008-notification-and-feedback`  
**Created**: 2026-04-07  
**Status**: Draft  
**Stage**: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Apps in Scope**: MMC, Backoffice, Frontoffice

---

## Overview

This stage defines and standardizes the unified notification and feedback architecture across the three Zidney frontend applications (MMC, Backoffice, Frontoffice). It governs how every API-driven interaction surfaces results, errors, and status to the end user — consistently, securely, and accessibly.

The feedback layer is the final integration point between backend error contracts and user-facing UI. All three apps have existing notification stores and error normalizers (introduced in prior stages) that this stage will extend, align, and complete.

**Architecture Flow:**

```
API → ApiClient → Pinia Store → normalizeError() → Notification Store → UI Components (Toaster/Inline)
```

No component may render raw API responses. All errors pass through `core/errors/error-normalizer.ts` before reaching the UI.

---

## User Scenarios & Testing

### User Story 1 — Error Feedback on API Failure (Priority: P1)

A user performs any action that triggers an API call (submitting a form, clicking a button, loading a page). When the API call fails for any reason, the user receives a clear, actionable feedback message appropriate to the failure type — rather than a blank screen, silent failure, or raw technical error.

**Why this priority**: Silent failures destroy user trust and obscure system health. This is the most fundamental UX contract.

**Independent Test**: Can be fully tested by triggering mock API failures (400, 401, 403, 422, 500, network error) and asserting the correct notification type, message, and placement appears without any raw error data visible.

**Acceptance Scenarios**:

1. **Given** a form submission triggers a 400 validation error, **When** the API responds with `{ success: false, error: { code: "VALIDATION_ERROR", message: "Email is required" } }`, **Then** the error message appears inline under the relevant form field (not as a toast).
2. **Given** an action triggers a 401 Unauthorized response, **When** the token is expired, **Then** the user is redirected to the login page and no repeated error toasts appear.
3. **Given** an action triggers a 403 Forbidden response, **When** the user lacks permission, **Then** a permission-denied banner is shown and the user is NOT redirected to login.
4. **Given** an action triggers a 422 business rule violation, **When** the API returns a descriptive error message, **Then** a warning/error toast appears with the sanitized message and remains until dismissed.
5. **Given** an action triggers a 500 server error, **When** the response includes a correlation ID, **Then** an error toast appears with a generic message (not the stack trace) and optionally displays the correlation ID for support.
6. **Given** the network is unavailable, **When** any API call is attempted, **Then** an offline banner appears at the top of the viewport and no individual error toasts are shown for network-class failures.

---

### User Story 2 — Success and Confirmation Feedback (Priority: P2)

A user successfully completes a create, update, or delete action. They receive a brief confirmation toast that confirms the action succeeded and then auto-dismisses. No extra user interaction is required.

**Why this priority**: Positive feedback reinforces completion and reduces repeated action attempts.

**Independent Test**: Can be fully tested by triggering successful mock API responses and asserting a success toast appears with the correct message, green accent, and auto-dismisses within 3–5 seconds.

**Acceptance Scenarios**:

1. **Given** a user successfully creates a resource, **When** the API returns `{ success: true, data: {...} }`, **Then** a green success toast with a relevant message appears and auto-dismisses after 3–5 seconds.
2. **Given** two identical success actions occur within 2 seconds, **When** the notification store processes both, **Then** only one toast is shown (duplicate prevention).
3. **Given** more than 5 notifications are queued simultaneously, **When** a new notification is pushed, **Then** the oldest visible notification is evicted to maintain a maximum of 5 visible toasts.

---

### User Story 3 — Form Loading and Submission State (Priority: P2)

A user submits a form. The submit button is disabled and shows a loading indicator while the request is in flight, preventing double-submission. On completion (success or error), the form returns to interactive state.

**Why this priority**: Double-submission is a reliability and data integrity risk. Loading state prevents this and communicates progress.

**Independent Test**: Can be fully tested by simulating a slow API response (via mock) and asserting button disabled state, loading indicator visibility, and re-enabled state upon completion.

**Acceptance Scenarios**:

1. **Given** a form submit is triggered, **When** the async action is pending, **Then** the submit button is disabled and displays a loading indicator.
2. **Given** the API call succeeds, **When** the response is received, **Then** the loading indicator is removed and the submit button is re-enabled.
3. **Given** the API call fails, **When** the error is received, **Then** the loading indicator is removed, the button is re-enabled, and an appropriate error is shown without clearing user-entered data.
4. **Given** a user rapidly clicks submit multiple times, **When** the first request is in flight, **Then** subsequent clicks are ignored (idempotency enforced at UI level).

---

### User Story 4 — Offline and Reconnect Banner (Priority: P3)

A user loses network connectivity while using the application. An "offline" banner appears at the top of the screen. When the network is restored, the banner automatically disappears without requiring user action.

**Why this priority**: Network resilience UX is important but less critical than the core notification flow.

**Independent Test**: Can be fully tested by toggling browser/OS network connectivity in tests (via `navigator.onLine` mock) and asserting banner visibility changes.

**Acceptance Scenarios**:

1. **Given** the browser detects network disconnection, **When** `navigator.onLine` becomes `false`, **Then** a persistent "Connection lost" banner appears at the top of the viewport.
2. **Given** the network is restored, **When** `navigator.onLine` becomes `true`, **Then** the banner automatically disappears.
3. **Given** the network is offline, **When** individual API calls fail with network errors, **Then** no individual error toasts are fired for those failures (banner handles the message).

---

### User Story 5 — Exam-Mode Quiet Toasts in Frontoffice (Priority: P3)

A student is actively taking an exam in the Frontoffice app. Non-critical informational toasts are suppressed to avoid distracting the student. Only critical errors (e.g., submission failure) break through.

**Why this priority**: Exam flow integrity requires minimal interruption. This is Frontoffice-specific behavior.

**Independent Test**: Can be fully tested by checking that `isExamActive` state suppresses `info` and `success` toast display while still allowing `error` type notifications to surface.

**Acceptance Scenarios**:

1. **Given** a student is in an active exam attempt, **When** a non-critical info/success notification is queued, **Then** it is suppressed or not rendered visually.
2. **Given** a student is in an active exam attempt, **When** a critical error occurs (submission failure), **Then** the error notification is shown regardless of exam mode.

---

### Edge Cases

- What happens when the notification store is at capacity (20 items) and a new critical error arrives? → Oldest entry is evicted (LRU eviction); capacity is intentionally large to handle error storms.
- What happens when the same error fires 50 times in a retry loop? → Deduplication window (2 seconds by message hash) prevents flooding; max visible cap prevents UI overflow.
- What happens if `normalizeError()` receives `null` or `undefined`? → Falls through to the unknown error fallback (`UNKNOWN_ERROR` code), never crashes.
- What happens when a form error arrives for a field that doesn't exist in the current form state? → The error is displayed as a global form-level error message, not dropped.
- What happens during SSR or when `window` is not available? → Global error handlers (`registerGlobalErrorHandlers`) are only registered in browser context; server rendering does not attach window listeners.

---

## Requirements

### Functional Requirements

**Notification Store**

- **FR-001**: Each app (MMC, Backoffice, Frontoffice) MUST maintain a Pinia notification store at `src/core/state/notification.store.ts` with the established `AppNotification` interface shape: `{ id: string, type: 'success'|'error'|'warning'|'info', title: string, message?: string, duration?: number, dismissible: boolean }`.
- **FR-002**: The notification store MUST enforce a visible cap of 5 notifications rendered simultaneously in the UI (the internal queue maximum of 20 entries prevents runaway growth during error storms, but the UI MUST only render the 5 most recent).
- **FR-003**: The notification store MUST automatically evict the oldest entry when the internal queue reaches its maximum capacity (20 entries).
- **FR-004**: The notification store MUST prevent duplicate notifications: identical `type` + `message` combinations within a 2-second deduplication window MUST be suppressed (only the first is enqueued).
- **FR-005**: The notification store MUST support `push(notification)`, `dismiss(id)`, `clearAll()`, and `$reset()` actions.
- **FR-006**: Error-type (`type: 'error'`) notifications MUST be persistent by default (`duration: undefined`) and only dismissed by explicit user action.
- **FR-007**: Success notifications MUST auto-dismiss after 3–5 seconds; info notifications after 4–6 seconds; warning notifications after 6–8 seconds. These MUST be applied as default `duration` values when not explicitly supplied.

**Error Normalization**

- **FR-008**: All errors thrown by API calls, Pinia store actions, or global unhandled rejections MUST pass through `normalizeError()` in `src/core/errors/error-normalizer.ts` before reaching the notification store. No component may call the notification store with a raw `Error` or raw API response object.
- **FR-009**: `normalizeError()` MUST handle all 7 input cases: `TypeError` (network failure), `AppError` passthrough, legacy `NormalizedError`, structured API body `{ success: false, error: { code, message } }`, `AdapterResponse`, raw HTTP-like object with status code, and unknown fallback.
- **FR-010**: The normalized `AppError` MUST never include tokens, session IDs, stack traces, or raw SQL. The `redactError()` utility MUST be used when logging in production mode.
- **FR-011**: `ErrorCodes` from `@zidney/api-client` MUST be the sole source of error code constants (`VALIDATION_ERROR`, `PERMISSION_DENIED`, `NOT_FOUND`, `CONFLICT`, `SERVER_ERROR`, `NETWORK_ERROR`, `UNKNOWN_ERROR`, etc.).

**Error Routing by HTTP Status**

- **FR-012**: HTTP 400 (Validation) errors MUST result in inline field-level error display when inside a form context. A global toast MUST NOT fire for field-level validation errors unless no form context is present.
- **FR-013**: HTTP 401 (Unauthorized) errors MUST trigger a redirect to the login route. No toast should be shown for the initial 401; subsequent 401s in a short window MUST be deduplicated to prevent notification loops.
- **FR-014**: HTTP 403 (Forbidden) errors MUST display a permission-denied banner or toast (not a redirect). The user stays on the current page.
- **FR-015**: HTTP 409/422 (Business Rule) errors MUST display a dismissible warning or error toast with the sanitized message from the API `error.message` field.
- **FR-016**: HTTP 5xx (Server) errors MUST display a generic error toast ("Something went wrong. Please try again."). If a correlation ID is available in the API response, it MAY be shown in the toast for support reference.
- **FR-017**: Network errors (`isNetworkError: true`) MUST trigger the offline banner mechanism (FR-025) and MUST NOT generate individual error toasts.

**Toast UI Component**

- **FR-018**: All three apps MUST use the `Toaster` component exported from `@zidney/ui-system` (`packages/ui-system/src/components/shadcn-vue/sonner/`) as the toast rendering primitive. The `Toaster` component MUST be mounted once at the root layout level in each app's `App.vue` or root layout component.
- **FR-019**: Toast visual hierarchy: success → green accent; error → red accent; warning → yellow accent; info → neutral accent. These MUST map to the existing Sonner component's `type` prop.
- **FR-020**: Toast container MUST use a z-index that ensures toasts render above all other application layers (minimum `z-50` in Tailwind CSS v4 or equivalent CSS variable).
- **FR-021**: Toast notifications MUST include an accessible ARIA live region. The `Toaster` from `vue-sonner` handles this natively; no additional ARIA annotations are required unless custom components are introduced.
- **FR-022**: Toast notifications MUST be manually dismissible by the user (a close button) regardless of auto-dismiss timer.

**Form Feedback**

- **FR-023**: All form fields using `vee-validate` + `zod` MUST display field-level validation errors below the relevant input using the `<FormMessage>` component from `@zidney/ui-system`. Errors MUST be cleared when the field value changes.
- **FR-024**: Submit buttons MUST be disabled and display a loading indicator while the associated async action is in flight (`isLoading: true` state). The button MUST re-enable on action completion regardless of success or error outcome.

**Offline / Reconnect**

- **FR-025**: All three apps MUST implement an offline detection composable (using `useOnline` from `@vueuse/core`) that triggers a persistent top-of-viewport banner reading "Connection lost" when `isOnline` is `false`. The banner MUST automatically disappear when connectivity is restored.
- **FR-026**: The offline banner MUST be rendered at the root layout level, always above page content, and MUST NOT be dismissible by user action (it auto-closes only when connectivity restores).

**Async Action Pattern**

- **FR-027**: All async Pinia store actions that trigger API calls MUST follow the `try/catch` pattern: set loading state → await API call → on success notify if appropriate → on catch `normalizeError()` → notify with normalized message → always reset loading in `finally`.
- **FR-028**: No async store action may swallow an error silently. Every `catch` block MUST either notify the user or re-throw.

**Multi-App Specifics**

- **FR-029**: In Backoffice, error notification messages MAY include the current `workspace_slug` as contextual support information. This slug MUST be sourced from the workspace store, never from the raw request or response.
- **FR-030**: In Frontoffice, when an active exam attempt is in progress (`isExamActive: true` in the attempt state), `success` and `info` type notifications MUST be suppressed from rendering. `warning` and `error` notifications MUST still render.

**Security / Logging**

- **FR-031**: No component, store, or composable may call `console.log`, `console.debug`, `console.info`, or `console.error` with raw API response objects, tokens, or error objects that have not been passed through `redactError()`.
- **FR-032**: In production mode (`import.meta.env.PROD === true`), all `console.debug` calls inside the notification and error handling layers MUST be stripped or suppressed.

---

### Non-Functional Requirements

- **NFR-001 — Performance**: The notification store's deduplication check (`type + message` hash within a 2-second window) MUST complete in O(n) time for queue sizes of up to 20 entries. No blocking async operations in the store.
- **NFR-002 — Accessibility**: Toast notifications MUST be announced to screen readers. The `vue-sonner` `Toaster` component uses `aria-live="polite"` for non-error toasts and `aria-live="assertive"` for error/warning toasts. This behavior MUST not be overridden.
- **NFR-003 — Type Safety**: All notification store types, error normalizer input/output types, and composable interfaces MUST be fully TypeScript-typed with no `any` (except where explicitly exempted in `ALLOWED_ANY_EXCEPTIONS.json`).
- **NFR-004 — Testability**: The notification store and `normalizeError()` function MUST be testable without a real backend. All tests MUST use Vitest with Pinia test utilities (`createPinia`, `setActivePinia`).
- **NFR-005 — Consistency**: The `AppNotification` interface shape MUST be identical across all three apps until it is moved to `@zidney/types` in a future cleanup stage (per NOTE M-01 in existing stores).
- **NFR-006 — No External Dependencies**: The notification and error layers MUST NOT introduce new third-party runtime dependencies beyond `pinia`, `vue-sonner`, `@vueuse/core`, and `@zidney/api-client`. All of these are already in the monorepo.

---

## Technical Architecture

### Component Graph

```
App.vue (root)
├── <Toaster /> (from @zidney/ui-system — mounted once per app)
├── <OfflineBanner /> (from shared or each app's components)
└── <RouterView>
    └── Page/Module Components
        └── Forms → <FormMessage> (inline validation errors)
```

### Notification Store Interface

Location per app:

- `apps/mmc/src/core/state/notification.store.ts`
- `apps/backoffice/src/core/state/notification.store.ts`
- `apps/frontoffice/src/core/state/notification.store.ts`

**Interface (identical across all three apps):**

```typescript
export interface AppNotification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number; // ms; undefined = persistent (error default)
  dismissible: boolean;
}

// Store exports:
// notifications: Ref<AppNotification[]>
// push(notification: Omit<AppNotification, 'id'>): string
// dismiss(id: string): void
// clearAll(): void
// $reset(): void
```

**Deduplication logic** (to be added to existing stores):

```typescript
// Before pushing, check for duplicate (same type + message within 2s)
const DEDUP_WINDOW_MS = 2000;
const recentKey = `${notification.type}:${notification.title}:${notification.message ?? ""}`;
const isDuplicate = notifications.value.some(
  (n) => `${n.type}:${n.title}:${n.message ?? ""}` === recentKey,
);
if (isDuplicate) return ""; // suppressed
```

**Visible cap enforcement** (separate from max queue):

```typescript
// Computed: only the most recent 5 notifications are rendered
const visibleNotifications = computed(() => notifications.value.slice(-5));
```

### Error Normalizer

Location per app:

- `apps/mmc/src/core/errors/error-normalizer.ts` _(existing)_
- `apps/backoffice/src/core/errors/error-normalizer.ts` _(existing)_
- `apps/frontoffice/src/core/errors/error-normalizer.ts` _(existing)_

**Interface:**

```typescript
// Input: unknown (anything thrown from a try/catch)
// Output: AppError (from @zidney/api-client)
function normalizeError(raw: unknown): AppError;
```

All three apps share the same implementation (already in sync across apps). This stage verifies that all Pinia store actions use `normalizeError()` before passing errors to the notification store.

### `useOfflineBanner` Composable

Location (per app or shared):

- `apps/*/src/composables/useOfflineBanner.ts` OR `apps/*/src/core/navigation/offline-banner.ts`

```typescript
import { useOnline } from "@vueuse/core";
import { computed } from "vue";

export function useOfflineBanner() {
  const isOnline = useOnline();
  const showBanner = computed(() => !isOnline.value);
  return { showBanner };
}
```

### `useNotify` Composable (optional convenience layer)

Location: `apps/*/src/composables/useNotify.ts`

Wraps the notification store with typed convenience methods that apply default durations:

```typescript
export function useNotify() {
  const store = useNotificationStore();
  return {
    success: (title: string, message?: string) =>
      store.push({ type: "success", title, message, duration: 4000, dismissible: true }),
    error: (title: string, message?: string) =>
      store.push({ type: "error", title, message, duration: undefined, dismissible: true }),
    warning: (title: string, message?: string) =>
      store.push({ type: "warning", title, message, duration: 7000, dismissible: true }),
    info: (title: string, message?: string) =>
      store.push({ type: "info", title, message, duration: 5000, dismissible: true }),
  };
}
```

### Async Action Pattern (Pinia Store)

```typescript
// Standard pattern for all store actions
async function performAction(payload: ActionPayload): Promise<void> {
  isLoading.value = true;
  try {
    const result = await apiClient.someEndpoint(payload);
    notify.success("Action completed", "Your changes have been saved.");
  } catch (raw) {
    const error = normalizeError(raw);
    notify.error("Action failed", error.message);
  } finally {
    isLoading.value = false;
  }
}
```

### Error-to-Notification Routing Logic

| HTTP Status | Error Code                  | Notification Type     | Placement         |
| ----------- | --------------------------- | --------------------- | ----------------- |
| 400         | VALIDATION_ERROR            | Inline form field     | Below input field |
| 401         | AUTH_REFRESH_FAILED         | Redirect + no toast   | Route change      |
| 403         | PERMISSION_DENIED           | Warning toast         | Toast queue       |
| 409         | CONFLICT                    | Error toast           | Toast queue       |
| 422         | VALIDATION_ERROR / CONFLICT | Error toast           | Toast queue       |
| 500         | SERVER_ERROR                | Error toast (generic) | Toast queue       |
| 0 / network | NETWORK_ERROR               | Offline banner        | Top viewport      |
| Unknown     | UNKNOWN_ERROR               | Error toast (generic) | Toast queue       |

---

## UI/UX Specification

### Toast Placement and Behavior

- **Position**: Bottom-right of the viewport (default Sonner position). May be overridden per app to `top-right` if the design system dictates, but MUST be consistent within each app.
- **Z-index**: Toast stack uses `z-[9999]` (or Tailwind `z-50`+ equivalent). No application layer may exceed this.
- **Max visible**: 5 toasts. Overflow evicts oldest.
- **Width**: Fixed width toast card (320–400px) with text truncation prevention (multi-line support enabled).
- **Close button**: Always visible on all toast types. Keyboard accessible (`Tab` navigable, `Enter`/`Space` to dismiss).

### Toast Visual Hierarchy

| Type      | Icon            | Accent       | Default Duration |
| --------- | --------------- | ------------ | ---------------- |
| `success` | ✓ CircleCheck   | Green        | 4 seconds        |
| `info`    | ℹ Info          | Neutral/Blue | 5 seconds        |
| `warning` | △ TriangleAlert | Yellow/Amber | 7 seconds        |
| `error`   | ✕ OctagonX      | Red          | Persistent       |

### Inline Form Validation

- Error text appears immediately below the field on blur or submit attempt.
- Error text uses `text-destructive` (red from design tokens) with `text-sm`.
- Error text is hidden when the field value changes (re-validates on input).
- Multiple field errors are shown simultaneously (all fields, not just the first).
- Form-level errors (non-field errors from the server) appear above the submit button.

### Offline Banner

- Full-width bar at the very top of the viewport, above the navigation.
- Background: `bg-destructive` or yellow/amber offline-specific token.
- Text: "Connection lost — working offline. Some features may be unavailable."
- No dismiss button; auto-hides when connectivity returns.
- Pushes page content down slightly (not overlaid).
- ARIA: `role="status"` or `role="alert"` with appropriate live region.

### Loading State on Buttons

- Submit buttons display a `Loader2` spinner icon (from `@zidney/ui-system`) with `animate-spin` when `isLoading` is true.
- Button text changes to "Saving..." or remains unchanged (design system convention — keep text, add spinner).
- `disabled` attribute applied programmatically to prevent any interaction.

---

## Security Requirements

- **SEC-001**: Raw API error responses MUST never be passed to `console.log`, `console.debug`, or any analytics event. All error data MUST pass through `redactError()` before any external logging.
- **SEC-002**: Toast message content MUST NOT contain tokens, passwords, internal server paths, raw SQL fragments, or stack traces. The `normalizeError()` function already strips these via the structured API response contract; final rendering displays only `AppError.message`.
- **SEC-003**: Correlation IDs shown in error toasts are non-sensitive (random UUIDs) and MAY be displayed. They MUST NOT be derived from or expose internal infrastructure identifiers.
- **SEC-004**: In Backoffice, workspace context in error messages MUST use the public-facing `workspace_slug` only — never the internal `workspace_id` UUID.
- **SEC-005**: The offline banner MUST NOT trigger any network probe or retry fetch that could leak authentication tokens on reconnect.
- **SEC-006**: Global error handlers registered via `registerGlobalErrorHandlers()` MUST process errors through `normalizeError()` before invoking the notification store, ensuring no raw `Error.stack` reaches the UI.

---

## Testing Requirements

### Unit Tests — Notification Store

Location: `apps/*/src/core/state/__tests__/notification.store.spec.ts`

| Test                  | Description                                                                      |
| --------------------- | -------------------------------------------------------------------------------- |
| Push and retrieve     | Pushing a notification adds it to the queue; retrievable by ID                   |
| Deduplication         | Identical `type+title+message` within 2s are suppressed                          |
| Deduplication expiry  | After 2s, the same notification can be pushed again                              |
| Max queue enforcement | Queue evicts oldest when > 20 entries pushed                                     |
| Visible cap           | Computed `visibleNotifications` returns at most 5                                |
| Dismiss               | `dismiss(id)` removes only the targeted notification                             |
| ClearAll              | `clearAll()` empties the queue                                                   |
| Auto-dismiss timer    | Success notification `duration: 4000` can be simulated with `vi.useFakeTimers()` |
| Error persistence     | Error notification with `duration: undefined` does NOT auto-dismiss              |

### Unit Tests — Error Normalizer

Location: `apps/*/src/core/errors/__tests__/error-normalizer.spec.ts`

| Test                 | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| TypeError input      | Returns `AppError` with `isNetworkError: true`                        |
| AppError passthrough | Returns same object unchanged                                         |
| Structured API body  | Extracts `code` and `message` from `{ success: false, error: {...} }` |
| AdapterResponse      | Delegates to `normalizeResponseError()`                               |
| Unknown fallback     | Returns `UNKNOWN_ERROR` code                                          |
| Null input           | Does not throw; returns fallback error                                |

### Integration Tests — Store + Normalizer

Location: `apps/*/src/core/__tests__/notification-flow.spec.ts`

| Test                           | Description                                                    |
| ------------------------------ | -------------------------------------------------------------- |
| 400 error → inline             | Validation error routed to form field, not global toast        |
| 401 error → redirect           | Auth failure triggers navigation to login                      |
| 500 error → generic toast      | Server error shows safe message; raw error not displayed       |
| Network error → offline banner | `isNetworkError: true` suppresses toast, triggers banner       |
| Async action pattern           | Store action sets loading, notifies on success, resets loading |
| Double-submit prevention       | Second submit call ignored while first is in flight            |

### Component Tests — Toast Rendering

Location: `apps/*/src/components/__tests__/toaster.spec.ts` (or equivalent)

| Test                  | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| Toaster renders       | `<Toaster>` mounts without error                              |
| Success toast visible | Success notification renders with green accent                |
| Error toast visible   | Error notification renders with red accent and no close timer |
| Max 5 visible         | Only 5 toasts visually render when queue > 5                  |

### Offline Banner Tests

| Test                      | Description                                    |
| ------------------------- | ---------------------------------------------- |
| Banner shows when offline | `useOnline()` returns `false` → banner renders |
| Banner auto-hides         | `useOnline()` returns `true` → banner unmounts |
| No dismiss button         | Banner has no interactive close control        |

---

## Completion Criteria

- [ ] All three notification stores implement deduplication (2-second window by `type+title+message`)
- [ ] All three notification stores enforce a maximum of 5 visually rendered notifications
- [ ] All three apps mount `<Toaster>` from `@zidney/ui-system` in the root layout
- [ ] `<OfflineBanner>` composable using `useOnline()` from `@vueuse/core` is implemented in all three apps
- [ ] All Pinia store async actions follow the `try/catch/finally` pattern with `normalizeError()`
- [ ] No store action contains a silent `catch` block (either notifies user or re-throws)
- [ ] HTTP 400 validation errors render inline at form field using `<FormMessage>`; no global toast fires
- [ ] HTTP 401 triggers login redirect; no toast fires for the initial failure
- [ ] HTTP 5xx renders generic error toast without stack trace or raw response data
- [ ] `redactError()` is called before any `console.*` logging of error data
- [ ] Frontoffice suppresses `info`/`success` toasts during active exam attempt
- [ ] Deduplication unit tests pass for all three apps
- [ ] Error normalizer unit tests pass for all three apps (covering all 7 input cases)
- [ ] Async action integration tests pass (loading state, success notify, error notify)
- [ ] Offline banner renders/hides correctly in response to `navigator.onLine` changes
- [ ] TypeScript strict mode passes (`bun run typecheck`) with zero `ts-error` violations in notification/error layers
- [ ] Biome lint passes (`bun run lint`) with zero warnings in notification/error layers
- [ ] No raw API response is rendered anywhere in the UI (automated test or visual review passing)
- [ ] No TODO placeholders remain in the notification or error handling layers

---

## Out of Scope

- Business error code registry (no new error codes defined here; uses existing `ErrorCodes` from `@zidney/api-client`)
- Backend error schema changes (backend contract is already defined; this stage is UI-only)
- Real-time WebSocket notification push (excluded per stage design)
- Email, SMS, or push notification delivery
- Notification center or inbox (no persistent history)
- Cross-tenant notification isolation (UI has no tenant cross-contamination risk; tenant resolution is API concern)

---

## Clarifications

### Session 2026-04-07

**Q: The spec text requires a "2-second deduplication window," but the pseudocode uses `notifications.value.some(...)` with no timestamp comparison — this checks the entire current queue, not time-bounded entries. What is the canonical implementation mechanism?**
A: The notification store MUST maintain a private `lastPushed: Map<string, number>` (key → Unix ms timestamp) alongside the notification queue. This Map is NOT part of the `AppNotification` interface. Before pushing, compute `recentKey = \`${type}:${title}:${message ?? ""}\`` and check `Date.now() - (lastPushed.get(recentKey) ?? 0) < DEDUP_WINDOW_MS`. If within the window, suppress and return `""`. On accepted push, set `lastPushed.set(recentKey, Date.now())`. The Map is cleared in `$reset()`and`clearAll()`. This keeps the `AppNotification` interface clean and makes the 2-second window truly time-bounded rather than existence-bounded.

**Q: The spec references `AppError` from `@zidney/api-client` but never declares its full typed interface. What canonical fields does `AppError` contain, and what must implementers import?**
A: `AppError` (from `@zidney/api-client`) has the following minimum shape: `{ code: string; message: string; isNetworkError: boolean; statusCode?: number; correlationId?: string }`. Implementers MUST import `AppError` directly from `@zidney/api-client` — never re-declare or re-define it. The `normalizeError()` function always returns this type. The `redactError()` utility strips `stack`, tokens, and internal paths before any logging — it operates on `AppError` exclusively. No app-local `NormalizedError` type should be used after this stage; any legacy aliases must be aliased to `AppError` at the import boundary.

**Q: The spec does not state whether the notification queue is cleared on route navigation. What is the intended behavior when the user navigates away from the current page?**
A: Notifications MUST persist across route changes. `clearAll()` is never called by router navigation guards. Persistent `error` notifications remain visible until the user explicitly dismisses them. `success`/`info`/`warning` notifications auto-dismiss per their `duration` timers regardless of navigation. This ensures users see the outcome of actions even if a page transition is triggered immediately after (e.g., redirect after successful save). Each app's `router/index.ts` global navigation guard MUST NOT invoke `notificationStore.clearAll()`. Logout flows MAY call `clearAll()` explicitly as part of session teardown — this is intentional and correct.

**Q: FR-030 states that Frontoffice suppresses `success`/`info` toasts when `isExamActive: true`, but does not specify WHERE this guard lives. Does the notification store itself check exam state, or is the suppression applied at the composable layer?**
A: The suppression lives exclusively in the Frontoffice `useNotify()` composable (`apps/frontoffice/src/composables/useNotify.ts`). The notification store itself has NO knowledge of exam state — it remains domain-agnostic. In Frontoffice only, `useNotify()` imports `useAttemptStore()` and reads `isExamActive`. The `success()` and `info()` methods skip `store.push()` silently when `isExamActive` is `true`. The `error()` and `warning()` methods always call `store.push()` unconditionally. MMC and Backoffice `useNotify()` composables do NOT include this guard. This isolates exam-mode logic to Frontoffice and keeps the store reusable.

**Q: FR-017 suppresses individual error toasts for network failures and FR-025 shows an offline banner, but the spec does not state whether failed API requests are queued for automatic retry when connectivity is restored. Is request queuing in scope?**
A: Request queuing and automatic retry on reconnect are explicitly OUT OF SCOPE for this stage. This stage is UI-only (notification and feedback layer). Failed requests during offline state are not queued. The offline banner communicates the degraded state; users must manually retry their actions after the connectivity banner disappears. Automatic retry belongs to a future service worker or background job stage. The `useOfflineBanner` composable MUST NOT initiate any network requests or maintain a retry queue. The online/offline state transition triggers only banner visibility — nothing else.

- Moving `AppNotification` interface to `@zidney/types` (deferred, noted as M-01 in existing stores)
- Sentry or external error reporting integration (out of scope for this stage; may be added in an observability stage)

---

## Risks & Mitigations

| Risk                                                   | Likelihood | Impact | Mitigation                                                             |
| ------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------- |
| Existing stores have inconsistent deduplication        | Medium     | Medium | Spec mandates identical behavior; unit tests enforce it                |
| Silent catch blocks in existing store actions          | High       | High   | Integration tests scan for missing error notifications; CI enforcement |
| Toast z-index collides with modal overlays             | Low        | Medium | Use design system z-index token hierarchy; test with modals open       |
| Frontoffice exam mode suppression is overridden        | Low        | High   | Unit test asserts suppression logic tied to attempt state              |
| `redactError()` not called in all production log paths | Medium     | High   | Biome lint rule or code review checklist item                          |
| Offline banner triggers during server-side rendering   | Low        | Low    | `useOnline()` from VueUse is SSR-safe; no window access during SSR     |
| Duplicate notification during rapid retry loops        | Medium     | Medium | Deduplication window + max queue cap are layered defenses              |

---

## Assumptions

1. The existing `AppNotification` interface in all three apps is already structurally identical (confirmed by reading source files). This stage extends behavior, not the shape.
2. `vue-sonner` is already installed in the monorepo (confirmed by `Sonner.vue` importing `vue-sonner`).
3. `@vueuse/core` is available in all three frontend apps (standard dependency for the platform).
4. The `useOnline` composable from `@vueuse/core` is the standard mechanism for offline detection (no custom polling or WebSocket-based approach).
5. The deduplication 2-second window uses in-memory queue scan (no hash map) — acceptable for queue sizes ≤ 20 entries.
6. "Active exam" state in Frontoffice is available as a reactive boolean from an existing attempt/exam store (STAGE_UI_06 predecessor).
7. The `<FormMessage>` component for inline validation display is available from `@zidney/ui-system` (established in prior UI stages).
