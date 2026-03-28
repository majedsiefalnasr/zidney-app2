# infra:security:deps

## Command

```sh
bun run infra:security:deps
```

## Purpose

Runs the dependency-only Trivy vulnerability scan used by local pre-commit enforcement. MEDIUM
findings are warnings; HIGH and CRITICAL dependency vulnerabilities block the command.

The scan runs against tracked working-tree content so local `node_modules` and untracked files do
not distort results.

## Trigger Context

- Mandatory pre-commit dependency gate
- Manual dependency triage before pushing or merging

## Execution Mode

`manual` and `pre-commit`

## Severity Policy

- LOW: suppressed
- MEDIUM: warning only
- HIGH/CRITICAL: blocking

## Prerequisites

- Trivy `v0.69.3` or a CLI-compatible version available on `PATH`
- A tracked lockfile or dependency manifest for vulnerability analysis

## Output

- Human-readable summary to stdout
- Package name and vulnerability identifier included for blocking findings

## Exit Semantics

| Finding level | Exit Code |
| ------------- | --------- |
| None / MEDIUM | 0         |
| HIGH/CRITICAL | 1         |

## Failure Modes

| Scenario            | Exit Code | Behavior                            |
| ------------------- | --------- | ----------------------------------- |
| Trivy missing       | non-zero  | Hook or shell fails before scanning |
| Invalid JSON output | non-zero  | Script fails closed                 |
| Blocking CVE found  | 1         | Commit/CI stops with package + CVE  |
