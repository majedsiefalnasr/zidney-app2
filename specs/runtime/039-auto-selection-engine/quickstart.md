# Quickstart: Stage 39 Auto Selection Engine

## Purpose

This quickstart validates that Stage 39 planning artifacts are complete and implementation-ready under Zidney governance constraints.

## Prerequisites

- Current branch: spec/039-auto-selection-engine
- Stage spec available: specs/runtime/039-auto-selection-engine/spec.md
- Plan artifacts available:
  - plan.md
  - research.md
  - data-model.md
  - contracts/

## Step 1: Verify Artifact Completeness

Confirm the following files exist:

- specs/runtime/039-auto-selection-engine/plan.md
- specs/runtime/039-auto-selection-engine/research.md
- specs/runtime/039-auto-selection-engine/data-model.md
- specs/runtime/039-auto-selection-engine/contracts/attempt-start-auto-selection.md
- specs/runtime/039-auto-selection-engine/contracts/auto-criteria-validation.md
- specs/runtime/039-auto-selection-engine/quickstart.md

## Step 2: Confirm Governance Alignment

Review plan checklist sections:

- Stage alignment and ADR references
- Trust chain verification
- Import boundary compliance
- Transaction and idempotency strategy
- Version enforcement and authoritative time handling

## Step 3: Validate Technical Decisions Against Spec

Cross-check:

- Deterministic seed and replay behavior (FR-008, SC-003)
- Atomic selection plus attempt persistence (FR-002)
- Duplicate prevention and hybrid mode behavior (FR-007, FR-010)
- Publish-time overlap blocking (FR-014)

## Step 4: Run Governance Gate Before Implementation

Run:

- bun run ai:guard
- bun run arch:audit
- bun run lint
- bun run typecheck
- bun run test

## Step 5: Implementation Entry Points

Planned implementation surfaces:

- packages/domain-core selection orchestration module
- apps/api attempt start flow integration
- packages/validation criteria validation schemas
- apps/api tenant migrations for additive schema support

## Done Criteria

Proceed to tasks/implementation only when:

- all above checks pass
- no unresolved clarification markers remain
- no ADR or architecture contract conflict is detected
