# Specify Report — GitNexus Context-Aware Governance

**Step:** 1 — Specify
**Timestamp:** 2026-03-25T00:05:00Z
**Status:** COMPLETE

---

## Summary

Specification written for INFRA-28 which upgrades Zidney governance from rule-based to
context-aware enforcement. The stage promotes the existing `scripts/gitnexus-context.ts`
into a canonical `context:*` command surface and integrates it into the `governance:gate`
pipeline from INFRA-27. No new guards are introduced — this is a composition and routing
layer. All 16 FRs, 7 NFRs, and 18 ACs captured with zero clarification markers.

---

## Inputs Reviewed

- `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_28_GITNEXUS_CONTEXT_AWARE_GOVERNANCE.md`
- `scripts/gitnexus-context.ts` (existing GitNexus script to delegate to)
- `package.json` (existing `context:*` and `governance:gate` scripts)
- `scripts/context/` (does not yet exist)

---

## Key Decisions

| #   | Decision                                                              | Rationale                                                |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Wrap `gitnexus-context.ts`, do not rewrite it                         | Preserves INFRA-24 contract; avoids duplication          |
| 2   | `scripts/context/` as canonical directory                             | Aligns with script-system-governance naming              |
| 3   | `context:build` and `context:validate` prepended to `governance:gate` | Fail-fast: no point running guards without valid context |
| 4   | `context:changed` in pre-commit (not `context:build`)                 | Build is expensive; changed-files extraction is fast     |
| 5   | Deterministic atomic writes via tmp file + rename                     | Safe concurrent runs; no partial artifact reads          |

---

## Functional Requirements Captured

- FR-001: `scripts/context/` directory with 4 typed Bun scripts
- FR-002: `context:build` script — wraps `gitnexus-context.ts`, writes `gitnexus-context.json`
- FR-003: `context:changed` script — extracts changed files from git, writes `context-changed.json`
- FR-004: `context:impact` script — runs dependency impact analysis, writes `context-impact.json`
- FR-005: `context:validate` script — validates all context artifacts against their schemas
- FR-006: 4 `context:*` scripts registered in root `package.json`
- FR-007: Script metadata headers + `context` domain registration in script-system-governance
- FR-008: `governance:gate` extended to run `context:build` → `context:validate` first
- FR-009: `governance:gate:changed` updated to prepend `context:changed`
- FR-010: `.husky/pre-commit` extended with `bun run context:changed`
- FR-011: `.github/workflows/architecture-governance.yml` extended with `context:validate` step
- FR-012: Orchestrator Step 5 and Step 6 invoke `context:build` and `context:validate`
- FR-013: Deterministic output — same git state produces identical artifacts
- FR-014: Atomic writes — tmp + rename pattern for all context JSON files
- FR-015: No logic duplication with existing `gitnexus-context.ts`
- FR-016: `validate:runtime:scripts` compliance for all new scripts

---

## Clarifications Required

None — all ambiguities resolved with documented assumptions.
