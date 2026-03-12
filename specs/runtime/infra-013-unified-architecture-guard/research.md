# Phase 0 Research - Unified Architecture Guard

## Decision 1: Validation Modes and Fallback Strategy

Decision: Support two canonical modes in the unified guard runner: strict full-repository validation for CI and changed-files validation for pre-push workflows, with deterministic fallback to full scan when incremental preconditions are not satisfied.

Rationale:

- Existing governance already differentiates full and incremental behavior in `scripts/ai-guard.ts`.
- Incremental scan requires stable mapping inputs (architecture map and dependency graph).
- Full-scan fallback is already used for map changes, new module detection, and missing/stale/corrupt dependency graph states.
- Deterministic fallback keeps safety and avoids silent under-validation.

Alternatives considered:

- Incremental-only validation: rejected because it can miss violations when dependency context is incomplete.
- Full-only validation: rejected because it degrades developer feedback loops and pre-push adoption.

## Decision 2: Rule Orchestration Model

Decision: Orchestrate rule checks through a single runner that executes independent rule modules and aggregates violations in deterministic order: dependency boundaries, layer boundaries, cross-app imports, relative-leak checks, circular dependency checks, and type-safety checks.

Rationale:

- Current checks are distributed across `scripts/ai-guard.ts`, `scripts/type-safety-guard.ts`, and related static checks.
- A modular runner preserves rule independence and allows consistent output/reporting while reducing duplicated scan logic.
- Deterministic ordering makes CI output stable and testable.

Alternatives considered:

- Keep fragmented scripts and only wrap shell commands: rejected because it limits structured aggregation and increases output inconsistency.
- Merge all logic into one monolithic file: rejected because it hurts maintainability and rule-level extensibility.

## Decision 3: Reporting Output Contract

Decision: Define a structured JSON report as the canonical machine format with these required fields: run metadata, validation mode, fallback reason, modules validated/skipped, rule violations, and verdict; human-readable text remains supported as a convenience projection.

Rationale:

- Existing AI guard already emits JSON report fields in output mode.
- Structured output is required by spec FR-008 for rule, location/module, and remediation direction.
- JSON contract enables stable CI parsing and future dashboard/report automation.

Alternatives considered:

- Text-only output: rejected because it is brittle for automation.
- Markdown-only output: rejected because it is human-friendly but not robust for machine consumption.

## Decision 4: Boundary and Governance Scope

Decision: Keep stage strictly infrastructure governance scoped with no runtime behavior changes to tenant resolution, license middleware behavior, attempt lifecycle, grading, or UI runtime flows.

Rationale:

- Stage definition and spec explicitly mark runtime behavior as out-of-scope.
- Constitution and project primer make these runtime paths non-negotiable.
- Guarding architecture and code policy can be achieved without business-logic mutation.

Alternatives considered:

- Folding runtime checks into route/worker logic: rejected because it creates scope drift and stage lifecycle violation risk.

## Decision 5: Architecture Context Generation

Decision: Keep architecture context generation as a first-class step in unified governance flow, relying on existing producers (`scripts/infra-audit.ts`, `scripts/generate-ai-context.ts`) and validation (`scripts/validate-architecture-brain.ts`).

Rationale:

- Existing scripts already generate and validate architecture context artifacts used by AI/governance tools.
- Up-to-date context lowers false positives/negatives in architecture checks and AI guidance.
- Regeneration-on-demand with validation protects against stale or malformed context.

Alternatives considered:

- Manual context maintenance: rejected because it is error-prone and conflicts with governance automation.
- Generating only a subset of artifacts: rejected because consumers depend on multiple context files.

## Decision 6: Changed-Files Baseline Resilience

Decision: Use changed-files inputs from staged diff/context where available, and define explicit fallback behavior when baseline or mapping dependencies are unavailable.

Rationale:

- Existing incremental guard behavior already handles missing/stale graph and module-map anomalies by full-scan fallback.
- Spec edge case requires deterministic behavior when diff baseline is unavailable.

Alternatives considered:

- Fail hard on baseline missing: rejected because it blocks developers unnecessarily when safe full scan is available.

## Clarification Resolution Status

All Technical Context unknowns are resolved for planning. No `NEEDS CLARIFICATION` items remain.
