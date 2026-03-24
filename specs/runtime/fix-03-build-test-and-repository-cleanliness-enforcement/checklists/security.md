# Security Checklist: Build, Test, and Repository Cleanliness Enforcement

**Purpose**: Validate that security requirements for the Policy Engine enforcement layer are complete, clear, consistent, and measurable — covering output sanitization, tenant isolation, artifact safety, auto-fix scope, input validation, and constitutional rule coverage.
**Created**: 2026-03-24
**Feature**: [spec.md](../spec.md)
**Scope**: Infrastructure / Policy Engine enforcement layer (INFRA-29 integration). No user-facing surfaces; security boundary is pre-commit/pre-push hook invocation.

---

## Structured Output & Secret Leakage Prevention

- [ ] CHK001 - Is the Zidney error contract schema (`{ success, data, error }`) specified with an explicit list of fields that are **forbidden** to prevent accidental emission of secrets (env vars, tokens, connection strings) in policy rule output? [Completeness, Gap]
- [ ] CHK002 - Does FR-014 define whether the `data` payload of a `PolicyResult` may contain filesystem paths that could reveal internal directory structure to CI log consumers? [Clarity, Spec §FR-014]
- [ ] CHK003 - Is it specified whether structured log output is sanitized before being written to CI systems to prevent log injection via crafted test names or file paths in `violatingPaths[]`? [Gap]
- [ ] CHK004 - Is "Policy engine unavailable — cannot validate" hard-fail message defined with enough specificity to ensure it does not leak internal module resolution paths or import stack traces? [Clarity, Spec §Clarifications]

---

## Artifact Allowlist & Repository Security

- [ ] CHK005 - Is the artifact allowlist in FR-011 (`docs/ai/context/*`, `docs/architecture/intelligence/*`, committed `dist/`) specified precisely enough to **exclude** `.env*` files, private key files, and credential artifacts even if they appear under an allowed path prefix? [Clarity, Spec §FR-011]
- [ ] CHK006 - Are requirements defined for what happens if `repo:detect-artifacts` itself produces a report file (e.g., a JSON output file) that falls outside the allowlist — would it self-report as a violation? [Edge Case, Gap]
- [ ] CHK007 - Is the drift detection requirement (`RULE_FIX_03_NO_ARTIFACT_DRIFT`) specified to cover binary or compiled artifacts (not only text files) that may contain embedded secrets? [Completeness, Gap]

---

## Auto-Fix Safety & Scope Bounding

- [ ] CHK008 - Is the auto-fix revert requirement (Edge Case: auto-fix breaks typecheck) specified with an explicit constraint that **reverted files MUST NOT be staged or committed** as a side effect? [Completeness, Spec §Edge Cases]
- [ ] CHK009 - Are requirements defined ensuring `RULE_FIX_03_AUTO_FIX_ATTEMPT`'s invocation of `lint:fix` and `format` is scoped to the workspace root and cannot modify files outside it (e.g., global Bun/Node config files)? [Completeness, Gap]
- [ ] CHK010 - Is the sequence of `lint:fix → format → typecheck` in FR-013 specified with a requirement that auto-fix operations do not alter `.gitignore`, `*.env`, or security-sensitive config files? [Gap]

---

## Soft Fallback Prohibition (Security Posture)

- [ ] CHK011 - Is the prohibition on soft fallback to `bun run build` / `bun run test` (Clarifications) specified with a **detection mechanism** (e.g., a lint rule or audit script) that prevents contributors from re-introducing it? [Clarity, Spec §Clarifications]
- [ ] CHK012 - Is the hard-fail requirement for Policy Engine unavailability specified with a requirement that the exit message is written to **stderr** (not stdout) to avoid being silently consumed by pipe consumers? [Clarity, Gap]

---

## Tenant Isolation (Constitutional Rule)

- [ ] CHK013 - Are the database-per-tenant test isolation requirements in NFC-002 specified with explicit constraints prohibiting row-based sharing and cross-tenant joins, not just as a general statement? [Clarity, Spec §NFC-002]
- [ ] CHK014 - Is `RULE_FIX_03_TEST_ISOLATION`'s invocation of `init-test-db.sh` and `reset-test-redis.sh` specified with a requirement that each script operates on **per-tenant schemas only** and cannot accidentally reset all tenants? [Completeness, Spec §FR-012]
- [ ] CHK015 - Are requirements defined for how CI parallel jobs ensure DB schema separation — is "separate DB schemas" enforced by the policy engine, by the test setup scripts, or left entirely to the tenant isolation model? [Clarity, Spec §NFC-009, Clarifications]

---

## License Middleware Enforcement (Constitutional Rule)

- [ ] CHK016 - Is NFC-003's requirement that "test suites covering API routes MUST include license middleware in their setup" specified with a detection mechanism in the policy engine, or is it an unverified aspiration? [Measurability, Spec §NFC-003]
- [ ] CHK017 - Is there a requirement defining what `RULE_FIX_03_TEST_PASS` or another rule does when it detects an API route test that omitted license middleware — does it fail with `error` severity or produce only a `warning`? [Completeness, Gap]

---

## Input Validation (CLI Flags)

- [ ] CHK018 - Are input validation requirements defined for the `--changed` and `--full` CLI flags — specifically, what exit behavior and error message are produced on unknown flags or mutually exclusive flag combinations? [Completeness, Gap]
- [ ] CHK019 - Is it specified whether the changed-file list consumed from GitNexus context is **validated** (e.g., paths are within workspace root) before being passed to rule execution, or is it trusted implicitly? [Completeness, Gap]

---

## Structured Logging (Constitutional Rule)

- [ ] CHK020 - Are structured logging requirements in FR-014 specific enough to confirm that **all** policy failures emit structured JSON to stdout with no free-text stderr fallback that could bypass log parsing? [Completeness, Spec §FR-014]
- [ ] CHK021 - Is the mandatory inclusion of `rule ID`, `domain`, `severity`, `messages[]`, and `violatingPaths[]` in FR-014 output defined as a schema contract (not just a narrative list), making it testable without guessing field names? [Measurability, Spec §FR-014]

---

## Error Contract Conformance (Constitutional Rule)

- [ ] CHK022 - Is it specified whether `DeferralReport` (FR-015) must also conform to the Zidney error contract shape, or is it permitted to use a different schema for deferred failures? [Consistency, Spec §FR-015, FR-014]
- [ ] CHK023 - Are requirements defined for which HTTP status codes map to which `error.code` values in `PolicyResult` serialization, or is the mapping left to implementers? [Gap]

---

## Server-Authoritative Time (Constitutional Rule)

- [ ] CHK024 - Is NFC-004's prohibition on client-supplied timestamps in tests specified with a detection mechanism or rule, or is it a policy statement without an enforcement path in this stage? [Measurability, Spec §NFC-004]

---

## Notes

- No user-facing UI or browser surface exists in this stage; OWASP web categories (XSS, CSRF, clickjacking) are out of scope.
- Security boundary is the Husky pre-push hook invoking `validate:policy`; no additional authN/authZ layer is required per NFC-008.
- Items marked `[Gap]` indicate requirements missing from the current spec and may require additions to FR-_ or NFC-_ before planning.
