# Feature Specification: Trivy Security Scanning and Enforcement

**Feature Branch**: `spec/infra-026-trivy-security-scanning-and-enforcement`
**Stage File**: `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md`
**Created**: 2026-03-23
**Status**: Draft
**Phase**: 01_PLATFORM_FOUNDATION
**Stage ID**: INFRA-026

---

## Feature Summary

Introduce repository-wide automated security scanning and enforcement using Trivy across the Zidney monorepo. This stage establishes security as a first-class gate at three enforcement layers: pre-commit (fast fail), CI pipeline (full scan), and orchestrator gate (blocking). It ensures no vulnerable dependencies, committed secrets, or insecure infrastructure configuration can reach runtime.

**Objective**: Transform Zidney from governance-complete to security-hardened platform.

**Scope Type**: INFRA — no tenant isolation concerns, no database migrations, no worker jobs.

---

## User Scenarios & Testing

### User Story 1 — Developer Receives Immediate Feedback on Vulnerable Dependencies (Priority: P1)

An infrastructure engineer or developer runs a pre-commit action after modifying `package.json` or lock files. The pre-commit hook executes a fast dependency scan. If HIGH or CRITICAL vulnerabilities are found, the commit is blocked with a diagnostic message identifying the affected package(s) and severity level.

**Why this priority**: Catching vulnerabilities at commit time prevents them from ever reaching CI or production. It is the fastest and cheapest enforcement layer.

**Independent Test**: Can be fully tested by running `bun run security:scan:deps` against a fixture directory containing a known-vulnerable `package.json`, then verifying exit code 1 and diagnostic output.

**Acceptance Scenarios**:

1. **Given** a developer has staged changes to a file that introduces a HIGH-severity dependency, **When** the pre-commit hook runs, **Then** the commit is blocked and the terminal displays the affected package name, CVE identifier, and severity level.
2. **Given** a developer has staged changes with no vulnerable dependencies, **When** the pre-commit hook runs, **Then** the security scan exits with code 0 and the commit proceeds normally.
3. **Given** a developer's staged changes include a MEDIUM-severity dependency vulnerability, **When** the pre-commit hook runs, **Then** a warning is displayed but the commit is not blocked.
4. **Given** a developer's staged changes include only LOW-severity findings, **When** the pre-commit hook runs, **Then** no output is shown and the commit proceeds normally.

---

### User Story 2 — CI Pipeline Rejects Builds with HIGH or CRITICAL Vulnerabilities (Priority: P1)

When a pull request is opened or a branch is pushed, the CI pipeline runs a full security scan covering dependencies, secrets, and infrastructure configuration. The pipeline fails if any HIGH or CRITICAL findings are detected, blocking merge until they are resolved.

**Why this priority**: CI is the authoritative enforcement gate — it provides full-scope coverage independent of local developer tooling.

**Independent Test**: Can be fully tested by configuring the CI workflow with a branch that has a known HIGH-severity dependency and verifying the check run transitions to failed state.

**Acceptance Scenarios**:

1. **Given** a pull request contains a CRITICAL-severity vulnerability in a dependency, **When** the CI security scan step runs, **Then** the workflow step exits with a non-zero code and the PR check is marked as failed.
2. **Given** a pull request contains a committed secret (API key, token), **When** the CI security scan step runs, **Then** the workflow step fails and reports the file path and type of secret detected.
3. **Given** a pull request contains only MEDIUM-severity findings, **When** the CI security scan step runs, **Then** the step exits with code 0, the findings appear as warnings in the step log, and the PR check passes.
4. **Given** a pull request contains no security findings, **When** the CI security scan step runs, **Then** the step exits successfully and reports a clean result.

---

### User Story 3 — Orchestrator Blocks Execution on CRITICAL Findings (Priority: P2)

The Zidney orchestrator's validation gate (Step 6.5) consumes Trivy output produced during the analysis step (Step 5). If CRITICAL vulnerabilities or committed secrets are detected, the orchestrator halts the entire execution pipeline and surfaces a blocking diagnostic.

**Why this priority**: Provides a last line of defense at the orchestration layer before code changes propagate to production environments.

