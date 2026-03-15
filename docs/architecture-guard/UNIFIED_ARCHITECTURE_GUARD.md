# Unified Architecture Guard

The unified architecture guard is the deterministic governance entrypoint for architecture and policy checks.

## Commands

- Development mode: bun run arch:guard
- Strict CI mode: bun run arch:guard:ci
- Changed mode: bun run arch:guard:changed
- JSON report output: bun run arch:guard -- --output json

## Rule Order

Rules run in deterministic order:

1. dependency-boundaries
2. circular-dependency
3. non-negotiables
4. type-safety-suppression

## Modes

- development: warnings-first feedback, contract failures still block.
- strict: full governance scan; violations block.
- changed: changed-first scope with deterministic full-scan fallback when map/graph prerequisites are unsafe.

## Fallback Reasons

- map_changed
- new_module_detected
- graph_missing
- graph_stale
- graph_unusable
- full_scope

## Output Contract

JSON output matches the stage schema and includes:

- run_id
- timestamp
- validation_mode
- scope.modules_validated
- scope.modules_skipped
- fallback_reason
- verdict
- violations
- duration_ms

Each violation includes:

- rule
- severity
- message
- location
- source_module
- remediation

## Governance Hooks

Strict and changed flows execute architecture context hooks:

1. bun scripts/generate-ai-context.ts --force
2. bun scripts/governance/validate-architecture-brain.ts

## Scope Guard

This stage is governance-only and does not alter runtime business behavior, tenant data flow, license semantics, or attempt engine behavior.
