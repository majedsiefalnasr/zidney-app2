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
  - Other files: .agents/agents/copilot-instructions.md:54, .agents/agents/devops-engineer.agent.md:186, .agents/agents/orchestrator.agent.md:2716, .agents/skills/typescript-governance/SKILL.md:243, .gitnexus/wiki/root.md:105, AGENTS.md:82, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:189, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:230, docs/03_ENGINEERING_WORKFLOW/01_CONTRIBUTION_GUIDE.md:55, docs/audit-reports/AI_SYSTEM_AUDIT_REPORT.md:842, docs/operations/LICENSES_OPERATIONAL_RUNBOOK.md:38, docs/type-safety/AI_GOVERNANCE_HANDBOOK.md:268, +408 more
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
  - Other files: docs/reports/REPOSITORY_HYGIENE_REPORT.md:197, docs/type-safety/CI_ENFORCEMENT.md:67, package.json:11, package.json:9, package.md:104, package.md:66, reports/SCRIPT_REFACTOR_REPORT.md:116, reports/SCRIPT_REFACTOR_REPORT.md:134, reports/SCRIPT_REFACTOR_REPORT.md:257, reports/SCRIPT_REFACTOR_REPORT.md:261, reports/SCRIPT_REFACTOR_REPORT.md:265, reports/SCRIPT_REFACTOR_REPORT.md:269, +72 more
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
  - Other files: docs/reports/REPOSITORY_HYGIENE_REPORT.md:198, docs/type-safety/CI_ENFORCEMENT.md:70, package.json:9, package.md:66, specs/runtime/025-hierarchy-tree/audits/VALIDATION_REPORT.md:78, specs/runtime/028-subjects/audits/VALIDATION_REPORT.md:79, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:685, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:6, specs/runtime/fix-01-runtime-script-recovery-and-validation/research.md:156, specs/runtime/infra-001-typescript-stabilization/audits/VALIDATION_REPORT.md:15, specs/runtime/infra-001-typescript-stabilization/audits/VALIDATION_REPORT.md:152, specs/runtime/infra-001-typescript-stabilization/audits/VALIDATION_REPORT.md:39, +14 more
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
  - Other files: .agents/agents/copilot-instructions.md:55, .agents/agents/devops-engineer.agent.md:184, .agents/skills/package-manager-governance/SKILL.md:172, .agents/skills/terminal-safety/SKILL.md:115, .gitnexus/wiki/root.md:106, AGENTS.md:82, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:188, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:229, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:32, docs/03_ENGINEERING_WORKFLOW/01_CONTRIBUTION_GUIDE.md:54, docs/operations/LICENSES_OPERATIONAL_RUNBOOK.md:39, docs/reports/REPOSITORY_HYGIENE_REPORT.md:199, +381 more
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
  - Other files: docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:138, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:88, docs/type-safety/CI_ENFORCEMENT.md:152, docs/type-safety/CI_ENFORCEMENT.md:160, docs/type-safety/CI_ENFORCEMENT.md:185, docs/type-safety/TYPE_SAFETY_HANDBOOK.md:422, README.md:414, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/VALIDATION_REPORT.md:128, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/IMPLEMENT_REPORT.md:145, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:9, specs/runtime/infra-004-biome/PR_SUMMARY.md:31, specs/runtime/infra-005-lint-governance/guides/TESTING_GUIDE.md:329, +21 more
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
  - Other files: package.md:168, README.md:426, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_03_ALIGNMENT.md:392, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:10, specs/runtime/infra-003-alignment/guides/TESTING_GUIDE.md:262, specs/runtime/infra-003-alignment/PR_SUMMARY.md:207, specs/runtime/infra-003-alignment/spec.md:106, specs/runtime/infra-003-alignment/spec.md:227, specs/runtime/infra-003-alignment/spec.md:323, specs/runtime/infra-003-alignment/spec.md:95, specs/runtime/infra-004-biome/PR_SUMMARY.md:208, specs/runtime/infra-004-biome/PR_SUMMARY.md:31, +3 more
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
  - Other files: package.json:14, package.md:161, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:416, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:11, specs/runtime/fix-01-runtime-script-recovery-and-validation/research.md:122
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
  - Other files: package.json:14, package.md:161, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:416
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
  - Other files: package.md:225, README.md:420, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_03_ALIGNMENT.md:393, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:13, specs/runtime/infra-003-alignment/guides/TESTING_GUIDE.md:270, specs/runtime/infra-003-alignment/plan.md:512, specs/runtime/infra-003-alignment/spec.md:101, specs/runtime/infra-003-alignment/spec.md:229, specs/runtime/infra-003-alignment/spec.md:323, specs/runtime/infra-003-alignment/spec.md:376, specs/runtime/infra-003-alignment/tasks.md:142, specs/runtime/infra-003-alignment/tasks.md:36, +17 more
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
  - Other files: package.json:17, package.md:218, package.md:244, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:428, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:14
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
  - Other files: package.json:17, package.md:218, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:428
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
  - Other files: specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION.md:329, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION.md:250, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:17, specs/runtime/infra-010-hybrid-lint-format-pipeline/guides/TESTING_GUIDE.md:232, specs/runtime/infra-010-hybrid-lint-format-pipeline/guides/TESTING_GUIDE.md:78, specs/runtime/infra-010-hybrid-lint-format-pipeline/plan.md:503, specs/runtime/infra-010-hybrid-lint-format-pipeline/tasks.md:127, specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/audits/VALIDATION_REPORT.md:30, specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/plan.md:193, specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/quickstart.md:118, specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/spec.md:145, specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/spec.md:52, +10 more
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
  - Other files: docs/type-safety/AI_GOVERNANCE_HANDBOOK.md:274, docs/type-safety/AI_GOVERNANCE_HANDBOOK.md:325, docs/type-safety/README.md:243, docs/type-safety/RUNBOOK_TYPE_NEW_API_ENDPOINT.md:203, docs/type-safety/RUNBOOK_TYPE_NEW_API_ENDPOINT.md:382, docs/type-safety/TYPE_SAFETY_HANDBOOK.md:416, docs/type-safety/TYPE_SAFETY_HANDBOOK.md:428, reports/SCRIPT_REFACTOR_REPORT.md:367, reports/SCRIPT_REFACTOR_REPORT.md:386, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_14_ARCHITECTURE_ALIGNMENT_MIGRATION.md:192, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:178, specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md:1054, +32 more
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
  - Other files: package.md:323, reports/SCRIPT_REFACTOR_REPORT.md:360, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:18
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:77, docs/scripts/validate-ai-context-fresh.md:44, docs/scripts/validate-ai-context-fresh.md:47, docs/scripts/validate-ai-context-fresh.md:6, package.json:91, package.md:1691, package.md:340, package.md:343, scripts/generate/**tests**/package-docs.test.ts:36, scripts/validate/**tests**/runtime-scripts.test.ts:28, scripts/validate/ai-context-fresh.ts:6, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:38, +8 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:78, docs/scripts/validate-ai-context-schemas.md:49, docs/scripts/validate-ai-context-schemas.md:6, package.json:91, package.md:1691, package.md:360, package.md:363, scripts/generate/**tests**/package-docs.test.ts:36, scripts/validate/ai-context-schemas.ts:6, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:38, specs/runtime/fix-01-runtime-script-recovery-and-validation/guides/TESTING_GUIDE.md:133, specs/runtime/fix-01-runtime-script-recovery-and-validation/guides/TESTING_GUIDE.md:189, +6 more
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
  - Other files: .agents/agents/orchestrator.agent.md:2803, .agents/agents/orchestrator.agent.md:585, docs/scripts/SCRIPT_REGISTRY.md:84, docs/scripts/validate-runtime-scripts.md:55, docs/scripts/validate-runtime-scripts.md:6, package.md:2324, package.md:380, package.md:383, reports/SCRIPT_REFACTOR_REPORT.md:104, reports/SCRIPT_REFACTOR_REPORT.md:243, reports/SCRIPT_REFACTOR_REPORT.md:247, reports/SCRIPT_REFACTOR_REPORT.md:253, +55 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:80, docs/scripts/validate-scripts-infra.md:34, docs/scripts/validate-scripts-infra.md:8, package.md:400, package.md:403, scripts/validate/detect-broken-scripts.ts:6, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:309
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
  - Other files: .agents/skills/script-system-governance/SKILL.md:154, .agents/skills/script-system-governance/SKILL.md:180, .agents/skills/script-system-governance/SKILL.md:193, .agents/skills/script-system-governance/SKILL.md:234, .agents/skills/script-system-governance/SKILL.md:266, .agents/skills/script-system-governance/SKILL.md:90, docs/scripts/SCRIPT_REGISTRY.md:82, package.md:420, package.md:423, scripts/validate/**tests**/script-usage.test.ts:45, scripts/validate/**tests**/script-usage.test.ts:68, scripts/validate/script-naming.ts:9, +20 more
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
  - Other files: .agents/agents/orchestrator.agent.md:586, .agents/skills/script-system-governance/SKILL.md:181, .agents/skills/script-system-governance/SKILL.md:206, .agents/skills/script-system-governance/SKILL.md:237, .agents/skills/script-system-governance/SKILL.md:267, docs/scripts/SCRIPT_REGISTRY.md:85, package.md:440, package.md:443, scripts/validate/script-usage.ts:9, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:244, specs/runtime/infra-025-script-system-standardization-and-governance/guides/TESTING_GUIDE.md:104, specs/runtime/infra-025-script-system-standardization-and-governance/guides/TESTING_GUIDE.md:237, +16 more
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
  - Other files: .agents/skills/script-system-governance/SKILL.md:155, .agents/skills/script-system-governance/SKILL.md:182, .agents/skills/script-system-governance/SKILL.md:219, .agents/skills/script-system-governance/SKILL.md:240, .agents/skills/script-system-governance/SKILL.md:268, docs/scripts/SCRIPT_REGISTRY.md:81, package.md:460, package.md:463, scripts/validate/script-infrastructure.ts:9, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:245, specs/runtime/infra-025-script-system-standardization-and-governance/guides/TESTING_GUIDE.md:150, specs/runtime/infra-025-script-system-standardization-and-governance/guides/TESTING_GUIDE.md:238, +14 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:83, package.md:480, package.md:483, scripts/validate/diff-script-registry.ts:6
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:86, package.md:500, package.md:503, scripts/validate/validate-scripts-ux.ts:6
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:79, package.md:520, package.md:523, scripts/validate/scan-package-scripts.ts:6
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:19, package.md:540, package.md:543, reports/SCRIPT_REFACTOR_REPORT.md:361, reports/SCRIPT_REFACTOR_REPORT.md:483, scripts/check-store-cycles.ts:8, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:19, specs/runtime/ui-06-state-management/guides/TESTING_GUIDE.md:51
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
  - Other files: AGENTS.md:69, package.md:560, package.md:563, README.md:329, README.md:488, scripts/architecture/add-module.ts:23, scripts/infra-audit.ts:2175, specs/runtime/030-categories/tasks.md:22, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:41, specs/runtime/infra-005-lint-governance/plan.md:591, specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md:387, specs/runtime/infra-010-hybrid-lint-format-pipeline/plan.md:519, +6 more
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
  - Other files: docs/architecture/visualization/README.md:47, package.md:580, package.md:583, README.md:385, scripts/ai-runtime/runtime-status.ts:241, scripts/architecture/visualize.ts:289, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION.md:268, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:135, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:42, specs/runtime/infra-005-lint-governance/spec.md:563, specs/runtime/infra-008-architecture-visualization/data-model.md:44, specs/runtime/infra-008-architecture-visualization/plan.md:527, +5 more
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
  - Other files: docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:161, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:237, docs/ai/gitnexus.md:119, docs/ai/gitnexus.md:129, docs/ai/gitnexus.md:131, docs/architecture/visualization/README.md:4, docs/architecture/visualization/README.md:46, docs/scripts/gitnexus-context.md:54, docs/scripts/gitnexus-context.md:77, docs/scripts/SCRIPT_REGISTRY.md:18, package.json:39, package.json:44, +133 more
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
  - Other files: .agents/agents/orchestrator.agent.md:2550, .agents/agents/orchestrator.agent.md:2561, AGENTS.md:178, docs/ai/gitnexus.md:120, docs/ai/gitnexus.md:13, docs/ai/gitnexus.md:133, docs/ai/gitnexus.md:49, docs/ai/gitnexus.md:50, docs/ai/gitnexus.md:51, docs/ai/gitnexus.md:52, docs/audit-reports/AI_SYSTEM_AUDIT_REPORT.md:819, docs/ci/gitnexus-validation.md:19, +59 more
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
  - Other files: .agents/agents/orchestrator.agent.md:2554, .agents/agents/orchestrator.agent.md:2561, AGENTS.md:178, docs/ai/gitnexus.md:14, docs/ai/gitnexus.md:88, docs/audit-reports/AI_SYSTEM_AUDIT_REPORT.md:820, docs/ci/gitnexus-validation.md:22, docs/ci/gitnexus-validation.md:91, docs/scripts/gitnexus-validate.md:34, docs/scripts/gitnexus-validate.md:8, docs/scripts/SCRIPT_REGISTRY.md:26, docs/scripts/validate-gitnexus.md:17, +36 more
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
  - Other files: docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:240, package.md:662, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:45, specs/runtime/infra-005-lint-governance/plan.md:617, specs/runtime/infra-005-lint-governance/tasks.md:139
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
  - Other files: docs/scripts/context-build.md:20, docs/scripts/context-build.md:23, docs/scripts/context-build.md:26, docs/scripts/context-build.md:29, docs/scripts/context-impact.md:67, docs/scripts/context-validate.md:21, docs/scripts/context-validate.md:63, docs/scripts/context-validate.md:70, docs/scripts/context-validate.md:77, docs/scripts/SCRIPT_REGISTRY.md:20, package.md:679, package.md:682, +20 more
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
  - Other files: docs/scripts/context-changed.md:20, docs/scripts/context-changed.md:58, docs/scripts/SCRIPT_REGISTRY.md:21, package.json:109, package.md:2050, package.md:699, package.md:702, scripts/context/changed.ts:12, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_28_GITNEXUS_CONTEXT_AWARE_GOVERNANCE.md:209, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:461, specs/runtime/infra-028-gitnexus-context-aware-governance/checklists/requirements.md:112, specs/runtime/infra-028-gitnexus-context-aware-governance/guides/TESTING_GUIDE.md:122, +13 more
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
  - Other files: docs/scripts/context-impact.md:24, docs/scripts/context-impact.md:27, docs/scripts/SCRIPT_REGISTRY.md:22, package.md:719, package.md:722, scripts/context/impact.ts:18, specs/runtime/infra-028-gitnexus-context-aware-governance/guides/TESTING_GUIDE.md:153, specs/runtime/infra-028-gitnexus-context-aware-governance/guides/TESTING_GUIDE.md:161, specs/runtime/infra-028-gitnexus-context-aware-governance/plan.md:323, specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md:118, specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md:425
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
  - Other files: docs/scripts/context-validate.md:31, docs/scripts/context-validate.md:64, docs/scripts/context-validate.md:71, docs/scripts/SCRIPT_REGISTRY.md:23, package.md:739, package.md:742, scripts/context/validate.ts:17, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_28_GITNEXUS_CONTEXT_AWARE_GOVERNANCE.md:199, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_28_GITNEXUS_CONTEXT_AWARE_GOVERNANCE.md:210, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_28_GITNEXUS_CONTEXT_AWARE_GOVERNANCE.md:224, specs/runtime/infra-028-gitnexus-context-aware-governance/checklists/requirements.md:43, specs/runtime/infra-028-gitnexus-context-aware-governance/guides/TESTING_GUIDE.md:181, +14 more
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
  - Other files: docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:238, scripts/dev/repo-doctor.ts:121, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:46, specs/runtime/infra-005-lint-governance/plan.md:613, specs/runtime/infra-005-lint-governance/plan.md:787, specs/runtime/infra-005-lint-governance/tasks.md:139, specs/runtime/infra-006-architecture-guard/spec.md:87, specs/runtime/infra-008-architecture-visualization/data-model.md:44, specs/runtime/infra-18-developer-experience-automation/plan.md:173
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
  - Other files: docs/architecture-guard/UNIFIED_ARCHITECTURE_GUARD.md:10, docs/architecture-guard/UNIFIED_ARCHITECTURE_GUARD.md:7, package.md:778, package.md:781, README.md:275, README.md:293, reports/package-script-audit.json:15, scripts/ai-engine/plan-task.ts:119, scripts/dev/hygiene-checks/arch-guard-check.ts:3, scripts/policy-engine/adapters/architecture-guard.adapter.ts:39, scripts/policy-engine/adapters/architecture-guard.adapter.ts:4, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_13_UNIFIED_ARCHITECTURE_GUARD.md:122, +115 more
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
  - Other files: docs/architecture-guard/UNIFIED_ARCHITECTURE_GUARD.md:8, package.md:798, README.md:281, reports/package-script-audit.json:24, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_14_ARCHITECTURE_ALIGNMENT_MIGRATION.md:193, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:48, specs/runtime/infra-013-unified-architecture-guard/guides/TESTING_GUIDE.md:100, specs/runtime/infra-013-unified-architecture-guard/guides/TESTING_GUIDE.md:123, specs/runtime/infra-013-unified-architecture-guard/guides/TESTING_GUIDE.md:62, specs/runtime/infra-013-unified-architecture-guard/quickstart.md:16, specs/runtime/infra-013-unified-architecture-guard/quickstart.md:69, specs/runtime/infra-014-architecture-alignment-migration/audits/LEGACY_SCRIPT_REVIEW.md:10, +16 more
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
  - Other files: docs/architecture-guard/UNIFIED_ARCHITECTURE_GUARD.md:9, docs/scripts/context-changed.md:58, package.json:109, package.md:2050, package.md:818, README.md:287, scripts/policy-engine/adapters/architecture-guard.adapter.ts:38, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:203, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:461, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:49, specs/runtime/infra-013-unified-architecture-guard/guides/TESTING_GUIDE.md:112, specs/runtime/infra-013-unified-architecture-guard/guides/TESTING_GUIDE.md:65, +9 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:24, package.md:838, package.md:841, scripts/architecture-diff.ts:6
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
  - Other files: docs/architecture/health/README.md:7, package.md:858, package.md:861, scripts/dev/hygiene-checks/arch-guard-check.ts:3, scripts/dev/repo-status.ts:85, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_17_REPOSITORY_SIZE_AND_PERFORMANCE_OPTIMIZATION.md:339, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_17_REPOSITORY_SIZE_AND_PERFORMANCE_OPTIMIZATION.md:367, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:201, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_20_AI_EXECUTION_ORCHESTRATION_ENGINE.md:211, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_22_REPOSITORY_HYGIENE_VERIFICATION.md:212, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:204, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:50, +48 more
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
  - Other files: docs/architecture/health/README.md:8, package.md:878, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:51, specs/runtime/infra-015-autonomous-architecture-health/contracts/architecture-health-cli-contract.md:11, specs/runtime/infra-015-autonomous-architecture-health/contracts/architecture-health-cli-contract.md:53, specs/runtime/infra-015-autonomous-architecture-health/quickstart.md:102, specs/runtime/infra-020-ai-execution-orchestration-engine/plan.md:701, specs/runtime/infra-025-script-system-standardization-and-governance/research.md:315, specs/runtime/infra-027-unified-governance-gate-system/research.md:60, tests/static/07-architecture-health-governance.test.ts:32
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
  - Other files: docs/architecture/health/architecture-health.json:180, docs/architecture/health/history/health-2026-03-12T22-54-01-012Z.json:131, docs/architecture/health/history/health-2026-03-15T23-26-58-848Z.json:180, docs/architecture/health/history/health-2026-03-20T21-25-38-263Z.json:418, docs/architecture/health/history/health-2026-03-20T21-25-56-943Z.json:180, docs/architecture/health/history/health-2026-03-25T11-56-09-458Z.json:418, docs/architecture/health/history/health-2026-03-25T11-56-10-315Z.json:180, package.md:898, package.md:901, reports/SCRIPT_REFACTOR_REPORT.md:344, reports/SCRIPT_REFACTOR_REPORT.md:420, reports/SCRIPT_REFACTOR_REPORT.md:425, +19 more
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
  - Other files: docs/architecture/visualization/README.md:4, package.md:918, package.md:921, scripts/architecture/visualize.ts:246, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:53, specs/runtime/infra-008-architecture-visualization/audits/VALIDATION_REPORT.md:88, specs/runtime/infra-008-architecture-visualization/data-model.md:316, specs/runtime/infra-008-architecture-visualization/guides/TESTING_GUIDE.md:119, specs/runtime/infra-008-architecture-visualization/guides/TESTING_GUIDE.md:154, specs/runtime/infra-008-architecture-visualization/guides/TESTING_GUIDE.md:202, specs/runtime/infra-008-architecture-visualization/guides/TESTING_GUIDE.md:67, specs/runtime/infra-008-architecture-visualization/guides/TESTING_GUIDE.md:70, +41 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:27, package.json:21, package.md:297, package.md:938, package.md:941, reports/SCRIPT_REFACTOR_REPORT.md:168, reports/SCRIPT_REFACTOR_REPORT.md:173, reports/SCRIPT_REFACTOR_REPORT.md:178, reports/SCRIPT_REFACTOR_REPORT.md:183, reports/SCRIPT_REFACTOR_REPORT.md:188, reports/SCRIPT_REFACTOR_REPORT.md:248, reports/SCRIPT_REFACTOR_REPORT.md:354, +47 more
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
  - Other files: reports/SCRIPT_REFACTOR_REPORT.md:362, reports/SCRIPT_REFACTOR_REPORT.md:38, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:90, specs/runtime/infra-009-ai-architecture-context/guides/TESTING_GUIDE.md:393
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
  - Other files: .agents/agents/copilot-instructions.md:56, .agents/agents/devops-engineer.agent.md:188, .agents/skills/package-manager-governance/SKILL.md:171, .agents/skills/terminal-safety/SKILL.md:114, .gitnexus/wiki/root.md:107, AGENTS.md:82, apps/api/README.md:42, apps/api/README.md:45, apps/backoffice/README.md:40, apps/backoffice/README.md:43, apps/frontoffice/README.md:39, apps/frontoffice/README.md:42, +479 more
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
  - Other files: apps/api/README.md:46, apps/backoffice/README.md:44, apps/frontoffice/README.md:43, apps/mmc/README.md:43, apps/worker/README.md:45, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:191, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:232, packages/ui-system/README.md:40, specs/runtime/019-translation-system/guides/TESTING_GUIDE.md:105, specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md:139, specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md:48, specs/runtime/023-departments/audits/VALIDATION_REPORT.md:14, +73 more
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
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:22
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
  - Other files: package.md:1057, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:23, specs/runtime/infra-007-module-boundaries/audits/VALIDATION_REPORT.md:134, specs/runtime/infra-007-module-boundaries/audits/VALIDATION_REPORT.md:43, specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md:105, specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md:117, specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md:349, specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md:432, specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md:74, specs/runtime/infra-007-module-boundaries/PR_SUMMARY.md:200, specs/runtime/infra-013-unified-architecture-guard/guides/TESTING_GUIDE.md:83, specs/runtime/infra-013-unified-architecture-guard/quickstart.md:73
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
  - Other files: apps/api/README.md:47, apps/api/README.md:51, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:192, docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md:233, specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md:142, specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md:48, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:24, specs/runtime/infra-001-typescript-stabilization/audits/VALIDATION_REPORT.md:22, specs/runtime/infra-003-alignment/guides/TESTING_GUIDE.md:302, specs/runtime/infra-003-alignment/plan.md:812, specs/runtime/infra-003-alignment/reports/CLOSURE_REPORT.md:263, specs/runtime/infra-19-ai-agent-runtime-environment/plan.md:785, +5 more
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
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:25, tests/performance/licenses.benchmark.test.ts:7
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
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:26, specs/runtime/infra-001-typescript-stabilization/audits/VALIDATION_REPORT.md:20, specs/runtime/infra-001-typescript-stabilization/audits/VALIDATION_REPORT.md:92, specs/runtime/infra-001-typescript-stabilization/guides/TESTING_GUIDE.md:113, specs/runtime/infra-001-typescript-stabilization/reports/IMPLEMENT_REPORT.md:127, specs/runtime/infra-007-module-boundaries/plan.md:830, specs/runtime/infra-007-module-boundaries/reports/IMPLEMENT_REPORT.md:75, specs/runtime/infra-007-module-boundaries/tasks.md:214, specs/runtime/infra-008-architecture-visualization/plan.md:1130, specs/runtime/infra-008-architecture-visualization/spec.md:704, specs/runtime/infra-008-architecture-visualization/tasks.md:201, specs/runtime/infra-008-architecture-visualization/tasks.md:251, +6 more
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
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:27, specs/runtime/infra-002-audit-checklist/reports/SAFE_ROLLOUT_PLAN.md:107, specs/runtime/infra-002-audit-checklist/reports/SAFE_ROLLOUT_PLAN.md:59, specs/runtime/infra-governance/audits/ANALYZE_REPORT.md:34, specs/runtime/infra-governance/audits/VALIDATION_REPORT.md:285, specs/runtime/infra-governance/audits/VALIDATION_REPORT.md:59, specs/runtime/infra-governance/audits/VALIDATION_REPORT.md:61, specs/runtime/infra-governance/audits/VALIDATION_REPORT.md:98, specs/runtime/infra-governance/reports/IMPLEMENT_REPORT.md:282, specs/runtime/infra-governance/tasks.md:178, specs/runtime/infra-governance/tasks.md:63, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:131
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
  - Other files: apps/mmc/README.md:50, apps/mmc/tests/e2e/smoke.spec.ts:10, package.json:66, package.md:1203, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:615, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:28, specs/runtime/infra-003-alignment/plan.md:382, specs/runtime/infra-governance/plan.md:366, specs/runtime/infra-governance/plan.md:668, specs/runtime/infra-governance/plan.md:675, specs/runtime/infra-governance/tasks.md:120, tests/e2e/app-load.spec.ts:13
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
  - Other files: apps/backoffice/README.md:51, apps/backoffice/tests/e2e/smoke.spec.ts:10, package.json:66, package.md:1203, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:615, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:29, specs/runtime/infra-003-alignment/plan.md:382, specs/runtime/infra-governance/plan.md:409, specs/runtime/infra-governance/tasks.md:124, tests/e2e/app-load.spec.ts:14
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
  - Other files: apps/frontoffice/README.md:50, apps/frontoffice/tests/e2e/smoke.spec.ts:10, package.json:66, package.md:1203, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:615, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:30, specs/runtime/infra-003-alignment/plan.md:382, specs/runtime/infra-governance/plan.md:452, specs/runtime/infra-governance/tasks.md:128, tests/e2e/app-load.spec.ts:15
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
  - Other files: .agents/agents/copilot-instructions.md:57, package.md:1210, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:31, specs/runtime/infra-003-alignment/plan.md:833, specs/runtime/infra-003-alignment/reports/CLARIFY_REPORT.md:21, specs/runtime/infra-003-alignment/reports/PLAN_REPORT.md:90, specs/runtime/infra-003-alignment/spec.md:441, specs/runtime/infra-003-alignment/spec.md:82, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:709, tests/e2e/app-load.spec.ts:16
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
  - Other files: .agents/agents/copilot-instructions.md:53, .agents/skills/package-manager-governance/SKILL.md:173, .gitnexus/wiki/root.md:108, apps/api/package.json:8, apps/worker/package.json:8, docs/operations/LICENSES_OPERATIONAL_RUNBOOK.md:60, package.json:69, package.md:1260, package.md:1267, packages/api-client/package.json:12, packages/domain-core/package.json:37, packages/logger/package.json:23, +50 more
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
  - Other files: specs/runtime/021-role-permission-system/PR_SUMMARY.md:350, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:84
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
  - Other files: specs/runtime/020-status-workflow-engine/guides/TESTING_GUIDE.md:417, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:85
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
  - Other files: .agents/agents/copilot-instructions.md:52, .gitnexus/wiki/overview.md:72, .gitnexus/wiki/overview.md:73, .gitnexus/wiki/overview.md:74, apps/backoffice/README.md:47, apps/frontoffice/README.md:46, apps/mmc/README.md:46, package.md:1286, README.md:115, README.md:122, README.md:131, README.md:138, +28 more
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
  - Other files: specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:33
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
  - Other files: package.json:77, package.md:1412, specs/runtime/017-tenant-bootstrap/guides/TESTING_GUIDE.md:148, specs/runtime/017-tenant-bootstrap/guides/TESTING_GUIDE.md:182, specs/runtime/017-tenant-bootstrap/guides/TESTING_GUIDE.md:337, specs/runtime/017-tenant-bootstrap/guides/TESTING_GUIDE.md:88, specs/runtime/018-workspace-settings/guides/TESTING_GUIDE.md:275, specs/runtime/018-workspace-settings/guides/TESTING_GUIDE.md:85, specs/runtime/019-translation-system/guides/TESTING_GUIDE.md:289, specs/runtime/019-translation-system/guides/TESTING_GUIDE.md:87, specs/runtime/020-status-workflow-engine/guides/TESTING_GUIDE.md:95, specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md:111, +23 more
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
  - Other files: package.json:77, package.md:1412, reports/SCRIPT_REFACTOR_REPORT.md:372, reports/SCRIPT_REFACTOR_REPORT.md:463, specs/runtime/002B-tenant-baseline-schema/quickstart.md:414, specs/runtime/019-translation-system/guides/TESTING_GUIDE.md:292, specs/runtime/019-translation-system/guides/TESTING_GUIDE.md:90, specs/runtime/021-role-permission-system/guides/TESTING_GUIDE.md:117, specs/runtime/032-tags/guides/TESTING_GUIDE.md:99, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340, specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md:1057, specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md:616, +6 more
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
  - Other files: apps/mmc/playwright.config.ts:9, apps/mmc/tests/e2e/smoke.spec.ts:9, package.json:77, package.md:1412, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:36, specs/runtime/infra-003-alignment/plan.md:829, specs/runtime/infra-governance/plan.md:358, specs/runtime/infra-governance/tasks.md:119, specs/runtime/ui-00-runtime-architecture/guides/TESTING_GUIDE.md:105, specs/runtime/ui-00-runtime-architecture/guides/TESTING_GUIDE.md:187, specs/runtime/ui-01-auth-module/guides/TESTING_GUIDE.md:175, +5 more
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
  - Other files: apps/backoffice/playwright.config.ts:9, apps/backoffice/tests/e2e/smoke.spec.ts:9, package.json:77, package.md:1412, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:37, specs/runtime/infra-003-alignment/guides/TESTING_GUIDE.md:454, specs/runtime/infra-003-alignment/plan.md:830, specs/runtime/infra-governance/plan.md:401, specs/runtime/infra-governance/tasks.md:124, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:118, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:206
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
  - Other files: apps/frontoffice/playwright.config.ts:9, apps/frontoffice/tests/e2e/smoke.spec.ts:9, package.json:77, package.md:1412, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:340, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:38, specs/runtime/infra-003-alignment/plan.md:831, specs/runtime/infra-governance/plan.md:444, specs/runtime/infra-governance/tasks.md:128, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:119, specs/runtime/ui-07-layout-system-integration/guides/TESTING_GUIDE.md:239
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
  - Other files: package.json:70, package.md:1279, package.md:1419, specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json:334, specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md:1046, specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md:605, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:39, specs/runtime/infra-003-alignment/guides/TESTING_GUIDE.md:190
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
  - Other files: package.json:124, package.md:1439, package.md:2339
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
  - Other files: package.md:1456, package.md:1459, reports/SCRIPT_REFACTOR_REPORT.md:196, reports/SCRIPT_REFACTOR_REPORT.md:201, reports/SCRIPT_REFACTOR_REPORT.md:210, reports/SCRIPT_REFACTOR_REPORT.md:215, reports/SCRIPT_REFACTOR_REPORT.md:223, reports/SCRIPT_REFACTOR_REPORT.md:231, reports/SCRIPT_REFACTOR_REPORT.md:235, reports/SCRIPT_REFACTOR_REPORT.md:239, reports/SCRIPT_REFACTOR_REPORT.md:358, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:69, +19 more
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
  - Other files: .agents/skills/script-system-governance/SKILL.md:121, .agents/skills/script-system-governance/SKILL.md:149, .agents/skills/script-system-governance/SKILL.md:183, .agents/skills/script-system-governance/SKILL.md:243, .agents/skills/script-system-governance/SKILL.md:269, docs/scripts/generate-script-docs.md:6, docs/scripts/generate-script-docs.md:67, docs/scripts/README.md:19, docs/scripts/SCRIPT_REGISTRY.md:3, docs/scripts/SCRIPT_REGISTRY.md:50, package.md:1476, package.md:1479, +43 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:49, package.md:1496, package.md:1499, package.md:5, scripts/generate/package-docs.ts:6, scripts/generate/package-docs.ts:886
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
  - Other files: docs/scripts/db-validate-licenses.md:23, docs/scripts/SCRIPT_REGISTRY.md:52, docs/scripts/seed-dashboard-test-data.md:45, docs/scripts/seed-dashboard-test-data.md:6, package.md:1516, package.md:1519, reports/SCRIPT_REFACTOR_REPORT.md:309, reports/SCRIPT_REFACTOR_REPORT.md:319, reports/SCRIPT_REFACTOR_REPORT.md:334, reports/SCRIPT_REFACTOR_REPORT.md:356, reports/SCRIPT_REFACTOR_REPORT.md:513, reports/SCRIPT_REFACTOR_REPORT.md:596, +12 more
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
  - Other files: .agents/agents/orchestrator.agent.md:141, .agents/agents/orchestrator.agent.md:2782, .agents/agents/orchestrator.agent.md:592, .agents/skills/script-system-governance/SKILL.md:173, docs/scripts/SCRIPT_MIGRATION_MAP.md:4, docs/scripts/SCRIPT_REGISTRY.md:51, package.md:1536, package.md:1539, scripts/dev/refactor-scripts.ts:11, specs/runtime/infra-025-script-system-standardization-and-governance/guides/TESTING_GUIDE.md:196, specs/runtime/infra-025-script-system-standardization-and-governance/guides/TESTING_GUIDE.md:212, specs/runtime/infra-025-script-system-standardization-and-governance/guides/TESTING_GUIDE.md:374, +5 more
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
  - Other files: package.md:1556, package.md:1559, reports/SCRIPT_REFACTOR_REPORT.md:349, reports/SCRIPT_REFACTOR_REPORT.md:390, reports/SCRIPT_REFACTOR_REPORT.md:395, reports/SCRIPT_REFACTOR_REPORT.md:404, reports/SCRIPT_REFACTOR_REPORT.md:408, reports/SCRIPT_REFACTOR_REPORT.md:412, reports/SCRIPT_REFACTOR_REPORT.md:789, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:59, specs/runtime/infra-19-ai-agent-runtime-environment/audits/VALIDATION_REPORT.md:120, specs/runtime/infra-19-ai-agent-runtime-environment/guides/TESTING_GUIDE.md:156, +3 more
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
  - Other files: package.md:1576, package.md:1579, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_20_AI_EXECUTION_ORCHESTRATION_ENGINE.md:312, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:62, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:109, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:184, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:69, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:78, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:90, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:99, specs/runtime/infra-020-ai-execution-orchestration-engine/plan.md:128, specs/runtime/infra-020-ai-execution-orchestration-engine/plan.md:519, +15 more
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
  - Other files: package.md:1596, package.md:1599, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_20_AI_EXECUTION_ORCHESTRATION_ENGINE.md:311, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:63, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:116, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:121, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:130, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:138, specs/runtime/infra-020-ai-execution-orchestration-engine/guides/TESTING_GUIDE.md:139, specs/runtime/infra-020-ai-execution-orchestration-engine/plan.md:129, specs/runtime/infra-020-ai-execution-orchestration-engine/plan.md:566, specs/runtime/infra-020-ai-execution-orchestration-engine/plan.md:573, +14 more
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
  - Other files: package.md:1616, package.md:1619, package.md:1625, reports/package-script-audit.json:6, scripts/ai-engine/plan-task.ts:133, scripts/generate/**tests**/package-docs.test.ts:21, scripts/generate/**tests**/package-docs.test.ts:28, scripts/generate/**tests**/package-docs.test.ts:53, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_20_AI_EXECUTION_ORCHESTRATION_ENGINE.md:275, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_20_AI_EXECUTION_ORCHESTRATION_ENGINE.md:313, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:64, specs/runtime/infra-020-ai-execution-orchestration-engine/audits/VALIDATION_REPORT.md:82, +39 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:12, package.md:1636, package.md:1639, scripts/prompt-qa.ts:7
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
  - Other files: docs/ai/context/README.md:105, docs/ai/context/README.md:332, docs/ai/context/README.md:341, docs/ai/context/README.md:347, docs/ai/context/README.md:415, docs/ai/context/README.md:426, docs/ai/context/README.md:440, docs/ai/context/README.md:63, docs/ai/context/README.md:87, docs/ai/context/README.md:93, docs/ai/context/README.md:99, docs/ai/context/REFRESH_GUIDE.md:103, +106 more
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
  - Other files: docs/scripts/validate-ai-context-fresh.md:47, reports/SCRIPT_REFACTOR_REPORT.md:167, reports/SCRIPT_REFACTOR_REPORT.md:172, reports/SCRIPT_REFACTOR_REPORT.md:177, reports/SCRIPT_REFACTOR_REPORT.md:182, reports/SCRIPT_REFACTOR_REPORT.md:187, reports/SCRIPT_REFACTOR_REPORT.md:316, reports/SCRIPT_REFACTOR_REPORT.md:346, reports/SCRIPT_REFACTOR_REPORT.md:394, reports/SCRIPT_REFACTOR_REPORT.md:399, reports/SCRIPT_REFACTOR_REPORT.md:403, reports/SCRIPT_REFACTOR_REPORT.md:416, +51 more
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
  - Other files: package.md:1698, reports/SCRIPT_REFACTOR_REPORT.md:200, reports/SCRIPT_REFACTOR_REPORT.md:205, reports/SCRIPT_REFACTOR_REPORT.md:209, reports/SCRIPT_REFACTOR_REPORT.md:214, reports/SCRIPT_REFACTOR_REPORT.md:219, reports/SCRIPT_REFACTOR_REPORT.md:227, reports/SCRIPT_REFACTOR_REPORT.md:326, reports/SCRIPT_REFACTOR_REPORT.md:347, reports/SCRIPT_REFACTOR_REPORT.md:558, reports/SCRIPT_REFACTOR_REPORT.md:746, reports/SCRIPT_REFACTOR_REPORT.md:784, +18 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:11, package.md:1715, package.md:1718, reports/SCRIPT_REFACTOR_REPORT.md:109, reports/SCRIPT_REFACTOR_REPORT.md:114, reports/SCRIPT_REFACTOR_REPORT.md:120, reports/SCRIPT_REFACTOR_REPORT.md:124, reports/SCRIPT_REFACTOR_REPORT.md:128, reports/SCRIPT_REFACTOR_REPORT.md:132, reports/SCRIPT_REFACTOR_REPORT.md:138, reports/SCRIPT_REFACTOR_REPORT.md:142, reports/SCRIPT_REFACTOR_REPORT.md:147, +77 more
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
  - Other files: package.md:1735, package.md:1738, README.md:58, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:263, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:278, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:292, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:67, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:82, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:65, specs/runtime/infra-18-developer-experience-automation/guides/TESTING_GUIDE.md:185, specs/runtime/infra-18-developer-experience-automation/guides/TESTING_GUIDE.md:63, specs/runtime/infra-18-developer-experience-automation/plan.md:575, +14 more
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
  - Other files: package.md:1755, package.md:1758, README.md:59, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:120, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:279, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:68, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:66, specs/runtime/infra-18-developer-experience-automation/guides/TESTING_GUIDE.md:82, specs/runtime/infra-18-developer-experience-automation/guides/TESTING_GUIDE.md:91, specs/runtime/infra-18-developer-experience-automation/plan.md:652, specs/runtime/infra-18-developer-experience-automation/PR_SUMMARY.md:62, specs/runtime/infra-18-developer-experience-automation/reports/SPECIFY_REPORT.md:12, +2 more
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
  - Other files: package.md:1775, package.md:1778, README.md:57, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:149, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:277, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:69, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:67, specs/runtime/infra-18-developer-experience-automation/guides/TESTING_GUIDE.md:97, specs/runtime/infra-18-developer-experience-automation/plan.md:650, specs/runtime/infra-18-developer-experience-automation/plan.md:655, specs/runtime/infra-18-developer-experience-automation/PR_SUMMARY.md:63, specs/runtime/infra-18-developer-experience-automation/reports/SPECIFY_REPORT.md:12, +2 more
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
  - Other files: package.md:1795, package.md:1798, README.md:60, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:182, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:280, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:293, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION.md:70, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:68, specs/runtime/infra-18-developer-experience-automation/guides/TESTING_GUIDE.md:110, specs/runtime/infra-18-developer-experience-automation/guides/TESTING_GUIDE.md:119, specs/runtime/infra-18-developer-experience-automation/plan.md:653, specs/runtime/infra-18-developer-experience-automation/PR_SUMMARY.md:61, +3 more
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
  - Other files: docs/scripts/db-console.md:45, docs/scripts/db-console.md:6, docs/scripts/SCRIPT_REGISTRY.md:39, package.md:1815, package.md:1818, scripts/db/console.ts:23, scripts/db/console.ts:8, specs/runtime/017-tenant-bootstrap/guides/TESTING_GUIDE.md:316, specs/runtime/018-workspace-settings/guides/TESTING_GUIDE.md:294, specs/runtime/019-translation-system/guides/TESTING_GUIDE.md:308, specs/runtime/031-category-values/guides/TESTING_GUIDE.md:282, specs/runtime/fix-01-runtime-script-recovery-and-validation/guides/TESTING_GUIDE.md:131, +4 more
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
  - Other files: docs/database/LICENSES_MIGRATION_GUIDE.md:221, docs/database/LICENSES_MIGRATION_GUIDE.md:225, docs/database/LICENSES_MIGRATION_GUIDE.md:232, docs/operations/LICENSES_OPERATIONAL_RUNBOOK.md:132, docs/operations/LICENSES_OPERATIONAL_RUNBOOK.md:68, docs/scripts/db-migrate.md:12, docs/scripts/db-migrate.md:51, docs/scripts/db-migrate.md:54, docs/scripts/db-migrate.md:6, docs/scripts/db-pool-status.md:22, docs/scripts/SCRIPT_REGISTRY.md:40, package.md:1835, +74 more
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
  - Other files: .gitnexus/wiki/specs-runtime.md:631, docs/scripts/db-pool-status.md:43, docs/scripts/db-pool-status.md:46, docs/scripts/db-pool-status.md:6, docs/scripts/SCRIPT_REGISTRY.md:41, package.md:1855, package.md:1858, reports/SCRIPT_REFACTOR_REPORT.md:11, reports/SCRIPT_REFACTOR_REPORT.md:305, reports/SCRIPT_REFACTOR_REPORT.md:314, reports/SCRIPT_REFACTOR_REPORT.md:324, reports/SCRIPT_REFACTOR_REPORT.md:330, +24 more
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
  - Other files: .gitnexus/wiki/specs-runtime.md:634, docs/scripts/db-validate-licenses.md:42, docs/scripts/db-validate-licenses.md:6, docs/scripts/SCRIPT_REGISTRY.md:42, package.md:1875, package.md:1878, reports/SCRIPT_REFACTOR_REPORT.md:12, reports/SCRIPT_REFACTOR_REPORT.md:306, reports/SCRIPT_REFACTOR_REPORT.md:315, reports/SCRIPT_REFACTOR_REPORT.md:331, reports/SCRIPT_REFACTOR_REPORT.md:343, reports/SCRIPT_REFACTOR_REPORT.md:593, +10 more
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
  - Other files: docs/scripts/maintenance-cache-clean.md:49, docs/scripts/maintenance-cache-clean.md:6, docs/scripts/SCRIPT_REGISTRY.md:66, package.md:1895, package.md:1898, reports/SCRIPT_REFACTOR_REPORT.md:293, reports/SCRIPT_REFACTOR_REPORT.md:297, reports/SCRIPT_REFACTOR_REPORT.md:310, reports/SCRIPT_REFACTOR_REPORT.md:320, reports/SCRIPT_REFACTOR_REPORT.md:359, reports/SCRIPT_REFACTOR_REPORT.md:368, reports/SCRIPT_REFACTOR_REPORT.md:378, +13 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:67, docs/scripts/security-scan.md:6, package.md:1915, package.md:1918, scripts/security/scan.ts:6, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:238, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:236, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md:84, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/tasks.md:70
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:70, docs/scripts/security-scan-deps.md:6, package.md:1935, package.md:1938, scripts/security/scan-deps.ts:6, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:147, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:239, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:60, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:170, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:182, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:189, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/reports/IMPLEMENT_REPORT.md:220, +4 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:71, docs/scripts/security-scan-secrets.md:6, docs/scripts/security-scan-secrets.md:7, package.md:1955, package.md:1958, scripts/security/scan-secrets.ts:6, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:148, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:240, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:170, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:196, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/plan.md:203, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/reports/IMPLEMENT_REPORT.md:221, +3 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:69, docs/scripts/security-scan-config.md:6, package.md:1975, package.md:1978, scripts/security/scan-config.ts:6, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:241, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:264, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md:87, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/tasks.md:70
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:68, docs/scripts/security-scan-ci.md:6, package.md:1995, package.md:1998, scripts/security/scan-ci.ts:6, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:164, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_26_TRIVY_SECURITY_SCANNING_AND_ENFORCEMENT.md:242, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:29, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:293, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:318, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:320, specs/runtime/infra-026-trivy-security-scanning-and-enforcement/guides/TESTING_GUIDE.md:568, +8 more
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
  - Other files: .agents/agents/orchestrator.agent.md:3066, docs/scripts/SCRIPT_REGISTRY.md:58, package.md:2015, package.md:2018, package.md:2024, scripts/governance/gate-ci.ts:22, scripts/governance/gate.ts:9, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:191, specs/runtime/infra-027-unified-governance-gate-system/audits/VALIDATION_REPORT.md:39, specs/runtime/infra-027-unified-governance-gate-system/audits/VALIDATION_REPORT.md:72, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:246, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:25, +21 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:59, package.md:2035, package.md:2038, package.md:2044, reports/package-script-audit.json:48, scripts/generate/**tests**/package-docs.test.ts:67, scripts/governance/gate-ci.ts:9, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:234, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:107, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:211, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:247, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:26, +7 more
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
  - Other files: .agents/agents/orchestrator.agent.md:2518, package.md:2057, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md:216, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:127, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:27, specs/runtime/infra-027-unified-governance-gate-system/plan.md:165, specs/runtime/infra-027-unified-governance-gate-system/plan.md:167, specs/runtime/infra-027-unified-governance-gate-system/plan.md:367, specs/runtime/infra-027-unified-governance-gate-system/plan.md:407, specs/runtime/infra-027-unified-governance-gate-system/PR_SUMMARY.md:211, specs/runtime/infra-027-unified-governance-gate-system/reports/PLAN_REPORT.md:43, specs/runtime/infra-027-unified-governance-gate-system/research.md:38, +3 more
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:60, package.md:2074, package.md:2077, scripts/governance/report.ts:9, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:145, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:221, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:248, specs/runtime/infra-027-unified-governance-gate-system/guides/TESTING_GUIDE.md:28, specs/runtime/infra-027-unified-governance-gate-system/plan.md:309, specs/runtime/infra-027-unified-governance-gate-system/plan.md:344, specs/runtime/infra-027-unified-governance-gate-system/plan.md:396, specs/runtime/infra-027-unified-governance-gate-system/plan.md:453, +2 more
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
  - Other files: package.md:2096, reports/SCRIPT_REFACTOR_REPORT.md:357, reports/SCRIPT_REFACTOR_REPORT.md:475, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:81, specs/runtime/ui-09-security-and-token-handling/PR_SUMMARY.md:291
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
  - Other files: .agents/agents/orchestrator.agent.md:3019, .agents/agents/orchestrator.agent.md:3021, docs/ci/gitnexus-validation.md:13, docs/ci/local-ci.md:134, docs/ci/local-ci.md:364, docs/ci/local-ci.md:372, docs/ci/local-ci.md:376, scripts/ci/setup-act-local.sh:126, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:234, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:250, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:264, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:271, +61 more
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
  - Other files: docs/ci/local-ci.md:143, docs/ci/local-ci.md:281, scripts/ci/setup-act-local.sh:127, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_23_LOCAL_CI_SIMULATION_WITH_ACT.md:311, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:544, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:615, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:918, specs/runtime/infra-023-local-ci-simulation-with-act/spec.md:127, specs/runtime/infra-023-local-ci-simulation-with-act/spec.md:307, specs/runtime/infra-023-local-ci-simulation-with-act/spec.md:423, specs/runtime/infra-023-local-ci-simulation-with-act/tasks.md:166, specs/runtime/infra-023-local-ci-simulation-with-act/tasks.md:282, +1 more
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
  - Other files: docs/ci/local-ci.md:151, docs/ci/local-ci.md:152, docs/ci/local-ci.md:153, docs/ci/local-ci.md:154, docs/ci/local-ci.md:155, docs/ci/local-ci.md:207, docs/ci/local-ci.md:208, specs/runtime/infra-023-local-ci-simulation-with-act/guides/TESTING_GUIDE.md:43, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:545, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:546, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:618, specs/runtime/infra-023-local-ci-simulation-with-act/PR_SUMMARY.md:66, +6 more
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
  - Other files: docs/ci/local-ci.md:202, docs/ci/local-ci.md:203, docs/ci/local-ci.md:204, docs/ci/local-ci.md:267, docs/ci/local-ci.md:270
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
  - Other files: docs/ci/local-ci.md:161, scripts/ci/setup-act-local.sh:128, specs/runtime/infra-023-local-ci-simulation-with-act/guides/TESTING_GUIDE.md:37, specs/runtime/infra-023-local-ci-simulation-with-act/guides/TESTING_GUIDE.md:62, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:542, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:621, specs/runtime/infra-023-local-ci-simulation-with-act/plan.md:873, specs/runtime/infra-023-local-ci-simulation-with-act/PR_SUMMARY.md:175, specs/runtime/infra-023-local-ci-simulation-with-act/PR_SUMMARY.md:52, specs/runtime/infra-023-local-ci-simulation-with-act/reports/CLOSURE_REPORT.md:140, specs/runtime/infra-023-local-ci-simulation-with-act/reports/IMPLEMENT_REPORT.md:37, specs/runtime/infra-023-local-ci-simulation-with-act/reports/IMPLEMENT_REPORT.md:78, +5 more
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
  - Other files: docs/ci/local-ci.md:231, package.md:2211
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
  - Other files: .agents/agents/orchestrator.agent.md:3018, .agents/agents/orchestrator.agent.md:3021, .agents/agents/orchestrator.agent.md:3028, .agents/agents/orchestrator.agent.md:3035, docs/audit-reports/AI_SYSTEM_AUDIT_REPORT.md:886, docs/ci/local-ci.md:172, docs/ci/local-ci.md:348, docs/ci/local-ci.md:367, docs/ci/local-ci.md:388, docs/scripts/ci-run-local.md:34, docs/scripts/ci-run-local.md:8, docs/scripts/SCRIPT_REGISTRY.md:33, +9 more
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
  - Other files: docs/ci/gitnexus-validation.md:13, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:86, specs/runtime/infra-17-repository-size-and-performance-optimization/guides/TESTING_GUIDE.md:261, specs/runtime/infra-17-repository-size-and-performance-optimization/guides/TESTING_GUIDE.md:502
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
  - Other files: .agents/agents/devops-engineer.agent.md:190
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
  - Other files: .agents/agents/devops-engineer.agent.md:192
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
  - Other files: package.md:2307, scripts/validate/**tests**/script-infrastructure.test.ts:107
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
  - Other files: package.md:2327, scripts/policy-engine/adapters/script-governance.adapter.ts:4, scripts/policy-engine/adapters/script-governance.adapter.ts:53
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
  - Other files: docs/scripts/SCRIPT_REGISTRY.md:48, package.md:1436, package.md:2344, package.md:2347, scripts/dev/demo-logger-features.ts:8
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
  - Other files: package.md:2366, scripts/dev/refactor-scripts.ts:254, scripts/validate/script-usage.ts:150
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
  - Other files: package.md:2385, scripts/dev/demo-logger-features.ts:63, scripts/dev/demo-logger-features.ts:64
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
  - Other files: package.md:2402, package.md:2405, scripts/policy-engine/cli.ts:10, scripts/policy-engine/cli.ts:11, scripts/policy-engine/cli.ts:12, scripts/policy-engine/cli.ts:4, scripts/policy-engine/cli.ts:8, scripts/policy-engine/cli.ts:9, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_29_POLICY_ENGINE_AND_GOVERNANCE_RULES_LAYER.md:113, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_29_POLICY_ENGINE_AND_GOVERNANCE_RULES_LAYER.md:168, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_29_POLICY_ENGINE_AND_GOVERNANCE_RULES_LAYER.md:312, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_29_POLICY_ENGINE_AND_GOVERNANCE_RULES_LAYER.md:353, +64 more
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
  - Other files: package.md:2422
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
  - Other files: package.md:2444, specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_GOVERNANCE.md:29, specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md:40, specs/runtime/infra-18-developer-experience-automation/plan.md:358, specs/runtime/infra-18-developer-experience-automation/plan.md:421, specs/runtime/infra-governance/plan.md:151, specs/runtime/infra-governance/plan.md:234, specs/runtime/infra-governance/plan.md:613, specs/runtime/infra-governance/plan.md:620, specs/runtime/infra-governance/reports/IMPLEMENT_REPORT.md:281, specs/runtime/infra-governance/reports/TASKS_REPORT.md:29, specs/runtime/infra-governance/tasks.md:183, +2 more
- Updated or generated files: Not audited automatically in the isolated execution pass.
- Removal assessment: Treat as protected. It is a primary quality, build, test, or governance entrypoint.
