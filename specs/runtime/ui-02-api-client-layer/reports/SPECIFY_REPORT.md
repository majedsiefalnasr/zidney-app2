# Specify Report — API Client Layer

**Step:** 1 — Specify  
**Timestamp:** 2026-02-28T22:05:00Z  
**Status:** COMPLETE

---

## Summary

Specification generated for the centralized API Client Layer shared across MMC, Backoffice, and
Frontoffice apps. The spec defines a typed HTTP client abstraction with auth token injection, 401
refresh/retry, error normalization, idempotency support, rate-limit surfacing, request cancellation,
and correlation ID propagation. 10 user stories, 23 functional requirements, and 10 measurable
success criteria were captured. No unresolved clarification markers — all items passed the
checklist.

---

## Inputs Reviewed

- `specs/runtime/ui-02-api-client-layer/spec.md`
- `specs/runtime/ui-02-api-client-layer/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                   | Rationale                                                                                                                 |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Single client abstraction in `core/api/client.ts`          | All HTTP calls must pass through a unified entry point to enforce auth, error normalization, and observability            |
| 2   | Injectable HTTP adapter for testability                    | Mock adapter pattern allows full client behavior testing without network access                                           |
| 3   | Single-flight refresh on 401                               | Prevents concurrent refresh storms when multiple requests receive 401 simultaneously                                      |
| 4   | No auto-retry on 429                                       | Rate-limit responses surfaced to UI for user messaging; hidden retries violate transparency                               |
| 5   | Idempotency keys are caller-provided, never auto-generated | Caller owns key semantics; client is transport-only                                                                       |
| 6   | Per-app base URL configuration from env.ts                 | MMC (platform), Backoffice (workspace-scoped), Frontoffice (student runtime) all share client code with different configs |
| 7   | Infrastructure only — no business endpoints                | Explicit non-goal to keep stage scope tight                                                                               |

---

## Functional Requirements Captured

- FR-001: Single typed API client abstraction (`client.ts`)
- FR-002: Typed generic methods (`get<T>`, `post<T>`, `patch<T>`, `delete<T>`)
- FR-003: No `any` types in client public API
- FR-004–005: Auth token injection (attach when available, omit when not)
- FR-006–009: 401 refresh/retry (single-flight, exactly once, no infinite loops)
- FR-010: Error normalization to `AppError` structure
- FR-011–012: 429 rate-limit surfacing with `retryAfter`, no auto-retry
- FR-013–014: Idempotency key header support (caller-provided only)
- FR-015: Per-app base URL configuration
- FR-016: Request cancellation via `AbortSignal`
- FR-017: Optional `X-Correlation-ID` header
- FR-018: No raw `Response` objects exposed to callers
- FR-019: Mock HTTP adapter injection for testing
- FR-020: Lint rule enforcing no direct `fetch`/`axios` imports
- FR-021–022: Folder structure (`core/api/`, `modules/<feature>/api.ts`)
- FR-023: No business endpoints — infrastructure only

---

## Clarifications Required

- None — all checklist items passed without unresolved markers.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                      |
| --------------------------------------- | ------ | ---------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Client routes to backend; tenant resolution is server-side |
| License middleware requirement captured | ✅     | License errors (423, 403) pass through as AppError         |
| Snapshot integrity requirement captured | ✅     | N/A — client is transport-only, no attempt state           |
| Idempotency strategy defined            | ✅     | FR-013/014 — caller-provided keys via header               |
| Transaction boundaries identified       | ✅     | N/A — no writes; backend owns transactions                 |
| Server-authoritative time enforced      | ✅     | Client does not generate or validate timestamps            |

**Overall:** COMPLIANT

---

## Open Risks

- None identified at specification stage.

---

## Next Step

Proceed to Step 2 — Clarify.
