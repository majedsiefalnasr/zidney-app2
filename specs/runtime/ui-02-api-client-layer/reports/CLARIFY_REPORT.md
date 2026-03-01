# Clarify Report — API Client Layer

**Step:** 2 — Clarify  
**Timestamp:** 2026-02-28T22:10:00Z  
**Status:** COMPLETE

---

## Summary

5 ambiguities identified and resolved with recommended defaults. Clarifications added FR-024 through FR-028, expanded edge cases, and updated assumptions. All categories are now fully resolved — no outstanding or deferred items remain.

---

## Inputs Reviewed

- `specs/runtime/ui-02-api-client-layer/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                           | Resolution                                                                       | Impact                                                   |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Should the API client enforce a default request timeout?           | Yes, 30s default, configurable per-request via `RequestConfig.timeout`           | Added FR-024, added `timeout` to RequestConfig entity    |
| 2   | Should the client auto-retry on transient network errors?          | No auto-retry for network errors; only 401 triggers retry after refresh          | Added FR-025, deterministic failure propagation          |
| 3   | Should the client support non-JSON content types?                  | JSON-only for this stage; file upload deferred                                   | Added FR-026, keeps HttpAdapter interface simple         |
| 4   | Should the API client emit structured logs?                        | No internal logging; errors propagated as AppError; callers handle observability | Added FR-027, avoids logger dependency in shared package |
| 5   | Is there a limit on concurrent requests queued during 401 refresh? | No explicit limit; browser connection limits provide natural throttling          | Added FR-028, all requests queued and retried            |

---

## Open Items

- None

---

## Spec Updates Applied

- Added FR-024: Default 30s request timeout, configurable per-request
- Added FR-025: No auto-retry on network errors
- Added FR-026: JSON-only content type for this stage
- Added FR-027: No internal logging/tracing in client
- Added FR-028: No explicit queue limit during 401 refresh
- Added `timeout` field to `RequestConfig` entity
- Added 4 new edge case scenarios (timeout, network error code, queue depth, non-JSON body rejection)
- Added 4 new assumptions (JSON-only, no logging, timeout default, no network retry)
- Appended `## Clarifications > ### Session 2026-03-01` section

---

## Constitutional Compliance

| Check                                     | Status | Notes                                             |
| ----------------------------------------- | ------ | ------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 questions resolved with defaults              |
| Transaction strategy confirmed            | ✅     | N/A — client is transport-only, no writes         |
| Idempotency strategy confirmed            | ✅     | Caller-provided keys via header (FR-013/014)      |
| Isolation boundaries confirmed            | ✅     | Per-app configuration, no cross-app state         |
| Version and license constraints confirmed | ✅     | Passthrough — license errors surfaced as AppError |

**Overall:** COMPLIANT

---

## Open Risks

- None

---
