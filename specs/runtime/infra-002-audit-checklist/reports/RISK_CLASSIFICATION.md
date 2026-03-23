# Risk Classification — INFRA_AUDIT_CHECKLIST

## Related Documents

- [GAP_REPORT.md](./GAP_REPORT.md)
- [SAFE_ROLLOUT_PLAN.md](./SAFE_ROLLOUT_PLAN.md)

---

## Audit Metadata

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Timestamp | 2026-03-04T09:37:45.391Z                   |
| Git SHA   | `10d878c3ae506e15ecd470327598ac87de186fb2` |
| Branch    | `infra-002-audit-checklist`                |
| Auditor   | speckit.implement (automated audit stage)  |

---

## Risk Matrix

| Gap ID | Gap Description                                                                | Risk Level | Severity | Likelihood | Impact | Blocking? | Rationale                                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------ | ---------- | -------- | ---------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-T1 | 10 test files contain skip markers (not running in CI)                         | HIGH       | HIGH     | CONFIRMED  | HIGH   | YES       | License-related tests are explicitly skipped, meaning license enforcement is untested in CI — a direct governance integrity risk.                                               |
| GAP-L4 | 10 pre-existing ESLint errors in the codebase                                  | HIGH       | HIGH     | CONFIRMED  | HIGH   | YES       | Existing ESLint errors indicate the codebase does not pass its own static analysis rules, making enforcement escalation impossible without first clearing the backlog.          |
| GAP-C1 | `test-stage-001.yml` lacks lint and type-check steps                           | HIGH       | HIGH     | CONFIRMED  | HIGH   | YES       | The primary platform foundation test workflow does not run static analysis, meaning TS errors and ESLint violations can be merged to the platform foundation branch undetected. |
| GAP-C2 | No coverage threshold gate in any CI workflow                                  | HIGH       | HIGH     | CONFIRMED  | HIGH   | YES       | Coverage collection is informational only (codecov upload); no merge is blocked by coverage regression, making coverage baselines unenforceable.                                |
| GAP-B2 | 2 pre-existing TypeScript errors (guards/index.ts not a module)                | HIGH       | HIGH     | CONFIRMED  | HIGH   | YES       | `apps/mmc/src/core/guards/index.ts` is not a valid module — this breaks type checking for both MMC and Frontoffice, and typecheck.yml will fail on main branches.               |
| GAP-D4 | `bun run lint` exits non-zero — pre-commit hook currently blocks all commits   | HIGH       | HIGH     | CONFIRMED  | HIGH   | YES       | The Husky pre-commit hook runs `bun run lint` which exits 1 due to pre-existing errors; this means every developer commit is currently blocked unless the hook is bypassed.     |
| GAP-R1 | All 5 `apps/*` directories missing README.md                                   | HIGH       | HIGH     | CONFIRMED  | HIGH   | NO        | Onboarding any new engineer or AI agent to an app is blocked by zero documentation; no purpose, dependencies, or test instructions exist for any app.                           |
| GAP-R2 | 6 of 8 `packages/*` directories missing README.md                              | HIGH       | HIGH     | CONFIRMED  | HIGH   | NO        | Shared packages (domain-core, config, logger, redis-utils, api-client, validation) have no documentation, increasing the risk of misuse across consumer apps.                   |
| GAP-D1 | 2 pre-existing TypeScript compilation errors                                   | HIGH       | HIGH     | CONFIRMED  | HIGH   | YES       | Same root cause as GAP-B2; TypeScript compilation fails, preventing `typecheck:src` from passing in CI.                                                                         |
| GAP-C3 | E2E testing absent from all CI workflows                                       | MEDIUM     | MEDIUM   | CONFIRMED  | HIGH   | NO        | No end-to-end test coverage exists for any user workflow; regression detection in deployed application flows is entirely absent.                                                |
| GAP-C4 | No unified pre-merge gate (lint + typecheck + unit tests)                      | MEDIUM     | MEDIUM   | HIGH       | HIGH   | NO        | `typecheck.yml` runs lint and type check; `test-stage-001.yml` runs tests; no single workflow enforces all three together on every PR.                                          |
| GAP-E1 | No E2E / Playwright config in any app                                          | MEDIUM     | MEDIUM   | CONFIRMED  | HIGH   | NO        | E2E testing requires Playwright configuration as a prerequisite; until this is added, no cross-page or auth-flow tests can run.                                                 |
| GAP-E2 | Frontend apps have 0 unit tests in `src/`                                      | MEDIUM     | MEDIUM   | CONFIRMED  | MEDIUM | NO        | All three Vue apps test exclusively at the integration level; component-level and composable-level unit testing is absent.                                                      |
| GAP-T2 | 2 test files contain flaky test markers (`.retry(`)                            | MEDIUM     | MEDIUM   | CONFIRMED  | MEDIUM | NO        | Static scan detected retry patterns in `packages/api-client` and `apps/worker/tests/load-testing` — these tests may produce non-deterministic CI results.                       |
| GAP-L1 | `no-console`/`no-explicit-any` at `warn` (not `error`)                         | MEDIUM     | MEDIUM   | CONFIRMED  | MEDIUM | NO        | Per AGENTS.md §Logging Rules, `console.log` is forbidden in service code; ESLint only warns, allowing violations to be silently committed.                                      |
| GAP-L3 | No dedicated ESLint config for api, worker, all packages                       | MEDIUM     | MEDIUM   | CONFIRMED  | MEDIUM | NO        | These directories rely solely on root config; import boundary enforcement, Vue-specific rules, and project-level overrides cannot be scoped to these dirs.                      |
| GAP-V1 | No `vitest.workspace.*` at repo root                                           | MEDIUM     | MEDIUM   | CONFIRMED  | MEDIUM | NO        | Without a workspace file, each Vitest config must be invoked independently; the root `vitest run` command does not discover per-app configs automatically.                      |
| GAP-V2 | `test.environment` conflicts across configs (node vs jsdom vs unset)           | MEDIUM     | MEDIUM   | CONFIRMED  | MEDIUM | NO        | Tests run in the wrong environment will pass locally but produce false results; backend code tested in jsdom or frontend code tested in node are common failure modes.          |
| GAP-D2 | Pre-commit hook references `bun run typecheck` (script not found)              | MEDIUM     | MEDIUM   | CONFIRMED  | MEDIUM | NO        | The hook silently fails on `type-check` step because the script is named `typecheck`; type checking is effectively not enforced at commit time.                                 |
| GAP-D3 | `husky` not listed in root `package.json` devDependencies                      | MEDIUM     | MEDIUM   | CONFIRMED  | MEDIUM | NO        | Husky hooks may not initialize after a clean `bun install` if the package is not declared; the pre-commit hook may not be active for new contributors.                          |
| GAP-B1 | Root `build` script uses `bun workspaces run build` (invalid)                  | MEDIUM     | MEDIUM   | CONFIRMED  | MEDIUM | NO        | The root build orchestration fails; developers and CI pipelines must build each app individually until this is migrated to a Bun-valid form.                                    |
| GAP-B3 | Coverage baseline unavailable (tests are DB-GATED locally)                     | MEDIUM     | MEDIUM   | CONFIRMED  | MEDIUM | NO        | Coverage percentages cannot be established without a running Docker Compose test environment; CI provides the real baseline but it is not captured in this audit.               |
| GAP-R3 | Present READMEs (`types`, `ui-system`) lack all 7 required governance sections | MEDIUM     | MEDIUM   | CONFIRMED  | MEDIUM | NO        | Existing README documents contain rich content but use non-standard headings, requiring reorganization rather than creation from scratch.                                       |
| GAP-L2 | `vue/multi-word-component-names` not configured in any ESLint config           | LOW        | LOW      | CONFIRMED  | LOW    | NO        | Vue best practice rule for component naming is not enforced; this is a code quality gap with no runtime or security impact.                                                     |
| GAP-V3 | Coverage only enabled in root vitest config                                    | LOW        | LOW      | CONFIRMED  | LOW    | NO        | Per-app configs do not enable coverage collection; `vitest run --coverage` from an app directory will not produce coverage reports.                                             |

