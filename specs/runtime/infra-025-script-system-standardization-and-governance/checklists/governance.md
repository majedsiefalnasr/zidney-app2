# Governance Checklist: Script System Standardization and Governance

**Purpose**: Validates that governance requirements in the INFRA-025 spec are complete, unambiguous, and internally consistent — covering naming convention precision, CI gate correctness, registry accuracy, migration map integrity, and enforcement scope.
**Created**: 2026-03-21
**Feature**: [spec.md](../spec.md)
**Stage**: INFRA-025 — Script System Standardization and Governance

---

## Naming Convention Completeness and Clarity

- [ ] CHK001 — Is the allowed domain list in the Domain Map declared as exhaustive (closed set) rather than illustrative, so that validation can definitively reject unknown domains? [Clarity, Spec §Naming Convention]
- [ ] CHK002 — Are requirements defined for how the domain map is extended over time — who is authorized to add a domain, what review or ADR is required, and how the validator learns of the addition? [Gap, Spec §Naming Convention, Spec §FR-002]
- [ ] CHK003 — Does the spec precisely define the character set permitted within `<action>` and `<scope>` segments — is it limited to alphanumeric + hyphen, or are other characters (underscore, dot) also allowed? [Clarity, Spec §Naming Convention]
- [ ] CHK004 — Is "Separator must be `:` (not `-` between domain segments)" unambiguous — does the spec clarify whether `:` is permitted within a single segment (e.g., `validate:script:v2:alpha`)? [Clarity, Spec §FR-002]
- [ ] CHK005 — Is the lifecycle script exemption list (`build`, `test`, `lint`, `typecheck`, `dev`, `clean`, `check`) declared as exhaustive or extensible — can teams add lifecycle names without a governance review? [Clarity, Spec Clarifications §4]
- [ ] CHK006 — Does the spec define whether `pre*` and `post*` lifecycle hooks (e.g., `prebuild`, `posttest`) are governed by the naming convention or exempt alongside their parent lifecycle scripts? [Gap, Spec §FR-002]
- [ ] CHK007 — Are requirements specified for how `validate:scripts:naming` reports remediation hints — is the hint format standardized so violations are actionable without ambiguity? [Clarity, Spec §FR-008]

---

## Duplicate Name Prohibition

- [ ] CHK008 — Is the definition of "duplicate script name" unambiguous — does it mean exact string equality across all `package.json` files, or is scoping by workspace namespace considered? [Clarity, Spec §FR-002]
- [ ] CHK009 — Does the spec define what happens when the same governed script name is declared in both the root `package.json` and a workspace `package.json` — is coexistence permitted, forbidden, or context-dependent? [Gap, Spec §FR-002]
- [ ] CHK010 — Is there a requirement that the validation script identifies which files contain the duplicate, enabling developers to resolve the conflict in a single pass? [Completeness, Spec §FR-002, FR-008]

---

## Migration Map Integrity

- [ ] CHK011 — Does the spec define the required format for migration map entries with sufficient precision to prevent partial or malformed entries (e.g., missing arrow, missing new name, duplicate old name)? [Clarity, Spec §FR-003]
- [ ] CHK012 — Are requirements defined for what happens when a migration map entry references an old name that no longer exists in any `package.json` — is this a warning, an error, or silently ignored? [Gap, Spec §FR-003, FR-004]
- [ ] CHK013 — Is there a requirement that migration map entries are validated before the refactor engine runs, so the engine is never invoked against an invalid map? [Gap, Spec §FR-003, FR-004]
- [ ] CHK014 — Does the spec define the ownership and update discipline for `docs/scripts/SCRIPT_MIGRATION_MAP.md` — who must approve new entries and under what trigger? [Gap, Spec §FR-003]
- [ ] CHK015 — Are requirements defined for whether the migration map is append-only (historical record) or editable (living document reflective of current state only)? [Gap, Spec §FR-003]

---

## Refactor Engine Governance

- [ ] CHK016 — Does the spec define the completion gate expression precisely — "if any old script reference remains after the refactor engine runs, the stage is incomplete" — is this enforced by an automated check or a manual review? [Clarity, Spec §FR-004]
- [ ] CHK017 — Is "idempotent — safe to run multiple times" quantified — does the spec define what observable state must be unchanged between the first and second run? [Clarity, Spec §FR-004]
- [ ] CHK018 — Are requirements defined for how the refactor report distinguishes between three distinct categories: successfully replaced references, unreplaced references due to non-matching context, and skipped files? [Completeness, Spec §FR-004]
- [ ] CHK019 — Does the spec define whether the refactor report (`reports/SCRIPT_REFACTOR_REPORT.md`) is committed to the repository as a governance artifact or regenerated on demand? [Gap, Spec §FR-004]

---

## Script Registry Accuracy and Staleness

- [ ] CHK020 — Is the registry staleness detection algorithm specified — does CI regenerate the registry and diff it against committed content, or does it compute a hash comparison? [Clarity, Spec §FR-007]
- [ ] CHK021 — Are the required fields of each registry entry (script name, domain, source file path, category, description) each precisely defined so that the generator and the validator have identical expectations? [Completeness, Spec §FR-007]
- [ ] CHK022 — Does the spec define what constitutes an "accurate" registry — specifically, if a description drifts from the actual script behavior, does the registry fail validation? [Clarity, Spec §FR-007]
- [ ] CHK023 — Are requirements defined for whether the registry must be the single source of truth for script discoverability, or is it supplementary to `package.json` definitions? [Gap, Spec §FR-007]

