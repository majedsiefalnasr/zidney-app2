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

- Total root runners: 121
- Critical: 40
- Medium: 76
- Low: 5

## Workflow-Bound Runners

- These runners are invoked directly from `.github/workflows` and should be treated as non-removable until the relevant workflow is changed.
- `typecheck:src`: .github/workflows/ci-type-safety.yml:38, .github/workflows/ci.yml:112
- `typecheck:tests`: .github/workflows/ci-type-safety.yml:41, .github/workflows/ci.yml:115
- `lint`: .github/workflows/ci-type-safety.yml:87, .github/workflows/ci.yml:78
- `validate:scripts:naming`: .github/workflows/architecture-governance.yml:157
- `validate:scripts:usage`: .github/workflows/architecture-governance.yml:161
- `validate:scripts:infrastructure`: .github/workflows/architecture-governance.yml:165
- `validate:scripts:ux`: .github/workflows/ci.yml:226
- `arch:context:build`: .github/workflows/architecture-governance.yml:43
- `arch:context:validate`: .github/workflows/architecture-governance.yml:43
- `arch:guard`: .github/workflows/ci.yml:152
- `arch:health:ci`: .github/workflows/architecture-governance.yml:67
- `test:unit`: .github/workflows/ci.yml:346, .github/workflows/ci.yml:541
- `test:unit:boundaries`: .github/workflows/ci.yml:349
- `test:integration`: .github/workflows/ci.yml:455
- `test:e2e:mmc`: .github/workflows/ci.yml:595
- `test:e2e:backoffice`: .github/workflows/ci.yml:645
- `test:e2e:frontoffice`: .github/workflows/ci.yml:695
- `build`: .github/workflows/ci.yml:744
- `build:packages`: .github/workflows/ci.yml:109, .github/workflows/ci.yml:69
- `dev:mmc`: .github/workflows/ci.yml:587
- `dev:backoffice`: .github/workflows/ci.yml:637
- `dev:frontoffice`: .github/workflows/ci.yml:687
- `dev:generate:script-docs`: .github/workflows/architecture-governance.yml:169
- `ai:runtime:status`: .github/workflows/ci.yml:159
- `ai:validate`: .github/workflows/architecture-governance.yml:122
- `ai:context:generate`: .github/workflows/ai-context-validation.yml:53, .github/workflows/ai-context-validation.yml:83
- `ai:context:refresh`: .github/workflows/ai-context-validation.yml:63, .github/workflows/ci.yml:156
- `ai:context:validate`: .github/workflows/ai-context-validation.yml:73
- `repo:doctor`: .github/workflows/ci.yml:195
- `infra:security:ci`: .github/workflows/ci.yml:286
- `governance:gate:ci`: .github/workflows/architecture-governance.yml:188
- `policy:check`: .github/workflows/policy-check.yml:31

## Script Inventory

### typecheck

- Group: Quality
- Command: `bun typecheck:src && bun typecheck:tests`
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
  - Other files: package.json:21, scripts/dev/repo-doctor.ts:228, scripts/policy-engine/adapters/type-safety.adapter.ts:160, scripts/policy-engine/adapters/type-safety.adapter.ts:4, scripts/policy-engine/adapters/type-safety.adapter.ts:49, scripts/policy-engine/adapters/type-safety.adapter.ts:84, scripts/policy-engine/adapters/type-safety.adapter.ts:90, scripts/policy-engine/adapters/type-safety.adapter.ts:92, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:761
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: validate:types.

### typecheck:src

- Group: Quality
- Command: `tsc --noEmit`
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
  - Workflows: .github/workflows/ci-type-safety.yml:38, .github/workflows/ci.yml:112
  - Other files: package.json:11, package.json:9, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:685, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:702
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml, .github/workflows/ci-type-safety.yml.

### typecheck:tests

- Group: Quality
- Command: `bun typecheck:src -p tsconfig.test.json`
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
  - Workflows: .github/workflows/ci-type-safety.yml:41, .github/workflows/ci.yml:115
  - Other files: package.json:9, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:685
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml, .github/workflows/ci-type-safety.yml.

### lint

- Group: Quality
- Command: `biome check .`
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
  - Workflows: .github/workflows/ci-type-safety.yml:87, .github/workflows/ci.yml:78
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml, .github/workflows/ci-type-safety.yml.

### lint:fix

- Group: Quality
- Command: `biome check --write .`
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

### format

- Group: Quality
- Command: `bun run format:biome && bun run format:prettier`
- Power: medium
- Purpose: Run both Biome and Prettier formatting passes.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run both Biome and Prettier formatting passes.
  - Flags: none baked into this runner. You can append more args with `bun run format -- <args>` only if the underlying tool supports them.
- Depends on: `format:prettier`, `format:biome`
- Used by other root scripts: `format:check`
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### format:biome

- Group: Quality
- Command: `biome format --write .`
- Power: medium
- Purpose: Format files with Biome.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Format files with Biome.
  - Flag `--write .`: Runner-level option passed directly to the underlying tool. Value: ..
- Depends on: None
- Used by other root scripts: `format`
- Used in:
  - Workflows: None found
  - Other files: package.json:14, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:416
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: format.

### format:prettier

- Group: Quality
- Command: `prettier --write '**/*.{md,yaml,yml}'`
- Power: medium
- Purpose: Format Markdown and YAML-family files with Prettier.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Format Markdown and YAML-family files with Prettier.
  - Flag `--write **/*.{md,yaml,yml}`: Runner-level option passed directly to the underlying tool. Value: \*_/_.{md,yaml,yml}.
