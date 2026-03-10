# Tasks Report — STAGE_UI_00_RUNTIME_ARCHITECTURE

**Step:** 4 — Tasks **Timestamp:** 2026-02-28T00:45:00Z **Status:** COMPLETE

---

## Summary

158 atomic tasks generated across 6 phases for `STAGE_UI_00_RUNTIME_ARCHITECTURE`. All tasks are
dependency-ordered. Cross-app tasks (same file type across MMC, Backoffice, Frontoffice) are marked
`[P]` within their phase groups. This is a UI scaffolding stage — no backend tasks, no migration
tasks, no API route tasks.

---

## Inputs Reviewed

- `specs/runtime/ui-00-runtime-architecture/spec.md` ✅
- `specs/runtime/ui-00-runtime-architecture/plan.md` ✅
- `specs/runtime/ui-00-runtime-architecture/research.md` ✅
- `specs/runtime/ui-00-runtime-architecture/tasks.md` ✅ (generated, 393 lines, 158 tasks)

---

## Task Breakdown

| Phase     | Category                 | Task Range | Count   | Notes                                                                         |
| --------- | ------------------------ | ---------- | ------- | ----------------------------------------------------------------------------- |
| Phase 1   | Dependencies & Config    | T001–T014  | 14      | Package.json, tsconfig paths, vite.config scaffolds                           |
| Phase 2   | MMC Delta Migration      | T015–T057  | 43      | 35 file moves [P]; import-fix; test-fix                                       |
| Phase 3   | Core Layer — All 3 Apps  | T058–T108  | 51      | env → errors → auth → api → router → guards → state → main → App.vue → shared |
| Phase 4   | ESLint Import Boundaries | T109–T114  | 6       | Plugin install + config files per app                                         |
| Phase 5   | Tests                    | T115–T142  | 28      | Unit + integration tests for all core layers                                  |
| Phase 6   | Validation Gate          | T143–T158  | 16      | Lint, tsc, build, test suite                                                  |
| **Total** | —                        | T001–T158  | **158** | —                                                                             |

---

## Key Dependency Chains

| Dependency                             | Required Before                                   |
| -------------------------------------- | ------------------------------------------------- |
| `core/config/env.ts` (T058–T060)       | `core/api/client.ts` creation                     |
| `core/auth/token-store.ts` (T064–T066) | `core/api/client.ts` singleton creation           |
| `core/guards/` (T074–T079)             | `core/router/index.ts` guard pipeline wiring      |
| `core/router/index.ts` (T080–T082)     | `main.ts` router registration                     |
| Pinia install (T001–T003)              | All Pinia stores + composables                    |
| Phase 2 complete                       | Phase 3 (avoid import conflicts during migration) |

---

## Parallel Task Groups

| Group              | Tasks         | Description                                         |
| ------------------ | ------------- | --------------------------------------------------- |
| Phase 1 config     | T004–T014 [P] | tsconfig paths + vite.config per app (independent)  |
| Phase 2 file moves | T019–T053 [P] | All 35 MMC file moves are independent of each other |
| Cross-app env.ts   | T058–T060 [P] | Same file, 3 different apps                         |
| Cross-app errors   | T061–T063 [P] | error-normalizer.ts per app                         |
| Cross-app auth     | T064–T069 [P] | token-store.ts + useAuth per app                    |
| Cross-app api      | T070–T072 [P] | client.ts per app                                   |
| Cross-app guards   | T073–T078 [P] | auth + role guards per app                          |
| Phase 5 tests      | T115–T142 [P] | All test files are independent                      |

---

## Transactional Tasks

None. This is a UI scaffolding stage — no write operations to database or external services. No
transaction boundaries required.

---

## Idempotency Tasks

None required as primary tasks. The API client scaffold includes the `idempotencyInterceptor`
capability (T070–T072) as a scaffolded header-attach function, but no idempotency-critical endpoints
are implemented in this stage.

---

## Per-App Summary

| App                 | Tasks                                                                                                                                                                        | Notes                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `apps/mmc/`         | T001, T004, T007, T010, T015–T057, T058, T061, T064–T065, T067, T070, T073–T076, T080, T083, T086, T089, T092, T095, T098, T101, T103, T106, T109–T110, T115–T121, T143–T148 | Includes 43 delta migration tasks              |
| `apps/backoffice/`  | T002, T005, T008, T011, T059, T062, T066, T068, T071, T074–T077, T079, T081, T084, T087, T090, T093, T096, T099, T102, T104, T107, T111, T112, T122–T129, T136, T149–T152    | Includes WorkspaceGuard (unique to Backoffice) |
| `apps/frontoffice/` | T003, T006, T009, T012, T060, T063, T069, T072, T075–T078, T082, T085, T088, T091, T094, T097, T100, T105, T108, T113, T114, T130–T135, T137–T142, T153–T158                 | No WorkspaceGuard                              |

---

## Constitutional Compliance

| Check                                     | Status  | Notes                                                     |
| ----------------------------------------- | ------- | --------------------------------------------------------- |
| All write paths include transaction tasks | ✅ N/A  | No write operations in this stage                         |
| Idempotency tasks defined where required  | ✅ N/A  | No idempotency-critical operations                        |
| Layer boundary rules respected            | ✅ PASS | Phase 4 ESLint tasks enforce boundaries                   |
| No unrelated file modifications planned   | ✅ PASS | Only stage-scoped files (3 apps + packages/ui-system N/A) |
| Migration tasks included when required    | ✅ N/A  | UI delta migration only; no DB migrations                 |
| No cross-app imports introduced           | ✅ PASS | All tasks scoped to their respective app                  |
| `credentials: 'include'` covered          | ✅ PASS | T070–T072 include this in client.ts creation              |
| ESLint import boundaries                  | ✅ PASS | Phase 4 (T109–T114) is a complete phase                   |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                   | Severity | Task Mitigation                                                 |
| -------------------------------------- | -------- | --------------------------------------------------------------- |
| MMC delta migration import breakage    | MEDIUM   | T054–T057 cover import-fix and test-fix tasks post-migration    |
| Pinia before apiClient bootstrap order | LOW      | T103–T105 main.ts bootstrapping specifies correct order         |
| ESLint plugin versions                 | LOW      | T109–T111 task descriptions include recommended plugin versions |

---

## Next Step

Proceed to **Step 5 — Analyze (Drift Detector)**.
