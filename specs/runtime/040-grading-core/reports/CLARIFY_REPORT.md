# Clarify Report — Grading Core

**Step:** 2 — Clarify  
**Timestamp:** 2026-04-02T00:02:00.000Z  
**Status:** COMPLETE

---

## Summary

Five clarification questions identified and resolved. All address edge cases in grading behavior, snapshot structure, status transitions, and concurrency. No blocking ambiguities remain.

---

## Inputs Reviewed

- `specs/runtime/040-grading-core/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                            | Resolution                                                                       | Impact                                             |
| --- | --------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| C1  | FILL_BLANK case normalization behavior              | Controlled by `normalize_case` boolean in grading config snapshot, default true  | Affects grading engine FILL_BLANK comparison logic |
| C2  | Attempt status constraint with GRADED               | ALTER check constraint to include GRADED; add separate `grading_status` column   | Migration change + schema update                   |
| C3  | Grading config snapshot structure                   | Defined expected JSON shape with required fields                                 | Grading engine input validation                    |
| C4  | Score field semantics (attempts vs grading_results) | `attempts.score` = percentage (0-100); `grading_results.total_score` = raw score | Dual-write after grading                           |
| C5  | Concurrent grading safety                           | SELECT FOR UPDATE + idempotent return of existing result                         | No code change — design confirmed                  |

---

## Open Items

- None

---

## Spec Updates Applied

- Appended `## Clarifications` section with 5 resolved items
- Grading config snapshot JSON structure fully defined
- Case normalization behavior for FILL_BLANK specified

---

## Architecture Governance Compliance

| Check                                                          | Status | Notes                                 |
| -------------------------------------------------------------- | ------ | ------------------------------------- |
| All material ambiguities resolved                              | ✅     | 5 clarifications resolved             |
| Transaction strategy confirmed                                 | ✅     | SELECT FOR UPDATE + full rollback     |
| Idempotency strategy confirmed                                 | ✅     | Re-grading returns existing result    |
| Isolation boundaries confirmed (ADR-0001)                      | ✅     | workspace_id on all queries           |
| Version and license constraints confirmed (ADR-0007, ADR-0008) | ✅     | grading_version tracked               |
| Trust chain respected                                          | ✅     | Snapshot-only grading, no live config |
