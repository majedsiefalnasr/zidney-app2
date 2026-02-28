# Clarify Report — TENANT_BOOTSTRAP

**Step:** 2 — Clarify
**Timestamp:** 2026-02-28T00:10:00Z
**Status:** COMPLETE

---

## Summary

5 targeted ambiguity questions were identified and self-resolved during the clarification session. The spec has been updated in-place with a `## Clarifications / ### Session 2026-02-28` section at the bottom. All functional requirement groups (FR-02, FR-05, FR-08) received additional entries. The middleware order chain was updated to include the `RBAC Permission Guard`. Migration ownership and error contract were definitively resolved. No open questions remain.

---

## Inputs Reviewed

- `specs/runtime/017-tenant-bootstrap/spec.md` (including appended `## Clarifications`)
- `specs/phases/03_BACKOFFICE_CORE/01_FOUNDATION/STAGE_17_TENANT_BOOTSTRAP.md`

---

## Clarifications Resolved

| #   | Category                     | Question                                                          | Resolution                                                                                                                                            | Impact                                                                                    |
| --- | ---------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Domain & Data Model          | RBAC migration: STAGE_05 baseline or separate STAGE_17 migration? | Separate STAGE_17 migration — one migration per feature rule; schema_version incremented independently                                                | Tasks must include a dedicated tenant migration for RBAC tables                           |
| 2   | Non-Functional / WebSocket   | License transition notification: polling vs event bus?            | 30-second polling per connection via `WS_LICENSE_POLL_INTERVAL_MS`; event bus deferred                                                                | FR-08 updated with polling interval + env var; no Redis eventing needed this stage        |
| 3   | Interaction & Error Contract | Non-ACTIVE state response: bare HTTP or structured JSON?          | Full error contract `{ success, data, error: { code, message } }` with typed codes `LICENSE_SOFT_LOCKED` / `LICENSE_ARCHIVED` / `WORKSPACE_NOT_FOUND` | FR-02 updated with error JSON structure; SPA branching rule added                         |
| 4   | Edge Cases / Migration       | DDL atomicity: 4 tables in one transaction?                       | Single DDL transaction; rollback-on-failure; worker retries ×3 then DLQ                                                                               | Transaction Boundaries section updated; migration must wrap all 4 CREATE TABLE statements |
| 5   | Constraints / Middleware     | RBAC middleware: embedded in auth or separate step?               | Separate `RBAC Permission Guard` registered after Authentication; canonical middleware chain updated                                                  | Constitutional Compliance Declaration + FR-05 updated with middleware position            |

---

## Open Items

None.

---

## Spec Updates Applied

- **Constitutional Compliance Declaration** — middleware chain updated: `Correlation ID → Tenant Resolver → License Enforcement → Schema Version → Authentication → RBAC Permission Guard → Route Handler`
- **FR-02.7** added — error response body is full `{ success, data, error }` contract with typed codes
- **FR-02.8** added — SPA must inspect HTTP status code and branch to workspace-unavailable screen based on code
- **FR-05.8** added — RBAC Permission Guard is a separate middleware function registered after Authentication
- **FR-08.7** added — WebSocket license check polls every `WS_LICENSE_POLL_INTERVAL_MS` ms (default: 30000)
- **FR-08.8** added — `WS_LICENSE_POLL_INTERVAL_MS` configurable via environment variable
- **Data Model — Migration Notes** — STAGE_17 owns RBAC migration; separate from STAGE_05 baseline; existing-tenant upgrade note added
- **Transaction Boundaries** — DDL transaction atomicity and rollback behavior documented
- **Clarifications session appended** — `## Clarifications / ### Session 2026-02-28` added to end of spec.md

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                                             |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 questions resolved; 0 deferred                                                                |
| Transaction strategy confirmed            | ✅     | DDL wrapped in single transaction; rollback-on-failure, retry ×3 → DLQ                            |
| Idempotency strategy confirmed            | ✅     | No write-heavy critical endpoints in bootstrap; migration is idempotent by design                 |
| Isolation boundaries confirmed            | ✅     | All RBAC tables in tenant DB; no master_db access; all operations in tenant connection pool       |
| Version and license constraints confirmed | ✅     | RBAC migration increments schema_version independently; license check required before every route |

**Overall:** COMPLIANT

---

## Open Risks

- STAGE_16 (Shared UI System / packages/ui-system) must expose AppLayout before frontend tasks in this stage can be completed. Track STAGE_16 completion.
- WebSocket polling at 30s interval may not be low enough for strict SLA environments — flagged for performance review at Step 5 (Analyze).
