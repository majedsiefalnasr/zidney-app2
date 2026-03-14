# Plan Report — STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION

**Step:** 3 — Plan  
**Timestamp:** 2026-03-13T23:05:25Z  
**Status:** COMPLETE

---

## Summary

The technical plan defines a conservative, evidence-first repository sanitization workflow that inventories all in-scope assets, protects governance-critical files, classifies dead assets with explicit evidence rules, applies cleanup in reversible batches, and validates every meaningful cleanup batch through the existing Zidney governance chain.

---

## Inputs Reviewed

- `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/spec.md`
- `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/plan.md`
- `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/research.md`
- `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/data-model.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes |
| --------- | --------------- |
| API       | None            |
| Worker    | None            |
| Frontend  | None            |
| DB Master | None            |
| DB Tenant | None            |

---

## Key Technical Decisions

| #   | Decision                                                                       | Rationale                                                                                          |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 1   | Use a multi-source repository scan instead of import-only detection            | Scripts, hooks, skills, docs, CI wiring, and governance outputs can be active without code imports |
| 2   | Use an explicit evidence model for dead-asset classification                   | Dead-asset elimination must be auditable and safe across governance and execution paths            |
| 3   | Protect governance-critical assets through a hard allowlist plus derived rules | Low-frequency governance assets must remain safe from accidental deletion                          |
| 4   | Apply cleanup in small reversible batches                                      | Limits blast radius and enables targeted rollback on validation failure                            |

---

## Migration Impact

| Item                  | Value | Notes                                                     |
| --------------------- | ----- | --------------------------------------------------------- |
| Migration required    | No    | Repository-governance stage only; no schema or DB changes |
| `schema_version` bump | No    | No database changes                                       |
| Backward compatible   | Yes   | No runtime API or tenant behavior changes are planned     |

---

## Transaction Boundaries

- No database write operations are introduced in this plan.
- Repository cleanup is organized into reversible file-based batches with validation between batches.

---

## Idempotency Strategy

- The sanitization inventory acts as the decision log so each candidate can be safely re-evaluated without ambiguous repeated cleanup.
- Cleanup batches are designed to be retried only after reverting or reclassifying the failing candidate set.

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                               |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | The plan is filesystem-only and explicitly forbids runtime boundary changes         |
| All writes are transactional by design | ✅     | Cleanup is batched and reversible at the repository level; no database writes occur |
| Server-authoritative time enforced     | ✅     | No attempt or runtime time behavior is touched                                      |
| License middleware enforced            | ✅     | License behavior is unchanged and remains out of scope                              |
| Version compatibility enforced         | ✅     | No versioning or schema compatibility behavior is changed                           |
| No architecture redesign without ADR   | ✅     | The plan is architecture-neutral and does not create new modules or boundaries      |

**Overall:** COMPLIANT

---

## Open Risks

- False-positive dead-asset detection remains the main implementation risk; the evidence model and protected-asset rules are designed to catch that before deletion.
- The planning agent refreshed `.github/agents/copilot-instructions.md`; that incidental change needs scope review before implementation proceeds.

---

## Next Step

Proceed to Step 4 — Tasks.
