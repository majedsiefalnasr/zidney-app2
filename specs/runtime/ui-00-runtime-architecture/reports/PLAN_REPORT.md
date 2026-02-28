# Plan Report — STAGE_UI_00_RUNTIME_ARCHITECTURE

**Step:** 3 — Plan
**Timestamp:** 2026-02-28T00:35:00Z
**Status:** COMPLETE

---

## Summary

Technical plan produced for `STAGE_UI_00_RUNTIME_ARCHITECTURE`. This is a UI-only scaffolding stage covering all three frontend applications (MMC, Backoffice, Frontoffice). No backend changes, no database migrations, no API modifications. Guardian validation required 2 rounds: Round 1 blocked on `credentials: 'include'` missing from API client spec, API client consumption ambiguity, and ESLint deliverable gap. All issues remediated; both guardians returned VERDICT: PASS in Round 2.

**Key discoveries from research:**

- Pinia is NOT in `apps/mmc/package.json` — must be added to all 3 apps
- TypeScript `paths` for `@/` alias is missing from all 3 `tsconfig.json` files
- Backoffice and Frontoffice have NO source files — full scaffold required
- MMC has 28 component files (not 23 as spec estimated) — expanded delta map produced

---

## Inputs Reviewed

- `specs/runtime/ui-00-runtime-architecture/spec.md` ✅
- `specs/runtime/ui-00-runtime-architecture/plan.md` ✅
- `specs/runtime/ui-00-runtime-architecture/research.md` ✅

---

## Architecture Layers Touched

| Layer                  | Planned Changes                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Frontend (MMC)         | Delta migration: 28 files remapped to canonical structure; `core/` layer created; `tsconfig.json` paths fixed; Pinia added |
| Frontend (Backoffice)  | Full fresh scaffold: `package.json`, `vite.config.ts`, `tsconfig.json`, complete `src/` with all `core/` layers            |
| Frontend (Frontoffice) | Full fresh scaffold: `package.json`, `vite.config.ts`, `tsconfig.json`, complete `src/` with all `core/` layers            |
| Packages (ui-system)   | No changes required — existing layout components sufficient for this stage                                                 |
| API                    | No changes                                                                                                                 |
| Worker                 | No changes                                                                                                                 |
| DB Master              | No changes                                                                                                                 |
| DB Tenant              | No changes                                                                                                                 |

---

## Key Technical Decisions

| #   | Decision                                           | Rationale                                                                                |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | API client: factory + singleton export             | Factory for test DI; singleton `apiClient` for module consumption                        |
| 2   | `credentials: 'include'` on all requests           | httpOnly refresh cookie requires this for cross-origin POSTs                             |
| 3   | `contentTypeInterceptor` for POST/PUT/PATCH        | Native fetch doesn't auto-set Content-Type; some server middleware rejects bodyless JSON |
| 4   | `requestQueue: QueueEntry[]` formally typed        | Prevents divergent queue implementations across apps                                     |
| 5   | `useAuth()` uses `useRouter()` composable          | Valid in setup() context; delegates mutations to auth store                              |
| 6   | Pinia strict mode via convention + ESLint          | Pinia v2 has no API-level strict flag                                                    |
| 7   | `workspace.guard.ts` Backoffice-only               | MMC and Frontoffice don't have workspace-scoped routes                                   |
| 8   | ESLint `import/no-restricted-paths` as deliverable | Prevents cross-app imports and enforces layer boundaries at lint time                    |
| 9   | Native `fetch` (no axios)                          | Keeps bundle weight minimal; no dependency                                               |
| 10  | `AttemptGuard` deferred                            | Guard pipeline extensible; deferred cleanly to Exam Runtime stage                        |

---

## Migration Impact

| Item                  | Value | Notes                                   |
| --------------------- | ----- | --------------------------------------- |
| Migration required    | No    | UI scaffolding only — no schema changes |
| `schema_version` bump | No    | N/A                                     |
| Backward compatible   | N/A   | No backend changes                      |

---

## Transaction Boundaries

No write transactions in this stage. API client scaffolding only — no data mutations defined in this stage.

---

## Idempotency Strategy

No idempotency-sensitive operations in this stage. The `idempotencyInterceptor` is scaffolded as a capability (attaches `Idempotency-Key` when provided) but no endpoints requiring idempotency keys are implemented in this stage.

---

## Guardian Validation

### Round 1 (BLOCKED)

| Guardian                    | Verdict | Blocking Issues                                                                                                                                |
| --------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Zidney Architecture Checker | BLOCKED | API client consumption ambiguity, missing ESLint deliverable, `useAuth()` dependency path, Stage DRAFT status (not actually blocking planning) |
| Zidney API Designer         | BLOCKED | CRITICAL: `credentials: 'include'` missing; MEDIUM: Content-Type interceptor missing; MEDIUM: requestQueue untyped                             |

### Round 2 (PASS — after remediation)

| Guardian                    | Verdict | Notes                                                                                                            |
| --------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS | All Round 1 issues verified resolved; 2 non-blocking architectural risks documented                              |
| Zidney API Designer         | ✅ PASS | All Round 1 issues verified resolved; 1 LOW carry-forward (Pinia before apiClient in main.ts — added to §9 gate) |

**Overall:** APPROVED — both guardians PASS

---

## Constitutional Compliance

| Check                             | Status  | Notes                                                                 |
| --------------------------------- | ------- | --------------------------------------------------------------------- |
| No cross-tenant access introduced | ✅ PASS | workspace_slug from router params only; no shared state across apps   |
| License middleware requirement    | ✅ N/A  | UI stage — no backend middleware                                      |
| Snapshot integrity                | ✅ N/A  | Attempt engine not modified                                           |
| Idempotency scaffolded            | ✅ PASS | `idempotencyInterceptor` capability in API client                     |
| Transaction boundaries            | ✅ N/A  | No write operations in this stage                                     |
| Server-authoritative time         | ✅ PASS | No client-side time logic                                             |
| Token security model              | ✅ PASS | `credentials: 'include'` + memory-only access token + httpOnly cookie |
| Import boundaries                 | ✅ PASS | apps → packages only; ESLint enforcement as concrete deliverable      |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                                                                                           | Severity | Mitigation                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| MMC delta migration: 28 existing files must be moved carefully — existing import paths broken during migration | MEDIUM   | Research file explicitly lists all 34 delta entries; migration tasks will include import audit before move |
| `apiClient` singleton imported before Pinia installed                                                          | LOW      | §9 checklist item added; `main.ts` bootstrapping order documented                                          |
| ESLint config not enumerated as a per-app physical file in the file creation tables                            | LOW      | Noted as residual gap by Architecture Checker; should be added to file tables in implementation            |

---

## Next Step

Proceed to **Step 4 — Tasks**.