**Independent Test**: Can be fully tested by invoking the orchestrator with a mocked Trivy output containing CRITICAL findings and asserting execution does not progress past the gate step.

**Acceptance Scenarios**:

1. **Given** the orchestrator's analysis step produces Trivy output with CRITICAL findings, **When** the validation gate is evaluated, **Then** execution is halted and a block report is generated.
2. **Given** the orchestrator's analysis step produces Trivy output with only HIGH findings in a non-blocking context, **When** the validation gate is evaluated, **Then** the orchestrator logs the HIGH findings and continues (HIGH blocks CI but does not hard-block orchestrator).
3. **Given** the orchestrator's analysis step produces a clean Trivy report, **When** the validation gate is evaluated, **Then** execution proceeds to the next step without interruption.

---

### User Story 4 — Infrastructure Engineer Can Run Any Scan Mode Locally (Priority: P2)

A infrastructure or security engineer can run any of the five defined scan scripts locally at any time to diagnose specific aspects: full scan, dependencies only, secrets only, IaC config only, or CI-equivalent scan.

**Why this priority**: Local execution parity with CI lets engineers reproduce and triage failing CI scans without needing to push branches.

**Independent Test**: Can be fully tested by listing all five scripts from `package.json` and running each against the monorepo root, verifying exit codes and output format match expected behavior.

**Acceptance Scenarios**:

1. **Given** a developer runs `bun run security:scan`, **When** it executes, **Then** a full filesystem scan covering dependencies, secrets, and configuration is performed and the report is printed to stdout.
2. **Given** a developer runs `bun run security:scan:deps`, **When** it executes, **Then** only dependency vulnerabilities are scanned and reported.
3. **Given** a developer runs `bun run security:scan:secrets`, **When** it executes, **Then** only secret patterns are scanned and reported, covering all files in the repository.
4. **Given** a developer runs `bun run security:scan:config`, **When** it executes, **Then** only IaC misconfigurations (`docker-compose.yml`, `Dockerfile`, `terraform/`) are scanned and reported.
5. **Given** a developer runs `bun run security:scan:ci`, **When** it executes, **Then** the scan mirrors CI behavior exactly: exits with code 1 if HIGH or CRITICAL findings are present, 0 otherwise.

---

### User Story 5 — Each Script Has a Corresponding Documentation File (Priority: P3)

An infrastructure engineer consulting the repository documentation can find a dedicated documentation file for each security script that explains its purpose, usage, trigger context, and severity policy.

**Why this priority**: Documentation completeness is a governance requirement. Without it, the scripts cannot be maintained or operationally used by rotating team members.

**Independent Test**: Can be tested by verifying that `docs/scripts/security-scan.md`, `security-scan-deps.md`, `security-scan-secrets.md`, `security-scan-config.md`, and `security-scan-ci.md` all exist and contain all required sections.

**Acceptance Scenarios**:

1. **Given** a developer opens any `docs/scripts/security-*.md` file, **When** they read it, **Then** they can find the script's purpose, usage command, trigger context, and the full severity policy table.
2. **Given** a new team member encounters a failing CI security scan, **When** they consult the documentation, **Then** they understand how to reproduce it locally, what the exit codes mean, and what severity levels require action.

---

### Edge Cases

- What happens when Trivy is not installed in the CI environment? The CI step must include a Trivy installation step or use a pre-installed runner image before scanning.
- What happens when `security:scan:ci` is run locally by a developer against a clean codebase? It must exit 0 and produce no alarming output.
- How does the system handle binary files or large files that may slow secret scanning? Trivy's default skip patterns must be validated to not cause scan timeout in CI.
- What happens when a vulnerability is a known false positive? The stage should document that `.trivyignore` is the suppression mechanism, but the process of approving suppressions is out of scope for this stage.
- What happens when the pre-commit hook and CI both run simultaneously (e.g., during a fast push)? Both are independent and idempotent — no coordination required.

---

## Requirements

### Functional Requirements

**Script Delivery**

