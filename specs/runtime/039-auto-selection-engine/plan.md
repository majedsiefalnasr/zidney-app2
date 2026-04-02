# Implementation Plan: Auto Selection Engine

## Stage Alignment

- Phase: 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE
- Stage: STAGE_39_AUTO_SELECTION_ENGINE
- Related Spec File: specs/runtime/039-auto-selection-engine/spec.md
- Related Stage Source: specs/phases/03_BACKOFFICE_CORE/04_EXAM_ENGINE_CORE/STAGE_39_AUTO_SELECTION_ENGINE.md
- Related ADRs: ADR-0001, ADR-0002, ADR-0006, ADR-0007, ADR-0008, ADR-0009

## Technical Context

| Context Item        | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| Runtime             | Bun + Hono API, worker-backed finalization                                 |
| Core Packages       | packages/domain-core, packages/validation, packages/types, packages/logger |
| API Surfaces        | Attempt start flow and MCQ exam configuration validation paths             |
| Tenant Data         | attempts, mcq_exams, mcq_exam_auto_criteria, attempt_questions             |
| Performance Targets | P95 valid attempt-start selection <= 200 ms, 500 concurrent starts         |
| Determinism Target  | Seeded replay returns identical set when seed and pool are unchanged       |
| Unknowns            | NEEDS CLARIFICATION: none                                                  |

## Constitution Check (Pre-Design)

- PASS: Database-per-tenant isolation preserved. No master DB writes required.
- PASS: Trust chain preserved (Isolation -> License -> Authentication -> Attempt -> Runtime -> Frontoffice).
- PASS: Snapshot immutability maintained via attempt start freeze contract.
- PASS: Server-authoritative time retained for attempt windows and deadlines.
- PASS: Import boundaries respected (apps to packages only, no cross-app imports).
- PASS: Error contract remains unified with success/data/error envelope.

## Architectural Scope Confirmation

- No cross-tenant data access: all selection queries execute against resolved tenant DB context only.
- No middleware bypass: tenant resolver and license middleware remain parent-route authority.
- No direct DB instantiation: route handlers consume injected db context.
- No grading in API: selection only prepares immutable attempt snapshot; grading remains worker authority.
- No version-rule weakening: schema/product compatibility checks remain pre-handler guardrails.
- No client-authoritative time: selection and eligibility windows use server UTC only.

## Trust Chain Verification

- [x] Isolation: workspace-scoped DB context enforced
- [x] License: enforced before workspace route execution
- [x] Authentication: JWT/RBAC at route layer
- [x] Attempt: selection + snapshot freeze at start, one transaction
- [x] Runtime: server time and deterministic seed authority
- [x] Frontoffice: no business-rule migration into UI

## Import Boundary Compliance

| Import Direction         | Decision              |
| ------------------------ | --------------------- |
| apps/_ -> packages/_     | Allowed and used      |
| packages/_ -> packages/_ | Allowed and used      |
| apps/_ -> other apps/_   | Forbidden and avoided |
| packages/_ -> apps/_     | Forbidden and avoided |
| UI -> DB schemas         | Forbidden and avoided |

## Phase 0 Output: Research

Research complete in specs/runtime/039-auto-selection-engine/research.md.

Resolved design questions:

1. Deterministic selection algorithm: ordered candidate ID fetch plus seeded Fisher-Yates shuffle in domain-core.
2. Overlap safety strategy: pre-publish pessimistic overlap guard and runtime uniqueness reconciliation.
3. Concurrency strategy: single transaction with deterministic seed generation and duplicate-preventing unique constraints.
4. Persistence strategy: immutable attempt snapshot plus explicit selection diagnostics.
5. Observability strategy: structured diagnostic events with correlation and workspace context.

## Phase 1 Output: Design and Contracts

### Data Model Artifacts

- specs/runtime/039-auto-selection-engine/data-model.md

### Contracts Artifacts

- specs/runtime/039-auto-selection-engine/contracts/attempt-start-auto-selection.md
- specs/runtime/039-auto-selection-engine/contracts/auto-criteria-validation.md

