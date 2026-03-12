# Implementation Plan: Architecture Alignment Migration

**Branch**: `spec/infra-014-architecture-alignment-migration` | **Date**: 2026-03-12 | **Spec**: `/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2/specs/runtime/infra-014-architecture-alignment-migration/spec.md`
**Input**: Feature specification from `/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2/specs/runtime/infra-014-architecture-alignment-migration/spec.md`

**Note**: This plan is compliance-only. It aligns existing repository code and governance artifacts to current Zidney architecture rules without introducing new ADRs, boundary exceptions, or runtime behavior changes.

## Summary

Establish a deterministic full-repository alignment baseline, remediate violations by category, consolidate overlapping governance checks into the canonical toolchain, regenerate architecture intelligence, and finish with zero unresolved violations in scope. The migration may touch multiple modules across `apps/`, `packages/`, `scripts/`, and generated architecture artifacts, but every change must preserve database-per-tenant isolation, authentication and centralized license enforcement order, structured API error responses, server-authoritative attempt behavior, and the current ADR-backed module boundary model.

## Technical Context

**Language/Version**: TypeScript (repo-standard, `typescript@latest`), Bun runtime, Bash automation  
**Primary Dependencies**: Bun, TypeScript, Biome, Vitest, unified architecture guard, `scripts/ai-guard.ts`, `scripts/infra-audit.ts`, `scripts/type-safety-guard.ts`, `scripts/generate-ai-context.ts`, `scripts/validate-architecture-brain.ts`  
**Storage**: Filesystem-based governance artifacts in `docs/architecture/intelligence/`, `docs/ai/context/`, and stage-local planning artifacts; tenant PostgreSQL and Redis flows remain unchanged by this stage  
**Testing**: `bun run lint`, `bun run typecheck`, `bun run validate:types`, `bun run arch:guard:ci`, `bun scripts/infra-audit.ts`, Vitest static/unit/integration suites as needed by touched modules  
**Target Platform**: macOS/Linux developer environments and GitHub Actions Bun CI  
**Project Type**: Monorepo governance and architecture-alignment migration  
**Performance Goals**: Deterministic repository-wide baseline and verification within existing local/CI governance workflows; zero added latency or behavior change to product runtime surfaces  
**Constraints**: Compliance-only scope; no ADR changes; no architecture redesign; no new boundary exceptions; preserve authentication, tenant resolver, and license middleware ordering; preserve the standard `{ success, data, error }` API error contract on touched runtime paths; preserve server-authoritative time; preserve worker-only grading; remove unsafe typing at governed boundaries; consolidate duplicate checks into canonical governance commands  
**Scale/Scope**: Full governed monorepo across `apps/*`, `packages/*`, `scripts/*`, `tests/static`, `docs/architecture/intelligence/`, and `docs/ai/context/`

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Pass: Database-per-tenant isolation remains unchanged; no row-based tenancy, cross-tenant joins, or DB access outside resolver context are introduced.
- Pass: Trust-chain preservation remains explicit; repository-wide remediation cannot weaken authentication, tenant resolution, or structured runtime error handling on touched paths.
- Pass: Centralized middleware authority remains unchanged; the plan does not alter tenant resolution, license enforcement ordering, schema compatibility checks, or workspace-bound route coverage.
- Pass: Snapshot-based attempt integrity and server-authoritative time remain unchanged; the migration is explicitly barred from altering grading, submission, timer, or worker authority semantics.
- Pass: Strict separation of layers is strengthened, not weakened; remediation moves code toward current module boundaries and does not authorize new cross-app or package-to-app imports.
- Pass: Change governance is preserved; the stage remains within current ADR-backed architecture and does not create new architecture decisions.
- Pass with note: Runtime stage status is still `DRAFT` in the runtime spec, but the authoritative phase stage document marks clarifications resolved and planning authorized. This plan stops at research/design and does not implement runtime changes.

## Project Structure

### Documentation (this feature)

