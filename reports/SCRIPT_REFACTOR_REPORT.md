# Script Refactor Report

> Generated: 2026-03-21T13:18:19.821Z
> Mode: LIVE
> Migration entries applied: 33

## Changes Made

### .gitnexus/wiki/specs-runtime.md

- `bun run db:pool-status` → `bun run db:status:pool` (1x)
- `bun run db:validate-licenses` → `bun run db:validate:licenses` (1x)

### .gitnexus/wiki/docs-database.md

- `bun run migrate` → `bun run db:migrate` (4x)

### specs/runtime/infra-009-ai-architecture-context/contracts/artifact-consumer-interface.md

- `bun run generate:ai-context` → `bun run ai:context:generate` (6x)

### specs/runtime/infra-009-ai-architecture-context/contracts/artifact-generator-interface.md

- `bun run generate:ai-context` → `bun run ai:context:generate` (1x)

### specs/runtime/infra-009-ai-architecture-context/quickstart.md

- `bun run generate:ai-context` → `bun run ai:context:generate` (9x)
- `bun run validate:architecture` → `bun run arch:audit` (1x)

### specs/runtime/infra-009-ai-architecture-context/research.md

- `bun run generate:ai-context` → `bun run ai:context:generate` (2x)

### specs/runtime/infra-009-ai-architecture-context/guides/TESTING_GUIDE.md

- `bun run ai-context:generate` → `bun run ai:context:generate` (10x)
- `bun run infra-audit:check` → `bun run arch:audit:check` (1x)
- `bun run infra-audit` → `bun run arch:audit` (1x)

### specs/runtime/infra-009-ai-architecture-context/plan.md

- `bun run generate:ai-context` → `bun run ai:context:generate` (6x)

### specs/runtime/infra-009-ai-architecture-context/spec.md

- `bun run generate:ai-context` → `bun run ai:context:generate` (1x)

### specs/runtime/infra-009-ai-architecture-context/PR_SUMMARY.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run ai-context:status` → `bun run ai:context:status` (1x)
- `bun run infra-audit` → `bun run arch:audit` (1x)

### specs/runtime/infra-009-ai-architecture-context/reports/PLAN_REPORT.md

- `bun run generate:ai-context` → `bun run ai:context:generate` (1x)

### specs/runtime/infra-009-ai-architecture-context/reports/CLOSURE_REPORT.md

- `bun run ai-context:generate` → `bun run ai:context:generate` (1x)
- `bun run ai-context:refresh` → `bun run ai:context:refresh` (3x)

### specs/runtime/infra-009-ai-architecture-context/reports/CLARIFY_REPORT.md

- `bun run generate:ai-context` → `bun run ai:context:generate` (1x)

### specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/tasks.md

- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (1x)

### specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/research.md

- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (1x)

### specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/guides/TESTING_GUIDE.md

- `bun run gitnexus:context` → `bun run arch:gitnexus:context` (6x)
- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (8x)
- `bun run vitest` → `bun run test` (2x)

### specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/plan.md

- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (1x)
- `bun run gitnexus:context` → `bun run arch:gitnexus:context` (4x)
- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (3x)

### specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/spec.md

- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (4x)

### specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/PR_SUMMARY.md

- `bun run gitnexus:context` → `bun run arch:gitnexus:context` (1x)
- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (1x)
- `bun run vitest` → `bun run test` (3x)

### specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/reports/SPECIFY_REPORT.md

- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (1x)

### specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/reports/IMPLEMENT_REPORT.md

- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (1x)
- `bun run vitest` → `bun run test` (1x)

### specs/runtime/infra-007-module-boundaries/audits/ANALYZE_REPORT_ATTEMPT6_SPECKIT.md

- `bun run ai-guard` → `bun run ai:guard` (1x)
- `bun run infra-audit` → `bun run arch:audit` (2x)

### specs/runtime/infra-007-module-boundaries/audits/VALIDATION_REPORT.md

- `bun run ai-guard` → `bun run ai:guard` (3x)
- `bun run biome` → `bun run lint` (2x)
- `bun run tsc` → `bun run typecheck:src` (2x)

### specs/runtime/infra-007-module-boundaries/checklists/requirements.md

