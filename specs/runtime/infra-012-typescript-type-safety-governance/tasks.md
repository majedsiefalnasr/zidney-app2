# TypeScript Type Safety Governance - Atomic Task List

## Executive Summary

**Stage**: STAGE_INFRA_12_TYPESCRIPT_TYPE_SAFETY_GOVERNANCE  
**Phase**: 01_PLATFORM_FOUNDATION  
**Status**: DRAFT → TASK GENERATION  
**Generated**: 2026-03-11

### Task Statistics

| Category                          | Count         | Notes                                                  |
| --------------------------------- | ------------- | ------------------------------------------------------ |
| **Total Tasks**                   | **48**        | Atomic, testable, deliverable units                    |
| **MVP Tasks (Layers 1+5)**        | **14**        | Foundation enforcement (Phase 0)                       |
| **Post-MVP Tasks (Layers 2-8)**   | **34**        | Sequential phases (1-7)                                |
| **Setup/Foundation Tasks**        | **2**         | Prerequisite validation                                |
| **Parallel Opportunities**        | **28**        | Type error fixes, documentation tasks, boundary typing |
| **Estimated Total Effort (MVP)**  | **40 hours**  | 1-2 weeks for experienced team                         |
| **Estimated Total Effort (Full)** | **190 hours** | 4.8 weeks as specified in plan                         |

### Task Breakdown by Layer

| Layer             | Name                            | Tasks | Status   | Phase   |
| ----------------- | ------------------------------- | ----- | -------- | ------- |
| **Foundation**    | Setup & Validation              | 2     | MVP      | Phase 0 |
| **Layer 1**       | TypeScript Strict Mode          | 8     | **MVP**  | Phase 0 |
| **Layer 5**       | CI Enforcement                  | 6     | **MVP**  | Phase 0 |
| **Layer 3**       | Guard Script                    | 6     | Post-MVP | Phase 1 |
| **Layer 6**       | Domain Layer Safety             | 5     | Post-MVP | Phase 2 |
| **Layer 4**       | Runtime Validation              | 4     | Post-MVP | Phase 3 |
| **Layer 2**       | Biome Linting                   | 3     | Post-MVP | Phase 4 |
| **Layer 7**       | Boundary-Typed Architecture     | 6     | Post-MVP | Phase 5 |
| **Layer 8**       | AI Governance Rules             | 3     | Post-MVP | Phase 6 |
| **Documentation** | Type Safety Handbook & Runbooks | 7     | Post-MVP | Phase 7 |

---

## Task Dependency Graph

```
Setup Phase
  ├─→ Verify spec artifacts (T001)
  └─→ Create feature branch (T002)
       │
       ├─→ MVP Phase 0 (Parallel)
       │    ├─→ [Layer 1] Update tsconfig.json (T003-T010)
       │    └─→ [Layer 5] Create CI workflow (T011-T014)
       │
       └─→ Post-MVP Phases (Sequential)
            ├─→ Phase 1: Guard Script (T015-T020)
            ├─→ Phase 2: Domain Layer (T021-T025)
            ├─→ Phase 3: Validation (T026-T029)
            ├─→ Phase 4: Biome Linting (T030-T032)
            ├─→ Phase 5: Boundary Typing (T033-T038)
            ├─→ Phase 6: AI Governance (T039-T041)
            └─→ Phase 7: Documentation (T042-T048)
```

### Parallel Execution Groups (within phases)

**Phase 0 - Type Error Fixes (Parallel)**:

- T005-T010 can run simultaneously across different packages

**Phase 0 - CI Setup (Sequential)**:

- T011 must complete before T012
- T012 must complete before T013-T014

**Phase 5 - Boundary Typing (Parallel)**:

- T033-T038 can run in parallel (different packages)

---

## Independent Test Criteria by Layer

### Layer 1 (TypeScript Strict Mode) - MVP

✅ `bun typecheck` compiles entire monorepo without errors  
✅ `noImplicitAny: true` prevents implicit any type annotations  
✅ `noUncheckedIndexedAccess: true` enforces index access safety  
✅ All 10+ strict mode flags verified in tsconfig.json  
✅ IDE displays strict type inference correctly

