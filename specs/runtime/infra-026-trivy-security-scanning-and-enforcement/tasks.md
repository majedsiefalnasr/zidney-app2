# Tasks: Trivy Security Scanning and Enforcement

**Stage**: INFRA-026  
**Phase**: 01_PLATFORM_FOUNDATION  
**Related Plan**: `plan.md`  
**Related Spec**: `spec.md`  
**Related ADR**: None  
**Generated**: 2026-03-23  
**Tasks Total**: 34

---

## Stage Context

- Phase: 01_PLATFORM_FOUNDATION
- Stage: Trivy Security Scanning And Enforcement
- Related Plan: `specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md`
- Related Spec: `specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md`
- Related ADR: None — INFRA stage, no architectural changes

---

## Task Categorization

### Phase 1 — Foundation: Scripts + Configuration

- [x] T001 Create `scripts/security/trivy-config.ts` — shared helper for scanners, severities, report path, exclusions, and redacted output rules (FR-022, SEC-004)
- [x] T002 Create `scripts/security/scan.ts` — full filesystem scan wired through shared helper and registered as `infra:security` (FR-001)
- [x] T003 Create `scripts/security/scan-deps.ts` — dependency vulnerability scan that emits MEDIUM findings as warnings and exits 1 only on HIGH/CRITICAL; registered as `infra:security:deps` (FR-002, FR-008, FR-009)
- [x] T004 Create `scripts/security/scan-secrets.ts` — secret scanner with staged-file mode and hard-fail exit semantics on any secret match; registered as `infra:security:secrets` (FR-003, FR-012)
- [x] T005 Create `scripts/security/scan-config.ts` — IaC misconfig scan using shared helper; registered as `infra:security:config` (FR-004)
- [x] T006 Create `scripts/security/scan-ci.ts` — CI/orchestrator mirror that writes a sanitized `tmp/trivy-report.json`, logs MEDIUM findings as warnings, and exits 1 on HIGH/CRITICAL vulnerabilities, HIGH/CRITICAL misconfigurations, or any secret result; registered as `infra:security:ci` (FR-005, FR-008, FR-009, FR-018, FR-019, SEC-004, SC-010)
- [x] T007 Add required 5-field script metadata headers to all new executable script files (script governance)
- [x] T008 Register all 5 scripts in root `package.json` under `infra:security`, `infra:security:deps`, `infra:security:secrets`, `infra:security:config`, `infra:security:ci` (FR-006, FR-007, NFR-005)
- [x] T009 Create `.trivyignore` at repo root with governance header comment (FR-021)
- [x] T010 Verify/add `tmp/` to `.gitignore` at repo root (ensures scan output file is not committed)

### Phase 2 — Integration: Pre-Commit Hook

- [x] T011 Extend `.husky/pre-commit` — append dependency vulnerability scan block using `infra:security:deps` after architecture brain validation (FR-010, FR-011, FR-013)
- [x] T012 Extend `.husky/pre-commit` — append staged secret scan block using `infra:security:secrets --staged`; fail hard when Trivy is unavailable because secret enforcement is mandatory (FR-010, FR-012, NFR-002)

### Phase 3 — CI Integration

- [x] T013 Add `TRIVY_VERSION: "v0.59.1"` to `env:` block at top of `.github/workflows/ci.yml` (SEC-001)
- [x] T014 Add `security` job scaffold to `.github/workflows/ci.yml` with checkout, Bun setup, dependency install, version-pinned Trivy release download, checksum verification, and binary installation (FR-014, FR-015, SEC-001)
- [x] T015 Add Trivy DB cache restore/persist, `infra:security:ci` execution, and sanitized artifact upload to the `security` job while preserving the NFR-001 budget target (FR-015, FR-017, NFR-001, SC-002, SEC-004)
- [x] T016 Update downstream build/test jobs in `.github/workflows/ci.yml` so they depend on the `security` job and therefore execute after the security gate (FR-016)

### Phase 4 — Documentation [P]

- [x] T017 [P] Create `docs/scripts/security-scan.md` — document `infra:security` script (FR-023, FR-024)
- [x] T018 [P] Create `docs/scripts/security-scan-deps.md` — document `infra:security:deps` script (FR-023, FR-024)
- [x] T019 [P] Create `docs/scripts/security-scan-secrets.md` — document `infra:security:secrets` script, staged mode, and redaction rules (FR-023, FR-024, SEC-004)
- [x] T020 [P] Create `docs/scripts/security-scan-config.md` — document `infra:security:config` script (FR-023, FR-024)
- [x] T021 [P] Create `docs/scripts/security-scan-ci.md` — document `infra:security:ci` script, JSON report contract, and CI/orchestrator usage (FR-023, FR-024)

### Phase 5 — Orchestrator Agent Extension

- [x] T022 Extend Step 5 description in `.agents/agents/orchestrator.agent.md` — add `infra:security:ci` sanitized JSON capture prose before speckit.analyze handoff (FR-018, SEC-004)
- [x] T023 Extend Step 6.5 (Runtime & Static Analysis Gate) description in `.agents/agents/orchestrator.agent.md` — add fail-closed JSON parsing and block on CRITICAL vulnerabilities, CRITICAL infrastructure misconfigurations, or any secret finding (FR-019, FR-020, SC-010)

