# Package Script Reference

This document consolidates every root runner in `package.json` into one decision-making reference: what it does, which flags are baked into the runner, what depends on it, where it is invoked, and whether it is safe to remove.

## How To Read This File

- `Power` is the practical blast-radius label for the runner itself, not the underlying implementation file.
- `critical` means CI, install lifecycle, governance, or primary build/test quality paths depend on it.
- `medium` means it is part of normal developer workflows or is a composition alias, but the current scan did not find direct workflow enforcement.
- `low` means the runner looks optional, debug/demo-oriented, or placeholder-like.
- `Used in` is based on a direct invocation scan for `bun run <script>` or `bun <script>`. Documentation-only mentions are intentionally excluded.

## Summary

- Total root runners: 120
- Critical: 40
- Medium: 75
- Low: 5

## Workflow-Bound Runners

- These runners are invoked directly from `.github/workflows` and should be treated as non-removable until the relevant workflow is changed.
- `build:packages`: .github/workflows/ci.yml:69, .github/workflows/ci.yml:109
- `lint`: .github/workflows/ci.yml:78, .github/workflows/ci-type-safety.yml:87
- `typecheck:src`: .github/workflows/ci.yml:112, .github/workflows/ci-type-safety.yml:38
- `typecheck:tests`: .github/workflows/ci.yml:115, .github/workflows/ci-type-safety.yml:41
- `arch:guard`: .github/workflows/ci.yml:152
- `ai:context:refresh`: .github/workflows/ci.yml:156, .github/workflows/ai-context-validation.yml:63
- `ai:runtime:status`: .github/workflows/ci.yml:159
- `validate:scripts:ux`: .github/workflows/ci.yml:226
- `infra:security:ci`: .github/workflows/ci.yml:293
- `test:unit`: .github/workflows/ci.yml:353, .github/workflows/ci.yml:548
- `test:unit:boundaries`: .github/workflows/ci.yml:356
- `test:integration`: .github/workflows/ci.yml:462
- `dev:mmc`: .github/workflows/ci.yml:594
- `test:e2e:mmc`: .github/workflows/ci.yml:602
- `dev:backoffice`: .github/workflows/ci.yml:644
- `test:e2e:backoffice`: .github/workflows/ci.yml:652
- `dev:frontoffice`: .github/workflows/ci.yml:694
- `test:e2e:frontoffice`: .github/workflows/ci.yml:702
- `build`: .github/workflows/ci.yml:751
- `ai:context:generate`: .github/workflows/ai-context-validation.yml:53, .github/workflows/ai-context-validation.yml:83
- `ai:context:validate`: .github/workflows/ai-context-validation.yml:73
- `policy:check`: .github/workflows/policy-check.yml:31
- `arch:context:build`: .github/workflows/architecture-governance.yml:42
- `arch:context:validate`: .github/workflows/architecture-governance.yml:42
- `arch:health:ci`: .github/workflows/architecture-governance.yml:66
- `validate:scripts:naming`: .github/workflows/architecture-governance.yml:156
- `validate:scripts:usage`: .github/workflows/architecture-governance.yml:160
- `validate:scripts:infrastructure`: .github/workflows/architecture-governance.yml:164
- `dev:generate:script-docs`: .github/workflows/architecture-governance.yml:168
- `governance:gate:ci`: .github/workflows/architecture-governance.yml:172

## Script Inventory

### typecheck

- Group: Quality
- Command: `bun typecheck:src && bun typecheck:tests`
- Power: critical
- Purpose: Run both source and test TypeScript checks.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run both source and test TypeScript checks.
  - Flags: none baked into this runner. You can append more args with `bun run typecheck -- <args>` only if the underlying tool supports them.
- Depends on: `typecheck:src`, `typecheck:tests`
- Used by other root scripts: `validate:types`
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:116, reports/SCRIPT_REFACTOR_REPORT.md:134, reports/SCRIPT_REFACTOR_REPORT.md:257, reports/SCRIPT_REFACTOR_REPORT.md:261, reports/SCRIPT_REFACTOR_REPORT.md:265, reports/SCRIPT_REFACTOR_REPORT.md:269, reports/SCRIPT_REFACTOR_REPORT.md:273, reports/SCRIPT_REFACTOR_REPORT.md:277, reports/SCRIPT_REFACTOR_REPORT.md:281, reports/SCRIPT_REFACTOR_REPORT.md:285, reports/SCRIPT_REFACTOR_REPORT.md:289, reports/SCRIPT_REFACTOR_REPORT.md:370, +360 more
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: validate:types.

### typecheck:src

- Group: Quality
- Command: `tsc --noEmit`
- Power: critical
- Purpose: Run the TypeScript compiler in type-check-only mode.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the TypeScript compiler in type-check-only mode.
  - Flag `--noEmit`: Type-check only; do not emit compiled files.
- Depends on: None
- Used by other root scripts: `typecheck`, `typecheck:tests`
- Used in:
  - Workflows: .github/workflows/ci.yml:112, .github/workflows/ci-type-safety.yml:38
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:116, reports/SCRIPT_REFACTOR_REPORT.md:134, reports/SCRIPT_REFACTOR_REPORT.md:257, reports/SCRIPT_REFACTOR_REPORT.md:261, reports/SCRIPT_REFACTOR_REPORT.md:265, reports/SCRIPT_REFACTOR_REPORT.md:269, reports/SCRIPT_REFACTOR_REPORT.md:273, reports/SCRIPT_REFACTOR_REPORT.md:277, reports/SCRIPT_REFACTOR_REPORT.md:281, reports/SCRIPT_REFACTOR_REPORT.md:285, reports/SCRIPT_REFACTOR_REPORT.md:289, reports/SCRIPT_REFACTOR_REPORT.md:370, +56 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml, .github/workflows/ci-type-safety.yml.

### typecheck:tests

- Group: Quality
- Command: `bun typecheck:src -p tsconfig.test.json`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `-p tsconfig.test.json`: Pass an alternate TypeScript project file. Value: tsconfig.test.json.
- Depends on: `typecheck:src`
- Used by other root scripts: `typecheck`
- Used in:
  - Workflows: .github/workflows/ci.yml:115, .github/workflows/ci-type-safety.yml:41
  - Other files: .github/workflows/ci.yml:115, docs/reports/REPOSITORY_HYGIENE_REPORT.md:198, .github/workflows/ci-type-safety.yml:41, docs/type-safety/CI_ENFORCEMENT.md:70, specs/runtime/infra-005-lint-governance/plan.md:412, specs/runtime/infra-005-lint-governance/research.md:238, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:6, specs/runtime/infra-001-typescript-stabilization/reports/IMPLEMENT_REPORT.md:123, specs/runtime/infra-001-typescript-stabilization/guides/TESTING_GUIDE.md:26, specs/runtime/infra-001-typescript-stabilization/guides/TESTING_GUIDE.md:76, specs/runtime/infra-001-typescript-stabilization/guides/TESTING_GUIDE.md:93, specs/runtime/infra-001-typescript-stabilization/guides/TESTING_GUIDE.md:242, +6 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml, .github/workflows/ci-type-safety.yml.

### lint

- Group: Quality
- Command: `biome check .`
- Power: critical
- Purpose: Run Biome checks across the repository.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Biome checks across the repository.
  - Flags: none baked into this runner. You can append more args with `bun run lint -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:78, .github/workflows/ci-type-safety.yml:87
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:115, reports/SCRIPT_REFACTOR_REPORT.md:133, reports/SCRIPT_REFACTOR_REPORT.md:369, README.md:361, README.md:408, README.md:414, README.md:455, README.md:504, .github/workflows/ci.yml:78, docs/reports/REPOSITORY_HYGIENE_REPORT.md:199, .github/workflows/ci-type-safety.yml:87, AGENTS.md:82, +378 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml, .github/workflows/ci-type-safety.yml.

### lint:fix

- Group: Quality
- Command: `biome check --write .`
- Power: medium
- Purpose: Run Biome checks and write fixable changes.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Biome checks and write fixable changes.
  - Flag `--write .`: Apply in-place fixes or formatting changes. Value: ..
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: README.md:414, specs/runtime/infra-005-lint-governance/reports/IMPLEMENT_REPORT.md:21, specs/runtime/infra-004-biome/PR_SUMMARY.md:31, specs/runtime/infra-005-lint-governance/reports/TASKS_REPORT.md:54, specs/runtime/infra-005-lint-governance/spec.md:193, specs/runtime/infra-005-lint-governance/spec.md:282, specs/runtime/infra-005-lint-governance/spec.md:557, specs/runtime/infra-005-lint-governance/spec.md:590, specs/runtime/infra-005-lint-governance/spec.md:629, specs/runtime/infra-005-lint-governance/plan.md:60, specs/runtime/infra-005-lint-governance/plan.md:164, specs/runtime/infra-005-lint-governance/plan.md:166, +19 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### format

- Group: Quality
- Command: `bun run format:biome && bun run format:prettier`
- Power: medium
- Purpose: Run both Biome and Prettier formatting passes.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run both Biome and Prettier formatting passes.
  - Flags: none baked into this runner. You can append more args with `bun run format -- <args>` only if the underlying tool supports them.
- Depends on: `format:biome`, `format:prettier`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: README.md:420, README.md:426, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_03_ALIGNMENT.md:392, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_03_ALIGNMENT.md:393, specs/runtime/infra-003-alignment/PR_SUMMARY.md:207, specs/runtime/infra-003-alignment/spec.md:95, specs/runtime/infra-003-alignment/spec.md:101, specs/runtime/infra-003-alignment/spec.md:106, specs/runtime/infra-003-alignment/spec.md:227, specs/runtime/infra-003-alignment/spec.md:229, specs/runtime/infra-003-alignment/spec.md:323, specs/runtime/infra-003-alignment/spec.md:376, +45 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### format:biome

- Group: Quality
- Command: `biome format --write .`
- Power: medium
- Purpose: Format files with Biome.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Format files with Biome.
  - Flag `--write .`: Apply in-place fixes or formatting changes. Value: ..
- Depends on: None
- Used by other root scripts: `format`
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:11, specs/runtime/fix-01-runtime-script-recovery-and-validation/research.md:122, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:416
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: format.

### format:prettier

- Group: Quality
- Command: `prettier --write '**/*.{md,yaml,yml}'`
- Power: medium
- Purpose: Format Markdown and YAML-family files with Prettier.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Format Markdown and YAML-family files with Prettier.
  - Flag `--write '**/*.{md,yaml,yml}'`: Apply in-place fixes or formatting changes. Value: '\*_/_.{md,yaml,yml}'.
- Depends on: None
- Used by other root scripts: `format`
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:416
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: format.

### format:check

- Group: Quality
- Command: `bun run format:check:biome && bun run format:check:prettier`
- Power: medium
- Purpose: Run both Biome and Prettier checks without writing changes.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run both Biome and Prettier checks without writing changes.
  - Flags: none baked into this runner. You can append more args with `bun run format:check -- <args>` only if the underlying tool supports them.
- Depends on: `format:check:biome`, `format:check:prettier`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: README.md:420, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_03_ALIGNMENT.md:393, specs/runtime/infra-004-biome/PR_SUMMARY.md:31, specs/runtime/infra-004-biome/PR_SUMMARY.md:101, specs/runtime/infra-004-biome/PR_SUMMARY.md:187, specs/runtime/infra-004-biome/plan.md:508, specs/runtime/infra-004-biome/plan.md:640, specs/runtime/infra-004-biome/guides/TESTING_GUIDE.md:31, specs/runtime/infra-004-biome/guides/TESTING_GUIDE.md:47, specs/runtime/infra-004-biome/guides/TESTING_GUIDE.md:55, specs/runtime/infra-004-biome/guides/TESTING_GUIDE.md:277, specs/runtime/infra-004-biome/guides/TESTING_GUIDE.md:362, +30 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### format:check:biome

- Group: Quality
- Command: `biome format .`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run format:check:biome -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `format:check`
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:14, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:428
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: format:check.

### format:check:prettier

- Group: Quality
- Command: `prettier --check '**/*.{md,yaml,yml}'`
- Power: medium
- Purpose: Check Markdown and YAML-family files against Prettier formatting.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Check Markdown and YAML-family files against Prettier formatting.
  - Flag `--check '**/*.{md,yaml,yml}'`: Check-only mode; fail if drift exists. Value: '\*_/_.{md,yaml,yml}'.
- Depends on: None
- Used by other root scripts: `format:check`
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:428
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: format:check.

### validate:workflows

- Group: Validation
- Command: `find .github/workflows -type f \( -name '*.yml' -o -name '*.yaml' \) | xargs actionlint`
- Power: critical
- Purpose: Validate GitHub Actions workflow files.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Validate GitHub Actions workflow files.
  - Flag `-type f`: Runner-level option passed directly to the underlying tool. Value: f.
  - Flag `-name '*.yml'`: Runner-level option passed directly to the underlying tool. Value: '\*.yml'.
  - Flag `-o`: Runner-level option passed directly to the underlying tool.
  - Flag `-name '*.yaml'`: Runner-level option passed directly to the underlying tool. Value: '\*.yaml'.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION.md:250, specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/spec.md:52, specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/spec.md:145, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION.md:329, specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/plan.md:193, specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/tasks.md:90, specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/quickstart.md:118, specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/audits/VALIDATION_REPORT.md:30, specs/runtime/infra-021-support-surface-routing-and-template-migration/spec.md:155, specs/runtime/infra-021-support-surface-routing-and-template-migration/plan.md:15, specs/runtime/infra-021-support-surface-routing-and-template-migration/plan.md:258, specs/runtime/infra-021-support-surface-routing-and-template-migration/guides/TESTING_GUIDE.md:175, +9 more
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### validate:types

- Group: Validation
- Command: `bun typecheck && bun arch:type-safety-guard --json`
- Power: critical
- Purpose: Run TypeScript checks plus the architecture type-safety guard.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run TypeScript checks plus the architecture type-safety guard.
  - Flag `--json`: Emit machine-readable JSON output.
- Depends on: `typecheck`, `arch:type-safety-guard`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:367, reports/SCRIPT_REFACTOR_REPORT.md:386, specs/runtime/infra-029-policy-engine-and-governance-rules-layer/plan.md:641, specs/runtime/infra-029-policy-engine-and-governance-rules-layer/tasks.md:138, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:178, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_14_ARCHITECTURE_ALIGNMENT_MIGRATION.md:192, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:55, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:95, specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md:613, specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md:1054, specs/runtime/infra-012-typescript-type-safety-governance/tasks.md:358, specs/runtime/infra-012-typescript-type-safety-governance/quickstart.md:472, +19 more
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### validate:tsconfig

- Group: Validation
- Command: `bash scripts/validate/check-tsconfig-strict.sh`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run validate:tsconfig -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:360, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:18
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### validate:ai-context-fresh

- Group: Validation
- Command: `bun run scripts/validate/ai-context-fresh.ts`
- Power: medium
- Purpose: Check that the AI context mini artifact exists and is not older than 24 hours
- Source: `scripts/validate/ai-context-fresh.ts`
- Registered usage: `bun run validate:ai-context-fresh`
- Usage:
  - Primary purpose: Check that the AI context mini artifact exists and is not older than 24 hours
  - Flags: none baked into this runner. You can append more args with `bun run validate:ai-context-fresh -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `ai:context:validate`
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/validate-ai-context-fresh.md:6, docs/scripts/validate-ai-context-fresh.md:44, docs/scripts/validate-ai-context-fresh.md:47, docs/scripts/SCRIPT_REGISTRY.md:76, specs/runtime/infra-009-ai-architecture-context/plan.md:792, scripts/validate/ai-context-fresh.ts:6, scripts/validate/**tests**/runtime-scripts.test.ts:28, specs/runtime/infra-027-unified-governance-gate-system/plan.md:131, specs/runtime/infra-027-unified-governance-gate-system/plan.md:321, specs/runtime/infra-025-script-system-standardization-and-governance/guides/TESTING_GUIDE.md:273, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:78, specs/runtime/fix-01-runtime-script-recovery-and-validation/guides/TESTING_GUIDE.md:132, +3 more
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: ai:context:validate.

