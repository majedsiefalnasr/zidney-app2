# Clarify Report — Category Values

**Step:** 2 — Clarify
**Timestamp:** 2026-03-22T00:01:00.000Z
**Status:** COMPLETE

---

## Summary

All 5 targeted clarification questions were asked and answered. No unresolved ambiguities remain. The spec has been updated in-place with a `## Clarifications / ### Session 2026-03-22` section. Three additional checklists were generated (security, performance, accessibility).

**Risk Level: HIGH (Score: 12)**

---

## Inputs Reviewed

- `specs/runtime/031-category-values/spec.md` (including `## Clarifications`)
- `specs/runtime/030-categories/spec.md` (parent context)

---

## Clarifications Resolved

| #   | Question                                                         | Answer Summary                                                                                                                          |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `code` uniqueness — per category or per workspace?               | Per `(category_id, workspace_slug)` composite — not globally unique across workspace                                                    |
| 2   | Who can trigger each status transition?                          | Flat permission tier — any user with `classification_manage` or `question_manage` can drive all transitions                             |
| 3   | Parent category deleted while values exist?                      | Deletion blocked at DB FK level — `categories.id` is referenced by `category_value.category_id`; must delete all values first           |
| 4   | Translation fallback chain for multi-language workspaces?        | Default language → EN fallback → null (displayed as empty in UI); never throw 404 for missing translation                               |
| 5   | Scope filter when parent category has no scope vs. locked scope? | If parent has no scope restrictions, values inherit unrestricted scope; if parent has restrictions, value scope must be a strict subset |

---

## Risk Assessment

| Factor                                                         | Points |
| -------------------------------------------------------------- | ------ |
| Database migration (schema change)                             | +3     |
| New tables added (category_values, linking tables)             | +2     |
| Security-sensitive logic (permission gating, tenant isolation) | +3     |
| Multi-tenant data isolation logic                              | +3     |
| More than 10 tasks expected                                    | +1     |
| **Total**                                                      | **12** |

**Risk Level: HIGH**

---

## Constitutional Compliance Update

| Check                                                          | Status | Notes                                    |
| -------------------------------------------------------------- | ------ | ---------------------------------------- |
| All clarification ambiguities resolved                         | ✅     | 5/5 questions answered                   |
| Transaction scope confirmed (SELECT FOR UPDATE on soft-delete) | ✅     | BR-15 extended                           |
| Parent ENABLED requirement confirmed for usability             | ✅     | BR-04 extended                           |
| Flat permission tier confirmed                                 | ✅     | No role hierarchy needed for transitions |
| Translation fallback chain defined                             | ✅     | default → EN → null                      |

**Overall: Planning authorized.**

---

## Checklists Generated

| Checklist              | Path                                                            | Items       |
| ---------------------- | --------------------------------------------------------------- | ----------- |
| Requirements (updated) | `specs/runtime/031-category-values/checklists/requirements.md`  | All passing |
| Security               | `specs/runtime/031-category-values/checklists/security.md`      | 39 items    |
| Performance            | `specs/runtime/031-category-values/checklists/performance.md`   | 30 items    |
| Accessibility          | `specs/runtime/031-category-values/checklists/accessibility.md` | 22 items    |
