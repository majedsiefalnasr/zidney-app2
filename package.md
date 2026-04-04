# Package Script Reference

This document consolidates every root runner in `package.json` into one decision-making reference: what it does, which flags are baked into the runner, what depends on it, where it is invoked, and whether it is safe to remove.

Refresh this file with `bun run dev:generate:package-docs`.

## How To Read This File

- `Power` is the practical blast-radius label for the runner itself, not the underlying implementation file.
- `critical` means CI, install lifecycle, governance, or primary build/test quality paths depend on it.
- `medium` means it is part of normal developer workflows or is a composition alias, but the current scan did not find direct workflow enforcement.
- `low` means the runner looks optional, debug/demo-oriented, or placeholder-like.
- `Used in` is based on a direct invocation scan for `bun run <script>` or `bun <script>`. Documentation-only mentions are intentionally excluded.

- `Updated or generated files` is based on an isolated worktree execution audit for safe non-interactive scripts. Runners that were unsafe, long-running, interactive, or wrapper-only are marked as not audited automatically.
- `CI flag` distinguishes between explicit `--ci` parsing, baseline support via the shared logger, indirect CI support through child runners, and wrapper aliases that do not own a `--ci` mode.

## Summary

- Total root runners: 136
- Critical: 42
- Medium: 94
- Low: 0

## Workflow-Bound Runners

- These runners are invoked directly from `.github/workflows` and should be treated as non-removable until the relevant workflow is changed.
- `typecheck:src`: .github/workflows/ci-type-safety.yml:38, .github/workflows/ci.yml:108
- `typecheck:tests`: .github/workflows/ci-type-safety.yml:41, .github/workflows/ci.yml:111
- `lint`: .github/workflows/ci-type-safety.yml:87, .github/workflows/ci.yml:76
- `build`: .github/workflows/ci.yml:718
- `build:packages`: .github/workflows/ci.yml:105, .github/workflows/ci.yml:67
- `validate:scripts:all`: .github/workflows/architecture-governance.yml:71
- `validate:scripts:naming`: .github/workflows/architecture-governance.yml:161
- `validate:scripts:usage`: .github/workflows/architecture-governance.yml:165
- `validate:scripts:infrastructure`: .github/workflows/architecture-governance.yml:169
- `validate:scripts:ux`: .github/workflows/ci.yml:216
- `arch:audit`: .github/workflows/architecture-governance.yml:59
- `arch:context:build`: .github/workflows/architecture-governance.yml:43
- `arch:context:validate`: .github/workflows/architecture-governance.yml:43
- `arch:diff`: .github/workflows/architecture-governance.yml:63
- `arch:guard`: .github/workflows/ci.yml:146
- `arch:health:ci`: .github/workflows/architecture-governance.yml:67
- `test:e2e:backoffice`: .github/workflows/ci.yml:623
- `test:e2e:frontoffice`: .github/workflows/ci.yml:671
- `test:e2e:mmc`: .github/workflows/ci.yml:575
- `test:integration`: .github/workflows/ci.yml:439
- `test:unit`: .github/workflows/ci.yml:332, .github/workflows/ci.yml:523
- `test:unit:boundaries`: .github/workflows/ci.yml:335
- `dev:backoffice`: .github/workflows/ci.yml:615
- `dev:frontoffice`: .github/workflows/ci.yml:663
- `dev:generate:script-docs`: .github/workflows/architecture-governance.yml:173
- `dev:mmc`: .github/workflows/ci.yml:567
- `ai:context:generate`: .github/workflows/ai-context-validation.yml:53, .github/workflows/ai-context-validation.yml:83
- `ai:context:refresh`: .github/workflows/ai-context-validation.yml:63, .github/workflows/ci.yml:150
- `ai:context:validate`: .github/workflows/ai-context-validation.yml:73
- `ai:guard`: .github/workflows/architecture-governance.yml:55
- `ai:runtime:status`: .github/workflows/ci.yml:153
- `ai:validate`: .github/workflows/architecture-governance.yml:126
- `infra:security:ci`: .github/workflows/ci.yml:274
- `governance:gate:ci`: .github/workflows/architecture-governance.yml:192
- `policy:check`: .github/workflows/policy-check.yml:31
- `repo:doctor`: .github/workflows/ci.yml:187

## Script Inventory

### \_comments

- Group: Misc
- Command: `bun run _comments`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run _comments -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### prepare

- Group: Lifecycle
- Command: `bun run prepare`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run prepare -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### typecheck

- Group: Quality
- Command: `bun run typecheck`
- Power: critical
- Purpose: Run both source and test TypeScript checks.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): typecheck:src, typecheck:tests.
- Usage:
  - Primary purpose: Run both source and test TypeScript checks.
  - Flags: none baked into this runner. You can append more args with `bun run typecheck -- <args>` only if the underlying tool supports them.
- Depends on: `typecheck:tests`, `typecheck:src`
- Used by other root scripts: `typecheck:tests`, `validate:types`
- Used in:
  - Workflows: None found
  - Other files: package.json:24, scripts/dev/repo-doctor.ts:232, scripts/policy-engine/adapters/type-safety.adapter.ts:160, scripts/policy-engine/adapters/type-safety.adapter.ts:4, scripts/policy-engine/adapters/type-safety.adapter.ts:49, scripts/policy-engine/adapters/type-safety.adapter.ts:84, scripts/policy-engine/adapters/type-safety.adapter.ts:90, scripts/policy-engine/adapters/type-safety.adapter.ts:92, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:761
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: typecheck:tests, validate:types.

### typecheck:src

- Group: Quality
- Command: `bun run typecheck:src`
- Power: critical
- Purpose: Run the TypeScript compiler in type-check-only mode.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the TypeScript compiler in type-check-only mode.
  - Flag `--noEmit`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: `typecheck`, `typecheck:tests`
- Used in:
  - Workflows: .github/workflows/ci-type-safety.yml:38, .github/workflows/ci.yml:108
  - Other files: package.json:12, package.json:14, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:685, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:702
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: typecheck, typecheck:tests.

### typecheck:tests

- Group: Quality
- Command: `bun run typecheck:tests`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `-p tsconfig.test.json`: Pass an alternate TypeScript project file. Value: tsconfig.test.json.
- Depends on: `typecheck:src`, `typecheck`
- Used by other root scripts: `typecheck`
- Used in:
  - Workflows: .github/workflows/ci-type-safety.yml:41, .github/workflows/ci.yml:111
  - Other files: package.json:12, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:685
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: typecheck.

### lint

- Group: Quality
- Command: `bun run lint`
- Power: critical
- Purpose: Run Biome checks across the repository.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Biome checks across the repository.
  - Flags: none baked into this runner. You can append more args with `bun run lint -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci-type-safety.yml:87, .github/workflows/ci.yml:76
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci-type-safety.yml, .github/workflows/ci.yml.

### lint:fix

- Group: Quality
- Command: `bun run lint:fix`
- Power: medium
- Purpose: Run Biome checks and write fixable changes.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Biome checks and write fixable changes.
  - Flag `--write .`: Runner-level option passed directly to the underlying tool. Value: ..
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### format:write

- Group: Quality
- Command: `bun run format:write`
- Power: medium
- Purpose: Format files with Biome.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Format files with Biome.
  - Flag `--write .`: Runner-level option passed directly to the underlying tool. Value: ..
  - Flag `--write **/*.{md,yaml,yml}`: Runner-level option passed directly to the underlying tool. Value: \*_/_.{md,yaml,yml}.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/reports/script-refactor-report.json:103, docs/reports/script-refactor-report.json:13, docs/reports/script-refactor-report.json:153, docs/reports/script-refactor-report.json:163, docs/reports/script-refactor-report.json:168, docs/reports/script-refactor-report.json:18, docs/reports/script-refactor-report.json:188, docs/reports/script-refactor-report.json:38, docs/reports/script-refactor-report.json:48, docs/reports/script-refactor-report.json:73, docs/reports/script-refactor-report.json:83, scripts/dev/refactor-scripts.ts:190, +1 more
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### format:check

- Group: Quality
- Command: `bun run format:check`
- Power: medium
- Purpose: Run both Biome and Prettier checks without writing changes.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run both Biome and Prettier checks without writing changes.
  - Flag `--check **/*.{md,yaml,yml}`: Check-only mode; fail if drift exists. Value: \*_/_.{md,yaml,yml}.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/reports/script-refactor-report.json:173, docs/reports/script-refactor-report.json:178, docs/reports/script-refactor-report.json:23, docs/reports/script-refactor-report.json:28, docs/reports/script-refactor-report.json:53, docs/reports/script-refactor-report.json:63, docs/reports/script-refactor-report.json:93, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:428
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### build

- Group: Build
- Command: `bun run build`
- Power: critical
- Purpose: Run workspace build scripts across all workspaces.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: No dedicated `--ci` flag is exposed at this alias level.
- Usage:
  - Primary purpose: Run workspace build scripts across all workspaces.
  - Flag `--workspaces build`: Runner-level option passed directly to the underlying tool. Value: build.
- Depends on: None
- Used by other root scripts: `build:packages`
- Used in:
  - Workflows: .github/workflows/ci.yml:718
  - Other files: apps/api/package.json:8, apps/worker/package.json:8, package.json:21, packages/api-client/package.json:12, packages/domain-core/package.json:41, packages/job-queue/package.json:24, packages/logger/package.json:31, packages/redis-utils/package.json:14, packages/types/package.json:8, packages/validation/package.json:8, scripts/validate/detect-broken-scripts.ts:46, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:232, +9 more
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: build:packages.

### build:api

- Group: Build
- Command: `bun run build:api`
- Power: medium
- Purpose: Build a specific workspace.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: No dedicated `--ci` flag is exposed at this alias level.
- Usage:
  - Primary purpose: Build a specific workspace.
  - Flag `--cwd apps/api`: Runner-level option passed directly to the underlying tool. Value: apps/api.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### build:packages

- Group: Build
- Command: `bun run build:packages`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: No dedicated `--ci` flag is exposed at this alias level.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `-lc for d in packages/*; do if [ -f "$d/package.json" ]; then (cd "$d" && echo "Building $d" && bun run build) || exit 1; fi; done`: Runner-level option passed directly to the underlying tool. Value: for d in packages/\*; do if [ -f "$d/package.json" ]; then (cd "$d" && echo "Building $d" && bun run build) || exit 1; fi; done.
- Depends on: `build`
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:105, .github/workflows/ci.yml:67
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### \_validate

- Group: Misc
- Command: `bun run _validate`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run _validate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### validate:workflows

- Group: Validation
- Command: `bun run validate:workflows`
- Power: critical
- Purpose: Validate GitHub Actions workflow files.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Validate GitHub Actions workflow files.
  - Flag `-type f`: Runner-level option passed directly to the underlying tool. Value: f.
  - Flag `-name *.yml`: Runner-level option passed directly to the underlying tool. Value: \*.yml.
  - Flag `-o`: Runner-level option passed directly to the underlying tool.
  - Flag `-name *.yaml`: Runner-level option passed directly to the underlying tool. Value: \*.yaml.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### validate:types

- Group: Validation
- Command: `bun run validate:types`
- Power: critical
- Purpose: Run TypeScript checks plus the architecture type-safety guard.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): typecheck, arch:type-safety-guard.
- Usage:
  - Primary purpose: Run TypeScript checks plus the architecture type-safety guard.
  - Flag `--json`: Emit machine-readable JSON output.
- Depends on: `arch:type-safety-guard`, `typecheck`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### validate:tsconfig

- Group: Validation
- Command: `bun run validate:tsconfig`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run validate:tsconfig -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### validate:ai-context-fresh

- Group: Validation
- Command: `bun run validate:ai-context-fresh`
- Power: medium
- Purpose: Check that the AI context mini artifact exists and is not older than 24 hours
- Source: `scripts/validate/ai-context-fresh.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:ai-context-fresh`
- Usage:
  - Primary purpose: Check that the AI context mini artifact exists and is not older than 24 hours
  - Flags: none baked into this runner. You can append more args with `bun run validate:ai-context-fresh -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `ai:context:validate`
- Used in:
  - Workflows: None found
  - Other files: package.json:103, scripts/generate/**tests**/package-docs.test.ts:39, scripts/validate/**tests**/runtime-scripts.test.ts:28, scripts/validate/ai-context-fresh.ts:8, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:38
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: ai:context:validate.

