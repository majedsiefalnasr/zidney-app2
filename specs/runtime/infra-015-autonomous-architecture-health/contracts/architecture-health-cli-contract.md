# Contract: Architecture Health CLI

## Purpose

Defines the command contract for the autonomous architecture health scanner introduced by this stage.

Canonical entrypoints:

- `bun scripts/architecture-health/architecture-health.ts`
- `bun run arch:health`
- `bun run arch:health:ci`

Baseline dependency/layer/drift collection must use:

```bash
bun scripts/infra-audit.ts --quick
```

Full refresh flows may use:

```bash
bun run arch:audit
bun run ai-context:refresh
```

## Supported Modes

### Standard Assessment Mode

Command:

```bash
bun run arch:health
```

Contract:

- Assesses the repository's current governance state before any optional refresh behavior.
- Uses the current governance artifact set plus non-refresh validation commands required for health evaluation.
- Produces a single assessment with overall score, verdict, signal summaries, and findings.
- Writes report artifacts under `docs/architecture/health/` using atomic replacement.
- Must remain repository-scoped and must not access tenant databases or runtime request context.
- Returns a terminal verdict of `PASS` or `BLOCKED` based on the configured threshold and hard-fail conditions.
- Does not refresh AI-context artifacts unless `--refresh-context` is explicitly supplied.
- Uses `bun scripts/infra-audit.ts --quick` for dependency, layer, and drift signal refresh without writing AI-context artifacts or history by default.
- Performs a GitNexus freshness check on every run. When the index is fresh, it executes `gitnexus query` and `gitnexus impact` to enrich dependency and runtime-flow diagnostics. When the index is stale or unavailable, it records an explicit enrichment finding with remediation guidance (`npx gitnexus analyze`).

### CI Threshold Mode

Command:

```bash
bun run arch:health:ci
```

Contract:

- Uses the same scoring and finding model as standard mode.
- Exits non-zero if the health score is below the approved immutable threshold policy used for governance progression.
- Exits non-zero on hard-fail conditions such as invalid architecture intelligence.
- Must not introduce runtime behavior changes, middleware changes, or architecture-boundary changes.
- Treats any non-passing outcome as `BLOCKED` for governance purposes.
- Ignores or rejects caller-supplied threshold downgrades so governance results cannot be policy-bypassed from the command line.
- Publishes the generated JSON and Markdown health artifacts as CI artifacts when invoked from the governed workflow.

### Explicit Output Mode

Command examples:

```bash
bun scripts/architecture-health/architecture-health.ts --output json
bun scripts/architecture-health/architecture-health.ts --output markdown
bun scripts/architecture-health/architecture-health.ts --output text
```

Contract:

- Emits the selected representation to stdout only.
- `json` mode emits a single report object matching `architecture-health-report.schema.json`.
- `markdown` mode emits a human-readable summary equivalent in content to `architecture-health-summary.md`.
- `text` mode emits a concise terminal summary containing score, verdict, signal counts, and blocking findings.
- Keeps deterministic ordering for signals and findings.
- Includes threshold policy, score, verdict, and remediation metadata appropriate to the selected output format.
- Does not persist report artifacts in this mode; persistent artifact writes are reserved for standard assessment mode and CI threshold mode.

## Inputs

Required:

- none

Optional:

- `--output json|markdown|text`
- `--threshold <0-100>` for exploratory local assessment only; governance CI mode must use the approved immutable policy threshold
- `--ci`
- `--refresh-context` (refresh architecture intelligence only after the baseline synchronization state has been assessed and recorded)
- `--fail-on-sync` (upgrade any non-`CURRENT` intelligence synchronization status to an overall `BLOCKED` verdict even if the score would otherwise pass)

## Exit Codes

- `0`: assessment passed the configured threshold and no hard-fail condition was triggered
- `1`: assessment failed threshold evaluation or encountered a hard-fail governance condition

## Verdict Semantics

- `PASS`: assessment satisfied the configured threshold and no hard-fail governance condition was triggered.
- `BLOCKED`: assessment fell below threshold or encountered a hard-fail governance condition.

## Write Contract

- Persistent writes are limited to generated report artifacts in `docs/architecture/health/`.
- Persistent writes also include timestamped history snapshots in `docs/architecture/health/history/`.
- Writes must use temp-file plus rename semantics so reruns are atomic and idempotent.
- The scanner must not create database state, queue jobs, or tenant-scoped records.
- The scanner must not expose new HTTP endpoints, API routes, or other runtime-facing interfaces as part of this stage.
- Every history snapshot must preserve its execution timestamp for architecture evolution tracking, include `assessment_id` for repository-state correlation, and be created only when the assessment state is newly observed so same-state reruns do not create duplicate persisted artifacts.

## Command Safety Contract

- Source commands must be invoked through an allowlisted argument-vector runner; shell interpolation is forbidden.
- Each governed source command must have an explicit timeout budget recorded in the assessment metadata.
- Timeout or allowlist violations must surface as structured findings and may yield `BLOCKED`.
- The allowlist must cover `gitnexus query` and `gitnexus impact` in addition to the core local governance commands.

## Non-Goals

- No direct DB instantiation.
- No cross-tenant logic or runtime request evaluation.
- No module-boundary redesign, ADR updates, or dependency waivers.
- No tenant-facing UI or product-surface behavior changes.
