# Sanitization Inventory

## Scope Baseline

| Surface              | Current Baseline                                                                                                         | Notes                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `apps/`              | `api/`, `backoffice/`, `frontoffice/`, `mmc/`, `worker/`                                                                 | Root contains Finder-noise candidate `.DS_Store`.                                                    |
| `packages/`          | `api-client/`, `config/`, `domain-core/`, `job-queue/`, `logger/`, `redis-utils/`, `types/`, `ui-system/`, `validation/` | Root contains Finder-noise candidate `.DS_Store`.                                                    |
| `scripts/`           | Governance scripts, deployment helpers, test env helpers, AI-context tooling                                             | Root contains Finder-noise candidate `.DS_Store`; multiple governance scripts are protected.         |
| `docs/`              | Governance, ops, API, worker, type-safety, monitoring, security, reports                                                 | Root contains Finder-noise candidate `.DS_Store`; `docs/ai/` and `docs/architecture/` are protected. |
| `.agents/skills/`    | 18 skill directories plus design and CI helper skills                                                                    | Inventory-only in this batch.                                                                        |
| `.github/workflows/` | `ai-context-validation.yml`, `architecture-governance.yml`, `ci-type-safety.yml`, `ci.yml`, `hard-mode-guard.yml`        | Protected governance workflow surface.                                                               |
| `.husky/`            | `pre-commit`, `pre-push`, `_`                                                                                            | Protected hook surface.                                                                              |
| `package.json`       | Governance, validation, build, and test script wiring                                                                    | Governance script wiring is protected.                                                               |

## Candidate Register

| Path                                                                                                  | Surface                                      | Classification  | Status  | Evidence Summary                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/.DS_Store`                                                                                      | `apps/`                                      | `remove`        | Applied | Finder-noise file at approved root; no repository references found.                                                                                                   |
| `packages/.DS_Store`                                                                                  | `packages/`                                  | `remove`        | Applied | Finder-noise file at approved root; no repository references found.                                                                                                   |
| `scripts/.DS_Store`                                                                                   | `scripts/`                                   | `remove`        | Applied | Finder-noise file at approved root; no repository references found.                                                                                                   |
| `docs/.DS_Store`                                                                                      | `docs/`                                      | `remove`        | Applied | Finder-noise file at docs root; no documentation or workflow references found.                                                                                        |
| `scripts/*` remaining unprotected helpers                                                             | `scripts/`                                   | `retain`        | Closed  | Package wiring, workflow validation, and hook support paths did not leave any zero-reference script candidate.                                                        |
| `package.json` non-governance script and dependency cleanup                                           | `package.json`                               | `manual_review` | Open    | No dependency-prune or script-prune batch was proven safe without a deeper per-entry blast-radius audit.                                                              |
| `apps/*` and `packages/*`                                                                             | `apps/`, `packages/`                         | `retain`        | Closed  | Current architecture audit outputs still list every app and package module in the active dependency graph.                                                            |
| `.agents/skills/*/SKILL.md`                                                                           | `.agents/skills/`                            | `retain`        | Closed  | Zidney-local skill files remain referenced by the root agent skill registry and were not proven inactive.                                                             |
| `.github/agents/*` vs `.agents/agents/speckit.*`                                                      | Governance-adjacent prompt and agent surface | `manual_review` | Open    | Duplicate Speckit agent definitions exist, but `.specify/scripts/bash/update-agent-context.sh` references `.github/agents/`; contributor-routing implications remain. |
| `.github/prompts/speckit.*` vs `.agents/prompts/speckit.*`                                            | Governance-adjacent prompt surface           | `manual_review` | Open    | Duplicate Speckit prompts exist across legacy and active agent surfaces; tool compatibility must be preserved.                                                        |
| `.specify/templates/*` vs `specs/templates/*`                                                         | Template surface                             | `manual_review` | Open    | `.specify/scripts/bash/*` still references `.specify/templates/*`, while governance docs point to `specs/templates/*`.                                                |
| `docs/type-safety/AI_GOVERNANCE_HANDBOOK.md` vs `docs/01_ENGINEERING_GOVERNANCE/06_AI_AGENT_RULES.md` | Unprotected documentation surface            | `manual_review` | Open    | Governance-handbook overlap exists, but no safe merge path was proven in this stage.                                                                                  |
| `tsconfig.base.json.backup`                                                                           | Root support surface                         | `manual_review` | Open    | Likely stale backup file, but outside the current governed cleanup roots; no references found yet.                                                                    |
| `coverage/.tmp/coverage-*.json`                                                                       | Generated output surface                     | `manual_review` | Open    | Looks like committed coverage temp output; outside current governed cleanup roots and requires explicit follow-up decision.                                           |

## Applied Removals

| Batch              | Path                 | Reason                              |
| ------------------ | -------------------- | ----------------------------------- |
| `B01-finder-noise` | `apps/.DS_Store`     | Finder-noise file in approved root. |
| `B01-finder-noise` | `packages/.DS_Store` | Finder-noise file in approved root. |
| `B01-finder-noise` | `scripts/.DS_Store`  | Finder-noise file in approved root. |
| `B01-finder-noise` | `docs/.DS_Store`     | Finder-noise file in approved root. |

## Final Inventory Status

- Applied cleanup remains limited to the approved Finder-noise batch.
- All remaining in-scope surfaces were either retained based on active evidence or held in `manual_review` because a safe deletion or consolidation path was not proven.