### validate:ai-context-schemas

- Group: Validation
- Command: `bun run scripts/validate/ai-context-schemas.ts`
- Power: medium
- Purpose: Validate that all required AI context JSON artifacts exist and are valid JSON
- Source: `scripts/validate/ai-context-schemas.ts`
- Registered usage: `bun run validate:ai-context-schemas`
- Usage:
  - Primary purpose: Validate that all required AI context JSON artifacts exist and are valid JSON
  - Flags: none baked into this runner. You can append more args with `bun run validate:ai-context-schemas -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `ai:context:validate`
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/validate-ai-context-schemas.md:6, docs/scripts/validate-ai-context-schemas.md:49, docs/scripts/SCRIPT_REGISTRY.md:77, scripts/validate/ai-context-schemas.ts:6, specs/runtime/infra-009-ai-architecture-context/plan.md:796, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:79, specs/runtime/fix-01-runtime-script-recovery-and-validation/guides/TESTING_GUIDE.md:133, specs/runtime/fix-01-runtime-script-recovery-and-validation/guides/TESTING_GUIDE.md:189, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:38, specs/runtime/fix-01-runtime-script-recovery-and-validation/tasks.md:79, specs/runtime/infra-027-unified-governance-gate-system/plan.md:131, specs/runtime/infra-027-unified-governance-gate-system/plan.md:321, +1 more
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: ai:context:validate.

### validate:scripts:runtime

- Group: Validation
- Command: `bun run scripts/validate/runtime-scripts.ts`
- Power: medium
- Purpose: CI guard: hard-blocks (exit 1) when any bun run <script> reference in the project (outside specs, .gitnexus, and reports) is absent from root package.json. References inside those dirs generate warnings but exit 0. Exits 0 when no critical issues found.
- Source: `scripts/validate/runtime-scripts.ts`
- Registered usage: `bun run validate:scripts:runtime`
- Usage:
  - Primary purpose: CI guard: hard-blocks (exit 1) when any bun run <script> reference in the project (outside specs, .gitnexus, and reports) is absent from root package.json. References inside those dirs generate warnings but exit 0. Exits 0 when no critical issues found.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:runtime -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:70, reports/SCRIPT_REFACTOR_REPORT.md:84, reports/SCRIPT_REFACTOR_REPORT.md:104, reports/SCRIPT_REFACTOR_REPORT.md:243, reports/SCRIPT_REFACTOR_REPORT.md:247, reports/SCRIPT_REFACTOR_REPORT.md:253, reports/SCRIPT_REFACTOR_REPORT.md:301, reports/SCRIPT_REFACTOR_REPORT.md:307, reports/SCRIPT_REFACTOR_REPORT.md:317, reports/SCRIPT_REFACTOR_REPORT.md:332, reports/SCRIPT_REFACTOR_REPORT.md:338, reports/SCRIPT_REFACTOR_REPORT.md:352, +52 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### validate:scripts:broken

- Group: Validation
- Command: `bun run scripts/validate/detect-broken-scripts.ts`
- Power: medium
- Purpose: Detect missing or broken TypeScript script files referenced in root package.json
- Source: `scripts/validate/detect-broken-scripts.ts`
- Registered usage: `bun run validate:scripts:broken`
- Usage:
  - Primary purpose: Detect missing or broken TypeScript script files referenced in root package.json
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:broken -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/validate-scripts-infra.md:8, docs/scripts/validate-scripts-infra.md:34, scripts/validate/detect-broken-scripts.ts:6, docs/scripts/SCRIPT_REGISTRY.md:79, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:309
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### validate:scripts:naming

- Group: Validation
- Command: `bun scripts/validate/script-naming.ts`
- Power: critical
- Purpose: Validates all package.json script keys conform to the <domain>:<action>[:<scope>] naming convention. Allowed domains: db, arch, validate, ai, ci, repo, dev, infra, test, governance, policy. Lifecycle-exempt names are skipped. Reports ALL violations before exiting non-zero.
- Source: `scripts/validate/script-naming.ts`
- Registered usage: `bun run validate:scripts:naming`
- Usage:
  - Primary purpose: Validates all package.json script keys conform to the <domain>:<action>[:<scope>] naming convention. Allowed domains: db, arch, validate, ai, ci, repo, dev, infra, test, governance, policy. Lifecycle-exempt names are skipped. Reports ALL violations before exiting non-zero.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:naming -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:156
  - Other files: .github/workflows/architecture-governance.yml:156, scripts/validate/script-naming.ts:9, scripts/validate/**tests**/script-usage.test.ts:45, scripts/validate/**tests**/script-usage.test.ts:68, docs/scripts/SCRIPT_REGISTRY.md:81, .agents/skills/script-system-governance/SKILL.md:90, .agents/skills/script-system-governance/SKILL.md:154, .agents/skills/script-system-governance/SKILL.md:180, .agents/skills/script-system-governance/SKILL.md:193, .agents/skills/script-system-governance/SKILL.md:234, .agents/skills/script-system-governance/SKILL.md:266, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:243, +17 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### validate:scripts:usage

- Group: Validation
- Command: `bun scripts/validate/script-usage.ts`
- Power: critical
- Purpose: Scans all .ts, .json, .yml, .yaml, .md, and .sh files for "bun run <name>" references and validates that every referenced name exists in a package.json scripts block. Reports all broken/orphan references before exiting non-zero.
- Source: `scripts/validate/script-usage.ts`
- Registered usage: `bun run validate:scripts:usage`
- Usage:
  - Primary purpose: Scans all .ts, .json, .yml, .yaml, .md, and .sh files for "bun run <name>" references and validates that every referenced name exists in a package.json scripts block. Reports all broken/orphan references before exiting non-zero.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:usage -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:160
  - Other files: .github/workflows/architecture-governance.yml:160, .agents/skills/script-system-governance/SKILL.md:181, .agents/skills/script-system-governance/SKILL.md:206, .agents/skills/script-system-governance/SKILL.md:237, .agents/skills/script-system-governance/SKILL.md:267, docs/scripts/SCRIPT_REGISTRY.md:84, .agents/agents/orchestrator.agent.md:586, scripts/validate/script-usage.ts:9, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:244, specs/runtime/infra-027-unified-governance-gate-system/reports/IMPLEMENT_REPORT.md:69, specs/runtime/infra-027-unified-governance-gate-system/spec.md:76, specs/runtime/infra-027-unified-governance-gate-system/plan.md:465, +15 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### validate:scripts:infrastructure

- Group: Validation
- Command: `bun scripts/validate/script-infrastructure.ts`
- Power: critical
- Purpose: Validates that all scripts/\*.ts files have the mandatory 5-field metadata header (@script, @domain, @category, @description, @usage) and that the SCRIPT_REGISTRY.md is up-to-date (no drift vs. what the generator would produce). Reports all violations before exiting non-zero.
- Source: `scripts/validate/script-infrastructure.ts`
- Registered usage: `bun run validate:scripts:infrastructure`
- Usage:
  - Primary purpose: Validates that all scripts/\*.ts files have the mandatory 5-field metadata header (@script, @domain, @category, @description, @usage) and that the SCRIPT_REGISTRY.md is up-to-date (no drift vs. what the generator would produce). Reports all violations before exiting non-zero.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:infrastructure -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:164
  - Other files: .github/workflows/architecture-governance.yml:164, .agents/skills/script-system-governance/SKILL.md:155, .agents/skills/script-system-governance/SKILL.md:182, .agents/skills/script-system-governance/SKILL.md:219, .agents/skills/script-system-governance/SKILL.md:240, .agents/skills/script-system-governance/SKILL.md:268, docs/scripts/SCRIPT_REGISTRY.md:80, scripts/validate/script-infrastructure.ts:9, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/reports/IMPLEMENT_REPORT.md:84, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md:248, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/tasks.md:68, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:245, +13 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### validate:scripts:registry

- Group: Validation
- Command: `bun scripts/validate/diff-script-registry.ts`
- Power: medium
- Purpose: Compare scanned runtime spec script references against root package.json, produce diff report
- Source: `scripts/validate/diff-script-registry.ts`
- Registered usage: `bun run validate:scripts:registry`
- Usage:
  - Primary purpose: Compare scanned runtime spec script references against root package.json, produce diff report
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:registry -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:82, scripts/validate/diff-script-registry.ts:6
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### validate:scripts:ux

- Group: Validation
- Command: `bun scripts/validate/validate-scripts-ux.ts`
- Power: critical
- Purpose: Validates scripts for consistent UX, logging, and exit usage.
- Source: `scripts/validate/validate-scripts-ux.ts`
- Registered usage: `bun run validate:scripts:ux`
- Usage:
  - Primary purpose: Validates scripts for consistent UX, logging, and exit usage.
  - Flags: none baked into this runner. You can append more args with `bun run validate:scripts:ux -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:226
  - Other files: .github/workflows/ci.yml:226, .husky/pre-commit:27, .husky/pre-commit:29, .husky/pre-push:135, .husky/pre-push:137, docs/scripts/SCRIPT_REGISTRY.md:85, scripts/validate/validate-scripts-ux.ts:6
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### validate:scan:packages

- Group: Validation
- Command: `bun scripts/validate/scan-package-scripts.ts`
- Power: medium
- Purpose: Walk all runtime spec docs and extract unique script references
- Source: `scripts/validate/scan-package-scripts.ts`
- Registered usage: `bun run validate:scan:packages`
- Usage:
  - Primary purpose: Walk all runtime spec docs and extract unique script references
  - Flags: none baked into this runner. You can append more args with `bun run validate:scan:packages -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:78, scripts/validate/scan-package-scripts.ts:6
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:check:store-cycles

- Group: Architecture
- Command: `bun scripts/check-store-cycles.ts`
- Power: medium
- Purpose: Runs madge on each app's src/core/state/ to assert zero circular dependencies. Exits with non-zero code on any detected cycle.
- Source: `scripts/check-store-cycles.ts`
- Registered usage: `bun run arch:check:store-cycles`
- Usage:
  - Primary purpose: Runs madge on each app's src/core/state/ to assert zero circular dependencies. Exits with non-zero code on any detected cycle.
  - Flags: none baked into this runner. You can append more args with `bun run arch:check:store-cycles -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:361, reports/SCRIPT_REFACTOR_REPORT.md:483, scripts/check-store-cycles.ts:8, docs/scripts/SCRIPT_REGISTRY.md:19, specs/runtime/ui-06-state-management/guides/TESTING_GUIDE.md:51, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:19
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:add-module

- Group: Architecture
- Command: `bun scripts/architecture/add-module.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture/add-module.ts`
- Registered usage: `bun run arch:add-module`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:add-module -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: README.md:329, README.md:488, specs/runtime/infra-005-lint-governance/plan.md:591, scripts/infra-audit.ts:2175, specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md:387, specs/runtime/infra-010-hybrid-lint-format-pipeline/spec.md:589, specs/runtime/infra-010-hybrid-lint-format-pipeline/plan.md:519, specs/runtime/infra-011-incremental-architecture-guard/quickstart.md:127, specs/runtime/infra-18-developer-experience-automation/plan.md:717, specs/runtime/infra-19-ai-agent-runtime-environment/plan.md:595, specs/runtime/infra-19-ai-agent-runtime-environment/tasks.md:228, specs/runtime/030-categories/tasks.md:22, +2 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:generate

