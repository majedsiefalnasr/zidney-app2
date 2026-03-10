# Specify Report — ENV Configuration

**Step:** 1 — Specify  
**Timestamp:** 2026-02-28T21:05:00Z  
**Status:** COMPLETE

---

## Summary

Specification for the ENV Configuration stage was generated successfully. The spec defines a
standardized environment configuration strategy for all three Zidney frontend applications (MMC,
Backoffice, Frontoffice), establishing a single entry point for environment access, API base URL
resolution, mode helpers, read-only feature flags, and secure exposure policy. All 16/16 checklist
items passed with no clarification markers needed.

---

## Inputs Reviewed

- `specs/runtime/ui-05-env-configuration/spec.md`
- `specs/runtime/ui-05-env-configuration/checklists/requirements.md`
- `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_05_ENV_CONFIGURATION.md`

---

## Key Decisions

| #   | Decision                                   | Rationale                                                                                      |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1   | Per-app implementation, not shared package | Each app has its own Vite build pipeline; contract (API surface) is shared, not implementation |
| 2   | Static feature flags only (build-time)     | Runtime flag fetching is out of scope for this stage                                           |
| 3   | Backoffice workspace context from backend  | Env module does not compute workspace identifiers — relies on backend-issued context           |
| 4   | Lint rule enforcement for import.meta.env  | Prevents direct usage outside centralized module                                               |
| 5   | Configuration immutable after init         | Object.freeze or equivalent prevents runtime modification                                      |

---

## Functional Requirements Captured

- FR-001: Single centralized module (`core/config/env.ts`) per app
- FR-002: Lint rule prohibiting direct `import.meta.env` usage
- FR-003: `getApiBase()` for API base URL resolution
- FR-004: Mode helpers (`isDev()`, `isProd()`, `isStaging()`)
- FR-005: Feature flags module (`core/config/feature-flags.ts`)
- FR-006: Immutable feature flags (frozen at runtime)
- FR-007: Only `VITE_`-prefixed variables in browser
- FR-008: No console logging of config in production
- FR-009: No secrets/credentials exposed to browser
- FR-010: Startup validation for required variables
- FR-011: Mock injection support for tests
- FR-012: Same env module contract across all 3 apps
- FR-013: App-specific config via `.env` files, not code branching
- FR-014: Aggregated `app-config.ts` typed object
- FR-015: No runtime modification of config
- FR-016: No user input merged into config
- FR-017: Feature flags limited to UI display behavior
- FR-018: Env logic only in `core/config/`

---

## Clarifications Required

- None — all checklist items passed.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                               |
| --------------------------------------- | ------ | --------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Frontend-only stage; no tenant DB access            |
| License middleware requirement captured | ✅     | N/A — no backend routes; frontend reads config only |
| Snapshot integrity requirement captured | ✅     | N/A — no attempt engine involvement                 |
| Idempotency strategy defined            | ✅     | N/A — no mutations; config is read-only             |
| Transaction boundaries identified       | ✅     | N/A — no database operations                        |
| Server-authoritative time enforced      | ✅     | N/A — no time logic; defers to backend              |

**Overall:** COMPLIANT

---

## Open Risks

- None

---

## Next Step

Proceed to Step 2 — Clarify.
