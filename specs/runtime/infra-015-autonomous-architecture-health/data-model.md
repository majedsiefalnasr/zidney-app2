# Data Model - Autonomous Architecture Health

This stage is infrastructure-governance scoped. The entities below model orchestration, scoring, findings, and generated governance artifacts only. No tenant, license, attempt, or runtime business entity is added or modified.

## 1. ArchitectureHealthAssessment

Purpose: Represents one authoritative repository-wide health evaluation for a single scanner run.

Fields:

- `schema_version` (string, required): Version of the JSON report schema.
- `assessment_id` (string, required): Stable repository-state fingerprint used to correlate repeated evaluations of the same repository state across current and historical artifacts.
- `generated_at` (ISO-8601 string, required): Server-generated execution timestamp.
- `overall` (object, required): Aggregate assessment outcome.
  - `score` (number, required): Normalized score from 0 to 100.
  - `health_state` (enum, required): `EXCELLENT` | `HEALTHY` | `WARNING` | `CRITICAL`.
  - `threshold` (object, required): Threshold policy metadata.
    - `policy_id` (string, required): Policy used to evaluate the verdict.
    - `minimum_passing_score` (number, required): Required passing threshold.
  - `verdict` (enum, required): `PASS` | `BLOCKED`.
- `threshold_policy` (`HealthThresholdPolicy`, required): Fully expanded scoring policy used for the run.
- `signals` (`HealthSignalResult[]`, required): All governed signal outcomes.
- `findings` (`HealthFinding[]`, required): Deduplicated findings with remediation guidance.
- `intelligence_snapshot` (`ArchitectureIntelligenceSnapshot`, required): Artifact-level synchronization evidence captured for the run.
- `source_runs` (`SourceRun[]`, required): Source command execution metadata.

Validation rules:

- `overall.score` must be within 0 and 100 inclusive.
- `overall.verdict=BLOCKED` if `overall.score` is below the active threshold or any mandatory hard-fail signal fails.
- Every required signal from the stage spec must appear exactly once in `signals`.

## 2. HealthSignalResult

Purpose: Captures one governed architecture-health dimension and its contribution to the assessment.

Fields:

- `signal_id` (enum, required): `dependency_integrity` | `layer_integrity` | `circular_dependency_risk` | `type_safety_governance` | `architecture_drift` | `intelligence_synchronization`.
- `weight` (number, required): Score weight assigned to the signal.
- `status` (enum, required): `PASS` | `WARN` | `FAIL`.
- `score_delta` (number, required): Penalty applied to the overall score.
- `finding_count` (integer, required): Number of findings attributed to the signal.
- `summary` (string, optional): Human-readable summary of source-tool output.
- `sources` (string[], required): Commands or artifacts that produced the signal.

Validation rules:

- `weight` must match the active threshold policy.
- `score_delta` must be greater than or equal to 0.
- `status=FAIL` requires at least one blocking or severe finding, or a mandatory source execution failure.

## 3. HealthFinding

Purpose: Describes one actionable architecture-health issue after cross-tool deduplication.

Fields:

- `finding_id` (string, required): Stable fingerprint of the issue.
- `signal_ids` (enum[], required): Signal families that observed the issue.
- `classification` (enum, required): `direct_rule_violation` | `drift` | `synchronization`.
- `severity` (enum, required): `critical` | `high` | `medium` | `low`.
- `impacted_surface` (string, required): Module, artifact, or governed surface impacted.
- `location` (object, optional):
  - `file` (string, required when present)
  - `line` (integer, optional)
  - `column` (integer, optional)
- `message` (string, required): Human-readable issue summary.
- `remediation` (string, required): Concrete next action.
- `source_tools` (string[], required): Tool names that reported the issue.

Validation rules:

- `signal_ids` must contain at least one governed signal.
- `classification=synchronization` is reserved for stale, missing, invalid, or mismatched architecture-intelligence artifacts.
- `remediation` is mandatory for every finding.

## 4. HealthThresholdPolicy

