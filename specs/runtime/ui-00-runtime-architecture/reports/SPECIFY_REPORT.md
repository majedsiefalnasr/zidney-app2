# Specify Report — STAGE_UI_00_RUNTIME_ARCHITECTURE

**Step:** 1 — Specify **Timestamp:** 2026-02-28T00:10:00Z **Status:** COMPLETE

---

## Summary

Specification drafted for `STAGE_UI_00_RUNTIME_ARCHITECTURE` — a UI Foundation stage that
establishes the canonical SPA runtime architecture shared across all three Zidney frontend
applications (MMC, Backoffice, Frontoffice). The spec covers 35 functional requirements across 8
layers and 15 non-functional requirements. One non-blocking clarification marker was placed. The
requirements checklist passes on first iteration.

---

## Inputs Reviewed

- `specs/runtime/ui-00-runtime-architecture/spec.md` ✅ (710 lines, 26.6 KB)
- `specs/runtime/ui-00-runtime-architecture/checklists/requirements.md` ✅ (7.5 KB)
- `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_00_RUNTIME_ARCHITECTURE.md` ✅

---

## Key Decisions

| #   | Decision                                                                                                          | Rationale                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | All three apps (mmc, backoffice, frontoffice) scaffolded to the same canonical `src/` structure                   | Consistency is required per the stage file; deviations cause maintenance drift |
| 2   | MMC migration delta defined (existing non-canonical paths → canonical targets)                                    | MMC is partially scaffolded; a delta table ensures non-destructive migration   |
| 3   | Access token stored in memory only; refresh token in httpOnly cookie                                              | Aligns with security NFR-01 and platform security model                        |
| 4   | API client fully centralized at `core/api/client.ts` — no direct fetch/axios in components                        | Platform rule: all HTTP communication through one boundary                     |
| 5   | Pinia in strict mode, one store per domain                                                                        | Platform rule: no rogue state mutations                                        |
| 6   | Guard pipeline: `AuthGuard → RoleGuard → WorkspaceGuard` (Backoffice); `AuthGuard → RoleGuard` (MMC, Frontoffice) | WorkspaceGuard is Backoffice-specific (tenant slug resolution)                 |
| 7   | `AttemptGuard` deferred to Exam Runtime stage                                                                     | Frontoffice guard pipeline simplified for this architecture stage              |
| 8   | Env config centralized at `core/config/env.ts` — no `import.meta.env` in components                               | Testability and isolation; single config surface                               |

---

## Functional Requirements Captured

**Layer: Folder Structure (FR-01 – FR-03)**

- FR-01: Canonical `src/` structure scaffolded in MMC (includes migration delta)
- FR-02: Canonical `src/` structure scaffolded in Backoffice (fresh scaffold)
- FR-03: Canonical `src/` structure scaffolded in Frontoffice (fresh scaffold)

**Layer: API Client (FR-04 – FR-07)**

- FR-04: Centralized `ApiClient` class at `core/api/client.ts`
- FR-05: Interceptors attached for auth token (outgoing) and error normalization (incoming)
- FR-06: 401 auto-refresh with single-flight strategy (prevents race conditions)
- FR-07: All errors normalized to `NormalizedError` shape before reaching UI

**Layer: Vue Router (FR-08 – FR-15)**

- FR-08: Router initialized at `core/router/index.ts` with `createWebHistory`
- FR-09: AuthGuard — blocks unauthenticated navigation
- FR-10: RoleGuard — enforces route-level role requirements
- FR-11: WorkspaceGuard — Backoffice only; resolves workspace slug from route params
- FR-12: No inline guard logic inside view components
- FR-13: All routes typed with route meta interface
- FR-14: 404 catch-all route registered
- FR-15: Navigation failure error boundary

**Layer: Pinia (FR-16 – FR-20)**

- FR-16: Pinia initialized in strict mode in all three apps
- FR-17: One store per domain (`useAuthStore`, `useWorkspaceStore`, etc.)
- FR-18: Stores call services, not HTTP directly
- FR-19: No cross-store direct mutation
- FR-20: Typed store interfaces mandatory

**Layer: Auth Module (FR-21 – FR-25)**

- FR-21: Access token stored in memory (reactive ref, never localStorage)
- FR-22: `useAuth()` composable exposes `isAuthenticated`, `user`, `login()`, `logout()`
- FR-23: `logout()` clears memory and calls backend invalidation endpoint
- FR-24: Token attach via API client interceptor (not inside components)
- FR-25: Auth module skeleton only — full auth flow is Stage UI-01

