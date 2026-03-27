# Security Checklist: Script System Standardization and Governance

**Purpose**: Validates that security-relevant requirements in the INFRA-025 spec are complete, clear, and unambiguous — covering injection prevention, secrets hygiene, file-write boundaries, and CI output safety.
**Created**: 2026-03-21
**Feature**: [spec.md](../spec.md)
**Stage**: INFRA-025 — Script System Standardization and Governance
**Domain**: Developer tooling / build-time governance. No tenant data, no runtime behavior, no HTTP surface.

---

## Injection Prevention Requirements

- [ ] CHK001 — Are input validation/sanitization requirements defined for the `<domain>`, `<action>`, and `<scope>` segments of script names to prevent shell metacharacter injection through naming? [Gap, Spec §FR-002]
- [ ] CHK002 — Does the spec prohibit shell metacharacters (e.g., `;`, `&&`, `|`, `$()`, backticks) in script name segments, or is the character set constraint left undefined? [Clarity, Spec §FR-002]
- [ ] CHK003 — Are requirements defined to prevent command injection through the `declared command` field stored in `package.json` scripts that the refactor engine rewrites? [Gap, Spec §FR-004, FR-005]
- [ ] CHK004 — Does the spec define validation rules for migration map entries (FR-003) to reject malformed or injected patterns before the refactor engine processes them? [Gap, Spec §FR-003, FR-004]
- [ ] CHK005 — Are requirements specified for how the refactor engine handles untrusted input when `<old-name>` or `<new-name>` values in the migration map contain regex-special characters that could corrupt the substitution? [Gap, Spec §FR-004]

---

## Secrets and Sensitive Data in Outputs

- [ ] CHK006 — Does the spec explicitly prohibit script validation outputs (`validate:scripts:naming`, `validate:scripts:usage`) from echoing file contents that could expose secrets or credentials? [Gap, Spec §FR-008]
- [ ] CHK007 — Is there a requirement that the refactor report (`reports/SCRIPT_REFACTOR_REPORT.md`) must not persist environment variable values, tokens, or credentials captured during script execution? [Gap, Spec §FR-004]
- [ ] CHK008 — Are requirements defined to prevent the `@description` and `@usage` fields of the metadata header (FR-006) from containing sensitive deployment details (e.g., internal hostnames, credentials, environment-specific paths)? [Gap, Spec §FR-006]
- [ ] CHK009 — Does the spec define whether the script registry (`docs/scripts/SCRIPT_REGISTRY.md`) is safe to commit publicly — specifically that it must not include environment-dependent invocation strings that reveal infra topology? [Gap, Spec §FR-007]
- [ ] CHK010 — Are CI log output requirements defined to ensure that `generate:script:docs` and other governance steps do not print secrets via verbose logging? [Gap, Spec §FR-009]

---

## File-Write and Path Boundary Requirements

- [ ] CHK011 — Does the spec define explicit file-write boundary requirements for the refactor engine — which top-level directories are in-scope and which are categorically out-of-bounds (e.g., `node_modules/`, `.git/`, production build artifacts)? [Gap, Spec §FR-004]
- [ ] CHK012 — Are path-traversal prevention requirements specified for the refactor engine's file resolution logic — does the engine validate that resolved paths stay within the repository root? [Gap, Spec §FR-004]
- [ ] CHK013 — Is the trust model of the migration map document (FR-003) specified — does the spec define what happens if a migration map entry points to an out-of-scope file path? [Gap, Spec §FR-003, FR-004]
- [ ] CHK014 — Does the spec define how the refactor engine behaves when it encounters a symlink that could redirect writes outside the repository boundary? [Gap, Spec §FR-004]
- [ ] CHK015 — Are permission requirements defined for CI steps — do the four validation checks (FR-009) run with minimal required filesystem permissions, or is this left to CI platform defaults? [Gap, Spec §FR-009]

---

## AI Governance Skill Security Surface

- [ ] CHK016 — Does the spec define the authority boundary for the `script-system-governance` AI skill (FR-011) — specifically, are there requirements limiting which file paths the skill may authorize an agent to write? [Gap, Spec §FR-011]
- [ ] CHK017 — Are requirements specified to prevent an AI agent using the governance skill from bypassing validation steps when creating or renaming scripts (e.g., mandating that validation always runs post-change)? [Gap, Spec §FR-011]
- [ ] CHK018 — Is there a requirement that the governance skill must not instruct agents to embed credentials, tokens, or environment-specific values in script metadata headers or migration map entries? [Gap, Spec §FR-006, FR-011]

---

## Ambiguities and Conflicts

- [ ] CHK019 — Is the spec's use of "text patterns, not AST" for the refactor engine (Assumptions) flagged as a security risk — can a text-pattern replacement produce syntactically broken shell or YAML files that silently change CI behavior? [Ambiguity, Spec §Assumptions]
- [ ] CHK020 — Does the spec clarify whether the refactor engine's dry-run mode (`--dry-run`) is permitted to log the full content of planned replacements in CI output, or is output truncation/masking required? [Clarity, Spec §FR-004]