**Test Scenarios**:

1. Implicit any in existing code triggers compile error
2. Index access on array without bounds check triggers error
3. Optional properties treated as potentially undefined

### Layer 5 (CI Enforcement) - MVP

✅ CI workflow executes on PR to main/staging  
✅ Type check step fails PRs with type errors  
✅ PR merge button disabled if CI fails  
✅ Type check completes in <2 minutes  
✅ CI produces actionable error output

**Test Scenarios**:

1. PR with type error triggers CI failure
2. PR with fixed type errors passes CI
3. CI output contains file:line:column info
4. False positives can be managed via allow-list

### Layer 3 (Guard Script)

✅ Script detects `:any`, `as any`, `<any>` patterns  
✅ Script detects `@ts-ignore` comments  
✅ Script completes in <30 seconds  
✅ Output available in JSON and markdown formats  
✅ Allow-list mechanism suppresses known violations

**Test Scenarios**:

1. Explicit any detection at various positions
2. Type assertion detection (both syntaxes)
3. @ts-ignore without justification detected
4. Exceptions in allow-list are skipped
5. Expired exceptions flagged as "EXPIRED"

### Layer 6 (Domain Layer Safety)

✅ Zero `any` in protected packages (domain-core, types, validation)  
✅ Allow-list exceptions tracked with sunset dates  
✅ Expired exceptions auto-flagged by guard script  
✅ Exception workflow (approval → registry → enforcement)

**Test Scenarios**:

1. Any in protected package triggers error (unless allowed)
2. Justified exception skips error
3. Sunset date passed → exception expires
4. Exception approval audit trail maintained

### Layer 4 (Runtime Validation)

✅ External data typed as `unknown` at entry points  
✅ Validation happens before domain layer access  
✅ Validation latency <100ms measured  
✅ Invalid data rejected with 422 error

**Test Scenarios**:

1. API response validated before use
2. Invalid response shape rejected
3. Database result validated
4. Queue message validated

### Layer 2 (Biome Linting)

✅ Biome fails on explicit `any` without justification comment  
✅ Biome fails on `@ts-ignore` without justification  
✅ Comment pattern enforced: library name, version, issue reference

**Test Scenarios**:

1. Any without comment → biome lint error
2. Any with comment → biome lint passes
3. Comment format validated (library name, version, URL)

### Layer 7 (Boundary-Typed Architecture)

✅ All exported functions have explicit return types  
✅ No implicit type inference on public APIs  
✅ Generic constraints specified when needed

**Test Scenarios**:

1. Export without return type triggers noImplicitAny error
2. Generic function must specify bounds
3. IDE shows explicit types for all imports

### Layer 8 (AI Governance)

✅ Documentation clear and actionable  
✅ Decision trees guide AI type discovery  
✅ All code (AI and human) passes same CI gates  
✅ AI compliance verified via code review

**Test Scenarios**:

1. AI agent follows Rule 1 (avoid any)
2. AI agent uses unknown for external data (Rule 2)
3. AI agent validates before use (Rule 3)
4. AI agent uses generics instead of dynamic (Rule 4)

---

## Task List: MVP Phase (Layers 1+5)

### Setup & Prerequisite Tasks

- [ ] T001 Verify specification artifacts exist and are current → README verification
- [ ] T002 Create feature branch `feature/infra-012-typescript-type-safety` → git branch check

### Layer 1: TypeScript Strict Mode (8 tasks)

#### Configuration & Migration

