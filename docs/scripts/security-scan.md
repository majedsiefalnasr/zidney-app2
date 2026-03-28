# infra:security

## Command

```sh
bun run infra:security
```

## Purpose

Runs the full repository Trivy filesystem scan across dependency vulnerabilities, secrets, and
infrastructure misconfigurations. This is the widest local visibility command and is intended for
manual inspection before pushing a branch or when investigating a security regression.

Scans use a tracked-file snapshot of the working tree so results align with repository content
rather than local untracked files or vendored directories.

## Trigger Context

- Manual local inspection before a push
- Security triage after dependency or infrastructure changes

## Execution Mode

`manual`

## Severity Policy

Always exits 0 after printing findings. LOW severities stay suppressed in output; MEDIUM findings
are warnings; HIGH and CRITICAL findings are shown as errors but do not block this informational
command.

## Prerequisites

- Trivy `v0.69.3` installed locally
- Repository dependencies installed with `bun install`

## Output

- Human-readable summary to stdout
- No retained report file

## Failure Modes

| Scenario            | Exit Code | Behavior                                   |
| ------------------- | --------- | ------------------------------------------ |
| Trivy not installed | non-zero  | Shell/runtime failure before scan starts   |
| Invalid Trivy JSON  | non-zero  | Script throws parse error and fails closed |
| Findings detected   | 0         | Findings printed, command remains advisory |
