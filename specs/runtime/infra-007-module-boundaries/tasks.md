# Tasks: STAGE_INFRA_07_MODULE_BOUNDARIES

**Stage**: `STAGE_INFRA_07_MODULE_BOUNDARIES`
**Phase**: `01_PLATFORM_FOUNDATION`
**Feature Dir**: `specs/runtime/infra-007-module-boundaries/`
**Generated**: 2026-03-08
**Status**: Ready for implementation

---

## Summary

| Phase | Description                         | Tasks     |
| ----- | ----------------------------------- | --------- |
| 1     | Foundation — boundary map file      | T001–T002 |
| 2     | ai-guard.ts Types and Loaders       | T003–T008 |
| 3     | ai-guard.ts Validator Functions     | T009–T010 |
| 4     | ai-guard.ts runGuard() Integration  | T011–T013 |
| 5     | Package Script and CI Step          | T014–T015 |
| 6     | infra-audit.ts Enhancement (FR-008) | T016      |
| 7     | Tests                               | T017–T018 |
| 8     | Final Validation                    | T019–T023 |

**TASKS_TOTAL**: 23

---

## Phase 1 — Foundation (Sequential)

> Create the authoritative machine-readable boundary map. All subsequent phases depend on this file existing.

- [ ] T001 Create `docs/architecture/module-boundaries.json` with the complete production-ready content from plan.md Data Model section — includes `version`, `description`, `layers` (4 layers × 13 modules), `allowed_dependencies`, `forbidden_dependencies`, and `cross_cutting_rules` (4 rules: `packages_no_apps`, `no_cross_app_imports`, `runtime_no_ui_system`, `ui_no_domain_packages`)
- [ ] T002 Verify `docs/architecture/module-boundaries.json` is valid JSON by running `bun -e "JSON.parse(require('fs').readFileSync('docs/architecture/module-boundaries.json','utf-8'))"` and confirm exactly 13 modules across 4 layers: `infrastructure`=4, `domain`=2, `runtime`=2, `ui`=5

---

## Phase 2 — ai-guard.ts Types and Loaders (Sequential)

> Extend `scripts/ai-guard.ts` with the types and loader functions required by the new validator. No behavior changes until Phase 4.

- [ ] T003 Update the `import { readFileSync } from 'node:fs'` line at the top of `scripts/ai-guard.ts` to `import { existsSync, readFileSync } from 'node:fs'`
- [ ] T004 Add the `BOUNDARIES_PATH` constant `'docs/architecture/module-boundaries.json'` after the existing `AI_BRAIN_PATH` constant on line ~84 in `scripts/ai-guard.ts`
- [ ] T005 Add `TsAliasMap` interface, `CrossCuttingRule` discriminated-union type, and `ModuleBoundaries` type definitions after the `ArchitectureBrain` type definition (line ~70) in `scripts/ai-guard.ts` — exact shapes as specified in plan.md §2c
- [ ] T006 Add `loadModuleBoundaries(): ModuleBoundaries | null` function after `loadArchitectureBrain()` in `scripts/ai-guard.ts` — missing file → `console.warn` + return `null`; malformed JSON → `console.error` + `process.exit(1)`; valid → parse and return (plan.md §2d)
- [ ] T007 Add `loadTsAliases(): TsAliasMap[]` function after `loadModuleBoundaries()` in `scripts/ai-guard.ts` — reads both `tsconfig.json` and `tsconfig.base.json`, merges with `tsconfig.json` taking precedence via a `seen` Set, strips `/*` from both alias keys and target values (plan.md §2e — corrected version that reads BOTH configs to capture `@zidney/api-client` from `tsconfig.base.json`)
- [ ] T008 Run `bun scripts/ai-guard.ts` from repo root and verify it exits 0 — confirms no syntax errors and no behavior change from T003–T007 (boundaries not yet wired into runGuard)

---

## Phase 3 — ai-guard.ts Validator Functions (Sequential)

> Add the five helper functions and the exported `validateLayerBoundaries()` function. These are pure functions; they do not affect the guard yet.

