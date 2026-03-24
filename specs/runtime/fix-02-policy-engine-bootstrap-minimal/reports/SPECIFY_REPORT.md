# Specify Report — STAGE FIX 02 — Policy Engine Bootstrap Minimal

**Step:** 1 — Specify  
**Timestamp:** 2026-03-24T00:00:00Z  
**Status:** COMPLETE

---

## Summary

Specification drafted for a minimal, self-contained Policy Engine bootstrap. The stage introduces three TypeScript files under `scripts/policy-engine/` (`types.ts`, `registry.ts`, `runner.ts`) and a `validate:policy` script in the root `package.json`. The engine loads rules from a registry, executes them sequentially, and exits with code `0` (pass or warnings only) or `1` (any error-severity failure). Implementation is deliberately constrained to < 200 LOC with zero new external dependencies.

---

## Inputs Reviewed

- `specs/phases/0X_FIXES/STAGE_FIX_02_POLICY_ENGINE_BOOTSTRAP_MINIMAL.md`
- `specs/runtime/fix-02-policy-engine-bootstrap-minimal/spec.md`
- `specs/runtime/fix-02-policy-engine-bootstrap-minimal/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                         | Rationale                                                                                                  |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | Dummy rule included in initial registry          | Ensures `validate:policy` exits cleanly (code 0) on first run without crashing on empty registry           |
| 2   | Warning-only failures are non-fatal              | Stage spec explicitly states exit 0 for warnings; this separates informational feedback from hard failures |
| 3   | Sequential (not parallel) execution              | Stage spec mandates sequential execution; keeps implementation simple and deterministic                    |
| 4   | scripts/ directory (not a new workspace package) | Stays out of the monorepo package graph; no cross-app boundary violations                                  |
| 5   | No external dependencies                         | Constraint from stage spec; avoids package.json churn and lockfile changes                                 |

---

## Functional Requirements Captured

1. `validate:policy` script in root `package.json` invoking `bun run scripts/policy-engine/runner.ts`
2. `types.ts` exports `PolicyContext`, `PolicyResult`, `PolicyRule` with exact interface shapes
3. `registry.ts` exports `rules: PolicyRule[]` with at least one dummy rule
4. `runner.ts` parses `--changed` / `--full` CLI modes
5. `runner.ts` executes all rules sequentially (awaited)
6. `runner.ts` exits `1` on any `severity: "error"` failure
7. `runner.ts` exits `0` on all-pass or warnings-only
8. Console output: "Policy check passed" (stdout, exit 0) / "Policy check failed" (stderr, exit 1)
9. Dummy rule returns `{ ruleId: "dummy", success: true, severity: "warning" }`
10. Total implementation ≤ 200 LOC; no external dependencies

---

## Clarifications Required

None — stage file provided sufficient detail for all interface and behavioral decisions.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                  |
| --------------------------------------- | ------ | -------------------------------------- |
| No cross-tenant access introduced       | ✅     | scripts/ has no tenant or DB imports   |
| License middleware requirement captured | ✅ N/A | Infrastructure script; no HTTP routes  |
| Snapshot integrity requirement captured | ✅ N/A | No attempt/exam engine involvement     |
| Idempotency strategy defined            | ✅ N/A | Script runner; idempotency is inherent |
| Transaction boundaries identified       | ✅ N/A | No database writes                     |
| Server-authoritative time enforced      | ✅ N/A | No time-sensitive operations           |

**Overall:** COMPLIANT

---

## Open Risks

- `validate:policy` script name must not conflict with any existing scripts in root `package.json`. To be verified during clarify/plan.

---

## Next Step

Proceed to Step 2 — Clarify.