### validate:ai-context-schemas

- Group: Validation
- Command: `bun run validate:ai-context-schemas`
- Power: medium
- Purpose: Validate that all required AI context JSON artifacts exist and are valid JSON
- Source: `scripts/validate/ai-context-schemas.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:ai-context-schemas`
- Usage:
  - Primary purpose: Validate that all required AI context JSON artifacts exist and are valid JSON
  - Flags: none baked into this runner. You can append more args with `bun run validate:ai-context-schemas -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `ai:context:validate`
- Used in:
  - Workflows: None found
  - Other files: package.json:103, scripts/generate/**tests**/package-docs.test.ts:39, scripts/validate/ai-context-schemas.ts:8, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:38
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: ai:context:validate.

### validate:orchestrator:handoffs

- Group: Validation
- Command: `bun run validate:orchestrator:handoffs`
- Power: medium
- Purpose: Validates orchestrator handoff targets against the declared agent registry and checks delegated skills are listed in the loaded-skills section.
- Source: `scripts/validate/orchestrator-handoffs.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:orchestrator:handoffs`
- Usage:
  - Primary purpose: Validates orchestrator handoff targets against the declared agent registry and checks delegated skills are listed in the loaded-skills section.
  - Flags: none baked into this runner. You can append more args with `bun run validate:orchestrator:handoffs -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/validate/orchestrator-handoffs.ts:8
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### validate:scripts:all

- Group: Validation
- Command: `bun run validate:scripts:all`
- Power: critical
- Purpose: Orchestrator that runs all script-system validators sequentially. Composes: runtime-scripts, detect-broken-scripts, spec-sync, docs-drift. Also enforces the Script Evolution Guard: if package.json scripts changed in the current git diff, the migration-map must have been updated too. Exits non-zero on the first failure. Prints a timing summary.
- Source: `scripts/validate/index.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scripts:all`
- Usage:
  - Primary purpose: Orchestrator that runs all script-system validators sequentially. Composes: runtime-scripts, detect-broken-scripts, spec-sync, docs-drift. Also enforces the Script Evolution Guard: if package.json scripts changed in the current git diff, the migration-map must have been updated too. Exits non-zero on the first failure. Prints a timing summary.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:all -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:71
  - Other files: docs/reports/script-refactor-report.json:128, docs/reports/script-refactor-report.json:133, docs/reports/script-refactor-report.json:138, docs/reports/script-refactor-report.json:143, docs/reports/script-refactor-report.json:213, docs/reports/script-refactor-report.json:218, docs/reports/script-refactor-report.json:223, docs/reports/script-refactor-report.json:228, docs/scripts/migration-map.json:90, scripts/policy-engine/adapters/script-governance.adapter.ts:4, scripts/policy-engine/adapters/script-governance.adapter.ts:53, scripts/validate/detect-broken-scripts.ts:8, +2 more
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### validate:scripts:fast

- Group: Validation
- Command: `bun run validate:scripts:fast`
- Power: medium
- Purpose: CI guard: hard-blocks (exit 1) when any bun run <script> reference in the project (outside specs, .gitnexus, and reports) is absent from root package.json. References inside those dirs generate warnings but exit 0. Exits 0 when no critical issues found.
- Source: `scripts/validate/runtime-scripts.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scripts:all`
- Usage:
  - Primary purpose: CI guard: hard-blocks (exit 1) when any bun run <script> reference in the project (outside specs, .gitnexus, and reports) is absent from root package.json. References inside those dirs generate warnings but exit 0. Exits 0 when no critical issues found.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:fast -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/migration-map.json:94
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### validate:scripts:naming

- Group: Validation
- Command: `bun run validate:scripts:naming`
- Power: critical
- Purpose: Validates all package.json script keys conform to the <domain>:<action>[:<scope>] naming convention. Allowed domains: db, arch, validate, ai, ci, repo, dev, infra, test, governance, policy. Lifecycle-exempt names are skipped. Reports ALL violations before exiting non-zero.
- Source: `scripts/validate/script-naming.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scripts:naming`
- Usage:
  - Primary purpose: Validates all package.json script keys conform to the <domain>:<action>[:<scope>] naming convention. Allowed domains: db, arch, validate, ai, ci, repo, dev, infra, test, governance, policy. Lifecycle-exempt names are skipped. Reports ALL violations before exiting non-zero.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:naming -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:161
  - Other files: scripts/validate/**tests**/script-usage.test.ts:124, scripts/validate/**tests**/script-usage.test.ts:51, scripts/validate/script-naming.ts:12, scripts/validate/types.ts:11, scripts/validate/types.ts:42
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### validate:scripts:usage

- Group: Validation
- Command: `bun run validate:scripts:usage`
- Power: critical
- Purpose: Scans all .ts, .json, .yml, .yaml, .md, and .sh files for "bun run <name>" references and validates that every referenced name exists in a package.json scripts block. Reports all broken/orphan references before exiting non-zero.
- Source: `scripts/validate/script-usage.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scripts:usage`
- Usage:
  - Primary purpose: Scans all .ts, .json, .yml, .yaml, .md, and .sh files for "bun run <name>" references and validates that every referenced name exists in a package.json scripts block. Reports all broken/orphan references before exiting non-zero.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:usage -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:165
  - Other files: scripts/validate/script-usage.ts:11
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### validate:scripts:infrastructure

- Group: Validation
- Command: `bun run validate:scripts:infrastructure`
- Power: critical
- Purpose: Validates that all scripts/\*.ts files have the mandatory 5-field metadata header (@script, @domain, @category, @description, @usage) and that the SCRIPT_REGISTRY.md is up-to-date (no drift vs. what the generator would produce). Reports all violations before exiting non-zero.
- Source: `scripts/validate/script-infrastructure.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scripts:infrastructure`
- Usage:
  - Primary purpose: Validates that all scripts/\*.ts files have the mandatory 5-field metadata header (@script, @domain, @category, @description, @usage) and that the SCRIPT_REGISTRY.md is up-to-date (no drift vs. what the generator would produce). Reports all violations before exiting non-zero.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:infrastructure -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:169
  - Other files: scripts/validate/script-infrastructure.ts:11
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### validate:scripts:spec-sync

- Group: Validation
- Command: `bun run validate:scripts:spec-sync`
- Power: medium
- Purpose: Reverse validation: scans all spec files (specs/, docs/) for `bun run <script>` references and verifies each exists in root package.json. Exits non-zero if any referenced script is missing.
- Source: `scripts/validate/spec-sync.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scripts:spec-sync`
- Usage:
  - Primary purpose: Reverse validation: scans all spec files (specs/, docs/) for `bun run <script>` references and verifies each exists in root package.json. Exits non-zero if any referenced script is missing.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:spec-sync -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/validate/spec-sync.ts:10
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### validate:scripts:docs-drift

- Group: Validation
- Command: `bun run validate:scripts:docs-drift`
- Power: medium
- Purpose: Detects scripts in root package.json that have no corresponding documentation file in docs/scripts/. Reports missing docs and exits non-zero when undocumented scripts are found.
- Source: `scripts/validate/docs-drift.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scripts:docs-drift`
- Usage:
  - Primary purpose: Detects scripts in root package.json that have no corresponding documentation file in docs/scripts/. Reports missing docs and exits non-zero when undocumented scripts are found.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:docs-drift -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/validate/docs-drift.ts:10
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### validate:scripts:ux

- Group: Validation
- Command: `bun run validate:scripts:ux`
- Power: critical
- Purpose: Validates scripts for consistent UX, logging, and exit usage.
- Source: `scripts/validate/validate-scripts-ux.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scripts:ux`
- Usage:
  - Primary purpose: Validates scripts for consistent UX, logging, and exit usage.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:ux -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:216
  - Other files: scripts/validate/validate-scripts-ux.ts:8
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### validate:scan:packages

- Group: Validation
- Command: `bun run validate:scan:packages`
- Power: medium
- Purpose: Walk all runtime spec docs and extract unique script references
- Source: `scripts/validate/scan-package-scripts.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scan:packages`
- Usage:
  - Primary purpose: Walk all runtime spec docs and extract unique script references
  - Flags: none baked into this runner. You can append more args with `bun run validate:scan:packages -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/validate/scan-package-scripts.ts:8
- Updated or generated files: Observed in isolated worktree run: specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/runtime-script-scan.json.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### \_arch

- Group: Misc
- Command: `bun run _arch`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run _arch -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:add-module

- Group: Architecture
- Command: `bun run arch:add-module`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture/add-module.ts`
- CI flag: Explicitly rejected in the implementation; this is a local mutation helper and must not run with `--ci`.
- Registered usage: `bun run arch:add-module <module-path>`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:add-module -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/architecture/add-module.ts:31, scripts/architecture/add-module.ts:8, scripts/infra-audit.ts:2238
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:audit