- [ ] T009 Add the five helper functions after `validateRelativeLeaks()` in `scripts/ai-guard.ts`: `getLayerForModule(modulePath, boundaries)`, `resolveImportToModule(importPath, aliases)` (longest-alias-wins + direct monorepo path + null for external), `matchesGlobPattern(modulePath, pattern)` (handles `apps/*`-style globs), `ruleSourceMatches(rule, sourceModule, sourceLayer)`, `ruleTargetMatches(rule, targetModule)` — exact implementations from plan.md §2f
- [ ] T010 Add exported `validateLayerBoundaries(filePath, imports, boundaries, aliases): string[]` function after the five helpers in `scripts/ai-guard.ts` — derives `sourceModule` and `sourceLayer`, checks each import's `targetLayer` against `allowedLayers`, evaluates all `cross_cutting_rules`, returns violation strings prefixed with `ARCHITECTURE VIOLATION —` per FR-012 (plan.md §2g)

---

## Phase 4 — ai-guard.ts runGuard() Integration (Sequential)

> Wire the new functions into `runGuard()` so boundary validation runs on every execution.

- [ ] T011 Inside `runGuard()` in `scripts/ai-guard.ts`, add `const boundaries = loadModuleBoundaries()` and `const aliases = loadTsAliases()` after the `const archMap = loadArchitectureMap()` call, followed by the conditional log `if (boundaries) { console.log('AI Guard: module-boundaries.json loaded — layer boundary validation enabled.') }` (plan.md §2h)
- [ ] T012 Inside the `for (const file of changedFiles)` loop in `runGuard()` in `scripts/ai-guard.ts`, add `const layerBoundaryViolations = boundaries ? validateLayerBoundaries(file, imports, boundaries, aliases) : []` after the `archMapViolations` line, and append `...layerBoundaryViolations.map(v => \`${file}: ${v}\`)`to the existing`violations.push(...)` block (plan.md §2i)
- [ ] T013 Run `bun run arch:guard` from repo root against the full monorepo and verify it exits 0 — confirms SC-010: no existing code violates the newly-enforced layer boundaries

---

## Phase 5 — Package Script and CI Step (Parallel — T014 and T015 are independent)

> Add the `ai-guard` npm script and update the CI step name. These two edits touch different files and can be done concurrently.

- [ ] T014 [P] Add `"ai-guard": "bun scripts/ai-guard.ts"` to the `scripts` object in root `package.json` — insert it alphabetically before `"arch:add-module"` (or directly after `"arch:guard"`), preserving the existing `"arch:guard"` entry (plan.md §File 3)
- [ ] T015 [P] In `.github/workflows/ci.yml`, rename the step at line 82 from `name: Run AI-Guard architecture check` to `name: module-boundary-validation` and update `run: bun scripts/ai-guard.ts` to `run: bun run ai-guard` — no change to the job graph, `needs:` dependencies, or job name (plan.md §File 4)

---

## Phase 6 — infra-audit.ts Enhancement (Sequential)

> Extend the undeclared-module detection in `scripts/infra-audit.ts` to also check against `module-boundaries.json` so modules declared in boundaries but absent from `ARCHITECTURE_MAP.json` are not falsely reported, and modules present on disk but absent from both files are flagged (FR-008).

- [ ] T016 Update the undeclared-module detection block in `scripts/infra-audit.ts` (around lines 999–1006) to load `docs/architecture/module-boundaries.json` alongside `ARCHITECTURE_MAP.json` and compare discovered `packages/*` and `apps/*` directory names against the union of both files' declared modules — any module present on disk but absent from `module-boundaries.json` must be reported as `undeclared module: <path>` per FR-008

---

## Phase 7 — Tests (Parallel — T017 and T018 are independent)

> Create two test files. They touch different directories and can be written concurrently.

- [ ] T017 [P] Create `tests/static/module-boundaries.test.ts` — static test that reads and parses `docs/architecture/module-boundaries.json` and asserts: `layers.infrastructure.length === 4`, `layers.domain.length === 2`, `layers.runtime.length === 2`, `layers.ui.length === 5`, total module count across all layers === 13, and that the file is well-formed valid JSON (FR-001, FR-002 automated verification). Also add a test case that verifies FR-008 infra-audit.ts undeclared module detection: use a temp directory `packages/canary-unregistered-test` not present in `module-boundaries.json` and confirm `infra-audit.ts` would flag it as an undeclared module (mock the filesystem with `vi.mock` or use a fixture JSON without the temp module path to assert the detection logic)
- [ ] T018 [P] Create `tests/unit/ai-guard/ai-guard-boundaries.test.ts` — unit tests importing `validateLayerBoundaries`, `resolveImportToModule`, and `matchesGlobPattern` from `scripts/ai-guard.ts`; covering: (a) layer violation `ui → domain` (`packages/ui-system` importing `packages/domain-core`), (b) layer violation `domain → runtime` (`packages/domain-core` importing `apps/api`), (c) layer violation `infrastructure → domain` (`packages/config` importing `packages/validation`), (d) cross-cutting rule `no_cross_app_imports` (`apps/mmc` importing `apps/api`), (e) cross-cutting rule `packages_no_apps` (`packages/ui-system` importing `apps/api`), (f) alias resolution via `@zidney/ui` → `packages/ui-system` triggering `runtime → ui` violation, (g) alias resolution via `@zidney/api-client` (tsconfig.base.json only) resolves correctly, (h) `null` returned for external npm package imports (not flagged), (i) missing `module-boundaries.json` fallback: `validateLayerBoundaries` returns empty array when `boundaries` is `null`

