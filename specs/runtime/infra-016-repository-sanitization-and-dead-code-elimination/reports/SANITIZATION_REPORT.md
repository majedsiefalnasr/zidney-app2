# Sanitization Report

## Outcome Summary

- Applied cleanup: `B01-finder-noise` only.
- Removed assets: `apps/.DS_Store`, `packages/.DS_Store`, `scripts/.DS_Store`, `docs/.DS_Store`.
- Retained assets: all remaining in-scope apps, packages, skills, scripts, protected governance roots, and governance-wired package scripts.
- Deferred assets: routing-sensitive duplicate surfaces, unproven script or dependency cleanup, and out-of-scope support-surface artifacts.

## Completed Work

- Verified that no additional `scripts/` or `package.json` candidate reached the zero-unresolved-reference threshold required for safe deletion.
- Verified that current `apps/` and `packages/` modules remain active in architecture-audit outputs.
- Verified that Zidney-local `.agents/skills/*/SKILL.md` files remain referenced by the root skill registry.
- Grouped duplicate surfaces across agents, prompts, templates, and overlapping AI-governance documentation.
- Finalized rollback sequencing by deferring all unproven follow-on batches rather than forcing risky cleanup.
- Reclassified unresolved cleanup ideas to `retain` or `manual_review` where evidence was insufficient.
- Confirmed no support-surface reference repairs were needed after the Finder-noise batch.

## Blocked Tasks

| Task   | Status  | Exact reason                                                                                                                                                                     |
| ------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `T017` | Blocked | No dead script or dead skill directory was proven to have zero unresolved references across package wiring, workflows, hooks, AGENTS guidance, and contributor-routing surfaces. |
| `T018` | Blocked | No dependency-prune or non-governance script-prune batch in `package.json` was proven safe without a deeper per-entry blast-radius audit.                                        |
| `T023` | Blocked | Not every duplicate group has a safe authoritative survivor; prompt-routing and governance-handbook groups remain unresolved.                                                    |
| `T024` | Blocked | Documentation consolidation would require merging overlapping governance guidance without a proven lossless merge plan.                                                          |
| `T025` | Blocked | Script consolidation would change active bootstrap or validation entry points that remain wired through `package.json`, hooks, or `.specify/scripts/`.                           |
| `T026` | Blocked | Skill-surface consolidation would alter routing-sensitive prompt and agent surfaces still treated as active or protected-adjacent.                                               |

## Deeper Blast-Radius Audit

- `T017` remains blocked. The test-environment scripts are still called from CI, `docs/TESTING.md`, and prior runtime guides, while the deploy and seed scripts are still referenced by deployment quickstarts and dashboard stage artifacts.
- `T018` remains blocked. The current `package.json` E2E script wiring is still consumed by CI, app READMEs, tests, and governance plans, so no script-prune or dependency-prune batch reached a safe zero-reference threshold.
- `T023` remains blocked. No duplicate group reached a state where one survivor was proven authoritative and the alternate path was proven unused.
- `T024` remains blocked. `docs/type-safety/AI_GOVERNANCE_HANDBOOK.md` still has live handbook links, while `docs/01_ENGINEERING_GOVERNANCE/06_AI_AGENT_RULES.md` remains part of governance/intelligence outputs.
- `T025` remains blocked. `.specify/scripts/bash/create-new-feature.sh`, `.specify/scripts/bash/setup-plan.sh`, and `.specify/scripts/bash/update-agent-context.sh` still execute against `.specify/templates/*`, while governance docs still direct operators to `specs/templates/*`.
- `T026` remains blocked. `.github/agents/*`, `.agents/agents/*`, `.github/prompts/*`, and `.agents/prompts/*` are all still populated, and this audit did not prove either tree is a safe legacy mirror.

## Protected And Deferred Assets

- Protected governance assets remain unchanged per `PROTECTED_ASSETS.md`.
- The explicit hard-mode-guard remediation exception contract remains preserved; no new authority-file mutations were introduced.
- Deferred manual-review items are:
  - `.github/agents/*` vs `.agents/agents/speckit.*`
  - `.github/prompts/speckit.*` vs `.agents/prompts/speckit.*`
  - `.specify/templates/*` vs `specs/templates/*`
  - `docs/type-safety/AI_GOVERNANCE_HANDBOOK.md` vs `docs/01_ENGINEERING_GOVERNANCE/06_AI_AGENT_RULES.md`
  - `tsconfig.base.json.backup`
  - `coverage/.tmp/coverage-*.json`
- `tsconfig.base.json.backup` and `coverage/.tmp/coverage-*.json` look removable, but they remain deferred because this stage never widened its approved cleanup roots to include those root-level support artifacts.

## Validation Status

- Validation evidence remains recorded in `audits/VALIDATION_REPORT.md`.
- No additional validation run was required for the documentation-only close-out work.
- Baseline or environment issues remain unchanged:
  - `bun run test` depends on local PostgreSQL endpoints on `5432` and `5433`
  - `bun run type-safety-guard` still fails on the pre-existing `as any` assertion in `packages/ui-system/src/utils/url-sync.ts`

## Quickstart Walkthrough Result

- The quickstart sequence is satisfied through the conservative completion path: inventory built, protected assets applied, one safe cleanup batch executed, validation evidence captured, and all unresolved work explicitly deferred.
- No stale path references in `tests/`, `vitest.workspace.ts`, `vitest.config.ts`, or `lint-staged.config.mjs` required correction after the applied cleanup.

## Recommended Follow-Up Boundary

- Any further repository sanitization should happen in a follow-up stage that explicitly authorizes deeper script, dependency, prompt-routing, template-routing, or support-surface cleanup.
- No additional blocked task can be safely completed inside the current stage boundary without either changing live routing/bootstrap behavior or widening scope beyond the approved cleanup roots.