- Group: Architecture
- Command: `bun run arch:audit`
- Power: critical
- Purpose: Monorepo governance scanner — audits Vitest, ESLint, Playwright, import boundaries, and outputs infra-audit-report.json.
- Source: `scripts/infra-audit.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:audit`
- Usage:
  - Primary purpose: Monorepo governance scanner — audits Vitest, ESLint, Playwright, import boundaries, and outputs infra-audit-report.json.
  - Flags: none baked into this runner. You can append more args with `bun run arch:audit -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `arch:governance`, `arch:governance:fix`
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:59
  - Other files: docs/scripts/migration-map.json:82, docs/scripts/migration-map.json:86, package.json:48, package.json:49, scripts/ai-engine/**tests**/run-task.test.ts:197, scripts/ai-engine/**tests**/stale-check.test.ts:169, scripts/ai-engine/**tests**/stale-check.test.ts:91, scripts/ai-engine/**tests**/validate-execution.test.ts:152, scripts/ai-engine/stale-check.ts:44, scripts/ai-engine/stale-check.ts:54, scripts/ai-guard.ts:916, scripts/architecture-guard/hooks/generate-context.ts:5, +10 more
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json, docs/architecture/ARCHITECTURE_DIAGRAMS.md, docs/architecture/graphs/architecture-graph.html, docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json, docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json, docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md, docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md, docs/reports/infra-audit-report.json, docs/architecture/audits/history/audit-1774722803158.json.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: arch:governance, arch:governance:fix.

### arch:check:store-cycles

- Group: Architecture
- Command: `bun run arch:check:store-cycles`
- Power: medium
- Purpose: Runs madge on each app's src/core/state/ to assert zero circular dependencies. Exits with non-zero code on any detected cycle.
- Source: `scripts/check-store-cycles.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:check:store-cycles`
- Usage:
  - Primary purpose: Runs madge on each app's src/core/state/ to assert zero circular dependencies. Exits with non-zero code on any detected cycle.
  - Flags: none baked into this runner. You can append more args with `bun run arch:check:store-cycles -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/check-store-cycles.ts:16, scripts/check-store-cycles.ts:19, scripts/check-store-cycles.ts:8
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:context:build

- Group: Architecture
- Command: `bun run arch:context:build`
- Power: critical
- Purpose: Generates docs/ai/context/gitnexus-context.json via assembleContext(). Uses atomic write (write to .tmp then renameSync) to prevent partial artifact state. Supports --dry-run (print to stdout only), --all (full workspace), --force (skip freshness check and always regenerate).
- Source: `scripts/context/build.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:context:build [-- --dry-run] [-- --all] [-- --force]`
- Usage:
  - Primary purpose: Generates docs/ai/context/gitnexus-context.json via assembleContext(). Uses atomic write (write to .tmp then renameSync) to prevent partial artifact state. Supports --dry-run (print to stdout only), --all (full workspace), --force (skip freshness check and always regenerate).
  - Flags: none baked into this runner. You can append more args with `bun run arch:context:build -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:43
  - Other files: scripts/context/build.ts:11, scripts/context/impact.ts:76, scripts/context/validate.ts:106, scripts/context/validate.ts:50
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### arch:context:changed

- Group: Architecture
- Command: `bun run arch:context:changed`
- Power: medium
- Purpose: Resolves staged changed files via `git diff --cached` and writes the result to docs/ai/context/context-changed.json with a 5-minute freshness cache. Subsequent reads within the cache window skip the git invocation. A clean staging area (no changed files) is a valid state — the artifact is written with an empty changedFiles array rather than exiting non-zero.
- Source: `scripts/context/changed.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:context:changed`
- Usage:
  - Primary purpose: Resolves staged changed files via `git diff --cached` and writes the result to docs/ai/context/context-changed.json with a 5-minute freshness cache. Subsequent reads within the cache window skip the git invocation. A clean staging area (no changed files) is a valid state — the artifact is written with an empty changedFiles array rather than exiting non-zero.
  - Flags: none baked into this runner. You can append more args with `bun run arch:context:changed -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `governance:gate:changed`
- Used in:
  - Workflows: None found
  - Other files: package.json:124, scripts/context/changed.ts:12, scripts/validate/**tests**/script-usage.test.ts:187, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:461
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: governance:gate:changed.

### arch:context:impact

- Group: Architecture
- Command: `bun run arch:context:impact`
- Power: medium
- Purpose: Synthesizes risk indicators from docs/ai/context/gitnexus-context.json, filtered by the staged changed files recorded in context-changed.json. A risk indicator is included when its `affectedBy` set intersects the staged changed files. Writes the result to docs/ai/context/context-impact.json. If context-changed.json does not exist, falls back to the `changedFiles` array embedded in the main context artifact. Output mode: (default) one `indicator.module` per line, sorted alphabetically --json full riskIndicators array as JSON on stdout
- Source: `scripts/context/impact.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:context:impact [-- --json]`
- Usage:
  - Primary purpose: Synthesizes risk indicators from docs/ai/context/gitnexus-context.json, filtered by the staged changed files recorded in context-changed.json. A risk indicator is included when its `affectedBy` set intersects the staged changed files. Writes the result to docs/ai/context/context-impact.json. If context-changed.json does not exist, falls back to the `changedFiles` array embedded in the main context artifact. Output mode: (default) one `indicator.module` per line, sorted alphabetically --json full riskIndicators array as JSON on stdout
  - Flags: none baked into this runner. You can append more args with `bun run arch:context:impact -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/context/impact.ts:18
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:context:validate

- Group: Architecture
- Command: `bun run arch:context:validate`
- Power: critical
- Purpose: Validates docs/ai/context/gitnexus-context.json against docs/ai/gitnexus-context.schema.json. No external schema library (NFR-005). Validation order (stops at first failure): 1. Artifact file exists 2. Valid JSON 3. Schema file exists and is readable 4. All required fields present 5. schemaVersion matches schema.version 6. generatedAt is < maxAgeHours old (default: 24h)
- Source: `scripts/context/validate.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:context:validate`
- Usage:
  - Primary purpose: Validates docs/ai/context/gitnexus-context.json against docs/ai/gitnexus-context.schema.json. No external schema library (NFR-005). Validation order (stops at first failure): 1. Artifact file exists 2. Valid JSON 3. Schema file exists and is readable 4. All required fields present 5. schemaVersion matches schema.version 6. generatedAt is < maxAgeHours old (default: 24h)
  - Flags: none baked into this runner. You can append more args with `bun run arch:context:validate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:43
  - Other files: scripts/context/validate.ts:17
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### arch:diff

- Group: Architecture
- Command: `bun run arch:diff`
- Power: medium
- Purpose: Detect architecture violations in the current change set (PR/staged diff) by comparing changed imports against ARCHITECTURE_CONTRACT.json rules.
- Source: `scripts/architecture-diff.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:diff`
- Usage:
  - Primary purpose: Detect architecture violations in the current change set (PR/staged diff) by comparing changed imports against ARCHITECTURE_CONTRACT.json rules.
  - Flags: none baked into this runner. You can append more args with `bun run arch:diff -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:63
  - Other files: scripts/architecture-diff.ts:8
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### arch:generate

- Group: Architecture
- Command: `bun run arch:generate`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture/generate-architecture-map.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:generate`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:generate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `ai:context:refresh-all`
- Used in:
  - Workflows: None found
  - Other files: package.json:102, scripts/ai-runtime/runtime-status.ts:241, scripts/architecture/generate-architecture-map.ts:8, scripts/architecture/visualize.ts:299
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: ai:context:refresh-all.

### arch:governance

- Group: Architecture
- Command: `bun run arch:governance`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): arch:gitnexus:context, arch:audit.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:governance -- <args>` only if the underlying tool supports them.
- Depends on: `arch:gitnexus:context`, `arch:audit`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/reports/script-refactor-report.json:108, docs/reports/script-refactor-report.json:113, docs/reports/script-refactor-report.json:193, docs/reports/script-refactor-report.json:198
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:governance:fix

- Group: Architecture
- Command: `bun run arch:governance:fix`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): arch:audit.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--fix-map`: Runner-level option passed directly to the underlying tool.
- Depends on: `arch:audit`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/reports/script-refactor-report.json:118, docs/reports/script-refactor-report.json:123, docs/reports/script-refactor-report.json:203, docs/reports/script-refactor-report.json:208, scripts/dev/repo-doctor.ts:125
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:gitnexus:context

- Group: Architecture
- Command: `bun run arch:gitnexus:context`
- Power: medium
- Purpose: Generates a structured GitNexus context JSON artifact from git state and ai-architecture-brain.json for AI orchestrators and CI gates.
- Source: `scripts/gitnexus-context.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:gitnexus:context`
- Usage:
  - Primary purpose: Generates a structured GitNexus context JSON artifact from git state and ai-architecture-brain.json for AI orchestrators and CI gates.
  - Flags: none baked into this runner. You can append more args with `bun run arch:gitnexus:context -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `arch:governance`, `ai:context:refresh-all`
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/migration-map.json:82, package.json:102, package.json:48, scripts/gitnexus-context.ts:15, scripts/gitnexus-context.ts:16, scripts/gitnexus-context.ts:17, scripts/gitnexus-context.ts:18, scripts/gitnexus-context.ts:9, scripts/policy-engine/context/loader.ts:108, scripts/policy-engine/context/loader.ts:140, scripts/policy-engine/context/loader.ts:94, scripts/policy-engine/rules/ai/AI-001.rule.ts:56, +3 more
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/gitnexus-context.json.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: arch:governance, ai:context:refresh-all.

### arch:gitnexus:validate

- Group: Architecture
- Command: `bun run arch:gitnexus:validate`
- Power: medium
- Purpose: Validates the gitnexus-context.json artifact for file presence, structure, semantics, and freshness.
- Source: `scripts/validate/validate-gitnexus.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:gitnexus:validate`
- Usage:
  - Primary purpose: Validates the gitnexus-context.json artifact for file presence, structure, semantics, and freshness.
  - Flags: none baked into this runner. You can append more args with `bun run arch:gitnexus:validate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/validate/validate-gitnexus.ts:8
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:guard

