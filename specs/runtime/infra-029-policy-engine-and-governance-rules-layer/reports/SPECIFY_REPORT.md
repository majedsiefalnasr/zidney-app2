# Specify Report — Policy Engine and Governance Rules Layer

**Step:** 1 — Specify
**Timestamp:** 2026-03-25T00:05:00Z
**Status:** COMPLETE

---

## Summary

Specification for INFRA-29 (Policy Engine and Governance Rules Layer) has been fully drafted. The stage introduces a single source of truth for all governance rules in the Zidney monorepo, replacing distributed enforcement logic (`arch:guard`, `type-safety-guard`, `validate:*`, CI scattered checks) with a unified deterministic system reachable via `bun run policy:check`. The spec captures 43 functional requirements, 20 non-functional requirements, 6 user stories with complete acceptance scenarios, and 8 measurable success criteria.

---

## Inputs Reviewed

- `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/spec.md`
- `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/checklists/requirements.md`
- `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_29_POLICY_ENGINE_AND_GOVERNANCE_RULES_LAYER.md`

---

## Key Decisions

| #   | Decision                                           | Rationale                                                                                                                                                                                             |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Adapter-first migration strategy                   | Legacy tools (arch-guard, type-safety-guard, Trivy, script-governance) must NOT be removed; adapter wrapping preserves outcomes while unifying entry points. Removal is a future stage.               |
| 2   | Engine resides in `scripts/policy-engine/`         | Not in `apps/` or `packages/` — governance tooling is a scripts-layer concern, not a deployable application package. Import boundary enforced: no imports from `apps/*`.                              |
| 3   | Rule registration is compile-time only             | Dynamic rule loading from external config at runtime is forbidden (NFR-020). Prevents runtime injection of unauthorized governance rules.                                                             |
| 4   | GitNexus unavailability = degraded mode, not crash | Engine gracefully constructs file-system-only context and emits a warning. No governance check fails silently due to an infrastructure outage.                                                        |
| 5   | `--changed` mode MUST complete <2s                 | Pre-commit developer experience is non-negotiable. Full-repo scans in `--changed` mode are a governance violation (NFR-004).                                                                          |
| 6   | Policy engine is the ONLY governance authority     | Zero independent validation logic permitted in CI YAML, Husky hooks, or the orchestrator — all delegate to `policyEngine.check()`. This is the core invariant preventing INFRA-16 failure recurrence. |
| 7   | Rule IDs follow `<DOMAIN>-<NNN>` format            | Human-identifiable IDs (e.g., `ARCH-001`, `SCRIPTS-003`) for traceability between requirements and violations in CI output.                                                                           |

---

## Functional Requirements Captured

**Engine Core (FR-001–007):**

- Single CLI entry point `bun run policy:check` with `--full` and `--changed` flags
- Exit code 1 on error-severity violations, 0 on warning-only or clean
- Deterministic execution; rule-level exception isolation

**Rule Registry (FR-008–012):**

- Central registry; all enforcement must be registered
- Domain organization: `architecture`, `scripts`, `types`, `ai`, `security`
- Unique rule IDs; duplicate rejection at registration

**GitNexus Context (FR-013–017):**

- Context loaded before rule execution; `changedFiles` + `dependencyGraph` required
- Graceful degradation when GitNexus unavailable

**Adapter Layer (FR-018–023):**

- Four adapters: architecture-guard, type-safety-guard, script-governance, Trivy
- Parity mandate: identical violation coverage to legacy tools
- No direct adapter invocation outside the engine

**Reporting (FR-024–027):**

- Console reporter (human-readable, grouped by domain)
- JSON reporter (`--reporter=json`, stable `PolicyResult[]` array)

**Script System Unification (FR-028–034):**

- Naming convention enforcement: `<domain>:<action>[:scope]`
- Duplicate script detection
- Broken reference detection (package.json → /scripts/)
- Documentation gap detection (scripts not in docs/scripts/)
- Generated artifacts classification and .gitignore consistency

**Integration (FR-035–043):**

- CI: `policy:check --full` as required build gate
- Husky pre-commit: `policy:check --changed` <2s
- Orchestrator: zero local governance logic; full delegation to engine

---

## Clarifications Required

None. All `[NEEDS CLARIFICATION]` markers were resolved using infrastructure stage defaults and the Zidney Constitution. Key resolutions:

- **GitNexus fallback behavior**: Degrade gracefully to file-system context + warning (not hard failure)
- **Pre-commit timing budget**: 2 seconds scoped to staged files on M-series or equivalent hardware
- **Adapter parity definition**: Identical violation _set_ (same rule triggered on same files), not necessarily identical message text
- **Removal timeline for legacy tools**: Explicitly out-of-scope for INFRA-29; adapter-first only

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                   |
| --------------------------------------- | ------ | ------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Infrastructure/governance stage — no tenant data access |
| License middleware requirement captured | ✅ N/A | Engine runs in scripts layer; no HTTP routes            |
| Snapshot integrity requirement captured | ✅ N/A | No attempt/exam scope in this stage                     |
| Database-per-tenant isolation preserved | ✅ N/A | No database interactions in scope                       |
| Server-authoritative time enforced      | ✅ N/A | No time-sensitive operations                            |
| Import boundary rules respected         | ✅     | Engine in `scripts/policy-engine/`; no `apps/*` imports |
| Deterministic outputs required          | ✅     | NFR-005 through NFR-007 explicitly enforce this         |
| No business logic in governance layer   | ✅     | Engine evaluates structural/governance rules only       |
| Adapter-first migration (no deletions)  | ✅     | Explicitly scoped: legacy tools wrapped, not removed    |

---

## Checklist Summary

| Category                 | Items | Passing |
| ------------------------ | ----- | ------- |
| Content Quality          | 4     | 4 ✅    |
| Requirement Completeness | 8     | 8 ✅    |
| Total                    | 12    | 12 ✅   |

All items in `checklists/requirements.md` pass. No blockers.
