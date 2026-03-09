# Tasks: AI Architecture Context Layer

**Stage**: STAGE_INFRA_09_AI_ARCHITECTURE_CONTEXT  
**Phase**: PHASE_01_PLATFORM_FOUNDATION  
**Branch**: spec/infra-009-ai-architecture-context  
**Total Tasks**: 35  
**Status**: Ready for Implementation  
**Last Updated**: 2026-03-09

---

## Overview

This task list implements the AI Architecture Context Layer — a set of 7 machine-readable JSON/Markdown artifacts that enable AI agents to understand and validate Zidney's architecture automatically.

**Key Deliverables**:

- `docs/ai/context/ai-architecture-summary.md` — System overview
- `docs/ai/context/ai-module-map.json` — Module-to-layer mapping
- `docs/ai/context/ai-layer-model.json` — Layer definitions and rules
- `docs/ai/context/ai-dependency-graph.json` — Dependency relationships
- `docs/ai/context/ai-runtime-map.json` — Service-to-module mapping
- `docs/ai/context/ai-architecture-brain.json` — AI-optimized metadata
- `docs/ai/context/ai-context-mini.json` — Lightweight context

**Total Task Count**: 35 tasks across 4 phases

---

## Task Dependencies & Execution Order

```
Phase 0 (Research): T001-T005 (sequential, foundational)
  ↓
Phase 1 (Design): T006-T013 (mostly parallel within phase)
  ├─ T006 TypeScript types (blocks T007-T022)
  ├─ T007 JSON schemas (depends on T006)
  └─ T008-T013 design specs (parallel)
  ↓
Phase 2 (Implementation): T014-T025 (parallel builders, then orchestration)
  ├─ T014-T022 Builders (parallel, depend on T006)
  ├─ T023 Orchestrator (depends on T014-T022)
  ├─ T024 Change detection (depends on T006)
  └─ T025 Entry point (depends on T023)
  ↓
Phase 3 (Testing): T026-T032 (parallel tests)
  ├─ T026-T027 Integration (depend on T025)
  ├─ T028-T031 Tests (depend on implementations)
  └─ T032 Manual testing (final validation)
  ↓
Phase 4 (Deployment): T033-T035 (sequential, final delivery)
```

---

## Phase 0: Research & Investigation

**Purpose**: Analyze source systems and design the generation pipeline

**Duration**: Week 0-1 (~5 tasks)

### Source System Discovery

- [ ] T001 Document ADR source structure and consumption patterns in specs/runtime/infra-009-ai-architecture-context/research.md
- [ ] T002 [P] Document module-boundaries.json format, validation rules, and update frequency in specs/runtime/infra-009-ai-architecture-context/research.md
- [ ] T003 Document infra-audit.ts outputs, schema structure, and dependency graph format in specs/runtime/infra-009-ai-architecture-context/research.md
- [ ] T004 Design complete artifact generation pipeline architecture with diagram in specs/runtime/infra-009-ai-architecture-context/research.md
- [ ] T005 Map data flows from sources to all 7 artifacts and final consumers in specs/runtime/infra-009-ai-architecture-context/research.md

---

## Phase 1: Design & Architecture

**Purpose**: Define types, schemas, and integration contracts

**Duration**: Week 1-2 (~8 tasks)

**Prerequisite**: Phase 0 complete

### Type System & Schemas

- [ ] T006 Create TypeScript interface definitions for all 7 artifacts in packages/types/src/ai-context.ts with JSDoc documentation
- [ ] T007 Generate JSON schemas from TypeScript types using typescript-json-schema into docs/ai/context/schemas/ directory

### Design Specifications

- [ ] T008 [P] Design artifact generation script architecture with error handling in specs/runtime/infra-009-ai-architecture-context/data-model.md
- [ ] T009 [P] Design change detection mechanism with source hashing and freshness logic in specs/runtime/infra-009-ai-architecture-context/data-model.md
- [ ] T010 [P] Design AI tool integration contracts (Copilot, GitNexus, SpecKit, Claude) in specs/runtime/infra-009-ai-architecture-context/contracts/ai-tool-integration.md
- [ ] T011 [P] Design CI/CD integration with GitHub Actions workflow templates in specs/runtime/infra-009-ai-architecture-context/contracts/ci-integration.md
- [ ] T012 [P] Design code organization and module layout for scripts/ai-context/ directory in specs/runtime/infra-009-ai-architecture-context/data-model.md
- [ ] T013 Document key implementation decisions with rationale in specs/runtime/infra-009-ai-architecture-context/research.md

