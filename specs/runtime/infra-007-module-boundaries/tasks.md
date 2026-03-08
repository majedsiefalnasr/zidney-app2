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
| 8     | Final Validation                    | T019–T024 |

**TASKS_TOTAL**: 26

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

## Phase 5 — Package Script and CI Step (Sequential — T015 depends on T014)

> Add the `ai-guard` npm script first, then update CI to invoke it. T015 must run after T014 because the CI workflow references the script name that T014 introduces to `package.json`.

- [ ] T014 Add `"ai-guard": "bun scripts/ai-guard.ts"` to the `scripts` object in root `package.json` — insert it alphabetically before `"arch:add-module"` (or directly after `"arch:guard"`), preserving the existing `"arch:guard"` entry (plan.md §File 3)
- [ ] T015 ⚠️ Depends on T014 — run only after T014 is complete. In `.github/workflows/ci.yml`, rename the step named `Run AI-Guard architecture check` (line ~82) to `name: module-boundary-validation` and update `run: bun scripts/ai-guard.ts` to `run: bun run ai-guard` — no change to the job graph, `needs:` dependencies, or job name (plan.md §File 4)

---

## Phase 6 — infra-audit.ts Enhancement (Sequential)

> Extend the undeclared-module detection in `scripts/infra-audit.ts` to also check against `module-boundaries.json` so modules declared in boundaries but absent from `ARCHITECTURE_MAP.json` are not falsely reported, and modules present on disk but absent from both files are flagged (FR-008).

- [ ] T016 Update the undeclared-module detection block in `scripts/infra-audit.ts` (around lines 999–1006) to load `docs/architecture/module-boundaries.json` and compare discovered `packages/*` and `apps/*` directory names against the modules declared in `module-boundaries.json` — any module present on disk but absent from `module-boundaries.json` must be reported as `undeclared module: <path>` per FR-008 (do not use `ARCHITECTURE_MAP.json` as the reference source for this check — `module-boundaries.json` is authoritative)

---

## Phase 7 — Tests (Parallel — T017 and T018 are independent)

> Create two test files. They touch different directories and can be written concurrently.