- Group: Architecture
- Command: `bun scripts/architecture/generate-architecture-map.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture/generate-architecture-map.ts`
- Registered usage: `bun run arch:generate`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:generate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: README.md:385, scripts/architecture/visualize.ts:288, docs/architecture/visualization/README.md:47, specs/runtime/infra-005-lint-governance/spec.md:563, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:42, specs/runtime/infra-008-architecture-visualization/plan.md:527, specs/runtime/infra-008-architecture-visualization/data-model.md:44
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:audit

- Group: Architecture
- Command: `bun scripts/infra-audit.ts`
- Power: critical
- Purpose: Monorepo governance scanner — audits Vitest, ESLint, Playwright, import boundaries, and outputs infra-audit-report.json.
- Source: `scripts/infra-audit.ts`
- Registered usage: `bun run arch:audit`
- Usage:
  - Primary purpose: Monorepo governance scanner — audits Vitest, ESLint, Playwright, import boundaries, and outputs infra-audit-report.json.
  - Flags: none baked into this runner. You can append more args with `bun run arch:audit -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `arch:refresh`, `arch:fix`, `arch:audit:check`
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:29, reports/SCRIPT_REFACTOR_REPORT.md:38, reports/SCRIPT_REFACTOR_REPORT.md:39, reports/SCRIPT_REFACTOR_REPORT.md:53, reports/SCRIPT_REFACTOR_REPORT.md:110, reports/SCRIPT_REFACTOR_REPORT.md:143, reports/SCRIPT_REFACTOR_REPORT.md:362, reports/SCRIPT_REFACTOR_REPORT.md:364, reports/SCRIPT_REFACTOR_REPORT.md:366, reports/SCRIPT_REFACTOR_REPORT.md:579, specs/runtime/infra-007-module-boundaries/spec.md:96, specs/runtime/infra-007-module-boundaries/spec.md:116, +108 more
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: arch:refresh, arch:fix, arch:audit:check.

### arch:gitnexus:context

- Group: Architecture
- Command: `bun scripts/gitnexus-context.ts`
- Power: medium
- Purpose: Generates a structured GitNexus context JSON artifact from git state and ai-architecture-brain.json for AI orchestrators and CI gates.
- Source: `scripts/gitnexus-context.ts`
- Registered usage: `bun run arch:gitnexus:context`
- Usage:
  - Primary purpose: Generates a structured GitNexus context JSON artifact from git state and ai-architecture-brain.json for AI orchestrators and CI gates.
  - Flags: none baked into this runner. You can append more args with `bun run arch:gitnexus:context -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `arch:refresh`
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:78, reports/SCRIPT_REFACTOR_REPORT.md:85, reports/SCRIPT_REFACTOR_REPORT.md:94, reports/SCRIPT_REFACTOR_REPORT.md:601, reports/SCRIPT_REFACTOR_REPORT.md:610, reports/SCRIPT_REFACTOR_REPORT.md:651, reports/SCRIPT_REFACTOR_REPORT.md:660, reports/SCRIPT_REFACTOR_REPORT.md:672, reports/SCRIPT_REFACTOR_REPORT.md:707, reports/SCRIPT_REFACTOR_REPORT.md:724, reports/SCRIPT_REFACTOR_REPORT.md:793, docs/audit-reports/AI_SYSTEM_AUDIT_REPORT.md:819, +54 more
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: arch:refresh.

### arch:gitnexus:validate

- Group: Architecture
- Command: `bun scripts/validate/validate-gitnexus.ts`
- Power: medium
- Purpose: Validates the gitnexus-context.json artifact for file presence, structure, semantics, and freshness.
- Source: `scripts/validate/validate-gitnexus.ts`
- Registered usage: `bun run arch:gitnexus:validate`
- Usage:
  - Primary purpose: Validates the gitnexus-context.json artifact for file presence, structure, semantics, and freshness.
  - Flags: none baked into this runner. You can append more args with `bun run arch:gitnexus:validate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:74, reports/SCRIPT_REFACTOR_REPORT.md:79, reports/SCRIPT_REFACTOR_REPORT.md:86, reports/SCRIPT_REFACTOR_REPORT.md:90, reports/SCRIPT_REFACTOR_REPORT.md:95, reports/SCRIPT_REFACTOR_REPORT.md:100, reports/SCRIPT_REFACTOR_REPORT.md:571, reports/SCRIPT_REFACTOR_REPORT.md:602, reports/SCRIPT_REFACTOR_REPORT.md:611, reports/SCRIPT_REFACTOR_REPORT.md:652, reports/SCRIPT_REFACTOR_REPORT.md:673, reports/SCRIPT_REFACTOR_REPORT.md:685, +34 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:refresh

- Group: Architecture
- Command: `bun arch:audit && bun arch:gitnexus:context`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:refresh -- <args>` only if the underlying tool supports them.
- Depends on: `arch:audit`, `arch:gitnexus:context`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:240, specs/runtime/infra-005-lint-governance/plan.md:617, specs/runtime/infra-005-lint-governance/tasks.md:139, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:45
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:context:build

- Group: Architecture
- Command: `bun scripts/context/build.ts`
- Power: critical
- Purpose: Generates docs/ai/context/gitnexus-context.json via assembleContext(). Uses atomic write (write to .tmp then renameSync) to prevent partial artifact state. Supports --dry-run (print to stdout only), --all (full workspace), --force (skip freshness check and always regenerate).
- Source: `scripts/context/build.ts`
- Registered usage: `bun run arch:context:build [-- --dry-run] [-- --all] [-- --force]`
- Usage:
  - Primary purpose: Generates docs/ai/context/gitnexus-context.json via assembleContext(). Uses atomic write (write to .tmp then renameSync) to prevent partial artifact state. Supports --dry-run (print to stdout only), --all (full workspace), --force (skip freshness check and always regenerate).
  - Flags: none baked into this runner. You can append more args with `bun run arch:context:build -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:42
  - Other files: .husky/pre-commit:59, .github/workflows/architecture-governance.yml:42, docs/scripts/context-build.md:20, docs/scripts/context-build.md:23, docs/scripts/context-build.md:26, docs/scripts/context-build.md:29, docs/scripts/context-validate.md:21, docs/scripts/context-validate.md:63, docs/scripts/context-validate.md:70, docs/scripts/context-validate.md:77, docs/scripts/context-impact.md:67, docs/scripts/SCRIPT_REGISTRY.md:20, +20 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### arch:context:changed

- Group: Architecture
- Command: `bun scripts/context/changed.ts`
- Power: medium
- Purpose: Resolves staged changed files via `git diff --cached` and writes the result to docs/ai/context/context-changed.json with a 5-minute freshness cache. Subsequent reads within the cache window skip the git invocation. A clean staging area (no changed files) is a valid state — the artifact is written with an empty changedFiles array rather than exiting non-zero.
- Source: `scripts/context/changed.ts`
- Registered usage: `bun run arch:context:changed`
- Usage:
  - Primary purpose: Resolves staged changed files via `git diff --cached` and writes the result to docs/ai/context/context-changed.json with a 5-minute freshness cache. Subsequent reads within the cache window skip the git invocation. A clean staging area (no changed files) is a valid state — the artifact is written with an empty changedFiles array rather than exiting non-zero.
  - Flags: none baked into this runner. You can append more args with `bun run arch:context:changed -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `governance:gate:changed`
- Used in:
  - Workflows: None found
  - Other files: .husky/pre-commit:53, .husky/pre-push:41, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_28_GITNEXUS_CONTEXT_AWARE_GOVERNANCE.md:209, specs/runtime/infra-028-gitnexus-context-aware-governance/reports/SPECIFY_REPORT.md:51, specs/runtime/infra-028-gitnexus-context-aware-governance/PR_SUMMARY.md:91, specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md:86, specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md:292, specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md:424, specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md:431, specs/runtime/infra-028-gitnexus-context-aware-governance/plan.md:286, specs/runtime/infra-028-gitnexus-context-aware-governance/plan.md:412, specs/runtime/infra-028-gitnexus-context-aware-governance/guides/TESTING_GUIDE.md:122, +11 more
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: governance:gate:changed.

### arch:context:impact

- Group: Architecture
- Command: `bun scripts/context/impact.ts`
- Power: medium
- Purpose: Synthesizes risk indicators from docs/ai/context/gitnexus-context.json, filtered by the staged changed files recorded in context-changed.json. A risk indicator is included when its `affectedBy` set intersects the staged changed files. Writes the result to docs/ai/context/context-impact.json. If context-changed.json does not exist, falls back to the `changedFiles` array embedded in the main context artifact. Output mode: (default) one `indicator.module` per line, sorted alphabetically --json full riskIndicators array as JSON on stdout
- Source: `scripts/context/impact.ts`
- Registered usage: `bun run arch:context:impact [-- --json]`
- Usage:
  - Primary purpose: Synthesizes risk indicators from docs/ai/context/gitnexus-context.json, filtered by the staged changed files recorded in context-changed.json. A risk indicator is included when its `affectedBy` set intersects the staged changed files. Writes the result to docs/ai/context/context-impact.json. If context-changed.json does not exist, falls back to the `changedFiles` array embedded in the main context artifact. Output mode: (default) one `indicator.module` per line, sorted alphabetically --json full riskIndicators array as JSON on stdout
  - Flags: none baked into this runner. You can append more args with `bun run arch:context:impact -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/context-impact.md:24, docs/scripts/context-impact.md:27, docs/scripts/SCRIPT_REGISTRY.md:22, scripts/context/impact.ts:18, specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md:118, specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md:425, specs/runtime/infra-028-gitnexus-context-aware-governance/plan.md:323, specs/runtime/infra-028-gitnexus-context-aware-governance/guides/TESTING_GUIDE.md:153, specs/runtime/infra-028-gitnexus-context-aware-governance/guides/TESTING_GUIDE.md:161
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:context:validate

- Group: Architecture
- Command: `bun scripts/context/validate.ts`
- Power: critical
- Purpose: Validates docs/ai/context/gitnexus-context.json against docs/ai/gitnexus-context.schema.json. No external schema library (NFR-005). Validation order (stops at first failure): 1. Artifact file exists 2. Valid JSON 3. Schema file exists and is readable 4. All required fields present 5. schemaVersion matches schema.version 6. generatedAt is < maxAgeHours old (default: 24h)
- Source: `scripts/context/validate.ts`
- Registered usage: `bun run arch:context:validate`
- Usage:
  - Primary purpose: Validates docs/ai/context/gitnexus-context.json against docs/ai/gitnexus-context.schema.json. No external schema library (NFR-005). Validation order (stops at first failure): 1. Artifact file exists 2. Valid JSON 3. Schema file exists and is readable 4. All required fields present 5. schemaVersion matches schema.version 6. generatedAt is < maxAgeHours old (default: 24h)
  - Flags: none baked into this runner. You can append more args with `bun run arch:context:validate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:42
  - Other files: .github/workflows/architecture-governance.yml:42, .husky/pre-commit:58, docs/scripts/context-validate.md:31, docs/scripts/context-validate.md:64, docs/scripts/context-validate.md:71, docs/scripts/SCRIPT_REGISTRY.md:23, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_28_GITNEXUS_CONTEXT_AWARE_GOVERNANCE.md:199, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_28_GITNEXUS_CONTEXT_AWARE_GOVERNANCE.md:210, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_28_GITNEXUS_CONTEXT_AWARE_GOVERNANCE.md:224, scripts/context/validate.ts:17, specs/runtime/infra-028-gitnexus-context-aware-governance/PR_SUMMARY.md:92, specs/runtime/infra-028-gitnexus-context-aware-governance/PR_SUMMARY.md:101, +14 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### arch:fix

- Group: Architecture
- Command: `bun arch:audit --fix-map`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--fix-map`: Update generated architecture map artifacts when drift is detected.
- Depends on: `arch:audit`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:238, specs/runtime/infra-006-architecture-guard/spec.md:87, specs/runtime/infra-005-lint-governance/plan.md:613, specs/runtime/infra-005-lint-governance/plan.md:787, specs/runtime/infra-005-lint-governance/tasks.md:139, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:46, specs/runtime/infra-008-architecture-visualization/data-model.md:44
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:guard

- Group: Architecture
- Command: `bun scripts/architecture-guard/architecture-guard.ts`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-guard/architecture-guard.ts`
- Registered usage: `bun run arch:guard`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:guard -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:152
  - Other files: .github/workflows/ci.yml:152, README.md:275, README.md:281, README.md:287, README.md:293, docs/architecture-guard/UNIFIED_ARCHITECTURE_GUARD.md:7, docs/architecture-guard/UNIFIED_ARCHITECTURE_GUARD.md:8, docs/architecture-guard/UNIFIED_ARCHITECTURE_GUARD.md:9, docs/architecture-guard/UNIFIED_ARCHITECTURE_GUARD.md:10, scripts/validate/**tests**/script-usage.test.ts:59, scripts/policy-engine/adapters/architecture-guard.adapter.ts:4, scripts/policy-engine/adapters/architecture-guard.adapter.ts:38, +132 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### arch:guard:ci