- Group: Architecture
- Command: `bun run arch:guard`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-guard/architecture-guard.ts`
- CI flag: No explicit CI handling detected in the implementation.
- Registered usage: `bun run arch:guard`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:guard -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `governance:gate:changed`
- Used in:
  - Workflows: .github/workflows/ci.yml:146
  - Other files: reports/package-script-audit.json:15, scripts/ai-engine/plan-task.ts:130, scripts/architecture-guard/architecture-guard.ts:8, scripts/dev/hygiene-checks/arch-guard-check.ts:3, scripts/generate/**tests**/script-docs.test.ts:167, scripts/generate/**tests**/script-docs.test.ts:172, scripts/policy-engine/adapters/architecture-guard.adapter.ts:4, scripts/policy-engine/adapters/architecture-guard.adapter.ts:49, tests/unit/policy-engine/adapters/architecture-guard.adapter.test.ts:36
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: governance:gate:changed.

### arch:guard:changed

- Group: Architecture
- Command: `bun run arch:guard:changed`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-guard/architecture-guard.ts`
- CI flag: No explicit CI handling detected in the implementation.
- Registered usage: `bun run arch:guard`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--changed`: Restrict processing to changed files.
- Depends on: None
- Used by other root scripts: `governance:gate:changed`
- Used in:
  - Workflows: None found
  - Other files: package.json:124, scripts/policy-engine/adapters/architecture-guard.adapter.ts:48, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:461
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: governance:gate:changed.

### arch:guard:ci

- Group: Architecture
- Command: `bun run arch:guard:ci`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-guard/architecture-guard.ts`
- CI flag: Dedicated CI runner by name; this entrypoint is already the CI-specific variant.
- Registered usage: `bun run arch:guard`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--ci`: Enable CI-oriented behavior and reporting.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/package-script-audit.json:24
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json, docs/architecture/ARCHITECTURE_DIAGRAMS.md, docs/architecture/graphs/architecture-graph.html, docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json, docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json, docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md, docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md, docs/reports/infra-audit-report.json.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:health

- Group: Architecture
- Command: `bun run arch:health`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-health/architecture-health.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:health`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:health -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/architecture-health/architecture-health.ts:8, scripts/dev/hygiene-checks/arch-guard-check.ts:3, scripts/dev/repo-status.ts:89
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:health:benchmark

- Group: Architecture
- Command: `bun run arch:health:benchmark`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-health/benchmark.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:health:benchmark`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:health:benchmark -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/architecture-health/benchmark.ts:8
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:health:ci

- Group: Architecture
- Command: `bun run arch:health:ci`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-health/architecture-health.ts`
- CI flag: Dedicated CI runner by name; this entrypoint is already the CI-specific variant.
- Registered usage: `bun run arch:health`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--ci`: Enable CI-oriented behavior and reporting.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:67
  - Other files: tests/static/07-architecture-health-governance.test.ts:32
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json, docs/architecture/ARCHITECTURE_DIAGRAMS.md, docs/architecture/graphs/architecture-graph.html, docs/architecture/health/architecture-drift-report.md, docs/architecture/health/architecture-health-summary.md, docs/architecture/health/architecture-health.json, docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json, docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json, docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md, docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md, docs/reports/infra-audit-report.json, docs/architecture/audits/history/audit-1774722807886.json.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### arch:type-safety-guard

- Group: Architecture
- Command: `bun run arch:type-safety-guard`
- Power: medium
- Purpose: Unified architecture guard — runs type safety checks and validates import boundaries using the architecture contract.
- Source: `scripts/type-safety-guard.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:type-safety-guard`
- Usage:
  - Primary purpose: Unified architecture guard — runs type safety checks and validates import boundaries using the architecture contract.
  - Flags: none baked into this runner. You can append more args with `bun run arch:type-safety-guard -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `validate:types`
- Used in:
  - Workflows: None found
  - Other files: package.json:24, scripts/policy-engine/adapters/type-safety.adapter.ts:105, scripts/policy-engine/adapters/type-safety.adapter.ts:122, scripts/policy-engine/adapters/type-safety.adapter.ts:153, scripts/policy-engine/adapters/type-safety.adapter.ts:160, scripts/policy-engine/adapters/type-safety.adapter.ts:4, scripts/type-safety-guard.ts:8, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:761
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: validate:types.

### arch:validate:brain

- Group: Architecture
- Command: `bun run arch:validate:brain`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/governance/validate-architecture-brain.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:validate:brain`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:validate:brain -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/architecture/health/architecture-health.json:180, docs/architecture/health/history/health-2026-03-12T22-54-01-012Z.json:131, docs/architecture/health/history/health-2026-03-15T23-26-58-848Z.json:180, docs/architecture/health/history/health-2026-03-20T21-25-38-263Z.json:418, docs/architecture/health/history/health-2026-03-20T21-25-56-943Z.json:180, docs/architecture/health/history/health-2026-03-25T11-56-09-458Z.json:418, docs/architecture/health/history/health-2026-03-25T11-56-10-315Z.json:180, docs/architecture/health/history/health-2026-04-02T17-49-09-903Z.json:197, scripts/ai-runtime/runtime-status.ts:232, scripts/ai-runtime/runtime-status.ts:250, scripts/architecture-guard/hooks/validate-brain.ts:42, scripts/architecture-health/collectors/validation-governance.ts:52, +3 more
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:visualize

- Group: Architecture
- Command: `bun run arch:visualize`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture/visualize.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:visualize`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:visualize -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/architecture/visualize.ts:256, scripts/architecture/visualize.ts:8, tests/static/06-architecture-visualization.test.ts:31, tests/static/06-architecture-visualization.test.ts:41, tests/static/06-architecture-visualization.test.ts:46, tests/static/06-architecture-visualization.test.ts:5, tests/static/06-architecture-visualization.test.ts:51, tests/static/06-architecture-visualization.test.ts:54, tests/static/06-architecture-visualization.test.ts:9
- Updated or generated files: Observed in isolated worktree run: docs/architecture/visualization/README.md.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### \_test

- Group: Misc
- Command: `bun run _test`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run _test -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test

- Group: Testing
- Command: `bun run test`
- Power: critical
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flags: none baked into this runner. You can append more args with `bun run test -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `test:e2e`
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: test:e2e.

### test:coverage

- Group: Testing
- Command: `bun run test:coverage`
- Power: medium
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--coverage`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test:e2e

- Group: Testing
- Command: `bun run test:e2e`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): test:e2e:mmc, test:e2e:backoffice, test:e2e:frontoffice.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run test:e2e -- <args>` only if the underlying tool supports them.
- Depends on: `test:e2e:frontoffice`, `test:e2e:backoffice`, `test:e2e:mmc`, `test`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: tests/e2e/app-load.spec.ts:16
- Updated or generated files: Not audited automatically: browser/end-to-end workflow.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test:e2e:backoffice

- Group: Testing
- Command: `bun run test:e2e:backoffice`
- Power: critical
- Purpose: Run Playwright end-to-end tests for the configured app.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Playwright end-to-end tests for the configured app.
  - Flag `--config apps/backoffice/playwright.config.ts`: Runner-level option passed directly to the underlying tool. Value: apps/backoffice/playwright.config.ts.
- Depends on: None
- Used by other root scripts: `test:e2e`
- Used in:
  - Workflows: .github/workflows/ci.yml:623
  - Other files: apps/backoffice/tests/e2e/smoke.spec.ts:10, package.json:64, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:615, tests/e2e/app-load.spec.ts:14
- Updated or generated files: Not audited automatically: browser/end-to-end workflow.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: test:e2e.

### test:e2e:frontoffice

- Group: Testing
- Command: `bun run test:e2e:frontoffice`
- Power: critical
- Purpose: Run Playwright end-to-end tests for the configured app.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Playwright end-to-end tests for the configured app.
  - Flag `--config apps/frontoffice/playwright.config.ts`: Runner-level option passed directly to the underlying tool. Value: apps/frontoffice/playwright.config.ts.
- Depends on: None
- Used by other root scripts: `test:e2e`
- Used in:
  - Workflows: .github/workflows/ci.yml:671
  - Other files: apps/frontoffice/tests/e2e/smoke.spec.ts:10, package.json:64, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:615, tests/e2e/app-load.spec.ts:15
- Updated or generated files: Not audited automatically: browser/end-to-end workflow.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: test:e2e.

### test:e2e:mmc

- Group: Testing
- Command: `bun run test:e2e:mmc`
- Power: critical
- Purpose: Run Playwright end-to-end tests for the configured app.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Playwright end-to-end tests for the configured app.
  - Flag `--config apps/mmc/playwright.config.ts`: Runner-level option passed directly to the underlying tool. Value: apps/mmc/playwright.config.ts.
- Depends on: None
- Used by other root scripts: `test:e2e`
- Used in:
  - Workflows: .github/workflows/ci.yml:575
  - Other files: apps/mmc/tests/e2e/smoke.spec.ts:10, package.json:64, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:615, tests/e2e/app-load.spec.ts:13
- Updated or generated files: Not audited automatically: browser/end-to-end workflow.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: test:e2e.

### test:integration

- Group: Testing
- Command: `bun run test:integration`
- Power: critical
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--project root`: Run only the specified Vitest project. Value: root.
  - Flag `--dir tests/integration`: Target a specific directory. Value: tests/integration.
  - Flag `--fileParallelism=false`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:439
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:migrations

- Group: Testing
- Command: `bun run test:migrations`
- Power: medium
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--dir tests/migrations`: Target a specific directory. Value: tests/migrations.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test:performance

- Group: Testing
- Command: `bun run test:performance`
- Power: medium
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--dir tests/performance`: Target a specific directory. Value: tests/performance.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: tests/performance/licenses.benchmark.test.ts:7
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test:static

- Group: Testing
- Command: `bun run test:static`
- Power: medium
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--dir tests/static`: Target a specific directory. Value: tests/static.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test:tenant

- Group: Testing
- Command: `bun run test:tenant`
- Power: medium
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--dir tests/tenant`: Target a specific directory. Value: tests/tenant.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test:unit