- Depends on: None
- Used by other root scripts: `format`
- Used in:
  - Workflows: None found
  - Other files: package.json:14, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:416
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: format.

### format:check

- Group: Quality
- Command: `bun run format:check:biome && bun run format:check:prettier`
- Power: medium
- Purpose: Run both Biome and Prettier checks without writing changes.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run both Biome and Prettier checks without writing changes.
  - Flags: none baked into this runner. You can append more args with `bun run format:check -- <args>` only if the underlying tool supports them.
- Depends on: `format:check:prettier`, `format:check:biome`, `format`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### format:check:biome

- Group: Quality
- Command: `biome format .`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run format:check:biome -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `format:check`
- Used in:
  - Workflows: None found
  - Other files: package.json:17, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:428
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: format:check.

### format:check:prettier

- Group: Quality
- Command: `prettier --check '**/*.{md,yaml,yml}'`
- Power: medium
- Purpose: Check Markdown and YAML-family files against Prettier formatting.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Check Markdown and YAML-family files against Prettier formatting.
  - Flag `--check **/*.{md,yaml,yml}`: Check-only mode; fail if drift exists. Value: \*_/_.{md,yaml,yml}.
- Depends on: None
- Used by other root scripts: `format:check`
- Used in:
  - Workflows: None found
  - Other files: package.json:17, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:428
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: format:check.

### validate:workflows

- Group: Validation
- Command: `find .github/workflows -type f \( -name '*.yml' -o -name '*.yaml' \) | xargs actionlint`
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
- Command: `bun typecheck && bun arch:type-safety-guard --json`
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
- Command: `bash scripts/validate/check-tsconfig-strict.sh`
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
- Command: `bun run scripts/validate/ai-context-fresh.ts`
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
  - Other files: package.json:91, scripts/generate/**tests**/package-docs.test.ts:39, scripts/validate/**tests**/runtime-scripts.test.ts:28, scripts/validate/ai-context-fresh.ts:6, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:38
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: ai:context:validate.

### validate:ai-context-schemas

- Group: Validation
- Command: `bun run scripts/validate/ai-context-schemas.ts`
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
  - Other files: package.json:91, scripts/generate/**tests**/package-docs.test.ts:39, scripts/validate/ai-context-schemas.ts:6, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:38
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: ai:context:validate.

### validate:scripts:runtime

- Group: Validation
- Command: `bun run scripts/validate/runtime-scripts.ts`
- Power: medium
- Purpose: CI guard: hard-blocks (exit 1) when any bun run <script> reference in the project (outside specs, .gitnexus, and reports) is absent from root package.json. References inside those dirs generate warnings but exit 0. Exits 0 when no critical issues found.
- Source: `scripts/validate/runtime-scripts.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scripts:runtime`
- Usage:
  - Primary purpose: CI guard: hard-blocks (exit 1) when any bun run <script> reference in the project (outside specs, .gitnexus, and reports) is absent from root package.json. References inside those dirs generate warnings but exit 0. Exits 0 when no critical issues found.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:runtime -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/validate/runtime-scripts.ts:9
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### validate:scripts:broken

- Group: Validation
- Command: `bun run scripts/validate/detect-broken-scripts.ts`
- Power: medium
- Purpose: Detect missing or broken TypeScript script files referenced in root package.json
- Source: `scripts/validate/detect-broken-scripts.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scripts:broken`
- Usage:
  - Primary purpose: Detect missing or broken TypeScript script files referenced in root package.json
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:broken -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/validate/detect-broken-scripts.ts:6
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### validate:scripts:naming

- Group: Validation
- Command: `bun scripts/validate/script-naming.ts`
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
  - Workflows: .github/workflows/architecture-governance.yml:157
  - Other files: scripts/validate/**tests**/script-usage.test.ts:45, scripts/validate/**tests**/script-usage.test.ts:68, scripts/validate/script-naming.ts:9
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### validate:scripts:usage

- Group: Validation
- Command: `bun scripts/validate/script-usage.ts`
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
  - Workflows: .github/workflows/architecture-governance.yml:161
  - Other files: scripts/validate/script-usage.ts:9
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### validate:scripts:infrastructure

- Group: Validation
- Command: `bun scripts/validate/script-infrastructure.ts`
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
  - Workflows: .github/workflows/architecture-governance.yml:165
  - Other files: scripts/validate/script-infrastructure.ts:9
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### validate:scripts:registry

- Group: Validation
- Command: `bun scripts/validate/diff-script-registry.ts`
- Power: medium
- Purpose: Compare scanned runtime spec script references against root package.json, produce diff report
- Source: `scripts/validate/diff-script-registry.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scripts:registry`
- Usage:
  - Primary purpose: Compare scanned runtime spec script references against root package.json, produce diff report
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:registry -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/validate/diff-script-registry.ts:6
- Updated or generated files: Observed in isolated worktree run: specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### validate:scripts:ux

- Group: Validation
- Command: `bun scripts/validate/validate-scripts-ux.ts`
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
  - Workflows: .github/workflows/ci.yml:226
  - Other files: scripts/validate/validate-scripts-ux.ts:6
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### validate:scan:packages