- Group: Architecture
- Command: `bun scripts/architecture-guard/architecture-guard.ts --ci`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-guard/architecture-guard.ts`
- Registered usage: `bun run arch:guard:ci`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--ci`: Enable CI-oriented behavior and reporting.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: README.md:281, docs/architecture-guard/UNIFIED_ARCHITECTURE_GUARD.md:8, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_14_ARCHITECTURE_ALIGNMENT_MIGRATION.md:193, specs/runtime/infra-013-unified-architecture-guard/guides/TESTING_GUIDE.md:62, specs/runtime/infra-013-unified-architecture-guard/guides/TESTING_GUIDE.md:100, specs/runtime/infra-013-unified-architecture-guard/guides/TESTING_GUIDE.md:123, specs/runtime/infra-013-unified-architecture-guard/quickstart.md:16, specs/runtime/infra-013-unified-architecture-guard/quickstart.md:69, specs/runtime/infra-015-autonomous-architecture-health/quickstart.md:168, specs/runtime/infra-015-autonomous-architecture-health/plan.md:34, specs/runtime/infra-015-autonomous-architecture-health/plan.md:145, specs/runtime/infra-015-autonomous-architecture-health/guides/TESTING_GUIDE.md:285, +14 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:guard:changed

- Group: Architecture
- Command: `bun scripts/architecture-guard/architecture-guard.ts --changed`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-guard/architecture-guard.ts`
- Registered usage: `bun run arch:guard:changed`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--changed`: Restrict the check to changed files or modules.
- Depends on: None
- Used by other root scripts: `governance:gate:changed`
- Used in:
  - Workflows: None found
  - Other files: README.md:287, docs/architecture-guard/UNIFIED_ARCHITECTURE_GUARD.md:9, docs/scripts/context-changed.md:58, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:203, specs/runtime/infra-029-policy-engine-and-governance-rules-layer/reports/CLOSURE_REPORT.md:138, scripts/policy-engine/adapters/architecture-guard.adapter.ts:38, specs/runtime/infra-013-unified-architecture-guard/guides/TESTING_GUIDE.md:65, specs/runtime/infra-013-unified-architecture-guard/guides/TESTING_GUIDE.md:112, specs/runtime/infra-013-unified-architecture-guard/quickstart.md:30, specs/runtime/infra-027-unified-governance-gate-system/spec.md:90, specs/runtime/infra-028-gitnexus-context-aware-governance/plan.md:476, specs/runtime/infra-027-unified-governance-gate-system/plan.md:139, +6 more
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: governance:gate:changed.

### arch:diff

- Group: Architecture
- Command: `bun scripts/architecture-diff.ts`
- Power: medium
- Purpose: Detect architecture violations in the current change set (PR/staged diff) by comparing changed imports against ARCHITECTURE_CONTRACT.json rules.
- Source: `scripts/architecture-diff.ts`
- Registered usage: `bun run arch:diff`
- Usage:
  - Primary purpose: Detect architecture violations in the current change set (PR/staged diff) by comparing changed imports against ARCHITECTURE_CONTRACT.json rules.
  - Flags: none baked into this runner. You can append more args with `bun run arch:diff -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:24, scripts/architecture-diff.ts:6
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:health

- Group: Architecture
- Command: `bun scripts/architecture-health/architecture-health.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-health/architecture-health.ts`
- Registered usage: `bun run arch:health`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:health -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: .github/workflows/architecture-governance.yml:66, scripts/dev/hygiene-checks/arch-guard-check.ts:3, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:204, docs/architecture/health/README.md:7, docs/architecture/health/README.md:8, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_22_REPOSITORY_HYGIENE_VERIFICATION.md:212, tests/static/07-architecture-health-governance.test.ts:32, specs/runtime/infra-015-autonomous-architecture-health/PR_SUMMARY.md:34, specs/runtime/infra-015-autonomous-architecture-health/PR_SUMMARY.md:122, specs/runtime/infra-015-autonomous-architecture-health/PR_SUMMARY.md:242, specs/runtime/infra-015-autonomous-architecture-health/guides/TESTING_GUIDE.md:29, specs/runtime/infra-015-autonomous-architecture-health/guides/TESTING_GUIDE.md:161, +37 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:health:ci

- Group: Architecture
- Command: `bun scripts/architecture-health/architecture-health.ts --ci`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture-health/architecture-health.ts`
- Registered usage: `bun run arch:health:ci`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--ci`: Enable CI-oriented behavior and reporting.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:66
  - Other files: .github/workflows/architecture-governance.yml:66, docs/architecture/health/README.md:8, tests/static/07-architecture-health-governance.test.ts:32, specs/runtime/infra-015-autonomous-architecture-health/quickstart.md:102, specs/runtime/infra-015-autonomous-architecture-health/contracts/architecture-health-cli-contract.md:11, specs/runtime/infra-015-autonomous-architecture-health/contracts/architecture-health-cli-contract.md:53, specs/runtime/infra-027-unified-governance-gate-system/research.md:60, specs/runtime/infra-025-script-system-standardization-and-governance/research.md:315, specs/runtime/infra-020-ai-execution-orchestration-engine/plan.md:701, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:51
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### arch:validate:brain

- Group: Architecture
- Command: `bun scripts/governance/validate-architecture-brain.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/governance/validate-architecture-brain.ts`
- Registered usage: `bun run arch:validate:brain`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:validate:brain -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:344, reports/SCRIPT_REFACTOR_REPORT.md:420, reports/SCRIPT_REFACTOR_REPORT.md:425, reports/SCRIPT_REFACTOR_REPORT.md:429, reports/SCRIPT_REFACTOR_REPORT.md:434, reports/SCRIPT_REFACTOR_REPORT.md:619, reports/SCRIPT_REFACTOR_REPORT.md:623, reports/SCRIPT_REFACTOR_REPORT.md:627, reports/SCRIPT_REFACTOR_REPORT.md:631, reports/SCRIPT_REFACTOR_REPORT.md:635, reports/SCRIPT_REFACTOR_REPORT.md:712, reports/SCRIPT_REFACTOR_REPORT.md:716, +17 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:visualize

- Group: Architecture
- Command: `bun scripts/architecture/visualize.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/architecture/visualize.ts`
- Registered usage: `bun run arch:visualize`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run arch:visualize -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/architecture/visualize.ts:245, tests/static/06-architecture-visualization.test.ts:5, tests/static/06-architecture-visualization.test.ts:9, tests/static/06-architecture-visualization.test.ts:31, tests/static/06-architecture-visualization.test.ts:41, tests/static/06-architecture-visualization.test.ts:46, tests/static/06-architecture-visualization.test.ts:51, tests/static/06-architecture-visualization.test.ts:54, docs/architecture/visualization/README.md:4, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:53, specs/runtime/infra-008-architecture-visualization/reports/PLAN_REPORT.md:95, specs/runtime/infra-008-architecture-visualization/plan.md:84, +39 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### arch:type-safety-guard

- Group: Architecture
- Command: `bun scripts/type-safety-guard.ts`
- Power: medium
- Purpose: Unified architecture guard — runs type safety checks and validates import boundaries using the architecture contract.
- Source: `scripts/type-safety-guard.ts`
- Registered usage: `bun run arch:type-safety-guard`
- Usage:
  - Primary purpose: Unified architecture guard — runs type safety checks and validates import boundaries using the architecture contract.
  - Flags: none baked into this runner. You can append more args with `bun run arch:type-safety-guard -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `validate:types`
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:168, reports/SCRIPT_REFACTOR_REPORT.md:173, reports/SCRIPT_REFACTOR_REPORT.md:178, reports/SCRIPT_REFACTOR_REPORT.md:183, reports/SCRIPT_REFACTOR_REPORT.md:188, reports/SCRIPT_REFACTOR_REPORT.md:248, reports/SCRIPT_REFACTOR_REPORT.md:354, reports/SCRIPT_REFACTOR_REPORT.md:430, reports/SCRIPT_REFACTOR_REPORT.md:447, reports/SCRIPT_REFACTOR_REPORT.md:530, reports/SCRIPT_REFACTOR_REPORT.md:535, reports/SCRIPT_REFACTOR_REPORT.md:540, +30 more
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: validate:types.

### arch:audit:check

- Group: Architecture
- Command: `bun run arch:audit --check`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--check`: Check-only mode; fail if drift exists.
- Depends on: `arch:audit`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:38, reports/SCRIPT_REFACTOR_REPORT.md:362, specs/runtime/infra-009-ai-architecture-context/guides/TESTING_GUIDE.md:393, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:90
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test

- Group: Testing
- Command: `vitest run`
- Power: critical
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flags: none baked into this runner. You can append more args with `bun run test -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:80, reports/SCRIPT_REFACTOR_REPORT.md:96, reports/SCRIPT_REFACTOR_REPORT.md:105, reports/SCRIPT_REFACTOR_REPORT.md:371, reports/SCRIPT_REFACTOR_REPORT.md:451, reports/SCRIPT_REFACTOR_REPORT.md:455, reports/SCRIPT_REFACTOR_REPORT.md:459, reports/SCRIPT_REFACTOR_REPORT.md:467, reports/SCRIPT_REFACTOR_REPORT.md:471, reports/SCRIPT_REFACTOR_REPORT.md:479, reports/SCRIPT_REFACTOR_REPORT.md:497, reports/SCRIPT_REFACTOR_REPORT.md:501, +501 more
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### test:unit

- Group: Testing
- Command: `vitest run --project mmc --project backoffice --project frontoffice --project api-client --project domain-core --project logger --project config --project redis-utils --project types --project ui-system --project validation`
- Power: critical
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
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
  - Workflows: .github/workflows/ci.yml:353, .github/workflows/ci.yml:548
  - Other files: .github/workflows/ci.yml:353, .github/workflows/ci.yml:356, .github/workflows/ci.yml:548, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:191, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:232, apps/worker/README.md:45, .husky/pre-push:82, .husky/pre-push:87, apps/api/README.md:46, apps/frontoffice/README.md:43, specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md:48, specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md:139, +88 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:unit:debug

- Group: Testing
- Command: `vitest run --reporter verbose --project mmc --project backoffice --project frontoffice --project api-client --project domain-core --project logger --project config --project redis-utils --project types --project ui-system --project validation`
- Power: low
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
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
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:22
- Removal assessment: Usually removable if the team no longer uses the demo or debug workflow.

### test:unit:boundaries

- Group: Testing
- Command: `vitest run tests/static/module-boundaries.test.ts tests/unit/infra-audit/infra-audit-boundaries.test.ts tests/unit/ai-guard/ai-guard-boundaries.test.ts`
- Power: critical
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flags: none baked into this runner. You can append more args with `bun run test:unit:boundaries -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:356
  - Other files: .github/workflows/ci.yml:356, specs/runtime/infra-013-unified-architecture-guard/guides/TESTING_GUIDE.md:83, specs/runtime/infra-013-unified-architecture-guard/quickstart.md:73, specs/runtime/infra-007-module-boundaries/PR_SUMMARY.md:200, specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md:74, specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md:105, specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md:117, specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md:349, specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md:432, specs/runtime/infra-007-module-boundaries/audits/VALIDATION_REPORT.md:43, specs/runtime/infra-007-module-boundaries/audits/VALIDATION_REPORT.md:134, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:23
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:integration

- Group: Testing
- Command: `vitest run --dir tests/integration --fileParallelism=false`
- Power: critical
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--dir tests/integration`: Target a specific directory. Value: tests/integration.
  - Flag `--fileParallelism false`: Control whether test files run in parallel. Value: false.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:462
  - Other files: docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:192, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:233, .github/workflows/ci.yml:462, apps/api/README.md:47, apps/api/README.md:51, specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md:48, specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md:142, specs/runtime/infra-003-alignment/reports/CLOSURE_REPORT.md:263, specs/runtime/infra-003-alignment/plan.md:812, specs/runtime/infra-003-alignment/guides/TESTING_GUIDE.md:302, specs/runtime/infra-001-typescript-stabilization/audits/VALIDATION_REPORT.md:22, specs/runtime/infra-governance/spec.md:102, +2 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:performance

- Group: Testing
- Command: `vitest run --dir tests/performance`
- Power: medium
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--dir tests/performance`: Target a specific directory. Value: tests/performance.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: tests/performance/licenses.benchmark.test.ts:7, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:25
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test:static

- Group: Testing
- Command: `vitest run --dir tests/static`
- Power: medium
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--dir tests/static`: Target a specific directory. Value: tests/static.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:26, specs/runtime/infra-007-module-boundaries/reports/IMPLEMENT_REPORT.md:75, specs/runtime/infra-007-module-boundaries/plan.md:830, specs/runtime/infra-007-module-boundaries/tasks.md:214, specs/runtime/infra-008-architecture-visualization/spec.md:704, specs/runtime/infra-008-architecture-visualization/plan.md:1130, specs/runtime/infra-008-architecture-visualization/tasks.md:201, specs/runtime/infra-008-architecture-visualization/tasks.md:251, specs/runtime/infra-008-architecture-visualization/tasks.md:326, specs/runtime/infra-001-typescript-stabilization/reports/IMPLEMENT_REPORT.md:127, specs/runtime/infra-001-typescript-stabilization/guides/TESTING_GUIDE.md:113, specs/runtime/infra-001-typescript-stabilization/audits/VALIDATION_REPORT.md:20, +6 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test:coverage