- `bun run ai-guard` → `bun run ai:guard` (1x)

### specs/runtime/infra-007-module-boundaries/tasks.md

- `bun run ai-guard` → `bun run ai:guard` (3x)

### specs/runtime/infra-007-module-boundaries/research.md

- `bun run ai-guard` → `bun run ai:guard` (1x)

### specs/runtime/infra-007-module-boundaries/guides/TESTING_GUIDE.md

- `bun run ai-guard` → `bun run ai:guard` (11x)
- `bun run biome` → `bun run lint` (4x)
- `bun run tsc` → `bun run typecheck:src` (4x)

### specs/runtime/infra-007-module-boundaries/plan.md

- `bun run ai-guard` → `bun run ai:guard` (10x)

### specs/runtime/infra-007-module-boundaries/spec.md

- `bun run ai-guard` → `bun run ai:guard` (22x)
- `bun run infra-audit` → `bun run arch:audit` (5x)

### specs/runtime/infra-007-module-boundaries/PR_SUMMARY.md

- `bun run ai-guard` → `bun run ai:guard` (1x)

### specs/runtime/infra-007-module-boundaries/reports/SPECIFY_REPORT.md

- `bun run ai-guard` → `bun run ai:guard` (5x)

### specs/runtime/infra-007-module-boundaries/reports/TASKS_REPORT.md

- `bun run ai-guard` → `bun run ai:guard` (1x)

### specs/runtime/infra-007-module-boundaries/reports/IMPLEMENT_REPORT.md

- `bun run ai-guard` → `bun run ai:guard` (3x)

### specs/runtime/infra-007-module-boundaries/reports/CLARIFY_REPORT.md

- `bun run ai-guard` → `bun run ai:guard` (2x)

### specs/runtime/infra-021-support-surface-routing-and-template-migration/audits/VALIDATION_REPORT.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (2x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (2x)

### specs/runtime/infra-021-support-surface-routing-and-template-migration/contracts/migration-batch-contract.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (1x)

### specs/runtime/infra-021-support-surface-routing-and-template-migration/quickstart.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (1x)

### specs/runtime/infra-021-support-surface-routing-and-template-migration/plan.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (2x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (2x)

### specs/runtime/infra-021-support-surface-routing-and-template-migration/spec.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (1x)

### specs/runtime/013-affiliates/quickstart.md

- `bun run migrate` → `bun run db:migrate` (1x)

### specs/runtime/infra-022-repository-hygiene-verification/audits/VALIDATION_REPORT.md

- `bun run hygiene:report` → `bun run dev:hygiene:report` (3x)

### specs/runtime/infra-022-repository-hygiene-verification/tasks.md

- `bun run ai-context:validate` → `bun run ai:context:validate` (1x)
- `bun run hygiene:report` → `bun run dev:hygiene:report` (2x)

### specs/runtime/infra-022-repository-hygiene-verification/research.md

- `bun run ai-context:validate` → `bun run ai:context:validate` (2x)

### specs/runtime/infra-022-repository-hygiene-verification/guides/TESTING_GUIDE.md

- `bun run ai-context:validate` → `bun run ai:context:validate` (2x)
- `bun run hygiene:report` → `bun run dev:hygiene:report` (5x)

### specs/runtime/infra-022-repository-hygiene-verification/plan.md

- `bun run ai-context:validate` → `bun run ai:context:validate` (3x)
- `bun run hygiene:report` → `bun run dev:hygiene:report` (1x)

### specs/runtime/infra-022-repository-hygiene-verification/spec.md

- `bun run ai-context:validate` → `bun run ai:context:validate` (3x)

### specs/runtime/infra-022-repository-hygiene-verification/PR_SUMMARY.md

- `bun run hygiene:report` → `bun run dev:hygiene:report` (3x)

### specs/runtime/infra-022-repository-hygiene-verification/reports/SPECIFY_REPORT.md

- `bun run ai-context:validate` → `bun run ai:context:validate` (2x)

### specs/runtime/infra-022-repository-hygiene-verification/reports/CLOSURE_REPORT.md

- `bun run hygiene:report` → `bun run dev:hygiene:report` (3x)

