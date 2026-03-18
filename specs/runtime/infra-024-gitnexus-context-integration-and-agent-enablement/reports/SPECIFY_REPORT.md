# Specify Report — GitNexus Context Integration And Agent Enablement

**Step:** 1 — Specify
**Timestamp:** 2026-03-18T00:01:00.000Z
**Status:** COMPLETE

---

## Summary

Specification complete for INFRA-024 — GitNexus Context Integration and Agent Enablement. The stage introduces GitNexus as a first-class intelligence layer for the Zidney orchestrator and all AI agents, replacing blind reasoning with deterministic, repository-aware context. The spec covers 12 functional requirements across installation, wrapper script standardization, structured output contract, orchestrator integration, test harness, validation script, CI gate, and governance rule enforcement.

---

## Inputs Reviewed

- `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_24_GITNEXUS_CONTEXT_INTEGRATION_AND_AGENT_ENABLEMENT.md`
- `specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/spec.md`
- `specs/runtime/infra-024-gitnexus-context-integration-and-agent-enablement/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                                       | Rationale                                                                                 |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 1   | Redesign existing `scripts/gitnexus-context.ts` (not create new)               | File already exists; aligning it to the new structured output contract                    |
| 2   | Define strict JSON schema at `docs/ai/gitnexus-context.schema.json`            | Ensures deterministic agent consumption; prevents schema drift over time                  |
| 3   | Inject GitNexus at 3 orchestrator phases: pre-planning, mid-execution, closure | Provides context where decisions are most consequential                                   |
| 4   | Bind GitNexus usage as mandatory policy in `AGENTS.md`                         | Prevents future agents from bypassing context lookup                                      |
| 5   | 5-case deterministic test harness                                              | Validates changed files, dependency mapping, architecture mapping, history, output format |

---

## Functional Requirements Captured

- FR-001: GitNexus available as runnable binary/command
- FR-002: Wrapper script `scripts/gitnexus-context.ts` executes GitNexus and normalizes to structured JSON
- FR-003: Context scope covers 4 domains (changed files, dependency graph, architecture map, git history)
- FR-004: Output conforms to JSON schema at `docs/ai/gitnexus-context.schema.json` (6 required fields)
- FR-005: Orchestrator integrates GitNexus at pre-planning phase
- FR-006: Orchestrator integrates GitNexus at mid-execution (on-demand) phase
- FR-007: Orchestrator integrates GitNexus at pre-closure validation phase
- FR-008: Agent execution policy updated in `AGENTS.md` to require GitNexus for impact/dependency/refactor tasks
- FR-009: Deterministic test harness at `tests/gitnexus-context.test.ts` with 5 test cases
- FR-010: Validation script `scripts/validate-gitnexus.ts` runs GitNexus, validates schema, checks required fields
- FR-011: CI pipeline includes `bun run gitnexus:validate` gate; fails on schema/completeness failure
- FR-012: Feature documentation at `docs/ai/gitnexus.md`

---

## Non-Functional Requirements Captured

- NFR-001: Output generation completes under 30 seconds on standard hardware
- NFR-002: Wrapper script handles GitNexus unavailability gracefully (non-blocking warning in dev, hard fail in CI)
- NFR-003: Schema contract is versioned; breaking changes require a new stage
- NFR-004: Test harness is deterministic (same input = same output across runs)
- NFR-005: Script follows JSDoc metadata header format per script governance rules
- NFR-006: Documentation is human-readable and agent-consumable

---

## Clarifications Required

None. All specification aspects were resolvable from the stage file and existing project context.

**Assumption flagged for planning confirmation:**

- Whether `scripts/gitnexus-context.ts` is being extended (backward-compatible) or fully replaced with a new contract-conformant implementation. Planning should decide and document.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                            |
| --------------------------------------- | ------ | ---------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Infrastructure tooling only — no tenant DB or middleware touched |
| License middleware requirement captured | ✅     | Not applicable (no API routes)                                   |
| Snapshot integrity requirement captured | ✅     | Not applicable (attempt engine untouched)                        |
| Idempotency strategy defined            | ✅     | Script execution is idempotent by design                         |
| Transaction boundaries identified       | ✅     | Not applicable (no database)                                     |
| Server-authoritative time enforced      | ✅     | Not applicable                                                   |
| Script governance rules captured        | ✅     | JSDoc header, `scripts/` location, `docs/scripts/` documentation |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                                                | Severity | Mitigation                                                    |
| ------------------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| GitNexus binary unavailable in some CI environments                 | Medium   | NFR-002: non-blocking in dev, hard fail in CI                 |
| Schema drift as GitNexus output format evolves                      | Low      | Schema contract versioned; breaking changes require new stage |
| Orchestrator context injection adds latency to workflow steps       | Low      | NFR-001: target <30s; async execution where possible          |
| Existing `scripts/gitnexus-context.ts` may conflict with new schema | Medium   | Clarify in planning: extend vs. replace decision              |