- Group: Testing
- Command: `vitest run --coverage`
- Power: medium
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--coverage`: Collect code coverage.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:131, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:27, specs/runtime/infra-002-audit-checklist/reports/SAFE_ROLLOUT_PLAN.md:59, specs/runtime/infra-002-audit-checklist/reports/SAFE_ROLLOUT_PLAN.md:107, specs/runtime/infra-governance/reports/IMPLEMENT_REPORT.md:282, specs/runtime/infra-governance/tasks.md:63, specs/runtime/infra-governance/tasks.md:178, specs/runtime/infra-governance/audits/VALIDATION_REPORT.md:59, specs/runtime/infra-governance/audits/VALIDATION_REPORT.md:61, specs/runtime/infra-governance/audits/VALIDATION_REPORT.md:98, specs/runtime/infra-governance/audits/VALIDATION_REPORT.md:285, specs/runtime/infra-governance/audits/ANALYZE_REPORT.md:34
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test:e2e:mmc

- Group: Testing
- Command: `bunx playwright test --config apps/mmc/playwright.config.ts`
- Power: critical
- Purpose: Run Playwright end-to-end tests for the configured app.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Playwright end-to-end tests for the configured app.
  - Flag `--config apps/mmc/playwright.config.ts`: Use the specified configuration file. Value: apps/mmc/playwright.config.ts.
- Depends on: None
- Used by other root scripts: `test:e2e`
- Used in:
  - Workflows: .github/workflows/ci.yml:602
  - Other files: .github/workflows/ci.yml:602, apps/mmc/README.md:50, apps/mmc/tests/e2e/smoke.spec.ts:10, tests/e2e/app-load.spec.ts:13, specs/runtime/infra-003-alignment/plan.md:382, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:28, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:615, specs/runtime/infra-governance/tasks.md:120, specs/runtime/infra-governance/plan.md:366, specs/runtime/infra-governance/plan.md:668, specs/runtime/infra-governance/plan.md:675
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:e2e:backoffice

- Group: Testing
- Command: `bunx playwright test --config apps/backoffice/playwright.config.ts`
- Power: critical
- Purpose: Run Playwright end-to-end tests for the configured app.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Playwright end-to-end tests for the configured app.
  - Flag `--config apps/backoffice/playwright.config.ts`: Use the specified configuration file. Value: apps/backoffice/playwright.config.ts.
- Depends on: None
- Used by other root scripts: `test:e2e`
- Used in:
  - Workflows: .github/workflows/ci.yml:652
  - Other files: .github/workflows/ci.yml:652, tests/e2e/app-load.spec.ts:14, apps/backoffice/README.md:51, apps/backoffice/tests/e2e/smoke.spec.ts:10, specs/runtime/infra-003-alignment/plan.md:382, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:29, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:615, specs/runtime/infra-governance/plan.md:409, specs/runtime/infra-governance/tasks.md:124
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:e2e:frontoffice

- Group: Testing
- Command: `bunx playwright test --config apps/frontoffice/playwright.config.ts`
- Power: critical
- Purpose: Run Playwright end-to-end tests for the configured app.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Playwright end-to-end tests for the configured app.
  - Flag `--config apps/frontoffice/playwright.config.ts`: Use the specified configuration file. Value: apps/frontoffice/playwright.config.ts.
- Depends on: None
- Used by other root scripts: `test:e2e`
- Used in:
  - Workflows: .github/workflows/ci.yml:702
  - Other files: .github/workflows/ci.yml:702, tests/e2e/app-load.spec.ts:15, apps/frontoffice/README.md:50, apps/frontoffice/tests/e2e/smoke.spec.ts:10, specs/runtime/infra-003-alignment/plan.md:382, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:30, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:615, specs/runtime/infra-governance/plan.md:452, specs/runtime/infra-governance/tasks.md:128
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### test:e2e

- Group: Testing
- Command: `bun run test:e2e:mmc && bun run test:e2e:backoffice && bun run test:e2e:frontoffice`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run test:e2e -- <args>` only if the underlying tool supports them.
- Depends on: `test:e2e:mmc`, `test:e2e:backoffice`, `test:e2e:frontoffice`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: .github/workflows/ci.yml:602, .github/workflows/ci.yml:652, .github/workflows/ci.yml:702, apps/mmc/README.md:50, apps/mmc/tests/e2e/smoke.spec.ts:10, .agents/agents/copilot-instructions.md:57, tests/e2e/app-load.spec.ts:13, tests/e2e/app-load.spec.ts:14, tests/e2e/app-load.spec.ts:15, tests/e2e/app-load.spec.ts:16, apps/backoffice/README.md:51, apps/backoffice/tests/e2e/smoke.spec.ts:10, +22 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### build

- Group: Build
- Command: `bun run --workspaces build`
- Power: critical
- Purpose: Run workspace build scripts across all workspaces.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run workspace build scripts across all workspaces.
  - Flag `--workspaces build`: Runner-level option passed directly to the underlying tool. Value: build.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:751
  - Other files: .github/workflows/ci.yml:69, .github/workflows/ci.yml:109, .github/workflows/ci.yml:751, Dockerfile:70, Dockerfile:74, specs/runtime/021-role-permission-system/PR_SUMMARY.md:350, .agents/skills/package-manager-governance/SKILL.md:173, .agents/agents/copilot-instructions.md:53, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_02_AUDIT_CHECKLIST.md:230, docs/operations/LICENSES_OPERATIONAL_RUNBOOK.md:60, tests/unit/policy-engine/rules/SCRIPTS-001.test.ts:60, tests/unit/policy-engine/rules/SCRIPTS-001.test.ts:73, +34 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### build:api

- Group: Build
- Command: `bun --cwd apps/api build`
- Power: medium
- Purpose: Build a specific workspace.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Build a specific workspace.
  - Flag `--cwd apps/api`: Run the underlying Bun command inside the given workspace. Value: apps/api.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/021-role-permission-system/PR_SUMMARY.md:350, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:84
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### build:packages

- Group: Build
- Command: `bash -lc 'for d in packages/*; do if [ -f "$d/package.json" ]; then (cd "$d" && echo "Building $d" && bun run build); fi; done'`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `-lc 'for d in packages/*; do if [ -f "$d/package.json" ]; then (cd "$d" && echo "Building $d" && bun run build); fi; done'`: Runner-level option passed directly to the underlying tool. Value: 'for d in packages/\*; do if [ -f "$d/package.json" ]; then (cd "$d" && echo "Building $d" && bun run build); fi; done'.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:69, .github/workflows/ci.yml:109
  - Other files: .github/workflows/ci.yml:69, .github/workflows/ci.yml:109, specs/runtime/020-status-workflow-engine/guides/TESTING_GUIDE.md:417, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:85
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### dev

- Group: Development
- Command: `bun run dev:all`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run dev -- <args>` only if the underlying tool supports them.
- Depends on: `dev:all`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:196, reports/SCRIPT_REFACTOR_REPORT.md:201, reports/SCRIPT_REFACTOR_REPORT.md:210, reports/SCRIPT_REFACTOR_REPORT.md:215, reports/SCRIPT_REFACTOR_REPORT.md:223, reports/SCRIPT_REFACTOR_REPORT.md:231, reports/SCRIPT_REFACTOR_REPORT.md:235, reports/SCRIPT_REFACTOR_REPORT.md:239, reports/SCRIPT_REFACTOR_REPORT.md:249, reports/SCRIPT_REFACTOR_REPORT.md:308, reports/SCRIPT_REFACTOR_REPORT.md:309, reports/SCRIPT_REFACTOR_REPORT.md:318, +236 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:infra

- Group: Development
- Command: `docker compose up -d`
- Power: medium
- Purpose: Start the local infrastructure stack in detached mode.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Start the local infrastructure stack in detached mode.
  - Flag `-d`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:33
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:api

- Group: Development
- Command: `bun --cwd apps/api dev`
- Power: medium
- Purpose: Start a specific workspace development process.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Start a specific workspace development process.
  - Flag `--cwd apps/api`: Run the underlying Bun command inside the given workspace. Value: apps/api.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/templates/guides/testing-guide-template.md:59, specs/templates/guides/testing-guide-template.md:162, specs/runtime/020-status-workflow-engine/guides/TESTING_GUIDE.md:95, specs/runtime/022-divisions/guides/TESTING_GUIDE.md:48, specs/runtime/022-divisions/guides/TESTING_GUIDE.md:101, specs/runtime/031-category-values/guides/TESTING_GUIDE.md:81, specs/runtime/031-category-values/guides/TESTING_GUIDE.md:266, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:34, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340, specs/runtime/ui-00-runtime-architecture/guides/TESTING_GUIDE.md:108, specs/runtime/ui-00-runtime-architecture/guides/TESTING_GUIDE.md:266, specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md:111, +21 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:worker

- Group: Development
- Command: `bun --cwd apps/worker dev`
- Power: medium
- Purpose: Start a specific workspace development process.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Start a specific workspace development process.
  - Flag `--cwd apps/worker`: Run the underlying Bun command inside the given workspace. Value: apps/worker.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:372, reports/SCRIPT_REFACTOR_REPORT.md:463, specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md:117, specs/templates/guides/testing-guide-template.md:62, specs/templates/guides/testing-guide-template.md:165, specs/runtime/032-tags/guides/TESTING_GUIDE.md:99, specs/runtime/019-translation-system/guides/TESTING_GUIDE.md:90, specs/runtime/019-translation-system/guides/TESTING_GUIDE.md:292, specs/runtime/ui-00-runtime-architecture/guides/TESTING_GUIDE.md:111, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:35, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:98, specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md:616, +4 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:mmc

- Group: Development
- Command: `bun --cwd apps/mmc dev`
- Power: critical
- Purpose: Start a specific workspace development process.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Start a specific workspace development process.
  - Flag `--cwd apps/mmc`: Run the underlying Bun command inside the given workspace. Value: apps/mmc.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:594
  - Other files: .github/workflows/ci.yml:594, apps/mmc/playwright.config.ts:9, apps/mmc/tests/e2e/smoke.spec.ts:9, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:117, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:153, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:171, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:188, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:223, specs/runtime/infra-003-alignment/plan.md:829, specs/runtime/infra-governance/tasks.md:119, specs/runtime/ui-01-auth-module/guides/TESTING_GUIDE.md:175, specs/runtime/infra-governance/plan.md:358, +4 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### dev:backoffice

- Group: Development
- Command: `bun --cwd apps/backoffice dev`
- Power: critical
- Purpose: Start a specific workspace development process.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Start a specific workspace development process.
  - Flag `--cwd apps/backoffice`: Run the underlying Bun command inside the given workspace. Value: apps/backoffice.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:644
  - Other files: .github/workflows/ci.yml:644, apps/backoffice/playwright.config.ts:9, apps/backoffice/tests/e2e/smoke.spec.ts:9, specs/runtime/infra-003-alignment/plan.md:830, specs/runtime/infra-003-alignment/guides/TESTING_GUIDE.md:454, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:118, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:206, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:37, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340, specs/runtime/infra-governance/plan.md:401, specs/runtime/infra-governance/tasks.md:124
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### dev:frontoffice

- Group: Development
- Command: `bun --cwd apps/frontoffice dev`
- Power: critical
- Purpose: Start a specific workspace development process.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Start a specific workspace development process.
  - Flag `--cwd apps/frontoffice`: Run the underlying Bun command inside the given workspace. Value: apps/frontoffice.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:694
  - Other files: .github/workflows/ci.yml:694, apps/frontoffice/playwright.config.ts:9, apps/frontoffice/tests/e2e/smoke.spec.ts:9, specs/runtime/infra-003-alignment/plan.md:831, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:119, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:239, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:38, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340, specs/runtime/infra-governance/plan.md:444, specs/runtime/infra-governance/tasks.md:128
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### dev:all

- Group: Development
- Command: `concurrently "bun run dev:api" "bun run dev:worker" "bun run dev:mmc" "bun run dev:backoffice" "bun run dev:frontoffice"`
- Power: medium
- Purpose: Start multiple long-running development services in parallel.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Start multiple long-running development services in parallel.
  - Flags: none baked into this runner. You can append more args with `bun run dev:all -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `dev`
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:39, specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md:605, specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md:1046, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:334, specs/runtime/infra-003-alignment/guides/TESTING_GUIDE.md:190
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: dev.

### dev:demo:logger

