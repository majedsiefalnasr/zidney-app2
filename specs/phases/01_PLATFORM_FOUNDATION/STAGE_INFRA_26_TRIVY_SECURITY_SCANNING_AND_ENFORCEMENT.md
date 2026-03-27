# STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT

## Stage Status

Status: PRODUCTION READY
Step: closure
Risk Level: LOW
Closure Date: 2026-03-24T01:00:00Z

Drift Analysis: PASSED (all criteria — 100/100 score)
Implementation: COMPLETE (34/34 tasks)
Tasks: 34 / 34 completed

Scope Delivered:

- ✅ `infra:security[:scope]` script surface and shared Trivy helper under `scripts/security/`
- ✅ Repo-wide scans constrained to tracked working-tree content; staged secret enforcement constrained to git index state
- ✅ Checksum-verified, pinned `v0.59.1` Trivy acquisition path for CI
- ✅ Pre-commit dependency and staged-secret enforcement with bounded runtime (12s budget)
- ✅ CI `security` job with downstream gating and sanitized artifact retention (65s budget)
- ✅ Orchestrator Step 5/6.5 sanitized JSON contract with fail-closed parsing semantics
- ✅ Documentation (5 reference docs), automated tests (26 tests), governance validation, and timing verification all PASS

Deferred Scope:

- SBOM generation (future stage)
- License compliance enforcement (future stage)
- Dependency allow/deny policies (future stage)
- Runtime security monitoring, WAF, DAST, pen testing

Constitutional Compliance:

- Architecture score: 100/100 (zero drift, zero violations)
- All Guardian verdicts: PASS (security, performance, QA, code review)
- No cross-layer dependencies introduced
- Tenant isolation unchanged
- Database-per-tenant model unchanged

Notes:
Implementation complete. All acceptance criteria met. Ready for production merge to `develop`.

---

## Objective

Introduce **repository-wide security scanning and enforcement** using Trivy to ensure:

- No vulnerable dependencies reach runtime
- No secrets are committed
- No insecure infrastructure configuration is deployed
- Security becomes a first-class CI + orchestrator gate

This stage transforms Zidney from **governance-complete → security-hardened platform**.

---

## Scope

### In Scope

- Trivy installation and configuration
- Repository tracked-content scanning (dependencies + secrets)
- CI integration (GitHub Actions)
- Pre-commit diagnostics integration
- Orchestrator security gate integration
- Script-system alignment
- Documentation (`docs/scripts/security-*`)

### Out of Scope

- Runtime security monitoring
- WAF / network security
- External penetration testing

---

## Security Model

### Enforcement Layers

1. **Pre-Commit (Fast Fail)**
2. **CI Pipeline (Full Scan)**
3. **Orchestrator Gate (Blocking)**

---

## Script Design (MANDATORY)

### Naming Convention

```
infra:security[:scope]
```

### Required Scripts

| Script                   | Purpose                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| `infra:security`         | Full filesystem scan                                                    |
| `infra:security:deps`    | Dependency vulnerabilities with MEDIUM warnings and HIGH/CRITICAL block |
| `infra:security:secrets` | Secret detection with staged-file mode                                  |
| `infra:security:config`  | IaC misconfiguration                                                    |
| `infra:security:ci`      | Sanitized CI/orchestrator scan summary with blocking exit semantics     |

---

## Script Implementation

### Location

```
scripts/security/
```

### Example

```ts
// scripts/security/scan.ts
import { $ } from "bun";

await $`trivy fs --scanners vuln,secret,misconfig --severity MEDIUM,HIGH,CRITICAL --format json .`;
```

---

## Package.json Integration

```json
{
  "scripts": {
    "infra:security": "bun scripts/security/scan.ts",
    "infra:security:deps": "bun scripts/security/scan-deps.ts",
    "infra:security:secrets": "bun scripts/security/scan-secrets.ts",
    "infra:security:config": "bun scripts/security/scan-config.ts",
    "infra:security:ci": "bun scripts/security/scan-ci.ts"
  }
}
```

---

## Pre-Commit Integration

Extend precommit-diagnostics:

```bash
bun run infra:security:deps
bun run infra:security:secrets --staged
```

### Fail Conditions

- Vulnerable dependencies detected (HIGH/CRITICAL)
- Secrets detected

---

## CI Integration

### Workflow Step

```yaml
- name: Trivy Security Scan
  run: bun run infra:security:ci
```

### Blocking Rules

Fail CI if:

- HIGH or CRITICAL vulnerabilities exist
- HIGH or CRITICAL infrastructure misconfigurations exist
- Secrets detected

---

## Orchestrator Integration

### Step 5 — Analyze

Security Auditor MUST:

- Execute `infra:security:ci` and consume the sanitized `tmp/trivy-report.json` output
- Capture the sanitized report for Step 6.5 gate evaluation without duplicating classification logic

### Step 6.5 — Validation Gate

BLOCK execution if:

- CRITICAL vulnerabilities detected
- CRITICAL infrastructure misconfigurations detected
- Secrets detected
- Report file is missing, unreadable, malformed, or missing required fields

---

## Documentation Requirement

Each script MUST be documented:

```
docs/scripts/security-scan.md
docs/scripts/security-scan-deps.md
docs/scripts/security-scan-secrets.md
docs/scripts/security-scan-config.md
docs/scripts/security-scan-ci.md
```

Must include:

- Purpose
- Usage
- Trigger (CI / dev / orchestrator)
- Severity policy
- Output
- Prerequisites

---

## Severity Policy

| Severity | Action     |
| -------- | ---------- |
| LOW      | Ignore     |
| MEDIUM   | Warning    |
| HIGH     | CI fail    |
| CRITICAL | Hard block |

Secrets: always block in pre-commit, CI, and orchestrator flows.

---

## Validation

### Required Checks

```bash
bun run infra:security
bun run infra:security:deps
bun run infra:security:secrets
bun run infra:security:config
bun run infra:security:ci
bun run validate:scripts:naming
bun run validate:scripts:usage
bun run validate:scripts:infrastructure
bun run dev:generate:script-docs
bun scripts/ai-guard.ts
bun scripts/infra-audit.ts
bun run lint
bun run typecheck
bun run test
```

Required evidence:

- Verify full, deps, secrets, config, and CI scan modes are independently executable.
- Verify pre-commit dependency plus staged-secret path stays within 30 seconds.
- Verify the CI security job stays within 3 minutes on a standard GitHub Actions runner.

---

## Success Criteria

- No missing security scripts or governance-validator failures
- CI blocks vulnerable builds and reports package/CVE or secret metadata correctly
- Pre-commit blocks vulnerable dependencies and staged secrets within budget
- Orchestrator enforces sanitized fail-closed security gate semantics
- Full governance pipeline, including tests, passes after implementation
- Scripts follow governance rules

---

## Follow-Up (Future Stage)

- SBOM generation
- License compliance enforcement
- Dependency allow/deny policies

---

## Notes

- Must align with script-system-governance skill
- Must not duplicate validation logic in orchestrator
- Must integrate with precommit-diagnostics
