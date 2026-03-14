# Support Artifact Decisions

Captured: 2026-03-14
Stage: STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION

## Final Decisions

| Artifact                        | Evidence Summary                                                                                                              | Preparatory Policy Hardening                                                                                                 | Final Action                            | Cleanup Status |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------- |
| `coverage/.tmp/coverage-*.json` | temp coverage fragments present under `coverage/.tmp/`; no live repository consumer found; INFRA-16 deferred explicit cleanup | `.gitignore` and `docs/TESTING.md` now explicitly document `coverage/.tmp/` as regenerated output that must not be committed | authorized for removal in cleanup batch | removed        |
| `tsconfig.base.json.backup`     | no live repository text reference found; INFRA-16 deferred manual review only                                                 | none required beyond documenting the decision and confirming package.json contains no dependency                             | authorized for removal in cleanup batch | removed        |

## Artifact Cleanup Guardrails

- Cleanup was limited to artifacts already authorized by the routing registry and migration batch ledger.
- Compatibility surfaces `.github/*` and `.specify/templates/*` were not cleaned up because their retirement criteria remain unsatisfied.
- Post-cleanup validation is required to prove the final repository state, not just the pre-cleanup state.
