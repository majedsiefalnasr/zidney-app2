# Plan Report — Script System Standardization And Governance

**Step:** 3 — Plan  
**Timestamp:** 2026-03-21T12:05:05Z  
**Status:** COMPLETE

---

## Summary

Technical plan for INFRA-025 is complete and guardian-validated. The plan is strictly scoped to developer tooling: script naming governance, a refactor engine (`scripts/dev/refactor-scripts.ts`), three validation scripts, root `package.json` renames (33 entries), four new CI steps in `architecture-governance.yml`, a script registry generator, and updates to the AI governance skill. No runtime behavior, database schema, HTTP layer, or tenant logic is introduced. Both guardian agents (Architecture Checker, API Designer) returned **VERDICT: PASS** after remediation of two initial violations.

---

## Inputs Reviewed

- `specs/runtime/infra-025-script-system-standardization-and-governance/spec.md` (with clarifications — 11 FRs)
- `specs/runtime/infra-025-script-system-standardization-and-governance/plan.md` (713 lines)
- `specs/runtime/infra-025-script-system-standardization-and-governance/research.md` (399 lines — full repo script inventory)

No `data-model.md` or `contracts/` — not applicable for developer tooling stage.

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                             |
| --------- | --------------------------------------------------------------------------- |
| API       | None — no HTTP routes, no middleware, no response contracts                 |
| Worker    | None — no background jobs                                                   |
| Frontend  | None — no UI components, no Vue SFCs                                        |
| DB Master | None — no schema migrations                                                 |
| DB Tenant | None — no schema migrations                                                 |
| Scripts   | 33 renames in `package.json`; 4 new scripts; refactor engine; 3 validators  |
| CI        | 4 new steps appended to `architecture-governance.yml` (steps 14–17)         |
| Docs      | `docs/scripts/SCRIPT_MIGRATION_MAP.md`, `docs/scripts/SCRIPT_REGISTRY.md`   |
| AI Skills | `.agents/skills/script-system-governance/SKILL.md` — domain map + workflows |

---

## Key Technical Decisions

| #   | Decision                                                                                                                                     | Rationale                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Refactor engine at `scripts/dev/refactor-scripts.ts` (`dev:refactor:scripts`)                                                                | `refactor` is not an allowed domain; `dev` domain covers developer utilities and repo hygiene. Ensures the engine satisfies its own governance gate.                            |
| 2   | Staleness check normalizes (strips) `> Last generated: <ISO timestamp>` before diffing                                                       | A full string diff against a live-timestamp line would cause CI step 16 to permanently report stale on every run. Content hash of table rows is the only meaningful comparison. |
| 3   | Script naming convention: `<domain>:<action>[:<scope>]` — 9 allowed domains                                                                  | Unambiguous, consistent, machine-parseable. Allows AI and CI to verify all entrypoints without ambiguity.                                                                       |
| 4   | Script metadata header (5 fields: `@script`, `@domain`, `@category`, `@description`, `@usage`) enforced by `validate:scripts:infrastructure` | Registry cannot be auto-generated without all fields present; CI enforcement prevents silent omission.                                                                          |
| 5   | Migration map (`SCRIPT_MIGRATION_MAP.md`) as source of truth for renames                                                                     | Decouples the rename decision from the refactor engine; enables dry-run previews; creates an auditable record of all renames.                                                   |
| 6   | Forward-only rename (no removal without replacement)                                                                                         | Prevents broken `bun run` invocations in CI, docs, and agent skills during the migration window.                                                                                |
| 7   | Lifecycle scripts (`build`, `test`, `lint`, `dev`) exempt from naming convention                                                             | These are universal Node/bun conventions. Renaming them would break standard tooling assumptions.                                                                               |

---

## New Files

| File                                        | Purpose                                    | FR           |
| ------------------------------------------- | ------------------------------------------ | ------------ |
| `scripts/dev/refactor-scripts.ts`           | Automated script reference rewriter        | FR-004, T011 |
| `scripts/validate/script-naming.ts`         | Naming convention validator (CI gate)      | FR-008       |
| `scripts/validate/script-usage.ts`          | Usage reference validator (CI gate)        | FR-008       |
| `scripts/validate/script-infrastructure.ts` | Metadata header + registry staleness check | FR-008       |
| `docs/scripts/SCRIPT_MIGRATION_MAP.md`      | Canonical rename table (33 entries)        | FR-003, T002 |
| `docs/scripts/SCRIPT_REGISTRY.md`           | Auto-generated script registry             | FR-007       |

