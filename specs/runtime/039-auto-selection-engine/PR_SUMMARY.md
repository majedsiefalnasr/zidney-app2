# PR Summary — Stage 39: Auto Selection Engine

Branch: `spec/039-auto-selection-engine`

## Description

Implements the deterministic Auto Selection Engine used during attempt start. The feature covers:

- Deterministic selection per attempt using a stored `random_seed`.
- Idempotent attempt-start semantics with `idempotency_key` support.
- Tenant-safe, additive DB migrations and required indexes.
- Advisory-lock + transactional boundary to ensure single selection per attempt.
- Full observability contract and validation for selection criteria.

## Changes

- Implementation of selection engine logic and integration into attempt-start flow.
- DB migrations and index changes (additive, tenant-scoped).
- Unit and integration test updates and additions.
- Architecture-guard compliant imports and AI-context refresh.

## Files of interest

- `apps/api/src/services/AttemptSelectionService.ts` (core selection logic)
- `apps/api/src/routes/attempt.ts` (attempt-start integration)
- `packages/domain-core/*` (domain additions)
- `specs/runtime/039-auto-selection-engine/*` (specs, plan, tasks, reports)

## Validation Performed

- Biome lint & format: PASS
- TypeScript type-check: PASS
- Unit & integration tests: PASS (local)
- Architecture guard: PASS
- AI/GitNexus context: refreshed & validated
- Local CI (`bun run ci:run-local`): governance jobs passed; some runner-level warnings during simulation

## Review Checklist

- [ ] Run `bun run test:unit` and `bun run test:integration` locally
- [ ] Verify migration SQLs are additive and tenant-scoped
- [ ] Confirm observability fields are present in selection and attempt snapshots
- [ ] Review deployment notes for migration ordering

## How to test locally

Follow `specs/runtime/039-auto-selection-engine/guides/TESTING_GUIDE.md` for commands and manual smoke steps.