- Group: Validation
- Command: `bun scripts/validate/scan-package-scripts.ts`
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
  - Other files: scripts/validate/scan-package-scripts.ts:6
- Updated or generated files: Observed in isolated worktree run: specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/runtime-script-scan.json.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:check:store-cycles

- Group: Architecture
- Command: `bun scripts/check-store-cycles.ts`
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
  - Other files: scripts/check-store-cycles.ts:8
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:add-module

- Group: Architecture
- Command: `bun scripts/architecture/add-module.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture/add-module.ts`
- CI flag: Explicitly rejected in the implementation; this is a local mutation helper and must not run with `--ci`.
- Registered usage: `bun run arch:add-module`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:add-module -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/architecture/add-module.ts:23, scripts/infra-audit.ts:2175
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:generate

- Group: Architecture
- Command: `bun scripts/architecture/generate-architecture-map.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture/generate-architecture-map.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:generate`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:generate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/ai-runtime/runtime-status.ts:241, scripts/architecture/visualize.ts:289
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:audit

- Group: Architecture
- Command: `bun scripts/infra-audit.ts`
- Power: critical
- Purpose: Monorepo governance scanner — audits Vitest, ESLint, Playwright, import boundaries, and outputs infra-audit-report.json.
- Source: `scripts/infra-audit.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:audit`
- Usage:
  - Primary purpose: Monorepo governance scanner — audits Vitest, ESLint, Playwright, import boundaries, and outputs infra-audit-report.json.
  - Flags: none baked into this runner. You can append more args with `bun run arch:audit -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `arch:refresh`, `arch:fix`, `arch:audit:check`
- Used in:
  - Workflows: None found
  - Other files: package.json:39, package.json:44, package.json:54, scripts/ai-engine/**tests**/run-task.test.ts:197, scripts/ai-engine/**tests**/stale-check.test.ts:169, scripts/ai-engine/**tests**/stale-check.test.ts:91, scripts/ai-engine/**tests**/validate-execution.test.ts:152, scripts/ai-engine/stale-check.ts:44, scripts/ai-engine/stale-check.ts:54, scripts/architecture/visualize.ts:246, scripts/architecture/visualize.ts:288, scripts/architecture/visualize.ts:322, +5 more
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json, docs/architecture/ARCHITECTURE_DIAGRAMS.md, docs/architecture/graphs/architecture-graph.html, docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json, docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json, docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md, docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md, docs/reports/infra-audit-report.json, docs/architecture/audits/history/audit-1774722803158.json.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: arch:refresh, arch:fix, arch:audit:check.

### arch:gitnexus:context

- Group: Architecture
- Command: `bun scripts/gitnexus-context.ts`
- Power: medium
- Purpose: Generates a structured GitNexus context JSON artifact from git state and ai-architecture-brain.json for AI orchestrators and CI gates.
- Source: `scripts/gitnexus-context.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run arch:gitnexus:context`
- Usage:
  - Primary purpose: Generates a structured GitNexus context JSON artifact from git state and ai-architecture-brain.json for AI orchestrators and CI gates.
  - Flags: none baked into this runner. You can append more args with `bun run arch:gitnexus:context -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `arch:refresh`
- Used in:
  - Workflows: None found
  - Other files: package.json:39, scripts/gitnexus-context.ts:13, scripts/gitnexus-context.ts:14, scripts/gitnexus-context.ts:15, scripts/gitnexus-context.ts:16, scripts/gitnexus-context.ts:7, scripts/policy-engine/context/loader.ts:108, scripts/policy-engine/context/loader.ts:140, scripts/policy-engine/context/loader.ts:94, scripts/policy-engine/rules/ai/AI-001.rule.ts:56, scripts/validate/validate-gitnexus.ts:217, scripts/validate/validate-gitnexus.ts:43, +1 more
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/gitnexus-context.json.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: arch:refresh.

### arch:gitnexus:validate

- Group: Architecture
- Command: `bun scripts/validate/validate-gitnexus.ts`
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

### arch:refresh

- Group: Architecture
- Command: `bun arch:audit && bun arch:gitnexus:context`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): arch:audit, arch:gitnexus:context.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:refresh -- <args>` only if the underlying tool supports them.
- Depends on: `arch:gitnexus:context`, `arch:audit`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:context:build

- Group: Architecture
- Command: `bun scripts/context/build.ts`
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
- Command: `bun scripts/context/changed.ts`
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
  - Other files: package.json:109, scripts/context/changed.ts:12, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:461
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: governance:gate:changed.

### arch:context:impact

- Group: Architecture
- Command: `bun scripts/context/impact.ts`
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
- Command: `bun scripts/context/validate.ts`
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

### arch:fix

- Group: Architecture
- Command: `bun arch:audit --fix-map`
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
  - Other files: scripts/dev/repo-doctor.ts:121
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:guard

- Group: Architecture
- Command: `bun scripts/architecture-guard/architecture-guard.ts`
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
  - Workflows: .github/workflows/ci.yml:152
  - Other files: reports/package-script-audit.json:15, scripts/ai-engine/plan-task.ts:119, scripts/dev/hygiene-checks/arch-guard-check.ts:3, scripts/generate/**tests**/script-docs.test.ts:88, scripts/policy-engine/adapters/architecture-guard.adapter.ts:39, scripts/policy-engine/adapters/architecture-guard.adapter.ts:4, tests/unit/policy-engine/adapters/architecture-guard.adapter.test.ts:36
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### arch:guard:ci

- Group: Architecture
- Command: `bun scripts/architecture-guard/architecture-guard.ts --ci`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-guard/architecture-guard.ts`
- CI flag: Dedicated CI runner by name; this entrypoint is already the CI-specific variant.
- Registered usage: `bun run arch:guard:ci`
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

