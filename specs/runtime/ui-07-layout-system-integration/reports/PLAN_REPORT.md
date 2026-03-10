# Plan Report — STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION

**Step:** 3 — Plan **Timestamp:** 2026-03-05T00:00:00Z **Status:** COMPLETE

---

## Summary

A complete technical implementation plan has been produced for the Layout System Integration stage.
Research across all three app codebases (MMC, Backoffice, Frontoffice) and `packages/ui-system`
revealed 12 key codebase findings that shaped the plan.

Both guardian validators (Architecture Checker and API Designer) returned **VERDICT: PASS**. The
plan is architecturally compliant with zero critical or high violations. Two medium findings will be
resolved during implementation (layout component directory placement and dead router-view slot
content in App.vue).

Estimated task count: **~60 atomic tasks** across 20 implementation steps.

---

## Inputs Reviewed

- `specs/runtime/ui-07-layout-system-integration/spec.md`
- `specs/runtime/ui-07-layout-system-integration/plan.md`
- `specs/runtime/ui-07-layout-system-integration/research.md`
- Codebase: `apps/mmc/src/`, `apps/backoffice/src/`, `apps/frontoffice/src/`,
  `packages/ui-system/src/`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API       | None                                                                                                                                                                                     |
| Worker    | None                                                                                                                                                                                     |
| Frontend  | AppLayout.vue, AppSidebar.vue, AppHeader.vue per app; ui.store extension; auth.store extension; useBreakpoint composable; NavigationConfig types; RouteMeta augmentation; App.vue update |
| DB Master | None                                                                                                                                                                                     |
| DB Tenant | None                                                                                                                                                                                     |

---

## Key Technical Decisions

| #   | Decision                                                               | Rationale                                                                                                                        |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **ui.store MUST be extended** (not created from scratch)               | All 3 apps' ui.store files already exist from ui-06. Must ADD sidebar state while preserving existing modal/drawer interface.    |
| 2   | **auth.store MUST add `resolvedPermissions: Record<string, boolean>`** | No app currently exposes this field. Must be added to `setSession()` and `initSession()` and cleared on `resetState()`.          |
| 3   | **MMC requires `@zidney/ui-system` dependency added**                  | MMC currently has no ui-system dep; FR-010 requires all layout primitives to come from ui-system.                                |
| 4   | **`useBreakpoint` uses native resize API (not VueUse)**                | VueUse not available in MMC; cross-app consistency and testability favor a minimal native implementation.                        |
| 5   | **`BackofficeLayout.vue` deprecated and removed**                      | Existing legacy layout from STAGE_17 uses old slot-injection pattern; must be superseded by canonical App.vue shell.             |
| 6   | **Layout components go in `apps/<app>/src/components/layout/`**        | Architecture checker recommendation (medium finding): `components/` root is too flat for 3-file layout system.                   |
| 7   | **`<router-view />` removed from App.vue `<AppLayout>` usage**         | Architecture checker finding: AppLayout internally renders `<router-view />`; passing it from App.vue creates dead slot content. |
| 8   | **NavigationConfig is per-app static config (not shared package)**     | Import boundaries forbid cross-app sharing; each app's nav config aligns with its own route names.                               |

---

## Research Findings Summary

Key codebase discoveries from `research.md`:

1. **ui.store exists but lacks sidebar state** — All 3 apps have `ui.store.ts` from stage 016, but
   only manage modal/drawer visibility.
2. **auth.store exists but lacks `resolvedPermissions`** — All 3 apps have `auth.store.ts`; user
   object is stored but `resolvedPermissions` map is absent.
3. **BackofficeLayout.vue exists (legacy)** — `apps/backoffice/src/layouts/BackofficeLayout.vue`
   uses old slot pattern and must be removed.
4. **MMC has no @zidney/ui-system dep** — Must be added to `apps/mmc/package.json`.
5. **ui-system has `SidebarLayout`, `Button`, `Avatar`, `DropdownMenu` components** — Group heading
   support needs verification.
