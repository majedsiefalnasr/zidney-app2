# Specification Quality Checklist: Trivy Security Scanning and Enforcement

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-03-23
**Feature**: [spec.md](../spec.md)
**Stage**: INFRA-026

---

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders (infra-team perspective used for user stories)
- [x] All mandatory sections completed

---

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

---

## Implementation Quality Gates

### Script Delivery

- [ ] `security:scan` script exists in root `package.json`
- [ ] `security:scan:deps` script exists in root `package.json`
- [ ] `security:scan:secrets` script exists in root `package.json`
- [ ] `security:scan:config` script exists in root `package.json`
- [ ] `security:scan:ci` script exists in root `package.json`
- [ ] All script source files reside under `scripts/security/`
- [ ] Script names conform to `security:<action>[:scope]` convention

### Severity Policy Enforcement

- [ ] `security:scan:ci` exits with code 1 on HIGH findings
- [ ] `security:scan:ci` exits with code 1 on CRITICAL findings
- [ ] `security:scan:ci` exits with code 0 on MEDIUM-only findings
- [ ] `security:scan:ci` exits with code 0 on clean scan
- [ ] MEDIUM findings produce warning output without blocking CI
- [ ] LOW findings are fully suppressed (no output)

### Pre-Commit Integration

- [ ] Pre-commit hook invokes dependency scan on commit
- [ ] Pre-commit hook blocks commit on HIGH vulnerability detection
- [ ] Pre-commit hook blocks commit on CRITICAL vulnerability detection
- [ ] Pre-commit hook blocks commit when secrets are detected
- [ ] Pre-commit hook does NOT disable or replace any existing hook
- [ ] Pre-commit scan completes within 30 seconds on developer machine

### CI Integration

- [ ] GitHub Actions workflow contains `Trivy Security Scan` step
- [ ] CI step placement is after dependency installation
- [ ] CI step placement is before build and test steps
- [ ] CI step invokes `security:scan:ci`
- [ ] CI step fails the workflow on HIGH findings
- [ ] CI step fails the workflow on CRITICAL findings
- [ ] CI step fails the workflow when secrets are detected
- [ ] CI scan completes within 3 minutes on standard runner
- [ ] Trivy version is pinned in CI workflow

### Orchestrator Integration

- [ ] Orchestrator Step 5 (Analyze) executes Trivy and captures structured output
- [ ] Orchestrator Step 6.5 (Validation Gate) reads Trivy output
- [ ] Orchestrator gate blocks execution on CRITICAL findings
- [ ] Orchestrator gate blocks execution on detected secrets
- [ ] Orchestrator gate does NOT re-run Trivy independently (consumes Step 5 output)
- [ ] Existing orchestrator steps are not broken by integration

### Configuration

- [ ] `.trivyignore` file exists at repository root
- [ ] Trivy configuration is consistent across all five scan scripts
- [ ] Trivy invocation approach (system binary vs. container) is documented

### Documentation

- [ ] `docs/scripts/security-scan.md` exists
- [ ] `docs/scripts/security-scan-deps.md` exists
- [ ] `docs/scripts/security-scan-secrets.md` exists
- [ ] `docs/scripts/security-scan-config.md` exists
- [ ] `docs/scripts/security-scan-ci.md` exists
- [ ] Each doc includes: Purpose section
- [ ] Each doc includes: Usage command section
- [ ] Each doc includes: Trigger context section (CI / dev / orchestrator)
- [ ] Each doc includes: Severity policy table

### Governance Validation

- [ ] `bun scripts/ai-guard.ts` passes with no new violations
- [ ] `bun scripts/infra-audit.ts` passes with no new violations
- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] Script governance validation passes (no naming convention violations)

### Baseline Health

- [ ] `bun run security:scan:ci` on current `main` branch exits with code 0 (clean baseline)
- [ ] All five scan scripts executable locally without errors on clean repository

---

## Notes

- Items marked incomplete require implementation before `/speckit.plan` can proceed
- Pre-commit scan is intentionally scoped to deps-only to stay within 30s limit — full scan runs in CI
- `.trivyignore` suppressions require documented approval process (process definition is out of scope for this stage but the file must exist)
- Trivy version pinning is mandatory — underpinned tooling is a supply-chain risk (SC-001)
- Secret scanner output must never echo secret values — only path, line, and type (SC-004)
