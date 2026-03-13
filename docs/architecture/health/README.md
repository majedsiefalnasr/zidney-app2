# Architecture Health

This directory contains the generated outputs and operator guidance for the architecture health scanner.

## Commands

- `bun run arch:health`: Runs the repository-scoped scanner, validates the report schema, and writes the current JSON and Markdown artifacts.
- `bun run arch:health:ci`: Runs the same scanner in CI mode with the immutable governance threshold policy.
- `bun scripts/architecture-health/architecture-health.ts --output json|markdown|text`: Emits the requested representation to stdout without persisting artifacts.
- `bun scripts/architecture-health/benchmark.ts --runs 20 [--ci]`: Executes the benchmark harness used to verify p95 performance budgets.

## Governance Rules

- CI uses an immutable threshold policy of `80`; caller-supplied lower thresholds are ignored in CI mode.
- Pull request, push, and nightly runs must publish the generated health artifacts for reviewer inspection.
- Same-state reruns must not create duplicate history snapshots.
- GitNexus enrichment findings must be surfaced explicitly when enrichment fails or is unavailable.

## Performance Budgets

- Local compliant assessments must meet a p95 budget of `<= 90s`.
- CI compliant assessments must meet a p95 budget of `<= 120s`.
- The benchmark harness for these budgets must execute at least `20` compliant runs per environment.

## Artifacts

- `architecture-health.json`: Schema-validated machine-readable report.
- `architecture-health-summary.md`: Human-readable summary.
- `architecture-drift-report.md`: Drift and synchronization findings summary.
- `history/`: Timestamped history snapshots for newly observed assessment states.
