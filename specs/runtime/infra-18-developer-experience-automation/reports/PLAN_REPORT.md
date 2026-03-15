# Plan Report — Developer Experience Automation

**Step:** 3 — Plan
**Timestamp:** 2026-03-15T00:00:00Z
**Status:** COMPLETE

---

## Summary

Technical plan complete for STAGE_INFRA_18. Four TypeScript scripts under `scripts/dev/` deliver a
fully self-diagnosing, self-repairing, and easy-to-onboard developer experience. No new packages,
no migrations, no API endpoints, no database access. Guardian validation: both Zidney Architecture
Checker and Zidney API Designer returned **VERDICT: PASS**.

---

## Inputs Reviewed

- `specs/runtime/infra-18-developer-experience-automation/spec.md`
- `specs/runtime/infra-18-developer-experience-automation/plan.md`
- (no research.md, data-model.md, or contracts/ — tooling stage with no unknowns)

---

## Architecture Layers Touched

| Layer       | Planned Changes                                                      |
| ----------- | -------------------------------------------------------------------- |
| API         | None                                                                 |
| Worker      | None                                                                 |
| Frontend    | None                                                                 |
| DB Master   | None                                                                 |
| DB Tenant   | None                                                                 |
| Dev Tooling | 4 new scripts under `scripts/dev/` + 4 `package.json` script entries |
| CI          | 1 new job added to `.github/workflows/ci.yml` Group 1                |
| Docs        | `README.md` Developer Quick Commands section added                   |

---

## Key Technical Decisions

| #   | Decision                                                    | Rationale                                                                                |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Inline formatter in each script (no shared module)          | `packages/logger` is forbidden; 10-line copy is correct to avoid boundary violations     |
| 2   | All `repo:fix` steps run regardless of failure              | Continue-on-error; final exit code reflects whether any step failed                      |
| 3   | `repo:onboard` step 1 is hard abort on Bun version mismatch | Version mismatch means subsequent steps cannot be trusted                                |
| 4   | `.env` check is key-existence only                          | Values never read/stored/emitted — security contract from clarifications Q3              |
| 5   | `repo:status` always exits 0                                | Read-only reporter; blocking CI on a status query is incorrect                           |
| 6   | `engines.bun` added to root `package.json`                  | Required as version source for `repo:onboard` step 1; aligned to CI `BUN_VERSION: 1.3.9` |
| 7   | CI placement in Group 1 (parallel, no `needs:`)             | Zero service dependencies; fast environment gate profile                                 |
| 8   | `ARCHITECTURE_MAP.json` not updated                         | `scripts/dev/` is outside tracked `apps/*` and `packages/*` module roots                 |

---

## Guardian Validation

| Guardian                    | Verdict | Violations                                                                        |
| --------------------------- | ------- | --------------------------------------------------------------------------------- |
| Zidney Architecture Checker | PASS    | 3 × LOW advisory (Stage Status lifecycle, semver edge case, cached CI status)     |
| Zidney API Designer         | PASS    | 1 × MEDIUM (stderr vs stdout for actionable messages), 1 × LOW (status allowlist) |

**All violations are non-blocking. Implementation authorized.**

MEDIUM finding mitigation: The `line()` formatter will route `detail` on `error`-status lines to `process.stderr` in addition to `process.stdout`, ensuring CI consumers separating streams receive actionable guidance.

---

## Migration Impact

| Item                  | Value | Notes                 |
| --------------------- | ----- | --------------------- |
| Migration required    | No    | No schema changes     |
| `schema_version` bump | No    | No DB involvement     |
| Backward compatible   | Yes   | Additive changes only |

---

## Transaction Boundaries

Not applicable — no database writes in this stage.

---

## Idempotency Strategy

All four scripts are inherently idempotent:

- `repo:doctor` → read-only diagnostic; safe to re-run at any time
- `repo:fix` → repair operations are repeatable without side effects
- `repo:onboard` → dependency install and setup are idempotent
- `repo:status` → read-only reporter

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                |
| -------------------------------------- | ------ | ---------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | Developer tooling only; no tenant DB access          |
| All writes are transactional by design | ✅     | N/A — no database writes                             |
| Server-authoritative time enforced     | ✅     | N/A — no time-sensitive operations                   |
| License middleware enforced            | ✅     | N/A — no workspace-bound routes                      |
| Version compatibility enforced         | ✅     | `engines.bun` check in `repo:onboard`                |
| No architecture redesign without ADR   | ✅     | No new modules; `scripts/dev/` outside tracked roots |

**Overall:** COMPLIANT

---

## Open Risks

None blocking. Two advisory items noted:

1. Inline semver check in `repo:onboard` does not handle pre-release tags (LOW, tooling-only)
2. `.cache/ci-status.json` status field should be validated against allowlist before rendering (LOW)

---

## Next Step

Proceed to Step 4 — Tasks.