**Layer: Error Normalization (FR-26 – FR-29)**

- FR-26: `core/errors/error-normalizer.ts` as pure function
- FR-27: Converts backend `{ success, error: { code, message } }` to `NormalizedError`
- FR-28: Handles 3 failure modes: Hono error shape, network error, unknown shape
- FR-29: UI depends only on `NormalizedError`, never raw backend shape

**Layer: Env Config (FR-30 – FR-32)**

- FR-30: `core/config/env.ts` with typed `AppConfig` object
- FR-31: Startup validation — missing required vars throw at boot, not at runtime
- FR-32: No `import.meta.env` references outside `core/config/env.ts`

**Layer: App Bootstrap (FR-33 – FR-35)**

- FR-33: Defined initialization order: config → pinia → router → app mount
- FR-34: All three apps boot without console errors in dev mode
- FR-35: CI passes lint and TypeScript for all three apps

---

## Non-Functional Requirements Captured

| #      | Requirement                                                    | Measure                                             |
| ------ | -------------------------------------------------------------- | --------------------------------------------------- |
| NFR-01 | No token in browser storage                                    | Automated test on `localStorage` / `sessionStorage` |
| NFR-02 | No Authorization header logged                                 | Log spy test in API client                          |
| NFR-03 | Workspace slug from route only, never request body in frontend | Code review + lint rule                             |
| NFR-04 | No business logic in components                                | Layer boundary tests                                |
| NFR-05 | API client unit-testable (mockable fetch)                      | Unit test suite                                     |
| NFR-06 | Pinia stores unit-testable without DOM                         | Unit test suite                                     |
| NFR-07 | Guards integration-testable with mock router                   | Integration test                                    |
| NFR-08 | Error normalizer is a pure function                            | Unit test — no side effects                         |
| NFR-09 | Token refresh simulation testable                              | Interceptor mock test                               |
| NFR-10 | App boots in < 2s in dev (no blocking sync init)               | Boot timing assertion                               |
| NFR-11 | TypeScript strict mode, zero `any` types in `core/`            | `tsc --noEmit` gate                                 |
| NFR-12 | No CI warnings allowed in `core/`                              | Lint gate                                           |

---

## Clarifications Required

| #   | Question                                                                                               | Default Resolution                                                                            | Blocking?       |
| --- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------------- |
| 1   | Should Frontoffice implement `AttemptGuard` (block navigation away from active attempt) in this stage? | **Defer to Exam Runtime stage.** Frontoffice guard pipeline = `auth.guard → role.guard` only. | ❌ Non-blocking |

---

## Constitutional Compliance

| Check                                   | Status  | Notes                                                 |
| --------------------------------------- | ------- | ----------------------------------------------------- |
| No cross-tenant access introduced       | ✅ PASS | workspace_slug from router params only                |
| License middleware requirement captured | ✅ N/A  | UI stage — no backend middleware                      |
| Snapshot integrity requirement captured | ✅ N/A  | Attempt engine not modified                           |
| Idempotency strategy defined            | ✅ N/A  | No write endpoints in this stage                      |
| Transaction boundaries identified       | ✅ N/A  | No backend transactions                               |
| Server-authoritative time enforced      | ✅ PASS | No client-side time logic in scope                    |
| No business logic in UI                 | ✅ PASS | FR-04–35 all enforce boundary separation              |
| Import boundaries respected             | ✅ PASS | apps → packages/ui-system only; no cross-app imports  |
| Token security model                    | ✅ PASS | Memory-only access token; httpOnly cookie for refresh |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                                                     | Severity | Mitigation                                                                                           |
| ------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------- |
| MMC delta migration may conflict with existing imports                   | MEDIUM   | Delta table in spec; migration tasks will audit existing `apps/mmc/src/` imports before moving files |
| Backoffice and Frontoffice have no existing code — scaffold from scratch | LOW      | Clean slate; no conflicts expected                                                                   |
| `AttemptGuard` deferral may require later refactor of router             | LOW      | Guard pipeline is extensible; adding guards is non-breaking                                          |

---

## Next Step

Clarification step recommended (non-blocking marker exists). Proceed to **Step 2 — Clarify**.
