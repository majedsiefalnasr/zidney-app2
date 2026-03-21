# Specify Report — Script System Standardization And Governance

**Step:** 1 — Specify
**Timestamp:** 2026-03-21T00:00:00Z
**Status:** COMPLETE

---

## Summary

The specification for INFRA-25 is complete. The stage targets the entire monorepo script system, converting ad-hoc, inconsistently named scripts into a governed, structured, and enforceable execution system. The spec is infrastructure-only: no tenant data, no runtime behavior, no database, and no trust-chain components are involved. No ADR is required.

---

## Inputs Reviewed

- `specs/runtime/infra-025-script-system-standardization-and-governance/spec.md`
- `specs/runtime/infra-025-script-system-standardization-and-governance/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                              | Rationale                                                           |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Naming convention: `<domain>:<action>[:<scope>]`                      | Establishes deterministic, machine-parseable naming for all scripts |
| 2   | Domain map locked to 9 allowed domains                                | Prevents unbounded domain proliferation                             |
| 3   | All renames require full repository propagation (no partial renaming) | Partial migration would introduce broken references and CI failures |
| 4   | Refactor engine must be idempotent                                    | Safe re-application prevents double-replacement bugs                |
| 5   | Script metadata headers are required per script file                  | Enables registry auto-generation and AI agent discoverability       |
| 6   | Registry is auto-generated; CI must fail if stale                     | Prevents registry drift from script additions without documentation |
| 7   | `bun scripts/<domain>/<file>.ts` is the single canonical invocation   | Eliminates `bun run scripts/...` and `npx tsx` inconsistencies      |

---

## Functional Requirements Captured

- **FR-001** Script Inventory — full scan of root + workspace package.json, with name → file → usage mapping
- **FR-002** Naming Convention Enforcement — `<domain>:<action>[:<scope>]` with allowed domain map, no duplicates
- **FR-003** Migration Map — `docs/scripts/SCRIPT_MIGRATION_MAP.md` as input to refactor engine
- **FR-004** Automated Refactor Engine — `scripts/refactor-scripts.ts`, idempotent, dry-run, refactor report
- **FR-005** Invocation Standardization — `bun scripts/<domain>/<file>.ts` only; eliminates legacy patterns
- **FR-006** Script Metadata Headers — `@script`, `@domain`, `@category`, `@description`, `@usage` per file
- **FR-007** Script Registry — auto-generated `docs/scripts/SCRIPT_REGISTRY.md`, CI staleness check
- **FR-008** Validation Scripts — `validate/script-naming.ts` + `validate/script-usage.ts` with non-zero exit on failure
- **FR-009** CI Integration — validation scripts wired into CI pipeline; failing on naming/reference violations
- **FR-010** Orchestrator Gate — script validation required before stage closure
- **FR-011** AI Skill — `.agents/skills/script-system-governance/SKILL.md` for agent-safe script operations

---

## Acceptance Criteria Summary

| Scenario                                        | Status  |
| ----------------------------------------------- | ------- |
| New script follows naming convention            | Defined |
| Renamed script propagates across repository     | Defined |
| CI catches non-compliant names                  | Defined |
| CI catches broken script references             | Defined |
| Registry is discoverable and machine-readable   | Defined |
| AI agent can use script governance skill safely | Defined |

---

## Clarifications Required

None — specification is complete and unambiguous. Ready for clarification step.
