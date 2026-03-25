# Tasks Report — Policy Engine and Governance Rules Layer

**Step:** 4 — Tasks
**Timestamp:** 2026-03-25T01:45:00Z
**Status:** COMPLETE

---

## Summary

54 atomic tasks generated across 5 sequential phases (A–E). The task set covers directory
scaffolding, all TypeScript interfaces, the engine/registry/loader core, 4 adapters, 8 rule files,
2 reporters, CLI, package.json wiring, full unit + integration + gate test suites, Husky hook
update, CI workflow, and 4 gate validation runs. No database migrations or HTTP routes are involved.

---

## Inputs Reviewed

- `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/spec.md`
- `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/plan.md`
- `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/data-model.md`
- `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/tasks.md`

---

## Task Breakdown

| Phase | Category                                  | Tasks     | Count  | Notes                                                                                |
| ----- | ----------------------------------------- | --------- | ------ | ------------------------------------------------------------------------------------ |
| A     | Foundation — core infrastructure          | T001–T005 | 5      | Strictly sequential; blocks all downstream phases                                    |
| B     | Adapters — legacy tool wrappers           | T006–T009 | 4      | All parallel (T006 arch:guard, T007 type-safety, T008 script-governance, T009 Trivy) |
| C     | Rules — 8 governance rules                | T010–T017 | 8      | All parallel (ARCH-001, SCRIPTS-001–004, TYPES-001, AI-001, SECURITY-001)            |
| D     | CLI & Reporters                           | T018–T021 | 4      | T018+T019 parallel; T020 depends on both; T021 (package.json) sequential after T020  |
| E     | Tests — unit (×17)                        | T022–T038 | 17     | All parallel                                                                         |
| E     | Tests — integration (×4)                  | T039–T042 | 4      | All parallel                                                                         |
| E     | Tests — gate validation files (×6)        | T043–T048 | 6      | All parallel                                                                         |
| E     | Infra — Husky + CI                        | T049–T050 | 2      | Sequential after T020–T021                                                           |
| E     | Gate runs — 4 sequential gate validations | T051–T054 | 4      | Strictly sequential after T022–T050                                                  |
|       | **Total**                                 |           | **54** |                                                                                      |

---

## Risk-Ranked Task Summary

| Task IDs        | Risk      | Description                                                                                                    |
| --------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| T049            | 🔴 HIGH   | Modify `.husky/pre-commit` — replaces existing gate invocations; pre-commit hook breakage prevents all commits |
| T004            | 🟡 MEDIUM | `engine.ts` — AbortController, parallel/sequential dispatch, safeEvaluate, timeout guard                       |
| T005            | 🟡 MEDIUM | `context/loader.ts` — git, GitNexus, Trivy file reads, graceful degradation                                    |
| T006–T009       | 🟡 MEDIUM | Adapters — subprocess spawning, stdout/stderr parsing, error recovery                                          |
| T020            | 🟡 MEDIUM | `cli.ts` — argument parsing, rule imports (side-effect), exit code logic                                       |
| T050            | 🟡 MEDIUM | New CI workflow `policy-check.yml` — must be locally testable via `act`                                        |
| T051–T054       | 🟡 MEDIUM | Gate validation runs — gates must pass on clean repo; any adapter mismatch blocks Gate 1                       |
| T001–T003       | 🟢 LOW    | Directory scaffolding, types.ts, registry.ts                                                                   |
| T010–T017       | 🟢 LOW    | Rule files — mostly delegation + pure logic; no subprocess I/O                                                 |
| T018–T019, T021 | 🟢 LOW    | Reporters, package.json entry                                                                                  |
| T022–T048       | 🟢 LOW    | Test files (writing only; gate runs are MEDIUM)                                                                |

---

## Tasks with External Dependencies

| Task | Dependency                                 | Notes                                                                                     |
| ---- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| T006 | `arch:guard`, `arch:guard:changed` scripts | Adapter wraps existing CLI; must return `PolicyResult[]` JSON when `--json` flag is added |
| T007 | `bun typecheck`, `arch:type-safety-guard`  | Parses tsc stderr diagnostics                                                             |
| T008 | `validate:runtime:scripts --json`          | Requires `--json` flag support to be verified                                             |
| T009 | `tmp/trivy-report.json`                    | Reads Trivy output file; absent file returns `[]`                                         |
| T005 | `docs/ai/context/gitnexus-context.json`    | GitNexus context artifact; stale detection via `GITNEXUS_MAX_AGE_HOURS`                   |
| T050 | `oven-sh/setup-bun@v1` GitHub Action       | CI workflow requires this Action                                                          |

---

## High-Downstream-Impact Tasks

| Task | Module                            | Impact | Description                                                                                 |
| ---- | --------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| T049 | `.husky/pre-commit`               | HIGH   | Replaces existing governance invocations — any regression blocks all commits on this branch |
| T020 | `scripts/policy-engine/cli.ts`    | HIGH   | Entry point for all downstream consumers (Husky, CI, orchestrator)                          |
| T004 | `scripts/policy-engine/engine.ts` | HIGH   | Central execution engine — all rule dispatch flows through this                             |

---

## Transactional Tasks

Not applicable — no database writes in this stage. All tasks produce read-only analysis output.

---

## Idempotency Tasks

- Gate 2 (T052) — `determinism.test.ts` explicitly validates that two sequential `engine.check()` calls on identical context produce byte-identical output, enforcing engine idempotency.
- `policy:check` CLI (T020, T051–T054) is inherently idempotent — same repository state always produces the same result.

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                                                                                                     |
| -------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | No database writes — not applicable                                                                                                       |
| Idempotency tasks are defined where required | ✅     | Gate 2 determinism test (T052)                                                                                                            |
| Layer boundary rules are respected           | ✅     | All files under `scripts/policy-engine/` — no `apps/*` imports permitted                                                                  |
| No unrelated file modifications planned      | ✅     | Only: `scripts/policy-engine/`, `.husky/pre-commit`, `.github/workflows/policy-check.yml`, root `package.json` (policy:check script only) |
| Migration tasks included when required       | ✅     | No migrations required                                                                                                                    |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                                                                                                                | Mitigation                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `validate:runtime:scripts` may not support `--json` flag                                                                            | Verify in T008; if missing, the adapter must parse text output or the flag must be added via a separate task |
| Husky hook replacement (T049) could break existing pre-commit gates if `policy:check --changed` does not fully cover the same scope | Gate 1 parity tests (T043–T045) must pass before T049 is committed                                           |
| `arch:guard` `--json` flag availability                                                                                             | Verified in plan.md Section 4.1; document expected output format in adapter                                  |

---

## Next Step

Proceed to Step 5 — Analyze.
