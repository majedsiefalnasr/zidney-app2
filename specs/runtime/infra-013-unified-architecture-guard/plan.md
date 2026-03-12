# Implementation Plan: Unified Architecture Guard

**Branch**: `spec/infra-013-unified-architecture-guard` | **Date**: 2026-03-12 | **Spec**: `/specs/runtime/infra-013-unified-architecture-guard/spec.md`
**Input**: Feature specification from `/specs/runtime/infra-013-unified-architecture-guard/spec.md`

## Summary

Deliver a single, infrastructure-scoped governance entrypoint that orchestrates architecture-boundary, module-boundary, circular-dependency, and type-safety checks with deterministic reporting in strict and changed modes, while generating up-to-date architecture context artifacts for AI/governance consumers, covering FR-009 non-negotiables through static governance checks, and introducing zero runtime business behavior changes.

## Technical Context

**Language/Version**: TypeScript on Bun runtime (repository standard scripts)  
**Primary Dependencies**: Bun CLI, Node fs/path APIs, repository governance scripts (`scripts/ai-guard.ts`, `scripts/type-safety-guard.ts`, `scripts/infra-audit.ts`, `scripts/generate-ai-context.ts`)  
**Storage**: File-system generated artifacts in `docs/architecture/*`, `docs/ai/context/*`, and stage docs under `specs/runtime/infra-013-unified-architecture-guard/`  
**Testing**: Vitest static and unit governance tests, plus command-level validation (`bun scripts/ai-guard.ts`, `bun scripts/infra-audit.ts`, `bun scripts/validate-architecture-brain.ts`)  
**Target Platform**: Monorepo CI and local developer CLI on macOS/Linux  
**Project Type**: Infrastructure governance CLI orchestration and reporting  
**Performance Goals**: Changed mode should validate changed-first impacted scope and complete faster than strict full scan for small diffs; strict mode remains deterministic and complete  
**Constraints**: No tenant data-flow changes, no license/attempt runtime logic changes, no architecture redesign outside this stage scope, preserve import boundary governance rules  
**Scale/Scope**: Repository-wide governance for all `apps/*` and `packages/*` modules with unified output and architecture-context regeneration

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Pre-Phase 0 Gate

- Database-per-tenant isolation: PASS (no DB model or access-path changes planned)
- Middleware authority (tenant/license/schema/version): PASS (no route/middleware mutations in scope)
- Snapshot attempt integrity and worker authority: PASS (no runtime attempt/grading modifications)
- Layer separation and module boundaries: PASS (feature strengthens existing governance)
- Operational integrity and deterministic enforcement: PASS (runner/reporting designed as deterministic)
- Stage lifecycle compliance: PASS (`STAGE_INFRA_13_UNIFIED_ARCHITECTURE_GUARD` is `DRAFT`, planning authorized)

### Post-Phase 1 Re-Check

- No business-runtime behavior changes introduced in design artifacts: PASS
- No cross-layer import exceptions or ADR-breaking redesign introduced: PASS
- Governance artifacts remain infra-scoped and backward-compatible with existing scripts: PASS

## Phase 0 Research Plan

- Confirm validation mode strategy (`strict`, `changed`) and fallback rules from current governance scripts.
- Confirm rule orchestration patterns and structured output schema fields currently emitted by AI guard and type-safety guard.
- Confirm architecture context generation producers/consumers and required artifact set.
- Produce final decisions in `research.md` with rationale and alternatives.

Output: `specs/runtime/infra-013-unified-architecture-guard/research.md`

## Phase 1 Design Plan

- Define governance data model entities for run lifecycle, rule orchestration, violations, and artifact generation outputs.
- Define contracts for:
  - unified guard CLI mode semantics and arguments,
  - violation report JSON schema and deterministic ordering,
  - architecture-context artifact generation expectations.
- Draft quickstart for local and CI usage including strict and changed-files mode and validation pipeline.
- Update agent context with `.specify/scripts/bash/update-agent-context.sh copilot`.

Outputs:

- `specs/runtime/infra-013-unified-architecture-guard/data-model.md`
- `specs/runtime/infra-013-unified-architecture-guard/contracts/`
- `specs/runtime/infra-013-unified-architecture-guard/quickstart.md`

## Project Structure

### Documentation (this feature)

```text
specs/runtime/infra-013-unified-architecture-guard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── architecture-context-contract.md
│   ├── unified-guard-cli-contract.md
│   └── violation-report.schema.json
└── tasks.md
```

### Source Code (repository root)

```text
scripts/
├── ai-guard.ts
├── type-safety-guard.ts
├── infra-audit.ts
├── generate-ai-context.ts
└── architecture-guard/
    ├── architecture-guard.ts
    ├── rules/
    └── utils/

docs/
├── architecture/
│   ├── module-boundaries.json
│   └── intelligence/ARCHITECTURE_MAP.json
└── ai/context/
    ├── ai-architecture-brain.json
    ├── ai-dependency-graph.json
    └── ...

tests/
├── static/
└── unit/
```

**Structure Decision**: Use a governance-only CLI orchestration structure under `scripts/architecture-guard/` plus existing governance scripts and generated architecture context directories; no runtime application module redesign.

## Complexity Tracking

No constitution violations requiring justification are planned.