- Group: Testing
- Command: `bun run test:unit`
- Power: critical
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--project mmc`: Run only the specified Vitest project. Value: mmc.
  - Flag `--project backoffice`: Run only the specified Vitest project. Value: backoffice.
  - Flag `--project frontoffice`: Run only the specified Vitest project. Value: frontoffice.
  - Flag `--project api-client`: Run only the specified Vitest project. Value: api-client.
  - Flag `--project domain-core`: Run only the specified Vitest project. Value: domain-core.
  - Flag `--project logger`: Run only the specified Vitest project. Value: logger.
  - Flag `--project config`: Run only the specified Vitest project. Value: config.
  - Flag `--project redis-utils`: Run only the specified Vitest project. Value: redis-utils.
  - Flag `--project types`: Run only the specified Vitest project. Value: types.
  - Flag `--project ui-system`: Run only the specified Vitest project. Value: ui-system.
  - Flag `--project validation`: Run only the specified Vitest project. Value: validation.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:332, .github/workflows/ci.yml:523
  - Other files: docs/scripts/migration-map.json:69, specs/runtime/infra-007-module-boundaries/.workflow-state.json:74
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:unit:boundaries

- Group: Testing
- Command: `bun run test:unit:boundaries`
- Power: critical
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flags: none baked into this runner. You can append more args with `bun run test:unit:boundaries -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:335
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### \_dev

- Group: Misc
- Command: `bun run _dev`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run _dev -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev

- Group: Development
- Command: `bun run dev`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): dev:all.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run dev -- <args>` only if the underlying tool supports them.
- Depends on: `dev:all`
- Used by other root scripts: `dev:all`
- Used in:
  - Workflows: None found
  - Other files: tests/unit/policy-engine/rules/SCRIPTS-001.test.ts:48
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: dev:all.

### dev:all

- Group: Development
- Command: `bun run dev:all`
- Power: medium
- Purpose: Start multiple long-running development services in parallel.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Not applicable as a `--ci` flag; this is a long-running wrapper or service launcher.
- Usage:
  - Primary purpose: Start multiple long-running development services in parallel.
  - Flags: none baked into this runner. You can append more args with `bun run dev:all -- <args>` only if the underlying tool supports them.
- Depends on: `dev:frontoffice`, `dev:backoffice`, `dev:worker`, `dev:api`, `dev:mmc`, `dev`
- Used by other root scripts: `dev`
- Used in:
  - Workflows: None found
  - Other files: package.json:76, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:334
- Updated or generated files: Not audited automatically: long-running service launcher.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: dev.

### dev:analyze:directory-sizes

- Group: Development
- Command: `bun run dev:analyze:directory-sizes`
- Power: medium
- Purpose: Measure key repository directory sizes and highlight the largest contributors to repository bloat.
- Source: `scripts/dev/analyze-directory-sizes.ts`
- CI flag: No explicit `--ci` handling detected in the implementation.
- Registered usage: `bun run dev:analyze:directory-sizes`
- Usage:
  - Primary purpose: Measure key repository directory sizes and highlight the largest contributors to repository bloat.
  - Flags: none baked into this runner. You can append more args with `bun run dev:analyze:directory-sizes -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/analyze-directory-sizes.ts:9
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:analyze:file-sizes

- Group: Development
- Command: `bun run dev:analyze:file-sizes`
- Power: medium
- Purpose: Analyze repository files by size and line count to identify oversized files that need optimization.
- Source: `scripts/dev/analyze-file-sizes.ts`
- CI flag: No explicit `--ci` handling detected in the implementation.
- Registered usage: `bun run dev:analyze:file-sizes`
- Usage:
  - Primary purpose: Analyze repository files by size and line count to identify oversized files that need optimization.
  - Flags: none baked into this runner. You can append more args with `bun run dev:analyze:file-sizes -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/analyze-file-sizes.ts:9
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:api

- Group: Development
- Command: `bun run dev:api`
- Power: medium
- Purpose: Start a specific workspace development process.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Not applicable as a `--ci` flag; this is a long-running wrapper or service launcher.
- Usage:
  - Primary purpose: Start a specific workspace development process.
  - Flag `--cwd apps/api`: Runner-level option passed directly to the underlying tool. Value: apps/api.
- Depends on: None
- Used by other root scripts: `dev:all`
- Used in:
  - Workflows: None found
  - Other files: package.json:77, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340
- Updated or generated files: Not audited automatically: long-running service launcher.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: dev:all.

### dev:backoffice

- Group: Development
- Command: `bun run dev:backoffice`
- Power: critical
- Purpose: Start a specific workspace development process.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Not applicable as a `--ci` flag; this is a long-running wrapper or service launcher.
- Usage:
  - Primary purpose: Start a specific workspace development process.
  - Flag `--cwd apps/backoffice`: Runner-level option passed directly to the underlying tool. Value: apps/backoffice.
- Depends on: None
- Used by other root scripts: `dev:all`
- Used in:
  - Workflows: .github/workflows/ci.yml:615
  - Other files: apps/backoffice/playwright.config.ts:9, apps/backoffice/tests/e2e/smoke.spec.ts:9, package.json:77, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340
- Updated or generated files: Not audited automatically: long-running service launcher.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: dev:all.

### dev:benchmark:ci

- Group: Development
- Command: `bun run dev:benchmark:ci`
- Power: medium
- Purpose: Benchmark CI pipeline duration assumptions, generate markdown performance reports, and write a dashboard snapshot.
- Source: `scripts/dev/benchmark-ci-duration.ts`
- CI flag: Dedicated CI runner by name; this entrypoint is already the CI-specific variant.
- Registered usage: `bun run dev:benchmark:ci`
- Usage:
  - Primary purpose: Benchmark CI pipeline duration assumptions, generate markdown performance reports, and write a dashboard snapshot.
  - Flags: none baked into this runner. You can append more args with `bun run dev:benchmark:ci -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/benchmark-ci-duration.ts:8
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:demo:logger

- Group: Development
- Command: `bun run dev:demo:logger`
- Power: medium
- Purpose: Demonstrates all available logger customization options and features
- Source: `scripts/dev/demo-logger-features.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run dev:demo:logger`
- Usage:
  - Primary purpose: Demonstrates all available logger customization options and features
  - Flags: none baked into this runner. You can append more args with `bun run dev:demo:logger -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/demo-logger-features.ts:8
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:deps:verify

- Group: Development
- Command: `bun run dev:deps:verify`
- Power: medium
- Purpose: Scan the codebase for dependency usage patterns and produce a conservative unused-dependency candidate report.
- Source: `scripts/dev/verify-dependency-usage.ts`
- CI flag: No explicit `--ci` handling detected in the implementation.
- Registered usage: `bun run dev:deps:verify`
- Usage:
  - Primary purpose: Scan the codebase for dependency usage patterns and produce a conservative unused-dependency candidate report.
  - Flags: none baked into this runner. You can append more args with `bun run dev:deps:verify -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/verify-dependency-usage.ts:9
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:frontoffice

- Group: Development
- Command: `bun run dev:frontoffice`
- Power: critical
- Purpose: Start a specific workspace development process.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Not applicable as a `--ci` flag; this is a long-running wrapper or service launcher.
- Usage:
  - Primary purpose: Start a specific workspace development process.
  - Flag `--cwd apps/frontoffice`: Runner-level option passed directly to the underlying tool. Value: apps/frontoffice.
- Depends on: None
- Used by other root scripts: `dev:all`
- Used in:
  - Workflows: .github/workflows/ci.yml:663
  - Other files: apps/frontoffice/playwright.config.ts:9, apps/frontoffice/tests/e2e/smoke.spec.ts:9, package.json:77, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340
- Updated or generated files: Not audited automatically: long-running service launcher.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: dev:all.

### dev:generate:package-docs

- Group: Development
- Command: `bun run dev:generate:package-docs`
- Power: medium
- Purpose: Refresh root package.md from package.json, repo invocation scans, and optional detached-worktree audit evidence.
- Source: `scripts/generate/package-docs.ts`
- CI flag: Explicitly rejected in the implementation.
- Registered usage: `bun run dev:generate:package-docs [-- --audit=ai:validate,arch:guard:ci]`
- Usage:
  - Primary purpose: Refresh root package.md from package.json, repo invocation scans, and optional detached-worktree audit evidence.
  - Flags: none baked into this runner. You can append more args with `bun run dev:generate:package-docs -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/generate/package-docs.ts:8, scripts/generate/package-docs.ts:917
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:generate:script-docs

- Group: Development
- Command: `bun run dev:generate:script-docs`
- Power: critical
- Purpose: Walk scripts/\*_\/_.ts, parse @script metadata headers, generate docs/scripts/SCRIPT_REGISTRY.md. Exits 1 on missing required metadata fields.
- Source: `scripts/generate/script-docs.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run dev:generate:script-docs [-- --check-only] [--ci]`
- Usage:
  - Primary purpose: Walk scripts/\*_\/_.ts, parse @script metadata headers, generate docs/scripts/SCRIPT_REGISTRY.md. Exits 1 on missing required metadata fields.
  - Flags: none baked into this runner. You can append more args with `bun run dev:generate:script-docs -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:173
  - Other files: scripts/generate/**tests**/script-docs.test.ts:25, scripts/generate/**tests**/script-docs.test.ts:94, scripts/generate/**tests**/script-docs.test.ts:99, scripts/generate/script-docs.ts:11, scripts/generate/script-docs.ts:533, scripts/generate/script-docs.ts:574, scripts/generate/script-docs.ts:794, scripts/validate/docs-drift.ts:155, scripts/validate/script-infrastructure.ts:147, scripts/validate/script-infrastructure.ts:205
- Updated or generated files: Observed in isolated worktree run: docs/scripts/SCRIPT_REGISTRY.md.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### dev:hygiene:report

