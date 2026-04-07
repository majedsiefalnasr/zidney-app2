# STAGE_UI_04_GLOBAL_ERROR_HANDLING

## Stage Type

UI Foundation — Global Error Boundary & Normalization Layer

---

## Stage Status

Status: PRODUCTION READY
Step: stage_production_ready
Risk Level: MEDIUM
Closure Date: 2026-04-06T03:00:00.000Z

Implementation: COMPLETE
Tasks: 32 / 32 completed

Scope Delivered:

- ✅ Canonical AppError interface in packages/api-client (ErrorCodes, mapHttpStatusToCode, normalizeResponseError)
- ✅ packages/api-client/src/index.ts: all error utilities exported
- ✅ error-normalizer.ts (per-app) with 7-branch normalization + legacy NormalizedError migration guard
- ✅ ErrorBoundary.vue (per-app, onErrorCaptured, inject appLogger + isProduction, fallback slot, reset)
- ✅ global-error-handler.ts (per-app) — unhandledrejection + error window listeners
- ✅ redact-error.ts (per-app) — Bearer token, password, secret, API key redaction
- ✅ Logger + isProduction provided via app.provide() in main.ts (all 3 apps)
- ✅ ErrorBoundary wired in App.vue (all 3 apps)
- ✅ Legacy types.ts (NormalizedError) deleted from all 3 apps
- ✅ 12 new spec files + 6 legacy test files updated (894 tests passing)

Deferred Scope:

- Business-specific error UI (exam/license/affiliate copy)
- toastFromError integration (consumer responsibility)
- Offline detection / service worker errors

Architecture Governance Compliance:

- ADR import boundary: apps/_ → packages/_ only — enforced
- Architecture Guardian: PASS
- API Designer: PASS
- Security Auditor: PASS
- Performance Optimizer: PASS
- QA Engineer: PASS
- Code Reviewer: PASS
- ai:guard: PASS (1830/1830 checks)
- arch:audit: PASS (score 100/100)
- Governance gate: PASS (8/8 guards)
- AI Context: PASS (5/5 valid)

Audit Results:

- Tests: ✅ PASS (105 files, 894 tests passing)
- Lint: ✅ PASS (1973 files, 0 errors)
- TypeScript: ✅ PASS (0 errors)
- AI Guard: ✅ PASS (1830/1830)
- Architecture Audit: ✅ PASS (100/100)

Notes:
Stage is production ready. No structural modifications allowed.
Modifications require a new stage or amendment.

---

## Purpose

Define the centralized error handling strategy for all Zidney frontend applications:

- MMC
- Backoffice
- Frontoffice

This stage establishes:

- App-wide error boundary component
- Standardized AppError contract
- HTTP error surface mapping
- Async error interception
- Unhandled promise rejection handling
- Production vs development error behavior
- User-facing error UX strategy (non-business)

This stage does NOT implement business-specific error UI.

---

## Constitutional Constraints

Global error handling must:

- Never swallow backend errors silently
- Never expose sensitive data (tokens, stack traces in production)
- Never infer business state from error messages
- Never alter backend error codes
- Never implement retry logic for business actions automatically

Backend remains authoritative for:

- Error codes
- License violations
- Permission failures
- Validation rules

Frontend only normalizes and displays.

---

## Error Architecture Overview

All errors must flow through a single normalization layer:

```
core/errors/
  error-normalizer.ts
  app-error.ts
  error-boundary.vue
  global-error-handler.ts
```

No component should manually parse backend error shapes.

---

## AppError Contract

All surfaced errors must conform to:

```
interface AppError {
  code: string
  message: string
  httpStatus: number
  isNetworkError: boolean
  retryable?: boolean
}
```

Rules:

- code must always exist
- message must be safe for UI
- httpStatus must be preserved
- retryable only for transport-level failures (not business errors)

---

## HTTP Error Mapping

Client layer passes normalized errors to error-normalizer.

Mapping rules:

| HTTP Status | Behavior                                |
| ----------- | --------------------------------------- |
| 400         | ValidationError                         |
| 401         | Trigger refresh (handled in API client) |
| 403         | PermissionDenied                        |
| 404         | NotFound                                |
| 409         | Conflict                                |
| 423         | Locked                                  |
| 426         | UpgradeRequired                         |
| 429         | RateLimited                             |
| 500+        | ServerError                             |

Frontend must not reinterpret codes.

---

## Network Failure Handling

Network errors (no response):

- isNetworkError = true
- Show connectivity message
- Allow user retry manually
- No auto-loop retries

Offline state detection optional (future enhancement).

---

## Global Error Boundary

Each app must wrap root layout with:

```
<ErrorBoundary>
  <RouterView />
</ErrorBoundary>
```

Responsibilities:

- Catch render-time errors
- Catch async component errors
- Display fallback UI
- Log error (non-sensitive)

Must not display stack traces in production.

---

## Unhandled Promise Rejection

Global handler must be registered:

```
window.addEventListener("unhandledrejection", handler)
window.addEventListener("error", handler)
```

Responsibilities:

- Convert to AppError
- Forward to error-normalizer
- Prevent silent crashes

---

## Error Display Strategy

Three display modes allowed:

1. Inline form error
2. Toast notification
3. Full-page fallback

Selection depends on context, not error code.

No business branching inside error handler.

---

## Sensitive Data Redaction

Must ensure:

- No access token logged
- No refresh token logged
- No full request payload logged
- No stack trace shown in production
- No internal backend message shown if flagged sensitive

Error logging must pass through redaction utility.

---

## Testability Requirements

Must support:

- Simulated 500 error
- Simulated 429 error
- Simulated network drop
- Render crash test
- Async rejection test
- ErrorBoundary fallback rendering test

No global mutable singleton state.

---

## Multi-App Consistency

All three apps must:

- Use same AppError interface
- Use same error-normalizer
- Use same boundary behavior
- Use same logging redaction policy

Apps may customize fallback UI styling only.

---

## Explicit Non-Goals

This stage does NOT:

- Implement business validation messages
- Implement product-specific error UI
- Implement affiliate-specific error UI
- Implement exam-specific error UI
- Implement retry loops for business actions

Only infrastructure.

---

## Completion Criteria

Stage considered complete when:

- error-normalizer implemented
- AppError interface defined and exported
- Global boundary component implemented
- Unhandled promise listeners registered
- Production redaction verified
- 429 surfaced properly
- Network failure handled gracefully
- No raw backend error shapes leak into UI
- CI passes lint + TypeScript
- No TODO placeholders in error layer

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
