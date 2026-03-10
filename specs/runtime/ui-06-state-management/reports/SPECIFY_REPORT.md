# Specify Report — STAGE_UI_06_STATE_MANAGEMENT

**Step:** 1 — Specify **Timestamp:** 2026-03-03T00:00:00.000Z **Status:** COMPLETE

---

## Summary

Specification drafted for the UI State Management Architecture stage. This stage defines the
standardized runtime contract for Pinia-based stores across all three Zidney frontend applications
(MMC, Backoffice, Frontoffice). The spec covers store architecture, API interaction chain
enforcement, cross-store communication rules, persistence policy, security constraints, testability
requirements, and per-app scope boundaries.

37 functional requirements across 8 domains were captured. 5 user stories were drafted with full
acceptance scenarios. 1 `[NEEDS CLARIFICATION]` marker was identified and must be resolved in Step 2
before planning proceeds.

---

## Inputs Reviewed

- `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_06_STATE_MANAGEMENT.md`
- `specs/runtime/ui-06-state-management/spec.md`
- `specs/runtime/ui-06-state-management/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                                     | Rationale                                                                                                                |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | Pinia Composition API setup syntax mandatory                                 | Aligns with Vue 3 best practices; enables full TypeScript inference and better testability vs Options API stores         |
| 2   | Components must NEVER call HTTP directly — all API access through stores     | Prevents untestable components, centralizes error handling, enforces the `Component → Store → API Module → client` chain |
| 3   | Cross-store mutation forbidden; read-only access via `storeToRefs` only      | Prevents state bugs from untracked mutations; ensures each store owns its mutation surface                               |
| 4   | JWT must NEVER be in localStorage/sessionStorage                             | Security requirement enforced — tokens in memory or secure HTTP-only cookie only                                         |
| 5   | `pinia-plugin-persistedstate` with explicit `paths` whitelist                | Prevents accidental persistence of sensitive state; only UI prefs (sidebar, theme, locale) may be persisted              |
| 6   | Store file naming: `<name>.store.ts`, composable: `use<Name>Store()`         | Consistent discovery and import pattern across all three apps                                                            |
| 7   | Core stores in `src/core/state/`; feature stores in `src/modules/<feature>/` | Clear separation between runtime infrastructure and feature-scoped state                                                 |
| 8   | Store IDs follow `<app>-<domain>` kebab-case (e.g., `backoffice-auth`)       | Prevents ID collisions when debugging with Vue DevTools across apps                                                      |

---

## Functional Requirements Captured

**Store Architecture (FR-001 – FR-007):**

- Pinia initialized in `main.ts` before any store access
- All stores use Composition API `defineStore` setup syntax
- Full TypeScript annotation required on all state, action params, and return types
- Core stores at `src/core/state/<name>.store.ts`
- Feature stores at `src/modules/<feature>/<feature>.store.ts`
- File naming: `<name>.store.ts`; composable naming: `use<Name>Store()`

**API Interaction (FR-008 – FR-011):**

- Components must not import or call API client directly
- Store actions call feature API module functions, not raw client
- Store actions catch `AppError` and update reactive error state
- Store actions must not perform business logic calculations

**Cross-Store Communication (FR-012 – FR-015):**

- Direct mutation of another store's state forbidden
- Read-only access via `storeToRefs` allowed
- Public actions on other stores may be called
- Circular store dependencies forbidden

**Loading & Error State (FR-016 – FR-019):**

- `isLoading: boolean` exposed on every async store
- `error: AppError | null` exposed on every async store
- `error` reset to `null` before each new action begins
- On failure: `isLoading = false`, `error = AppError`

**State Persistence (FR-020 – FR-025):**

- Default: in-memory only; persistence explicitly opted into
- `pinia-plugin-persistedstate` registered in `main.ts`
- Explicit `paths`/`pick` whitelist required for all persisted stores
- Tokens, permissions, license state, attempt state prohibited from persistence
- Allowed: UI preferences only (sidebar, theme, locale)
- Graceful fallback if storage unavailable

**Security (FR-026 – FR-027):**

- JWT/tokens never in `localStorage` or `sessionStorage`
- Token strings not exposed as raw public properties

**Testability (FR-028 – FR-031):**

- Unit-testable in isolation via `setActivePinia(createPinia())`
- API module dependencies mockable
- State resettable via `$reset()` between test cases
- No module-level side effects on import

**Naming & Organization (FR-032 – FR-034):**

- Store IDs unique per app, `<app>-<domain>` kebab-case pattern
- Core stores must not import from modules
- All Pinia plugins registered in one `createPinia()` chain in `main.ts`

**Scope Boundaries Per App (FR-035 – FR-037):**

- MMC: platform-level concerns only, no workspace-scoped data
- Backoffice: workspace context from runtime workspace store
- Frontoffice: attempt UI state must not permanently cache grading results

---

## Clarifications Required

- **[NEEDS CLARIFICATION — Concurrent Async Loading State Shape]**: Should stores with multiple
  concurrent async operations use a single `isLoading: boolean` flag, or a per-action pending map
  (`pending: Record<string, boolean>`)? This determines the standard loading state shape across all
  stores and must be resolved before planning.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                                            |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| No cross-tenant access introduced       | ✅     | UI-only stage; no tenant DB access                                                               |
| License middleware requirement captured | ✅ N/A | Stores do not enforce license limits (FR-011); license enforcement stays backend                 |
| Snapshot integrity requirement captured | ✅ N/A | No attempt engine mutations in this stage; FR-037 explicitly bans grading result caching         |
| Idempotency strategy defined            | ✅     | FR-010 requires actions to handle errors; idempotency at API layer is out of scope for UI stores |
| Transaction boundaries identified       | ✅ N/A | No DB transactions in UI layer                                                                   |
| Server-authoritative time enforced      | ✅ N/A | UI layer reads server time; no client-side time computation                                      |
| No business logic in stores             | ✅     | FR-011 explicitly prohibits business calculations in store actions                               |
| No direct DB imports                    | ✅     | UI layer has no DB access by definition                                                          |
| JWT security enforced                   | ✅     | FR-026–027, SC-003 all address token security                                                    |

**Overall:** COMPLIANT — 1 clarification pending (loading state shape). Safe to proceed to Clarify.

---

## Open Risks

| Risk                                                                   | Severity | Mitigation                                                                      |
| ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| Concurrent action loading state ambiguity                              | Medium   | [NEEDS CLARIFICATION] — must resolve before plan                                |
| `pinia-plugin-persistedstate` version compatibility with Pinia 2.x/3.x | Low      | Confirm during plan phase; pin version explicitly                               |
| Developers bypassing store layer in components (linting gap)           | Medium   | ESLint rule required for enforcing no direct API client imports in `.vue` files |
| Auth token accidentally logged to structured logs                      | High     | Covered by FR-027; verify with security audit in Step 5                         |