### arch:guard:changed

- Group: Architecture
- Command: `bun scripts/architecture-guard/architecture-guard.ts --changed`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-guard/architecture-guard.ts`
- CI flag: No explicit CI handling detected in the implementation.
- Registered usage: `bun run arch:guard:changed`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--changed`: Restrict processing to changed files.
- Depends on: None
- Used by other root scripts: `governance:gate:changed`
- Used in:
  - Workflows: None found
  - Other files: package.json:109, scripts/policy-engine/adapters/architecture-guard.adapter.ts:38, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:461
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: governance:gate:changed.

### arch:diff

- Group: Architecture
- Command: `bun scripts/architecture-diff.ts`
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
  - Workflows: None found
  - Other files: scripts/architecture-diff.ts:6
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:health

- Group: Architecture
- Command: `bun scripts/architecture-health/architecture-health.ts`
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
  - Other files: scripts/dev/hygiene-checks/arch-guard-check.ts:3, scripts/dev/repo-status.ts:85
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:health:ci

- Group: Architecture
- Command: `bun scripts/architecture-health/architecture-health.ts --ci`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-health/architecture-health.ts`
- CI flag: Dedicated CI runner by name; this entrypoint is already the CI-specific variant.
- Registered usage: `bun run arch:health:ci`
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

### arch:validate:brain

- Group: Architecture
- Command: `bun scripts/governance/validate-architecture-brain.ts`
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
  - Other files: docs/architecture/health/architecture-health.json:180, docs/architecture/health/history/health-2026-03-12T22-54-01-012Z.json:131, docs/architecture/health/history/health-2026-03-15T23-26-58-848Z.json:180, docs/architecture/health/history/health-2026-03-20T21-25-38-263Z.json:418, docs/architecture/health/history/health-2026-03-20T21-25-56-943Z.json:180, docs/architecture/health/history/health-2026-03-25T11-56-09-458Z.json:418, docs/architecture/health/history/health-2026-03-25T11-56-10-315Z.json:180, scripts/architecture-health/collectors/validation-governance.ts:52, scripts/architecture-health/intelligence-snapshot.ts:25
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:visualize

- Group: Architecture
- Command: `bun scripts/architecture/visualize.ts`
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
  - Other files: scripts/architecture/visualize.ts:246, tests/static/06-architecture-visualization.test.ts:31, tests/static/06-architecture-visualization.test.ts:41, tests/static/06-architecture-visualization.test.ts:46, tests/static/06-architecture-visualization.test.ts:5, tests/static/06-architecture-visualization.test.ts:51, tests/static/06-architecture-visualization.test.ts:54, tests/static/06-architecture-visualization.test.ts:9
- Updated or generated files: Observed in isolated worktree run: docs/architecture/visualization/README.md.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:type-safety-guard

- Group: Architecture
- Command: `bun scripts/type-safety-guard.ts`
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
  - Other files: package.json:21, scripts/policy-engine/adapters/type-safety.adapter.ts:105, scripts/policy-engine/adapters/type-safety.adapter.ts:122, scripts/policy-engine/adapters/type-safety.adapter.ts:153, scripts/policy-engine/adapters/type-safety.adapter.ts:160, scripts/policy-engine/adapters/type-safety.adapter.ts:4, scripts/type-safety-guard.ts:8, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:761
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: validate:types.

### arch:audit:check

- Group: Architecture
- Command: `bun run arch:audit --check`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): arch:audit.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--check`: Check-only mode; fail if drift exists.
- Depends on: `arch:audit`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test

- Group: Testing
- Command: `vitest run`
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
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### test:unit

- Group: Testing
- Command: `vitest run --project mmc --project backoffice --project frontoffice --project api-client --project domain-core --project logger --project config --project redis-utils --project types --project ui-system --project validation`
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
  - Workflows: .github/workflows/ci.yml:346, .github/workflows/ci.yml:541
  - Other files: specs/runtime/infra-007-module-boundaries/.workflow-state.json:74, vitest.config.ts:45
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:unit:debug

- Group: Testing
- Command: `vitest run --reporter verbose --project mmc --project backoffice --project frontoffice --project api-client --project domain-core --project logger --project config --project redis-utils --project types --project ui-system --project validation`
- Power: low
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--reporter verbose`: Select reporter output format. Value: verbose.
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
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Usually removable if the team no longer uses the demo or debug workflow.

### test:unit:boundaries

- Group: Testing
- Command: `vitest run tests/static/module-boundaries.test.ts tests/unit/infra-audit/infra-audit-boundaries.test.ts tests/unit/ai-guard/ai-guard-boundaries.test.ts`
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
  - Workflows: .github/workflows/ci.yml:349
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:integration

- Group: Testing
- Command: `vitest run --dir tests/integration --fileParallelism=false`
- Power: critical
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Wrapper-only alias; any CI behavior depends on the underlying CLI rather than a root-level `--ci` flag.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--dir tests/integration`: Target a specific directory. Value: tests/integration.
  - Flag `--fileParallelism=false`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:455
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:performance

