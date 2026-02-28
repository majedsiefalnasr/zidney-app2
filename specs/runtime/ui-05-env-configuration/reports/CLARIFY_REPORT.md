# Clarify Report — ENV Configuration

**Step:** 2 — Clarify  
**Timestamp:** 2026-02-28T21:10:00Z  
**Status:** COMPLETE

---

## Summary

5 clarification questions were identified through structured ambiguity scanning. All 5 were resolved with concrete, architecturally-aligned answers. The spec was updated in-place with a `## Clarifications` section appended. No outstanding ambiguities remain.

---

## Inputs Reviewed

- `specs/runtime/ui-05-env-configuration/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                                  | Resolution                                                                                                                            | Impact                                  |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | How should FR-010 surface errors for missing required env vars?           | Throw synchronous exception before `createApp().mount()` — app never renders in invalid state                                         | FR-010 now specifies fail-fast behavior |
| 2   | When must configuration be initialized?                                   | Synchronously before app mount in `main.ts`, before `createApp()`. No lazy/deferred init.                                             | Initialization timing is now explicit   |
| 3   | Should app version be exposed via env module?                             | Out of scope — version headers belong to API client stage                                                                             | Added to Explicit Non-Goals             |
| 4   | How does test mock injection (FR-011) coexist with immutability (FR-015)? | Factory function pattern: `createEnvConfig(overrides?)`. Production: called once, result frozen. Tests: callers pass mocks.           | FR-011 and FR-015 reconciled            |
| 5   | How is multi-app consistency (FR-012) enforced?                           | Shared TypeScript interface, no shared runtime package. Each app implements independently. Enforced via TS conformance + code review. | FR-012 enforcement mechanism defined    |

---

## Open Items

- None

---

## Spec Updates Applied

- Appended `## Clarifications > Session 2026-02-28` with 5 Q&A pairs
- FR-010 updated with synchronous throw specification
- FR-011 updated with factory function pattern
- FR-012 updated with TypeScript interface enforcement
- FR-015 reconciled with test mockability via factory pattern
- Added app version to Explicit Non-Goals

---

## Constitutional Compliance

| Check                                     | Status | Notes                                   |
| ----------------------------------------- | ------ | --------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 clarifications locked               |
| Transaction strategy confirmed            | ✅     | N/A — frontend-only; no transactions    |
| Idempotency strategy confirmed            | ✅     | Config init is once-only, result frozen |
| Isolation boundaries confirmed            | ✅     | No tenant computation in frontend       |
| Version and license constraints confirmed | ✅     | N/A — defers to backend middleware      |

**Overall:** COMPLIANT

---

## Open Risks

- None

---

## Next Step

Proceed to Step 3 — Plan.
