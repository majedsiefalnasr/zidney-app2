# Clarify Report — STAGE FIX 03 — Build Test and Repository Cleanliness Enforcement

**Step:** 2 — Clarify  
**Timestamp:** 2026-03-24T00:02:00Z  
**Status:** COMPLETE

---

## Summary

Five clarification questions identified and resolved during ambiguity scan of `spec.md`. All ambiguities are now encoded directly into the spec under `## Clarifications / ### Session 2026-03-24`. Checklists (security, performance, accessibility) generated and written to `checklists/`.

---

## Clarifications Locked

### Session 2026-03-24

| #   | Category                                                     | Question                                                  | Resolution                                                                                                                                                                        |
| --- | ------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Script naming                                                | `policy:check` vs `validate:policy` — are they the same?  | **Option C** — standardize to `validate:policy` everywhere. `policy:check` removed. Script naming governance convention: `validate:policy` is canonical.                          |
| 2   | Security validation architecture                             | Does the policy engine need auth/authorization?           | **No** — infra tool only. Security enforced at Husky pre-commit/pre-push layer calling policy engine. No additional auth layer needed within policy engine itself.                |
| 3   | Concurrency / locking                                        | How are test isolation races handled in CI?               | Tests run serially per module via `--pool=forks --isolate`. Parallel CI jobs use separate DB schemas per tenant isolation model. No additional locking needed in this stage.      |
| 4   | Error contract format                                        | What format does policy engine failures use?              | Standard Zidney contract: `{ success: boolean, data: object \| null, error: { code, message } \| null }`. Non-zero exit on `error`-severity; zero exit on warnings-only or clean. |
| 5   | Integration fallback when INFRA-29 Policy Engine unavailable | What happens if the policy engine module fails at import? | **Hard fail** — exits non-zero with "Policy engine unavailable — cannot validate". No soft fallback to direct `bun run build` / `bun run test` permitted.                         |

---

## Spec Mutations Applied

- `User Story 5`: `policy:check` → `validate:policy`
- `Edge Cases`: hard-fail behavior added for unavailable policy engine
- `FR-010`: renamed to use `validate:policy`; `FR-014` updated to reference Zidney error contract
- `NFC-008` (security boundary) and `NFC-009` (test concurrency/serialization) added
- `Key Entities — PolicyResult`: updated to reference Zidney error contract

---

## Checklists Generated

| Checklist                     | Items              | Key Gaps Surfaced                                                                                                |
| ----------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `checklists/security.md`      | 24 (CHK001–CHK024) | Secret leakage in structured output, log injection via `violatingPaths[]`, license middleware omission detection |
| `checklists/performance.md`   | 24 (CHK001–CHK024) | Machine spec baseline missing for timing SCs, GitNexus regen cost unspecified                                    |
| `checklists/accessibility.md` | 16 (CHK001–CHK016) | CLI stdout/stderr stream separation, JSON schema for `validate:policy` output                                    |

---

## Risk Level Assessment

Scoring factors present:

| Factor                                                                 | Points |
| ---------------------------------------------------------------------- | ------ |
| Security-sensitive logic (policy enforcement, secret scan integration) | +3     |
| New package/module introduced (Policy Engine rules under INFRA-29)     | +1     |
| External integration (GitNexus context for `--changed` mode)           | +2     |

**Total score: 6 → Risk Level: MEDIUM**

---

## Constitutional Compliance

| Check                        | Status | Notes                                                |
| ---------------------------- | ------ | ---------------------------------------------------- |
| No cross-tenant access       | ✅     | Infra-only stage; no tenant data access              |
| License middleware preserved | ✅     | NFC-003 confirmed                                    |
| Snapshot integrity           | ✅     | Out of scope — NFC-001 no architecture redesign      |
| Idempotency                  | ✅     | NFC-006 — policy engine runs deterministic rule sets |
| Transaction boundaries       | ✅     | N/A — infra stage; no DB writes                      |
| Server-authoritative time    | ✅     | NFC-004 confirmed                                    |

**Overall:** COMPLIANT — Planning authorized

---

## Next Step

Proceed to Step 3 — Plan.
