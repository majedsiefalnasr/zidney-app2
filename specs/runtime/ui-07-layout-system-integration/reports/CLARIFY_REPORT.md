# Clarify Report — STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION

**Step:** 2 — Clarify
**Timestamp:** 2026-03-05T00:00:00Z
**Status:** COMPLETE

---

## Summary

5 targeted clarifications were conducted on the Layout System Integration spec. All ambiguities have been resolved with concrete, type-safe answers. One spec defect was identified and corrected (CL-003: incorrect `NavigationConfig` prop type that would have caused TypeScript strict mode failure). No planning blockers remain.

The spec now contains a `## Clarifications / ### Session 2026-03-05` section with all resolutions encoded in-place.

---

## Inputs Reviewed

- `specs/runtime/ui-07-layout-system-integration/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #      | Topic                                       | Resolution                                                                                                                    | Impact on Plan                                                                |
| ------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| CL-001 | `ui.store` Action Interface Contract        | Only `toggleSidebar()` and `setMobile(val: boolean)` are mutation actions. No direct property assignment.                     | `AppSidebar` toggle and `useBreakpoint` composable must use these actions.    |
| CL-002 | `auth.store.resolvedPermissions` Type Shape | Type is `Record<string, boolean>`. Filter: `!item.permission \|\| resolvedPermissions[item.permission] === true`.             | `AppSidebar` filter can be implemented with a single computed predicate.      |
| CL-003 | NavigationConfig Type Alias Correction      | `AppSidebar` prop is `navigationConfig: NavigationConfig` (not `NavigationConfig[]`). Spec defect corrected.                  | Prevents TypeScript strict mode failure during implementation.                |
| CL-004 | Frontoffice Sidebar Optionality Mechanism   | `App.vue` reads `route.meta.hideSidebar === true` and passes `hideSidebar` prop. `ui.store` controls collapse only.           | Frontoffice layout requires a reactive `hideSidebar` prop on `AppSidebar`.    |
| CL-005 | Cross-Breakpoint Sidebar State Persistence  | Mobile→Desktop resets `sidebarCollapsed` to `false`. Desktop→Mobile sets it to `true`. `useBreakpoint` owns this via `watch`. | `useBreakpoint` composable must call `setMobile()` and manage collapse state. |

---

## Open Items

None. All 5 clarifications resolved with unambiguous, plannable answers.

---

## Spec Updates Applied

- **CL-001:** Added concrete `ui.store` interface contract — `toggleSidebar()` and `setMobile(val)` defined
- **CL-002:** Added `resolvedPermissions: Record<string, boolean>` type definition and filter predicate
- **CL-003:** Corrected `AppSidebar` prop type from `NavigationConfig[]` to `NavigationConfig` (spec defect fix)
- **CL-004:** Added `hideSidebar` prop mechanism via `route.meta.hideSidebar` for Frontoffice
- **CL-005:** Added `useBreakpoint` composable state-reset behavior specification

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                        |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5 clarifications cover all interface contracts and edge cases                |
| Transaction strategy confirmed            | ✅     | Not applicable — layout layer performs no write operations                   |
| Idempotency strategy confirmed            | ✅     | Not applicable — layout layer is pure read/render                            |
| Isolation boundaries confirmed            | ✅     | Layout reads from pre-resolved stores only; never touches tenant resolution  |
| Version and license constraints confirmed | ✅     | Layout renders after middleware chain; version enforcement is pre-UI concern |

**Overall:** COMPLIANT

---

## Open Risks

- **`auth.store` interface** — `resolvedPermissions: Record<string, boolean>` assumed from `ui-01-auth-module`. Must be verified against that stage's actual implementation before integration tests are written.
- **`ui.store` action names** — `toggleSidebar()` and `setMobile(val)` must match exactly what `ui-06-state-management` exports. Mocks must be updated if names differ.

---

## Next Step

Proceed to Step 3 — Plan.