- Group: Development
- Command: `bun run dev:hygiene:report`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/dev/hygiene-report-generator.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run dev:hygiene:report`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run dev:hygiene:report -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/hygiene-report-generator.ts:8
- Updated or generated files: Isolated worktree run failed before any tracked file changes were observed.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:infra

- Group: Development
- Command: `bun run dev:infra`
- Power: medium
- Purpose: Start the local infrastructure stack in detached mode.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Not applicable as a `--ci` flag; this is a long-running wrapper or service launcher.
- Usage:
  - Primary purpose: Start the local infrastructure stack in detached mode.
  - Flag `-d`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: long-running service launcher.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:mmc

- Group: Development
- Command: `bun run dev:mmc`
- Power: critical
- Purpose: Start a specific workspace development process.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Not applicable as a `--ci` flag; this is a long-running wrapper or service launcher.
- Usage:
  - Primary purpose: Start a specific workspace development process.
  - Flag `--cwd apps/mmc`: Runner-level option passed directly to the underlying tool. Value: apps/mmc.
- Depends on: None
- Used by other root scripts: `dev:all`
- Used in:
  - Workflows: .github/workflows/ci.yml:567
  - Other files: apps/mmc/playwright.config.ts:9, apps/mmc/tests/e2e/smoke.spec.ts:9, package.json:77, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340
- Updated or generated files: Not audited automatically: long-running service launcher.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: dev:all.

### dev:profile:scripts

- Group: Development
- Command: `bun run dev:profile:scripts`
- Power: medium
- Purpose: Profile governance script execution times across repeated runs to establish a performance baseline.
- Source: `scripts/dev/profile-script-performance.ts`
- CI flag: No explicit `--ci` handling detected in the implementation.
- Registered usage: `bun run dev:profile:scripts [runs=10]`
- Usage:
  - Primary purpose: Profile governance script execution times across repeated runs to establish a performance baseline.
  - Flags: none baked into this runner. You can append more args with `bun run dev:profile:scripts -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/profile-script-performance.ts:9
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:refactor:scripts

- Group: Development
- Command: `bun run dev:refactor:scripts`
- Power: medium
- Purpose: Applies the SCRIPT_MIGRATION_MAP to rename all "bun run <old>" references across the repository. Reads docs/scripts/SCRIPT_MIGRATION_MAP.md, builds the old→new rename index, then rewrites all matching files in-place. Supports --dry-run to preview changes without writing. Exits 1 if any unresolved references remain after the run. Writes a summary report to reports/SCRIPT_REFACTOR_REPORT.md.
- Source: `scripts/dev/refactor-scripts.ts`
- CI flag: Explicitly rejected in the implementation; this runner rewrites repository files and must not run with `--ci`.
- Registered usage: `bun run refactor-scripts [--dry-run]`
- Usage:
  - Primary purpose: Applies the SCRIPT_MIGRATION_MAP to rename all "bun run <old>" references across the repository. Reads docs/scripts/SCRIPT_MIGRATION_MAP.md, builds the old→new rename index, then rewrites all matching files in-place. Supports --dry-run to preview changes without writing. Exits 1 if any unresolved references remain after the run. Writes a summary report to reports/SCRIPT_REFACTOR_REPORT.md.
  - Flags: none baked into this runner. You can append more args with `bun run dev:refactor:scripts -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/validate/index.ts:120, scripts/validate/index.ts:123, scripts/validate/index.ts:92
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:report:baseline

- Group: Development
- Command: `bun run dev:report:baseline`
- Power: medium
- Purpose: Generate a consolidated baseline diagnostics report for Phase 1 analysis and write it to docs/audit-reports.
- Source: `scripts/dev/generate-baseline-report.ts`
- CI flag: No explicit `--ci` handling detected in the implementation.
- Registered usage: `bun run dev:report:baseline`
- Usage:
  - Primary purpose: Generate a consolidated baseline diagnostics report for Phase 1 analysis and write it to docs/audit-reports.
  - Flags: none baked into this runner. You can append more args with `bun run dev:report:baseline -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/generate-baseline-report.ts:9
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:seed:dashboard-test-data

- Group: Development
- Command: `bun run dev:seed:dashboard-test-data`
- Power: medium
- Purpose: Seed realistic MMC dashboard test data into master_db for dashboard testing
- Source: `scripts/seed/dashboard-test-data.ts`
- CI flag: Explicitly rejected in the implementation; this runner seeds database state and must not run with `--ci`.
- Registered usage: `bun run dev:seed:dashboard-test-data`
- Usage:
  - Primary purpose: Seed realistic MMC dashboard test data into master_db for dashboard testing
  - Flags: none baked into this runner. You can append more args with `bun run dev:seed:dashboard-test-data -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/seed/dashboard-test-data.ts:155, scripts/seed/dashboard-test-data.ts:34, scripts/seed/dashboard-test-data.ts:8
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:validate:script-duplication

- Group: Development
- Command: `bun run dev:validate:script-duplication`
- Power: medium
- Purpose: Measure cross-file duplication within the scripts directory and validate that modularization stays within the target threshold.
- Source: `scripts/dev/validate-script-duplication.ts`
- CI flag: No explicit `--ci` handling detected in the implementation.
- Registered usage: `bun run dev:validate:script-duplication`
- Usage:
  - Primary purpose: Measure cross-file duplication within the scripts directory and validate that modularization stays within the target threshold.
  - Flags: none baked into this runner. You can append more args with `bun run dev:validate:script-duplication -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/validate-script-duplication.ts:9
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:worker

- Group: Development
- Command: `bun run dev:worker`
- Power: medium
- Purpose: Start a specific workspace development process.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Not applicable as a `--ci` flag; this is a long-running wrapper or service launcher.
- Usage:
  - Primary purpose: Start a specific workspace development process.
  - Flag `--cwd apps/worker`: Runner-level option passed directly to the underlying tool. Value: apps/worker.
- Depends on: None
- Used by other root scripts: `dev:all`
- Used in:
  - Workflows: None found
  - Other files: package.json:77, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340
- Updated or generated files: Not audited automatically: long-running service launcher.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: dev:all.

### dev:ai:archive-snapshots

- Group: Development
- Command: `bun run dev:ai:archive-snapshots`
- Power: medium
- Purpose: Maintain a rolling archive of historical AI context snapshots, keeping the latest artifacts live and archiving older ones with indexes.
- Source: `scripts/dev/archive-snapshot-strategy.ts`
- CI flag: No explicit `--ci` handling detected in the implementation.
- Registered usage: `bun run dev:ai:archive-snapshots`
- Usage:
  - Primary purpose: Maintain a rolling archive of historical AI context snapshots, keeping the latest artifacts live and archiving older ones with indexes.
  - Flags: none baked into this runner. You can append more args with `bun run dev:ai:archive-snapshots -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/archive-snapshot-strategy.ts:8
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:ai:context-artifacts

- Group: Development
- Command: `bun run dev:ai:context-artifacts`
- Power: medium
- Purpose: Analyze AI context artifacts for size, compression, and redundancy to identify Phase 3 optimization opportunities.
- Source: `scripts/dev/analyze-ai-context-artifacts.ts`
- CI flag: No explicit `--ci` handling detected in the implementation.
- Registered usage: `bun run dev:ai:context-artifacts`
- Usage:
  - Primary purpose: Analyze AI context artifacts for size, compression, and redundancy to identify Phase 3 optimization opportunities.
  - Flags: none baked into this runner. You can append more args with `bun run dev:ai:context-artifacts -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/analyze-ai-context-artifacts.ts:9
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### \_ai

- Group: Misc
- Command: `bun run _ai`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run _ai -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:context:generate

- Group: AI
- Command: `bun run ai:context:generate`
- Power: critical
- Purpose: Generate AI context artifacts (architecture brain, module map, dependency graph). Supports incremental (default), forced, and validate-after-generation modes.
- Source: `scripts/generate-ai-context.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run ai:context:generate`
- Usage:
  - Primary purpose: Generate AI context artifacts (architecture brain, module map, dependency graph). Supports incremental (default), forced, and validate-after-generation modes.
  - Flags: none baked into this runner. You can append more args with `bun run ai:context:generate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ai-context-validation.yml:53, .github/workflows/ai-context-validation.yml:83
  - Other files: scripts/ai-engine/**tests**/context-loader.test.ts:39, scripts/ai-engine/**tests**/context-loader.test.ts:43, scripts/ai-engine/**tests**/plan-task.test.ts:237, scripts/ai-engine/**tests**/run-task.test.ts:245, scripts/ai-engine/context-loader.ts:25, scripts/dev/benchmark-ai-context-warm.ts:74, scripts/dev/generate-ai-context.ts:7, scripts/dev/generate-ai-context.ts:8, scripts/dev/generate-ai-context.ts:9, scripts/generate-ai-context.ts:14, scripts/generate-ai-context.ts:15, scripts/generate-ai-context.ts:16, +3 more
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ai-context-validation.yml.

### ai:context:refresh

- Group: AI
- Command: `bun run ai:context:refresh`
- Power: critical
- Purpose: Generate AI context artifacts (architecture brain, module map, dependency graph). Supports incremental (default), forced, and validate-after-generation modes.
- Source: `scripts/generate-ai-context.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run ai:context:generate`
- Usage:
  - Primary purpose: Generate AI context artifacts (architecture brain, module map, dependency graph). Supports incremental (default), forced, and validate-after-generation modes.
  - Flag `--force`: Bypass freshness checks and force regeneration.
- Depends on: None
- Used by other root scripts: `ai:context:refresh-all`
- Used in:
  - Workflows: .github/workflows/ai-context-validation.yml:63, .github/workflows/ci.yml:150
  - Other files: docs/ci-cd-integration/CACHE_WORKFLOW_EXAMPLE.yml:28, package.json:102, scripts/ai-runtime/runtime-status.ts:112, scripts/ai-runtime/runtime-status.ts:84, scripts/ai-runtime/runtime-status.ts:98, scripts/architecture-guard/hooks/generate-context.ts:10, scripts/dev/benchmark-ai-context-cold.ts:57, scripts/dev/benchmark-ai-context-warm.ts:55, scripts/validate/ai-context-fresh.ts:66, tests/unit/ai-runtime/runtime-status.test.ts:70, tests/unit/ai-runtime/runtime-status.test.ts:97
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: ai:context:refresh-all.

### ai:context:refresh-all

- Group: AI
- Command: `bun run ai:context:refresh-all`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): arch:gitnexus:context, ai:context:validate, ai:context:refresh, arch:generate.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:context:refresh-all -- <args>` only if the underlying tool supports them.
- Depends on: `arch:gitnexus:context`, `ai:context:validate`, `ai:context:refresh`, `arch:generate`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### ai:context:validate

