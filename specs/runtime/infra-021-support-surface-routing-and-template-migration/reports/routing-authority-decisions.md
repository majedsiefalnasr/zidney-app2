# Routing Authority Decisions

Captured: 2026-03-14
Stage: STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION

## Final Dispositions

| Surface                                             | Authority Status                        | Disposition                  | Rationale                                                                                        | Retirement State |
| --------------------------------------------------- | --------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ | ---------------- |
| `.agents/agents/`                                   | authoritative                           | `retain`                     | canonical agent root with the full Zidney-local agent surface                                    | not applicable   |
| `.github/agents/`                                   | non-authoritative compatibility surface | `mirror_for_compatibility`   | still required for generated Copilot instructions and Speckit compatibility guidance             | deferred         |
| `.agents/prompts/`                                  | authoritative                           | `retain`                     | canonical prompt root with the full Zidney-local prompt surface                                  | not applicable   |
| `.github/prompts/`                                  | non-authoritative compatibility surface | `mirror_for_compatibility`   | compatibility mirror for the overlapping Speckit prompt subset only                              | deferred         |
| `specs/templates/`                                  | authoritative                           | `retain`                     | canonical template root for governance and contributor-facing workflows                          | not applicable   |
| `.specify/templates/`                               | non-authoritative compatibility surface | `mirror_for_compatibility`   | legacy compatibility tree retained after first-party rewiring; external retirement remains gated | deferred         |
| `.specify/scripts/bash/`                            | consumer surface                        | `migrate`                    | shell entrypoints must resolve canonical template inputs from `specs/templates/`                 | completed        |
| `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`         | governance consultation point           | `retain` with minimal update | authoritative Hard Mode guide must point to the registry and same-batch migration rules          | completed        |
| `specs/templates/audits/analyze-report-template.md` | governance consultation point           | `retain` with minimal update | analyze gate must verify routing authority, parity, prompt sync, and validation cadence          | completed        |
| `scripts/infra-audit.ts`                            | governance consultation point           | `retain` with minimal update | infra audit may validate structure but must defer routing authority decisions to the registry    | completed        |
| `scripts/architecture-diff.ts`                      | governance consultation point           | `retain` with minimal update | architecture diff remains code-focused and must not be treated as routing authority              | completed        |
| `docs/type-safety/`                                 | adjacent protected surface              | `retain`                     | no routing or template consumer behavior found                                                   | no change        |
| `package.json`                                      | support surface                         | `retain`                     | no `tsconfig.base.json.backup` dependency remained to remove                                     | no change        |

## Root Support Artifact Decisions

| Surface                         | Disposition                               | Rationale                                                                                           |
| ------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `tsconfig.base.json.backup`     | `remove`                                  | no live consumer or script reference remained after repository-wide evidence review                 |
| `coverage/.tmp/coverage-*.json` | `remove` after ignore-policy confirmation | generated coverage temp fragments are non-authoritative and now explicitly covered by ignore policy |

## Protected-Surface Notes

- `AGENTS.md`, `docs/PROJECT_CONTEXT_PRIMER.md`, `docs/AGENT_GOVERNANCE.md`, workflow files, and Husky hooks were preserved unchanged.
- No runtime, tenant, license, attempt-engine, or module-boundary design decision was widened or reauthored.
