# Data Model: Architecture Alignment Migration

## Entity: AlignmentBaseline

### Fields

| Field             | Type     | Description                                                      |
| ----------------- | -------- | ---------------------------------------------------------------- |
| `baseline_id`     | string   | Stable identifier for a baseline run captured during this stage. |
| `generated_at`    | datetime | Timestamp for when the baseline was collected.                   |
| `source_commands` | string[] | Canonical commands used to generate the baseline.                |
| `scope_modules`   | string[] | Governed modules included in the baseline.                       |
| `rule_families`   | string[] | Violation families included in the inventory.                    |
| `violation_count` | number   | Total findings in the collected scope.                           |
| `status`          | enum     | `draft`, `established`, `clean`, `refreshed`, `final`.           |

### Relationships

- One `AlignmentBaseline` contains many `GovernanceViolation` records.
- One `AlignmentBaseline` references many `ArchitectureIntelligenceArtifact` records.

### Validation Rules

- Must be generated from canonical governance commands only.
- Must cover all governed modules in stage scope.
- Must classify every finding by module, rule family, and remediation priority.

### State Transitions

- `draft` -> `established` when the first full-scope baseline is captured.
- `established` -> `clean` when baseline capture confirms zero in-scope violations and no remediation is required.
- `established` -> `refreshed` after remediation changes alter the repository state.
- `clean` -> `final` when final verification passes with zero unresolved violations in scope.
- `refreshed` -> `final` when final verification passes with zero unresolved violations in scope.

## Entity: GovernanceViolation

### Fields

| Field                  | Type   | Description                                                                                                                                            |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `violation_id`         | string | Unique identifier derived from tool output, module, and location.                                                                                      |
| `rule_family`          | enum   | `dependency-boundary`, `module-boundary`, `circular-dependency`, `unsafe-type`, `validation-gap`, `export-typing`, `script-overlap`, `artifact-drift`. |
| `severity`             | enum   | `low`, `medium`, `high`, `critical`.                                                                                                                   |
| `module`               | string | Owning application, package, or governed script area.                                                                                                  |
| `location`             | string | File path and optional line reference.                                                                                                                 |
| `remediation_priority` | enum   | `P0`, `P1`, `P2`, `P3`.                                                                                                                                |
| `status`               | enum   | `detected`, `classified`, `remediated`, `verified`, `closed`.                                                                                          |
| `source_tool`          | enum   | `arch-guard`, `infra-audit`, `type-safety-guard`, `typecheck`, `lint`.                                                                                 |
| `recommended_fix`      | string | Canonical remediation approach.                                                                                                                        |

### Relationships

- Many `GovernanceViolation` records belong to one `AlignmentBaseline`.
- Many `GovernanceViolation` records can map to one `ModuleBoundaryContract`.
- A `GovernanceViolation` can require zero or more `LegacyGovernanceScript` actions.

### Validation Rules

- Every violation must map to exactly one primary rule family.
- Severity and priority must be explicit for repository-wide scheduling.
- A violation cannot move to `verified` until the canonical verification commands confirm the fix.

### State Transitions

- `detected` -> `classified` when grouped by family, module, and priority.
- `classified` -> `remediated` when code or script changes resolve the issue locally.
- `remediated` -> `verified` when governance checks pass for the affected scope.
- `verified` -> `closed` when final repository-wide verification passes.

## Entity: ModuleBoundaryContract

### Fields

| Field                    | Type     | Description                                               |
| ------------------------ | -------- | --------------------------------------------------------- |
| `module_path`            | string   | Module root such as `apps/api` or `packages/domain-core`. |
| `layer`                  | enum     | `infrastructure`, `domain`, `runtime`, `ui`.              |
| `allowed_dependencies`   | string[] | Allowed layers or modules from the canonical map.         |
| `forbidden_dependencies` | string[] | Forbidden layers or modules from the canonical map.       |
| `criticality`            | string   | Module risk or governance criticality where available.    |

### Relationships

