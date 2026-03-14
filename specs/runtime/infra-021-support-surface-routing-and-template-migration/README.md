# STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION

**Branch:** `spec/infra-021-support-surface-routing-and-template-migration`
**Phase:** 01_PLATFORM_FOUNDATION
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION.md`
**Initiated:** 2026-03-14T11:04:59Z

## Workflow Progress

| Step      | Status    | SpecKit Output              | Orchestrator Output         |
| --------- | --------- | --------------------------- | --------------------------- |
| Pre-Step  | ✅        | -                           | -                           |
| Specify   | ✅        | spec.md, checklists/        | reports/SPECIFY_REPORT.md   |
| Clarify   | ✅        | spec.md (updated in-place)  | reports/CLARIFY_REPORT.md   |
| Plan      | ✅        | plan.md, research.md, etc.  | reports/PLAN_REPORT.md      |
| Tasks     | ✅        | tasks.md                    | reports/TASKS_REPORT.md     |
| Analyze   | ✅ Passed | (read-only analysis)        | audits/ANALYZE_REPORT.md    |
| Implement | ✅        | tasks.md (tasks marked [X]) | audits/VALIDATION_REPORT.md |
| Closure   | ⬜        | -                           | reports/CLOSURE_REPORT.md   |

## INFRA-21 Authority Set

Implementation for this stage must consult the following artifacts before any routing, template,
compatibility, retirement, or cleanup change is accepted:

- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md`
- `reports/routing-authority-decisions.md`
- `reports/support-surface-inventory.md`
- `reports/blast-radius-evidence.md`
- `reports/template-consumer-parity-matrix.md`
- `audits/migration-batches.md`
- `audits/VALIDATION_REPORT.md`

## Stage Artifacts

| Artifact          | Owner        | Path                                                                                        | Generated At                                                                                                       |
| ----------------- | ------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Specify Report    | Orchestrator | reports/SPECIFY_REPORT.md                                                                   | Step 1                                                                                                             |
| Clarify Report    | Orchestrator | reports/CLARIFY_REPORT.md                                                                   | Step 2                                                                                                             |
| Plan Report       | Orchestrator | reports/PLAN_REPORT.md                                                                      | Step 3                                                                                                             |
| Tasks Report      | Orchestrator | reports/TASKS_REPORT.md                                                                     | Step 4                                                                                                             |
| Routing Decisions | Stage        | reports/routing-authority-decisions.md                                                      | User Story 1                                                                                                       |
| Support Decisions | Stage        | reports/support-artifact-decisions.md                                                       | User Story 2                                                                                                       |
| PR Summary        | Orchestrator | PR_SUMMARY.md                                                                               | Step 7                                                                                                             |
| Testing Guide     | Orchestrator | guides/TESTING_GUIDE.md                                                                     | Step 7                                                                                                             |
| Analyze Report    | Orchestrator | audits/ANALYZE_REPORT.md                                                                    | Step 5                                                                                                             |
| Validation Report | Stage        | audits/VALIDATION_REPORT.md                                                                 | Setup, authority/parity batches, User Story 3 rewiring/hardening, retirement batches, and post-cleanup final state |
| Inventory Report  | Stage        | reports/support-surface-inventory.md                                                        | Setup / Foundational                                                                                               |
| Blast Radius      | Stage        | reports/blast-radius-evidence.md                                                            | Setup / Foundational                                                                                               |
| Parity Matrix     | Stage        | reports/template-consumer-parity-matrix.md                                                  | Setup / Foundational                                                                                               |
| Migration Batches | Stage        | audits/migration-batches.md                                                                 | Foundational                                                                                                       |
| Spec Checklist    | SpecKit      | checklists/requirements.md                                                                  | Step 1                                                                                                             |
| Workflow State    | Orchestrator | specs/runtime/infra-021-support-surface-routing-and-template-migration/.workflow-state.json | Pre-Step                                                                                                           |
