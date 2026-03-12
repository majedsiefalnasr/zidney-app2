# Data Model - Unified Architecture Guard

This stage is governance/infrastructure scoped. Entities below model execution, policy orchestration, and reporting artifacts. No tenant runtime business entities are introduced or modified.

## 1. UnifiedGuardRun

Purpose: Represents one end-to-end execution instance of the unified architecture guard.

Fields:

- `run_id` (string, required): Unique run identifier.
- `timestamp` (ISO-8601 string, required): Start time of run.
- `validation_mode` (enum, required): `development` | `strict` | `changed`.
- `scope` (object, required):
  - `modules_validated` (integer, required)
  - `modules_skipped` (integer, required)
  - `skipped_unmapped_files` (string[], optional)
- `fallback_reason` (enum|null, optional): `map_changed` | `new_module_detected` | `graph_missing` | `graph_stale` | `graph_unusable` | `full_scope` | null.
- `duration_ms` (number, required): Execution time.
- `verdict` (enum, required): `PASS` | `BLOCKED`.

Validation rules:

- `validation_mode=changed` may include `fallback_reason` when full-scan fallback occurs.
- `modules_validated >= 0` and `modules_skipped >= 0`.
- `verdict=BLOCKED` indicates at least one violation or a contract-breaking execution error.

## 2. GuardRule

Purpose: Defines one enforceable governance rule executed by the runner.

Fields:

- `rule_id` (string, required): Stable identifier (for example `dependency-boundaries`).
- `name` (string, required): Human-friendly rule name.
- `category` (enum, required): `dependency` | `layer` | `module-boundary` | `circular` | `type-safety` | `ai-governance`.
- `severity` (enum, required): `error` | `warning`.
- `enabled_in_modes` (enum[], required): subset of `strict`, `changed`.
- `source_of_truth` (string, required): Path to contract/config consumed by this rule.

Relationships:

- One `UnifiedGuardRun` executes many `GuardRule` evaluations.

## 3. RuleEvaluation

Purpose: Captures per-rule run result.

Fields:

- `run_id` (string, required)
- `rule_id` (string, required)
- `status` (enum, required): `PASS` | `BLOCKED` | `SKIPPED`.
- `checked_items` (number, required)
- `violations_count` (number, required)
- `notes` (string, optional)

Validation rules:

- `status=BLOCKED` implies `violations_count > 0` or contract error context in notes.
- `status=SKIPPED` requires explanatory `notes`.

## 4. ViolationRecord

Purpose: Structured finding reported by one failed rule evaluation.

Fields:

- `rule` (string, required)
- `severity` (enum, required): `error` | `warning`.
- `message` (string, required): Human-readable summary.
- `location` (object, required):
  - `file` (string, required)
  - `line` (number, optional)
  - `column` (number, optional)
- `source_module` (string, required)
- `target_module` (string, optional)
- `remediation` (string, required): Actionable guidance.

Validation rules:

- Must include enough location data to identify affected source.
- Must include remediation text per FR-008.

## 5. ArchitectureContextArtifact

Purpose: Describes generated machine-readable context consumed by governance and AI tooling.

Fields:

- `artifact_name` (enum, required):
  - `ai-architecture-summary.md`
  - `ai-module-map.json`
  - `ai-layer-model.json`
  - `ai-dependency-graph.json`
  - `ai-runtime-map.json`
  - `ai-runtime-dependents.json`
  - `ai-architecture-brain.json`
  - `ai-architecture-diff.json`
  - `ai-context-mini.json`
- `path` (string, required)
- `generated_at` (ISO-8601 string, required)
- `valid` (boolean, required)
- `generator` (string, required): script name.

Relationships:

- One `UnifiedGuardRun` may trigger generation/validation of many `ArchitectureContextArtifact` records.

## State Transitions

### UnifiedGuardRun

- `initialized` -> `executing` -> `completed`.
- `completed` yields `verdict=PASS` or `verdict=BLOCKED`.

### RuleEvaluation

- `pending` -> `PASS|BLOCKED|SKIPPED`.

No runtime domain state transitions (license, attempt, tenant lifecycle) are affected by this stage.