- Group: AI
- Command: `bun run ai:context:validate`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): validate:ai-context-fresh, validate:ai-context-schemas.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:context:validate -- <args>` only if the underlying tool supports them.
- Depends on: `validate:ai-context-schemas`, `validate:ai-context-fresh`
- Used by other root scripts: `ai:context:refresh-all`
- Used in:
  - Workflows: .github/workflows/ai-context-validation.yml:73
  - Other files: package.json:102, scripts/dev/hygiene-checks/ai-context-check.ts:3
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: ai:context:refresh-all.

### ai:guard

- Group: AI
- Command: `bun run ai:guard`
- Power: critical
- Purpose: Enforces architecture rules (import boundaries, contract compliance) before AI-generated commits and in CI.
- Source: `scripts/ai-guard.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run ai:guard`
- Usage:
  - Primary purpose: Enforces architecture rules (import boundaries, contract compliance) before AI-generated commits and in CI.
  - Flags: none baked into this runner. You can append more args with `bun run ai:guard -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:55
  - Other files: scripts/ai-guard.ts:7, scripts/dev/**tests**/refactor-scripts.test.ts:107, scripts/dev/**tests**/refactor-scripts.test.ts:122, scripts/dev/**tests**/refactor-scripts.test.ts:149
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### ai:plan

- Group: AI
- Command: `bun run ai:plan`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/ai-engine/plan-task.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run ai:plan --task "<task-description>"`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:plan -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/ai-engine/plan-task.ts:9
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:run

- Group: AI
- Command: `bun run ai:run`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/ai-engine/run-task.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run ai:run --task "<task-description>"`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:run -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/ai-engine/run-task.ts:8
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:runtime:status

- Group: AI
- Command: `bun run ai:runtime:status`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: `scripts/ai-runtime/runtime-status.ts`
- CI flag: No explicit CI handling detected in the implementation.
- Registered usage: `bun run ai:runtime:status`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:runtime:status -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:153
  - Other files: scripts/ai-runtime/runtime-status.ts:8
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### ai:validate

- Group: AI
- Command: `bun run ai:validate`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/ai-engine/validate-execution.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run ai:validate`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:validate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:126
  - Other files: reports/package-script-audit.json:6, scripts/ai-engine/plan-task.ts:144, scripts/ai-engine/validate-execution.ts:8, scripts/generate/**tests**/package-docs.test.ts:22, scripts/generate/**tests**/package-docs.test.ts:29, scripts/generate/**tests**/package-docs.test.ts:55, tests/integration/ai-engine/validate-execution.integration.test.ts:4, tests/integration/ai-engine/validate-execution.integration.test.ts:48
- Updated or generated files: Audit attempt failed in isolated worktree: `bun run ai:validate -- --ci` exited non-zero before tracked file changes were observed. Output note: error: script "ai:validate" exited with code 4
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### ai:validate:prompts

- Group: AI
- Command: `bun run ai:validate:prompts`
- Power: medium
- Purpose: Validates AI agent and prompt file structural integrity
- Source: `scripts/prompt-qa.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run ai:validate:prompts`
- Usage:
  - Primary purpose: Validates AI agent and prompt file structural integrity
  - Flags: none baked into this runner. You can append more args with `bun run ai:validate:prompts -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/prompt-qa.ts:8
- Updated or generated files: Audit attempt failed in isolated worktree: `bun run ai:validate:prompts --ci` exited non-zero before tracked file changes were observed.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### \_db

- Group: Misc
- Command: `bun run _db`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run _db -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### db:console

- Group: Database
- Command: `bun run db:console`
- Power: medium
- Purpose: Launch an interactive psql session connected to DATABASE_URL.
- Source: `scripts/db/console.ts`
- CI flag: Explicitly rejected in the implementation; this is an interactive command and must not run with `--ci`.
- Registered usage: `bun run db:console`
- Usage:
  - Primary purpose: Launch an interactive psql session connected to DATABASE_URL.
  - Flags: none baked into this runner. You can append more args with `bun run db:console -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/db/console.ts:23, scripts/db/console.ts:8
- Updated or generated files: Not audited automatically: requires database connectivity or interactive/manual access.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### db:migrate

- Group: Database
- Command: `bun run db:migrate`
- Power: medium
- Purpose: Validate migration inputs and delegate master migration execution guidance.
- Source: `scripts/db/migrate.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run db:migrate`
- Usage:
  - Primary purpose: Validate migration inputs and delegate master migration execution guidance.
  - Flags: none baked into this runner. You can append more args with `bun run db:migrate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/db/migrate.ts:44, scripts/db/migrate.ts:46, scripts/db/migrate.ts:47, scripts/db/migrate.ts:49, scripts/db/migrate.ts:8, scripts/dev/**tests**/refactor-scripts.test.ts:106, scripts/dev/**tests**/refactor-scripts.test.ts:121, scripts/dev/**tests**/refactor-scripts.test.ts:149, scripts/validate/**tests**/runtime-scripts.test.ts:149, scripts/validate/**tests**/runtime-scripts.test.ts:26, scripts/validate/**tests**/runtime-scripts.test.ts:44, scripts/validate/**tests**/runtime-scripts.test.ts:60, +8 more
- Updated or generated files: Not audited automatically: requires database connectivity or interactive/manual access.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### db:status:pool

- Group: Database
- Command: `bun run db:status:pool`
- Power: medium
- Purpose: Check PostgreSQL connection pool health and report status.
- Source: `scripts/db/pool-status.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run db:status:pool`
- Usage:
  - Primary purpose: Check PostgreSQL connection pool health and report status.
  - Flags: none baked into this runner. You can append more args with `bun run db:status:pool -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/db/pool-status.ts:25, scripts/db/pool-status.ts:8, scripts/validate/**tests**/runtime-scripts.test.ts:27, scripts/validate/**tests**/runtime-scripts.test.ts:74
- Updated or generated files: Not audited automatically: requires database connectivity or interactive/manual access.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### db:validate:licenses

- Group: Database
- Command: `bun run db:validate:licenses`
- Power: medium
- Purpose: Validate license distribution in master_db and report counts by status.
- Source: `scripts/db/validate-licenses.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run db:validate:licenses`
- Usage:
  - Primary purpose: Validate license distribution in master_db and report counts by status.
  - Flags: none baked into this runner. You can append more args with `bun run db:validate:licenses -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/db/validate-licenses.ts:27, scripts/db/validate-licenses.ts:8
- Updated or generated files: Not audited automatically: requires database connectivity or interactive/manual access.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### \_infra

- Group: Misc
- Command: `bun run _infra`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run _infra -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:cache:clean

- Group: Infrastructure
- Command: `bun run infra:cache:clean`
- Power: medium
- Purpose: Remove build caches and temporary output directories to free disk space
- Source: `scripts/maintenance/cache-clean.ts`
- CI flag: Explicitly rejected in the implementation; this is a local cleanup command and must not run with `--ci`.
- Registered usage: `bun run infra:cache:clean`
- Usage:
  - Primary purpose: Remove build caches and temporary output directories to free disk space
  - Flags: none baked into this runner. You can append more args with `bun run infra:cache:clean -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/maintenance/cache-clean.ts:8
- Updated or generated files: Not audited automatically: destructive maintenance command.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security

- Group: Infrastructure
- Command: `bun run infra:security`
- Power: medium
- Purpose: Run a full Trivy filesystem scan and print visible findings without blocking on non-clean results.
- Source: `scripts/security/scan.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run infra:security`
- Usage:
  - Primary purpose: Run a full Trivy filesystem scan and print visible findings without blocking on non-clean results.
  - Flags: none baked into this runner. You can append more args with `bun run infra:security -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/security/scan.ts:8
- Updated or generated files: Not audited automatically: external scanner dependency or long-running security scan.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security:ci

- Group: Infrastructure
- Command: `bun run infra:security:ci`
- Power: critical
- Purpose: Run the CI-equivalent Trivy scan, write a sanitized report, and block on CI-grade findings.
- Source: `scripts/security/scan-ci.ts`
- CI flag: Dedicated CI runner by name; this entrypoint is already the CI-specific variant.
- Registered usage: `bun run infra:security:ci`
- Usage:
  - Primary purpose: Run the CI-equivalent Trivy scan, write a sanitized report, and block on CI-grade findings.
  - Flags: none baked into this runner. You can append more args with `bun run infra:security:ci -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:274
  - Other files: scripts/security/scan-ci.ts:8
- Updated or generated files: Not audited automatically: external scanner dependency or long-running security scan.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### infra:security:config

- Group: Infrastructure
- Command: `bun run infra:security:config`
- Power: medium
- Purpose: Run a Trivy misconfiguration scan and print visible findings without blocking on non-clean results.
- Source: `scripts/security/scan-config.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run infra:security:config`
- Usage:
  - Primary purpose: Run a Trivy misconfiguration scan and print visible findings without blocking on non-clean results.
  - Flags: none baked into this runner. You can append more args with `bun run infra:security:config -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/security/scan-config.ts:8
- Updated or generated files: Not audited automatically: external scanner dependency or long-running security scan.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security:deps

- Group: Infrastructure
- Command: `bun run infra:security:deps`
- Power: medium
- Purpose: Run a dependency-only Trivy scan, warning on MEDIUM findings and blocking on HIGH/CRITICAL vulnerabilities.
- Source: `scripts/security/scan-deps.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run infra:security:deps`
- Usage:
  - Primary purpose: Run a dependency-only Trivy scan, warning on MEDIUM findings and blocking on HIGH/CRITICAL vulnerabilities.
  - Flags: none baked into this runner. You can append more args with `bun run infra:security:deps -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/security/scan-deps.ts:8
- Updated or generated files: Not audited automatically: external scanner dependency or long-running security scan.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security:secrets

- Group: Infrastructure
- Command: `bun run infra:security:secrets`
- Power: medium
- Purpose: Run a Trivy secret scan across the repo or staged files only and block on any detected secret.
- Source: `scripts/security/scan-secrets.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run infra:security:secrets [--staged]`
- Usage:
  - Primary purpose: Run a Trivy secret scan across the repo or staged files only and block on any detected secret.
  - Flags: none baked into this runner. You can append more args with `bun run infra:security:secrets -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/security/scan-secrets.ts:8
- Updated or generated files: Not audited automatically: external scanner dependency or long-running security scan.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### \_governance

- Group: Misc
- Command: `bun run _governance`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run _governance -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### governance:gate