---

## Phase 2: Implementation

**Purpose**: Build artifact generators, orchestration, and CLI integration

**Duration**: Week 2-3 (~12 tasks)

**Prerequisite**: Phase 1 complete

### Core Infrastructure

- [ ] T014 [P] Implement source-loader.ts to load and parse ADR files and module-boundaries.json in scripts/ai-context/source-loader.ts
- [ ] T015 [P] Implement schema-validator.ts with runtime validation for all 7 artifact schemas in scripts/ai-context/schema-validator.ts
- [ ] T016 Create docs/ai/context/schemas/ directory structure and documentation in docs/ai/context/schemas/README.md

### Artifact Builders (7 Builders - Parallelizable)

- [ ] T017 [P] Implement module-map-builder.ts to generate ai-module-map.json from directory scan and module-boundaries.json in scripts/ai-context/artifact-builders/module-map-builder.ts
- [ ] T018 [P] Implement layer-model-builder.ts to generate ai-layer-model.json from module-boundaries.json rules in scripts/ai-context/artifact-builders/layer-model-builder.ts
- [ ] T019 [P] Implement dependency-graph-builder.ts to generate ai-dependency-graph.json from infra-audit.ts output in scripts/ai-context/artifact-builders/dependency-graph-builder.ts
- [ ] T020 [P] Implement architecture-summary-builder.ts to generate ai-architecture-summary.md from ADRs and layer model in scripts/ai-context/artifact-builders/architecture-summary-builder.ts
- [ ] T021 [P] Implement runtime-map-builder.ts to generate ai-runtime-map.json from docker-compose and service definitions in scripts/ai-context/artifact-builders/runtime-map-builder.ts
- [ ] T022 [P] Implement architecture-brain-builder.ts to aggregate all data and generate ai-architecture-brain.json in scripts/ai-context/artifact-builders/architecture-brain-builder.ts
- [ ] T023 [P] Implement context-mini-builder.ts to generate lightweight ai-context-mini.json for fast loading in scripts/ai-context/artifact-builders/context-mini-builder.ts

### Orchestration & CLI

- [ ] T024 Implement artifact-generator.ts orchestrator to coordinate all builders with concurrency control in scripts/ai-context/artifact-generator.ts
- [ ] T025 Implement change-detector.ts with source hashing and freshness validation logic in scripts/ai-context/change-detector.ts
- [ ] T026 Implement generate-ai-context.ts entry point with CLI argument parsing and error handling in scripts/generate-ai-context.ts

---

## Phase 3: Integration & Testing

**Purpose**: Validate implementation, integrate with existing systems, and establish testing

**Duration**: Week 3-4 (~7 tasks)

**Prerequisite**: Phase 2 complete

### System Integration

- [ ] T027 Integrate generate-ai-context with ai-guard.ts to load ai-architecture-brain.json in scripts/ai-guard.ts
- [ ] T028 Integrate generate-ai-context with infra-audit.ts to trigger and validate consistency in scripts/infra-audit.ts

### Unit & Component Testing

- [ ] T029 [P] Implement unit tests for all artifact builders in tests/validation/ai-context-generation.test.ts with 80%+ code coverage
- [ ] T030 [P] Implement schema validation tests against fixtures in tests/validation/artifact-schema-validation.test.ts

### Integration & Performance Testing

- [ ] T031 Implement integration tests with real sources and actual validation in tests/integration/ai-context-integration.test.ts
- [ ] T032 Implement performance benchmarking tests to verify < 5s generation and < 15MB total size in tests/performance/ai-context-performance.test.ts
- [ ] T033 Execute manual AI tool integration testing (Copilot, GitNexus, SpecKit) and document results in specs/runtime/infra-009-ai-architecture-context/reports/ai-tool-testing.md

---

## Phase 4: Documentation & Deployment

**Purpose**: Document usage, create operational guides, and deploy to production

**Duration**: Week 4 (~3 tasks)

**Prerequisite**: Phase 3 complete

### Documentation Suite

