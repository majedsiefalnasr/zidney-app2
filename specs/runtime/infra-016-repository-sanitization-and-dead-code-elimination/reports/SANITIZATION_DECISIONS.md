# Sanitization Decisions

## Decision Rules

- `remove`: only when no unresolved code, governance, execution, evidence, or structural references remain
- `manual_review`: required when duplicate surfaces affect contributor routing, governance tooling, or stage authority
- Ambiguity defaults to retention or manual review

## Current Decisions

| Candidate                                                                                             | Decision        | Rationale                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/.DS_Store`                                                                                      | `remove`        | Finder-noise file in approved root with no repository role.                                                                                      |
| `packages/.DS_Store`                                                                                  | `remove`        | Finder-noise file in approved root with no repository role.                                                                                      |
| `scripts/.DS_Store`                                                                                   | `remove`        | Finder-noise file in approved root with no repository role.                                                                                      |
| `docs/.DS_Store`                                                                                      | `remove`        | Finder-noise file in approved root with no repository role.                                                                                      |
| `.github/agents/*` vs `.agents/agents/speckit.*`                                                      | `manual_review` | Duplicate agent definitions affect contributor routing and update-agent-context behavior.                                                        |
| `.github/prompts/speckit.*` vs `.agents/prompts/speckit.*`                                            | `manual_review` | Duplicate prompt surfaces exist across protected routing roots, and no unused mirror was proven.                                                 |
| `.specify/templates/*` vs `specs/templates/*`                                                         | `manual_review` | Both template systems remain referenced by live governance docs, indexed outputs, or execution scripts.                                          |
| `tsconfig.base.json.backup`                                                                           | `manual_review` | Likely stale, but outside the currently approved cleanup roots.                                                                                  |
| `coverage/.tmp/coverage-*.json`                                                                       | `manual_review` | Generated output is likely removable, but outside current approved cleanup roots and not touched in this batch.                                  |
| `scripts/*` remaining unprotected helpers                                                             | `retain`        | No script candidate reached zero unresolved references after checking CI, docs, package wiring, workflows, and hooks.                            |
| `package.json` non-governance script and dependency cleanup                                           | `manual_review` | E2E and support-script entries are still consumed by CI, app READMEs, tests, and governance plans; dependency pruning would widen scope further. |
| `.agents/skills/*/SKILL.md`                                                                           | `retain`        | Zidney-local skills remain enumerated by the root skill registry and were not proven inactive.                                                   |
| `apps/*` and `packages/*`                                                                             | `retain`        | Architecture audit outputs still show active module membership and dependencies for all current modules.                                         |
| `docs/type-safety/AI_GOVERNANCE_HANDBOOK.md` vs `docs/01_ENGINEERING_GOVERNANCE/06_AI_AGENT_RULES.md` | `manual_review` | Overlapping AI governance guidance exists, but the handbook still has live links and the rules file remains governance-indexed.                  |

## Reclassification Outcome

- No applied cleanup batch failed validation, so `B01-finder-noise` remains accepted.
- All remaining higher-risk cleanup ideas were reclassified to `retain` or `manual_review` rather than forcing a second cleanup batch or widening this stage into root-level support-surface cleanup.