- [ ] T017a [P] Create `tests/static/module-boundaries.test.ts` — static test (no mocking, no behavioral logic) that reads and parses `docs/architecture/module-boundaries.json` and asserts: `layers.infrastructure.length === 4`, `layers.domain.length === 2`, `layers.runtime.length === 2`, `layers.ui.length === 5`, total module count across all layers === 13, and that the file is well-formed valid JSON (FR-001, FR-002 automated verification)
- [ ] T017b [P] Create `tests/unit/infra-audit/infra-audit-boundaries.test.ts` — behavioral unit test for FR-008 undeclared-module detection: use a fixture JSON (or `vi.mock` on `readdirSync`) that omits a module present on disk (e.g., `packages/canary-unregistered-test`); import and invoke the undeclared-module detection logic from `scripts/infra-audit.ts`; assert it reports `undeclared module: packages/canary-unregistered-test` (FR-008 automated verification); also test the negative case: construct the fixture JSON WITH `packages/canary-unregistered-test` present as a registered module; invoke the detection logic; assert zero undeclared-module warnings are produced (verifies the "fix working" half of FR-008 acceptance — Scenario 3 criterion #2)
- [ ] T018 [P] Create `tests/unit/ai-guard/ai-guard-boundaries.test.ts` — unit tests importing `validateLayerBoundaries`, `resolveImportToModule`, `matchesGlobPattern`, `loadModuleBoundaries`, and `loadTsAliases` from `scripts/ai-guard.ts`; use the `process.exit` spy pattern from plan.md Step 8 in `beforeEach`/`afterEach` for all error-path tests; covering: (a) layer violation `ui → domain` (`packages/ui-system` importing `packages/domain-core`), (b) layer violation `domain → runtime` (`packages/domain-core` importing `apps/api`), (c) layer violation `infrastructure → domain` (`packages/config` importing `packages/validation`), (d) cross-cutting rule `no_cross_app_imports` — use fixture `apps/mmc` importing `apps/backoffice` (both `ui` layer; same-layer allowed by matrix so only the cross-cutting rule fires — exactly one violation), (e) cross-cutting rule `packages_no_apps` (`packages/ui-system` importing `apps/api`), (f) alias resolution via `@zidney/ui` → `packages/ui-system` triggering `runtime → ui` violation, (g) alias resolution via `@zidney/api-client` (tsconfig.base.json only) resolves correctly, (h) `null` returned for external npm package imports (not flagged), (i) missing `module-boundaries.json` fallback: spy on `validateLayerBoundaries` (or use `vi.fn()`) and assert it is NOT called when `loadModuleBoundaries` returns `null` — tests the `boundaries ? validateLayerBoundaries(...) : []` guard in `runGuard()`, (j) `loadModuleBoundaries()` malformed-JSON path: mock `readFileSync` to return invalid JSON (e.g., `"{broken"`); use process.exit spy from plan.md Step 8; assert process.exit was called with code 1, (k) `loadModuleBoundaries()` structurally-invalid path: mock `readFileSync` to return valid JSON missing the `layers` field; use process.exit spy; assert process.exit was called with code 1, (l) `loadTsAliases()` file-parsing and merge behavior: mock `readFileSync` (and `existsSync`) via `vi.mock('node:fs')` to return synthetic tsconfig.json and tsconfig.base.json content with overlapping and distinct alias keys; call `loadTsAliases()` directly; assert aliases from both files are merged, tsconfig.json wins on key conflict, `/*` is stripped from alias keys and target values, and the result is deduplicated; also assert that `console.warn` is emitted (spy on `console.warn`) when `readFileSync` throws for one of the config files, (m) `validateLayerBoundaries` no-violation path: given `filePath = 'packages/domain-core/src/index.ts'` and `imports = ['packages/logger']` (infrastructure layer, allowed for domain), assert the returned violations array has length 0; add a second assertion: `filePath = 'apps/frontoffice/src/index.ts'`, `imports = ['packages/config']` (infrastructure layer, allowed for ui), assert zero violations, (n) `loadModuleBoundaries` valid-file happy path: mock `readFileSync` to return syntactically valid, structurally complete JSON with all three required fields (`layers`, `allowed_dependencies`, `forbidden_dependencies`) present as plain objects; assert the function returns a non-null `ModuleBoundaries` object with `.layers`, `.allowed_dependencies`, and `.forbidden_dependencies` all populated

---

## Phase 8 — Final Validation (Sequential)

> Gate checks confirming all layers integrate correctly and the CI pipeline will pass.

- [ ] T019 Run `bun run lint` from repo root and confirm exit code 0 — NFR-002 (no new dependencies introduced, no Biome violations in modified files)
- [ ] T020 Run `bun run typecheck` from repo root and confirm exit code 0 — all new types in `scripts/ai-guard.ts` are correctly typed and no `tsconfig.json` violations
- [ ] T021 Run `bun run ai-guard` from repo root and confirm exit code 0 — FR-010 + SC-010: the new `ai-guard` package.json script works and no existing code violates the boundary map
- [ ] T022 Run `vitest run tests/unit/ai-guard/ai-guard-boundaries.test.ts` directly to confirm the new unit test file passes (the `test:unit` script enumerates named vitest projects which excludes the `root` project where this file lives — running the file directly ensures it is not silently skipped)
- [ ] T022b Run `vitest run tests/unit/infra-audit/infra-audit-boundaries.test.ts` directly to confirm the FR-008 behavioral test passes
- [ ] T023 Run `bun run test:static` and confirm all static tests pass including `tests/static/module-boundaries.test.ts`
- [ ] T024 Measure wall-clock time of `bun run ai-guard` from repo root and confirm it completes in under 30 seconds on the full monorepo scan — NFR-004 (performance budget) automated verification

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
                              T016 → T017a (parallel with T017b and T018)
                                     T017b (parallel with T017a and T018)
                                     T018 (parallel with T017a and T017b)
                                          ↓
                                     T019 → T020 → T021 → T022 → T022b → T023 → T024
```

**Key sequential chains**:

- Foundation → Types → Loaders → Validators → Integration is a strict chain (each step depends on the previous)
- T015 depends on T014 (T015 references the `ai-guard` script that T014 adds to package.json)
- T017a, T017b, and T018 are independent (different test files in different directories)
- Phase 8 tasks must run after all code is written and tested

---

## Parallel Execution Opportunities

**Group A** — After T013 completes (sequential):

```
T014: root package.json  → then →  T015: .github/workflows/ci.yml
```

**Group B** — After T016 completes (independent test files):

```
T017a: tests/static/module-boundaries.test.ts
T017b: tests/unit/infra-audit/infra-audit-boundaries.test.ts
T018:  tests/unit/ai-guard/ai-guard-boundaries.test.ts
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
8. T019–T024: Final gates

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
