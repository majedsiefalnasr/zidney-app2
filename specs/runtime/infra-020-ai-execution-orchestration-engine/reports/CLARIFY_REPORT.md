# Clarify Report — AI Execution Orchestration Engine

**Step:** 2 — Clarify  
**Timestamp:** 2026-03-15T00:02:00.000Z  
**Status:** COMPLETE

---

## Summary

5 targeted clarification questions were raised and resolved. All ambiguities around log file structure, import restrictions, staleness detection, output policy, and timeout budgets are now codified in the spec. No `[NEEDS CLARIFICATION]` markers remain. The spec is unambiguous and ready for technical planning.

---

## Inputs Reviewed

- `specs/runtime/infra-020-ai-execution-orchestration-engine/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                     | Resolution                                                                                                                                                            | Impact                                                             |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Q1  | Per-execution log file structure and concurrent write safety | One `{execution_id}.json` file per run; no shared file; concurrent invocations are naturally safe without file locking                                                | Idempotency Strategy, Edge Cases updated                           |
| Q2  | Exact allowed imports for `scripts/ai-engine/`               | Only `packages/logger` and `packages/config` permitted; all other `packages/*` forbidden                                                                              | Layer Separation, FR-014, SC-011, Assumptions, Edge Cases narrowed |
| Q3  | Staleness definition for `ai-architecture-brain.json`        | Stale = file mtime predates most recently modified `.ts` source under `packages/` or `apps/`; absent = missing entirely; both exit non-zero with distinct diagnostics | Failure Modes, Edge Cases updated                                  |
| Q4  | stdout/stderr policy when `console.log` is forbidden         | Scripts: zero stdout/stderr. CI: post-step writes to `$GITHUB_STEP_SUMMARY` + `actions/upload-artifact@v4` (matches `architecture-governance.yml` conventions)        | Observability Requirements, Edge Cases updated                     |
| Q5  | Timeout budget values for `ai:run` and `ai:plan`             | `ai:plan` = 120 s; `ai:run` = 300 s; `ai:validate` = 90 s local / 120 s CI (SC-010 confirmed)                                                                         | FR-013 made concrete                                               |

---

## Open Items

None.

---

## Spec Updates Applied

- Idempotency Strategy: clarified that each execution writes one `{execution_id}.json` file; concurrent invocations are safe by design
- Layer Separation / FR-014 / SC-011: narrowed allowed imports from `packages/*` generally to `packages/logger` and `packages/config` specifically
- Failure Modes: staleness definition added — mtime comparison against most recently changed `.ts` under `packages/` or `apps/`; absent vs stale produce distinct diagnostics
- Observability Requirements: stdout/stderr policy codified (zero output from scripts); CI output via `$GITHUB_STEP_SUMMARY` and `actions/upload-artifact@v4`
- FR-013 / SC-010: concrete timeout values documented: `ai:plan` 120 s, `ai:run` 300 s, `ai:validate` 90 s local / 120 s CI