- **FR-001**: The monorepo MUST provide a `security:scan` script that performs a full filesystem scan covering dependency vulnerabilities, secret patterns, and IaC misconfigurations.
- **FR-002**: The monorepo MUST provide a `security:scan:deps` script that scans only for dependency vulnerabilities.
- **FR-003**: The monorepo MUST provide a `security:scan:secrets` script that scans only for committed secrets and sensitive data patterns.
- **FR-004**: The monorepo MUST provide a `security:scan:config` script that scans only for IaC misconfigurations.
- **FR-005**: The monorepo MUST provide a `security:scan:ci` script that mirrors CI enforcement exactly — exits with code 1 when HIGH or CRITICAL findings are present, 0 otherwise.
- **FR-006**: All script source files MUST reside under `scripts/security/`.
- **FR-007**: All scripts MUST be registered in the root `package.json` using the naming convention `security:<action>[:scope]`.

**Severity Policy**

- **FR-008**: The security scanning system MUST apply the following severity policy:
  - LOW: suppress entirely (no output, no exit code change)
  - MEDIUM: display as warning, exit code 0
  - HIGH: display as error, CI step exits with code 1
  - CRITICAL: display as error, CI step exits with code 1, orchestrator hard-blocks execution
- **FR-009**: The severity policy MUST be consistently applied across all scan scripts.

**Pre-Commit Integration**

- **FR-010**: The pre-commit hook system MUST invoke `security:scan:deps` on staged changes (or full repo scan if staged scope is unavailable).
- **FR-011**: The pre-commit hook MUST block commit if HIGH or CRITICAL vulnerabilities are detected.
- **FR-012**: The pre-commit hook MUST block commit if any secrets are detected.
- **FR-013**: Pre-commit security extensions MUST integrate via the existing precommit-diagnostics infrastructure without replacing or disabling existing hooks.

**CI Integration**

- **FR-014**: The GitHub Actions CI workflow MUST include a dedicated `Trivy Security Scan` step.
- **FR-015**: The CI security scan step MUST run `security:scan:ci` and fail the workflow on HIGH or CRITICAL findings.
- **FR-016**: The CI security scan step MUST run after dependency installation and before build or test steps.
- **FR-017**: The CI workflow MUST report scan findings as step annotations or log output visible in the PR checks interface.

**Orchestrator Integration**

- **FR-018**: The orchestrator analysis step (Step 5) MUST execute Trivy and capture structured output.
- **FR-019**: The orchestrator validation gate (Step 6.5) MUST read Trivy output and block execution if CRITICAL vulnerabilities or secrets are detected.
- **FR-020**: The orchestrator gate MUST NOT duplicate vulnerability classification logic — it MUST consume the output of the scan scripts rather than re-running Trivy independently.

**Configuration**

- **FR-021**: A `.trivyignore` file MUST be present at the repository root to serve as the approved suppression registry.
- **FR-022**: Trivy configuration (scan targets, scanner types, severity filters) MUST be centralized and consistent across all scripts.

**Documentation**

- **FR-023**: Each of the five security scripts MUST have a corresponding documentation file at `docs/scripts/security-<script-name>.md`.
- **FR-024**: Each documentation file MUST include: purpose, usage command, trigger context (CI / dev / orchestrator), and the full severity policy table.

### Non-Functional Requirements

- **NFR-001**: The `security:scan:ci` script MUST complete within 3 minutes on a standard CI runner for the current monorepo size.
- **NFR-002**: The pre-commit security scan MUST complete within 30 seconds to avoid unacceptable developer friction.
- **NFR-003**: All scan scripts MUST be idempotent — repeated invocations with identical inputs MUST produce identical outputs and exit codes.
- **NFR-004**: All scripts MUST be executable in isolation without requiring any external service connectivity beyond the Trivy binary.
- **NFR-005**: Script naming MUST conform strictly to `security:<action>[:scope]` per script-system-governance rules.
- **NFR-006**: Trivy invocation approach (system-installed binary vs. container-based) MUST be explicitly documented and consistent across all environments (local dev, CI).

### Security Considerations

