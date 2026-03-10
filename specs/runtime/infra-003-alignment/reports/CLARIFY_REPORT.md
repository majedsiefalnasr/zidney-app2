# CLARIFY REPORT — STAGE_INFRA_03_ALIGNMENT

**Step:** 2 — Clarify **Stage:** STAGE_INFRA_03_ALIGNMENT **Phase:** 01_PLATFORM_FOUNDATION
**Branch:** `infra-003-alignment` **Date:** 2026-03-04 **Agent:** speckit.clarify

---

## Clarification Session Summary

5 targeted clarification questions were identified and resolved during the ambiguity scan of
`spec.md`. All ambiguities related to implementation choices specific to this infrastructure stage
(not architectural or governance-level concerns).

---

## Questions & Resolutions

| #   | Question                                                         | Resolution                                                                                                                                                             |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Per-app `vitest.config.ts`: delete or keep as minimal overrides? | **Keep as minimal overrides** — retain `environment` + `setupFiles` only; strip all coverage settings. Deleting would lose per-environment isolation (`jsdom`/`node`). |
| Q2  | Playwright smoke tests: part of `bun run test` or separate?      | **Separate** — only via `bun run test:e2e`. Excluded from Vitest projects glob. E2E requires a running dev server; mixing breaks CI sequential staging.                |
| Q3  | Flaky test quarantine mechanism?                                 | **`it.skip()` + `// QUARANTINE: <reason> <tracking-ref>` comment** above the test; CI uses `--reporter=verbose` to surface skips visibly.                              |
| Q4  | README format: existing template or free-form?                   | **Free-form** against the required section checklist. No internal template exists; CI validates heading presence, not prose content.                                   |
| Q5  | `eslint-config-prettier`: global or per-app?                     | **Global in root `eslint.config.mjs`**. Root flat config is the single authority for the monorepo.                                                                     |

---

## Impact on Implementation

| Resolution                                                | Affected Tasks |
| --------------------------------------------------------- | -------------- |
| Q1: Keep per-app vitest configs as minimal overrides      | T001           |
| Q2: Playwright separate from Vitest (`test:e2e` script)   | T003, T008     |
| Q3: Quarantine pattern = `it.skip()` + QUARANTINE comment | T005           |
| Q4: README as free-form with required sections            | T007           |
| Q5: `eslint-config-prettier` at root                      | T004           |

---

## Risk Assessment

**Risk Level: LOW**

- No architectural decisions changed
- No tenant database impact
- No business logic involved
- Clarifications are tooling/convention choices only
- All resolutions align with stability-first Zidney principles

---

## Clarifications Status

**All ambiguities resolved.** No open questions. Planning is authorized.

The `## Clarifications / ### Session 2026-03-04` section has been appended in-place to
`specs/runtime/infra-003-alignment/spec.md`.

---

## Next Step

Proceed to **Step 3 — Plan** to generate the technical implementation plan.