- [ ] T034 Create comprehensive documentation suite including README.md, USER_GUIDE.md, ARTIFACT_REFERENCE.md, INTEGRATION_GUIDE.md, and TROUBLESHOOTING.md in docs/ai/context/ directory

### Operations & Deployment

- [ ] T035 Create runbooks for artifact regeneration, freshness validation, and troubleshooting in docs/ai/context/REFRESH_GUIDE.md
- [ ] T036 Deploy artifacts to production, validate freshness, integrate into CI/CD pipeline, and confirm all consumers can load artifacts successfully

---

## Implementation Strategy

### MVP Scope (Week 1-2)

Focus on essential functionality:

- ✅ Phase 0: Complete research
- ✅ Phase 1: Complete type design
- ✅ Phase 2: Implement core builders (T017-T023, T024-T026)
- ✅ Phase 3: Unit tests and integration with ai-guard

**Deliverables**: Functional artifacts integrated with ai-guard.ts

### Phase 2 Expansion (Week 3)

Add advanced features:

- ✅ Change detection (T025)
- ✅ Full CI integration (GitHub Actions)
- ✅ Pre-commit hook integration
- ✅ Performance optimization

**Deliverables**: Automated artifact regeneration in pre-commit and CI

### Phase 3 Completion (Week 4)

- ✅ Complete test coverage
- ✅ AI tool integration (all 4 tools)
- ✅ Performance benchmarking
- ✅ Manual validation

**Deliverables**: Production-ready context layer with full testing

### Phase 4 Release (Week 4)

- ✅ Documentation complete
- ✅ Runbooks and troubleshooting guides
- ✅ Deployment to docs/ai/context/
- ✅ CI/CD integration verified

**Deliverables**: Deployed, documented, and operational

---

## Parallel Execution Opportunities

### Phase 0 Parallelization

Research tasks can be parallelized:

- T001 + T002 + T003 can run in parallel (different source systems)
- T004 + T005 must follow T001-T003

**Parallel group 1**: T001, T002, T003 (2-3 hours each)  
**Sequential group 2**: T004, T005 (1-2 hours each)

### Phase 1 Parallelization

After T006, most design tasks are independent:

- T008, T009, T010, T011, T012 can run in parallel
- T007 (schemas) depends on T006
- T013 should follow T008-T012

**Sequential group 1**: T006  
**Parallel group 2**: T008, T009, T010, T011, T012 (2-3 hours each)  
**Sequential group 3**: T007 (depends on T006), T013 (depends on others)

### Phase 2 Parallelization

All 7 artifact builders can run in parallel after core infrastructure:

**Sequential group 1**: T014, T015, T016 (core setup)  
**Parallel group 2**: T017, T018, T019, T020, T021, T022, T023 (each 3-4 hours)  
**Sequential group 3**: T024, T025, T026 (orchestration, depends on builders)

**Estimated parallel speedup**: 7 builders × 3.5 hours / sequential = ~8.75 hours vs. 24.5 hours serial = 2.8x faster

### Phase 3 Parallelization

All tests can start after implementations:

**Sequential group 1**: T027, T028 (integration)  
**Parallel group 2**: T029, T030, T031, T032 (tests, 2-3 hours each)  
**Sequential group 3**: T033 (manual testing, 2-3 hours)

**Estimated parallel speedup**: 4 test suites in parallel = ~3 hours vs. 8-10 hours serial = 2.7x faster

### Phase 4 Parallelization

Documentation and deployment are mostly sequential:

**Sequential group**: T034, T035, T036 (must follow tests)

---

## Task Dependencies Matrix