- **SC-001**: Trivy itself MUST be pinned to a specific version to prevent supply-chain attacks via tooling upgrades introducing regressions.
- **SC-002**: `.trivyignore` entries MUST be reviewed and approved through a documented process (process defined externally, file presence enforced here).
- **SC-003**: The secret scanner MUST cover the full repository including configuration files, environment templates, and Terraform files.
- **SC-004**: CI scan logs MUST NOT echo the content of detected secrets — only the file path, line number, and secret type.
- **SC-005**: Trivy scan results MUST NOT be suppressed globally — suppressions must be explicit per-CVE entries in `.trivyignore`.

---

## Constraints and Dependencies

### Hard Constraints

- Scripts MUST follow `security:<action>[:scope]` naming — violating this breaks script-system-governance compliance.
- Scripts MUST live under `scripts/security/` — no security scripts in other directories.
- No business logic changes, database migrations, or tenant-related code changes are in scope.
- Pre-commit integration MUST NOT disable or replace existing hooks.
- CI step placement MUST be after dependency install and before build/test.

### Dependencies

| Dependency                                  | Type                 | Notes                                                           |
| ------------------------------------------- | -------------------- | --------------------------------------------------------------- |
| Trivy binary                                | External tool        | Must be available in CI runner and documented for local install |
| GitHub Actions CI workflow                  | Integration target   | Existing workflow must be extended, not replaced                |
| precommit-diagnostics skill                 | Internal skill       | Pre-commit extension must conform to its patterns               |
| script-system-governance skill              | Internal skill       | All scripts must pass governance validation                     |
| Orchestrator (zidney-orchestrator.agent.md) | Integration target   | Steps 5 and 6.5 must be extended                                |
| Root `package.json`                         | Configuration target | All scripts must be registered here                             |
| `.trivyignore`                              | Configuration file   | Must exist at repo root before CI runs                          |

### Assumptions

- The CI environment (GitHub Actions) supports shell-based Trivy invocation or can install Trivy via a setup step.
- The existing pre-commit hook infrastructure supports extension without full replacement.
- No existing Trivy configuration or `.trivyignore` file exists in the repository (this stage creates them).
- Trivy will be invoked as a CLI tool (not via container) for consistency between local and CI environments.
- The `bun run` prefix is the standard script invocation method across the monorepo.

---

## Out of Scope

- Runtime security monitoring (SIEM, log alerting, anomaly detection)
- WAF or network-layer security controls
- External penetration testing or red-team exercises
- SBOM (Software Bill of Materials) generation — deferred to a follow-up stage
- License compliance enforcement — deferred to a follow-up stage
- Dependency allow/deny policies — deferred to a follow-up stage
- Vulnerability remediation — this stage detects; remediation is a separate workflow
- Container image scanning (beyond Dockerfile static analysis)
- Dynamic application security testing (DAST)
- Secret rotation procedures

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All five security scripts (`security:scan`, `security:scan:deps`, `security:scan:secrets`, `security:scan:config`, `security:scan:ci`) are present in root `package.json` and executable without errors on a clean repository.
- **SC-002**: The CI pipeline fails within 3 minutes when a HIGH-severity dependency is introduced, with the failing package and CVE identified in the step log.
- **SC-003**: The pre-commit hook blocks a commit containing a HIGH-severity dependency within 30 seconds of `git commit` invocation.
- **SC-004**: A committed secret in a test branch causes the CI security scan step to fail and report the secret type and file path without echoing the secret value.
- **SC-005**: All five `docs/scripts/security-*.md` documentation files exist and contain the required sections (purpose, usage, trigger, severity policy).
- **SC-006**: The orchestrator validation gate halts execution when given a Trivy report containing CRITICAL findings, producing a block diagnostic message.
- **SC-007**: `bun run security:scan:ci` run locally on the current main branch exits with code 0 (baseline clean state confirmed).
- **SC-008**: All scripts pass script-system-governance validation (`bun run scripts/governance/validate-scripts.ts` or equivalent) without violations.
- **SC-009**: Running the full governance validation pipeline (`bun scripts/ai-guard.ts && bun scripts/infra-audit.ts && bun run lint && bun run typecheck`) passes with no new violations introduced by this stage.

---

## Risk Assessment