### specs/runtime/infra-022-repository-hygiene-verification/reports/TASKS_REPORT.md

- `bun run hygiene:report` → `bun run dev:hygiene:report` (1x)

### specs/runtime/infra-022-repository-hygiene-verification/reports/IMPLEMENT_REPORT.md

- `bun run hygiene:report` → `bun run dev:hygiene:report` (1x)

### specs/runtime/infra-023-local-ci-simulation-with-act/tasks.md

- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (2x)

### specs/runtime/infra-023-local-ci-simulation-with-act/plan.md

- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (3x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (1x)
- `bun run generate-script-docs` → `bun run dev:generate:script-docs` (1x)

### specs/runtime/infra-023-local-ci-simulation-with-act/reports/IMPLEMENT_REPORT.md

- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (1x)

### specs/runtime/infra-002-audit-checklist/audits/VALIDATION_REPORT.md

- `bun run tsc` → `bun run typecheck:src` (3x)

### specs/runtime/infra-002-audit-checklist/quickstart.md

- `bun run tsc` → `bun run typecheck:src` (1x)

### specs/runtime/infra-002-audit-checklist/tasks.md

- `bun run tsc` → `bun run typecheck:src` (2x)

### specs/runtime/infra-002-audit-checklist/research.md

- `bun run tsc` → `bun run typecheck:src` (1x)

### specs/runtime/infra-002-audit-checklist/guides/TESTING_GUIDE.md

- `bun run tsc` → `bun run typecheck:src` (2x)

### specs/runtime/infra-002-audit-checklist/plan.md

- `bun run tsc` → `bun run typecheck:src` (2x)

### specs/runtime/infra-002-audit-checklist/spec.md

- `bun run tsc` → `bun run typecheck:src` (3x)

### specs/runtime/infra-002-audit-checklist/reports/IMPLEMENT_REPORT.md

- `bun run tsc` → `bun run typecheck:src` (1x)

### specs/runtime/infra-002-audit-checklist/reports/GAP_REPORT.md

- `bun run tsc` → `bun run typecheck:src` (1x)

### specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/runtime-script-validation.md

- `bun run maintenance:cache-clean` → `bun run infra:cache:clean` (1x)

### specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json

- `bun run maintenance:cache-clean` → `bun run infra:cache:clean` (1x)

### specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/VALIDATION_REPORT.md

- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (2x)

### specs/runtime/fix-01-runtime-script-recovery-and-validation/tasks.md

- `bun run db:pool-status` → `bun run db:status:pool` (1x)
- `bun run db:validate-licenses` → `bun run db:validate:licenses` (1x)
- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (3x)
- `bun run generate-script-docs` → `bun run dev:generate:script-docs` (3x)
- `bun run seed-dashboard-test-data` → `bun run dev:seed:dashboard-test-data` (1x)
- `bun run maintenance:cache-clean` → `bun run infra:cache:clean` (1x)

### specs/runtime/fix-01-runtime-script-recovery-and-validation/guides/TESTING_GUIDE.md

- `bun run db:pool-status` → `bun run db:status:pool` (4x)
- `bun run db:validate-licenses` → `bun run db:validate:licenses` (2x)
- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (4x)
- `bun run generate-script-docs` → `bun run dev:generate:script-docs` (2x)
- `bun run seed-dashboard-test-data` → `bun run dev:seed:dashboard-test-data` (1x)
- `bun run maintenance:cache-clean` → `bun run infra:cache:clean` (2x)

### specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md

- `bun run db:pool-status` → `bun run db:status:pool` (1x)
- `bun run ai-context:generate` → `bun run ai:context:generate` (3x)
- `bun run ai-context:validate` → `bun run ai:context:validate` (2x)

### specs/runtime/fix-01-runtime-script-recovery-and-validation/spec.md

- `bun run db:pool-status` → `bun run db:status:pool` (2x)
- `bun run db:validate-licenses` → `bun run db:validate:licenses` (2x)
- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (3x)
- `bun run generate-script-docs` → `bun run dev:generate:script-docs` (1x)
- `bun run seed-dashboard-test-data` → `bun run dev:seed:dashboard-test-data` (1x)

### specs/runtime/fix-01-runtime-script-recovery-and-validation/PR_SUMMARY.md

- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (2x)

### specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md

- `bun run db:pool-status` → `bun run db:status:pool` (1x)
- `bun run db:validate-licenses` → `bun run db:validate:licenses` (1x)
- `bun run arch:validate-brain` → `bun run arch:validate:brain` (1x)
- `bun run ai-context:generate` → `bun run ai:context:generate` (1x)
- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run ai-context:validate` → `bun run ai:context:validate` (1x)
- `bun run ai-context:status` → `bun run ai:context:status` (1x)
- `bun run ai-runtime:status` → `bun run ai:runtime:status` (1x)
- `bun run ai-runtime:refresh` → `bun run ai:runtime:refresh` (1x)
- `bun run ai-runtime:validate` → `bun run ai:runtime:validate` (1x)
- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (1x)
- `bun run ai-guard` → `bun run ai:guard` (1x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (1x)
- `bun run generate-script-docs` → `bun run dev:generate:script-docs` (1x)
- `bun run seed-dashboard-test-data` → `bun run dev:seed:dashboard-test-data` (1x)
- `bun run run-staging-smoke-tests` → `bun run ci:smoke:staging` (1x)
- `bun run hygiene:report` → `bun run dev:hygiene:report` (1x)
- `bun run maintenance:cache-clean` → `bun run infra:cache:clean` (1x)
- `bun run check:tsconfig` → `bun run validate:tsconfig` (1x)
- `bun run check:store-cycles` → `bun run arch:check:store-cycles` (1x)
- `bun run infra-audit:check` → `bun run arch:audit:check` (1x)
- `bun run generate:ai-context` → `bun run ai:context:generate` (1x)
- `bun run infra-audit` → `bun run arch:audit` (1x)
- `bun run migrate` → `bun run db:migrate` (1x)
- `bun run validate:architecture` → `bun run arch:audit` (1x)
- `bun run type-coverage` → `bun run validate:types` (1x)
- `bun run cache-clean` → `bun run infra:cache:clean` (1x)
- `bun run biome` → `bun run lint` (1x)
- `bun run tsc` → `bun run typecheck:src` (1x)
- `bun run vitest` → `bun run test` (1x)
- `bun run worker` → `bun run dev:worker` (1x)

### specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/IMPLEMENT_REPORT.md

- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (1x)
- `bun run generate-script-docs` → `bun run dev:generate:script-docs` (1x)
- `bun run maintenance:cache-clean` → `bun run infra:cache:clean` (1x)

### specs/runtime/infra-012-typescript-type-safety-governance/quickstart.md

- `bun run cache-clean` → `bun run infra:cache:clean` (1x)

### specs/runtime/infra-012-typescript-type-safety-governance/plan.md

- `bun run type-coverage` → `bun run validate:types` (1x)

### specs/runtime/infra-19-ai-agent-runtime-environment/audits/VALIDATION_REPORT.md

- `bun run ai-runtime:status` → `bun run ai:runtime:status` (1x)

### specs/runtime/infra-19-ai-agent-runtime-environment/guides/TESTING_GUIDE.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (4x)
- `bun run ai-runtime:status` → `bun run ai:runtime:status` (1x)

### specs/runtime/infra-19-ai-agent-runtime-environment/plan.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)

### specs/runtime/infra-19-ai-agent-runtime-environment/PR_SUMMARY.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (2x)
- `bun run ai-runtime:status` → `bun run ai:runtime:status` (1x)

### specs/runtime/infra-19-ai-agent-runtime-environment/reports/CLOSURE_REPORT.md

- `bun run ai-runtime:status` → `bun run ai:runtime:status` (1x)

### specs/runtime/infra-19-ai-agent-runtime-environment/reports/IMPLEMENT_REPORT.md

- `bun run ai-runtime:status` → `bun run ai:runtime:status` (1x)

### specs/runtime/infra-015-autonomous-architecture-health/contracts/architecture-health-cli-contract.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)

### specs/runtime/infra-015-autonomous-architecture-health/quickstart.md

- `bun run arch:validate-brain` → `bun run arch:validate:brain` (2x)
- `bun run ai-context:refresh` → `bun run ai:context:refresh` (2x)

### specs/runtime/infra-015-autonomous-architecture-health/tasks.md

- `bun run arch:validate-brain` → `bun run arch:validate:brain` (1x)

### specs/runtime/infra-015-autonomous-architecture-health/guides/TESTING_GUIDE.md

- `bun run arch:validate-brain` → `bun run arch:validate:brain` (1x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (1x)

### specs/runtime/infra-015-autonomous-architecture-health/plan.md

- `bun run arch:validate-brain` → `bun run arch:validate:brain` (2x)
- `bun run ai-context:refresh` → `bun run ai:context:refresh` (2x)

### specs/runtime/ui-03-router-and-guards/tasks.md

- `bun run tsc` → `bun run typecheck:src` (3x)

### specs/runtime/ui-03-router-and-guards/reports/IMPLEMENT_REPORT.md

- `bun run tsc` → `bun run typecheck:src` (1x)

### specs/runtime/infra-020-ai-execution-orchestration-engine/plan.md

- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (1x)

### specs/runtime/infra-008-architecture-visualization/audits/VALIDATION_REPORT.md

- `bun run vitest` → `bun run test` (2x)

### specs/runtime/infra-008-architecture-visualization/guides/TESTING_GUIDE.md

- `bun run vitest` → `bun run test` (4x)

### specs/runtime/infra-008-architecture-visualization/PR_SUMMARY.md

- `bun run vitest` → `bun run test` (2x)

### specs/runtime/002B-tenant-baseline-schema/quickstart.md

- `bun run worker` → `bun run dev:worker` (1x)

### specs/runtime/ui-09-security-and-token-handling/audits/VALIDATION_REPORT.md

- `bun run vitest` → `bun run test` (3x)

### specs/runtime/ui-09-security-and-token-handling/guides/TESTING_GUIDE.md

- `bun run vitest` → `bun run test` (14x)

### specs/runtime/ui-09-security-and-token-handling/PR_SUMMARY.md

- `bun run run-staging-smoke-tests` → `bun run ci:smoke:staging` (1x)

### specs/runtime/ui-09-security-and-token-handling/reports/CLOSURE_REPORT.md

- `bun run vitest` → `bun run test` (1x)

### specs/runtime/ui-06-state-management/guides/TESTING_GUIDE.md

- `bun run check:store-cycles` → `bun run arch:check:store-cycles` (1x)

### specs/runtime/infra-025-script-system-standardization-and-governance/research.md

- `bun run db:pool-status` → `bun run db:status:pool` (1x)
- `bun run ai-context:generate` → `bun run ai:context:generate` (2x)
- `bun run maintenance:cache-clean` → `bun run infra:cache:clean` (1x)

### specs/runtime/infra-025-script-system-standardization-and-governance/plan.md

- `bun run db:pool-status` → `bun run db:status:pool` (1x)

### specs/runtime/017-tenant-bootstrap/audits/VALIDATION_REPORT.md

- `bun run vitest` → `bun run test` (1x)

### specs/runtime/infra-006-architecture-guard/audits/VALIDATION_REPORT.md

- `bun run vitest` → `bun run test` (2x)

### specs/runtime/infra-006-architecture-guard/guides/TESTING_GUIDE.md

- `bun run vitest` → `bun run test` (6x)

### specs/runtime/infra-006-architecture-guard/PR_SUMMARY.md

- `bun run vitest` → `bun run test` (1x)

### specs/runtime/023-departments/guides/TESTING_GUIDE.md

- `bun run seed-dashboard-test-data` → `bun run dev:seed:dashboard-test-data` (1x)

### specs/runtime/027-semesters/audits/VALIDATION_REPORT.md

- `bun run vitest` → `bun run test` (4x)

### specs/runtime/027-semesters/guides/TESTING_GUIDE.md

- `bun run vitest` → `bun run test` (4x)

### specs/runtime/027-semesters/PR_SUMMARY.md

- `bun run vitest` → `bun run test` (2x)

### specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/audits/VALIDATION_REPORT.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (2x)

### specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/quickstart.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (1x)

### specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/tasks.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (1x)

### specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/plan.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (2x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (2x)

### specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/spec.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (3x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (2x)

### specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_REPORT.md

- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (1x)

### specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_22_REPOSITORY_HYGIENE_VERIFICATION.md

- `bun run ai-context:validate` → `bun run ai:context:validate` (1x)

### specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_25_SCRIPT_SYSTEM_STANDARDIZATION_AND_GOVERNANCE.md

- `bun run generate-script-docs` → `bun run dev:generate:script-docs` (1x)

### specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (2x)

### specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_24_GITNEXUS_CONTEXT_INTEGRATION_AND_AGENT_ENABLEMENT.md

- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (1x)

### specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_06_ARCHITECTURE_GUARD.md

- `bun run ai-guard` → `bun run ai:guard` (1x)

### specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION.md

- `bun run infra-audit` → `bun run arch:audit` (1x)

### specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION.md

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run type-safety-guard` → `bun run arch:type-safety-guard` (1x)

### specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_07_MODULE_BOUNDARIES.md

- `bun run ai-guard` → `bun run ai:guard` (1x)

### specs/phases/0X_FIXES/STAGE_FIX_01_RUNTIME_SCRIPT_RECOVERY_AND_VALIDATION.md

- `bun run db:pool-status` → `bun run db:status:pool` (1x)
- `bun run db:validate-licenses` → `bun run db:validate:licenses` (1x)
- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (2x)
- `bun run generate-script-docs` → `bun run dev:generate:script-docs` (2x)
- `bun run seed-dashboard-test-data` → `bun run dev:seed:dashboard-test-data` (1x)

### .agents/agents/zidney-orchestrator.agent.md

- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (1x)
- `bun run gitnexus:context` → `bun run arch:gitnexus:context` (2x)
- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (2x)

### docs/database/LICENSES_MIGRATION_GUIDE.md

- `bun run migrate` → `bun run db:migrate` (3x)

### docs/ci/gitnexus-validation.md

- `bun run gitnexus:context` → `bun run arch:gitnexus:context` (7x)
- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (2x)

### docs/operations/LICENSES_OPERATIONAL_RUNBOOK.md

- `bun run migrate` → `bun run db:migrate` (3x)

### docs/architecture/health/history/health-2026-03-12T22-54-01-012Z.json

- `bun run arch:validate-brain` → `bun run arch:validate:brain` (1x)

### docs/architecture/health/history/health-2026-03-20T21-25-38-263Z.json

- `bun run arch:validate-brain` → `bun run arch:validate:brain` (1x)

### docs/architecture/health/history/health-2026-03-20T21-25-56-943Z.json

- `bun run arch:validate-brain` → `bun run arch:validate:brain` (1x)

### docs/architecture/health/history/health-2026-03-15T23-26-58-848Z.json

- `bun run arch:validate-brain` → `bun run arch:validate:brain` (1x)

### docs/architecture/health/architecture-health.json

- `bun run arch:validate-brain` → `bun run arch:validate:brain` (1x)

### docs/ai/context/schemas/README.md

- `bun run generate:ai-context` → `bun run ai:context:generate` (1x)

### docs/ai/context/README.md

- `bun run generate:ai-context` → `bun run ai:context:generate` (11x)

### docs/ai/context/REFRESH_GUIDE.md

- `bun run generate:ai-context` → `bun run ai:context:generate` (23x)

### docs/ai/gitnexus.md

- `bun run gitnexus:context` → `bun run arch:gitnexus:context` (7x)
- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (2x)

### docs/scripts/generate-script-docs.md

- `bun run generate-script-docs` → `bun run dev:generate:script-docs` (2x)

### docs/scripts/gitnexus-context.md

- `bun run gitnexus:context` → `bun run arch:gitnexus:context` (5x)

### docs/scripts/db-pool-status.md

- `bun run db:pool-status` → `bun run db:status:pool` (3x)

### docs/scripts/maintenance-cache-clean.md

- `bun run maintenance:cache-clean` → `bun run infra:cache:clean` (2x)

### docs/scripts/validate-gitnexus.md

- `bun run gitnexus:context` → `bun run arch:gitnexus:context` (6x)
- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (1x)

### docs/scripts/README.md

- `bun run generate-script-docs` → `bun run dev:generate:script-docs` (1x)

### docs/scripts/validate-ai-context-schemas.md

- `bun run ai-context:generate` → `bun run ai:context:generate` (2x)

### docs/scripts/gitnexus-validate.md

- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (2x)

### docs/scripts/validate-ai-context-fresh.md

- `bun run ai-context:generate` → `bun run ai:context:generate` (1x)
- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)