Purpose: Defines how score weights, hard-fail rules, and threshold evaluation are applied.

Fields:

- `policy_id` (string, required): Stable identifier such as `default-health-threshold-v1`.
- `minimum_passing_score` (number, required): Planned default `80`.
- `weights` (record, required): Mapping of every governed signal to its score weight.
- `hard_fail_conditions` (string[], required): Conditions that fail the verdict regardless of raw score, such as invalid architecture-brain artifacts.
- `status_mapping` (record, required): Maps score ranges to `EXCELLENT`, `HEALTHY`, `WARNING`, `CRITICAL`.

Validation rules:

- The sum of `weights` must equal 100.
- `minimum_passing_score` must be between 0 and 100.
- Every governed signal must be listed in `weights`.

## 5. ArchitectureIntelligenceSnapshot

Purpose: Represents the machine-readable architecture context used during assessment.

Fields:

- `snapshot_id` (string, required): Unique identity for the artifact set used in the run.
- `artifacts` (`IntelligenceArtifactStatus[]`, required): Artifact-level sync and validation state.
- `generated_at` (ISO-8601 string, optional): Aggregate generation timestamp when available.
- `validation_status` (enum, required): `CURRENT` | `STALE` | `MISSING` | `INVALID`.
- `validation_notes` (string, optional): Human-readable sync explanation.

Validation rules:

- `validation_status=CURRENT` only if all required artifacts are present and validation passes.
- Missing or invalid architecture-brain files must be surfaced as synchronization findings.

## 6. IntelligenceArtifactStatus

Purpose: Captures one required AI-context or architecture artifact used by the health assessment.

Fields:

- `artifact_name` (string, required): Example `ai-architecture-brain.json`.
- `path` (string, required): Repository-relative path.
- `required` (boolean, required): Whether the file is mandatory for health evaluation.
- `exists` (boolean, required): Presence on disk.
- `status` (enum, required): `CURRENT` | `STALE` | `MISSING` | `INVALID`.
- `last_modified_at` (ISO-8601 string, optional): Filesystem timestamp when available.
- `validator` (string, optional): Validation command or script.

## 7. SourceRun

Purpose: Records execution metadata for one underlying governance command used by the scanner.

Fields:

- `tool` (string, required): Example `arch:guard:ci` or `arch:validate-brain`.
- `command` (string, required): Executed command string.
- `enrichment_mode` (enum, optional): `none` | `gitnexus_query` | `gitnexus_impact`.
- `timeout_ms` (integer, required): Allowlisted timeout budget assigned to the command.
- `duration_ms` (integer, required): Observed elapsed runtime for the command.
- `timed_out` (boolean, required): Whether the command exceeded its timeout budget and was terminated by the runner.
- `started_at` (ISO-8601 string, required)
- `finished_at` (ISO-8601 string, required)
- `exit_code` (integer, required)
- `output_format` (enum, required): `json` | `markdown` | `text`.
- `consumed_artifacts` (string[], optional): Output files or stdout contracts used for normalization.

Validation rules:

- `finished_at` must be greater than or equal to `started_at`.
- `duration_ms` must be greater than or equal to 0.
- `timed_out=true` indicates the timeout budget was exceeded even if a synthetic exit code is reported.
- Non-zero `exit_code` must still be represented when the assessment can continue and translate the failure into findings.
- `enrichment_mode` is set when GitNexus evidence is attached to the run.

## State Transitions

### ArchitectureHealthAssessment

- `initialized` -> `collecting_signals` -> `normalizing_findings` -> `writing_reports` -> `completed`
- `completed` resolves to `overall.verdict=PASS` or `overall.verdict=BLOCKED`

### ArchitectureIntelligenceSnapshot

- `unchecked` -> `validated`
- `validated` resolves to `CURRENT`, `STALE`, `MISSING`, or `INVALID`

No tenant lifecycle, attempt lifecycle, grading lifecycle, or runtime workflow transition is changed by this stage.
