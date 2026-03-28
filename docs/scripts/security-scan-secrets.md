# infra:security:secrets

## Command

```sh
bun run infra:security:secrets
bun run infra:security:secrets --staged
```

## Purpose

Runs Trivy secret detection across the full repository or staged files only. The staged mode is
used by pre-commit so secret enforcement stays bounded to the commit payload.

Repo-wide scans operate on tracked files only. Staged mode operates on the git index snapshot.

## Trigger Context

- Mandatory pre-commit staged secret gate
- Manual repository secret sweep

## Execution Mode

`manual` and `pre-commit`

## Severity Policy

Any secret finding exits 1. Output includes rule type and file path, but never retains or echoes
the secret value itself.

## Prerequisites

- Trivy `v0.69.3` or a CLI-compatible version available on `PATH`
- A git repository when using `--staged`

## Output

- Human-readable summary to stdout
- No retained report file

## Failure Modes

| Scenario                | Exit Code | Behavior                                    |
| ----------------------- | --------- | ------------------------------------------- |
| Staged file unavailable | non-zero  | Temp materialization fails closed           |
| Secret detected         | 1         | Commit or manual run stops immediately      |
| Invalid JSON output     | non-zero  | Script fails closed and reports parse error |
