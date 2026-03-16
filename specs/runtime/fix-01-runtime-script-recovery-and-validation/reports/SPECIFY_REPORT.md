# Specify Report — Runtime Script Recovery and Validation

**Step:** 1 — Specify
**Timestamp:** 2026-03-17T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification complete for the Runtime Script Recovery and Validation stage. The spec documents
four failure modes affecting operational scripts (missing, broken, duplicated, undocumented),
defines 12 tasks with clear output artifacts, establishes success criteria, and declares
constitutional compliance. No ADR required — this is a pure infrastructure maintenance stage.

---

## Inputs Reviewed

- `specs/runtime/fix-01-runtime-script-recovery-and-validation/spec.md`
- `specs/runtime/fix-01-runtime-script-recovery-and-validation/checklists/requirements.md`
- `specs/phases/0X_FIXES/STAGE_FIX_01_RUNTIME_SCRIPT_RECOVERY_AND_VALIDATION.md`

---

## Key Decisions

| #   | Decision                                                                | Rationale                                                                |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Canonical script location: `scripts/<domain>/<script>.ts`               | Prevents duplication and establishes single ownership per script         |
| 2   | Scripts registered only in root `package.json`                          | Eliminates package-level script duplication ambiguity                    |
| 3   | Scripts must use `packages/config`, `packages/logger`, `packages/types` | Ensures structural logging and config consistency                        |
| 4   | Script knowledge base lives in `docs/scripts/`                          | Persistent, discoverable documentation store for all operational scripts |
| 5   | CI guard (`scripts/validate-runtime-scripts.ts`) as recommended task    | Prevents regression — specs referencing non-existent scripts fail CI     |
| 6   | Governance rule appended to `AGENTS.md`                                 | Formalizes the script contract as repository law                         |

---

## Functional Requirements Captured

- FR-01: Scan all `specs/runtime/**` for `bun run <script>` references
- FR-02: Build a script inventory table with status classification
- FR-03: Locate every script across all `package.json` files
- FR-04: Eliminate duplicate script definitions
- FR-05: Reconstruct missing scripts with correct implementations
- FR-06: Register all canonical scripts in root `package.json`
- FR-07: Validate every script executes with exit code 0
- FR-08: Create `docs/scripts/` knowledge base directory
- FR-09: Document each script (command, purpose, usage, failure modes)
- FR-10: Update `AGENTS.md` with governance rule
- FR-11: Create CI guard `scripts/validate-runtime-scripts.ts`
- FR-12: Script metadata automation (auto-sync registry with docs)

---

## Clarifications Required

None — specification is complete and unambiguous.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                         |
| --------------------------------------- | ------ | --------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Scripts are infrastructure tooling only       |
| License middleware requirement captured | ✅     | N/A — no request handling or routes           |
| Snapshot integrity requirement captured | ✅     | N/A — no exam or attempt logic                |
| Idempotency strategy defined            | ✅     | Script reconstruction is idempotent by design |
| Transaction boundaries identified       | ✅     | N/A — no DB writes in scope                   |
| Server-authoritative time enforced      | ✅     | N/A — no timing-sensitive operations          |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                                 | Severity | Mitigation                                   |
| ---------------------------------------------------- | -------- | -------------------------------------------- |
| Missing scripts may require deep spec archaeology    | Medium   | T001 scan + T005 spec-driven reconstruction  |
| Duplicate scripts may have diverged implementations  | Medium   | T003/T004 canonical selection process        |
| CI guard may flag many existing specs simultaneously | Low      | CI guard is recommended (T011), not blocking |
