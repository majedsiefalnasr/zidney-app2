# infra:security:config

## Command

```sh
bun run infra:security:config
```

## Purpose

Runs the Trivy misconfiguration scanner against the repository filesystem to surface
infrastructure issues in Docker, Compose, Terraform, and related IaC assets.

Scans use tracked working-tree content so findings reflect repository-managed infrastructure files.

## Trigger Context

- Manual infrastructure hardening review
- Docker or Terraform change verification before push

## Execution Mode

`manual`

## Severity Policy

Always exits 0 after printing findings. MEDIUM/HIGH/CRITICAL issues remain visible in stdout so
developers can inspect infrastructure hardening work without turning this command into a blocking
local gate.

## Prerequisites

- Trivy `v0.69.3` or a CLI-compatible version available on `PATH`
- Tracked infrastructure files in the working tree

## Output

- Human-readable summary to stdout
- File path or target recorded in each finding line

## Failure Modes

| Scenario            | Exit Code | Behavior                           |
| ------------------- | --------- | ---------------------------------- |
| Trivy missing       | non-zero  | Shell/runtime failure              |
| Invalid JSON output | non-zero  | Script fails closed                |
| Findings detected   | 0         | Findings printed for manual review |
