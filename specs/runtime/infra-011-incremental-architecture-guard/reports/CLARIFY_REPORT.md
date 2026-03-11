# Clarify Report — Incremental Architecture Guard

**Step:** 2 — Clarify  
**Timestamp:** 2026-03-10T12:00:00Z  
**Status:** COMPLETE

---

## Summary

All 5 targeted clarification questions have been resolved. No implementation ambiguities remain. The specification received in-place updates to the Architecture Design, Dependency Graph Cache System, and a new Clarifications section. Planning is authorized.

---

## Inputs Reviewed

- `specs/runtime/infra-011-incremental-architecture-guard/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                                                        | Resolution                                                                                                                                                                                         | Impact                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Which git diff strategy should the pre-commit hook use — `HEAD~1..HEAD` or `git diff --cached`? | Pre-commit hooks must use `git diff --cached --name-only` (staged files). CI uses `git merge-base HEAD main`. The ambiguous `HEAD~1..HEAD` form has been removed from the spec.                    | Implementation-critical: using the wrong form would cause empty results in pre-commit hooks since HEAD hasn't moved yet |
| 2   | Where is the cache staleness threshold configured?                                              | Via `ARCH_GRAPH_MAX_AGE_HOURS` environment variable (default: 24h). No separate config file needed.                                                                                                | Low-impact: default is sensible; override is needed only in CI or special environments                                  |
| 3   | What happens when a changed file doesn't map to any module in ARCHITECTURE_MAP.json?            | The file is silently skipped. A null-safe loop handles unmapped paths. A `skipped_unmapped_files` counter is added to the impact report for audit visibility.                                      | Safety net: prevents crashes on doc files, config files, or any path outside declared modules                           |
| 4   | When smart fallback triggers, does it validate all modules or only the affected set?            | Full validation = ALL modules — identical behavior to CI full scan. The impact report will show `modules_skipped: 0` to indicate full coverage.                                                    | Prevents false negatives when architecture metadata changes; full re-validation is the only safe approach               |
| 5   | How should empty commits and merge commits be handled?                                          | An empty changed-file list results in immediate exit 0 (no validation needed). Merge commits are handled by the merge-base approach — only branch-specific changes are validated, not all history. | Prevents unnecessary validation on squash merges and empty fixup commits                                                |

---

## Spec Updates Applied

| File      | Change                                                                      | Section Modified                                    |
| --------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| `spec.md` | Replaced `HEAD~1..HEAD` with `git diff --cached --name-only` for pre-commit | Architecture Design › Step 1                        |
| `spec.md` | Added `ARCH_GRAPH_MAX_AGE_HOURS` env var documentation                      | Dependency Graph Cache System › Cache Refresh Rules |
| `spec.md` | Added null-safe module mapping loop with `skipped_unmapped_files` counter   | Architecture Design › Step 2                        |
| `spec.md` | Clarified full validation scope = all modules (not subset)                  | Architecture Design › Step 5                        |
| `spec.md` | Added empty commit and merge commit handling                                | Architecture Design › Step 1                        |
| `spec.md` | Added `## Clarifications` section with `### Session 2026-03-10`             | Appended to document                                |

---

## Open Items

None. All clarification markers resolved.

---

## Risk Assessment

| Area                | Risk Level  | Notes                                       |
| ------------------- | ----------- | ------------------------------------------- |
| Git integration     | ✅ RESOLVED | Staged-vs-HEAD ambiguity eliminated         |
| Cache config        | ✅ RESOLVED | ARCH_GRAPH_MAX_AGE_HOURS env var documented |
| Unmapped files      | ✅ RESOLVED | Silent skip with audit counter              |
| Full fallback scope | ✅ RESOLVED | All modules, identical to CI                |
| Edge cases          | ✅ RESOLVED | Empty commits, merge commits handled        |

---

## Constitutional Compliance

| Check                                          | Status  | Notes                                                 |
| ---------------------------------------------- | ------- | ----------------------------------------------------- |
| No new crossing of tenant isolation boundaries | ✅ PASS | Feature operates at file-system level only            |
| No middleware bypass introduced                | ✅ PASS | Architecture guard is pre-commit tooling, not runtime |
| Idempotency preserved                          | ✅ PASS | Re-running validation produces identical results      |
| No secrets or credentials accessed             | ✅ PASS | Git operations are read-only                          |

---

## Next Steps

Ready for **Step 3 — Plan**. All blocking ambiguities resolved. Downstream rework risk: **LOW**.