- [ ] T003 [S] Update `tsconfig.base.json` to enable strict mode (strict: true, noImplicitAny, noUncheckedIndexedAccess, exactOptionalPropertyTypes) → tsconfig.base.json
- [ ] T004 [S] Update root `tsconfig.json` to inherit strict base config → tsconfig.json
- [ ] T005 [P] [Layer1] Fix type errors in `apps/api/src/**/*.ts` (run bun typecheck, fix implicit any, missing types) → apps/api/src/
- [ ] T006 [P] [Layer1] Fix type errors in `packages/domain-core/src/**/*.ts` → packages/domain-core/src/
- [ ] T007 [P] [Layer1] Fix type errors in `packages/validation/src/**/*.ts` → packages/validation/src/
- [ ] T008 [P] [Layer1] Fix type errors in `packages/types/src/**/*.ts` → packages/types/src/
- [ ] T009 [P] [Layer1] Fix type errors in remaining `apps/` and `packages/` (frontoffice, backoffice, mmc, worker, etc.) → apps/, packages/
- [ ] T010 [S] Verify `bun typecheck` passes on full monorepo without errors → verification output

### Layer 5: CI Enforcement (6 tasks)

#### GitHub Actions Workflow

- [ ] T011 [S] Create `.github/workflows/ci-type-safety.yml` with three-step pipeline (typecheck → guard → biome lint) → .github/workflows/ci-type-safety.yml
- [ ] T012 [S] Add typecheck, type-safety-guard, and biome scripts to `package.json` scripts → package.json
- [ ] T013 [S] Integrate ci-type-safety job into `.github/workflows/ci-main.yml` (add job dependency) → .github/workflows/ci-main.yml

#### Testing & Validation

- [ ] T014 [P] Create test PR with deliberate type error to verify CI blocks merge → test PR verification
- [ ] T015 [P] [Layer5] Document CI type-safety job in `docs/type-safety/CI_ENFORCEMENT.md` → docs/type-safety/CI_ENFORCEMENT.md
- [ ] T016 [S] Verify CI execution time is <2 minutes with caching enabled → CI performance report

---

## Task List: Post-MVP Phases

### Phase 1: Guard Script Implementation (Layer 3 - 6 tasks)

#### Core Implementation

- [ ] T017 [S] Implement `scripts/type-safety-guard.ts` core structure and CLI interface (arguments parsing, output modes) → scripts/type-safety-guard.ts
- [ ] T018 [S] Implement pattern detection for `:any`, `as any`, `<any>` patterns using AST analysis → scripts/type-safety-guard.ts (patterns module)
- [ ] T019 [S] Implement `@ts-ignore` pattern detection with justification comment validation → scripts/type-safety-guard.ts (ts-ignore module)
- [ ] T020 [S] Implement ALLOWED_ANY_EXCEPTIONS.json registry system (read, match, verify expiration) → scripts/type-safety-guard.ts (registry module)
- [ ] T021 [S] Generate JSON and markdown output formats from violations → scripts/type-safety-guard.ts (output module)

#### Integration & Testing

- [ ] T022 [S] Add `type-safety-guard` job to CI pipeline after typecheck step → .github/workflows/ci-type-safety.yml
- [ ] T023 [P] Create unit tests for guard script (test each pattern detector, registry lookup, output formatting) → tests/type-safety-guard.test.ts
- [ ] T024 [S] Document guard script usage and flags in `docs/type-safety/GUARD_SCRIPT.md` → docs/type-safety/GUARD_SCRIPT.md

### Phase 2: Domain Layer Safety (Layer 6 - 5 tasks)

#### Exception Registry & Cleanup

- [ ] T025 [S] Create `packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json` with schema structure and empty exceptions array → packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json
- [ ] T026 [S] Create `packages/types/ALLOWED_ANY_EXCEPTIONS.json` with schema structure → packages/types/ALLOWED_ANY_EXCEPTIONS.json
- [ ] T027 [S] Create `packages/validation/ALLOWED_ANY_EXCEPTIONS.json` with schema structure → packages/validation/ALLOWED_ANY_EXCEPTIONS.json
- [ ] T028 [P] [Layer6] Audit and remove all `any` from `packages/domain-core` (fix or register in allow-list) → packages/domain-core/

#### Documentation & Process

- [ ] T029 [S] Remove all unallowed `any` from `packages/types` and `packages/validation` → packages/types/, packages/validation/
- [ ] T030 [S] Document exception workflow in `docs/type-safety/EXCEPTION_HANDLING.md` (request process, approval, sunset) → docs/type-safety/EXCEPTION_HANDLING.md