### Quickstart Artifact

- specs/runtime/039-auto-selection-engine/quickstart.md

## Implementation Layers

### API Layer

- Extend attempt-start flow to invoke deterministic auto-selection once for AUTOMATIC/hybrid exams.
- Keep middleware order unchanged: correlation -> tenant resolver -> license -> version guards -> auth -> handlers.
- Use packages/validation schemas for criteria integrity and publish guards.
- Perform attempt row creation and selected-question persistence atomically.

### Domain Layer (packages/domain-core)

- Add auto-selection module (pure functions + orchestration service):
  - eligible pool resolution
  - stable ordered candidate ID retrieval contract
  - deterministic seed derivation
  - seeded shuffle and slice
  - uniqueness merge across criteria/manual IDs
  - structured failure taxonomy
- Keep framework-agnostic and HTTP-free.

### Worker Layer

- No grading behavior change in Stage 39.
- Worker consumes frozen snapshot and selected questions exactly as persisted.

### Frontend / Backoffice Layer

- No runtime-authority logic in UI.
- Backoffice only submits configuration data and receives validation errors.

## Database Impact

Master DB:

- Tables touched: none
- Migration required: No
- Version bump: No

Tenant DB:

- Tables touched:
  - attempts (selection seed, candidate-pool fingerprint, and selection diagnostics persistence support)
  - mcq_exam_auto_criteria (count-mode and filter extensibility)
  - attempt_questions (immutable selected-question persistence table introduced/normalized by Stage 39 additive migration)
  - attempt_start_idempotency_claims (tenant-scoped idempotency claim and replay payload hash)
- Migration required: Yes (forward-only, Stage 02C model)
- Schema version change: Yes (minor bump, additive only)
- product_version compatibility impact: backward-compatible additive changes only
- Required filter-support indexes: subject/workflow/visibility plus lesson/category/category_value/tag/basket dimensions must be present and migration-verified.

## Transaction Design

Attempt start (mutating):

- Transaction required: Yes
- Atomic operations:
  - validate eligibility and criteria consistency
  - generate deterministic seed
  - resolve candidates and select final IDs
  - insert attempt row with immutable snapshot payload
  - insert attempt_questions rows ordered and deduplicated
- Rollback behavior: any insufficiency/constraint failure aborts entire start flow
- Isolation level: default REPEATABLE READ; escalate to SERIALIZABLE when replay mismatch or duplicate-conflict telemetry appears in staging/perf validation.
- Concurrency protection:
  - unique(attempt_id, question_id) on attempt_questions
  - existing attempt single-attempt guard constraints
  - mandatory advisory lock on tenant+exam+user attempt-start key with post-lock eligibility revalidation

Criteria configuration publish/save (mutating):

- Transaction required: Yes
- Atomic operations: validate criteria totals and overlap-risk checks before writing status changes
- Rollback behavior: validation failure aborts publish/save
- Isolation level: READ COMMITTED with deterministic validation query ordering

## Idempotency Plan

- Attempt submission idempotency remains existing submission_idempotency_keys contract.
- Attempt start replay safety:
  - require `Idempotency-Key` per attempt-start mutation request
  - atomically claim `(workspace_slug, user_id, exam_id, idempotency_key)` before side effects
  - persist payload hash and response reference in claim store
  - same key + same request payload returns the original successful response (same `attempt_id`)
  - same key + different request payload returns conflict (`ATTEMPT_START_IDEMPOTENCY_CONFLICT`)
  - claim and attempt persistence are transaction-coupled to prevent check-then-act races
  - no partial question persistence allowed
- Worker dedup strategy unchanged.

## Version Enforcement Strategy

- schema_version and product_version checks remain middleware-level before handler execution.
- On mismatch, request is rejected with 426.
- Changes are additive to preserve minor-version compatibility.

## Authoritative Time Handling

- Server clock only for attempt start timestamps and eligibility windows.
- Scheduled constraints and timeout checks remain server-authoritative.
- No client timestamp accepted for selection, cutoffs, or replay diagnostics.