```text
specs/runtime/infra-014-architecture-alignment-migration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── alignment-verification-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── api/
├── worker/
├── mmc/
├── backoffice/
└── frontoffice/

packages/
├── domain-core/
├── validation/
├── types/
├── api-client/
├── ui-system/
├── logger/
├── config/
├── redis-utils/
└── job-queue/

scripts/
├── architecture-guard/
├── architecture/
├── ai-context/
├── ai-guard.ts
├── infra-audit.ts
├── type-safety-guard.ts
└── validate-architecture-brain.ts

docs/
├── architecture/
│   ├── intelligence/
│   └── ADR/
└── ai/
    └── context/

tests/
├── static/
├── unit/
└── integration/
```

**Structure Decision**: The migration stays in the existing monorepo structure and resolves violations in place. Shared contracts move only within already-approved package boundaries such as `packages/types`, `packages/validation`, or other existing compliant packages; no new application relationships or architecture layers are introduced.

## Migration Workstreams

### 1. Baseline Detection

- Run a full-scope architecture guard baseline using JSON output to capture rule, severity, source module, location, and remediation hints.
- Run `infra-audit.ts` to detect undeclared modules, dependency graph issues, stale architecture intelligence, and structural drift.
- Run `type-safety-guard.ts --json` to inventory unsafe type escape patterns and exception usage.
- Normalize findings into stage-local reporting grouped by module, rule family, and remediation priority.

### 2. Category-Based Remediation

- Dependency and module boundaries: eliminate cross-app imports, package-to-app imports, runtime-to-UI violations, and UI-to-domain violations by moving code to existing compliant boundaries.
- Circular dependencies: break cycles by extracting contracts to `packages/types`, pushing validation to `packages/validation`, or splitting implementation from interfaces without changing layer direction.
- Unsafe typing and validation: replace `any` escape hatches with explicit types or `unknown` plus schema validation at governed boundaries.
- Exported interface typing: add explicit public types where implicit contracts currently leak ambiguity across modules.
- Legacy script overlap: retire, wrap, or consolidate checks whose responsibilities are already covered by the unified architecture guard, infra audit, or type-safety guard.

### 3. Architecture Intelligence Regeneration

- Refresh dependency and architecture metadata with `scripts/infra-audit.ts` after remediation.
- Regenerate AI context artifacts with `scripts/generate-ai-context.ts --force` so guard and AI consumers share the updated repository state.
- Validate the regenerated brain with `scripts/validate-architecture-brain.ts` before final verification.

### 4. Final Verification

- Run the canonical verification sequence: `bun run lint`, `bun run typecheck`, `bun run validate:types`, `bun run arch:guard:ci`, `bun scripts/infra-audit.ts`, and targeted Vitest suites for touched modules.
- Confirm zero remaining architecture-alignment violations in scope and no regressions to authentication flow, tenant-bound routing, license middleware ordering, structured API error responses, or server-authoritative runtime flows.
- Record final outputs in stage-local reporting so closure evidence matches the canonical governance toolchain.

## Risks And Mitigations

- Risk: A violation can be fixed in multiple ways and one option would weaken current boundaries.
  Mitigation: Prefer existing ADR-backed paths only, using `packages/types`, `packages/validation`, or existing runtime APIs rather than introducing exceptions.
- Risk: Legacy support or generated files produce findings outside the canonical module graph.
  Mitigation: Classify them separately, fix only when they affect governed scope, and avoid mutating generated architecture outputs by hand.
- Risk: Duplicate or partially overlapping scripts create conflicting signals.
  Mitigation: Treat unified architecture guard, infra audit, type-safety guard, and validated AI context generation as canonical; legacy checks must become wrappers or be retired.
- Risk: Repository-wide remediation on API-adjacent code could accidentally drift from the standard response envelope or authentication sequence.
  Mitigation: Treat structured error responses and trust-chain ordering as blocking verification criteria for any touched runtime surface.
- Risk: Architecture intelligence refresh produces false drift because artifacts are stale or malformed.
  Mitigation: Regenerate in canonical order and always validate the architecture brain before using the artifacts as final evidence.

## Post-Design Constitution Re-Check

- Pass: Design remains compliance-only and does not add new runtime behavior, tenancy semantics, or middleware bypasses.
- Pass: Boundary fixes are constrained to existing approved modules and package roles.
- Pass: Type remediation uses explicit types and validation rather than relaxed enforcement.
- Pass: Canonical verification relies on existing governance tooling instead of parallel rule systems.

## Complexity Tracking

No constitution violations or justified complexity exceptions were identified in planning.
