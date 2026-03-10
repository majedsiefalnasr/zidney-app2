# Specify Report — Infra Governance

**Step:** 1 — Specify **Timestamp:** 2026-03-05T00:00:00.000Z **Status:** COMPLETE

---

## Summary

The specification for the **Infra Governance** stage has been completed and validated. This is a
constitutional-level, tooling-only stage that establishes mandatory infrastructure governance across
the entire Zidney monorepo. The spec defines 12 functional requirement groups (FR-01 through FR-12)
covering all eight governance areas from the source stage file. No `[NEEDS CLARIFICATION]` markers
remain. All checklist items pass.

---

## Inputs Reviewed

- `specs/runtime/infra-governance/spec.md`
- `specs/runtime/infra-governance/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                                   | Rationale                                                                 |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Coverage thresholds enforced after baseline measurement, not retroactively | Prevents false-blocking of pre-existing code; ensures fairness            |
| 2   | ESLint rule escalation (warn → error) requires explicit review             | Avoids breaking existing developer workflows silently                     |
| 3   | E2E runs Chromium-only in CI                                               | Multi-browser expansion deferred to a future stage for performance        |
| 4   | Husky installed via `prepare` script on `bun install`                      | Standard Husky v9 install pattern — zero manual step for developers       |
| 5   | Existing `vitest.workspace.ts` is retained and formalized, not rebuilt     | Stage formalizes instead of destabilizes; backward compatibility enforced |
| 6   | No ADR required                                                            | Stage is tooling-only; no runtime architecture is modified                |

---

## Functional Requirements Captured

- **FR-01** — Test Tier Separation: Unit / Integration / E2E glob patterns locked
- **FR-02** — Unit Test Requirements: in-memory only, no network/DB, ≥85% coverage
- **FR-03** — Integration Test Requirements: controlled DB/Redis, RFC 7807 compliance, isolation
  boundary assertions
- **FR-04** — E2E Per-App Isolation (LOCKED): each app owns Playwright config, no cross-app
  fixtures, traces on failure
- **FR-05** — Vitest Monorepo Configuration: root workspace file, per-project entries, global
  coverage thresholds
- **FR-06** — ESLint Configuration: root-only, `@typescript-eslint` + `eslint-plugin-vue` +
  `eslint-config-prettier`
- **FR-07** — Prettier Configuration: root-only, Vue3 + TypeScript + Tailwind compatible
- **FR-08** — Pre-Commit Gate: Husky + lint-staged (ESLint fix + Prettier write) + ai-guard +
  infra-audit
- **FR-09** — Pre-Push Gate: full lint + typecheck + unit tests (target: <3 min)
- **FR-10** — CI Enforcement Matrix: 8-step sequence, no `continue-on-error`, branch protection
  enforced
- **FR-11** — README Governance: 7 mandatory sections in every `apps/*` and `packages/*`
- **FR-12** — Hard Mode Enforcement: governance rules mandatory for all future stages

---

## Clarifications Required

None. All specification items are fully defined.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                           |
| --------------------------------------- | ------ | --------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Tooling stage — no DB access of any kind                        |
| License middleware requirement captured | ✅ N/A | Not applicable — no workspace-bound routes                      |
| Snapshot integrity requirement captured | ✅ N/A | Not applicable — no attempt engine interaction                  |
| Idempotency strategy defined            | ✅ N/A | Not applicable — no API endpoints                               |
| Transaction boundaries identified       | ✅ N/A | Not applicable — no database writes                             |
| Server-authoritative time enforced      | ✅ N/A | Not applicable — no runtime logic                               |
| No weakening of existing architecture   | ✅     | Explicitly stated in spec: backward compatible, non-destructive |

**Overall:** COMPLIANT

---

## Open Risks

- **Husky hooks depend on `prepare` script execution** — developers who clone without running
  `bun install` will lack hooks. Mitigation: CI enforces the same checks independently.
- **Coverage baseline measurement must be done before enforcing thresholds** — if thresholds are
  enforced before measurement, previously passing stages may surface unexpected failures.

---

## Next Step

Proceed to Step 2 — Clarify.
