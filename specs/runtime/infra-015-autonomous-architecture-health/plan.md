# Implementation Plan: Autonomous Architecture Health

**Branch**: `spec/infra-015-autonomous-architecture-health` | **Date**: 2026-03-12 | **Spec**: `/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2/specs/runtime/infra-015-autonomous-architecture-health/spec.md`
**Input**: Feature specification from `/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2/specs/runtime/infra-015-autonomous-architecture-health/spec.md`

**Note**: This plan is governance-only. It strengthens observability of existing architecture controls by composing the current guard, audit, existing AI-context artifacts, and type-safety stack into one scored health assessment, with optional context refresh reserved for remediation follow-up. It does not authorize ADR changes, dependency relaxations, tenant-path redesign, or runtime behavior changes.

## Summary

Implement a small architecture-health orchestration layer under `scripts/architecture-health/` that first assesses the current repository state, normalizes existing governance outputs into a single assessment model, deduplicates overlapping findings, computes a weighted health score, and writes deterministic JSON and Markdown reports under `docs/architecture/health/`. The implementation stays within infra-governance and observability: it reuses `arch:guard`, `bun scripts/infra-audit.ts --quick`, `type-safety-guard`, current AI-context artifacts, and architecture-brain validation instead of introducing a parallel rule engine, while keeping full AI-context refresh as an explicit remediation option rather than a default assessment step. CI uses one locked threshold policy, publishes generated reports as artifacts, and includes nightly scheduled monitoring for longitudinal trend visibility.

## Stage Alignment

- Phase: 01_PLATFORM_FOUNDATION
- Stage: STAGE_INFRA_15_AUTONOMOUS_ARCHITECTURE_HEALTH
- Related Spec File: `specs/runtime/infra-015-autonomous-architecture-health/spec.md`
- Related ADR: ADR-0001, ADR-0006, ADR-0007, ADR-0008, ADR-0009

## Architectural Scope Confirmation

- Confirmed: No cross-tenant data access
- Confirmed: No middleware bypass
- Confirmed: No direct DB instantiation
- Confirmed: No grading logic outside Worker
- Confirmed: No weakening of snapshot integrity
- Confirmed: No weakening of version enforcement
- Confirmed: No layer boundary violation

## Technical Context

**Language/Version**: TypeScript (`typescript@latest`), Bun runtime, Bash automation  
**Primary Dependencies**: Bun CLI, Node `child_process` and `fs` APIs, `scripts/architecture-guard/architecture-guard.ts`, `scripts/infra-audit.ts`, `scripts/type-safety-guard.ts`, `scripts/generate-ai-context.ts`, `scripts/validate-architecture-brain.ts`  
**Storage**: Filesystem-only governance artifacts in `docs/architecture/health/`, `docs/architecture/intelligence/`, and `docs/ai/context/`; no database writes and no direct DB instantiation  
**Testing**: `bun run arch:guard:ci`, `bun run arch:audit`, `bun type-safety-guard --json`, `bun run ai:context:refresh`, `bun run arch:validate:brain`, `bun run lint`, `bun run validate:types`, plus focused Vitest coverage for score calculation, finding deduplication, stale-artifact detection, and report serialization  
**Target Platform**: macOS/Linux developer environments and GitHub Actions Bun CI  
**Project Type**: Monorepo governance CLI and report generation workflow  
**Performance Goals**: Deterministic full-repository health assessment with stable output ordering for CI diffing, zero runtime impact on tenant-facing flows, local compliant runs completing within 90 seconds at the 95th percentile, and CI compliant runs completing within 120 seconds at the 95th percentile  
**Constraints**: No architecture redesign; no cross-tenant logic; no direct DB instantiation; all persistent writes must be atomic and recoverable; server-authoritative time only; version compatibility guarantees remain unchanged; reuse existing guard and audit sources of truth instead of inventing duplicate checks  
**Scale/Scope**: Repository-wide assessment across `apps/*`, `packages/*`, `scripts/*`, `docs/architecture/intelligence/`, `docs/architecture/module-boundaries.json`, and `docs/ai/context/`

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Pass: Database-per-tenant isolation remains unchanged. The stage is repository-scoped governance only and introduces no tenant DB access, no cross-tenant joins, and no workspace-resolution bypasses.
- Pass: Middleware authority is preserved. The plan does not modify tenant resolution, license enforcement, schema compatibility, or product compatibility middleware ordering.
- Pass: Version compatibility remains intact. Health monitoring reads governance artifacts and validation outputs only; it does not weaken schema or product version enforcement.
- Pass: Server-authoritative time remains intact. The design relies on repository execution time and CI scheduling only; no client-side time source is introduced.
- Pass: Attempt integrity and worker authority remain intact. No grading, submission, attempt snapshot, or worker business logic changes are introduced.
- Pass: Transaction and idempotency requirements are preserved. The stage should avoid database persistence; any report writes are atomic filesystem replacements so repeated runs do not create duplicate or partial governance state.
- Pass: Layer boundaries are reinforced rather than relaxed. Existing architecture contracts remain authoritative and the scanner composes current rules instead of redefining them.
- Pass with note: The stage file remains `DRAFT`, but its constitutional notes explicitly authorize planning. Implementation and task execution must remain limited to this governance-only scope and must stop if ADR or architecture-map changes become necessary.