---

## Phase 8 — Final Validation (Sequential)

> Gate checks confirming all layers integrate correctly and the CI pipeline will pass.

- [ ] T019 Run `bun run lint` from repo root and confirm exit code 0 — NFR-002 (no new dependencies introduced, no Biome violations in modified files)
- [ ] T020 Run `bun run typecheck` from repo root and confirm exit code 0 — all new types in `scripts/ai-guard.ts` are correctly typed and no `tsconfig.json` violations
- [ ] T021 Run `bun run ai-guard` from repo root and confirm exit code 0 — FR-010 + SC-010: the new `ai-guard` package.json script works and no existing code violates the boundary map
- [ ] T022 Run `vitest run tests/unit/ai-guard/ai-guard-boundaries.test.ts` directly to confirm the new unit test file passes (the `test:unit` script enumerates named vitest projects which excludes the `root` project where this file lives — running the file directly ensures it is not silently skipped)
- [ ] T023 Run `bun run test:static` and confirm all static tests pass including `tests/static/module-boundaries.test.ts`

---

## Dependencies

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008
                                                     ↓
T008 → T009 → T010 → T011 → T012 → T013
                                     ↓
                              T014
                                ↓
                              T015
                                     ↓
                              T016 → T017 (parallel with T018)
                                     T018 (parallel with T017)
                                          ↓
                                     T019 → T020 → T021 → T022 → T023
```

**Key sequential chains**:

- Foundation → Types → Loaders → Validators → Integration is a strict chain (each step depends on the previous)
- T015 depends on T014 (T015 references the `ai-guard` script that T014 adds to package.json)
- T017 and T018 are independent (different test files)
- Phase 8 tasks must run after all code is written and tested

---

## Parallel Execution Opportunities

**Group A** — After T013 completes (sequential):

```
T014: root package.json  → then →  T015: .github/workflows/ci.yml
```

**Group B** — After T016 completes (independent test files):

```
T017: tests/static/module-boundaries.test.ts
T018: tests/unit/ai-guard/ai-guard-boundaries.test.ts
```

---

## Implementation Strategy

**MVP scope** — Minimum to satisfy P1 acceptance scenarios (Scenarios 1 & 2):

- T001 (boundary map) + T003–T013 (ai-guard wiring) = working `bun run arch:guard`
- T019–T021 (validation gates)

**Incremental delivery order**:

1. T001–T002: Data foundation (can be reviewed independently)
2. T003–T008: Non-breaking additions (types + loaders, guard still exits 0)
3. T009–T010: Pure functions (no side effects, easily unit-testable)
4. T011–T013: Integration + SC-010 verification (first observable behavior change)
5. T014–T015: CI + script alignment (FR-009, FR-010)
6. T016: infra-audit enhancement (FR-008, Scenario 3)
7. T017–T018: Test coverage
8. T019–T023: Final gates

---

## Files Modified by This Stage

| File                                              | Action | Phase |
| ------------------------------------------------- | ------ | ----- |
| `docs/architecture/module-boundaries.json`        | CREATE | 1     |
| `scripts/ai-guard.ts`                             | MODIFY | 2–4   |
| `package.json`                                    | MODIFY | 5     |
| `.github/workflows/ci.yml`                        | MODIFY | 5     |
| `scripts/infra-audit.ts`                          | MODIFY | 6     |
| `tests/static/module-boundaries.test.ts`          | CREATE | 7     |
| `tests/unit/ai-guard/ai-guard-boundaries.test.ts` | CREATE | 7     |

**No changes to**: Any file under `apps/*/src`, `packages/*/src`, `apps/api/src/db/`, migration files, or any runtime business logic. This is a pure governance stage (NFR-001).
