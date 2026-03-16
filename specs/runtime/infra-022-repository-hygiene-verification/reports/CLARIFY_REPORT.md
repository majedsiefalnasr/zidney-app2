# Clarify Report — REPOSITORY HYGIENE VERIFICATION

**Step:** 2 — Clarify
**Timestamp:** 2026-03-15T00:02:00.000Z
**Status:** COMPLETE

---

## Summary

Five targeted clarification questions were resolved covering dead-script output actions, dependency hygiene scope, AI context validation error semantics, architecture guard violation classification, and hygiene report delivery. All resolutions have been appended to `spec.md` under `## Clarifications / ### Session 2026-03-15`. No items remain open. Planning is authorized.

---

## Inputs Reviewed

- `specs/runtime/infra-022-repository-hygiene-verification/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                                   | Resolution                                                                                             | Impact                                                       |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1   | T003: Should dead scripts produce a removal shell script or report-only?   | Report-only. Enumerated in hygiene report under "Scripts — Flagged for Review." No removal script.     | Confirms verification-only scope; no new output artifact     |
| 2   | T004: Dependency scope — root package.json only or all workspace packages? | Root + all `packages/*` and `apps/*` workspaces, checked independently, findings grouped by workspace. | Expands check coverage; report format adjusted               |
| 3   | T008: `ai-context:validate` not found — SKIP, WARNING, or FAIL?            | Missing script = SKIP (documented). Script exists but errors = WARNING. Validation failure = FAIL.     | Stage not blocked by missing validation script               |
| 4   | T009: Pre-existing arch:guard violations — block or document?              | Pre-existing violations documented only; do not block. Only stage-introduced violations would block.   | Since stage introduces no code changes, no blocking possible |
| 5   | T010: Hygiene report committed to source control or ephemeral output only? | Committed to `docs/reports/REPOSITORY_HYGIENE_REPORT.md` as a tracked artifact.                        | Report becomes a source-controlled baseline artifact         |

---

## Open Items

None — all clarifications resolved.

---

## Spec Updates Applied

- `T003` expected outcome updated: removal script removed from scope
- `T004` scope expanded to root + all workspace packages, findings grouped by workspace root
- `T008` exit-code behaviour table added (SKIP / WARNING / PASS / FAIL semantics)
- `T009` violation classification table added; pre-existing vs stage-introduced distinction documented
- `T010` delivery paragraph added; report marked as committed tracked artifact
- `Failure Modes` T009 row updated; pre-existing violations no longer blocking
- `Scenarios 3, 4, 8, 9, 10` aligned to resolved decisions
- `Functional Requirements FR03, FR04, FR08, FR09, FR10` acceptance criteria updated
- `Success Criteria` T008, T009, T010 rows updated

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                      |
| ----------------------------------------- | ------ | ---------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 questions resolved                                     |
| Transaction strategy confirmed            | ✅     | No transactions required — verification only               |
| Idempotency strategy confirmed            | ✅     | All tasks are read-only and naturally idempotent           |
| Isolation boundaries confirmed            | ✅     | No DB access, no tenant resolver calls                     |
| Version and license constraints confirmed | ✅     | No workspace routes modified; license middleware untouched |
