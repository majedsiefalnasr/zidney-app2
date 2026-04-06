# arch:audit

## Command

```sh
bun run arch:audit
```

## Purpose

Monorepo governance scanner — audits Vitest, ESLint, Playwright, import boundaries, and outputs infra-audit-report.json.

## Why It Exists

This runner is currently classified as critical. Not safe to remove directly. Other root scripts depend on it: arch:governance, arch:governance:fix, arch:guard, arch:guard:changed, arch:guard:ci. Its implementation lives in scripts/infra-audit.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run arch:audit`
- Implementation: scripts/infra-audit.ts
- Metadata-backed script file: `scripts/infra-audit.ts`

## Flags

| Flag               | Type      | Description                                                    | Example                                  |
| ------------------ | --------- | -------------------------------------------------------------- | ---------------------------------------- |
| `--quick`          | `boolean` | —                                                              | `bun run arch:audit -- --quick`          |
| `--check-only`     | `boolean` | Validate without writing any files. Exits 1 on drift.          | `bun run arch:audit -- --check-only`     |
| `--ci`             | `boolean` | Enable CI non-interactive mode. Disables spinners and prompts. | `bun run arch:audit -- --ci`             |
| `--ci-strict`      | `boolean` | —                                                              | `bun run arch:audit -- --ci-strict`      |
| `--generate-graph` | `boolean` | —                                                              | `bun run arch:audit -- --generate-graph` |
| `--incremental`    | `boolean` | —                                                              | `bun run arch:audit -- --incremental`    |
| `--fix-map`        | `boolean` | —                                                              | `bun run arch:audit -- --fix-map`        |

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: `arch:governance`, `arch:governance:fix`, `arch:guard`, `arch:guard:changed`, `arch:guard:ci`

## Audit Notes

- Observed in isolated worktree run: docs/architecture/ARCHITECTURE_DIAGRAMS.md, docs/architecture/graphs/architecture-graph.html, docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json, docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json, docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md, docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md, docs/reports/infra-audit-report.json.
