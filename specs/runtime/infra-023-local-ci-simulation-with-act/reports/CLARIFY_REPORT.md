# Clarify Report — Local CI Simulation With Act

**Step:** 2 — Clarify
**Timestamp:** 2026-03-17T00:02:00.000Z
**Status:** COMPLETE

---

## Summary

Ambiguity scan completed on `spec.md` for STAGE_INFRA_23. Five targeted clarification questions
were asked and resolved. No blocking ambiguities remain. All spec sections affected by
clarifications were updated in-place. The spec is now unambiguous and ready for technical planning.

---

## Inputs Reviewed

- `specs/runtime/infra-023-local-ci-simulation-with-act/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                         | Resolution                                                                                     | Impact                                                  |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | Should `.act.secrets` be added to `.gitignore` explicitly?       | Yes — explicit entry required; existing `.secrets` glob does not cover it                      | FR-04 updated; `.gitignore` must include `.act.secrets` |
| 2   | What lint scope is included in `run-local-ci.ts`?                | `bun run lint` (full-repo Biome check) added as step 6 before `bun run ci:local`               | FR-06 updated with explicit lint step                   |
| 3   | Does `ci:local:workflow` accept a workflow file argument?        | Yes — optional filename arg; defaults to all workflows when omitted                            | US-03 acceptance criteria clarified                     |
| 4   | How should failed workflows report — exit code only or detailed? | Per-step PASS/FAIL lines printed during run; summary table at end; full output on failure only | FR-09 / Observability section added                     |
| 5   | Is AGENTS.md update scoped to root only or also per-app?         | Root `AGENTS.md` only; per-app files remain unaffected                                         | FR-12 scoped to root AGENTS.md                          |

---

## Open Items

None — all ambiguities resolved.

---

## Spec Updates Applied

- FR-04: `.gitignore` must explicitly include `.act.secrets`
- FR-06: `run-local-ci.ts` includes `bun run lint` as step 6 before `bun run ci:local`
- US-03 Acceptance Criteria: `ci:local:workflow` clarified to accept optional workflow filename arg
- Observability section added: per-step PASS/FAIL output + summary table behavior defined
- FR-12: AGENTS.md scope narrowed to root only

---

## Constitutional Compliance

| Check                                     | Status | Notes                                               |
| ----------------------------------------- | ------ | --------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 questions resolved with no open markers         |
| Transaction strategy confirmed            | ✅     | Not applicable — no database operations introduced  |
| Idempotency strategy confirmed            | ✅     | Governance checks are read-only; `act` is stateless |
| Isolation boundaries confirmed            | ✅     | Repo-root config + scripts/ domain only             |
| Version and license constraints confirmed | ✅     | Not applicable — governance tooling only            |

**Overall:** COMPLIANT

---

## Open Risks

- Strict `.gitignore` requirement for `.act.secrets` — team members must not accidentally commit
  secrets; addressed by explicit entry and documentation in `docs/ci/local-ci.md`.

---

## Next Step

Proceed to Step 3 — Plan.