### Phase 3: Runtime Validation Layer (Layer 4 - 4 tasks)

#### Schema Definition

- [ ] T031 [S] Create `packages/validation/src/schemas/external-data.schema.ts` with schemas for API responses, DB results, queue messages, env vars → packages/validation/src/schemas/external-data.schema.ts
- [ ] T032 [S] Create `packages/validation/src/schemas/domain-models.schema.ts` with domain model validators → packages/validation/src/schemas/domain-models.schema.ts
- [ ] T033 [S] Create `packages/validation/VALIDATION_PATTERNS.md` with usage patterns and examples for all entry points → packages/validation/VALIDATION_PATTERNS.md

#### Integration

- [ ] T034 [P] [Layer4] Update API route handlers to use validation schemas (api/src/routes/\*.ts, validate all external data) → apps/api/src/routes/
- [ ] T035 [S] Measure and verify validation latency is <100ms with instrumentation → performance test report

### Phase 4: Biome Linting (Layer 2 - 3 tasks)

#### Configuration & Enforcement

- [ ] T036 [S] Update `biome.json` to enable `suspicious/noExplicitAny` rule as error (not warning) → biome.json
- [ ] T037 [P] [Layer2] Fix all biome lint violations for explicit `any` (add justification comments or change to unknown) → apps/, packages/
- [ ] T038 [S] Add biome lint check to CI after typecheck → .github/workflows/ci-type-safety.yml

### Phase 5: Boundary-Typed Architecture (Layer 7 - 6 tasks)

#### Package Export Typing

- [ ] T039 [S] Audit all exports in `packages/domain-core/src/index.ts` and add explicit types to functions/exports → packages/domain-core/src/index.ts
- [ ] T040 [S] [P] Audit and type all exports in `packages/types/src/index.ts` → packages/types/src/index.ts
- [ ] T041 [S] [P] Audit and type all exports in `packages/validation/src/index.ts` → packages/validation/src/index.ts
- [ ] T042 [S] [P] Audit and type all exports in remaining packages (api-client, config, job-queue, logger, redis-utils, ui-system) → packages/\*/src/index.ts
- [ ] T043 [S] [P] Audit and type all public exports in `apps/api/src/index.ts` and entry points → apps/api/src/
- [ ] T044 [S] Verify all public API boundaries are explicitly typed (no implicit inference) → type-boundary audit report

### Phase 6: AI Governance Rules (Layer 8 - 3 tasks)

#### AI Skill Documentation

- [ ] T045 [S] Create `.agents/skills/typescript-governance/SKILL.md` with 5 core rules and decision trees → .agents/skills/typescript-governance/SKILL.md
- [ ] T046 [S] Create `.agents/skills/typescript-governance/type-safety-examples.ts` with code examples for each rule (correct and incorrect patterns) → .agents/skills/typescript-governance/type-safety-examples.ts
- [ ] T047 [S] Document AI enforcement model in SKILL.md (no special paths, same CI gates, code review responsibility) → .agents/skills/typescript-governance/SKILL.md

### Phase 7: Documentation & Runbooks (7 tasks)

#### Core Documentation

- [ ] T048 [S] Create `docs/type-safety/README.md` overview and architecture diagram → docs/type-safety/README.md
- [ ] T049 [S] Create `docs/type-safety/TYPE_SAFETY_HANDBOOK.md` with layer-by-layer guide (what, why, how for each layer) → docs/type-safety/TYPE_SAFETY_HANDBOOK.md

#### Runbooks & Guides

