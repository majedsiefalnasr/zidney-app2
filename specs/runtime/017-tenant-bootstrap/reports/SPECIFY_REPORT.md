# Specify Report — TENANT_BOOTSTRAP

**Step:** 1 — Specify
**Timestamp:** 2026-02-28T00:05:00Z
**Status:** COMPLETE

---

## Summary

The specification for STAGE_17_TENANT_BOOTSTRAP (Backoffice Runtime Foundation) has been successfully drafted. The spec covers the full scope of all 14 sections in the stage file — from runtime context injection and license enforcement through RBAC skeleton, module-aware layout, WebSocket lifecycle, and structured observability. All 12 acceptance criteria from the stage file are captured as `AC-01` through `AC-12`. No open `[NEEDS CLARIFICATION]` markers remain. Five ambiguities were resolved by inference (with rationale documented in the spec).

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/01_FOUNDATION/STAGE_17_TENANT_BOOTSTRAP.md` (14 sections, 284 lines)
- `docs/PROJECT_CONTEXT_PRIMER.md` (multi-tenancy model, middleware order, license model)
- `specs/runtime/017-tenant-bootstrap/spec.md` (generated)
- `specs/runtime/017-tenant-bootstrap/checklists/requirements.md` (generated)

---

## Key Decisions

| #   | Decision                                                           | Rationale                                                                                                                                    |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `staff_users` is a new tenant DB table distinct from student users | Stage §7 defines `roles`, `role_permissions`, `staff_users`, `staff_user_roles` as minimal RBAC tables — implies staff_users is tenant-local |
| 2   | WebSocket infrastructure available via Bun/Hono                    | Stage §10 mandates WS license + auth validation; Bun natively supports WebSocket                                                             |
| 3   | `packages/ui-system` exposes AppLayout component (STAGE_16 output) | Stage §6 mandates shared UI system usage; STAGE_16 delivers ui-system                                                                        |
| 4   | `ModuleEnum` is centralized in `packages/types`                    | Module enum used across API + UI layers — cross-boundary placement in types is the only compliant option                                     |
| 5   | Limit enforcement is not in scope                                  | Stage §9 explicitly states "Actual enforcement occurs during user creation flows (later stage)"                                              |

---

## Functional Requirements Captured

- **FR-01** — Runtime context injection (workspace_id, workspace_slug, enabled_modules, student_limit, staff_limit, license_status, product_version, schema_version, request_id) via middleware
- **FR-02** — License gate enforcement: ACTIVE required; 423 for SOFT_LOCKED, 403 for ARCHIVED, 404 for unknown tenant; neutral UI screen
- **FR-03** — Module visibility contract: server-side blocking of disabled modules (API 403, route not resolved, nav entry hidden)
- **FR-04** — AppLayout structure: Sidebar (dynamic, RBAC-aware, collapsible), TopBar, ContentArea; packages/ui-system
- **FR-05** — RBAC skeleton: `roles`, `role_permissions`, `staff_users`, `staff_user_roles` tables; middleware enforcement; module-scoped actions (view/create/edit/delete)
- **FR-06** — Authentication boundary: workspace-scoped JWT; role + permissions claims; token_version validation; cross-workspace usage rejected
- **FR-07** — Limit awareness: student_limit and staff_limit injected and exposed to UI (informational only, not enforced)
- **FR-08** — WebSocket lifecycle: workspace_id + license_status + auth token validation on connect; terminate if license becomes non-ACTIVE; request_id tracing
- **FR-09** — Structured observability: workspace_slug, workspace_id, request_id, user_id (if auth), route_name on every log; no anonymous logs
- **FR-10** — Isolation prohibitions: no master_db queries, no hardcoded modules/license checks, no cross-tenant access, no global DB singleton, no business/academic logic

---

## Clarifications Required

None — all 5 ambiguities were inferred with documented rationale in the spec.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                                              |
| --------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | All DB ops scoped to tenant connection pool; workspace_id validated on every authenticated request |
| License middleware requirement captured | ✅     | FR-02 + AC-01 mandate ACTIVE license before any Backoffice route resolves                          |
| Snapshot integrity requirement captured | ✅ N/A | No attempt engine in scope for this stage                                                          |
| Idempotency strategy defined            | ✅ N/A | No write-heavy critical endpoints in bootstrap stage                                               |
| Transaction boundaries identified       | ✅     | RBAC table creation in migration; no ad-hoc schema changes                                         |
| Server-authoritative time enforced      | ✅ N/A | No time-sensitive operations in this stage                                                         |
| No master_db access                     | ✅     | FR-10 explicitly prohibits master_db queries; spec Isolation section enforces                      |
| packages/ui-system usage                | ✅     | FR-04 mandates shared UI system for layout components                                              |

**Overall:** COMPLIANT

---

## Open Risks

- STAGE_16 (Shared UI System) must be fully production-ready before this stage can deliver its layout components. If packages/ui-system is not yet stable, the layout implementation may need stubs.
- WebSocket implementation complexity depends on Bun WS API — validate against Bun version in use.

---

## Next Step

Proceed to Step 2 — Clarify.