---

## Metadata Header Validation

- [ ] CHK024 — Is the required metadata header format (FR-006) precise enough for a validator to check programmatically — are all six fields (`@script`, `@domain`, `@category`, `@description`, `@usage`) required or optional? [Clarity, Spec §FR-006]
- [ ] CHK025 — Are the permitted values for `@category` (`runtime|governance|dev|ci|infra|test`) declared as exhaustive, or can new categories be added without updating the validator? [Clarity, Spec §FR-006]
- [ ] CHK026 — Does the spec define whether `@domain` in the header must exactly match the domain prefix of the script name declared in `package.json`, and whether a mismatch is a validation failure? [Gap, Spec §FR-006]
- [ ] CHK027 — Are shell scripts (`.sh` files) explicitly exempted from the TypeScript metadata header requirement in a form that the validation script can act on, or is the exemption only stated in prose? [Clarity, Spec §Assumptions, Spec §FR-006]

---

## CI Gate Correctness

- [ ] CHK028 — Are the four CI check names (`validate:scripts:naming`, `validate:scripts:usage`, `validate:scripts:infrastructure`, `generate:script:docs`) defined as both `package.json` script names and workflow step labels — or only one of these? [Clarity, Spec §FR-009]
- [ ] CHK029 — Is bypass prevention for the four CI checks stated as a hard requirement — does the spec define that no `continue-on-error`, `if: false`, or equivalent override is permitted for these steps? [Gap, Spec §FR-009]
- [ ] CHK030 — Does the spec define whether the CI steps must be placed as blocking gates (failing the PR) or informational steps — and is this traceable to a specific workflow job configuration requirement? [Clarity, Spec §FR-009]
- [ ] CHK031 — Are requirements defined for how the `architecture-governance.yml` workflow is updated — is there a structural constraint on where the `# Script System Governance` block must appear relative to existing steps? [Gap, Spec §FR-009, Clarifications §3]
- [ ] CHK032 — Does the spec define what `validate:scripts:infrastructure` validates beyond "registry is current" and "metadata headers present" — are additional infrastructure integrity checks required or excluded? [Clarity, Spec §FR-009]

---

## Orchestrator Gate and Stage Closure

- [ ] CHK033 — Is the orchestrator gate evaluation order defined — must all three checks (naming, usage, broken references) pass in a specific sequence, or are they evaluated independently? [Clarity, Spec §FR-010]
- [ ] CHK034 — Does the spec define the concrete mechanism by which the orchestrator gate "blocks closure" — is it an automated script, a manual sign-off, or a CI check? [Gap, Spec §FR-010]
- [ ] CHK035 — Are the orchestrator gate criteria (naming validation, usage validation, no broken references) traceable to specific FR requirements — are they FR-008 outputs or distinct checks? [Completeness, Spec §FR-010]

---

## AI Governance Skill Requirements

- [ ] CHK036 — Are the required sections of the governance skill (`SKILL.md`) listed exhaustively — can an implementer determine exactly which sections are mandatory versus optional from the spec? [Completeness, Spec §FR-011]
- [ ] CHK037 — Is the "supplements, does not supersede" relationship (Clarifications §5) specified in terms of conflict resolution — if the skill and `AGENTS.md` give contradictory guidance, which wins? [Gap, Spec Clarifications §5]
- [ ] CHK038 — Does the spec define a trigger condition for when the skill must be loaded ("any AI agent that creates, renames, or validates scripts") precisely enough to be enforceable in agent governance rules? [Clarity, Spec §FR-011]
- [ ] CHK039 — Are requirements defined for the skill's update lifecycle — must the skill be updated when the domain map changes, when new CI checks are added, or on any spec revision? [Gap, Spec §FR-011]

---

## Success Criteria Measurability

- [ ] CHK040 — Is "zero violations" in Success Criterion 1 unambiguous — does it cover scripts in all `package.json` files including all `apps/*/package.json` and `packages/*/package.json` simultaneously? [Measurability, Spec §Success Criteria]
- [ ] CHK041 — Is Success Criterion 3 ("every script file has a complete metadata header") measurable with a clear scope boundary — does "every script file" include generated scripts, or only hand-authored ones? [Clarity, Spec §Success Criteria]
- [ ] CHK042 — Is Success Criterion 6 ("refactor report shows 0 unresolved references") measurable independently of the report format — is the count of unresolved references a structured field or parsed from free-form text? [Measurability, Spec §Success Criteria, Spec §FR-004]
- [ ] CHK043 — Does the spec define what "governance skill is present and covers all required workflows" means in measurable terms — what are the required workflows and how is "covers" evaluated? [Clarity, Spec §Success Criteria §7]

---

## Scope Boundary and Non-Goals Consistency

- [ ] CHK044 — Are all explicit non-goals (no behavior changes, no new business-logic scripts, no new packages, no runtime dependency) consistent with and traceable from the functional requirements — do any FRs risk creating artifacts that violate a non-goal? [Consistency, Spec §Explicit Non-Goals, Spec §FR-001–FR-011]
- [ ] CHK045 — Is the assumption "only scripts under `scripts/` (TypeScript) are governed by the metadata header requirement" consistent with the scan scope (FR-004) which also covers `.github/workflows/` and `.agents/**/*.md`? [Consistency, Spec §Assumptions, Spec §FR-004, FR-006]
