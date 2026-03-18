# Specify Report — Local CI Simulation With Act

**Step:** 1 — Specify
**Timestamp:** 2026-03-17T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification for STAGE_INFRA_23 — Local CI Simulation With Act was generated and validated. The
spec defines a deterministic local CI simulation layer using `act` to run GitHub Actions workflows
locally before pushing. All 12 functional requirements and 6 user stories were captured. No
`[NEEDS CLARIFICATION]` markers were introduced. The spec is constitutionally compliant: no
database access, no tenant isolation impact, no middleware modifications.

---

## Inputs Reviewed

- `specs/runtime/infra-023-local-ci-simulation-with-act/spec.md`
- `specs/runtime/infra-023-local-ci-simulation-with-act/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                    | Rationale                                                                                                      |
| --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | `act` is mandatory for closure              | Prevents broken workflows reaching GitHub; eliminates late feedback loops                                      |
| 2   | `.actrc` maps ubuntu-latest to act image    | Ensures consistent runner behavior across developer machines                                                   |
| 3   | `.act.secrets` is never committed           | Real secrets must not be in the repository; local test-safe values only                                        |
| 4   | `bun run ci:local` uses `--pull=false`      | Fast execution path for default developer use; `ci:local:full` available for full image pull                   |
| 5   | `scripts/run-local-ci.ts` aggregates checks | Governance validation (type-check, lint, architecture guard) + act execution in a single composable entrypoint |
| 6   | Orchestrator gate blocks closure on failure | No stage can be declared production-ready with broken local CI                                                 |

---

## Functional Requirements Captured

- FR-01: `act` installation documented (Homebrew / install script); Docker prerequisite stated
- FR-02: `.actrc` maps `ubuntu-latest` to `ghcr.io/catthehacker/ubuntu:act-latest`
- FR-03: Root `package.json` gains four scripts: `ci:local`, `ci:local:full`, `ci:local:workflow`, `ci:local:list`
- FR-04: `.act.secrets` created with test-safe values; `.gitignore` updated to exclude it
- FR-05: Workflow compatibility audit covers all files under `.github/workflows/`
- FR-06: `scripts/run-local-ci.ts` runs governance checks then `bun run ci:local`; exits non-zero on failure
- FR-07: Orchestrator closure gate executes `bun run ci:local`; blocks closure on non-zero exit
- FR-08: Dev workflow documented: run `bun run ci:local` before `git push`
- FR-09: CI parity contract — every workflow file MUST be locally executable via `act`
- FR-10: Failure policy — closure is BLOCKED if `act` fails or any workflow job fails
- FR-11: Performance profiles defined (fast: `--pull=false`; full: `act`)
- FR-12: `docs/ci/local-ci.md` and `AGENTS.md` update covering setup, run, troubleshoot

---

## Clarifications Required

None — spec is complete with no open items.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                      |
| --------------------------------------- | ------ | ---------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Stage introduces zero database access or tenant resolution |
| License middleware requirement captured | ✅     | Not applicable — no workspace-bound routes                 |
| Snapshot integrity requirement captured | ✅     | Not applicable — no attempt/grading logic                  |
| Idempotency strategy defined            | ✅     | Script execution is idempotent by nature                   |
| Transaction boundaries identified       | ✅     | Not applicable — no database writes                        |
| Server-authoritative time enforced      | ✅     | Not applicable — governance tooling only                   |

**Overall:** COMPLIANT

---

## Open Risks

- Docker not running on developer machine → mitigated by early fail-fast check in `run-local-ci.ts`
- Workflow incompatibility with `act` → mitigated by T005 compatibility audit requirement
- Slow image pull → mitigated by `--pull=false` default profile

---

## Next Step

Proceed to Step 2 — Clarify.