## Project Structure

### Documentation (this feature)

```text
specs/runtime/infra-015-autonomous-architecture-health/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── architecture-health-cli-contract.md
│   └── architecture-health-report.schema.json
└── tasks.md
```

### Source Code (repository root)

```text
scripts/
├── architecture-health/
│   ├── architecture-health.ts
│   ├── score-model.ts
│   ├── finding-normalizer.ts
│   └── report-writer.ts
├── architecture-guard/
├── ai-guard.ts
├── infra-audit.ts
├── type-safety-guard.ts
├── generate-ai-context.ts
└── validate-architecture-brain.ts

docs/
├── architecture/
│   ├── health/
│   │   ├── architecture-health.json
│   │   ├── architecture-health-summary.md
│   │   └── architecture-drift-report.md
│   │   └── history/
│   └── intelligence/
└── ai/
    └── context/

tests/
├── unit/
│   └── architecture-health/
└── static/
```

**Structure Decision**: Keep all implementation inside existing governance surfaces. The only new code lives under `scripts/architecture-health/` plus tests and generated docs. No new `apps/*` or `packages/*` modules are introduced, so no architecture-map expansion or ADR work is planned.

## Implementation Workstreams

### 1. Signal Orchestration

- Add a scanner entrypoint that executes the canonical governance stack in deterministic order.
- Consume existing outputs instead of copying rule logic: dependency, layer, and drift signals from architecture guard plus `bun scripts/infra-audit.ts --quick`, type-safety from `type-safety-guard`, and intelligence synchronization from pre-refresh inspection of current AI-context artifacts plus brain validation.
- Keep all execution repository-scoped and read-only except for generated report artifacts.
- Evaluate synchronization health against the current repository artifact state before any optional refresh step so stale, missing, or partially regenerated intelligence remains reportable instead of being normalized away.
- Enforce source execution through an allowlisted non-shell command runner with explicit per-tool timeout budgets and structured command telemetry.

### 2. Finding Normalization And Score Calculation

- Introduce a normalized in-memory model for signals, findings, thresholds, and report metadata.
- Fingerprint overlapping findings so the same underlying issue is not penalized twice across tools.
- Apply the approved weighted score model from the stage spec with a deterministic overall verdict model (`PASS` or `BLOCKED`) and signal-level statuses (`PASS`, `WARN`, `FAIL`).
- Distinguish direct rule violations from drift and synchronization findings so remediation priority remains explicit.
- Encode threshold policy details and artifact-level synchronization evidence in the JSON report so CI and reviewers can audit why a run passed or blocked.

### 3. Artifact Generation And Atomic Writes

- Write `architecture-health.json`, `architecture-health-summary.md`, and `architecture-drift-report.md` under `docs/architecture/health/`.
- Write timestamped historical snapshots under `docs/architecture/health/history/` using the same JSON schema so architecture evolution can be reviewed across nightly, push, and pull-request assessments, while retaining `assessment_id` inside each snapshot for state correlation. Same-state reruns must not create duplicate history files; the writer should create a timestamped snapshot only when a newly observed `assessment_id` differs from the latest persisted state.
- Use temp-file plus atomic rename semantics so every write is recoverable and reruns remain idempotent.
- Include generation timestamps, source command metadata, threshold values, and remediation hints in the output contract.

