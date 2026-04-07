# Security Checklist — STAGE_UI_08_NOTIFICATION_AND_FEEDBACK

**Stage**: STAGE_UI_08_NOTIFICATION_AND_FEEDBACK  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Apps**: MMC, Backoffice, Frontoffice  
**Date**: 2026-04-07

---

## Error Data Handling

- [ ] Raw API error objects (`Error`, `AxiosError`, raw response bodies) are NEVER passed to `console.log`, `console.debug`, `console.info`, or `console.error` without first passing through `redactError()`
- [ ] `redactError()` is called in production mode (`import.meta.env.PROD === true`) before any structured logging of error data
- [ ] `normalizeError()` never throws or crashes on `null`, `undefined`, or malformed input — always returns a safe `AppError` fallback
- [ ] No `AppError.stack` trace, raw SQL fragment, internal server path, or session token appears in any toast message or inline form error
- [ ] `console.debug` calls inside the notification and error handling layers are stripped or suppressed in production builds

## Toast Content Safety

- [ ] Toast `title` and `message` fields are sourced exclusively from `AppError.message` (already sanitized by the API error contract) — never from raw `response.data` or `error.stack`
- [ ] Toast content is rendered via Vue template bindings (`{{ }}` or `:text`) — NEVER via `v-html` or `innerHTML` (XSS prevention)
- [ ] Correlation IDs displayed in error toasts are random UUIDs — verified not to encode infrastructure resource identifiers (host names, DB instance IDs, internal ports)
- [ ] No tokens, passwords, API keys, or session identifiers are concatenated into toast messages at any call site
- [ ] `AppError` type is imported from `@zidney/api-client` — never re-declared locally in a way that could bypass the redaction contract

## Multi-Tenant / Backoffice

- [ ] Backoffice error context (if workspace context is appended) uses ONLY `workspace_slug` (the public-facing identifier) — never `workspace_id` UUID or internal tenant DB primary key
- [ ] `workspace_slug` for contextual error messages is sourced from the Pinia workspace store — never from the raw API request body, URL params, or response payload
- [ ] No cross-tenant error information can appear in notification messages (tenant resolution remains an API concern; UI only displays data from the authenticated session)

## Offline Banner

- [ ] The `useOfflineBanner` composable (`useOnline()` from `@vueuse/core`) does NOT issue any network probe request on reconnect that could replay or leak authentication tokens
- [ ] The offline banner CANNOT be dismissed by user action — it is non-interactive and auto-hides only when `isOnline.value === true`
- [ ] The offline state is determined solely by `useOnline()` from `@vueuse/core` — no custom `fetch`-based ping that could expose auth headers

## Global Error Handlers

- [ ] `registerGlobalErrorHandlers()` (window `unhandledrejection`, `error` events) passes all caught errors through `normalizeError()` before invoking the notification store
- [ ] Global error handlers are only registered in browser context (guarded by `typeof window !== 'undefined'`) — no SSR exposure
- [ ] Unhandled rejection handler does not re-throw raw errors that could surface stack traces in browser console with sensitive data in arguments

## HTTP 401 / Authentication Redirect

- [ ] The HTTP 401 redirect to login does NOT append sensitive state (tokens, error codes, raw API messages) to the redirect URL as query parameters
- [ ] Subsequent 401s within a short deduplication window are suppressed (no notification loop from repeated auth checks)
- [ ] No toast is shown for the initial 401 — the redirect itself is the feedback mechanism

## Error Code Registry

- [ ] All error code constants (`VALIDATION_ERROR`, `PERMISSION_DENIED`, `NOT_FOUND`, `CONFLICT`, `SERVER_ERROR`, `NETWORK_ERROR`, `UNKNOWN_ERROR`) are sourced exclusively from `ErrorCodes` in `@zidney/api-client`
- [ ] No app-local error code string literals are introduced (e.g., hardcoded `"400"` or `"validation_failed"`) — all comparisons use the `ErrorCodes` enum

## TypeScript / Type Safety

- [ ] No `any` type used in the notification store, `normalizeError()`, `useNotify()`, or `useOfflineBanner()` (except for entries explicitly registered in `ALLOWED_ANY_EXCEPTIONS.json`)
- [ ] `AppNotification` interface has no optional fields that could unexpectedly be `undefined` at render time (all fields either typed as optional with safe fallbacks or required)
- [ ] `normalizeError()` parameter type is `unknown` — never `any` or a broad union that could bypass type-narrowing