- Group: Testing
- Command: `vitest run --dir tests/performance`
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
- Command: `vitest run --dir tests/static`
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

### test:coverage

- Group: Testing
- Command: `vitest run --coverage`
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

### test:e2e:mmc

- Group: Testing
- Command: `bunx playwright test --config apps/mmc/playwright.config.ts`
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
  - Workflows: .github/workflows/ci.yml:595
  - Other files: apps/mmc/tests/e2e/smoke.spec.ts:10, package.json:66, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:615, tests/e2e/app-load.spec.ts:13
- Updated or generated files: Not audited automatically: browser/end-to-end workflow.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:e2e:backoffice

- Group: Testing
- Command: `bunx playwright test --config apps/backoffice/playwright.config.ts`
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
  - Workflows: .github/workflows/ci.yml:645
  - Other files: apps/backoffice/tests/e2e/smoke.spec.ts:10, package.json:66, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:615, tests/e2e/app-load.spec.ts:14
- Updated or generated files: Not audited automatically: browser/end-to-end workflow.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:e2e:frontoffice

- Group: Testing
- Command: `bunx playwright test --config apps/frontoffice/playwright.config.ts`
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
  - Workflows: .github/workflows/ci.yml:695
  - Other files: apps/frontoffice/tests/e2e/smoke.spec.ts:10, package.json:66, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:615, tests/e2e/app-load.spec.ts:15
- Updated or generated files: Not audited automatically: browser/end-to-end workflow.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:e2e

- Group: Testing
- Command: `bun run test:e2e:mmc && bun run test:e2e:backoffice && bun run test:e2e:frontoffice`
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

### build

- Group: Build
- Command: `bun run --workspaces build`
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
  - Workflows: .github/workflows/ci.yml:744
  - Other files: apps/api/package.json:8, apps/worker/package.json:8, package.json:69, packages/api-client/package.json:12, packages/domain-core/package.json:37, packages/logger/package.json:23, packages/redis-utils/package.json:14, packages/types/package.json:8, packages/validation/package.json:8, scripts/validate/detect-broken-scripts.ts:44, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:232, tests/unit/policy-engine/determinism.test.ts:20, +8 more
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### build:api

- Group: Build
- Command: `bun --cwd apps/api build`
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
- Command: `bash -lc 'for d in packages/*; do if [ -f "$d/package.json" ]; then (cd "$d" && echo "Building $d" && bun run build); fi; done'`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: No dedicated `--ci` flag is exposed at this alias level.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `-lc for d in packages/*; do if [ -f "$d/package.json" ]; then (cd "$d" && echo "Building $d" && bun run build); fi; done`: Runner-level option passed directly to the underlying tool. Value: for d in packages/\*; do if [ -f "$d/package.json" ]; then (cd "$d" && echo "Building $d" && bun run build); fi; done.
- Depends on: `build`
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:109, .github/workflows/ci.yml:69
  - Other files: None found
- Updated or generated files: Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### dev

- Group: Development
- Command: `bun run dev:all`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): dev:all.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run dev -- <args>` only if the underlying tool supports them.
- Depends on: `dev:all`
- Used by other root scripts: `dev:all`, `dev:demo-logger-features`
- Used in:
  - Workflows: None found
  - Other files: tests/unit/policy-engine/rules/SCRIPTS-001.test.ts:48
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:infra

- Group: Development
- Command: `docker compose up -d`
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

### dev:api

- Group: Development
- Command: `bun --cwd apps/api dev`
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
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:worker

- Group: Development
- Command: `bun --cwd apps/worker dev`
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
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:mmc

- Group: Development
- Command: `bun --cwd apps/mmc dev`
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
  - Workflows: .github/workflows/ci.yml:587
  - Other files: apps/mmc/playwright.config.ts:9, apps/mmc/tests/e2e/smoke.spec.ts:9, package.json:77, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340
- Updated or generated files: Not audited automatically: long-running service launcher.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### dev:backoffice

- Group: Development
- Command: `bun --cwd apps/backoffice dev`
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
  - Workflows: .github/workflows/ci.yml:637
  - Other files: apps/backoffice/playwright.config.ts:9, apps/backoffice/tests/e2e/smoke.spec.ts:9, package.json:77, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340
- Updated or generated files: Not audited automatically: long-running service launcher.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### dev:frontoffice

- Group: Development
- Command: `bun --cwd apps/frontoffice dev`
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
  - Workflows: .github/workflows/ci.yml:687
  - Other files: apps/frontoffice/playwright.config.ts:9, apps/frontoffice/tests/e2e/smoke.spec.ts:9, package.json:77, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340
- Updated or generated files: Not audited automatically: long-running service launcher.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### dev:all

- Group: Development
- Command: `concurrently "bun run dev:api" "bun run dev:worker" "bun run dev:mmc" "bun run dev:backoffice" "bun run dev:frontoffice"`
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
  - Other files: package.json:70, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:334
- Updated or generated files: Not audited automatically: long-running service launcher.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: dev.

### dev:demo:logger

- Group: Development
- Command: `bun scripts/dev/demo-logger-features.ts`
- Power: medium
- Purpose: Demonstrates all available logger customization options and features
- Source: `scripts/dev/demo-logger-features.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run dev:demo-logger-features`
- Usage:
  - Primary purpose: Demonstrates all available logger customization options and features
  - Flags: none baked into this runner. You can append more args with `bun run dev:demo:logger -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `dev:demo-logger-features`
