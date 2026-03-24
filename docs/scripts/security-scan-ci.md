# infra:security:ci

## Command

```sh
bun run infra:security:ci
```

## Purpose

Runs the CI-authoritative Trivy scan, writes a sanitized JSON summary to `tmp/trivy-report.json`,
and enforces repository security policy. This command is used by GitHub Actions and by the
orchestrator security gate.

The scan uses tracked working-tree content so local untracked files do not create false CI
failures.

## Trigger Context

- GitHub Actions `security` job
- Orchestrator validation gate input generation
- Manual local reproduction of CI security behavior

## Execution Mode

`ci`, `manual`, and `orchestrator`

## Severity Policy

- LOW: suppressed
- MEDIUM: warning only
- HIGH/CRITICAL vulnerabilities: blocking
- HIGH/CRITICAL misconfigurations: blocking
- Any secret: blocking

## Prerequisites

- Trivy `v0.59.1` or a CLI-compatible version available on `PATH`
- Writable `tmp/` directory for retained report output

## Output

- Human-readable summary to stdout
- Sanitized report at `tmp/trivy-report.json`

The retained report includes severity, identifier, package or file path metadata, and generated-at
timestamp. It never retains raw matched secret values.

## Exit Semantics

| Condition                                          | Exit Code |
| -------------------------------------------------- | --------- |
| Only MEDIUM findings or clean scan                 | 0         |
| HIGH/CRITICAL dependency vulnerabilities           | 1         |
| HIGH/CRITICAL infrastructure misconfigurations     | 1         |
| Any secret finding                                 | 1         |
| Corrupt or unreadable retained JSON consumed later | non-zero  |

## Failure Modes

| Scenario                  | Exit Code | Behavior                                    |
| ------------------------- | --------- | ------------------------------------------- |
| Trivy missing             | non-zero  | CI job fails before scan execution          |
| Invalid Trivy stdout JSON | non-zero  | Script fails closed                         |
| Blocking findings present | 1         | CI/orchestrator blocks using sanitized data |
