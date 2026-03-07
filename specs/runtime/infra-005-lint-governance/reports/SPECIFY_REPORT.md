# Specify Report — STAGE_INFRA_05_LINT_GOVERNANCE

**Step:** 1 — Specify
**Timestamp:** 2026-03-07T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification for the Lint Governance infrastructure stage is complete. The spec defines a strict multi-layer enforcement pipeline composed of Biome (code style, lint, import hygiene), AI-Guard (architecture boundary validation), and Infra Audit (dependency graph health). Five developer-facing user stories and nine functional requirements are fully defined. Two low-risk clarification points were identified and documented with safe defaults.

---

## Inputs Reviewed

- `specs/phases/01_platform_foundation/STAGE_INFRA_05_LINT_GOVERNANCE.md`
- `biome.json` (existing Biome configuration from STAGE_INFRA_04_BIOME)
- `scripts/ai-guard.ts` (AI-Guard architecture enforcement script)
- `scripts/infra-audit.ts` (Infra audit script)
- `package.json` (root scripts)
- `lint-staged.config.mjs` (existing lint-staged config)
- `specs/runtime/infra-005-lint-governance/spec.md`
- `specs/runtime/infra-005-lint-governance/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                          | Rationale                                                                       |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Biome is the sole formatting + lint tool          | Already established in STAGE_INFRA_04_BIOME; no ESLint/Prettier regression      |
| 2   | AI-Guard runs in pre-commit AND CI                | Dual enforcement catches violations both locally and at pipeline gate           |
| 3   | Import order: 5-group canonical structure         | Node built-ins → External → Zidney packages → App-local → Relative              |
| 4   | `bun` is the exclusive package manager            | Detected lockfile: `bun.lock`. All commands use `bun` or `bunx`                 |
| 5   | CODEOWNERS enforcement deferred to follow-up      | Module ownership documented in this stage; CODEOWNERS file is out of scope      |
| 6   | `bun run arch:audit` is advisory, not CI-blocking | AI-Guard is the CI-blocking architectural check; arch:audit is maintenance-only |

---

## Functional Requirements Captured

- FR-01: Biome lint rule hardening — configure critical rules at `error` level
- FR-02: Import order convention — 5-group canonical import ordering enforced by Biome
- FR-03: AI-Guard pre-commit activation — runs architectural boundary validation before every commit
- FR-04: lint-staged verification — `biome check --write` applied to staged files
- FR-05: CI gate enforcement — `bun run lint` + `bun run type-check` + `bun scripts/ai-guard.ts` are all blocking
- FR-06: Architecture intelligence freshness (advisory) — `arch:audit` as maintenance command, not CI gate
- FR-07: Module ownership policy — critical packages documented; CODEOWNERS deferred
- FR-08: Pre-push hook (advisory) — optional hook that runs full checks before push
- FR-09: Drift prevention strategy — architecture drift prevention documented for developers and AI agents

---

## Clarifications Required

| #   | Location | Question                                                                         | Selected Default                                                                  |
| --- | -------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | FR-06    | Should `bun run arch:audit` be a mandatory blocking CI step?                     | **No** — advisory maintenance command only; AI-Guard covers CI blocking           |
| 2   | FR-07    | Should a `CODEOWNERS` file enforce mandatory human review for critical packages? | **No** — documentation-level policy only in this stage; CODEOWNERS is a follow-up |

Both defaults accepted. No blockers.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                           |
| --------------------------------------- | ------ | --------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | INFRA stage — no runtime, tenant, or data-layer changes         |
| License middleware requirement captured | ✅ N/A | No API routes involved in this stage                            |
| Snapshot integrity requirement captured | ✅ N/A | No attempt engine involvement                                   |
| Idempotency strategy defined            | ✅ N/A | No database writes; lint runs are idempotent by nature          |
| Transaction boundaries identified       | ✅ N/A | No database transactions                                        |
| Server-authoritative time enforced      | ✅ N/A | No time-sensitive operations                                    |
| Import boundary rules respected         | ✅     | Stage purpose is to enforce these rules                         |
| No new runtime dependencies introduced  | ✅     | Only developer tooling; Biome and lint-staged already installed |

**Overall:** COMPLIANT

---

## Open Risks

| #   | Risk                                                 | Probability | Impact | Mitigation                                                                 |
| --- | ---------------------------------------------------- | ----------- | ------ | -------------------------------------------------------------------------- |
| 1   | Biome import organizer conflicts with existing code  | Medium      | Medium | Run `biome check --write` across repo; measure violations before enforcing |
| 2   | AI-Guard false positives blocking legitimate commits | Low         | High   | Document override procedure; tune guard rules during implementation        |
| 3   | lint-staged slow on large changesets                 | Low         | Low    | Scope hooks to staged files only (already the default behavior)            |
| 4   | CI Biome version drift from local                    | Low         | Medium | Pin Biome version in package.json; script enforces consistent version      |

---

## Next Step

→ **Clarify** — resolve any remaining `[NEEDS CLARIFICATION]` markers and lock clarifications before planning.