- Used in:
  - Workflows: None found
  - Other files: package.json:124
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: dev:demo-logger-features.

### dev:hygiene:report

- Group: Development
- Command: `bun scripts/dev/hygiene-report-generator.ts`
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
  - Other files: None found
- Updated or generated files: Isolated worktree run failed before any tracked file changes were observed.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:generate:script-docs

- Group: Development
- Command: `bun scripts/generate/script-docs.ts`
- Power: critical
- Purpose: Walk scripts/\*_\/_.ts, parse @script metadata headers, generate docs/scripts/SCRIPT_REGISTRY.md. Exits 1 on missing required metadata fields.
- Source: `scripts/generate/script-docs.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run dev:generate:script-docs`
- Usage:
  - Primary purpose: Walk scripts/\*_\/_.ts, parse @script metadata headers, generate docs/scripts/SCRIPT_REGISTRY.md. Exits 1 on missing required metadata fields.
  - Flags: none baked into this runner. You can append more args with `bun run dev:generate:script-docs -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:169
  - Other files: scripts/generate/**tests**/script-docs.test.ts:19, scripts/generate/script-docs.ts:491, scripts/generate/script-docs.ts:532, scripts/generate/script-docs.ts:8, scripts/validate/script-infrastructure.ts:137, scripts/validate/script-infrastructure.ts:79
- Updated or generated files: Observed in isolated worktree run: docs/scripts/SCRIPT_REGISTRY.md.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### dev:generate:package-docs

- Group: Development
- Command: `bun scripts/generate/package-docs.ts`
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
  - Other files: scripts/generate/package-docs.ts:6, scripts/generate/package-docs.ts:915
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:seed:dashboard-test-data

- Group: Development
- Command: `bun run scripts/seed/dashboard-test-data.ts`
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
  - Other files: scripts/seed/dashboard-test-data.ts:155, scripts/seed/dashboard-test-data.ts:34, scripts/seed/dashboard-test-data.ts:7
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:refactor:scripts

- Group: Development
- Command: `bun scripts/dev/refactor-scripts.ts`
- Power: medium
- Purpose: Applies the SCRIPT_MIGRATION_MAP to rename all "bun run <old>" references across the repository. Reads docs/scripts/SCRIPT_MIGRATION_MAP.md, builds the old→new rename index, then rewrites all matching files in-place. Supports --dry-run to preview changes without writing. Exits 1 if any unresolved references remain after the run. Writes a summary report to reports/SCRIPT_REFACTOR_REPORT.md.
- Source: `scripts/dev/refactor-scripts.ts`
- CI flag: Explicitly rejected in the implementation; this runner rewrites repository files and must not run with `--ci`.
- Registered usage: `bun run dev:refactor:scripts`
- Usage:
  - Primary purpose: Applies the SCRIPT_MIGRATION_MAP to rename all "bun run <old>" references across the repository. Reads docs/scripts/SCRIPT_MIGRATION_MAP.md, builds the old→new rename index, then rewrites all matching files in-place. Supports --dry-run to preview changes without writing. Exits 1 if any unresolved references remain after the run. Writes a summary report to reports/SCRIPT_REFACTOR_REPORT.md.
  - Flags: none baked into this runner. You can append more args with `bun run dev:refactor:scripts -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/refactor-scripts.ts:11
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:runtime:status

- Group: AI
- Command: `bun scripts/ai-runtime/runtime-status.ts`
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
  - Workflows: .github/workflows/ci.yml:159
  - Other files: None found
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### ai:run

- Group: AI
- Command: `bun scripts/ai-engine/run-task.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/ai-engine/run-task.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run ai:run`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:run -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:plan

- Group: AI
- Command: `bun scripts/ai-engine/plan-task.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/ai-engine/plan-task.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run ai:plan`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:plan -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:validate

- Group: AI
- Command: `bun scripts/ai-engine/validate-execution.ts`
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
  - Workflows: .github/workflows/architecture-governance.yml:122
  - Other files: reports/package-script-audit.json:6, scripts/ai-engine/plan-task.ts:133, scripts/generate/**tests**/package-docs.test.ts:22, scripts/generate/**tests**/package-docs.test.ts:29, scripts/generate/**tests**/package-docs.test.ts:55, tests/integration/ai-engine/validate-execution.integration.test.ts:4, tests/integration/ai-engine/validate-execution.integration.test.ts:48
- Updated or generated files: Audit attempt failed in isolated worktree: `bun run ai:validate -- --ci` exited non-zero before tracked file changes were observed. Output note: error: script "ai:validate" exited with code 4
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:validate:prompts

- Group: AI
- Command: `bun scripts/prompt-qa.ts`
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
  - Other files: scripts/prompt-qa.ts:7
- Updated or generated files: Audit attempt failed in isolated worktree: `bun scripts/prompt-qa.ts --ci` exited non-zero before tracked file changes were observed.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:context:generate

- Group: AI
- Command: `bun scripts/generate-ai-context.ts`
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
  - Other files: scripts/dev/generate-ai-context.ts:7, scripts/dev/generate-ai-context.ts:8, scripts/dev/generate-ai-context.ts:9, scripts/generate-ai-context.ts:13, scripts/generate-ai-context.ts:14, scripts/generate-ai-context.ts:15, scripts/generate-ai-context.ts:6, scripts/validate/ai-context-fresh.ts:38, scripts/validate/ai-context-schemas.ts:80
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ai-context-validation.yml.