- Group: Development
- Command: `bun scripts/dev/demo-logger-features.ts`
- Power: medium
- Purpose: Demonstrates all available logger customization options and features
- Source: `scripts/dev/demo-logger-features.ts`
- Registered usage: `bun run dev:demo-logger-features`
- Usage:
  - Primary purpose: Demonstrates all available logger customization options and features
  - Flags: none baked into this runner. You can append more args with `bun run dev:demo:logger -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: `dev:demo-logger-features`
- Used in:
  - Workflows: None found
  - Other files: No direct non-workflow invocations found
- Removal assessment: Not safe to remove directly. Other root scripts depend on it: dev:demo-logger-features.

### dev:hygiene:report

- Group: Development
- Command: `bun scripts/dev/hygiene-report-generator.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/dev/hygiene-report-generator.ts`
- Registered usage: `bun run dev:hygiene:report`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run dev:hygiene:report -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:196, reports/SCRIPT_REFACTOR_REPORT.md:201, reports/SCRIPT_REFACTOR_REPORT.md:210, reports/SCRIPT_REFACTOR_REPORT.md:215, reports/SCRIPT_REFACTOR_REPORT.md:223, reports/SCRIPT_REFACTOR_REPORT.md:231, reports/SCRIPT_REFACTOR_REPORT.md:235, reports/SCRIPT_REFACTOR_REPORT.md:239, reports/SCRIPT_REFACTOR_REPORT.md:358, specs/runtime/infra-022-repository-hygiene-verification/reports/IMPLEMENT_REPORT.md:80, specs/runtime/infra-022-repository-hygiene-verification/reports/TASKS_REPORT.md:76, specs/runtime/infra-022-repository-hygiene-verification/tasks.md:85, +17 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:generate:script-docs

- Group: Development
- Command: `bun scripts/generate/script-docs.ts`
- Power: critical
- Purpose: Walk scripts/\*_\/_.ts, parse @script metadata headers, generate docs/scripts/SCRIPT_REGISTRY.md. Exits 1 on missing required metadata fields.
- Source: `scripts/generate/script-docs.ts`
- Registered usage: `bun run dev:generate:script-docs`
- Usage:
  - Primary purpose: Walk scripts/\*_\/_.ts, parse @script metadata headers, generate docs/scripts/SCRIPT_REGISTRY.md. Exits 1 on missing required metadata fields.
  - Flags: none baked into this runner. You can append more args with `bun run dev:generate:script-docs -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:168
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:249, reports/SCRIPT_REFACTOR_REPORT.md:308, reports/SCRIPT_REFACTOR_REPORT.md:318, reports/SCRIPT_REFACTOR_REPORT.md:333, reports/SCRIPT_REFACTOR_REPORT.md:355, reports/SCRIPT_REFACTOR_REPORT.md:377, reports/SCRIPT_REFACTOR_REPORT.md:562, reports/SCRIPT_REFACTOR_REPORT.md:595, reports/SCRIPT_REFACTOR_REPORT.md:656, reports/SCRIPT_REFACTOR_REPORT.md:677, .github/workflows/architecture-governance.yml:168, .agents/skills/script-system-governance/SKILL.md:121, +42 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### dev:seed:dashboard-test-data

- Group: Development
- Command: `bun run scripts/seed/dashboard-test-data.ts`
- Power: medium
- Purpose: Seed realistic MMC dashboard test data into master_db for dashboard testing
- Source: `scripts/seed/dashboard-test-data.ts`
- Registered usage: `bun run dev:seed:dashboard-test-data`
- Usage:
  - Primary purpose: Seed realistic MMC dashboard test data into master_db for dashboard testing
  - Flags: none baked into this runner. You can append more args with `bun run dev:seed:dashboard-test-data -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:309, reports/SCRIPT_REFACTOR_REPORT.md:319, reports/SCRIPT_REFACTOR_REPORT.md:334, reports/SCRIPT_REFACTOR_REPORT.md:356, reports/SCRIPT_REFACTOR_REPORT.md:513, reports/SCRIPT_REFACTOR_REPORT.md:596, reports/SCRIPT_REFACTOR_REPORT.md:695, reports/SCRIPT_REFACTOR_REPORT.md:703, reports/SCRIPT_REFACTOR_REPORT.md:737, docs/scripts/seed-dashboard-test-data.md:6, docs/scripts/seed-dashboard-test-data.md:45, docs/scripts/db-validate-licenses.md:23, +10 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:refactor:scripts

- Group: Development
- Command: `bun scripts/dev/refactor-scripts.ts`
- Power: medium
- Purpose: Applies the SCRIPT_MIGRATION_MAP to rename all "bun run <old>" references across the repository. Reads docs/scripts/SCRIPT_MIGRATION_MAP.md, builds the old→new rename index, then rewrites all matching files in-place. Supports --dry-run to preview changes without writing. Exits 1 if any unresolved references remain after the run. Writes a summary report to reports/SCRIPT_REFACTOR_REPORT.md.
- Source: `scripts/dev/refactor-scripts.ts`
- Registered usage: `bun run dev:refactor:scripts`
- Usage:
  - Primary purpose: Applies the SCRIPT_MIGRATION_MAP to rename all "bun run <old>" references across the repository. Reads docs/scripts/SCRIPT_MIGRATION_MAP.md, builds the old→new rename index, then rewrites all matching files in-place. Supports --dry-run to preview changes without writing. Exits 1 if any unresolved references remain after the run. Writes a summary report to reports/SCRIPT_REFACTOR_REPORT.md.
  - Flags: none baked into this runner. You can append more args with `bun run dev:refactor:scripts -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: .agents/skills/script-system-governance/SKILL.md:173, docs/scripts/SCRIPT_MIGRATION_MAP.md:4, docs/scripts/SCRIPT_REGISTRY.md:50, .agents/agents/orchestrator.agent.md:141, .agents/agents/orchestrator.agent.md:592, .agents/agents/orchestrator.agent.md:2782, scripts/dev/refactor-scripts.ts:11, specs/runtime/infra-025-script-system-standardization-and-governance/plan.md:538, specs/runtime/infra-025-script-system-standardization-and-governance/plan.md:633, specs/runtime/infra-025-script-system-standardization-and-governance/plan.md:635, specs/runtime/infra-025-script-system-standardization-and-governance/guides/TESTING_GUIDE.md:196, specs/runtime/infra-025-script-system-standardization-and-governance/guides/TESTING_GUIDE.md:212, +3 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:runtime:status

- Group: AI
- Command: `bun scripts/ai-runtime/runtime-status.ts`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: `scripts/ai-runtime/runtime-status.ts`
- Registered usage: `bun run ai:runtime:status`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:runtime:status -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:159
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:349, reports/SCRIPT_REFACTOR_REPORT.md:390, reports/SCRIPT_REFACTOR_REPORT.md:395, reports/SCRIPT_REFACTOR_REPORT.md:404, reports/SCRIPT_REFACTOR_REPORT.md:408, reports/SCRIPT_REFACTOR_REPORT.md:412, reports/SCRIPT_REFACTOR_REPORT.md:789, .github/workflows/ci.yml:159, specs/runtime/infra-19-ai-agent-runtime-environment/reports/IMPLEMENT_REPORT.md:91, specs/runtime/infra-19-ai-agent-runtime-environment/reports/CLOSURE_REPORT.md:40, specs/runtime/infra-19-ai-agent-runtime-environment/PR_SUMMARY.md:196, specs/runtime/infra-19-ai-agent-runtime-environment/guides/TESTING_GUIDE.md:156, +2 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### ai:run

- Group: AI
- Command: `bun scripts/ai-engine/run-task.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/ai-engine/run-task.ts`
- Registered usage: `bun run ai:run`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:run -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:349, reports/SCRIPT_REFACTOR_REPORT.md:350, reports/SCRIPT_REFACTOR_REPORT.md:351, reports/SCRIPT_REFACTOR_REPORT.md:390, reports/SCRIPT_REFACTOR_REPORT.md:395, reports/SCRIPT_REFACTOR_REPORT.md:404, reports/SCRIPT_REFACTOR_REPORT.md:408, reports/SCRIPT_REFACTOR_REPORT.md:412, reports/SCRIPT_REFACTOR_REPORT.md:789, .github/workflows/ci.yml:159, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:59, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:60, +12 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:plan

- Group: AI
- Command: `bun scripts/ai-engine/plan-task.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/ai-engine/plan-task.ts`
- Registered usage: `bun run ai:plan`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:plan -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:63, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:121, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:130, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:138, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:139
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:validate

- Group: AI
- Command: `bun scripts/ai-engine/validate-execution.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/ai-engine/validate-execution.ts`
- Registered usage: `bun run ai:validate`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:validate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/prompt-qa.ts:7, docs/scripts/SCRIPT_REGISTRY.md:12, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:64, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:152, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:162, specs/runtime/infra-020-ai-execution-orchestration-engine/PR_SUMMARY.md:120
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:validate:prompts

- Group: AI
- Command: `bun scripts/prompt-qa.ts`
- Power: medium
- Purpose: Validates AI agent and prompt file structural integrity
- Source: `scripts/prompt-qa.ts`
- Registered usage: `bun run ai:validate:prompts`
- Usage:
  - Primary purpose: Validates AI agent and prompt file structural integrity
  - Flags: none baked into this runner. You can append more args with `bun run ai:validate:prompts -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/prompt-qa.ts:7, docs/scripts/SCRIPT_REGISTRY.md:12
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ai:context:generate

- Group: AI
- Command: `bun scripts/generate-ai-context.ts`
- Power: critical
- Purpose: Generate AI context artifacts (architecture brain, module map, dependency graph). Supports incremental (default), forced, and validate-after-generation modes.
- Source: `scripts/generate-ai-context.ts`
- Registered usage: `bun run ai:context:generate`
- Usage:
  - Primary purpose: Generate AI context artifacts (architecture brain, module map, dependency graph). Supports incremental (default), forced, and validate-after-generation modes.
  - Flags: none baked into this runner. You can append more args with `bun run ai:context:generate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ai-context-validation.yml:53, .github/workflows/ai-context-validation.yml:83
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:20, reports/SCRIPT_REFACTOR_REPORT.md:24, reports/SCRIPT_REFACTOR_REPORT.md:28, reports/SCRIPT_REFACTOR_REPORT.md:33, reports/SCRIPT_REFACTOR_REPORT.md:37, reports/SCRIPT_REFACTOR_REPORT.md:43, reports/SCRIPT_REFACTOR_REPORT.md:47, reports/SCRIPT_REFACTOR_REPORT.md:57, reports/SCRIPT_REFACTOR_REPORT.md:61, reports/SCRIPT_REFACTOR_REPORT.md:66, reports/SCRIPT_REFACTOR_REPORT.md:325, reports/SCRIPT_REFACTOR_REPORT.md:345, +105 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ai-context-validation.yml.

### ai:context:refresh

- Group: AI
- Command: `bun scripts/generate-ai-context.ts --force`
- Power: critical
- Purpose: Generate AI context artifacts (architecture brain, module map, dependency graph). Supports incremental (default), forced, and validate-after-generation modes.
- Source: `scripts/generate-ai-context.ts`
- Registered usage: `bun run ai:context:generate`
- Usage:
  - Primary purpose: Generate AI context artifacts (architecture brain, module map, dependency graph). Supports incremental (default), forced, and validate-after-generation modes.
  - Flag `--force`: Bypass freshness checks and force regeneration.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:156, .github/workflows/ai-context-validation.yml:63
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:51, reports/SCRIPT_REFACTOR_REPORT.md:62, reports/SCRIPT_REFACTOR_REPORT.md:167, reports/SCRIPT_REFACTOR_REPORT.md:172, reports/SCRIPT_REFACTOR_REPORT.md:177, reports/SCRIPT_REFACTOR_REPORT.md:182, reports/SCRIPT_REFACTOR_REPORT.md:187, reports/SCRIPT_REFACTOR_REPORT.md:316, reports/SCRIPT_REFACTOR_REPORT.md:346, reports/SCRIPT_REFACTOR_REPORT.md:394, reports/SCRIPT_REFACTOR_REPORT.md:399, reports/SCRIPT_REFACTOR_REPORT.md:403, +53 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml, .github/workflows/ai-context-validation.yml.

### ai:context:validate

- Group: AI
- Command: `bun run validate:ai-context-fresh && bun run validate:ai-context-schemas`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ai:context:validate -- <args>` only if the underlying tool supports them.
- Depends on: `validate:ai-context-fresh`, `validate:ai-context-schemas`
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ai-context-validation.yml:73
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:200, reports/SCRIPT_REFACTOR_REPORT.md:205, reports/SCRIPT_REFACTOR_REPORT.md:209, reports/SCRIPT_REFACTOR_REPORT.md:214, reports/SCRIPT_REFACTOR_REPORT.md:219, reports/SCRIPT_REFACTOR_REPORT.md:227, reports/SCRIPT_REFACTOR_REPORT.md:326, reports/SCRIPT_REFACTOR_REPORT.md:347, reports/SCRIPT_REFACTOR_REPORT.md:558, reports/SCRIPT_REFACTOR_REPORT.md:746, reports/SCRIPT_REFACTOR_REPORT.md:784, .github/workflows/ai-context-validation.yml:73, +18 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ai-context-validation.yml.

### ai:guard

- Group: AI
- Command: `bun run scripts/ai-guard.ts`
- Power: critical
- Purpose: Enforces architecture rules (import boundaries, contract compliance) before AI-generated commits and in CI.
- Source: `scripts/ai-guard.ts`
- Registered usage: `bun run ai:guard`
- Usage:
  - Primary purpose: Enforces architecture rules (import boundaries, contract compliance) before AI-generated commits and in CI.
  - Flags: none baked into this runner. You can append more args with `bun run ai:guard -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:109, reports/SCRIPT_REFACTOR_REPORT.md:114, reports/SCRIPT_REFACTOR_REPORT.md:120, reports/SCRIPT_REFACTOR_REPORT.md:124, reports/SCRIPT_REFACTOR_REPORT.md:128, reports/SCRIPT_REFACTOR_REPORT.md:132, reports/SCRIPT_REFACTOR_REPORT.md:138, reports/SCRIPT_REFACTOR_REPORT.md:142, reports/SCRIPT_REFACTOR_REPORT.md:147, reports/SCRIPT_REFACTOR_REPORT.md:151, reports/SCRIPT_REFACTOR_REPORT.md:155, reports/SCRIPT_REFACTOR_REPORT.md:159, +77 more
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### repo:doctor

- Group: Repository
- Command: `bun scripts/dev/repo-doctor.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/dev/repo-doctor.ts`
- Registered usage: `bun run repo:doctor`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run repo:doctor -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:65
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### repo:fix

- Group: Repository
- Command: `bun scripts/dev/repo-fix.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/dev/repo-fix.ts`
- Registered usage: `bun run repo:fix`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run repo:fix -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:66
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### repo:onboard

