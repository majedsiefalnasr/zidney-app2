# Clarify Report — Infra Governance

**Step:** 2 — Clarify **Timestamp:** 2026-03-05T00:02:00.000Z **Status:** COMPLETE

---

## Summary

Five targeted clarification questions were raised and fully resolved during the session. All
clarifications have been appended to `spec.md` in the `## Clarifications / ### Session 2026-03-05`
section. The risk profile of the spec is unchanged: **LOW** — this remains a tooling-only stage with
no database, tenant isolation, or runtime concerns.

---

## Inputs Reviewed

- `specs/runtime/infra-governance/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                                                           | Resolution                                                                                                                                                                                                      | Impact                                            |
| --- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Are `ai-guard.ts` and `infra-audit.ts --quick` hard gates or advisory in pre-commit?               | **Hard gates** — non-zero exit blocks commit; both scripts must be idempotent                                                                                                                                   | FR-08 now unambiguous                             |
| 2   | `no-console: warn` vs `no-console: error` in "CI strict mode" — which is authoritative?            | **`warn` everywhere** for this stage. "CI strict mode" is a future target, not implemented here. FR-06.5 is authoritative                                                                                       | FR-12.6 language clarified; no escalation planned |
| 3   | Must existing per-app `vitest.config.ts` files (e.g. `apps/api/vitest.config.ts`) be deleted?      | **Retained** — "standalone" means unregistered in root workspace. All existing configs are project-entry configs, not standalone                                                                                | Non-destructive migration confirmed               |
| 4   | Does Coverage Validation CI job enforce threshold against unit only or unit+integration aggregate? | **Unit-test coverage only** is threshold-enforced. Integration coverage is informational. CI matrix dependency on "Unit Tests" (not Integration) is intentional                                                 | FR-10 dependency chain is authoritative           |
| 5   | Is `--no-verify` absolutely forbidden or is there an emergency escape?                             | **Emergency exceptions permitted** with strict protocol: GitHub Issue within 24h, `[emergency-bypass]` tag in commit, quality gates must pass in next commit. Force-push to `main` remains absolutely forbidden | FR-12.5 now has documented escape hatch           |

---

## Open Items

None.

---

## Spec Updates Applied

- **FR-08** — exit-code contract added: both `ai-guard.ts` and `infra-audit.ts` are hard gates;
  idempotency requirement stated
- **FR-06.5** — `no-console` severity resolved to `warn`; escalation path explicitly deferred to a
  future stage
- **FR-05.3** — "standalone" defined precisely: a config is standalone only if NOT registered in
  root workspace; no deletion of existing per-app configs
- **FR-10 row 6** — Coverage Validation scoped to unit-test coverage; integration informational only
- **FR-12.5 + FR-12.6** — emergency bypass protocol added; "CI strict mode" ambiguity removed

---

## Constitutional Compliance

| Check                                     | Status | Notes                                              |
| ----------------------------------------- | ------ | -------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 questions fully resolved                       |
| Transaction strategy confirmed            | ✅ N/A | No DB access in this stage                         |
| Idempotency strategy confirmed            | ✅     | Scripts (ai-guard, infra-audit) must be idempotent |
| Isolation boundaries confirmed            | ✅     | Per-app E2E isolation contract unchanged and clear |
| Version and license constraints confirmed | ✅ N/A | Not applicable to tooling stage                    |

**Overall:** COMPLIANT

---

## Open Risks

- **Emergency bypass protocol reliance on developer honesty** — the protocol requires a GitHub Issue
  within 24h. This depends on developer discipline. Mitigation: the CI pipeline still blocks the
  bypassed commit's branch until quality gates pass in the next commit.

---

## Next Step

Proceed to Step 3 — Plan.