6. **No layout components exist in MMC or Frontoffice** — Fully greenfield for those apps.

---

## Migration Impact

| Item                  | Value | Notes                                                                                  |
| --------------------- | ----- | -------------------------------------------------------------------------------------- |
| Migration required    | No    | UI-only stage; no DB schema changes                                                    |
| `schema_version` bump | No    | Not applicable (no tenant DB changes)                                                  |
| Backward compatible   | Yes   | Store extensions are additive; BackofficeLayout.vue removal needs route tree migration |

---

## Transaction Boundaries

Not applicable — layout layer performs no write operations to any database. All store mutations are
pure in-memory Pinia state changes with no persistence requirements.

---

## Idempotency Strategy

Not applicable — layout rendering is inherently idempotent. Sidebar collapse state persists
in-memory (non-persisted Pinia store); all store action calls produce the same state outcome
regardless of call count.

---

## Guardian Validation Results

### Architecture Checker: VERDICT: PASS

- Zero critical/high violations
- 2 medium findings (resolved in plan): layout component directory placement, dead router-view in
  App.vue
- 2 low findings: AuthUser.permissions field shape, SidebarLayout group heading support

### API Designer: VERDICT: PASS

- No new backend endpoints required
- Zero API calls in layout components (constitutional compliance confirmed)
- Graceful degradation validated (NFR-008 compliance)
- Auth token management correctly delegated to store (FR-035–FR-037)

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                              |
| -------------------------------------- | ------ | ------------------------------------------------------------------ |
| No cross-tenant logic introduced       | ✅     | Layout reads from pre-resolved stores; no tenant resolution        |
| All writes are transactional by design | ✅     | Not applicable — no DB writes in layout layer                      |
| Server-authoritative time enforced     | ✅     | Not applicable — layout layer does not handle time                 |
| License middleware enforced            | ✅     | License middleware runs before UI renders; layout is downstream    |
| Version compatibility enforced         | ✅     | Version enforcement is pre-rendered; not layout's responsibility   |
| No architecture redesign without ADR   | ✅     | No new architectural patterns; follows existing Zidney conventions |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                                      | Severity | Mitigation                                                       |
| --------------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| ui.store extension may break existing modal/drawer tests  | HIGH     | Run existing tests after store extension; fix broken mocks first |
| resolvedPermissions empty during session restore          | HIGH     | Confirm `initSession()` also calls `buildResolvedPermissions()`  |
| BackofficeLayout.vue migration breaks existing route tree | MEDIUM   | Audit all route components using BackofficeLayout before removal |
| MMC bundle size increase from @zidney/ui-system           | MEDIUM   | Monitor bundle size in CI post-implementation                    |
| SidebarLayout group heading support unclear               | LOW      | Verify against ui-system source before implementing AppSidebar   |
| AuthUser.permissions field may not exist in type          | LOW      | Cross-check ui-01-auth-module spec before implementing           |

---

## Estimated Task Count

**~60 tasks** across 20 implementation steps covering:

- ui.store extension (3 apps × 1 = 3 tasks)
- auth.store extension (3 apps × 1 = 3 tasks)
- RouteMeta augmentation (3 apps × 1 = 3 tasks)
- NavigationConfig setup (3 apps × 1 = 3 tasks)
- useBreakpoint composable (3 apps × 1 = 3 tasks)
- AppHeader.vue (3 apps × 1 = 3 tasks)
- AppSidebar.vue (3 apps × 1 = 3 tasks)
- AppLayout.vue (3 apps × 1 = 3 tasks)
- App.vue update (3 apps × 1 = 3 tasks)
- BackofficeLayout.vue removal (1 task)
- MMC @zidney/ui-system dependency (1 task)
- Unit tests per component (3 components × 3 apps = 9 tasks)
- Snapshot tests (3 apps × 1 = 3 tasks)
- Responsive simulation tests (3 apps × 1 = 3 tasks)
- Integration validation (3 apps × 1 = 3 tasks)
- Lint/type-check pass (1 task)

---

## Next Step

Proceed to Step 4 — Tasks.
