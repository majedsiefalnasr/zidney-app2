# Plan Report — TENANT_BOOTSTRAP

**Step:** 3 — Plan  
**Timestamp:** 2026-02-28T00:00:00Z  
**Status:** COMPLETE

---

## Summary

Technical plan for STAGE_17_TENANT_BOOTSTRAP is complete after three rounds of Architecture Checker
remediation and three rounds of API Designer remediation. The plan covers:

- A single forward-only tenant DDL migration creating 4 RBAC skeleton tables (`roles`,
  `role_permissions`, `staff_users`, `staff_user_roles`)
- A new `GET /api/v1/backoffice/context` endpoint returning workspace config, user profile, and RBAC
  permissions
- A WebSocket endpoint at `/ws/backoffice` with Redis-based license polling (30 s default,
  configurable)
- A new `backoffice-rbac-guard` middleware with
  `createBackofficeRBACGuard(logger, resource, action)` signature
- A new `backoffice-module-guard` middleware for license module gating
- Updates to the existing `license-enforcement.ts` to add `correlationId` to all non-ACTIVE error
  responses
- A new Vue 3 backoffice SPA scaffold under `apps/backoffice/src/`

All Architecture Checker and API Designer guardian rounds returned **VERDICT: PASS**.

---

## Inputs Reviewed

- `specs/runtime/017-tenant-bootstrap/spec.md`
- `specs/runtime/017-tenant-bootstrap/plan.md`
- `specs/runtime/017-tenant-bootstrap/research.md`
- `specs/runtime/017-tenant-bootstrap/data-model.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                                                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API       | New `/api/v1/backoffice/context` route; new `/ws/backoffice` WS handler; new `backoffice-rbac-guard` middleware; new `backoffice-module-guard` middleware; update `license-enforcement.ts` (add `correlationId`); update `app.ts` middleware chains |
| Worker    | None                                                                                                                                                                                                                                                |
| Frontend  | New `apps/backoffice/` Vue 3 + Vite + Pinia + Vue Router scaffold; `useBackofficeContext` composable; pinia store; router guards                                                                                                                    |
| DB Master | None                                                                                                                                                                                                                                                |
| DB Tenant | New migration `20260228_001_tenant_rbac_skeleton.ts` — 4 tables: `roles`, `role_permissions`, `staff_users`, `staff_user_roles`                                                                                                                     |

---

## Key Technical Decisions

| #   | Decision                                                                                        | Rationale                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RBAC tables in a separate dedicated migration                                                   | Keep STAGE_17 DDL isolated from later RBAC population; forward-only, `IF NOT EXISTS` idempotency                                        |
| 2   | Redis-based WS license polling (`license:status:{workspace_id}`)                                | Avoids DB query from WebSocket handlers; license middleware writes Redis key on each request; multi-node safe                           |
| 3   | Redis WS connection registry (`ws:backoffice:{workspace_id}:{user_id}`, TTL = `WS_POLL_MS * 3`) | Replaces in-memory Map; multi-node safe; prevents duplicate connections per user                                                        |
| 4   | HttpOnly SameSite=Strict cookie auth (no `Authorization` header)                                | Aligned with STAGE_03; removes XSS vector from SPA; `credentials: 'include'` in fetch                                                   |
| 5   | `createBackofficeRBACGuard(logger, resource, action)` — 3-param signature                       | Consistent with other Zidney guard factories; structured logging per call                                                               |
| 6   | Explicit `/ws/backoffice` middleware chain in `app.ts`                                          | V-01 fix — WebSocket traffic must run through Tenant Resolver + License Enforcement + Auth; cannot rely on `/api/v1/backoffice/*` chain |
| 7   | All routes under `/api/v1/backoffice/*` with `createRateLimitMiddleware`                        | V-05 fix — rate limiting wired into API chain                                                                                           |
| 8   | `correlationId` added to all non-ACTIVE license, module guard, and RBAC error responses         | V-06 fix — mandatory for structured error observability                                                                                 |

---

## Migration Impact

| Item                  | Value | Notes                                                                    |
| --------------------- | ----- | ------------------------------------------------------------------------ |
| Migration required    | Yes   | `apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts` |
| `schema_version` bump | Yes   | Increment per ADR-0008 — tracked in `tenant_migrations`                  |
| Backward compatible   | Yes   | `IF NOT EXISTS` on all `CREATE TABLE` statements; safe to re-run         |

---

## Transaction Boundaries

- **RBAC migration:** entire DDL wrapped in a single `BEGIN … COMMIT` block — all 4 tables created
  atomically or none
- **`GET /api/v1/backoffice/context`:** read-only tenant DB query; no write transaction needed
- **WebSocket `onOpen`:** Redis `SET` for connection registry — atomic per Redis command
- **WebSocket `onClose`/`onError`:** Redis `DEL` cleanup — idempotent

---

## Idempotency Strategy

- **Migration:** `CREATE TABLE IF NOT EXISTS` on all 4 tables — safe to run multiple times
- **WS connection registry write:** `wsRedis.set(wsKey, '1', { EX: ttl })` — overwrite semantics; no
  duplicate-insert risk
- **Context endpoint:** pure read — inherently idempotent
- **RBAC / module guard errors:** stateless — re-evaluation on every request

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                                                |
| -------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | All DB access via tenant resolver pool; WS-01 violation resolved: no master DB query from WS handler |
| All writes are transactional by design | ✅     | Migration DDL in single transaction; Redis writes are atomic                                         |
| Server-authoritative time enforced     | ✅     | No client time accepted; timestamps from `Date.now()` server-side                                    |
| License middleware enforced            | ✅     | Both `/api/v1/backoffice/*` and `/ws/backoffice` chains include `licenseEnforcementMiddleware`       |
| Version compatibility enforced         | ✅     | `schemaVersionMiddleware` in API chain                                                               |
| No architecture redesign without ADR   | ✅     | Plan adds tables/routes/middleware; no changes to core Zidney trust chain design                     |

**Overall:** COMPLIANT

---

## Open Risks

- `license-enforcement.ts` pre-existing error shape lacks `correlationId`; this MUST be resolved as
  task API-04 in tasks.md — the plan explicitly mandates the update (UPDATE existing file note on
  line 241 of plan.md).
- WebSocket Redis key TTL (`WS_POLL_MS * 3`) assumes the poll interval is reliably ≤ its env var; if
  the poll stalls, the TTL may expire before `onClose`. This is acceptable for the bootstrap phase —
  connections will need to re-authenticate on reconnect.

---

## Next Step

Proceed to Step 4 — Tasks.
