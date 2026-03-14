# Routing Authority Registry

Captured: 2026-03-14
Authority: STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION

This registry is the single source of truth for support-surface routing decisions across agents,
prompts, and templates. Support-surface cleanup, contributor guidance, and migration tooling must
consult this file before retiring or redefining any routing root.

## Invariants

- Every routing category has exactly one authoritative root.
- Legacy surfaces are non-authoritative and must include explicit compatibility policy.
- A legacy surface cannot retire until all recorded retirement criteria are satisfied.
- Support-surface routing changes must update all touched first-party consumers in the same batch.
- Template consumers cannot be rewired to canonical roots unless file-level parity exists.

## Agents

- Routing Category: `agents`
- Authoritative Root: `.agents/agents/`
- Legacy Compatibility Surfaces: `.github/agents/`
- Consumer Classes: `agent_loaders`, `contributor_docs`, `compatibility_outputs`
- Migration Policy: maintain `.agents/agents/` as the source of truth and mirror only the required
  Speckit compatibility set into `.github/agents/`; preserve `.github/agents/copilot-instructions.md`
  as the generated compatibility output for `update-agent-context.sh`
- Retirement Criteria:
  - `update-agent-context.sh` no longer writes any file beneath `.github/agents/`
  - no contributor guidance or automation consumer depends on `.github/agents/`
  - compatibility mirror removal is validated in the same batch as the final consumer migration
- Validation Evidence:
  - direct path scan of touched `.agents/agents/*` and `.github/agents/*` files
  - shell validation for `.specify/scripts/bash/update-agent-context.sh`
  - full governance suite rerun before any removal mutation

### Direct Consumer Map

| Consumer                                        | Canonical Source                                                  | Compatibility Surface                          | Policy                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| `.agents/agents/speckit.specify.agent.md`       | `.agents/agents/speckit.specify.agent.md`                         | `.github/agents/speckit.specify.agent.md`      | mirrored compatibility guidance                                 |
| `.agents/agents/speckit.tasks.agent.md`         | `.agents/agents/speckit.tasks.agent.md`                           | `.github/agents/speckit.tasks.agent.md`        | mirrored compatibility guidance                                 |
| `.agents/agents/speckit.checklist.agent.md`     | `.agents/agents/speckit.checklist.agent.md`                       | `.github/agents/speckit.checklist.agent.md`    | mirrored compatibility guidance                                 |
| `.agents/agents/speckit.constitution.agent.md`  | `.agents/agents/speckit.constitution.agent.md`                    | `.github/agents/speckit.constitution.agent.md` | mirrored compatibility guidance                                 |
| `.specify/scripts/bash/update-agent-context.sh` | `specs/templates/agent-file-template.md` feeding generated output | `.github/agents/copilot-instructions.md`       | compatibility output retained until downstream tooling migrates |

## Prompts

- Routing Category: `prompts`
- Authoritative Root: `.agents/prompts/`
- Legacy Compatibility Surfaces: `.github/prompts/`
- Consumer Classes: `prompt_loaders`, `contributor_docs`, `compatibility_mirrors`
- Migration Policy: keep `.agents/prompts/` authoritative; retain `.github/prompts/` only as a
  compatibility mirror of the overlapping Speckit prompt subset; do not mirror Zidney-only prompts
- Retirement Criteria:
  - no downstream tooling or contributor guidance loads `.github/prompts/`
  - all overlapping prompt consumers are migrated in the same batch
  - every intentional legacy-absent prompt remains documented
- Validation Evidence:
  - prompt parity check across overlapping `.agents/prompts/*` and `.github/prompts/*`
  - registry and parity-matrix review of legacy-absent prompts
  - full governance suite rerun before any removal mutation

### Direct Consumer Map

| Legacy Prompt                                     | Authoritative Prompt                              | State    |
| ------------------------------------------------- | ------------------------------------------------- | -------- |
| `.github/prompts/speckit.analyze.prompt.md`       | `.agents/prompts/speckit.analyze.prompt.md`       | mirrored |
| `.github/prompts/speckit.checklist.prompt.md`     | `.agents/prompts/speckit.checklist.prompt.md`     | mirrored |
| `.github/prompts/speckit.clarify.prompt.md`       | `.agents/prompts/speckit.clarify.prompt.md`       | mirrored |
| `.github/prompts/speckit.constitution.prompt.md`  | `.agents/prompts/speckit.constitution.prompt.md`  | mirrored |
| `.github/prompts/speckit.implement.prompt.md`     | `.agents/prompts/speckit.implement.prompt.md`     | mirrored |
| `.github/prompts/speckit.plan.prompt.md`          | `.agents/prompts/speckit.plan.prompt.md`          | mirrored |
| `.github/prompts/speckit.specify.prompt.md`       | `.agents/prompts/speckit.specify.prompt.md`       | mirrored |
| `.github/prompts/speckit.tasks.prompt.md`         | `.agents/prompts/speckit.tasks.prompt.md`         | mirrored |
| `.github/prompts/speckit.taskstoissues.prompt.md` | `.agents/prompts/speckit.taskstoissues.prompt.md` | mirrored |

