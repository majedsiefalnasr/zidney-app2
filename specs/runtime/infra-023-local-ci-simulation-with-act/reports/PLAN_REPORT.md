# Plan Report — Local CI Simulation With Act

**Step:** 3 — Plan  
**Timestamp:** 2026-03-17T00:03:00.000Z  
**Status:** COMPLETE

---

## Summary

Technical plan generated for INFRA-023. The plan introduces a deterministic local CI simulation
layer using `act` (nektos/act). All 13 implementation tasks defined. Architecture Checker returned
**VERDICT: PASS** with 3 implementation-time corrections applied before this report:

1. T002 reclassified from CREATE to VERIFY — `.actrc` already exists with comprehensive Apple
   Silicon config (`--container-architecture linux/amd64`, 3 runner mappings, `--secret-file .secrets`).
2. AD-06 updated — `.secrets` confirmed as primary secrets file (referenced by `.actrc`), `.act.secrets`
   is an optional secondary file (gitignore entry only, no `.actrc` change).
3. Deliverables table corrected — `.actrc` action changed from "Create" to "Verify (already exists)".

All 5 `.github/workflows/` files confirmed runnable via `act`. Zero workflow YAML modifications required.
CI Parity Contract satisfied from day 1.

---

## Inputs Reviewed

- `specs/runtime/infra-023-local-ci-simulation-with-act/spec.md`
- `specs/runtime/infra-023-local-ci-simulation-with-act/plan.md`
- `specs/runtime/infra-023-local-ci-simulation-with-act/research.md`

---

## Architecture Layers Touched

| Layer     | Planned Changes                                                         |
| --------- | ----------------------------------------------------------------------- |
| API       | None                                                                    |
| Worker    | None                                                                    |
| Frontend  | None                                                                    |
| DB Master | None                                                                    |
| DB Tenant | None                                                                    |
| Scripts   | New: `scripts/run-local-ci.ts` (domain: ci)                             |
| Config    | Verify: `.actrc` (already exists), Modify: `.gitignore`, `package.json` |
| Docs      | New: `docs/ci/local-ci.md`, Modify: `AGENTS.md` (root only)             |

---

## Key Technical Decisions

| #   | Decision                                                              | Rationale                                                                           |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | No new modules — `scripts/run-local-ci.ts` stays in `scripts/` domain | Not imported anywhere; governance scripts are not packages                          |
| 2   | No migration, no schema change                                        | Zero database interaction; architecture trust chain unaffected                      |
| 3   | `ci:local` uses `--pull=false` to override `.actrc`'s `--pull=true`   | Fast daily-use profile; `ci:local:full` provides fresh-image variant                |
| 4   | `.actrc` is NOT modified — existing config is already comprehensive   | Contains Apple Silicon support; overwriting would break M1/M2/M3 developer machines |
| 5   | `.secrets` is primary secrets file (referenced by `.actrc`)           | Already configured; `.act.secrets` gitignore entry added as optional secondary      |
| 6   | `validate:scripts-infra` maps to existing `detect-broken-scripts.ts`  | Avoids creating a new script file; follows domain:action naming convention          |
| 7   | `run-local-ci.ts` runs all 7 steps (not halt on first fail)           | Provides full summary table; developer sees all failures at once                    |

---

## Deliverables Summary

| File                      | Type          | Action                                  |
| ------------------------- | ------------- | --------------------------------------- |
| `.actrc`                  | Config        | Verify (already exists — comprehensive) |
| `.act.secrets`            | Local secrets | Gitignore entry only (not committed)    |
| `.gitignore`              | Config        | Modify (add `.act.secrets` entry)       |
| `package.json`            | Config        | Modify (add 5 script entries)           |
| `scripts/run-local-ci.ts` | Orchestrator  | Create                                  |
| `docs/ci/local-ci.md`     | Documentation | Create (new `docs/ci/` directory)       |
| `AGENTS.md` (root)        | Governance    | Modify (add pre-closure gate rule)      |

---

## Migration Impact

| Item                  | Value | Notes                      |
| --------------------- | ----- | -------------------------- |
| Migration required    | No    | No database changes at all |
| `schema_version` bump | No    | No schema changes          |
| Backward compatible   | N/A   | Governance tooling only    |

---

## Transaction Boundaries

- None — this stage introduces no database writes or reads.

---

## Idempotency Strategy

- `scripts/run-local-ci.ts` is idempotent: no files written/mutated during run, `act` uses
  ephemeral containers (`--rm`), each step is a stateless command invocation.

---

## Constitutional Compliance

| Check                                  | Status | Notes                                          |
| -------------------------------------- | ------ | ---------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | No DB, no tenant context, no API layer         |
| All writes are transactional by design | ✅ N/A | No writes in this stage                        |
| Server-authoritative time enforced     | ✅ N/A | No time-sensitive operations                   |
| License middleware enforced            | ✅ N/A | No workspace-bound routes                      |
| Version compatibility enforced         | ✅ N/A | No schema version changes                      |
| No architecture redesign without ADR   | ✅     | All decisions are additive (`scripts/` domain) |

**Overall:** COMPLIANT

---

## Guardian Validation

| Guardian                    | Verdict | Method         |
| --------------------------- | ------- | -------------- |
| Zidney Architecture Checker | ✅ PASS | runSubagent    |
| Zidney API Designer         | N/A     | No API changes |

**Architecture Checker corrections applied:** 3 (T002 reclassification, AD-06 update, deliverables table)

---

## Workflow Compatibility Audit Summary

| Workflow                      | Act Compatibility  | Notes                                             |
| ----------------------------- | ------------------ | ------------------------------------------------- |
| `ci.yml`                      | RUNNABLE (PARTIAL) | E2E playwright jobs may fail locally — document   |
| `architecture-governance.yml` | RUNNABLE           | `schedule:` trigger skipped by act                |
| `ci-type-safety.yml`          | FULLY RUNNABLE ✅  | No services, no artifacts, no cron                |
| `hard-mode-guard.yml`         | RUNNABLE           | Branch context injection needed for accurate test |
| `ai-context-validation.yml`   | FULLY RUNNABLE ✅  | No services, no artifacts, no cron                |

**CI Parity contract: SATISFIED — zero workflow YAML modifications required.**

---

## Open Risks

- E2E Playwright jobs in `ci.yml` may fail locally if browser binaries not in container image.
  Mitigation: document in `docs/ci/local-ci.md` troubleshooting section as a known limitation.
- `hard-mode-guard.yml` branch context may not match expected spec/ branch pattern when run
  without explicit `--env GITHUB_REF_NAME=...` injection.
  Mitigation: document `act -W .github/workflows/hard-mode-guard.yml --env GITHUB_REF_NAME=spec/...`
  usage in `docs/ci/local-ci.md`.

---

## Next Step

Proceed to Step 4 — Tasks.
