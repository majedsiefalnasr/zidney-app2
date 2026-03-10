# Clarify Report — STAGE_UI_06_STATE_MANAGEMENT

**Step:** 2 — Clarify **Timestamp:** 2026-03-03T00:00:00.000Z **Status:** COMPLETE

---

## Summary

6 clarification questions were identified and resolved. The 1 known `[NEEDS CLARIFICATION]` marker
from Step 1 (concurrent async loading state shape) was resolved, plus 5 additional targeted
ambiguities were identified and resolved autonomously. All clarifications were appended to `spec.md`
as `## Clarifications / ### Session 2026-03-03`. No open items remain. Planning is authorized.

---

## Inputs Reviewed

- `specs/runtime/ui-06-state-management/spec.md` (including `## Clarifications`, Session 2026-03-03)

---

## Clarifications Resolved

| #   | Question                                                                 | Resolution                                                                                                                                                                         | Impact                                                              |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Concurrent async loading state shape (`isLoading` vs `pending` map)?     | `isLoading: boolean` as primary signal; stores with multi-action concurrency additionally expose `pending: Record<string, boolean>` keyed by action name; shape declared per store | FR-016 updated; [NEEDS CLARIFICATION] marker replaced with RESOLVED |
| 2   | Pinia version target?                                                    | Pinia 2.x (stable for Vue 3)                                                                                                                                                       | New assumption bullet added to spec                                 |
| 3   | Notification store — single notification or queue?                       | Queue — multiple concurrent notifications must be maintainable and independently dismissible                                                                                       | Notification Store entity description updated                       |
| 4   | `$reset()` required on all stores or only feature stores?                | Required on ALL stores — both core and feature                                                                                                                                     | FR-030 updated                                                      |
| 5   | SSR support in scope?                                                    | Out of scope — Zidney apps are CSR only                                                                                                                                            | New out-of-scope bullet added                                       |
| 6   | Error clearing: auto-clear only, or also explicit `clearError()` action? | Both — auto-reset to `null` at each action start AND explicit `clearError()` action required                                                                                       | FR-018 updated                                                      |

---

## Open Items

None.

---

## Spec Updates Applied

- **FR-016** updated: base contract now reads — each store exposes `isLoading: boolean` as primary
  loading signal; stores with multi-action concurrency additionally expose
  `pending: Record<string, boolean>` per action
- **FR-018** updated: `clearError()` action explicitly required alongside auto-reset behavior
- **FR-030** updated: `$reset()` required on ALL stores (not just feature stores)
- **Notification Store** entity description updated to reflect queue-based notification model
- **Assumptions** section: Pinia 2.x pinned as the target version
- **Out of Scope** section: SSR explicitly excluded
- **Edge Cases** section: `[NEEDS CLARIFICATION]` marker replaced with `RESOLVED` annotation
- `## Clarifications / ### Session 2026-03-03` section appended at end of spec

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                          |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| All material ambiguities resolved         | ✅     | 6/6 clarifications resolved, 0 open items                                      |
| Transaction strategy confirmed            | ✅ N/A | UI-layer stage; no DB transactions                                             |
| Idempotency strategy confirmed            | ✅ N/A | Store actions idempotent by design (each action resets error before executing) |
| Isolation boundaries confirmed            | ✅     | Cross-store mutation forbidden; CSR-only confirmed (no SSR state bleed)        |
| Version and license constraints confirmed | ✅     | Pinia 2.x; UI stores must not enforce license limits                           |

**Overall:** COMPLIANT — Planning authorized.

---

## Open Risks

- `pinia-plugin-persistedstate` version compatibility with Pinia 2.x to be confirmed during plan
  phase.
- ESLint rule for blocking direct API client imports in `.vue` files must be specified in plan.