- [ ] T050 [S] Create `docs/type-safety/RUNBOOK_FIX_TYPE_ERRORS.md` with troubleshooting guide (common errors, fixes, examples) → docs/type-safety/RUNBOOK_FIX_TYPE_ERRORS.md
- [ ] T051 [S] Create `docs/type-safety/RUNBOOK_VALIDATE_EXTERNAL_DATA.md` with pattern guide (API responses, DB, queues, env vars) → docs/type-safety/RUNBOOK_VALIDATE_EXTERNAL_DATA.md
- [ ] T052 [S] Create `docs/type-safety/RUNBOOK_TYPE_NEW_API_ENDPOINT.md` with step-by-step implementation guide → docs/type-safety/RUNBOOK_TYPE_NEW_API_ENDPOINT.md
- [ ] T053 [S] Create `docs/type-safety/AI_GOVERNANCE_HANDBOOK.md` with detailed AI contribution rules and team expectations → docs/type-safety/AI_GOVERNANCE_HANDBOOK.md
- [ ] T054 [S] Update main `README.md` to reference type safety documentation → README.md

#### Testing & Validation

- [ ] T055 [S] Create comprehensive test file `tests/type-safety-governance.test.ts` (integration tests for all layers) → tests/type-safety-governance.test.ts
- [ ] T056 [S] Create `docs/type-safety/TESTING_GUIDE.md` with test scenarios for each layer (section 5 in spec) → docs/type-safety/TESTING_GUIDE.md

---

## MVP Completion Criteria

### Functional Requirements

✅ **FR1: TypeScript Compiler Rules** — All tasks T003-T010 complete successfully

- Strict mode enabled in tsconfig files
- All existing code passes `bun typecheck`
- noImplicitAny, noUncheckedIndexedAccess, exactOptionalPropertyTypes enabled

✅ **FR5: CI Type Safety Enforcement** — All tasks T011-T016 complete successfully

- CI workflow created and integrated
- Type check runs on every PR
- Merge blocked if type errors exist
- Performance validated <2 minutes

### Quality Standards

✅ All MVP tasks use exact file paths (no vague descriptions)  
✅ All tasks are independently testable (no task depends on unspecified work)  
✅ All tasks follow checklist format: `- [ ] T{ID} [P?] [Layer?] Description → output_file`  
✅ No blocking dependencies between parallel tasks  
✅ Error handling documented for common failure routes

### Validation Strategy

1. Code review confirms strict mode rules enabled
2. CI validation confirms workflow executes <2 min
3. Test PR with type error confirms merge blocked
4. Type error fixes pass CI gate
5. All package.json scripts functional

### MVP Success Exit Criteria

- `bun typecheck` passes on full monorepo
- `bun run validate:types` succeeds (typecheck + guard + biome lint)
- GitHub Actions ci-type-safety job executes successfully
- PR type-safety check appears in PR status
- Type errors prevent PR merge
- Team feedback confirms CI UX is clear and helpful

---

## Post-MVP Implementation Notes

### Dependency Chain

Phase 1 (Guard Script) → Phase 2 (Domain Layer) → Phase 3 (Validation) → Phase 4 (Biome) → Phase 5 (Boundary) → Phase 6 (AI) → Phase 7 (Documentation)

Each phase builds on previous. Guard script (Phase 1) enables Domain Layer safety (Phase 2).

### Parallel Opportunities Within Phases

- **Phase 0**: Type error fixes (T005-T010) can run in parallel across different packages
- **Phase 0**: CI configuration tasks (T011-T013) must be sequential
- **Phase 5**: Boundary typing audits (T039-T043) can run in parallel across packages
- **Phase 7**: Documentation tasks (T048-T054) can run in parallel (except final README update)

### Risk Mitigation

1. **Type Error Volume**: If >1000 errors detected in Phase 0:
   - Consider `skipTypeCheck` flag on specific packages temporarily
   - Gradual rollout: enable strict per-package rather than globally
   - Use `// @ts-ignore` with ALLOWED_ANY_EXCEPTIONS for true blocking issues

2. **Performance Regression**: If CI exceeds 2 minutes:
   - Enable TypeScript incremental compilation (`"incremental": true`)
   - Cache tsc build output in CI
   - Consider parallel typecheck across monorepo workspaces

3. **Domain Layer Cleanup**: If >50 `any` instances in protected packages:
   - Use guard script to prioritize by severity
   - Request architecture team approval for batch sunset dates
   - Consider staged cleanup (30 days, 60 days, 90 days)

