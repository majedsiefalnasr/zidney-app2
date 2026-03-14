# Plan Report — STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION

**Step:** 3 — Plan  
**Timestamp:** 2026-03-14T12:20:00Z  
**Status:** COMPLETE

---

## Summary

The technical plan stays inside repository-governance scope and defines a compatibility-preserving migration for support-surface routing and template authority. The final design creates a routing authority registry, introduces explicit support-surface dispositions, adds a file-level template consumer map, and sequences authority declaration, parity gating, consumer rewiring, compatibility hardening, and retirement decisions without changing runtime, tenant, or module-boundary behavior.

---

## Inputs Reviewed

- `specs/runtime/infra-021-support-surface-routing-and-template-migration/spec.md`
- `specs/runtime/infra-021-support-surface-routing-and-template-migration/plan.md`
- `specs/runtime/infra-021-support-surface-routing-and-template-migration/research.md`
- `specs/runtime/infra-021-support-surface-routing-and-template-migration/data-model.md`
- `specs/runtime/infra-021-support-surface-routing-and-template-migration/contracts/`
- `specs/runtime/infra-021-support-surface-routing-and-template-migration/quickstart.md`

---

## Architecture Layers Touched

| Layer                 | Planned Changes                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------- |
| API                   | None                                                                                          |
| Worker                | None                                                                                          |
| Frontend              | None                                                                                          |
| DB Master             | None                                                                                          |
| DB Tenant             | None                                                                                          |
| Repository Governance | Routing authority registry, consumer mapping, compatibility sequencing, and validation policy |

---

## Key Technical Decisions

| #   | Decision                                                                                                                       | Rationale                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | Keep `.agents/agents/`, `.agents/prompts/`, and `specs/templates/` as the only authoritative routing roots                     | Removes routing ambiguity while preserving the clarified stage scope                                       |
| 2   | Require a file-level Direct Consumer Map and template parity gate before rewiring or retiring `.specify/templates/*` consumers | Prevents breaking live Speckit shell scripts and agent guidance that still depend on legacy template paths |
| 3   | Sequence work as authority declaration, consumer rewiring, template parity, compatibility hardening, and retirement decision   | Preserves same-batch migration safety and prevents silent divergence                                       |
| 4   | Treat `.github/*` and `.specify/templates/*` as explicit compatibility surfaces until retirement criteria are met              | Keeps contributor and automation workflows intact while migration proceeds                                 |

---

## Migration Impact

| Item                  | Value | Notes                                                                                 |
| --------------------- | ----- | ------------------------------------------------------------------------------------- |
| Migration required    | Yes   | Repository routing and template authority migration is the core purpose of the stage  |
| `schema_version` bump | No    | No database or tenant schema changes are planned                                      |
| Backward compatible   | Yes   | Compatibility surfaces remain in place until parity, rewiring, and validation succeed |

---

## Transaction Boundaries

- No database write transactions are introduced; all planned changes are repository-file mutations grouped into reversible migration batches.
- Each migration batch is constrained by preconditions, validation scope, and rollback rules in `contracts/migration-batch-contract.md`.

---

## Idempotency Strategy

- Authority declaration and registry publication are documentation-first and can be re-run safely by overwriting governed artifacts.
- Consumer rewiring and compatibility hardening are guarded by explicit file-level mapping and validation, preventing duplicate or conflicting retirement decisions.

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                 |
| -------------------------------------- | ------ | --------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | The plan is filesystem-only and repository-governance scoped          |
| All writes are transactional by design | ✅     | Bounded migration batches define reversible file-change units         |
| Server-authoritative time enforced     | ✅     | No runtime behavior or clock-sensitive workflow is changed            |
| License middleware enforced            | ✅     | No route, middleware, or request handling changes are introduced      |
| Version compatibility enforced         | ✅     | No tenant schema or product-version behavior changes are planned      |
| No architecture redesign without ADR   | ✅     | Both guardians passed after plan hardening; no ADR conflict was found |

**Overall:** COMPLIANT

---

## Open Risks

- `.specify/scripts/bash/create-new-feature.sh`, `.specify/scripts/bash/setup-plan.sh`, and `.specify/scripts/bash/update-agent-context.sh` still consume legacy template paths and must be migrated only after canonical parity exists.
- `.agents/*` and `.github/*` Speckit guidance remain duplicated and must be updated in lockstep while compatibility mirrors stay active.
- `coverage/.tmp/coverage-*.json` and `tsconfig.base.json.backup` still require implementation-time blast-radius evidence before any cleanup decision is applied.

---

## Guardian Validation

- `Zidney Architecture Checker`: PASS after adding direct consumer mapping, canonical parity gates, and contract-level retirement safeguards.
- `Zidney API Designer`: PASS with no runtime/API drift detected.

---

## Next Step

Proceed to Step 4 — Tasks.