### ai:context:refresh

- Group: AI
- Command: `bun scripts/generate-ai-context.ts --force`
- Power: critical
- Purpose: Generate AI context artifacts (architecture brain, module map, dependency graph). Supports incremental (default), forced, and validate-after-generation modes.
- Source: `scripts/generate-ai-context.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run ai:context:generate`
- Usage:
  - Primary purpose: Generate AI context artifacts (architecture brain, module map, dependency graph). Supports incremental (default), forced, and validate-after-generation modes.
  - Flag `--force`: Bypass freshness checks and force regeneration.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ai-context-validation.yml:63, .github/workflows/ci.yml:156
  - Other files: scripts/validate/ai-context-fresh.ts:64
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml, .github/workflows/ai-context-validation.yml.

### ai:context:validate

- Group: AI
- Command: `bun run validate:ai-context-fresh && bun run validate:ai-context-schemas`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: Indirect wrapper; CI behavior depends on child runner(s): validate:ai-context-fresh, validate:ai-context-schemas.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:context:validate -- <args>` only if the underlying tool supports them.
- Depends on: `validate:ai-context-schemas`, `validate:ai-context-fresh`
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ai-context-validation.yml:73
  - Other files: scripts/dev/hygiene-checks/ai-context-check.ts:3
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ai-context-validation.yml.

### ai:guard

- Group: AI
- Command: `bun run scripts/ai-guard.ts`
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
  - Workflows: None found
  - Other files: scripts/ai-guard.ts:6, scripts/dev/**tests**/refactor-scripts.test.ts:107, scripts/dev/**tests**/refactor-scripts.test.ts:122, scripts/dev/**tests**/refactor-scripts.test.ts:149
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### repo:doctor

- Group: Repository
- Command: `bun scripts/dev/repo-doctor.ts`
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
  - Workflows: .github/workflows/ci.yml:195
  - Other files: None found
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### repo:fix

- Group: Repository
- Command: `bun scripts/dev/repo-fix.ts`
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
  - Other files: None found
- Updated or generated files: Not audited automatically: mutates repository state.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### repo:onboard

- Group: Repository
- Command: `bun scripts/dev/repo-onboard.ts`
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
  - Other files: None found
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### repo:status

- Group: Repository
- Command: `bun scripts/dev/repo-status.ts`
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
  - Other files: None found
- Updated or generated files: Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json, docs/architecture/ARCHITECTURE_DIAGRAMS.md, docs/architecture/graphs/architecture-graph.html, docs/architecture/health/architecture-drift-report.md, docs/architecture/health/architecture-health-summary.md, docs/architecture/health/architecture-health.json, docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json, docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json, docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md, docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md, docs/reports/infra-audit-report.json.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### db:console

- Group: Database
- Command: `bun run scripts/db/console.ts`
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
- Command: `bun run scripts/db/migrate.ts`
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
- Command: `bun run scripts/db/pool-status.ts`
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
- Command: `bun run scripts/db/validate-licenses.ts`
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

### infra:cache:clean

- Group: Infrastructure
- Command: `bun run scripts/maintenance/cache-clean.ts`
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
  - Other files: scripts/maintenance/cache-clean.ts:7
- Updated or generated files: Not audited automatically: destructive maintenance command.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security

- Group: Infrastructure
- Command: `bun scripts/security/scan.ts`
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
  - Other files: scripts/security/scan.ts:6
- Updated or generated files: Not audited automatically: external scanner dependency or long-running security scan.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security:deps

- Group: Infrastructure
- Command: `bun scripts/security/scan-deps.ts`
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
  - Other files: scripts/security/scan-deps.ts:6
- Updated or generated files: Not audited automatically: external scanner dependency or long-running security scan.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security:secrets

- Group: Infrastructure
- Command: `bun scripts/security/scan-secrets.ts`
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
  - Other files: scripts/security/scan-secrets.ts:6
- Updated or generated files: Not audited automatically: external scanner dependency or long-running security scan.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security:config

- Group: Infrastructure
- Command: `bun scripts/security/scan-config.ts`
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
  - Other files: scripts/security/scan-config.ts:6
- Updated or generated files: Not audited automatically: external scanner dependency or long-running security scan.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security:ci

- Group: Infrastructure
- Command: `bun scripts/security/scan-ci.ts`
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
  - Workflows: .github/workflows/ci.yml:286
  - Other files: scripts/security/scan-ci.ts:6
- Updated or generated files: Not audited automatically: external scanner dependency or long-running security scan.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### governance:gate

- Group: Governance
- Command: `bun scripts/governance/gate.ts`
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

### governance:gate:ci

- Group: Governance
- Command: `bun scripts/governance/gate-ci.ts`
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
  - Workflows: .github/workflows/architecture-governance.yml:188
  - Other files: reports/package-script-audit.json:48, scripts/generate/**tests**/package-docs.test.ts:69, scripts/governance/gate-ci.ts:9
- Updated or generated files: Audit attempt failed in isolated worktree: `bun run governance:gate:ci` exited non-zero before tracked file changes were observed. Output note: ✖ ::error::Governance gate failed — see output above error: script "governance:gate:ci" exited with code 1
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### governance:gate:changed

- Group: Governance
- Command: `bun run arch:context:changed && bun run arch:guard:changed`
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

### governance:report

- Group: Governance
- Command: `bun scripts/governance/report.ts`
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

### ci:smoke:staging

- Group: CI
- Command: `bash scripts/ci/run-staging-smoke-tests.sh`
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

### ci:local

- Group: CI
- Command: `act --pull=false`
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

### ci:local:full

- Group: CI
- Command: `act --pull --reuse=false`
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

### ci:local:workflow

- Group: CI
- Command: `act -W .github/workflows`
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

### ci:local:job

- Group: CI
- Command: `act -j`
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
- Command: `act -l`
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

### ci:local:dry

- Group: CI
- Command: `actionlint .github/workflows/*.yml`
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

### ci:run-local

- Group: CI
- Command: `bun scripts/run-local-ci.ts`
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
  - Other files: scripts/run-local-ci.ts:9
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:test

- Group: CI
- Command: `vitest run --reporter=verbose`
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

### test:tenant

- Group: Testing
- Command: `vitest run --dir tests/tenant || true`
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

### test:migrations

- Group: Testing
- Command: `vitest run --dir tests/migrations || true`
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

### dev:stale-test

- Group: Development
- Command: `echo 'dev:stale-test placeholder'`
- Power: low
- Purpose: Placeholder alias retained for compatibility or future implementation.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: No dedicated `--ci` flag is exposed at this alias level.
- Usage:
  - Primary purpose: Placeholder alias retained for compatibility or future implementation.
  - Flags: none baked into this runner. You can append more args with `bun run dev:stale-test -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/validate/**tests**/script-infrastructure.test.ts:107
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Low-risk cleanup candidate, but verify no undocumented manual workflow still calls it.