### Intentional Legacy-Absent Prompts

- `.agents/prompts/zidney-api-designer.prompt.md`
- `.agents/prompts/zidney-architecture-checker.prompt.md`
- `.agents/prompts/zidney-cicd-automation.prompt.md`
- `.agents/prompts/zidney-code-reviewer.prompt.md`
- `.agents/prompts/zidney-deployment-engineer.prompt.md`
- `.agents/prompts/zidney-docker-specialist.prompt.md`
- `.agents/prompts/zidney-frontend-developer.prompt.md`
- `.agents/prompts/zidney-orchestrator.prompt.md`
- `.agents/prompts/zidney-performance-optimizer.prompt.md`
- `.agents/prompts/zidney-qa-engineer.prompt.md`
- `.agents/prompts/zidney-refactoring-specialist.prompt.md`
- `.agents/prompts/zidney-security-auditor.prompt.md`

These prompts are `legacy_absent` by design and must not be inferred as mirror drift.

## Templates

- Routing Category: `templates`
- Authoritative Root: `specs/templates/`
- Legacy Compatibility Surfaces: `.specify/templates/`
- Consumer Classes: `shell_scripts`, `agent_guidance`, `governance_docs`, `compatibility_templates`
- Migration Policy: rewire first-party scripts and Speckit guidance to `specs/templates/`; keep
  `.specify/templates/` as a compatibility surface until all remaining consumers are retired
- Retirement Criteria:
  - every known direct consumer resolves `specs/templates/` first
  - no unresolved file-level mapping remains in the parity matrix
  - no contributor or automation surface relies on `.specify/templates/` without explicit fallback
  - full governance suite and direct entrypoint checks pass in the same retirement batch
- Validation Evidence:
  - direct syntax and path-resolution checks for `.specify/scripts/bash/create-new-feature.sh`,
    `.specify/scripts/bash/setup-plan.sh`, and `.specify/scripts/bash/update-agent-context.sh`
  - parity review for `agent-file`, `checklist`, `constitution`, and spec-template mapping
  - T025 smoke evidence after authority, parity, rewiring, hardening, and cleanup batches
  - T026 full governance reruns after rewiring/hardening, before cleanup, and after cleanup

### Direct Consumer Map

| Consumer                                        | Legacy Dependency                                               | Canonical Target                                                | Policy                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `.specify/scripts/bash/create-new-feature.sh`   | `.specify/templates/spec-template.md`                           | `specs/templates/specify-template.md`                           | canonical first, legacy fallback                                                            |
| `.specify/scripts/bash/setup-plan.sh`           | `.specify/templates/plan-template.md`                           | `specs/templates/plan-template.md`                              | canonical first, legacy fallback                                                            |
| `.specify/scripts/bash/update-agent-context.sh` | `.specify/templates/agent-file-template.md`                     | `specs/templates/agent-file-template.md`                        | canonical first, legacy fallback                                                            |
| `.agents/agents/speckit.specify.agent.md`       | `.specify/templates/spec-template.md`                           | `specs/templates/specify-template.md`                           | canonical guidance                                                                          |
| `.github/agents/speckit.specify.agent.md`       | `.specify/templates/spec-template.md`                           | `specs/templates/specify-template.md`                           | mirrored compatibility guidance                                                             |
| `.agents/agents/speckit.tasks.agent.md`         | `.specify/templates/tasks-template.md`                          | `specs/templates/tasks-template.md`                             | canonical guidance                                                                          |
| `.github/agents/speckit.tasks.agent.md`         | `.specify/templates/tasks-template.md`                          | `specs/templates/tasks-template.md`                             | mirrored compatibility guidance                                                             |
| `.agents/agents/speckit.checklist.agent.md`     | `.specify/templates/checklist-template.md`                      | `specs/templates/checklist-template.md`                         | canonical guidance                                                                          |
| `.github/agents/speckit.checklist.agent.md`     | `.specify/templates/checklist-template.md`                      | `specs/templates/checklist-template.md`                         | mirrored compatibility guidance                                                             |
| `.agents/agents/speckit.constitution.agent.md`  | `.specify/templates/{constitution,plan,spec,tasks}-template.md` | `specs/templates/{constitution,plan,specify,tasks}-template.md` | canonical guidance; stale `.specify/templates/commands/*.md` reference removed              |
| `.github/agents/speckit.constitution.agent.md`  | `.specify/templates/{constitution,plan,spec,tasks}-template.md` | `specs/templates/{constitution,plan,specify,tasks}-template.md` | mirrored compatibility guidance; stale `.specify/templates/commands/*.md` reference removed |

## Consultation Points

The following surfaces must consult this registry before making routing or cleanup decisions:

- `docs/SPEC_KIT_HARD_MODE_WORKFLOW.md`
- `specs/templates/audits/analyze-report-template.md`
- `scripts/infra-audit.ts`
- `scripts/architecture-diff.ts`
- INFRA-21 reports and batch ledgers that authorize cleanup or retirement