| Task | Depends On | Blocking  | Duration | Type     |
| ---- | ---------- | --------- | -------- | -------- |
| T001 | —          | T004-T005 | 1.5h     | Research |
| T002 | —          | T004-T005 | 1.5h     | Research |
| T003 | —          | T004-T005 | 1.5h     | Research |
| T004 | T001-T003  | T005      | 2h       | Design   |
| T005 | T001-T004  | Phase 1   | 1h       | Design   |
| T006 | T005       | T007-T023 | 3h       | Design   |
| T007 | T006       | Phase 2   | 1.5h     | Design   |
| T008 | T005       | T024      | 2h       | Design   |
| T009 | T005       | T025      | 2h       | Design   |
| T010 | T005       | T027-T028 | 2h       | Design   |
| T011 | T005       | Phase 3   | 2h       | Design   |
| T012 | T005       | Phase 2   | 1h       | Design   |
| T013 | T008-T012  | —         | 1h       | Design   |
| T014 | T006       | T023-T024 | 2h       | Impl     |
| T015 | T007       | T023-T024 | 2h       | Impl     |
| T016 | T007       | T014-T023 | 1h       | Impl     |
| T017 | T006-T014  | T023      | 3.5h     | Impl     |
| T018 | T006-T014  | T023      | 3.5h     | Impl     |
| T019 | T006-T014  | T023      | 3.5h     | Impl     |
| T020 | T006-T014  | T023      | 3.5h     | Impl     |
| T021 | T006-T014  | T023      | 3.5h     | Impl     |
| T022 | T006-T014  | T023      | 3.5h     | Impl     |
| T023 | T006-T014  | T024-T026 | 2h       | Impl     |
| T024 | T006-T023  | T026      | 2h       | Impl     |
| T025 | T006-T024  | T026      | 1.5h     | Impl     |
| T026 | T023-T025  | T027-T033 | 1.5h     | Impl     |
| T027 | T026       | —         | 1.5h     | Intg     |
| T028 | T026       | —         | 1.5h     | Intg     |
| T029 | T017-T023  | T033      | 3h       | Test     |
| T030 | T007-T023  | T033      | 2.5h     | Test     |
| T031 | T026-T028  | T033      | 2.5h     | Test     |
| T032 | T026       | T033      | 2h       | Test     |
| T033 | T026-T027  | T034      | 2.5h     | Test     |
| T034 | T033       | T035      | 3h       | Doc      |
| T035 | T034       | T036      | 2h       | Doc      |
| T036 | T034-T035  | —         | 1.5h     | Deploy   |

---

## Quality Checkpoints

### After Phase 0 (Research Complete)

- [ ] All sources documented and validated
- [ ] Data flows mapped end-to-end
- [ ] Artifact pipeline designed
- [ ] No blockers identified for Phase 1

### After Phase 1 (Design Complete)

- [ ] TypeScript types defined and reviewed
- [ ] JSON schemas generated and validated
- [ ] Integration contracts documented
- [ ] CI/CD integration strategy finalized

### After Phase 2 (Implementation Complete)

- [ ] All 7 artifact builders implemented
- [ ] Orchestrator functional with all builders
- [ ] CLI entry point working
- [ ] Change detection mechanism validated
- [ ] Pre-commit hook integration ready

### After Phase 3 (Testing Complete)

- [ ] Unit test coverage > 80%
- [ ] Integration tests passing against real sources
- [ ] Performance benchmarks met (< 5s, < 15MB)
- [ ] All 4 AI tools tested and validated
- [ ] No architectural violations in generated artifacts

### After Phase 4 (Deployment Complete)

- [ ] Documentation complete and reviewed
- [ ] Runbooks tested and validated
- [ ] Artifacts deployed to docs/ai/context/
- [ ] CI validation passing
- [ ] All consumers successfully loading artifacts

---

## Risk Mitigation

| Risk                                        | Impact | Mitigation                                 | Owner      |
| ------------------------------------------- | ------ | ------------------------------------------ | ---------- |
| Source systems change during implementation | Medium | Version source hashes, run T005 early      | T001-T005  |
| infra-audit.ts output format changes        | High   | Lock API contract in T003, frequent sync   | T019, T028 |
| Module boundaries conflict with actual code | Medium | Build automated validation in T031         | T029, T031 |
| AI tool integration expectations differ     | Medium | Test early with each tool in T033          | T010, T033 |
| Performance requirements not met            | Medium | Benchmark early in T032, optimize builders | T032       |
| Schema validation too strict                | Low    | Use Zod for lenient validation option      | T007, T015 |

---

## Success Criteria

### Functional Success

- ✅ All 7 artifacts generate without errors
- ✅ Artifacts validate against JSON schemas
- ✅ Change detection prevents unnecessary regenerations
- ✅ CI/CD integration blocks commits with stale artifacts

### Integration Success