## Error Contract

All API responses remain:

{ success: boolean, data: object | null, error: { code: string, message: string } | null }

Planned new error codes (selection domain):

- AUTO_SELECTION_INSUFFICIENT_POOL
- AUTO_SELECTION_INVALID_CRITERIA
- AUTO_SELECTION_OVERLAP_UNDERSIZED
- AUTO_SELECTION_DUPLICATE_CONFLICT
- AUTO_SELECTION_SELECTION_ABORTED
- ATTEMPT_START_IDEMPOTENCY_CONFLICT

## Observability and Logging

- Structured logging only through shared logger package.
- Required fields for selection events:
  - request_id (correlation_id alias accepted)
  - correlation_id
  - workspace_slug
  - exam_id
  - attempt_id (once allocated)
  - selection_seed
  - criteria_block_count
  - pool_sizes per criteria
  - selected_count and duplicate_count
- Metrics:
  - selection_duration_ms
  - selection_failures_total by code
  - selection_replay_mismatch_total

## Rate Limiting

- Endpoint classification:
  - attempt start as sensitive runtime mutation
  - backoffice save/publish as operator mutation
- Preserve ADR-0009 layered rate limits and ensure no bypass on new validation paths.

## Failure Modes and Recovery

- DB unavailable: return structured infra error; no partial attempt row.
- Version mismatch: middleware 426 before business logic.
- License blocked: middleware rejection.
- Candidate insufficiency: deterministic failure with actionable code.
- Duplicate conflict: rollback and conflict response.
- Timeout during selection: rollback and retry-safe failure.
- Partial transaction failure: automatic rollback; no persisted snapshot/question rows.

## Security Review

- RBAC remains server-side only.
- JWT workspace scope remains mandatory.
- No secrets in logs.
- No sensitive payload logging beyond IDs and counts.
- No direct SQL interpolation; parameterized queries only.

## Test Strategy

- Unit tests:
  - deterministic shuffle reproducibility
  - criteria counting and rounding behavior
  - overlap detection and undersized uniqueness guard
- Integration tests:
  - attempt start success path with exact count and no duplicates
  - failure path for insufficient pool
  - hybrid manual+auto uniqueness
  - middleware ordering and 426 mismatch behavior
  - explicit middleware chain order contract for attempt and criteria endpoints
  - criteria save/publish transactional rollback with no partial writes on validation failure
- Isolation tests:
  - tenant context separation for candidate pools
- Concurrency tests:
  - 500 concurrent starts across eligible exams without integrity violations
  - same user+exam race does not produce duplicate in-progress attempts
- Rollback tests:
  - forced DB error produces no attempt_questions rows and no active attempt
  - forced DB error in attempt-start path rolls back idempotency claim and attempt snapshot writes atomically
- Observability contract tests:
  - required structured selection fields are emitted on both success and failure paths
- Replay tests:
  - same seed + same pool yields identical selected IDs

## Rollback Strategy

- Feature rollout guarded behind stage-scoped runtime flag; flag is mandatory for first production rollout and can be removed only after T035/T036 pass criteria are met.
- Additive migrations only; rollback by disabling feature path before data rollback.
- Preserve attempt and snapshot integrity; never delete committed attempt artifacts during rollback.

## Non-Goals

- Materialized candidate cache/index optimization beyond current index-backed queries.
- Replacing existing grading worker logic.
- UI redesign for exam authoring.
- Cross-tenant analytics aggregation changes.

## Architecture Guard Validation

Validation command gate before implementation:

bun run ai:guard && bun run arch:audit && bun run lint && bun run typecheck && bun run test

## Constitution Check (Post-Design)

- PASS: No ADR conflicts introduced.
- PASS: Trust chain order preserved.
- PASS: Snapshot determinism strengthened, not weakened.
- PASS: Tenant isolation and import boundaries remain intact.
- PASS: Runtime authority remains server-side only.

Implementation plan compliant with Zidney Architecture Governance (AGENTS.md + ADRs) — No violations detected.