| Risk                                                           | Likelihood | Impact | Mitigation                                                                            |
| -------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------- |
| Trivy not available in CI runner                               | Medium     | High   | Add explicit Trivy install step to CI workflow; document version pinning              |
| Pre-commit scan causes excessive developer friction (>30s)     | Medium     | Medium | Scope pre-commit scan to deps-only; full scan reserved for CI                         |
| False positives in secret scanner block valid commits          | Low        | High   | Establish `.trivyignore` process; document suppression path in docs                   |
| Script naming drift from governance convention                 | Low        | Medium | Script validation enforced via `ai-guard.ts` on every CI run                          |
| Orchestrator integration breaks existing Step 5 behavior       | Low        | High   | Orchestrator changes must be isolated to Step 5 output capture and Step 6.5 gate only |
| Trivy version changes break scan behavior between environments | Medium     | Medium | Pin Trivy version in CI workflow and document required local version                  |
| Security scan timeout in CI on large repo                      | Low        | Medium | Validate scan time against current repo size; add `--timeout` flag if needed          |

---

## Clarifications

### Session 2026-03-23

**Q: How should Trivy be installed in the CI environment — via a pre-built action (e.g. `aquasecurity/trivy-action`), via a manual `curl` install step in the workflow YAML, or via a container-based runner image with Trivy pre-installed?**
**A:** Manual `curl` install step in workflow YAML with a pinned version tag, then call `bun run security:scan:ci`. This avoids abstraction over scripts and keeps the CI step aligned with local dev invocation.
**Impact:** FR-014, FR-015, FR-016, NFR-006, SC-001 (CI step now uses a known install pattern); also resolves the "Trivy not available in CI runner" risk row in Risk Assessment.

---

**Q: Which specific Trivy version should be pinned — latest stable at time of implementation, a hardcoded version frozen for this stage, or a floating minor-version range?**
**A:** Pin to the latest stable release at time of stage implementation. The CI install step will reference a specific version string (e.g. `v0.59.1` or the latest at implementation time). Local installation documented in docs as "install matching version". The `.trivyignore` file plus version in CI YAML serve as the configuration lock.
**Impact:** SC-001 (version pinning requirement), NFR-006 (consistent invocation across environments), Risk Assessment row "Trivy version changes break scan behavior between environments".

---

**Q: Should the pre-commit hook run `security:scan:deps` only on staged changes that touch `package.json` / lock files, or unconditionally on every commit?**
**A:** Run `security:scan:deps` on EVERY commit (not just on package.json changes). Rationale: the 30-second budget is for dependency scanning only (not full scan), and running it unconditionally avoids false confidence when devs add indirect dependencies via transitive imports without touching lock files. Trivy dependency scan on a Bun monorepo completes well within 30s.
**Impact:** FR-010 (pre-commit invocation scope); NFR-002 (30-second pre-commit budget confirmed as achievable for deps-only scan); User Story 1 acceptance scenarios 1–4 (unconditional trigger now explicit).

---

**Q: Should the CI Trivy scan step be added to the existing `ci.yml` workflow as a new step/job, or should a dedicated separate workflow file be created (e.g. `security.yml`)?**
**A:** Add the Trivy step to the EXISTING `ci.yml` workflow, after the dependency install step and before build/test jobs. Do NOT create a separate workflow. If ci.yml has a dedicated security job or a check placeholder, add Trivy there; otherwise insert as a new job step in the main jobs flow.
**Impact:** FR-014, FR-016 (CI placement now unambiguous — no new workflow file); Constraints "CI step placement MUST be after dependency install and before build/test" (confirmed single-file approach).

---

**Q: What output format should the orchestrator's Step 5 Trivy invocation produce — JSON file written to disk (e.g. `tmp/trivy-report.json`), stdout piped directly, or SARIF format?**
**A:** The scan script writes a JSON output file to `tmp/trivy-report.json` (using `trivy fs --format json --output tmp/trivy-report.json`). The orchestrator Step 5 reads this file and Step 6.5 parses it to check for CRITICAL findings. The JSON file is gitignored. This decouples scan execution from orchestrator logic per FR-020.
**Impact:** FR-018, FR-019, FR-020 (orchestrator integration pattern now defined — file-based JSON handoff, not stdout piping); NFR-003 (idempotency preserved — file overwritten on each run); Success Criteria SC-006 (orchestrator gate implementation path clarified).
