# Quickstart - Autonomous Architecture Health

This quickstart describes the intended developer and CI workflow for the stage once implemented. It is limited to infrastructure governance and observability.

## Prerequisites

- Bun installed.
- Repository dependencies installed.
- Current branch checked out for this stage.
- Existing architecture intelligence can be refreshed locally.

## 1) Run the architecture health scanner against the current repository state

Target stage command:

```bash
bun run arch:health
```

Expected behavior:

- Assesses the repository as it currently exists, including stale, missing, or partially regenerated architecture intelligence.
- Uses `bun scripts/infra-audit.ts --quick` for non-writing dependency, layer, and drift collection.
- Produces a single normalized assessment.
- Writes `docs/architecture/health/architecture-health.json`.
- Returns a terminal verdict of `PASS` or `BLOCKED`.

## 2) Refresh canonical architecture intelligence for remediation follow-up

Run the existing governance producers first:

```bash
bun run arch:audit
bun run ai-context:refresh
bun run arch:validate-brain
```

Expected behavior:

- Dependency and architecture metadata are current.
- AI-context artifacts are regenerated from the latest repository state.
- The architecture brain validates before health scoring consumes it.

## 3) Re-run the scanner after remediation or refresh

Target stage command:

```bash
bun run arch:health
```

Expected behavior:

- Re-evaluates the repository after remediation work.
- Confirms whether prior synchronization findings are resolved.

## 4) Review default GitNexus enrichment

Target stage command:

```bash
bun run arch:health
```

Expected behavior:

- Performs a GitNexus freshness check automatically.
- Runs `gitnexus query` and `gitnexus impact` when the index is fresh.
- Records an explicit enrichment finding with remediation guidance when the index is stale or unavailable.

## 5) Generate the human-readable summary

Target stage command:

```bash
bun run arch:health
```

Expected behavior:

- Writes `docs/architecture/health/architecture-health-summary.md` and `docs/architecture/health/architecture-drift-report.md`.
- Includes score, threshold verdict, signal summaries, and remediation guidance.

Optional stdout-only inspection commands:

```bash
bun scripts/architecture-health/architecture-health.ts --output json
bun scripts/architecture-health/architecture-health.ts --output markdown
bun scripts/architecture-health/architecture-health.ts --output text
```

Expected behavior:

- Emit the selected representation to stdout only.
- Do not persist report artifacts in explicit output mode.

## 6) Enforce the CI threshold

Target stage command:

```bash
bun scripts/architecture-health/architecture-health.ts --ci --threshold 80
```

Expected behavior:

- Exits non-zero when score is below threshold.
- Exits non-zero when hard-fail synchronization conditions are present.
- Keeps runtime behavior unchanged because the command only evaluates repository governance state.
- Treats any non-passing governance outcome as `BLOCKED`.

## 7) Review drift, synchronization, and history findings

Generated artifacts to inspect:

```bash
open docs/architecture/health/architecture-health-summary.md
open docs/architecture/health/architecture-drift-report.md
open docs/architecture/health/history/
```

Expected behavior:

- Direct rule violations remain distinguishable from drift and synchronization findings.
- Missing or stale AI-context artifacts appear as health findings instead of silent pass conditions.
- Historical snapshots accumulate under `docs/architecture/health/history/` for trend review.
- Retries of the same repository state update the same history snapshot key rather than creating duplicates.

## 8) Validate the full governance pipeline

Use the standard verification sequence after implementing the stage:

```bash
bun run arch:guard:ci
bun run arch:audit
bun type-safety-guard --json
bun run ai-context:refresh
bun run arch:validate-brain
bun run lint
bun run validate:types
```

## Scope Guardrails

- Do not add cross-tenant logic or any tenant-scoped persistence to this workflow.
- Do not instantiate PostgreSQL or Redis directly from the health scanner.
- Do not redesign module boundaries, ADR decisions, or dependency direction rules.
- Keep writes limited to atomic report generation under `docs/architecture/health/`.
