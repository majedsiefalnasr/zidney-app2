# Accessibility Checklist: Build, Test, and Repository Cleanliness Enforcement

**Purpose**: Validate that developer-experience (DX) accessibility requirements for the Policy Engine CLI are complete and clear — covering machine-readable output schemas, human-readable companion messages, standard exit code semantics, debuggability, and tooling integration. This stage has no user-facing UI; classic WCAG/browser accessibility is out of scope.
**Created**: 2026-03-24
**Feature**: [spec.md](../spec.md)
**Scope**: CLI / Developer tooling only. No browser UI, no screen-reader surface, no ARIA requirements. Scope is limited per user instruction to infrastructure DX accessibility.

---

## Dual-Format Output (Machine-Readable + Human-Readable)

- [ ] CHK001 - Are requirements defined specifying **when** machine-readable JSON output and **when** human-readable text output are produced — or is the spec ambiguous about whether both formats are emitted simultaneously? [Clarity, Spec §FR-014]
- [ ] CHK002 - Is it specified whether human-readable and machine-readable output are written to the **same stream** (stdout) or separate streams (stdout/stderr), ensuring CI log consumers can parse one without the other contaminating it? [Clarity, Spec §FR-007, FR-014]
- [ ] CHK003 - Is "human-readable message" in FR-014 defined with a format, length constraint, or example — or is the content left entirely to rule implementers with no consistency guarantee? [Clarity, Spec §FR-014]

---

## Exit Code Semantics

- [ ] CHK004 - Are exit code semantics (`0` = clean or warnings-only, non-zero = errors) specified for **all** scenarios, including: no-op success (zero changed files), warnings-only pass, deferred failures, and policy engine unavailable? [Completeness, Spec §FR-014, Edge Cases]
- [ ] CHK005 - Is it specified whether the "warnings-only" exit code is exactly `0` or a distinct non-error code (e.g., `2`) that scripts can distinguish from a clean pass? [Clarity, Spec §FR-014]
- [ ] CHK006 - Is the "Policy engine unavailable — cannot validate" hard-fail exit code specified as a well-known non-zero value (rather than whatever the import error produces) to allow robust scripted handling? [Clarity, Spec §Clarifications]

---

## Structured Error Output Schema (Tooling Integration)

- [ ] CHK007 - Is the JSON output schema for `validate:policy` specified with **field-level definitions** (names, types, required vs. optional) sufficient to enable IDE/editor integration or post-processing scripts without reverse-engineering the implementation? [Completeness, Gap]
- [ ] CHK008 - Is the `DeferralReport` schema in FR-015 defined with enough field specificity to be consumed by an automated triage tool or dashboard, not just by developers reading CI logs? [Completeness, Spec §FR-015]
- [ ] CHK009 - Are requirements defined specifying that `repo:assert-clean`, `repo:detect-artifacts`, and related scripts write machine-readable JSON to **stdout** (not stderr), making them pipeable in shell scripts and CI systems? [Clarity, Spec §FR-007]

---

## Error Message Actionability

- [ ] CHK010 - Are requirements defined specifying that each policy rule failure message includes enough context (e.g., file path, rule ID, remediation hint) to permit a developer to act **without re-running the pipeline** for diagnosis? [Completeness, Spec §FR-014]
- [ ] CHK011 - Is the `DeferralReport` structure in FR-015 specified to include a "suggested follow-up stage or task" in a format actionable without interpretation — or is it a free-text narrative field? [Clarity, Spec §FR-015]
- [ ] CHK012 - Are requirements defined for the crash report format when a rule throws an uncaught exception — specifically, is it specified to include the rule ID, a message, and a safe (non-stack-trace) summary rather than a raw exception dump? [Coverage, Spec §Edge Cases]

---

## Individual Rule Debuggability

- [ ] CHK013 - Is SC-008's requirement that all 14 rules are "invokable individually for debugging" specified with a **defined CLI invocation syntax** and documented output format, or is invocability implied without a contract? [Clarity, Spec §SC-008]
- [ ] CHK014 - Is it specified whether individually invoked rules receive the same `PolicyContext` as pipeline runs (including GitNexus changed-file lists), or a simplified context that may produce different results than pipeline execution? [Completeness, Gap]

---

## CI Log Readability

- [ ] CHK015 - Is it specified that rule result summaries in CI logs include enough structured context (rule ID, severity, violating path count) to be **scannable in a CI log view** without requiring a full JSON parse? [Completeness, Gap]
- [ ] CHK016 - Are requirements defined for the ordering and grouping of rule output — e.g., errors before warnings, grouped by domain — to reduce cognitive overhead for developers triaging failures? [Gap]

---

## Notes

- No browser UI, no WCAG criteria, no ARIA requirements apply to this stage.
- "Accessibility" in this context means developer ergonomics: can a developer with only CI log output diagnose and fix a policy failure without external context?
- Items marked `[Gap]` represent requirements missing from the current spec that reduce tooling integratability and developer DX.
- CHK count is intentionally compact given the limited DX surface of a CLI infrastructure tool.