- Group: Repository
- Command: `bun scripts/dev/repo-onboard.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/dev/repo-onboard.ts`
- Registered usage: `bun run repo:onboard`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run repo:onboard -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:67
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### repo:status

- Group: Repository
- Command: `bun scripts/dev/repo-status.ts`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: `scripts/dev/repo-status.ts`
- Registered usage: `bun run repo:status`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run repo:status -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:68
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### db:console

- Group: Database
- Command: `bun run scripts/db/console.ts`
- Power: medium
- Purpose: Launch an interactive psql session connected to DATABASE_URL.
- Source: `scripts/db/console.ts`
- Registered usage: `bun run db:console`
- Usage:
  - Primary purpose: Launch an interactive psql session connected to DATABASE_URL.
  - Flags: none baked into this runner. You can append more args with `bun run db:console -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/db-console.md:6, docs/scripts/db-console.md:45, docs/scripts/SCRIPT_REGISTRY.md:39, specs/templates/guides/testing-guide-template.md:180, scripts/db/console.ts:8, scripts/db/console.ts:22, specs/runtime/018-workspace-settings/guides/TESTING_GUIDE.md:294, specs/runtime/019-translation-system/guides/TESTING_GUIDE.md:308, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:70, specs/runtime/fix-01-runtime-script-recovery-and-validation/tasks.md:77, specs/runtime/fix-01-runtime-script-recovery-and-validation/guides/TESTING_GUIDE.md:131, specs/runtime/031-category-values/guides/TESTING_GUIDE.md:282, +2 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### db:migrate

- Group: Database
- Command: `bun run scripts/db/migrate.ts`
- Power: medium
- Purpose: Validate migration inputs and delegate master migration execution guidance.
- Source: `scripts/db/migrate.ts`
- Registered usage: `bun run db:migrate`
- Usage:
  - Primary purpose: Validate migration inputs and delegate master migration execution guidance.
  - Flags: none baked into this runner. You can append more args with `bun run db:migrate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:16, reports/SCRIPT_REFACTOR_REPORT.md:192, reports/SCRIPT_REFACTOR_REPORT.md:365, reports/SCRIPT_REFACTOR_REPORT.md:606, reports/SCRIPT_REFACTOR_REPORT.md:615, reports/SCRIPT_REFACTOR_REPORT.md:742, docs/database/LICENSES_MIGRATION_GUIDE.md:221, docs/database/LICENSES_MIGRATION_GUIDE.md:225, docs/database/LICENSES_MIGRATION_GUIDE.md:232, docs/scripts/db-migrate.md:6, docs/scripts/db-migrate.md:12, docs/scripts/db-migrate.md:51, +74 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### db:status:pool

- Group: Database
- Command: `bun run scripts/db/pool-status.ts`
- Power: medium
- Purpose: Check PostgreSQL connection pool health and report status.
- Source: `scripts/db/pool-status.ts`
- Registered usage: `bun run db:status:pool`
- Usage:
  - Primary purpose: Check PostgreSQL connection pool health and report status.
  - Flags: none baked into this runner. You can append more args with `bun run db:status:pool -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:11, reports/SCRIPT_REFACTOR_REPORT.md:305, reports/SCRIPT_REFACTOR_REPORT.md:314, reports/SCRIPT_REFACTOR_REPORT.md:324, reports/SCRIPT_REFACTOR_REPORT.md:330, reports/SCRIPT_REFACTOR_REPORT.md:342, reports/SCRIPT_REFACTOR_REPORT.md:487, reports/SCRIPT_REFACTOR_REPORT.md:493, reports/SCRIPT_REFACTOR_REPORT.md:592, reports/SCRIPT_REFACTOR_REPORT.md:664, reports/SCRIPT_REFACTOR_REPORT.md:728, docs/scripts/db-pool-status.md:6, +21 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### db:validate:licenses

- Group: Database
- Command: `bun run scripts/db/validate-licenses.ts`
- Power: medium
- Purpose: Validate license distribution in master_db and report counts by status.
- Source: `scripts/db/validate-licenses.ts`
- Registered usage: `bun run db:validate:licenses`
- Usage:
  - Primary purpose: Validate license distribution in master_db and report counts by status.
  - Flags: none baked into this runner. You can append more args with `bun run db:validate:licenses -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:12, reports/SCRIPT_REFACTOR_REPORT.md:306, reports/SCRIPT_REFACTOR_REPORT.md:315, reports/SCRIPT_REFACTOR_REPORT.md:331, reports/SCRIPT_REFACTOR_REPORT.md:343, reports/SCRIPT_REFACTOR_REPORT.md:593, reports/SCRIPT_REFACTOR_REPORT.md:694, docs/scripts/db-validate-licenses.md:6, docs/scripts/db-validate-licenses.md:42, specs/phases/0X_FIXES/STAGE_FIX_01_RUNTIME_SCRIPT_RECOVERY_AND_VALIDATION.md:66, docs/scripts/SCRIPT_REGISTRY.md:42, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:73, +7 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:cache:clean

- Group: Infrastructure
- Command: `bun run scripts/maintenance/cache-clean.ts`
- Power: medium
- Purpose: Remove build caches and temporary output directories to free disk space
- Source: `scripts/maintenance/cache-clean.ts`
- Registered usage: `bun run infra:cache:clean`
- Usage:
  - Primary purpose: Remove build caches and temporary output directories to free disk space
  - Flags: none baked into this runner. You can append more args with `bun run infra:cache:clean -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:293, reports/SCRIPT_REFACTOR_REPORT.md:297, reports/SCRIPT_REFACTOR_REPORT.md:310, reports/SCRIPT_REFACTOR_REPORT.md:320, reports/SCRIPT_REFACTOR_REPORT.md:359, reports/SCRIPT_REFACTOR_REPORT.md:368, reports/SCRIPT_REFACTOR_REPORT.md:378, reports/SCRIPT_REFACTOR_REPORT.md:382, reports/SCRIPT_REFACTOR_REPORT.md:489, reports/SCRIPT_REFACTOR_REPORT.md:668, docs/scripts/maintenance-cache-clean.md:6, docs/scripts/maintenance-cache-clean.md:49, +11 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security

- Group: Infrastructure
- Command: `bun scripts/security/scan.ts`
- Power: medium
- Purpose: Run a full Trivy filesystem scan and print visible findings without blocking on non-clean results.
- Source: `scripts/security/scan.ts`
- Registered usage: `bun run infra:security`
- Usage:
  - Primary purpose: Run a full Trivy filesystem scan and print visible findings without blocking on non-clean results.
  - Flags: none baked into this runner. You can append more args with `bun run infra:security -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: .github/workflows/ci.yml:293, .husky/pre-commit:116, .husky/pre-commit:122, docs/scripts/security-scan-config.md:6, docs/scripts/security-scan-ci.md:6, docs/scripts/security-scan-deps.md:6, docs/scripts/security-scan.md:6, docs/scripts/SCRIPT_REGISTRY.md:66, docs/scripts/SCRIPT_REGISTRY.md:67, docs/scripts/SCRIPT_REGISTRY.md:68, docs/scripts/SCRIPT_REGISTRY.md:69, docs/scripts/SCRIPT_REGISTRY.md:70, +47 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security:deps

- Group: Infrastructure
- Command: `bun scripts/security/scan-deps.ts`
- Power: medium
- Purpose: Run a dependency-only Trivy scan, warning on MEDIUM findings and blocking on HIGH/CRITICAL vulnerabilities.
- Source: `scripts/security/scan-deps.ts`
- Registered usage: `bun run infra:security:deps`
- Usage:
  - Primary purpose: Run a dependency-only Trivy scan, warning on MEDIUM findings and blocking on HIGH/CRITICAL vulnerabilities.
  - Flags: none baked into this runner. You can append more args with `bun run infra:security:deps -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: .husky/pre-commit:116, docs/scripts/security-scan-deps.md:6, docs/scripts/SCRIPT_REGISTRY.md:69, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:147, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:239, scripts/security/scan-deps.ts:6, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/reports/IMPLEMENT_REPORT.md:220, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md:30, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md:85, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:170, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:182, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:189, +3 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security:secrets

- Group: Infrastructure
- Command: `bun scripts/security/scan-secrets.ts`
- Power: medium
- Purpose: Run a Trivy secret scan across the repo or staged files only and block on any detected secret.
- Source: `scripts/security/scan-secrets.ts`
- Registered usage: `bun run infra:security:secrets [--staged]`
- Usage:
  - Primary purpose: Run a Trivy secret scan across the repo or staged files only and block on any detected secret.
  - Flags: none baked into this runner. You can append more args with `bun run infra:security:secrets -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: .husky/pre-commit:122, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:148, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:240, docs/scripts/SCRIPT_REGISTRY.md:70, docs/scripts/security-scan-secrets.md:6, docs/scripts/security-scan-secrets.md:7, scripts/security/scan-secrets.ts:6, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/reports/IMPLEMENT_REPORT.md:221, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md:86, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:170, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:196, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:203, +2 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security:config

- Group: Infrastructure
- Command: `bun scripts/security/scan-config.ts`
- Power: medium
- Purpose: Run a Trivy misconfiguration scan and print visible findings without blocking on non-clean results.
- Source: `scripts/security/scan-config.ts`
- Registered usage: `bun run infra:security:config`
- Usage:
  - Primary purpose: Run a Trivy misconfiguration scan and print visible findings without blocking on non-clean results.
  - Flags: none baked into this runner. You can append more args with `bun run infra:security:config -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/security-scan-config.md:6, docs/scripts/SCRIPT_REGISTRY.md:68, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:241, scripts/security/scan-config.ts:6, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md:87, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:264, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/tasks.md:69
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### infra:security:ci

- Group: Infrastructure
- Command: `bun scripts/security/scan-ci.ts`
- Power: critical
- Purpose: Run the CI-equivalent Trivy scan, write a sanitized report, and block on CI-grade findings.
- Source: `scripts/security/scan-ci.ts`
- Registered usage: `bun run infra:security:ci`
- Usage:
  - Primary purpose: Run the CI-equivalent Trivy scan, write a sanitized report, and block on CI-grade findings.
  - Flags: none baked into this runner. You can append more args with `bun run infra:security:ci -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/ci.yml:293
  - Other files: .github/workflows/ci.yml:293, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:164, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:242, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md:88, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md:247, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md:273, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:145, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:247, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:29, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:293, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:318, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:320, +7 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml.

### governance:gate

- Group: Governance
- Command: `bun scripts/governance/gate.ts`
- Power: critical
- Purpose: Unified governance gate — composes all guards in sequence (report-all mode)
- Source: `scripts/governance/gate.ts`
- Registered usage: `bun run governance:gate`
- Usage:
  - Primary purpose: Unified governance gate — composes all guards in sequence (report-all mode)
  - Flags: none baked into this runner. You can append more args with `bun run governance:gate -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: .github/workflows/architecture-governance.yml:172, docs/scripts/SCRIPT_REGISTRY.md:57, docs/scripts/SCRIPT_REGISTRY.md:58, scripts/governance/gate-ci.ts:9, scripts/governance/gate-ci.ts:22, scripts/governance/gate.ts:9, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:191, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:216, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:234, .agents/agents/orchestrator.agent.md:2518, .agents/agents/orchestrator.agent.md:3066, specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md:435, +47 more
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### governance:gate:ci

- Group: Governance
- Command: `bun scripts/governance/gate-ci.ts`
- Power: critical
- Purpose: CI variant of the governance gate — runs gate.ts with GitHub Actions annotations
- Source: `scripts/governance/gate-ci.ts`
- Registered usage: `bun run governance:gate:ci`
- Usage:
  - Primary purpose: CI variant of the governance gate — runs gate.ts with GitHub Actions annotations
  - Flags: none baked into this runner. You can append more args with `bun run governance:gate:ci -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/architecture-governance.yml:172
  - Other files: .github/workflows/architecture-governance.yml:172, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:234, docs/scripts/SCRIPT_REGISTRY.md:58, scripts/governance/gate-ci.ts:9, specs/runtime/infra-027-unified-governance-gate-system/plan.md:196, specs/runtime/infra-027-unified-governance-gate-system/plan.md:296, specs/runtime/infra-027-unified-governance-gate-system/plan.md:446, specs/runtime/infra-027-unified-governance-gate-system/reports/PLAN_REPORT.md:44, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:26, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:107, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:211, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:247, +3 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/architecture-governance.yml.

### governance:gate:changed

- Group: Governance
- Command: `bun run arch:context:changed && bun run arch:guard:changed`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run governance:gate:changed -- <args>` only if the underlying tool supports them.
- Depends on: `arch:context:changed`, `arch:guard:changed`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:216, .agents/agents/orchestrator.agent.md:2518, specs/runtime/infra-027-unified-governance-gate-system/reports/PLAN_REPORT.md:43, specs/runtime/infra-027-unified-governance-gate-system/PR_SUMMARY.md:211, specs/runtime/infra-027-unified-governance-gate-system/spec.md:140, specs/runtime/infra-027-unified-governance-gate-system/spec.md:160, specs/runtime/infra-027-unified-governance-gate-system/spec.md:211, specs/runtime/infra-027-unified-governance-gate-system/plan.md:165, specs/runtime/infra-027-unified-governance-gate-system/plan.md:167, specs/runtime/infra-027-unified-governance-gate-system/plan.md:367, specs/runtime/infra-027-unified-governance-gate-system/plan.md:407, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:27, +2 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### governance:report

- Group: Governance
- Command: `bun scripts/governance/report.ts`
- Power: medium
- Purpose: Generates a consolidated governance health report at docs/governance/governance-report.md
- Source: `scripts/governance/report.ts`
- Registered usage: `bun run governance:report`
- Usage:
  - Primary purpose: Generates a consolidated governance health report at docs/governance/governance-report.md
  - Flags: none baked into this runner. You can append more args with `bun run governance:report -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:59, scripts/governance/report.ts:9, specs/runtime/infra-027-unified-governance-gate-system/PR_SUMMARY.md:33, specs/runtime/infra-027-unified-governance-gate-system/spec.md:215, specs/runtime/infra-027-unified-governance-gate-system/plan.md:309, specs/runtime/infra-027-unified-governance-gate-system/plan.md:344, specs/runtime/infra-027-unified-governance-gate-system/plan.md:396, specs/runtime/infra-027-unified-governance-gate-system/plan.md:453, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:28, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:145, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:221, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:248
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:smoke:staging

