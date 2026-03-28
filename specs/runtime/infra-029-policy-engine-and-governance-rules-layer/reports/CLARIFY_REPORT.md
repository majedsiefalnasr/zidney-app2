# Clarify Report — Policy Engine and Governance Rules Layer

**Step:** 2 — Clarify
**Timestamp:** 2026-03-25T00:15:00Z
**Status:** COMPLETE

---

## Summary

5 targeted clarifications were resolved in this session. The spec had no `[NEEDS CLARIFICATION]` markers from Step 1, but careful audit of the audit-focus domains surfaced 5 genuine gaps that required explicit resolution before planning. All gaps are now encoded in `spec.md` under `## Clarifications → ### Session 2026-03-25`.

An additional NFR-016 naming-convention violation (`ENGINE-TIMEOUT` ruleId) was detected during checklist generation and corrected inline: the reserved engine-internal ruleId is now `ENGINE-001` (domain `ENGINE` is reserved for engine-generated results).

---

## Inputs Reviewed

- `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/spec.md` (402 lines post-clarify)
- `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/checklists/requirements.md` (12/12 passing)

---

## Clarifications Resolved

| #   | Question                                                                           | Resolution                                                                                                                                             | Impact                          |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| 1   | Rule evaluation timeout strategy (NFR-001 pre-commit budget vs full CI)            | Two-tier timeout: 2,000ms `--changed`, 30,000ms `--full`; timeout emits `ENGINE-001` error result and exits 1                                          | NFR-021 (new), NFR-001, NFR-002 |
| 2   | `--changed` fallback when git working tree unavailable (detached HEAD, bare clone) | Auto-fall back to `--full` + emit `warning`-severity result explaining reason; no abort                                                                | FR-003 (updated), Edge Cases    |
| 3   | Parallel execution opt-out model for PolicyRule                                    | All rules parallel by default (pure functions); opt-out via `sequential: true` on `PolicyRule`; sequential rules run after parallel batch              | NFR-003 (updated), FR-011       |
| 4   | Adapter subprocess failure handling (non-zero exit / crash)                        | Adapter catches failure, emits `error`-severity `PolicyResult` with diagnostic (exit code + stderr excerpt); engine continues — consistent with FR-007 | Edge Cases (new entry)          |
| 5   | GitNexus "stale" definition for FR-016 degraded-mode                               | Stale = older than `GITNEXUS_MAX_AGE_HOURS` env var (default: 24h); missing file always treated as unavailable regardless of age                       | FR-016 (stale definition added) |

---

## Spec Updates Applied

| Update                                                                          | Location                            | Type            |
| ------------------------------------------------------------------------------- | ----------------------------------- | --------------- |
| Added two-tier timeout + `ENGINE-001` ruleId (NFR-021 added as new requirement) | NFR block + Clarifications          | New NFR         |
| Specified git-tree-unavailable fallback to `--full` + warning                   | FR-003 inline + Clarifications      | FR update       |
| Rewrote NFR-003 to parallel-by-default with `sequential: true` opt-out          | NFR block + Clarifications          | NFR update      |
| Added adapter subprocess failure → error PolicyResult edge case                 | Edge Cases section + Clarifications | Edge case       |
| Defined GITNEXUS_MAX_AGE_HOURS (default 24h) stale threshold                    | FR-016 inline + Clarifications      | FR update       |
| Fixed `ENGINE-TIMEOUT` → `ENGINE-001` to conform to NFR-016 DOMAIN-NNN format   | NFR-021 + Q1 clarification answer   | Spec correction |

---

## Open Items

None — all ambiguities resolved.

---

## Checklist Gaps (Flagged — Not Blocking)

The checklist generation (Step 2.1B) surfaced 4 documented gaps. These are recorded in the checklists as `[gap]` items for implementation attention — they do not block planning:

| Gap                                                                                              | Checklist                                 | Resolution Path                                                 |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------- |
| Secrets definition in FR-040 context is not formally specified (no testable "secret" definition) | security-checklist.md CHK015–CHK016       | Addressed during T-security implementation tasks                |
| Orphaned subprocess handling after engine timeout not specified                                  | performance-checklist.md CHK020           | Address in engine.ts implementation                             |
| NFR-002 uses `SHOULD` (not `MUST`) — asymmetry with NFR-001 intentional                          | performance-checklist.md CHK002           | Deliberate: CI runs have more flexibility than pre-commit hooks |
| Structured logging / correlation ID inheritance from orchestrator not formally specified         | constitutional-checklist.md CHK015–CHK018 | Address in engine.ts logger integration; `packages/logger` used |

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                |
| ----------------------------------------- | ------ | -------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 clarifications complete, 0 open items                            |
| Transaction strategy confirmed            | ✅ N/A | No DB writes in this stage (scripts/ layer only)                     |
| Idempotency strategy confirmed            | ✅     | Determinism test in Gate 2; same commit → byte-identical JSON output |
| Isolation boundaries confirmed            | ✅     | scripts/policy-engine/ only; no apps/\* imports (FR-019, FR-024)     |
| Version and license constraints confirmed | ✅     | Bun runtime; no external license-check endpoints                     |
| NFR-016 naming convention enforced        | ✅     | ENGINE-001 ruleId fix applied                                        |

**Overall:** COMPLIANT

---

## Risk Level Update

Based on clarifications, risk factors present:

| Factor                                                         | Points |
| -------------------------------------------------------------- | ------ |
| New package (scripts/policy-engine — new module)               | +1     |
| More than 10 tasks estimated (T001–T016+)                      | +1     |
| Security-sensitive logic (subprocess spawning, rule isolation) | +3     |
| Worker interaction (N/A)                                       | 0      |
| Multi-tenant logic (N/A — scripts layer)                       | 0      |

**Total: 5 → Risk Level: MEDIUM**

---

## Open Risks

- Subprocess injection surface via `changedFiles` file paths passed to adapter processes (CHK003/CHK021 in security checklist) — must be addressed during adapter implementation with explicit argument sanitization.
- GitNexus context freshness check adds ~50ms on pre-commit path — within budget but must be profiled during Gate 1 validation.

---

## Next Step

Proceed to Step 3 — Plan.
