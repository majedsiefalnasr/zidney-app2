# Governance Checklist: Auto Selection Engine

**Purpose**: Validate requirement alignment with Zidney architecture, stage lifecycle controls, and binding ADR decisions
**Created**: 2026-04-02
**Feature**: [spec.md](../spec.md)

**Note**: This checklist validates whether the written requirements are governance-safe before planning.

## Architecture & ADR Alignment

- [ ] CHK001 Are requirements explicitly aligned with database-per-tenant isolation so selection cannot mix candidate pools across workspaces? [Consistency, ADR-0001, Spec §FR-003]
- [ ] CHK002 Are snapshot-immutability requirements complete so selection outputs are never recomputed after attempt start? [Completeness, ADR-0002, Spec §FR-009]
- [ ] CHK003 Are runtime-authoritative timing requirements defined for selection execution boundaries in the attempt-start flow? [Consistency, ADR-0006, Stage 39 §Execution Timing]
- [ ] CHK004 Are compatibility-failure requirements aligned with product/schema compatibility governance and error handling expectations? [Consistency, ADR-0007, Stage 39 §Failure Conditions]
- [ ] CHK005 Are anti-abuse and throughput requirements aligned with accepted platform rate-limiting strategy where relevant to attempt-start endpoints? [Consistency, ADR-0009, Spec §SC-004]

## Requirement Traceability & Clarity

- [ ] CHK006 Is a traceability scheme defined that maps each criteria-validation rule to functional requirements and measurable outcomes? [Gap, Spec §FR-005, Spec §SC-006]
- [ ] CHK007 Are deterministic replay requirements clear about audit preconditions and interpretation when environment drift exists? [Clarity, Spec §SC-003, Stage 39 §Deterministic Randomization]
- [ ] CHK008 Are governance-critical terms (deterministic, atomic, fail fast, immutable) defined with objective acceptance thresholds? [Ambiguity, Spec §FR-002, Spec §FR-011, Spec §FR-009]

## Stage Lifecycle & Change Control

- [ ] CHK009 Are requirements explicit about what belongs in this stage versus deferred optimization scope to prevent silent scope expansion? [Completeness, Stage 39 §Future Optimization Path, STAGE_LIFECYCLE_POLICY §Freeze Rule]
- [ ] CHK010 Are assumptions documented for downstream stages (attempt start and grading) with clear no-regression obligations? [Coverage, Stage 39 §Execution Timing, Stage 39 §Stability Principle]
- [ ] CHK011 Are governance requirements defined for preserving stage artifacts if status advances beyond DRAFT, including mutation boundaries? [Gap, STAGE_LIFECYCLE_POLICY §Change Control After Closure]

## Operational Governance Coverage

- [ ] CHK012 Are observability requirements complete for correlation, tenant context, and failure categorization in governance audits? [Completeness, Spec §FR-013]
- [ ] CHK013 Are dependency assumptions documented for index readiness, schema state, and visibility data integrity before runtime execution? [Assumption, Stage 39 §Performance Requirements, Spec §Assumptions]
- [ ] CHK014 Are conflict-resolution requirements defined for potential policy tension between fairness determinism and operational performance targets? [Coverage, Spec §SC-003, Spec §SC-005]