- Group: CI
- Command: `bash scripts/ci/run-staging-smoke-tests.sh`
- Power: medium
- Purpose: Run the registered repository task for this area.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run ci:smoke:staging -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:357, reports/SCRIPT_REFACTOR_REPORT.md:475, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:81, specs/runtime/ui-09-security-and-token-handling/PR_SUMMARY.md:291
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:local

- Group: CI
- Command: `act --pull=false`
- Power: medium
- Purpose: Run or inspect GitHub Actions workflows locally with act.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run or inspect GitHub Actions workflows locally with act.
  - Flag `--pull false`: Control whether `act` pulls container images. Value: false.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: .actrc:61, .actrc:76, .actrc:77, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:98, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:234, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:250, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:264, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:271, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:306, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:311, docs/ci/gitnexus-validation.md:13, docs/ci/local-ci.md:134, +109 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:local:full

- Group: CI
- Command: `act --pull --reuse=false`
- Power: medium
- Purpose: Run or inspect GitHub Actions workflows locally with act.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run or inspect GitHub Actions workflows locally with act.
  - Flag `--pull`: Control whether `act` pulls container images.
  - Flag `--reuse false`: Control whether `act` reuses containers. Value: false.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: .actrc:61, .actrc:77, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:311, scripts/ci/setup-act-local.sh:127, docs/ci/local-ci.md:143, docs/ci/local-ci.md:281, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:544, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:615, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:918, specs/runtime/infra-023-local-ci-simulation-with-act/tasks.md:97, specs/runtime/infra-023-local-ci-simulation-with-act/tasks.md:166, specs/runtime/infra-023-local-ci-simulation-with-act/tasks.md:282, +3 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:local:workflow

- Group: CI
- Command: `act -W .github/workflows`
- Power: medium
- Purpose: Run or inspect GitHub Actions workflows locally with act.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run or inspect GitHub Actions workflows locally with act.
  - Flag `-W .github/workflows`: Point `act` at a workflow directory. Value: .github/workflows.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/ci/local-ci.md:151, docs/ci/local-ci.md:152, docs/ci/local-ci.md:153, docs/ci/local-ci.md:154, docs/ci/local-ci.md:155, docs/ci/local-ci.md:207, docs/ci/local-ci.md:208, specs/runtime/infra-023-local-ci-simulation-with-act/PR_SUMMARY.md:66, specs/runtime/infra-023-local-ci-simulation-with-act/tasks.md:112, specs/runtime/infra-023-local-ci-simulation-with-act/tasks.md:114, specs/runtime/infra-023-local-ci-simulation-with-act/tasks.md:116, specs/runtime/infra-023-local-ci-simulation-with-act/tasks.md:166, +6 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:local:job

- Group: CI
- Command: `act -j`
- Power: medium
- Purpose: Run or inspect GitHub Actions workflows locally with act.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run or inspect GitHub Actions workflows locally with act.
  - Flag `-j`: Run a single `act` job.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/ci/local-ci.md:202, docs/ci/local-ci.md:203, docs/ci/local-ci.md:204, docs/ci/local-ci.md:267, docs/ci/local-ci.md:270
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:local:list

- Group: CI
- Command: `act -l`
- Power: medium
- Purpose: Run or inspect GitHub Actions workflows locally with act.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run or inspect GitHub Actions workflows locally with act.
  - Flag `-l`: List `act` jobs without running them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/ci/setup-act-local.sh:128, docs/ci/local-ci.md:161, specs/runtime/infra-023-local-ci-simulation-with-act/reports/IMPLEMENT_REPORT.md:37, specs/runtime/infra-023-local-ci-simulation-with-act/reports/IMPLEMENT_REPORT.md:78, specs/runtime/infra-023-local-ci-simulation-with-act/reports/CLOSURE_REPORT.md:140, specs/runtime/infra-023-local-ci-simulation-with-act/PR_SUMMARY.md:52, specs/runtime/infra-023-local-ci-simulation-with-act/PR_SUMMARY.md:175, specs/runtime/infra-023-local-ci-simulation-with-act/spec.md:142, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:542, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:621, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:873, specs/runtime/infra-023-local-ci-simulation-with-act/tasks.md:112, +5 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:local:dry

- Group: CI
- Command: `actionlint .github/workflows/*.yml`
- Power: medium
- Purpose: Validate GitHub Actions workflow files.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Validate GitHub Actions workflow files.
  - Flags: none baked into this runner. You can append more args with `bun run ci:local:dry -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/ci/local-ci.md:231
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:run-local

- Group: CI
- Command: `bun scripts/run-local-ci.ts`
- Power: medium
- Purpose: Local CI governance orchestrator — runs the 7-step pre-closure validation sequence including all governance checks and the full act CI simulation. Step 0 is a Docker fail-fast check; Steps 1–7 are governance checks that run to completion regardless of individual failures (fail-forward).
- Source: `scripts/run-local-ci.ts`
- Registered usage: `bun run ci:run-local`
- Usage:
  - Primary purpose: Local CI governance orchestrator — runs the 7-step pre-closure validation sequence including all governance checks and the full act CI simulation. Step 0 is a Docker fail-fast check; Steps 1–7 are governance checks that run to completion regardless of individual failures (fail-forward).
  - Flags: none baked into this runner. You can append more args with `bun run ci:run-local -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/audit-reports/AI_SYSTEM_AUDIT_REPORT.md:886, docs/scripts/ci-run-local.md:8, docs/scripts/ci-run-local.md:34, .agents/agents/orchestrator.agent.md:3018, .agents/agents/orchestrator.agent.md:3021, .agents/agents/orchestrator.agent.md:3028, .agents/agents/orchestrator.agent.md:3035, scripts/run-local-ci.ts:9, docs/scripts/SCRIPT_REGISTRY.md:33, docs/ci/local-ci.md:172, docs/ci/local-ci.md:348, docs/ci/local-ci.md:367, +7 more
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### ci:test

- Group: CI
- Command: `vitest run --reporter=verbose`
- Power: medium
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--reporter verbose`: Select reporter output format. Value: verbose.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/ci/gitnexus-validation.md:13, specs/runtime/infra-17-repository-size-and-performance-optimization/guides/TESTING_GUIDE.md:261, specs/runtime/infra-17-repository-size-and-performance-optimization/guides/TESTING_GUIDE.md:502, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:86
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test:tenant

- Group: Testing
- Command: `vitest run --dir tests/tenant || true`
- Power: medium
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--dir tests/tenant`: Target a specific directory. Value: tests/tenant.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: .agents/agents/devops-engineer.agent.md:190
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### test:migrations

- Group: Testing
- Command: `vitest run --dir tests/migrations || true`
- Power: medium
- Purpose: Run Vitest for the configured scope.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Run Vitest for the configured scope.
  - Flag `--dir tests/migrations`: Target a specific directory. Value: tests/migrations.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: .agents/agents/devops-engineer.agent.md:192
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:stale-test

- Group: Development
- Command: `echo 'dev:stale-test placeholder'`
- Power: low
- Purpose: Placeholder alias retained for compatibility or future implementation.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Placeholder alias retained for compatibility or future implementation.
  - Flags: none baked into this runner. You can append more args with `bun run dev:stale-test -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/validate/**tests**/script-infrastructure.test.ts:107
- Removal assessment: Low-risk cleanup candidate, but verify no undocumented manual workflow still calls it.

### validate:runtime:scripts

- Group: Validation
- Command: `bun run scripts/validate/runtime-scripts.ts`
- Power: medium
- Purpose: CI guard: hard-blocks (exit 1) when any bun run <script> reference in the project (outside specs, .gitnexus, and reports) is absent from root package.json. References inside those dirs generate warnings but exit 0. Exits 0 when no critical issues found.
- Source: `scripts/validate/runtime-scripts.ts`
- Registered usage: `bun run validate:scripts:runtime`
- Usage:
  - Primary purpose: CI guard: hard-blocks (exit 1) when any bun run <script> reference in the project (outside specs, .gitnexus, and reports) is absent from root package.json. References inside those dirs generate warnings but exit 0. Exits 0 when no critical issues found.
  - Flags: none baked into this runner. You can append more args with `bun run validate:runtime:scripts -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/policy-engine/adapters/script-governance.adapter.ts:4, scripts/policy-engine/adapters/script-governance.adapter.ts:53
- Removal assessment: Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it.

### dev:demo-logger-features

- Group: Development
- Command: `bun run dev:demo:logger`
- Power: low
- Purpose: Demonstrates all available logger customization options and features
- Source: `scripts/dev/demo-logger-features.ts`
- Registered usage: `bun run dev:demo-logger-features`
- Usage:
  - Primary purpose: Demonstrates all available logger customization options and features
  - Flags: none baked into this runner. You can append more args with `bun run dev:demo-logger-features -- <args>` only if the underlying tool supports them.
- Depends on: `dev:demo:logger`
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:48, scripts/dev/demo-logger-features.ts:8
- Removal assessment: Usually removable if the team no longer uses the demo or debug workflow.

### repo:references

- Group: Repository
- Command: `echo 'references placeholder'`
- Power: low
- Purpose: Placeholder alias retained for compatibility or future implementation.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Placeholder alias retained for compatibility or future implementation.
  - Flags: none baked into this runner. You can append more args with `bun run repo:references -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/validate/script-usage.ts:148, scripts/dev/refactor-scripts.ts:252
- Removal assessment: Low-risk cleanup candidate, but verify no undocumented manual workflow still calls it.

### repo:script

- Group: Repository
- Command: `echo 'script placeholder'`
- Power: low
- Purpose: Placeholder alias retained for compatibility or future implementation.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Placeholder alias retained for compatibility or future implementation.
  - Flags: none baked into this runner. You can append more args with `bun run repo:script -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: scripts/dev/demo-logger-features.ts:63, scripts/dev/demo-logger-features.ts:64
- Removal assessment: Low-risk cleanup candidate, but verify no undocumented manual workflow still calls it.

### policy:check

- Group: Policy
- Command: `bun scripts/policy-engine/cli.ts`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: `scripts/policy-engine/cli.ts`
- Registered usage: `bun run policy:check`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flags: none baked into this runner. You can append more args with `bun run policy:check -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: .github/workflows/policy-check.yml:31
  - Other files: .github/workflows/policy-check.yml:31, .husky/pre-commit:129, .husky/pre-commit:131, scripts/policy-engine/cli.ts:4, scripts/policy-engine/cli.ts:8, scripts/policy-engine/cli.ts:9, scripts/policy-engine/cli.ts:10, scripts/policy-engine/cli.ts:11, scripts/policy-engine/cli.ts:12, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_29_POLICY_ENGINE_AND_GOVERNANCE_RULES_LAYER.md:113, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_29_POLICY_ENGINE_AND_GOVERNANCE_RULES_LAYER.md:168, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_29_POLICY_ENGINE_AND_GOVERNANCE_RULES_LAYER.md:312, +65 more
- Removal assessment: Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/policy-check.yml.

### policy:check:full

- Group: Policy
- Command: `bun scripts/policy-engine/cli.ts --full`
- Power: critical
- Purpose: Run the registered repository task for this area.
- Source: `scripts/policy-engine/cli.ts`
- Registered usage: `bun run policy:check:full`
- Usage:
  - Primary purpose: Run the registered repository task for this area.
  - Flag `--full`: Runner-level option passed directly to the underlying tool.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: No direct non-workflow invocations found
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.

### prepare

- Group: Lifecycle
- Command: `husky`
- Power: critical
- Purpose: Install Husky git hooks during the package manager prepare lifecycle.
- Source: Wrapper only; no single `scripts/*.ts` source file.
- Usage:
  - Primary purpose: Install Husky git hooks during the package manager prepare lifecycle.
  - Flags: none baked into this runner. You can append more args with `bun run prepare -- <args>` only if the underlying tool supports them.
- Depends on: None
- Used by other root scripts: None found
- Used in:
  - Workflows: None found
  - Other files: specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_GOVERNANCE.md:29, specs/runtime/infra-governance/reports/IMPLEMENT_REPORT.md:281, specs/runtime/infra-governance/reports/TASKS_REPORT.md:29, specs/runtime/infra-governance/plan.md:151, specs/runtime/infra-governance/plan.md:234, specs/runtime/infra-governance/plan.md:613, specs/runtime/infra-governance/plan.md:620, specs/runtime/infra-governance/tasks.md:38, specs/runtime/infra-governance/tasks.md:92, specs/runtime/infra-governance/tasks.md:183, specs/runtime/infra-18-developer-experience-automation/plan.md:358, specs/runtime/infra-18-developer-experience-automation/plan.md:421, +1 more
- Removal assessment: Do not remove. Bun invokes this lifecycle hook on install to set up Husky.
