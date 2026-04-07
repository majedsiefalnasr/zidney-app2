# Plan Report — STAGE_UI_08_NOTIFICATION_AND_FEEDBACK

**Step:** 3 — Plan  
**Timestamp:** 2026-04-07T00:00:00.000Z  
**Status:** COMPLETE

---

## Summary

Technical plan for the Unified Notification and Feedback Layer is complete. The plan covers all three Zidney frontend applications (MMC, Backoffice, Frontoffice) with per-app notification stores, composables, components, and an offline banner. 29 files will be created or modified across 7 sequential implementation waves. Two corrections were applied to plan.md after guardian review: (1) Vue 3 reactivity defect in toast bridge pattern corrected to use `storeToRefs`; (2) 422 error code row in routing table corrected from `VALIDATION_ERROR`/`CONFLICT` to `VALIDATION_ERROR` only.

---

## Inputs Reviewed

- `specs/runtime/ui-008-notification-and-feedback/spec.md` (47 requirements, 5 user stories, 5 clarifications)
- `specs/runtime/ui-008-notification-and-feedback/plan.md` (generated + corrected)
- `specs/runtime/ui-008-notification-and-feedback/research.md` (codebase audit of all 3 apps)

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                                 |
| --------- | ------------------------------------------------------------------------------- |
| API       | None — pure frontend stage                                                      |
| Worker    | None                                                                            |
| Frontend  | 29 files across apps/mmc, apps/backoffice, apps/frontoffice, packages/ui-system |
| DB Master | None                                                                            |
| DB Tenant | None                                                                            |

---

## Key Technical Decisions

| #   | Decision                                                                                                                         | Rationale                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Per-app Pinia stores (no shared package)                                                                                         | Isolation requirement; each app manages its own notification lifecycle independently                                      |
| 2   | `useNotify()` composable is the public API; components never call store directly                                                 | Separation of default-duration logic from store internals                                                                 |
| 3   | Toast bridge lives in `App.vue` (not a composable)                                                                               | It is a render concern, not business logic — using `storeToRefs` + Vue `watch`                                            |
| 4   | `useOfflineBanner()` is identical across all apps                                                                                | Network state is global; no app-specific logic needed                                                                     |
| 5   | `attempt.store.ts` stub in Frontoffice only                                                                                      | Required by `useNotify`'s exam-mode guard; defaults to `isExamActive: false`; replaced by exam engine stage               |
| 6   | Error normalizers unchanged                                                                                                      | All three are complete and tested — no delta needed                                                                       |
| 7   | `packages/ui-system` barrel fix (Wave 1) is the first dependency                                                                 | `Toaster`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` must be exported before any app can compile |
| 8   | Backoffice optional dev-mode slug context in `useNotify` must route through `getAppConfig()`, not `import.meta.env.DEV` directly | Design Decision D3 — only `env.ts` reads `import.meta.env`                                                                |

---

## File Plan — 29 Total

| Wave | App                            | Files | Action                                                                                        |
| ---- | ------------------------------ | ----- | --------------------------------------------------------------------------------------------- |
| 1    | packages/ui-system             | 1     | MODIFY barrel (add Toaster + form exports)                                                    |
| 2    | MMC + Backoffice + Frontoffice | 3     | MODIFY notification stores (dedup + visible cap)                                              |
| 3    | MMC + Backoffice + Frontoffice | 6     | CREATE useNotify.ts + useOfflineBanner.ts per app; CREATE attempt.store.ts stub (Frontoffice) |
| 4    | MMC + Backoffice + Frontoffice | 3     | CREATE OfflineBanner.vue per app                                                              |
| 5    | MMC + Backoffice + Frontoffice | 6     | MODIFY App.vue (Toaster + toast bridge); MODIFY AppLayout.vue (OfflineBanner) per app         |
| 6    | MMC + Backoffice + Frontoffice | 3     | MODIFY main.ts (global error handler → notify store) per app                                  |
| 7    | MMC + Backoffice + Frontoffice | 6     | CREATE unit + integration tests per app                                                       |

---

## Migration Impact

| Item                  | Value | Notes                                      |
| --------------------- | ----- | ------------------------------------------ |
| Migration required    | No    | Pure frontend stage — no DB changes        |
| `schema_version` bump | No    | —                                          |
| Backward compatible   | Yes   | Existing stores are additive-only modified |

---

## Transaction Boundaries

- None — this stage is frontend-only; all state is in-memory Pinia stores.

---

## Idempotency Strategy

- Notification deduplication uses a 2-second `Map<string, number>` keyed on `type:title:message`. Same notification pushed within 2 seconds is suppressed with `""` sentinel return.

---

## Guardian Verdicts (Step 3.1A)

| Guardian              | Verdict                     | Notes                                                                                                                                                                                                                                                                                 |
| --------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture Guardian | ✅ PASS                     | ISSUE-01: backoffice optional env check must route through config module (not `import.meta.env` directly). ISSUE-02: test files must be at `apps/*/tests/unit/` not `src/__tests__/`. RISK-01: recommend ADR for attempt.store.ts stub dependency. All addressed in plan corrections. |
| API Designer          | ✅ PASS (after corrections) | F-3 CRITICAL (reactivity bug in toast bridge) corrected in plan.md. F-1 Minor (422 routing table code) corrected in plan.md.                                                                                                                                                          |

---

## Architecture Governance Compliance

| Check                                               | Status | Notes                                                                         |
| --------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| No cross-tenant logic introduced (ADR-0001)         | ✅     | Frontend-only; no tenant DB access                                            |
| All writes are transactional by design              | ✅ N/A | No DB writes in this stage                                                    |
| Server-authoritative time enforced (ADR-0006)       | ✅ N/A | No time-sensitive operations                                                  |
| License middleware enforced                         | ✅ N/A | No new API routes added                                                       |
| Version compatibility enforced (ADR-0007, ADR-0008) | ✅ N/A | No API versioning changes                                                     |
| No architecture redesign without ADR                | ✅     | Attempt store stub is a frontend pragmatic stub — not an architectural change |
| Trust chain respected                               | ✅     | No auth/tenant chain modifications                                            |
| Import boundaries respected                         | ✅     | apps/_ → packages/_ only; cross-app imports absent                            |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                                                                                               | Severity | Mitigation                                                                 |
| ------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------- |
| `attempt.store.ts` stub in Frontoffice defaults `isExamActive: false` — exam engine stage must replace it          | MEDIUM   | Documented in plan.md §1.9; Architecture Guardian flagged for ADR tracking |
| `seen` Set in App.vue toast bridge grows unbounded over session lifetime                                           | LOW      | Negligible for practical session lengths; documented as known limitation   |
| Backoffice optional workspace slug context in `useNotify` requires `getAppConfig()` not `import.meta.env` directly | LOW      | Implementation constraint documented in plan.md; not blocking              |

---

## Next Step

Proceed to Step 4 — Tasks.
