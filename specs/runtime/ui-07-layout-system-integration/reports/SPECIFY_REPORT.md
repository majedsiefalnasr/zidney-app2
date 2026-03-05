# Specify Report — STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION

**Step:** 1 — Specify
**Timestamp:** 2026-03-05T00:00:00Z
**Status:** COMPLETE

---

## Summary

Specification for the Layout System Integration stage has been fully drafted and validated. The spec covers the unified application shell architecture across all three Zidney frontend applications (MMC, Backoffice, Frontoffice). All 23 checklist items in `checklists/requirements.md` passed. No `[NEEDS CLARIFICATION]` markers remain.

The spec defines 50 functional requirements, 6 user stories with Given/When/Then acceptance scenarios, 7 edge cases, 10 measurable success criteria, and 14 explicit non-goals. All requirements are technology-agnostic, testable, and aligned with Zidney Constitution v1.2.0.

---

## Inputs Reviewed

- `specs/runtime/ui-07-layout-system-integration/spec.md`
- `specs/runtime/ui-07-layout-system-integration/checklists/requirements.md`
- `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION.md`

---

## Key Decisions

| #   | Decision                                                                      | Rationale                                                                                                                             |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `AppLayout.vue` is per-app (not shared cross-app)                             | Import boundary rules forbid `apps/* → apps/*`; each app owns its own layout variant derived from the shared pattern                  |
| 2   | Standalone layout bypass via `meta.standaloneLayout: true`                    | Cleanest declaration for auth/error/attempt pages; no logic required in `AppLayout` itself                                            |
| 3   | Sidebar permission filtering reads from `auth.store.resolvedPermissions` only | Constitutional constraint: layout MUST NOT compute RBAC; permissions are pre-computed in the auth layer                               |
| 4   | Navigation config lives in `core/navigation/` (external, config-driven)       | Prevents hardcoded nav items in layout components; enables feature-module extensibility without sidebar changes                       |
| 5   | `ui.store` owns all layout state (`sidebarCollapsed`, `isMobile`)             | Sidebar state must survive route changes — component-local state would be lost on remount                                             |
| 6   | `AppLayout` exposes 5 named slots                                             | `header-left`, `header-right`, `sidebar-footer`, `content-top`, `content-bottom` — enables composable injection without prop drilling |
| 7   | Notification and global search are structural placeholders                    | Stage scope is shell architecture only; functional implementation is a future stage concern                                           |
| 8   | White-label customization is visual-token-only                                | Enforced per platform constitution; no structural layout changes per workspace                                                        |

---

## Functional Requirements Captured

**Cross-App Requirements (FR-001–FR-018):**

- All authenticated views must render inside `AppLayout.vue` (FR-001)
- `AppLayout` must read sidebar state from `ui.store` only (FR-002)
- `AppLayout` must expose 5 named layout slots (FR-003)
- Pages with `meta.standaloneLayout: true` bypass the shell (FR-004)
- `AppLayout` must not call any API or contain feature logic (FR-005, FR-006)
- Navigation items defined in `core/navigation/` config, referenced by route name (FR-007, FR-008)
- `AppSidebar` reads resolved permissions from store; does NOT compute RBAC (FR-009, FR-010)
- `AppSidebar` highlights active route via router state (FR-011)
- White-label limited to design tokens only (FR-012, FR-013)
- All layout components use `@zidney/ui-system` primitives (FR-014)
- No inline Tailwind duplication when UI system provides the primitive (FR-015)
- Responsive breakpoints use Tailwind v4 defaults via composable abstraction (FR-016, FR-017)
- `AppHeader` displays workspace name, user avatar, logout, search placeholder, notification indicator (FR-018–FR-022)
- `AppHeader` must not validate tokens, fetch user, or manage auth state (FR-023–FR-025)

**Per-App Requirements (FR-026–FR-050):**

- MMC: platform-level nav, no tenant-scoped data, no workspace slug in URL
- Backoffice: workspace-aware nav, workspace slug in header, reacts to workspace context change
- Frontoffice: minimal shell, sidebar optional, attempt runtime bypasses full layout

---

## Clarifications Required

None. All ambiguities resolved via reasonable defaults documented in the Assumptions section of `spec.md`.

Pre-planning assumptions to confirm:

1. `ui.store` from `ui-06-state-management` exposes `sidebarCollapsed` and `isMobile` with expected action signatures.
2. `auth.store.resolvedPermissions` exposes a typed map matching `NavigationItem.permission` keys.
3. `AppLayout` is per-app (not a shared base component in `@zidney/ui-system`).

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                    |
| --------------------------------------- | ------ | -------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Layout reads resolved context; never resolves tenant     |
| License middleware requirement captured | ✅     | Layout renders after all middleware has resolved         |
| Snapshot integrity requirement captured | ✅     | Not applicable — layout layer does not touch attempt     |
| Idempotency strategy defined            | ✅     | Not applicable — no write operations in layout layer     |
| Transaction boundaries identified       | ✅     | Not applicable — no DB access in layout layer            |
| Server-authoritative time enforced      | ✅     | Not applicable — layout layer does not handle time       |
| RBAC not computed in layout             | ✅     | Sidebar reads pre-computed permissions from store only   |
| No business logic in layout             | ✅     | Explicitly stated in FR-004/FR-005/FR-006 and spec intro |

**Overall:** COMPLIANT

---

## Open Risks

- `ui.store` shape dependency — if `ui-06-state-management` is not yet closed, planning must confirm store interface compatibility before proceeding.
- `auth.store.resolvedPermissions` type is assumed but not verified against the auth module spec.

---

## Checklist Result

| Category                  | Total | Pass | Fail |
| ------------------------- | ----- | ---- | ---- |
| Content Quality           | 4     | 4    | 0    |
| Requirement Completeness  | 9     | 9    | 0    |
| Feature Readiness         | 4     | 4    | 0    |
| Constitutional Compliance | 6     | 6    | 0    |

**Overall:** ✅ PASS (23/23)

---

## Next Step

Proceed to Step 2 — Clarify.