### 4. CI And Command Surface

- Add `arch:health` and `arch:health:ci` scripts in `package.json` that wrap the new scanner without introducing any HTTP or runtime-facing surface.
- Add a GitHub workflow step or dedicated workflow that runs the health scanner after the baseline governance commands on pull requests, pushes to `main`, and a nightly schedule, and publishes the generated report artifacts for review.
- Fail CI when score falls below the approved immutable threshold policy or when critical synchronization checks fail.
- Preserve the existing `arch:` family naming convention and keep health monitoring downstream of the current contracts instead of upstream of them.
- Require GitNexus enrichment as part of every scanner run: check repository index freshness first, run `gitnexus query` and `gitnexus impact` when the index is fresh, and record an explicit enrichment finding plus remediation (`npx gitnexus analyze`) when the index is stale or unavailable. These GitNexus commands are part of the same allowlisted, timeout-governed command surface as the core governance commands.
- Keep default baseline evaluation read-safe by using `infra-audit --quick`; reserve full `arch:audit` and `ai-context:refresh` for explicit remediation or CI refresh flows.
- Keep the CI wrapper threshold immutable at the policy level; exploratory local runs may inspect alternative thresholds, but governance progression may not use caller-supplied threshold overrides.

### 5. Test And Verification Strategy

- Add unit tests for score weighting, threshold evaluation, finding deduplication, and report serialization.
- Add static or integration-style tests for stale or missing AI-context artifacts, undeclared-module drift reporting, immutable CI threshold behavior, nightly artifact publication, non-duplicating history snapshots, and scanner performance budgets.
- Verify p95 performance using a benchmark harness that executes at least 20 compliant assessment runs in local and CI environments, then computes p95 from emitted duration telemetry.
- Verify the final pipeline with: `bun run arch:guard:ci`, `bun run arch:audit`, `bun type-safety-guard --json`, `bun run ai:context:refresh`, `bun run arch:validate:brain`, `bun run lint`, and `bun run validate:types`.

## Implementation Layers

API Layer

- Routes introduced: None
- Middleware used: None; this stage is repository-scoped CLI/reporting only
- Validation package usage: JSON schema validation for generated reports
- Transaction boundaries: N/A for runtime APIs

Worker Layer (if applicable)

- Queue name: None
- Idempotency mechanism: Filesystem overwrite-by-replacement, deterministic assessment IDs, and history writes only for newly observed assessment states
- Transaction usage: N/A for worker queues
- Retry strategy: N/A for worker queues
- DLQ handling: N/A

Frontend Layer (if applicable)

- API consumption only: N/A
- No business logic: N/A
- No direct DB assumptions: N/A

MMC / Backoffice Scope (if applicable)

- Commercial authority only: N/A
- No runtime authority: Confirmed

## Database Impact

Master DB

- Tables touched: None
- Migration required? No
- Version bump? No

Tenant DB

- Tables touched: None
- Migration required? No
- schema_version change? No
- product_version compatibility impact? None

Reference: `STAGE_02C_MIGRATION_AND_VERSIONING_MODEL` remains unaffected because this stage is filesystem-only governance.

## Transaction Design

- Transaction required? No database transaction required
- Atomic operations defined? Yes, temp-file plus rename for report writes
- Rollback behavior defined? Yes, failed write leaves prior artifact intact
- Isolation level: N/A
- Concurrency protection mechanism: deterministic filenames for current artifacts plus timestamped history filenames and atomic rename semantics to avoid overwrite races

## Idempotency Plan

- Idempotency key header used? N/A
- Unique constraint used? N/A
- Replay-safe? Yes, repeated runs overwrite current artifacts deterministically; timestamped history is appended only for newly observed assessment states while `assessment_id` keeps same-state runs correlatable
- Duplicate submission safe? Yes, repeated CLI execution yields deterministic current-state outputs and does not create duplicate history files for the same assessment state
- Worker deduplication strategy? N/A

## Version Enforcement Strategy