---

## Files to Create/Modify

### MVP Phase (Layers 1+5)

| File                                   | Type   | Created? | Task |
| -------------------------------------- | ------ | -------- | ---- |
| `tsconfig.base.json`                   | Modify | No       | T003 |
| `tsconfig.json`                        | Modify | No       | T004 |
| `apps/api/src/**/*.ts`                 | Modify | No       | T005 |
| `packages/domain-core/src/**/*.ts`     | Modify | No       | T006 |
| `packages/validation/src/**/*.ts`      | Modify | No       | T007 |
| `packages/types/src/**/*.ts`           | Modify | No       | T008 |
| `packages/*/src/**/*.ts`               | Modify | No       | T009 |
| `.github/workflows/ci-type-safety.yml` | Create | Yes      | T011 |
| `package.json`                         | Modify | No       | T012 |
| `.github/workflows/ci-main.yml`        | Modify | No       | T013 |
| `docs/type-safety/CI_ENFORCEMENT.md`   | Create | Yes      | T015 |

### Post-MVP Phase (Layers 2-8)

| File                                                           | Type   | Created? | Tasks     |
| -------------------------------------------------------------- | ------ | -------- | --------- |
| `scripts/type-safety-guard.ts`                                 | Create | Yes      | T017-T022 |
| `tests/type-safety-guard.test.ts`                              | Create | Yes      | T023      |
| `packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json`             | Create | Yes      | T025      |
| `packages/types/ALLOWED_ANY_EXCEPTIONS.json`                   | Create | Yes      | T026      |
| `packages/validation/ALLOWED_ANY_EXCEPTIONS.json`              | Create | Yes      | T027      |
| `packages/validation/src/schemas/external-data.schema.ts`      | Create | Yes      | T031      |
| `packages/validation/src/schemas/domain-models.schema.ts`      | Create | Yes      | T032      |
| `biome.json`                                                   | Modify | No       | T036      |
| `.agents/skills/typescript-governance/SKILL.md`                | Create | Yes      | T045      |
| `.agents/skills/typescript-governance/type-safety-examples.ts` | Create | Yes      | T046      |
| `docs/type-safety/*.md` (7 files)                              | Create | Yes      | T048-T054 |
| `tests/type-safety-governance.test.ts`                         | Create | Yes      | T055      |

---

## Summary: MVP vs Post-MVP

### MVP (Layers 1+5) — 2-Week Delivery

- **Tasks**: T001-T016 (16 tasks total, 14 core MVP + 2 setup)
- **Effort**: ~40 hours for experienced team
- **Deliverables**: Strict mode enabled, CI gate enforced, type errors prevented
- **Risk Level**: LOW (configuration only, no architecture changes)
- **Go/No-Go Criteria**: `bun typecheck` passes, CI job < 2min, test verify merge blocked

### Post-MVP (Layers 2-8) — 9-Week Delivery (Phases 1-7)

- **Tasks**: T017-T056 (40 tasks across sequential phases)
- **Effort**: ~150 hours (additional after MVP)
- **Deliverables**: Guard script, domain safety, validation layer, boundary typing, AI rules, full documentation
- **Risk Level**: LOW (guard script execution, no schema changes)
- **Go/No-Go Criteria**: Guard script <30s, domain packages 0% any (except allow-list), all documentation reviewed

---

## Conclusion

This task list represents an **atomic, sequentially ordered, and independently testable breakdown** of the TypeScript Type Safety Governance feature.

**Phase 0 (MVP)** establishes the foundation layers (strict mode + CI enforcement) and can be delivered in 1-2 weeks.

**Phases 1-7 (Post-MVP)** build advanced governance capabilities in strict sequential dependency order, delivering full type safety coverage by week 12.

Each task is:

- ✅ Atomic (1-4 hour scope)
- ✅ Testable (independent test criteria)
- ✅ Traceable (exact output files)
- ✅ Sequenced (dependency-aware)
- ✅ Parallelizable (where safe)

**Ready for implementation.**