- Group: Governance
- Command: `bun run governance:gate`
- Power: critical
- Purpose: Unified governance gate — composes all guards in sequence (report-all mode)
- Source: `scripts/governance/gate.ts`
- CI flag: Supported explicitly in the implementation; `--ci` is forwarded to child runners.
- Registered usage: `bun run governance:gate`
- Usage:
  - Primary purpose: Unified governance gate — composes all guards in sequence (report-all mode)
  - Flags: none baked into this runner. You can append more args with `bun run governance:gate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/governance/gate-ci.ts:22, scripts/governance/gate.ts:9
- Updated or generated files: Audit attempt failed in isolated worktree: `bun run governance:gate -- --ci` exited non-zero before tracked file changes were observed. Failure path was expected: Type Safety via `validate:types` exited with code 2.
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### governance:gate:changed

- Group: Governance
- Command: `bun run governance:gate:changed`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): arch:context:changed, arch:guard:changed.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run governance:gate:changed -- <args>` only if the underlying tool supports them.
- Depends on: `arch:context:changed`, `arch:guard:changed`, `arch:guard`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### governance:gate:ci

- Group: Governance
- Command: `bun run governance:gate:ci`
- Power: critical
- Purpose: CI variant of the governance gate — runs gate.ts with GitHub Actions annotations
- Source: `scripts/governance/gate-ci.ts`
- CI flag: Dedicated CI runner by name; this entrypoint is already the CI-specific variant.
- Registered usage: `bun run governance:gate:ci`
- Usage:
  - Primary purpose: CI variant of the governance gate — runs gate.ts with GitHub Actions annotations
  - Flags: none baked into this runner. You can append more args with `bun run governance:gate:ci -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:192
  - Other files: reports/package-script-audit.json:48, scripts/generate/**tests**/package-docs.test.ts:69, scripts/governance/gate-ci.ts:9
- Updated or generated files: Audit attempt failed in isolated worktree: `bun run governance:gate:ci` exited non-zero before tracked file changes were observed. Output note: ✖ ::error::Governance gate failed — see output above error: script "governance:gate:ci" exited with code 1
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### governance:report

- Group: Governance
- Command: `bun run governance:report`
- Power: medium
- Purpose: Generates a consolidated governance health report at docs/governance/governance-report.md
- Source: `scripts/governance/report.ts`
- CI flag: Supported explicitly in the implementation; `--ci` is forwarded to child runners.
- Registered usage: `bun run governance:report`
- Usage:
  - Primary purpose: Generates a consolidated governance health report at docs/governance/governance-report.md
  - Flags: none baked into this runner. You can append more args with `bun run governance:report -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/governance/report.ts:9
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json, docs/architecture/ARCHITECTURE_DIAGRAMS.md, docs/architecture/graphs/architecture-graph.html, docs/architecture/health/architecture-drift-report.md, docs/architecture/health/architecture-health-summary.md, docs/architecture/health/architecture-health.json, docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json, docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json, docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md, docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md, docs/reports/infra-audit-report.json, docs/architecture/audits/history/audit-1774722810870.json.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### policy:check

- Group: Policy
- Command: `bun run policy:check`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: `scripts/policy-engine/cli.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run policy:check`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run policy:check -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/policy-check.yml:31
  - Other files: scripts/policy-engine/cli.ts:8
- Updated or generated files: Isolated worktree run failed; files touched before failure: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json, docs/architecture/ARCHITECTURE_DIAGRAMS.md, docs/architecture/graphs/architecture-graph.html, docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json, docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json, docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md, docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md, docs/reports/infra-audit-report.json, docs/architecture/audits/history/audit-1774722812109.json.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/policy-check.yml.

### policy:check:full

- Group: Policy
- Command: `bun run policy:check:full`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: `scripts/policy-engine/cli.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run policy:check`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--full`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Isolated worktree run failed before any tracked file changes were observed.
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### \_ci

- Group: Misc
- Command: `bun run _ci`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run _ci -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:local

- Group: CI
- Command: `bun run ci:local`
- Power: medium
- Purpose: Run or inspect GitHub Actions workflows locally with act.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run or inspect GitHub Actions workflows locally with act.
  - Flag `--pull=false`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/ci/setup-act-local.sh:126
- Updated or generated files: Not audited automatically: local GitHub Actions simulation wrapper.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:local:dry

- Group: CI
- Command: `bun run ci:local:dry`
- Power: medium
- Purpose: Validate GitHub Actions workflow files.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Validate GitHub Actions workflow files.
  - Flags: none baked into this runner. You can append more args with `bun run ci:local:dry -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: local GitHub Actions simulation wrapper.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:local:full

- Group: CI
- Command: `bun run ci:local:full`
- Power: medium
- Purpose: Run or inspect GitHub Actions workflows locally with act.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run or inspect GitHub Actions workflows locally with act.
  - Flag `--pull`: Runner-level option passed directly to the underlying tool.
  - Flag `--reuse=false`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/ci/setup-act-local.sh:127
- Updated or generated files: Not audited automatically: local GitHub Actions simulation wrapper.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:local:job

- Group: CI
- Command: `bun run ci:local:job`
- Power: medium
- Purpose: Run or inspect GitHub Actions workflows locally with act.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run or inspect GitHub Actions workflows locally with act.
  - Flag `-j`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: local GitHub Actions simulation wrapper.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:local:list

- Group: CI
- Command: `bun run ci:local:list`
- Power: medium
- Purpose: Run or inspect GitHub Actions workflows locally with act.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run or inspect GitHub Actions workflows locally with act.
  - Flag `-l`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/ci/setup-act-local.sh:128
- Updated or generated files: Not audited automatically: local GitHub Actions simulation wrapper.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:local:workflow

- Group: CI
- Command: `bun run ci:local:workflow`
- Power: medium
- Purpose: Run or inspect GitHub Actions workflows locally with act.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run or inspect GitHub Actions workflows locally with act.
  - Flag `-W .github/workflows`: Runner-level option passed directly to the underlying tool. Value: .github/workflows.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: local GitHub Actions simulation wrapper.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:run-local

- Group: CI
- Command: `bun run ci:run-local`
- Power: medium
- Purpose: Local CI governance orchestrator — runs the 7-step pre-closure validation sequence including all governance checks and the full act CI simulation. Step 0 is a Docker fail-fast check; Steps 1–7 are governance checks that run to completion regardless of individual failures (fail-forward).
- Source: `scripts/run-local-ci.ts`
- CI flag: Supported explicitly in the implementation; `--ci` is forwarded only to a strict internal allowlist.
- Registered usage: `bun run ci:run-local`
- Usage:
  - Primary purpose: Local CI governance orchestrator — runs the 7-step pre-closure validation sequence including all governance checks and the full act CI simulation. Step 0 is a Docker fail-fast check; Steps 1–7 are governance checks that run to completion regardless of individual failures (fail-forward).
  - Flags: none baked into this runner. You can append more args with `bun run ci:run-local -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/run-local-ci.ts:11
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:smoke:staging

- Group: CI
- Command: `bun run ci:smoke:staging`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: No dedicated `--ci` flag is exposed at this alias level.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ci:smoke:staging -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:test

- Group: CI
- Command: `bun run ci:test`
- Power: medium
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--reporter=verbose`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### \_repo

- Group: Misc
- Command: `bun run _repo`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run _repo -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### repo:doctor

- Group: Repository
- Command: `bun run repo:doctor`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/dev/repo-doctor.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run repo:doctor`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run repo:doctor -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:187
  - Other files: scripts/dev/repo-doctor.ts:8, tests/integration/dev-scripts/repo-doctor.integration.test.ts:6
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### repo:fix

- Group: Repository
- Command: `bun run repo:fix`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/dev/repo-fix.ts`
- CI flag: Explicitly rejected in the implementation; this is a local repair command and must not run with `--ci`.
- Registered usage: `bun run repo:fix`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run repo:fix -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/repo-fix.ts:8
- Updated or generated files: Not audited automatically: mutates repository state.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### repo:onboard

- Group: Repository
- Command: `bun run repo:onboard`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/dev/repo-onboard.ts`
- CI flag: Explicitly rejected in the implementation; this is a local bootstrap command and must not run with `--ci`.
- Registered usage: `bun run repo:onboard`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run repo:onboard -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/repo-onboard.ts:8
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### repo:status

- Group: Repository
- Command: `bun run repo:status`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/dev/repo-status.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run repo:status`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run repo:status -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/demo-logger-features.ts:65, scripts/dev/demo-logger-features.ts:66, scripts/dev/repo-status.ts:8
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json, docs/architecture/ARCHITECTURE_DIAGRAMS.md, docs/architecture/graphs/architecture-graph.html, docs/architecture/health/architecture-drift-report.md, docs/architecture/health/architecture-health-summary.md, docs/architecture/health/architecture-health.json, docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json, docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json, docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md, docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md, docs/reports/infra-audit-report.json.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### \_other

- Group: Misc
- Command: `bun run _other`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run _other -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### refactor-scripts

- Group: Misc
- Command: `bun run refactor-scripts`
- Power: medium
- Purpose: Applies the migration map to rename all "bun run <old>" references across the repository. Supports both JSON format (docs/scripts/migration-map.json, preferred) and Markdown format (docs/scripts/SCRIPT_MIGRATION_MAP.md, legacy). Builds the old→new rename index, then rewrites all matching files in-place. Supports --dry-run to preview changes without writing. Exits 1 if any unresolved references remain. Writes reports to both reports/SCRIPT_REFACTOR_REPORT.md and docs/reports/script-refactor-report.json.
- Source: `scripts/dev/refactor-scripts.ts`
- CI flag: Explicitly rejected in the implementation.
- Registered usage: `bun run refactor-scripts [--dry-run]`
- Usage:
  - Primary purpose: Applies the migration map to rename all "bun run <old>" references across the repository. Supports both JSON format (docs/scripts/migration-map.json, preferred) and Markdown format (docs/scripts/SCRIPT_MIGRATION_MAP.md, legacy). Builds the old→new rename index, then rewrites all matching files in-place. Supports --dry-run to preview changes without writing. Exits 1 if any unresolved references remain. Writes reports to both reports/SCRIPT_REFACTOR_REPORT.md and docs/reports/script-refactor-report.json.
  - Flags: none baked into this runner. You can append more args with `bun run refactor-scripts -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/refactor-scripts.ts:15
- Updated or generated files: Not audited automatically: mutates repository state.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.
