# Template Consumer And Prompt Parity Matrix

Captured: 2026-03-14
Stage: STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION

## Template Consumer Map

| Legacy Surface                                 | Consumer                                                                                          | Canonical Target                           | Parity State            | Notes                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------- |
| `.specify/templates/spec-template.md`          | `.specify/scripts/bash/create-new-feature.sh`                                                     | `specs/templates/specify-template.md`      | canonical mapping       | canonical file already existed; script now resolves canonical first and falls back only if needed |
| `.specify/templates/plan-template.md`          | `.specify/scripts/bash/setup-plan.sh`                                                             | `specs/templates/plan-template.md`         | canonical parity        | canonical file already existed                                                                    |
| `.specify/templates/agent-file-template.md`    | `.specify/scripts/bash/update-agent-context.sh`                                                   | `specs/templates/agent-file-template.md`   | parity added            | canonical parity file added in this stage                                                         |
| `.specify/templates/tasks-template.md`         | `.agents/agents/speckit.tasks.agent.md` and `.github/agents/speckit.tasks.agent.md`               | `specs/templates/tasks-template.md`        | canonical parity        | guidance rewired to canonical target                                                              |
| `.specify/templates/checklist-template.md`     | `.agents/agents/speckit.checklist.agent.md` and `.github/agents/speckit.checklist.agent.md`       | `specs/templates/checklist-template.md`    | parity added            | canonical parity file added in this stage                                                         |
| `.specify/templates/constitution-template.md`  | `.agents/agents/speckit.constitution.agent.md` and `.github/agents/speckit.constitution.agent.md` | `specs/templates/constitution-template.md` | parity added            | canonical parity file added in this stage                                                         |
| `.specify/templates/spec-template.md`          | `.agents/agents/speckit.specify.agent.md` and `.github/agents/speckit.specify.agent.md`           | `specs/templates/specify-template.md`      | canonical mapping       | canonical naming remains `specify-template.md`; no second authoritative spec template was created |
| nonexistent `.specify/templates/commands/*.md` | `.agents/agents/speckit.constitution.agent.md` and `.github/agents/speckit.constitution.agent.md` | none                                       | removed stale reference | stale guidance removed instead of inventing parity for a nonexistent tree                         |

## Prompt Compatibility Map

| Legacy Prompt                                     | Authoritative Prompt                              | State    | Notes                          |
| ------------------------------------------------- | ------------------------------------------------- | -------- | ------------------------------ |
| `.github/prompts/speckit.analyze.prompt.md`       | `.agents/prompts/speckit.analyze.prompt.md`       | mirrored | byte-for-byte parity confirmed |
| `.github/prompts/speckit.checklist.prompt.md`     | `.agents/prompts/speckit.checklist.prompt.md`     | mirrored | byte-for-byte parity confirmed |
| `.github/prompts/speckit.clarify.prompt.md`       | `.agents/prompts/speckit.clarify.prompt.md`       | mirrored | byte-for-byte parity confirmed |
| `.github/prompts/speckit.constitution.prompt.md`  | `.agents/prompts/speckit.constitution.prompt.md`  | mirrored | byte-for-byte parity confirmed |
| `.github/prompts/speckit.implement.prompt.md`     | `.agents/prompts/speckit.implement.prompt.md`     | mirrored | byte-for-byte parity confirmed |
| `.github/prompts/speckit.plan.prompt.md`          | `.agents/prompts/speckit.plan.prompt.md`          | mirrored | byte-for-byte parity confirmed |
| `.github/prompts/speckit.specify.prompt.md`       | `.agents/prompts/speckit.specify.prompt.md`       | mirrored | byte-for-byte parity confirmed |
| `.github/prompts/speckit.tasks.prompt.md`         | `.agents/prompts/speckit.tasks.prompt.md`         | mirrored | byte-for-byte parity confirmed |
| `.github/prompts/speckit.taskstoissues.prompt.md` | `.agents/prompts/speckit.taskstoissues.prompt.md` | mirrored | byte-for-byte parity confirmed |

## Intentional Legacy-Absent Prompts

| Authoritative Prompt                                      | Legacy State    | Reason                                                           |
| --------------------------------------------------------- | --------------- | ---------------------------------------------------------------- |
| `.agents/prompts/zidney-api-designer.prompt.md`           | `legacy_absent` | Zidney-only prompt; not part of the Speckit compatibility subset |
| `.agents/prompts/zidney-architecture-checker.prompt.md`   | `legacy_absent` | Zidney-only prompt; not part of the Speckit compatibility subset |
| `.agents/prompts/zidney-cicd-automation.prompt.md`        | `legacy_absent` | Zidney-only prompt; not part of the Speckit compatibility subset |
| `.agents/prompts/zidney-code-reviewer.prompt.md`          | `legacy_absent` | Zidney-only prompt; not part of the Speckit compatibility subset |
| `.agents/prompts/zidney-deployment-engineer.prompt.md`    | `legacy_absent` | Zidney-only prompt; not part of the Speckit compatibility subset |
| `.agents/prompts/zidney-docker-specialist.prompt.md`      | `legacy_absent` | Zidney-only prompt; not part of the Speckit compatibility subset |
| `.agents/prompts/zidney-frontend-developer.prompt.md`     | `legacy_absent` | Zidney-only prompt; not part of the Speckit compatibility subset |
| `.agents/prompts/zidney-orchestrator.prompt.md`           | `legacy_absent` | Zidney-only prompt; not part of the Speckit compatibility subset |
| `.agents/prompts/zidney-performance-optimizer.prompt.md`  | `legacy_absent` | Zidney-only prompt; not part of the Speckit compatibility subset |
| `.agents/prompts/zidney-qa-engineer.prompt.md`            | `legacy_absent` | Zidney-only prompt; not part of the Speckit compatibility subset |
| `.agents/prompts/zidney-refactoring-specialist.prompt.md` | `legacy_absent` | Zidney-only prompt; not part of the Speckit compatibility subset |
| `.agents/prompts/zidney-security-auditor.prompt.md`       | `legacy_absent` | Zidney-only prompt; not part of the Speckit compatibility subset |
