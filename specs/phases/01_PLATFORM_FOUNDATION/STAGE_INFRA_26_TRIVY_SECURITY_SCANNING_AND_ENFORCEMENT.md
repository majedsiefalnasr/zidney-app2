# STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT

## Stage Status

Status: DRAFT
Step: specify
Risk Level: UNKNOWN
Last Updated: 2026-03-23T10:05:00Z

Scope Defined:

- Trivy CLI-based security scanning across 5 scan modes
- Pre-commit fast-fail integration (deps-only, ≤30s)
- CI GitHub Actions full scan step (HIGH/CRITICAL fail)
- Orchestrator Step 5 capture + Step 6.5 blocking gate
- 5 scripts in scripts/security/ registered in root package.json
- 5 docs files in docs/scripts/security-\*.md
- .trivyignore at repo root

Deferred Scope:

- SBOM generation (future stage)
- License compliance enforcement (future stage)
- Dependency allow/deny policies (future stage)
- Runtime security monitoring, WAF, DAST, pen testing

Constitutional Compliance:

- Specification drafted — constitutional audit pending

Notes:
Specification complete. Clarification step pending.

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
- Repository filesystem scanning (dependencies + secrets)
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
security:<action>[:scope]
```

### Required Scripts

| Script                  | Purpose                              |
| ----------------------- | ------------------------------------ |
| `security:scan`         | Full filesystem scan                 |
| `security:scan:deps`    | Dependency vulnerabilities           |
| `security:scan:secrets` | Secret detection                     |
| `security:scan:config`  | IaC misconfiguration                 |
| `security:scan:ci`      | CI-safe scan (fail on HIGH/CRITICAL) |

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

await $`trivy fs --scanners vuln,secret,config --severity HIGH,CRITICAL .`;
```

---

## Package.json Integration

```json
{
  "scripts": {
    "security:scan": "bun run scripts/security/scan.ts",
    "security:scan:deps": "trivy fs --scanners vuln .",
    "security:scan:secrets": "trivy fs --scanners secret .",
    "security:scan:config": "trivy config .",
    "security:scan:ci": "trivy fs --exit-code 1 --severity HIGH,CRITICAL ."
  }
}
```

---

## Pre-Commit Integration

Extend precommit-diagnostics:

```bash
bun run security:scan:deps
```

### Fail Conditions

- Vulnerable dependencies detected (HIGH/CRITICAL)
- Secrets detected

---

## CI Integration

### Workflow Step

```yaml
- name: Trivy Security Scan
  run: bun run security:scan:ci
```

### Blocking Rules

Fail CI if:

- HIGH or CRITICAL vulnerabilities exist
- Secrets detected

---

## Orchestrator Integration

### Step 5 — Analyze

Security Auditor MUST:

- Consume Trivy output
- Classify risks

### Step 6.5 — Validation Gate

BLOCK execution if:

- CRITICAL vulnerabilities detected
- Secrets detected

---

## Documentation Requirement

Each script MUST be documented:

```
docs/scripts/security-<script>.md
```

Must include:

- Purpose
- Usage
- Trigger (CI / dev / orchestrator)
- Severity policy

---

## Severity Policy

| Severity | Action     |
| -------- | ---------- |
| LOW      | Ignore     |
| MEDIUM   | Warning    |
| HIGH     | CI fail    |
| CRITICAL | Hard block |

---

## Validation

### Required Checks

```bash
bun run security:scan
bun run security:scan:ci
```

---

## Success Criteria

- No missing security scripts
- CI blocks vulnerable builds
- Precommit detects issues early
- Orchestrator enforces security gate
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