- Where schema_version validated: generated JSON report against `architecture-health-report.schema.json`
- Where product_version validated: N/A for runtime requests; existing platform compatibility rules remain unchanged
- What happens on mismatch: report generation blocks with `BLOCKED` verdict if report schema or intelligence validation fails
- Backward compatibility strategy: historical snapshots use explicit `schema_version` so readers can branch on report version safely

## Authoritative Time Handling

- Server clock used? Yes, scanner execution time stamps `generated_at` and history filenames
- Expiration validation? N/A
- Soft lock enforcement? N/A
- Deadline enforcement? N/A
- Reconnection grace logic? N/A

## Observability & Logging

- Structured log format: scanner emits structured JSON-compatible records for source command metadata, timeout budgets, elapsed durations, and artifact publication metadata
- request_id propagation: N/A for CLI execution
- workspace_slug propagation: N/A because this stage is not tenant-bound
- attempt_id propagation: N/A
- Error contract adherence: findings and verdict contract are deterministic and schema-validated
- Metrics emitted: architecture score, signal counts, blocking finding counts, synchronization status, command durations, local or CI budget compliance, and historical snapshot timestamps

## Rate Limiting

- Endpoint classification: N/A
- Rate limit thresholds: N/A
- Abuse mitigation: N/A
- Worker queue protection: N/A

## Failure Modes

- DB unavailable: No effect; stage does not access DBs
- Version mismatch: report schema or intelligence validation failure yields `BLOCKED`
- License blocked: No effect; stage does not execute workspace-bound routes
- Worker failure: N/A
- Duplicate request: repeat CLI execution is idempotent and preserves current artifact consistency
- Timeout: source command timeout becomes a finding and may yield `BLOCKED`; per-tool timeout budgets are fixed in the allowlisted command runner
- Queue backlog: N/A
- Partial transaction failure: atomic write failure preserves the previous artifact set and records the failure in command output

## Security Review

- RBAC enforcement server-side: N/A; no server routes introduced
- No role checks in frontend: Confirmed
- No secrets exposed: Confirmed
- JWT workspace scope enforced: N/A
- No sensitive data in logs: Confirmed

## Rollback Strategy

- How feature can be safely rolled back: remove the scanner entrypoint, workflow integration, and generated docs without touching runtime systems
- Migration rollback plan: N/A because no schema changes are introduced
- Feature flag: Not required; the feature is invoked by CLI/CI only
- Data integrity preservation: current artifacts are overwritten atomically and timestamped history snapshots preserve each approved run for evolution review without touching runtime systems

## Non-Goals

- No new HTTP endpoints or runtime-facing interfaces
- No DB persistence or queue-based processing
- No ADR changes or architecture-map redesign
- No tenant-facing dashboards in this stage
- No changes to middleware order, tenant resolution, license enforcement, or attempt execution

## Risks And Mitigations

- Risk: The scanner drifts into a parallel rule system.  
  Mitigation: Treat current governance scripts as canonical producers and restrict the new layer to orchestration, normalization, and reporting.
- Risk: The same violation appears in multiple source tools and unfairly lowers the score twice.  
  Mitigation: Use finding fingerprints keyed by signal family, governed surface, and remediation target before scoring.
- Risk: Stale AI-context artifacts create false positives or false negatives.  
  Mitigation: Capture synchronization findings against the pre-refresh artifact state first, then optionally run refresh and validation to enrich remediation output without erasing the original finding.
- Risk: Report generation leaves partial files on interrupted runs.  
  Mitigation: Use atomic writes and overwrite-by-replacement semantics only.
- Risk: CI health gating becomes flaky because ordering, timeouts, or output changes across runs.  
  Mitigation: Keep deterministic signal ordering, an immutable governance threshold policy, allowlisted command execution with fixed timeout budgets, and a stable JSON schema.

## Post-Design Constitution Re-Check

- Pass: Design remains within infra-governance and observability only.
- Pass: No new module, package, tenancy, runtime, or attempt-processing architecture is introduced.
- Pass: All persistent writes remain filesystem-only and are planned as atomic replacements.
- Pass: Existing guard, audit, and AI-context artifacts remain the authoritative sources of truth.
- Pass: No ADR change, architecture-map redesign, or dependency exception is required by the proposed plan.

## Complexity Tracking

No constitution violations or justified complexity exceptions were identified during planning.

## Final Compliance Statement

Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.
