# Phase 0 Research - Autonomous Architecture Health

## Decision 1: Build the health scanner as an orchestration layer over existing governance tools

Decision: Implement `scripts/architecture-health/architecture-health.ts` as a thin orchestration layer that captures the current repository state first, then runs and normalizes the existing architecture guard, infra audit, type-safety guard, and architecture-brain validation pipeline, with AI-context refresh available only as an explicit remediation follow-up.

Rationale:

- The repository already has canonical governance sources for dependency, layer, drift, type-safety, and architecture-intelligence integrity.
- Reusing those tools preserves ADR-backed enforcement and avoids a second, diverging rule engine.
- The stage constraints explicitly prefer existing architecture guard, infra-audit, AI context, and governance scripts.

Alternatives considered:

- Writing a standalone scanner with new rule logic: rejected because it would duplicate governance rules and increase drift risk.
- Using only one existing script as the health source: rejected because no single existing tool covers all required signals.

## Decision 2: Keep the stage strictly governance-only and repository-scoped

Decision: Limit implementation to orchestration, scoring, report generation, and CI gating. Do not change runtime tenancy, middleware, attempt, license, or worker behavior.

Rationale:

- The stage spec and phase file both mark the feature as infra-governance and observability only.
- The constitution forbids weakening tenant isolation, middleware authority, version compatibility, or worker-only grading.
- The required user stories can be satisfied entirely through repository analysis and generated artifacts.

Alternatives considered:

- Adding runtime endpoints or tenant-facing dashboards in this stage: rejected because that would broaden scope and risk architecture drift.
- Persisting results in tenant or master databases: rejected because repository-scoped filesystem artifacts are sufficient and avoid DB lifecycle changes.

## Decision 3: Use a weighted, deterministic score with an explicit pass threshold

Decision: Use the stage scoring model as the planning baseline: dependency integrity 30, layer integrity 20, circular dependency risk 15, type-safety governance 15, architecture drift 10, intelligence synchronization 10, with a default fail threshold of 80.

Rationale:

- The stage file already proposes a clear weight model and threshold example.
- A deterministic score gives governance review one normalized outcome while preserving signal-level detail.
- Keeping the score model explicit makes CI behavior explainable and testable.

Alternatives considered:

- Binary pass/fail without score: rejected because the stage explicitly requires a normalized health outcome.
- Dynamic weights per repository state: rejected because it would make results harder to compare across runs.

## Decision 4: Deduplicate overlapping findings before scoring

Decision: Normalize findings from all source tools into a shared fingerprint model so one underlying issue lowers the score once while still appearing in relevant signal sections.

Rationale:

- The spec identifies duplicate-signal inflation as a required edge case.
- Infra audit and guard outputs can describe the same module-boundary or drift issue from different perspectives.
- Deduplication keeps the health score fair while preserving diagnostic detail.

Alternatives considered:

- Penalizing each tool output independently: rejected because the score would overstate repository risk.
- Collapsing all duplicate findings into one visible record only: rejected because maintainers still need to know which signal families observed the issue.

## Decision 5: Treat stale, missing, or invalid architecture intelligence as first-class health findings

Decision: Model architecture-intelligence synchronization separately from direct rule violations and require the scanner to surface missing files, stale metadata, partially regenerated artifacts, failed refreshes, or invalid brain validation as explicit findings captured before any optional refresh step.

Rationale:

- The spec requires synchronization failures to be detected instead of silently accepted.
- Git-governance and AI-guidance safety depend on current architecture metadata.
- Existing scripts already expose the artifacts and validation steps needed for this signal.
- Capturing sync state before refresh preserves the stage requirement to report stale artifacts instead of automatically normalizing them away.

Alternatives considered:

- Auto-regenerating artifacts before assessment and hiding the problem: rejected because governance review must still know synchronization drift occurred.
- Treating stale artifacts as generic drift only: rejected because remediation priority differs from direct dependency violations.

## Decision 6: Keep all persistent writes filesystem-only and atomic

Decision: Generated reports must be written to `docs/architecture/health/` via temp-file replacement, with no database persistence, no queue writes, and no direct DB instantiation.

Rationale:

- The stage does not need database storage to satisfy its outcomes.
- Atomic filesystem writes satisfy the planning constraint that persistent writes be recoverable and not leave partial governance state.
- This approach keeps the implementation aligned with the repo-scoped nature of the feature.

Alternatives considered:

- Writing results to PostgreSQL: rejected because it would introduce new persistence design and unnecessary DB coupling.
- Appending to log files only: rejected because deterministic JSON and Markdown reports are part of the stage deliverables.

## Decision 7: Sequence health execution after the existing governance baseline

Decision: The health scanner should capture baseline synchronization state first, then orchestrate the canonical sequence of strict architecture guard, infra audit, type-safety scan, optional AI-context refresh, and brain validation.

Rationale:

- The stage measures repository architecture health; it should not replace the underlying controls it depends on.
- Capturing baseline sync state before refresh ensures stale or partially regenerated artifacts remain observable while refreshed validation can still support remediation.
- This sequence aligns with the repo’s `arch:` script family and existing governance workflow.

Alternatives considered:

- Automatically refreshing architecture intelligence before baseline assessment: rejected because it would hide stale-state findings that the stage is required to report.
- Triggering health as a completely separate nightly-only job: rejected because the stage also needs threshold-based review on pushes and pull requests.

## Clarification Resolution Status

All technical-context unknowns for planning were resolved. No ADR change, architecture-map redesign, or module-registration work is required by the planned implementation.