### docs/scripts/db-validate-licenses.md

- `bun run db:validate-licenses` → `bun run db:validate:licenses` (2x)
- `bun run seed-dashboard-test-data` → `bun run dev:seed:dashboard-test-data` (1x)

### docs/scripts/validate-runtime-scripts.md

- `bun run validate-runtime-scripts` → `bun run validate:scripts:runtime` (2x)

### docs/scripts/seed-dashboard-test-data.md

- `bun run seed-dashboard-test-data` → `bun run dev:seed:dashboard-test-data` (2x)

### docs/audit-reports/AI_SYSTEM_AUDIT_REPORT.md

- `bun run gitnexus:context` → `bun run arch:gitnexus:context` (1x)
- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (1x)

### scripts/architecture-health/collectors/validation-governance.ts

- `bun run arch:validate-brain` → `bun run arch:validate:brain` (1x)

### scripts/architecture-health/intelligence-snapshot.ts

- `bun run arch:validate-brain` → `bun run arch:validate:brain` (1x)

### scripts/validate/ai-context-schemas.ts

- `bun run ai-context:generate` → `bun run ai:context:generate` (1x)

### scripts/validate/validate-gitnexus.ts

- `bun run gitnexus:context` → `bun run arch:gitnexus:context` (2x)

### scripts/validate/**tests**/runtime-scripts.test.ts

