# Tasks Report — API Client Layer

**Step:** 4 — Tasks  
**Timestamp:** 2026-02-28T22:20:00Z  
**Status:** COMPLETE

---

## Summary

76 atomic tasks generated across 14 phases, covering all 10 user stories plus setup, migration, and polish phases. 28 tasks marked as parallelizable. MVP scope (P1 stories) = phases 1–6 (31 tasks). Task format validated: all follow `- [ ] [ID] [P?] [Story?] Description with file path`.

---

## Inputs Reviewed

- `specs/runtime/ui-02-api-client-layer/spec.md`
- `specs/runtime/ui-02-api-client-layer/plan.md`
- `specs/runtime/ui-02-api-client-layer/data-model.md`
- `specs/runtime/ui-02-api-client-layer/contracts/api-client.ts`
- `specs/runtime/ui-02-api-client-layer/tasks.md`

---

## Task Breakdown

| Category                 | Count  | Notes                                                   |
| ------------------------ | ------ | ------------------------------------------------------- |
| Package Setup            | 12     | Package scaffold, types, exports (T001–T012)            |
| MockAdapter (P1)         | 5      | Injectable test adapter (T013–T017)                     |
| Typed Client (P1)        | 7      | createApiClient, FetchAdapter, core methods (T018–T024) |
| Auth Injection (P1)      | 4      | Token injection interceptor (T025–T028)                 |
| 401 Refresh (P1)         | 3      | Single-flight refresh, retry, queue (T029–T031)         |
| Error Normalization (P2) | 5      | AppError pipeline (T032–T036)                           |
| Rate Limiting (P2)       | 4      | 429 surfacing (T037–T040)                               |
| Idempotency (P2)         | 4      | Idempotency-Key header (T041–T044)                      |
| Multi-App Config (P2)    | 5      | Per-app wrappers (T045–T049)                            |
| Cancellation (P3)        | 5      | AbortSignal support (T050–T054)                         |
| Correlation ID (P3)      | 5      | X-Correlation-ID auto-gen (T055–T059)                   |
| App Migration            | 9      | MMC/Backoffice/Frontoffice migration (T060–T068)        |
| Lint Rules               | 4      | No direct fetch/axios enforcement (T069–T072)           |
| Polish                   | 4      | Final cleanup, validation (T073–T076)                   |
| **Total**                | **76** |                                                         |

---

## Transactional Tasks

- N/A — This is a UI infrastructure package with no direct database writes. Backend owns all transaction boundaries.

---

## Idempotency Tasks

- T041–T044: Implement Idempotency-Key header support in interceptor pipeline (client-side header attachment only; enforcement is backend)

---

## Constitutional Compliance

| Check                                        | Status | Notes                                               |
| -------------------------------------------- | ------ | --------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | N/A — no writes; UI transport only                  |
| Idempotency tasks are defined where required | ✅     | T041–T044 cover header support                      |
| Layer boundary rules are respected           | ✅     | New package in packages/; apps import from packages |
| No unrelated file modifications planned      | ✅     | Only api-client package + per-app wrappers          |
| Migration tasks included when required       | ✅     | N/A — no DB schema changes                          |

**Overall:** COMPLIANT

---

## Open Risks

- None

---
