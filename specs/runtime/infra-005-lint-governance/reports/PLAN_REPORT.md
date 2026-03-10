# Plan Report — STAGE_INFRA_05_LINT_GOVERNANCE

**Step:** 3 — Plan **Timestamp:** 2026-03-07T00:03:00.000Z **Status:** COMPLETE — Guardian
Validation: PASS

---

## Summary

Technical plan for lint governance is complete. Research identified a minimal change set: one Biome
lint rule severity adjustment, one new CI arch-guard job, one stale CI step removal, and one stale
comment fix in the pre-commit hook. The plan is surgical — 4 files changed, 1 documentation file
created. lint-staged is already compliant. AI-Guard is already active locally. The primary gap
closed by this stage is the missing CI architectural gate on `infra-*` and `feature/*` branches.

---

## Inputs Reviewed

- `specs/runtime/infra-005-lint-governance/spec.md`
- `specs/runtime/infra-005-lint-governance/plan.md`
- `specs/runtime/infra-005-lint-governance/research.md`
- `biome.json` — existing config
- `lint-staged.config.mjs` — existing config
- `scripts/ai-guard.ts` — existing guard
- `package.json` — root scripts
- `.github/workflows/ci.yml` (current CI pipeline)

---

## Architecture Layers Touched

| Layer                     | Planned Changes                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| Developer Toolchain       | `biome.json` rule hardening (1 rule severity change)                                       |
| CI/CD Pipeline            | Add `arch-guard` job to `ci.yml`; remove redundant format step                             |
| Pre-commit Hooks          | Fix stale comment in `.husky/pre-commit` (cosmetic only)                                   |
| Documentation             | Create `docs/governance/LINT_GOVERNANCE.md` — drift prevention and module ownership policy |
| Database / API / Frontend | **Not touched**                                                                            |

---

## Key Technical Decisions

| #   | Decision                                                 | Rationale                                                                            |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Only one `biome.json` change needed                      | `noUnreachable: warn → error`; all other rules already correct                       |
| 2   | lint-staged unchanged — already compliant                | `biome check --write` on staged files already in place                               |
| 3   | Add `arch-guard` CI job                                  | Closes gap: AI-Guard was absent from `ci.yml` for `infra-*` and `feature/*` branches |
| 4   | `arch:audit` remains advisory                            | CL-01 decision: AI-Guard is the CI gate; `arch:audit` is maintenance only            |
| 5   | No CODEOWNERS file                                       | CL-02 decision: deferred to follow-up governance stage                               |
| 6   | Module ownership documented in ARCHITECTURE_MAP.json     | `criticality` field already exists; doc policy created in `LINT_GOVERNANCE.md`       |
| 7   | Remove redundant `bun biome format .` from CI `lint` job | Already runs inside `bun run lint`; duplicate step is wasteful                       |
| 8   | Pre-push hook remains advisory                           | FR-08 decision: advisory only, not blocking                                          |

---

## File Change Manifest

| File                                 | Action | Why                                                |
| ------------------------------------ | ------ | -------------------------------------------------- |
| `biome.json`                         | Modify | `noUnreachable: warn → error`                      |
| `.github/workflows/ci.yml`           | Modify | Add `arch-guard` job; remove redundant format step |
| `.husky/pre-commit`                  | Modify | Fix stale ESLint/Prettier comment                  |
| `docs/governance/LINT_GOVERNANCE.md` | Create | Drift prevention + module ownership policy         |

---

## Migration Impact

| Item                  | Value | Notes                                    |
| --------------------- | ----- | ---------------------------------------- |
| Migration required    | No    | INFRA stage — no database changes        |
| `schema_version` bump | No    | Not applicable                           |
| Backward compatible   | Yes   | All changes are developer toolchain only |

---

## Transaction Boundaries

Not applicable — this is an INFRA toolchain stage with no database writes.

---

## Idempotency Strategy

Not applicable — lint operations are inherently idempotent. Running `biome check` multiple times
produces the same result.

---

## Guardian Validation Results

| Guardian                    | Verdict | Notes                                                          |
| --------------------------- | ------- | -------------------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS | Plan is tightly scoped to INFRA toolchain; all 7 checks passed |
| API Designer                | ✅ N/A  | No API routes or contracts in this stage                       |

**Overall Guardian Verdict: PASS — Task generation authorized.**

---

## Next Step

→ **Tasks** — generate the atomic, dependency-ordered task list from this plan.
