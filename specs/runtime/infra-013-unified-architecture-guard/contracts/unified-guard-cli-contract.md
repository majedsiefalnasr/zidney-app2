# Contract: Unified Guard CLI

## Purpose

Defines the command contract for the stage unified architecture guard entrypoint.

Canonical unified entrypoint:

- `bun run arch:guard`

## Supported Modes

### Development Mode

Command:

```bash
bun run arch:guard
```

Contract:

- Provides warnings-first developer feedback.
- Must not block local iteration on policy warnings in development mode.
- Uses the same rule taxonomy as strict mode for consistency.
- Policy violations in development mode are surfaced as warnings and mapped to verdict `PASS`.
- Contract-breaking execution errors in development mode return verdict `BLOCKED`.

### Strict Mode

Command:

```bash
bun run arch:guard -- --ci
```

Contract:

- Executes complete rule set across governed scope.
- Non-zero exit on any violation.
- Produces deterministic ordering of violations.
- Produces governance verdict vocabulary aligned to repository rules: `PASS` | `BLOCKED`.

### Changed-Files Mode

Command:

```bash
bun run arch:guard -- --changed
```

Contract:

- Starts from changed-file scope.
- Uses impact expansion when dependency graph is available.
- Falls back to strict full scan when incremental prerequisites are unsafe.

## FR-009 Static Governance Checks

The unified guard enforces FR-009 via static governance checks and contract validation, not runtime execution:

- Validate database-per-tenant governance signals in architecture contracts and dependency boundaries.
- Block patterns that imply cross-tenant joins or tenant-bypass data-path assumptions in governed files.
- Validate mandatory workspace-bound license enforcement presence in middleware contract surfaces.
- Block architecture drift by validating map/graph consistency and required context artifacts.

### JSON Output Mode

Command:

```bash
bun run arch:guard -- --output json
```

Contract:

- Writes a single JSON report object to stdout.
- JSON output must include fields required by `violation-report.schema.json`.

## Arguments

Required:

- none

Optional:

- `--ci`
- `--changed`
- `--output json`
- `--modules <comma-separated-module-list>` (advanced scoped validation)

## Exit Codes

- `0`: validation pass
- `1`: validation blocked (violations or contract-breaking errors)

## Determinism Requirements

- Same input tree and arguments must produce the same verdict.
- Violation ordering must be stable by file then rule.
- Fallback reason must be explicit when changed-files mode escalates to full scan.

## Non-Goals

- No runtime license, attempt, or tenant logic execution.
- No mutation of application runtime behavior.