### validate:runtime:scripts

- Group: Validation
- Command: `bun run scripts/validate/runtime-scripts.ts`
- Power: medium
- Purpose: CI guard: hard-blocks (exit 1) when any bun run <script> reference in the project (outside specs, .gitnexus, and reports) is absent from root package.json. References inside those dirs generate warnings but exit 0. Exits 0 when no critical issues found.
- Source: `scripts/validate/runtime-scripts.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run validate:scripts:runtime`
- Usage:
  - Primary purpose: CI guard: hard-blocks (exit 1) when any bun run <script> reference in the project (outside specs, .gitnexus, and reports) is absent from root package.json. References inside those dirs generate warnings but exit 0. Exits 0 when no critical issues found.
  - Flags: none baked into this runner. You can append more args with `bun run validate:runtime:scripts -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/policy-engine/adapters/script-governance.adapter.ts:4, scripts/policy-engine/adapters/script-governance.adapter.ts:53
- Updated or generated files: Observed in isolated worktree run: no tracked file changes.
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:demo-logger-features

- Group: Development
- Command: `bun run dev:demo:logger`
- Power: low
- Purpose: Demonstrates all available logger customization options and features
- Source: `scripts/dev/demo-logger-features.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run dev:demo-logger-features`
- Usage:
  - Primary purpose: Demonstrates all available logger customization options and features
  - Flags: none baked into this runner. You can append more args with `bun run dev:demo-logger-features -- <args>` only if the underlying tool supports them.
- Depends on: `dev:demo:logger`, `dev`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/demo-logger-features.ts:8
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Usually removable if the team no longer uses the demo or debug workflow.

### repo:references

- Group: Repository
- Command: `echo 'references placeholder'`
- Power: low
- Purpose: Placeholder alias retained for compatibility or future implementation.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: No dedicated `--ci` flag is exposed at this alias level.
- Usage:
  - Primary purpose: Placeholder alias retained for compatibility or future implementation.
  - Flags: none baked into this runner. You can append more args with `bun run repo:references -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/refactor-scripts.ts:261, scripts/validate/script-usage.ts:150
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Low-risk cleanup candidate, but verify no undocumented manual workflow still calls it.

### repo:script

- Group: Repository
- Command: `echo 'script placeholder'`
- Power: low
- Purpose: Placeholder alias retained for compatibility or future implementation.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- CI flag: No dedicated `--ci` flag is exposed at this alias level.
- Usage:
  - Primary purpose: Placeholder alias retained for compatibility or future implementation.
  - Flags: none baked into this runner. You can append more args with `bun run repo:script -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/demo-logger-features.ts:63, scripts/dev/demo-logger-features.ts:64
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Low-risk cleanup candidate, but verify no undocumented manual workflow still calls it.

### policy:check

- Group: Policy
- Command: `bun scripts/policy-engine/cli.ts`
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
  - Other files: scripts/policy-engine/cli.ts:10, scripts/policy-engine/cli.ts:11, scripts/policy-engine/cli.ts:12, scripts/policy-engine/cli.ts:4, scripts/policy-engine/cli.ts:8, scripts/policy-engine/cli.ts:9
- Updated or generated files: Isolated worktree run failed; files touched before failure: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json, docs/architecture/ARCHITECTURE_DIAGRAMS.md, docs/architecture/graphs/architecture-graph.html, docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json, docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json, docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md, docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md, docs/reports/infra-audit-report.json, docs/architecture/audits/history/audit-1774722812109.json.
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/policy-check.yml.

### policy:check:full

- Group: Policy
- Command: `bun scripts/policy-engine/cli.ts --full`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: `scripts/policy-engine/cli.ts`
- CI flag: Supported explicitly in the implementation.
- Registered usage: `bun run policy:check:full`
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

### prepare

- Group: Lifecycle
- Command: `husky`
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
