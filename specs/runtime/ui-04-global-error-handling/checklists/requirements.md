# Requirements Checklist — STAGE_UI_04_GLOBAL_ERROR_HANDLING

**Spec**: `specs/runtime/ui-04-global-error-handling/spec.md`
**Reviewed**: 2026-04-06
**Reviewer**: speckit.specify agent

---

## 1. Specification Completeness

- [x] Feature overview describes what the stage delivers and what it does NOT deliver
- [x] Spec aligns with stage file (`STAGE_UI_04_GLOBAL_ERROR_HANDLING.md`) purpose and scope
- [x] At least 8 user stories present (10 written)
- [x] Every user story has acceptance criteria (minimum 3 AC per story)
- [x] Acceptance criteria are measurable and testable (observable outcomes, not implementation steps)
- [x] Technical requirements section covers all 4 required artifacts: `AppError`, `error-normalizer`, `ErrorBoundary`, `global-error-handler`
- [x] HTTP status mapping table (400/401/403/404/409/423/426/429/500+) included
- [x] File structure section specifies NEW / REPLACE / DELETE for every affected file
- [x] Completion criteria checklist matches stage file criteria
- [x] No `[NEEDS CLARIFICATION]` markers in spec

---

## 2. Constitutional Compliance

- [x] No database imports specified anywhere in implementation path
- [x] No `import.meta.env` reads inside error handler logic (env flag checked only for production redaction — not business logic)
- [x] No business logic in normalizer — pure HTTP status → code mapping only
- [x] Backend error codes preserved as-is — frontend cannot override them (AC7.8)
- [x] No automatic retry for business errors — retryable flag only for transport-level (AC2.4, AC3.5)
- [x] No stack traces in production — enforced by `redact-error.ts` (TR5) and ErrorBoundary (TR3)
- [x] No silent error swallowing — all paths produce logged AppError (AC5.4, AC4.6)
- [x] No JWT decoding or token inspection in error layer (TR4, AC6.1)
- [x] No cross-app imports (`apps/* → apps/*` forbidden) — each app has its own `core/errors/`

---

## 3. Multi-App Consistency

- [x] `AppError` interface is canonical in `packages/api-client/src/types.ts` — not duplicated
- [x] All three apps (MMC, Backoffice, Frontoffice) appear explicitly in File Structure section
- [x] All three apps have identical `core/errors/` file layout specified
- [x] Local `NormalizedError` deletion called out as explicit action in all three apps
- [x] `ErrorCodes` registry extension in `packages/api-client` covers all apps
- [x] Apps may only differ in fallback UI styling — logic must be identical (AC9.3)
- [x] US9 (cross-app consistency) and AC9.1–9.5 are present

---

## 4. Security Compliance

- [x] `redact-error.ts` utility specified with pure-function contract (TR5)
- [x] No token pattern can appear in logger output — AC6.1 and AC6.5 verified via tests
- [x] Stack traces stripped in production — AC6.2 and ErrorBoundary TR3 requirement
- [x] Raw backend messages replaced if sensitive — AC6.3
- [x] Redactor does not mutate input — AC6.4 (immutability contract)
- [x] US6 (sensitive data) is P1 priority — highest risk addressed first
- [x] No access tokens or refresh tokens referenced in any error-layer file path

---

## 5. Testability Requirements

- [x] `error-normalizer.ts` tests: all HTTP status codes, TypeError, pre-normalized passthrough, fallback
- [x] `redact-error.ts` tests: token stripping, production stack trace removal, no-mutation contract
- [x] `global-error-handler.ts` tests: can be called directly without firing `window` events (AC10.3)
- [x] `ErrorBoundary.vue` tests: normal render, error capture, fallback render, reset, no stack trace
- [x] Integration test scenarios listed for all 3 apps (500, 429, network drop, rejection, render crash)
- [x] Coverage thresholds specified: normalizer 100%, redactor 100%, handler ≥90%, boundary ≥80%
- [x] US10 (testability) explicitly covers no-global-state requirement for all utilities
- [x] `error-normalizer.ts` is specified as a pure function — no mocking of singletons required (AC1.6, AC10.1)

---

## 6. Technical Completeness

- [x] `ErrorCodes` registry extension is specified with exact new codes (TR7)
- [x] `registerGlobalErrorHandlers` and `unregisterGlobalErrorHandlers` export signatures specified (TR4)
- [x] `main.ts` integration pattern shown with example code (TR6)
- [x] `ErrorBoundary.vue` responsibilities listed (all 7 items in TR3)
- [x] `useErrorDisplay` composable for display mode selection mentioned (AC8.4)
- [x] Three supported display modes defined: inline, toast, full-page (AC8.1)
- [x] `isAppError` and `createAppError` from `@zidney/api-client` referenced for reuse in normalizer (TR2)

---

## 7. Stage Governance

- [x] Stage status is DRAFT — spec.md is appropriate for this step
- [x] Spec does not implement (no code beyond pseudocode/examples)
- [x] Constitutional Compliance Declaration table present
- [x] Isolation Impact Analysis section present
- [x] No hardcoded workspace IDs or tenant references
- [x] Current State Analysis section documents the problem (NormalizedError divergence) explicitly
- [x] Open Questions section present (none at time of authoring)

---

## Result

**PASS** — Spec is complete and ready for `speckit.clarify` review step.

All 7 categories pass. No blocking items identified.
Zero `[NEEDS CLARIFICATION]` markers.
