# dev:generate:script-docs

## Command

```sh
bun run dev:generate:script-docs
```

## Purpose

Walk scripts/\*_\/_.ts, parse @script metadata headers, generate docs/scripts/SCRIPT_REGISTRY.md. Exits 1 on missing required metadata fields.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml. Its implementation lives in scripts/generate/script-docs.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:generate:script-docs`
- Implementation: scripts/generate/script-docs.ts
- Metadata-backed script file: `scripts/generate/script-docs.ts`

## Flags

| Flag           | Type      | Description                                           | Example                                            |
| -------------- | --------- | ----------------------------------------------------- | -------------------------------------------------- |
| `--check-only` | `boolean` | Validate without writing any files. Exits 1 on drift. | `bun run dev:generate:script-docs -- --check-only` |
| `--xxx`        | `string`  | —                                                     | `bun run dev:generate:script-docs -- --xxx`        |
| `--save`       | `string`  | —                                                     | `bun run dev:generate:script-docs -- --save`       |

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: docs/scripts/ai-context-refresh-all.md, docs/scripts/ai-context-refresh.md, docs/scripts/ai-context-validate.md, docs/scripts/arch-fix.md, docs/scripts/arch-generate.md, docs/scripts/arch-refresh.md, docs/scripts/build-api.md, docs/scripts/build-packages.md, docs/scripts/build.md, docs/scripts/ci-local-dry.md, docs/scripts/ci-local-full.md, docs/scripts/ci-local-job.md, docs/scripts/ci-local-list.md, docs/scripts/ci-local-workflow.md, docs/scripts/ci-local.md, docs/scripts/ci-smoke-staging.md, docs/scripts/ci-test.md, docs/scripts/dev-all.md, docs/scripts/dev-api.md, docs/scripts/dev-backoffice.md, docs/scripts/dev-frontoffice.md, docs/scripts/dev-infra.md, docs/scripts/dev-mmc.md, docs/scripts/dev-worker.md, docs/scripts/dev.md, docs/scripts/format-check-biome.md, docs/scripts/format.md, docs/scripts/gitnexus-context.md, docs/scripts/governance-gate-changed.md, docs/scripts/lint-fix.md, docs/scripts/lint.md, docs/scripts/prepare.md, docs/scripts/README.md, docs/scripts/SCRIPT_REGISTRY.md, docs/scripts/test-coverage.md, docs/scripts/test-e2e-backoffice.md, docs/scripts/test-e2e-frontoffice.md, docs/scripts/test-e2e-mmc.md, docs/scripts/test-e2e.md, docs/scripts/test-integration.md, docs/scripts/test-migrations.md, docs/scripts/test-performance.md, docs/scripts/test-static.md, docs/scripts/test-tenant.md, docs/scripts/test-unit-boundaries.md, docs/scripts/test-unit.md, docs/scripts/test.md, docs/scripts/typecheck-src.md, docs/scripts/typecheck-tests.md, docs/scripts/typecheck.md, docs/scripts/validate-orchestrator-handoffs.md, docs/scripts/validate-tsconfig.md, docs/scripts/validate-types.md, docs/scripts/validate-workflows.md.