## Files To Update

| File                                               | Change                                                       |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `package.json` (root)                              | Apply 33 renames/removals; add 5 new governed entries        |
| `scripts/generate/script-docs.ts`                  | Enforce 5-field metadata schema; update own `@script` header |
| `.agents/skills/script-system-governance/SKILL.md` | Add workflows, anti-patterns, domain map, new header format  |
| `.github/workflows/architecture-governance.yml`    | Append 4-step Script System Governance block (steps 14–17)   |
| 13+ existing `.ts` scripts                         | Add missing `@category` and `@usage` metadata fields         |

---

## Migration Impact

| Item                  | Value | Notes                                                                                   |
| --------------------- | ----- | --------------------------------------------------------------------------------------- |
| Migration required    | No    | Developer tooling only — no DB schema                                                   |
| `schema_version` bump | No    | No database involvement                                                                 |
| Backward compatible   | Yes   | All renames performed atomically via refactor engine; dry-run validates before live run |

---

## Transaction Boundaries

**N/A** — This stage introduces no database writes.

All filesystem writes in the refactor engine are idempotent (replaceAll is safe to re-run). Report file overwrites are deterministic.

---

## Idempotency Strategy

- Refactor engine: running twice produces the same output (all legacy names already replaced on first run — second run finds zero matches).
- `validate:scripts:infrastructure`: deterministic — same registry content → same exit code.
- `dev:generate:script-docs`: deterministic — same script metadata → same registry output.

---

## Constitutional Compliance

| Check                                  | Status | Notes                                            |
| -------------------------------------- | ------ | ------------------------------------------------ |
| No cross-tenant logic introduced       | ✅     | No tenant resolver, no DB queries, no HTTP layer |
| All writes are transactional by design | ✅     | N/A — filesystem only; idempotent writes         |
| Server-authoritative time enforced     | ✅     | N/A — no time-dependent logic                    |
| License middleware enforced            | ✅     | N/A — no HTTP routes                             |
| Version compatibility enforced         | ✅     | N/A — no schema versioning                       |
| No architecture redesign without ADR   | ✅     | Confirmed: dev tooling only, no ADR required     |

**Overall:** COMPLIANT

---

## Guardian Results

| Guardian                    | Verdict | Notes                                         |
| --------------------------- | ------- | --------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS | All 8 criteria PASS after V-1/V-2 remediation |
| Zidney API Designer         | ✅ PASS | All 7 criteria PASS after V-1/V-2 remediation |

**Remediated violations:**

| #   | Was                                                        | Became                                                                |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| V-1 | `refactor:scripts` (undeclared domain `refactor`)          | `dev:refactor:scripts` + `scripts/dev/refactor-scripts.ts`            |
| V-2 | Staleness check: full string diff including live timestamp | Staleness check: normalize (strip `> Last generated:` line) then diff |

**Non-blocking actionable items (not blocking plan commit):**

- Architecture Checker: `arch:type-safety-guard` has compound hyphen — syntactically valid; may be aligned in a future stage.
- Architecture Checker: CI steps 14–17 may benefit from a visual comment header demarcating them from existing steps.
- API Designer: Implementation Sequence step 14 uses direct file invocations; can be updated to governed `bun run` commands after renames stabilize.
- API Designer: `validate:scripts:broken` entry disposition (retain/deprecate/remove) to be clarified in tasks.
- API Designer: CI step 17 could add `git diff --exit-code docs/scripts/SCRIPT_REGISTRY.md` guard for stricter staleness detection in CI.

---

## Open Risks

- **None classified as blocking.** All critical risks were resolved during spec clarification and guardian remediation.
- Low risk: If the existing CI `architecture-governance.yml` has step IDs or `needs:` chains that require adjustment when steps 14–17 are appended, that will be discovered during implementation. The plan flags this for the implementer to verify.

---

## Next Step

Proceed to Step 4 — Tasks.