- One `ModuleBoundaryContract` applies to many `GovernanceViolation` records.
- One `ModuleBoundaryContract` influences many `ArchitectureIntelligenceArtifact` outputs.

### Validation Rules

- Must align with `docs/architecture/module-boundaries.json` and `ARCHITECTURE_CONTRACT.json`.
- Cannot be modified by this stage to introduce new exceptions.

## Entity: LegacyGovernanceScript

### Fields

| Field               | Type     | Description                                               |
| ------------------- | -------- | --------------------------------------------------------- |
| `script_path`       | string   | Existing script path or command name under review.        |
| `coverage_area`     | string[] | Rules or checks the script enforces.                      |
| `canonical_overlap` | string[] | Canonical tools already covering the same responsibility. |
| `decision`          | enum     | `retain`, `wrap`, `retire`, `narrow-scope`.               |
| `status`            | enum     | `candidate`, `reviewed`, `consolidated`, `retained`.      |

### Relationships

- A `LegacyGovernanceScript` may address many `GovernanceViolation` records in the `script-overlap` family.

### Validation Rules

- Scripts with full canonical overlap should not survive unchanged.
- Consolidation must not remove required enforcement coverage.

### State Transitions

- `candidate` -> `reviewed` when overlap is documented.
- `reviewed` -> `consolidated` or `retained` based on canonical coverage.

## Entity: ArchitectureIntelligenceArtifact

### Fields

| Field            | Type    | Description                                                                   |
| ---------------- | ------- | ----------------------------------------------------------------------------- |
| `artifact_name`  | string  | Generated artifact filename.                                                  |
| `path`           | string  | Artifact location in `docs/architecture/intelligence/` or `docs/ai/context/`. |
| `generated_by`   | string  | Canonical command or script that produces the artifact.                       |
| `schema_version` | string  | Artifact schema version when present.                                         |
| `validated`      | boolean | Whether post-generation validation passed.                                    |
| `status`         | enum    | `stale`, `generated`, `validated`.                                            |

### Relationships

- Many artifacts can be associated with one `AlignmentBaseline`.

### Validation Rules

- Generated artifacts must never be hand-edited during this stage.
- `ai-architecture-brain.json` must pass `validate-architecture-brain.ts` before closure.

### State Transitions

- `stale` -> `generated` after canonical refresh.
- `generated` -> `validated` after successful validation and verification.

## Entity: VerificationRun

### Fields

| Field                  | Type     | Description                                           |
| ---------------------- | -------- | ----------------------------------------------------- |
| `run_id`               | string   | Identifier for the verification execution.            |
| `commands`             | string[] | Canonical command sequence used for closure evidence. |
| `executed_at`          | datetime | Verification timestamp.                               |
| `verdict`              | enum     | `pass`, `fail`.                                       |
| `remaining_violations` | number   | Unresolved findings after the run.                    |
| `notes`                | string   | Follow-up notes or known blockers.                    |

### Validation Rules

- Closure requires `verdict = pass` and `remaining_violations = 0` within stage scope.
- Verification evidence must come from canonical repo scripts, not ad hoc scans.

## Entity: ZeroViolationEvidence

### Fields

| Field                  | Type     | Description                                           |
| ---------------------- | -------- | ----------------------------------------------------- |
| `captured_at`          | datetime | Timestamp of the clean baseline evidence capture.     |
| `arch_guard_verdict`   | enum     | `pass`, `fail`.                                       |
| `type_safety_verdict`  | enum     | `pass`, `fail`.                                       |
| `infra_audit_verdict`  | enum     | `pass`, `fail`.                                       |
| `runtime_change_scope` | enum     | `none`, `docs-only`, `runtime-adjacent`.              |
| `remediation_required` | boolean  | Whether any repository remediation is still required. |
| `notes`                | string   | Evidence summary and follow-up guidance.              |

### Validation Rules

- If all baseline verdicts pass with zero violations, `remediation_required` must be `false`.
- A zero-violation stage must still refresh and validate canonical intelligence before closure.