- ✅ ai-guard.ts successfully loads ai-architecture-brain.json
- ✅ infra-audit.ts triggers and validates consistency
- ✅ GitNexus can load and query ai-dependency-graph.json
- ✅ Copilot context includes ai-context-mini.json

### Performance Success

- ✅ Generation completes in < 5 seconds
- ✅ Total artifact size < 15MB
- ✅ ai-context-mini.json < 1MB
- ✅ Schema validation < 100ms

### Documentation Success

- ✅ Each artifact has example and full documentation
- ✅ Integration guide for each AI tool
- ✅ Troubleshooting guide for common issues
- ✅ Runbook for artifact regeneration

---

## Task Execution Recommendations

### Week 1 Priority (Phase 0-1)

1. **Monday-Tuesday**: T001-T005 (research, can parallelize T001-T003)
2. **Wednesday**: T006-T007 (core types and schemas)
3. **Thursday-Friday**: T008-T013 (design specs, parallel work)

### Week 2 Priority (Phase 2 Start)

1. **Monday**: T014-T016 (core infrastructure)
2. **Tuesday-Wednesday**: T017-T023 (builders, highly parallelizable)
3. **Thursday-Friday**: T024-T026 (orchestration, CLI)

### Week 3 Priority (Phase 3)

1. **Monday**: T027-T028 (integrations)
2. **Tuesday-Wednesday**: T029-T032 (testing, parallel execution)
3. **Thursday-Friday**: T033 (manual testing)

### Week 4 Priority (Phase 4)

1. **Monday-Tuesday**: T034 (documentation)
2. **Wednesday**: T035 (runbooks)
3. **Thursday-Friday**: T036 (deployment and validation)

---

## Total Task Summary

**Total Tasks**: 36  
**Setup Tasks**: 0  
**Foundational Tasks**: 0  
**Core Implementation**: 26 tasks (T001-T026)  
**Testing & Integration**: 7 tasks (T027-T033)  
**Documentation & Deployment**: 3 tasks (T034-T036)

**Estimated Total Duration**:

- Serial execution: ~100 hours
- With parallelization: ~35-40 hours
- Calendar time (2-person team): 3-4 weeks

---

## File Structure to Create

```
scripts/
├─ generate-ai-context.ts (entry point, T026)
├─ ai-context/
│  ├─ source-loader.ts (T014)
│  ├─ schema-validator.ts (T015)
│  ├─ artifact-generator.ts (T024)
│  ├─ change-detector.ts (T025)
│  ├─ logging.ts
│  └─ artifact-builders/
│     ├─ module-map-builder.ts (T017)
│     ├─ layer-model-builder.ts (T018)
│     ├─ dependency-graph-builder.ts (T019)
│     ├─ architecture-summary-builder.ts (T020)
│     ├─ runtime-map-builder.ts (T021)
│     ├─ architecture-brain-builder.ts (T022)
│     └─ context-mini-builder.ts (T023)

packages/types/
└─ src/
   └─ ai-context.ts (T006, TypeScript definitions)

docs/ai/context/
├─ README.md (T034)
├─ USER_GUIDE.md (T034)
├─ ARTIFACT_REFERENCE.md (T034)
├─ INTEGRATION_GUIDE.md (T034)
├─ REFRESH_GUIDE.md (T035)
├─ TROUBLESHOOTING.md (T034)
├─ schemas/ (T016)
│  ├─ README.md
│  ├─ ai-module-map.schema.json
│  ├─ ai-layer-model.schema.json
│  ├─ ai-dependency-graph.schema.json
│  ├─ ai-runtime-map.schema.json
│  ├─ ai-architecture-brain.schema.json
│  └─ ai-context-mini.schema.json
└─ examples/
   └─ [artifact examples generated by T034]

tests/
├─ validation/
│  ├─ ai-context-generation.test.ts (T029)
│  └─ artifact-schema-validation.test.ts (T030)
├─ integration/
│  └─ ai-context-integration.test.ts (T031)
└─ performance/
   └─ ai-context-performance.test.ts (T032)

specs/runtime/infra-009-ai-architecture-context/
├─ research.md (T001-T005, T013)
├─ data-model.md (T008-T009, T012)
├─ contracts/
│  ├─ ai-tool-integration.md (T010)
│  └─ ci-integration.md (T011)
└─ reports/
   └─ ai-tool-testing.md (T033)
```