---

## Summary Counts

| Risk Level | Count  | Gap IDs                                                                                                        |
| ---------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| CRITICAL   | 0      | —                                                                                                              |
| HIGH       | 9      | GAP-T1, GAP-L4, GAP-C1, GAP-C2, GAP-B2, GAP-D4, GAP-R1, GAP-R2, GAP-D1                                         |
| MEDIUM     | 14     | GAP-C3, GAP-C4, GAP-E1, GAP-E2, GAP-T2, GAP-L1, GAP-L3, GAP-V1, GAP-V2, GAP-D2, GAP-D3, GAP-B1, GAP-B3, GAP-R3 |
| LOW        | 2      | GAP-L2, GAP-V3                                                                                                 |
| **Total**  | **25** | —                                                                                                              |

### Blocking vs Non-Blocking

| Category     | Count |
| ------------ | ----- |
| Blocking     | 7     |
| Non-Blocking | 18    |

> **Blocking gaps** must be resolved before `STAGE_INFRA_GOVERNANCE` tasks can open. See
> [SAFE_ROLLOUT_PLAN.md](./SAFE_ROLLOUT_PLAN.md) for sequencing.

### Overall Risk Level

**HIGH** — 9 of 25 gaps are HIGH severity, with 7 confirmed blocking gaps. The monorepo is not ready
for governance enforcement. No `STAGE_INFRA_GOVERNANCE` task may open until all blocking gaps are
resolved.