### Phase 6 — Validation

- [x] T024 Run `bun run dev:generate:script-docs` and verify the script registry updates cleanly (SC-008)
- [x] T025 Run `bun run validate:scripts:naming` — verify new script names comply with governance (SC-008)
- [x] T026 Run `bun run validate:scripts:usage` — verify all new references resolve (SC-008)
- [x] T027 Run `bun run validate:scripts:infrastructure` — verify script metadata/header coverage and registry expectations (SC-008)
- [x] T028 Run `bun run infra:security`, `bun run infra:security:deps`, `bun run infra:security:secrets`, and `bun run infra:security:config` locally on a clean repository and verify each mode is independently executable with the expected scope and non-blocking clean-path behavior (SC-001, NFR-004)
- [x] T029 Run `bun run infra:security:ci` locally twice with identical inputs and verify clean exit, stable JSON artifact contract, and consistent documentation of the shared invocation contract across local dev, CI, and orchestrator contexts (SC-007, NFR-003, NFR-006)
- [x] T030 Measure pre-commit path timing for dependency scan plus staged secret scan and verify total runtime stays within 30 seconds, including a HIGH-severity dependency fixture that proves hook-level dependency blocking and a staged secret fixture that proves local secret blocking without value echo (NFR-002, SC-003, SC-010)
- [x] T031 Validate the CI security job runtime stays within 3 minutes on a standard GitHub Actions runner, using local simulation only as supplemental evidence and not as the sole proof (NFR-001, SC-002)
- [x] T032 Verify `.github/workflows/ci.yml` YAML syntax is valid, the security job emits findings in PR-visible step logs with the failing package/CVE for dependency failures and the secret type/file path without secret-value echo for secret failures, the uploaded artifact is sanitized, and all five docs contain purpose, usage, trigger context, severity policy, output, and prerequisites sections (FR-017, FR-024, SC-002, SC-004, SC-005, SEC-004)
- [x] T033 Add automated tests for the security helper and orchestrator-facing report logic using fixtures: classification/severity mapping, sanitized JSON generation, LOW suppression, MEDIUM warnings, HIGH vulnerability or misconfiguration CI failure without orchestrator hard block, CRITICAL vulnerability or misconfiguration orchestrator block, secret blocking, clean reports, CI output metadata expectations, and unreadable JSON fail-closed behavior (FR-008, FR-009, SC-002, SC-004, SC-006, SC-010)
- [x] T034 Run `bun scripts/ai-guard.ts && bun scripts/infra-audit.ts && bun run lint && bun run typecheck && bun run test` — verify no new governance violations introduced and all automated tests pass (SC-009)

---

## Risk-Ranked Task Summary

| Task ID   | Risk      | Description                                                                      |
| --------- | --------- | -------------------------------------------------------------------------------- |
| T015      | 🟡 MEDIUM | Add security job to ci.yml — CI workflow modification                            |
| T016      | 🟡 MEDIUM | Add `needs: security` to downstream jobs — CI graph change                       |
| T011–T012 | 🟡 MEDIUM | Extend .husky/pre-commit — dependency and staged secret enforcement              |
| T006      | 🟡 MEDIUM | scan-ci.ts — writes to tmp/trivy-report.json and enforces JSON-based block logic |
| T008      | 🟡 MEDIUM | Register 5 new scripts in root package.json under infra namespace                |
| T022–T023 | 🟡 MEDIUM | Orchestrator agent doc extension — Step 5 capture + Step 6.5 fail-closed gate    |
| T001      | 🟢 LOW    | Create shared Trivy config helper                                                |
| T002–T005 | 🟢 LOW    | Create executable scan scripts                                                   |
| T007      | 🟢 LOW    | Add script metadata headers                                                      |
| T009      | 🟢 LOW    | Create .trivyignore — new config file                                            |
| T010      | 🟢 LOW    | Verify/add tmp/ to .gitignore                                                    |
| T013–T014 | 🟢 LOW    | Add TRIVY_VERSION env var and Trivy cache strategy                               |
| T017–T021 | 🟢 LOW    | Documentation files (additive only)                                              |
| T024–T034 | 🟢 LOW    | Governance, timing, and behavior validation tasks                                |

---

## Tasks with External Dependencies

| Task ID   | Package              | Version Note                                                                      |
| --------- | -------------------- | --------------------------------------------------------------------------------- |
| T001–T006 | trivy (CLI binary)   | Pinned to `v0.59.1`; shared helper centralizes invocation behavior                |
| T014–T015 | trivy release assets | Download pinned `v0.59.1` release assets and verify checksums before installation |

---

## High-Downstream-Impact Tasks

These tasks modify toolchain infrastructure that runs on every commit or every CI build — extra review attention recommended.

| Task ID   | Target                   | Impact          | Description                                                               |
| --------- | ------------------------ | --------------- | ------------------------------------------------------------------------- |
| T011/T012 | .husky/pre-commit        | Every commit    | Adds dependency and staged secret scans; runtime budget must stay bounded |
| T015/T016 | .github/workflows/ci.yml | Every PR        | Adds merge-blocking security gate and downstream dependency edges         |
| T008      | package.json             | Script registry | 5 new script entries under valid infra namespace                          |