- `bun run db:pool-status` → `bun run db:status:pool` (2x)

### scripts/validate/ai-context-fresh.ts

- `bun run ai-context:generate` → `bun run ai:context:generate` (1x)
- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)

### scripts/seed/dashboard-test-data.ts

- `bun run seed-dashboard-test-data` → `bun run dev:seed:dashboard-test-data` (1x)

### scripts/dev/**tests**/refactor-scripts.test.ts

- `bun run ai-guard` → `bun run ai:guard` (1x)
- `bun run migrate` → `bun run db:migrate` (4x)

### scripts/dev/hygiene-checks/ai-context-check.ts

- `bun run ai-context:validate` → `bun run ai:context:validate` (1x)

### packages/types/README.md

- `bun run vitest` → `bun run test` (1x)

### packages/logger/README.md

- `bun run vitest` → `bun run test` (1x)

### packages/config/README.md

- `bun run vitest` → `bun run test` (1x)

### packages/redis-utils/README.md

- `bun run vitest` → `bun run test` (1x)

### packages/ui-system/README.md

- `bun run vitest` → `bun run test` (1x)

### packages/api-client/README.md

- `bun run vitest` → `bun run test` (1x)

### packages/domain-core/README.md

- `bun run vitest` → `bun run test` (1x)

### packages/validation/README.md

- `bun run vitest` → `bun run test` (1x)

### .github/workflows/ai-context-validation.yml

- `bun run ai-context:generate` → `bun run ai:context:generate` (2x)
- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run ai-context:validate` → `bun run ai:context:validate` (1x)

### .github/workflows/ci.yml

- `bun run ai-context:refresh` → `bun run ai:context:refresh` (1x)
- `bun run ai-runtime:status` → `bun run ai:runtime:status` (1x)

### AGENTS.md

- `bun run gitnexus:context` → `bun run arch:gitnexus:context` (1x)
- `bun run gitnexus:validate` → `bun run arch:gitnexus:validate` (1x)

### apps/mmc/README.md

- `bun run vitest` → `bun run test` (1x)

### apps/frontoffice/README.md

- `bun run vitest` → `bun run test` (1x)

### apps/backoffice/README.md

- `bun run vitest` → `bun run test` (1x)

### apps/api/README.md

- `bun run vitest` → `bun run test` (1x)

### apps/worker/README.md

- `bun run vitest` → `bun run test` (2x)

## Unresolved References

✅ Unresolved references: 0
