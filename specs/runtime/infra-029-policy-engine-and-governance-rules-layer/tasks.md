# Tasks: Policy Engine and Governance Rules Layer

**Stage**: INFRA-29
**Phase**: 01_PLATFORM_FOUNDATION
**Feature Branch**: `spec/infra-029-policy-engine-and-governance-rules-layer`
**Input**: `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/`
**Plan**: `plan.md` (775 lines, 10 sections)
**Spec**: `spec.md` (6 user stories)
**Data Model**: `data-model.md` (authoritative TypeScript interfaces)

---

## Format: `- [ ] [ID] [P?] [Story?] Description — exact file path`

- **[P]**: Parallel-eligible — safe to execute concurrently with other [P]-marked tasks in the same phase (different files, no unresolved dependencies)
- **[US1–US6]**: Which user story this task primarily delivers
- Setup/Foundational phases carry no story label
- Every task includes an exact file path

---

## User Stories (from spec.md)

| ID  | Story                                                                                            | Priority |
| --- | ------------------------------------------------------------------------------------------------ | -------- |
| US1 | Single Command Governance Check                                                                  | P1       |
| US2 | Pre-Commit Governance Enforcement                                                                | P1       |
| US3 | Orchestrator Integration _(consumption only — no engine-side tasks; see Section 5.4 of plan.md)_ | P2       |
| US4 | Adapter-Based Migration of Existing Guards                                                       | P2       |
| US5 | Script System Unification                                                                        | P2       |
| US6 | JSON Reporting for CI Consumption                                                                | P3       |

---

## Phase A: Foundation

**Purpose**: Minimal runnable skeleton. All Phase A tasks are strictly sequential — each depends on the previous.

**⚠️ CRITICAL**: No Phase B–E work can begin until T001–T005 are complete.

- [x] T001 Create `scripts/policy-engine/` directory structure including all subdirectories: `context/`, `adapters/`, `rules/architecture/`, `rules/scripts/`, `rules/types/`, `rules/ai/`, `rules/security/`, `reporters/` — `scripts/policy-engine/`
- [x] T002 Implement `types.ts` from `data-model.md` — all exported interfaces: `PolicySeverity`, `PolicyDomain`, `PolicyRule`, `PolicyContext`, `PolicyResult`, `DependencyGraph`, `DependencyGraphModule`, `ContextWarning`, `ContextLoadResult`, `GitCommit`, `TrivyVulnerability`, `Reporter`, `ReporterType`, `PolicyEngineOptions`, `RegistryStats`; no imports, strict TypeScript — `scripts/policy-engine/types.ts`
- [x] T003 Implement `registry.ts` — export `registerRule(rule: PolicyRule): void` (throws on duplicate `rule.id`), `getRules(): readonly PolicyRule[]` (frozen copy), `getRegistryStats(): RegistryStats` (domain counts for Gate 3); no dynamic loading — `scripts/policy-engine/registry.ts`
- [x] T004 Implement `engine.ts` — export `class PolicyEngine { check(context: PolicyContext, loaderWarnings?: ContextWarning[]): Promise<PolicyResult[]> }` with: loaderWarnings→ENGINE-002/ENGINE-003 warning results, parallel/sequential rule split via `Promise.all`, AbortController injection into `context.abortSignal`, `safeEvaluate()` wrapping rule exceptions as error results, timeout guard emitting ENGINE-001 on expiry, result sort (error→warning→info) — `scripts/policy-engine/engine.ts`
- [x] T005 Implement `context/loader.ts` — export `loadContext(mode: "changed" | "full", timeout: number): Promise<ContextLoadResult>` assembling: `changedFiles` from `Bun.spawnSync(['git', 'diff', '--name-only', 'HEAD'])` with fallback to `[]` + GIT_UNAVAILABLE warning when git unavailable; `dependencyGraph` from `docs/ai/context/gitnexus-context.json` with stale detection via `GITNEXUS_MAX_AGE_HOURS` env (default 24h) emitting GITNEXUS_STALE/GITNEXUS_MISSING warning when absent or stale; `scripts` from root `package.json` scripts field; `vulnerabilities` from `tmp/trivy-report.json` (optional, no error if absent); `existingScriptPaths` via `Bun.Glob` scan of `scripts/`; `documentedScriptNames` from `docs/scripts/*.md` filenames (extension stripped) — `scripts/policy-engine/context/loader.ts`

**Checkpoint A**: All five foundation files compile cleanly under `bun --check`. Engine skeleton instantiates with empty registry.

---

## Phase B: Adapters — US4: Adapter-Based Migration of Existing Guards (P2)

**Purpose**: Wrap each legacy governance tool so its output becomes `PolicyResult[]`. All four adapters are independent after Phase A.

**Goal**: Each legacy tool's violation coverage is fully replicated via its adapter.

**Independent Test**: Each adapter can be unit-tested in isolation against a mock `PolicyContext` and produces `PolicyResult[]` without throwing.

- [x] T006 [P] [US4] Implement `architecture-guard.adapter.ts` — export `runArchitectureGuard(context: PolicyContext): Promise<PolicyResult[]>` spawning `Bun.spawn(['bun', 'run', mode === 'changed' ? 'arch:guard:changed' : 'arch:guard', '--json'], { signal: context.abortSignal })`, parsing JSON stdout, mapping each violation to `{ ruleId: 'ARCH-001', domain: 'ARCH', severity: 'error', message, file }`; non-zero exit → single error result with stderr excerpt; spawn crash / AbortSignal → single error result; never throws — `scripts/policy-engine/adapters/architecture-guard.adapter.ts`
- [x] T007 [P] [US4] Implement `type-safety.adapter.ts` — export `runTypeSafety(context: PolicyContext): Promise<PolicyResult[]>` spawning `bun typecheck` capturing stderr, parsing tsc diagnostics with regex `/^(.+\.ts)\((\d+),(\d+)\): error (TS\d+): (.+)$/`, mapping each to `{ ruleId: 'TYPES-001', domain: 'TYPES', severity: 'error', file, message }`; also spawning `bun arch:type-safety-guard --json` and merging its JSON results; non-zero exit with no parseable output → single error result with stderr excerpt; never throws — `scripts/policy-engine/adapters/type-safety.adapter.ts`
- [x] T008 [P] [US4] Implement `script-governance.adapter.ts` — export `runScriptGovernance(context: PolicyContext): Promise<PolicyResult[]>` spawning `Bun.spawn(['bun', 'run', 'validate:scripts:runtime', '--json'], { signal: context.abortSignal })`, parsing JSON output, mapping violation types: `naming-violation → SCRIPTS-001`, `duplicate-script → SCRIPTS-002`, `broken-reference → SCRIPTS-003`, `missing-docs → SCRIPTS-004`; non-zero exit → single error result; never throws — `scripts/policy-engine/adapters/script-governance.adapter.ts`
- [x] T009 [P] [US4] Implement `trivy.adapter.ts` — export `runTrivy(context: PolicyContext): Promise<PolicyResult[]>` reading `tmp/trivy-report.json` via `Bun.file(path).json()`, filtering to `severity === 'HIGH' || severity === 'CRITICAL'`, mapping each to `{ ruleId: 'SECURITY-001', domain: 'SECURITY', severity: 'error', message: '<CVE>: <pkg>@<version> - <description>', suggestion: 'Fix: upgrade to <fixedVersion>' }`; absent file returns `[]`; JSON parse failure returns single error result; no subprocess spawn; no network calls; never throws — `scripts/policy-engine/adapters/trivy.adapter.ts`

**Checkpoint B**: Each adapter file compiles and is independently unit-testable via mock `PolicyContext`.

---

## Phase C: Rules

**Purpose**: Register all 8 governance rules via self-registration side-effect imports. All rule files are independent after Phase B and can be written in parallel.

**Goal**: Importing any rule file triggers `registerRule()`. All 8 rules compile.

- [x] T010 [P] [US4] Implement `ARCH-001.rule.ts` — `registerRule({ id: 'ARCH-001', domain: 'ARCH', description: 'Detects module import boundary violations by delegating to the architecture-guard adapter', severity: 'error', sequential: false, evaluate(context): delegates to runArchitectureGuard(context) })`; self-registration via side-effect import of `registry.ts` — `scripts/policy-engine/rules/architecture/ARCH-001.rule.ts`
- [x] T011 [P] [US5] Implement `SCRIPTS-001.rule.ts` — `registerRule({ id: 'SCRIPTS-001', domain: 'SCRIPTS', description: 'Detects scripts in package.json that do not follow <domain>:<action>[:scope] naming convention', severity: 'warning', evaluate(context): iterates context.scripts, tests each key against /^[a-z][a-z0-9]*:[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/, reports violations with suggestion providing expected format })` — `scripts/policy-engine/rules/scripts/SCRIPTS-001.rule.ts`
- [x] T012 [P] [US5] Implement `SCRIPTS-002.rule.ts` — `registerRule({ id: 'SCRIPTS-002', domain: 'SCRIPTS', description: 'Detects duplicate scripts — multiple package.json keys with identical or near-identical command values', severity: 'warning', evaluate(context): groups context.scripts by normalized command value (trimmed, lowercased), emits duplicate warning per duplicate pair })` — `scripts/policy-engine/rules/scripts/SCRIPTS-002.rule.ts`
- [x] T013 [P] [US5] Implement `SCRIPTS-003.rule.ts` — `registerRule({ id: 'SCRIPTS-003', domain: 'SCRIPTS', description: 'Detects script command values referencing a file path under scripts/ that does not exist', severity: 'error', evaluate(context): uses context.existingScriptPaths (pre-fetched by loader), parses context.scripts command values for bun scripts/... or bun run scripts/... patterns, checks each detected path against existingScriptPaths, reports missing files; no filesystem I/O in evaluate() })` — `scripts/policy-engine/rules/scripts/SCRIPTS-003.rule.ts`
- [x] T014 [P] [US5] Implement `SCRIPTS-004.rule.ts` — `registerRule({ id: 'SCRIPTS-004', domain: 'SCRIPTS', description: 'Detects scripts lacking a corresponding documentation entry in docs/scripts/', severity: 'warning', evaluate(context): uses context.documentedScriptNames (pre-fetched list from loader), compares against context.scripts keys, reports undocumented scripts; no filesystem I/O in evaluate() })` — `scripts/policy-engine/rules/scripts/SCRIPTS-004.rule.ts`
- [x] T015 [P] [US4] Implement `TYPES-001.rule.ts` — `registerRule({ id: 'TYPES-001', domain: 'TYPES', description: 'Detects TypeScript type-safety violations by delegating to the type-safety adapter', severity: 'error', sequential: true, evaluate(context): delegates to runTypeSafety(context) })`; `sequential: true` because tsc is stateful (language server port conflicts) — `scripts/policy-engine/rules/types/TYPES-001.rule.ts`
- [x] T016 [P] [US1] Implement `AI-001.rule.ts` — `registerRule({ id: 'AI-001', domain: 'AI', description: 'Detects stale AI context artifacts — GitNexus index age exceeds GITNEXUS_MAX_AGE_HOURS', severity: 'warning', evaluate(context): if context.dependencyGraph is null → return [] (no-op; loader already emitted warning); otherwise read analyzedAt timestamp, calculate age vs GITNEXUS_MAX_AGE_HOURS env (default 24h), emit warning if stale })` — `scripts/policy-engine/rules/ai/AI-001.rule.ts`
- [x] T017 [P] [US4] Implement `SECURITY-001.rule.ts` — `registerRule({ id: 'SECURITY-001', domain: 'SECURITY', description: 'Surfaces HIGH and CRITICAL Trivy CVE findings by delegating to the Trivy adapter', severity: 'error', evaluate(context): delegates to runTrivy(context) })` — `scripts/policy-engine/rules/security/SECURITY-001.rule.ts`

**Checkpoint C**: All 8 rule files compile. Importing each triggers `registerRule()`. No duplicate IDs.

---

## Phase D: CLI & Reporters

**Purpose**: Wire up end-to-end execution path. T018 and T019 are parallel to each other. T020 depends on both reporters and all Phase C rules being complete. T021 depends on T020.

**Goal**: `bun run policy:check --full` runs end-to-end with correct exit code; `bun run policy:check --changed` completes under 2s.

- [x] T018 [P] [US1] Implement `console.ts` — export `class ConsoleReporter implements Reporter { report(results: PolicyResult[]): void }` grouping results by `domain`, formatting `[ERROR]`/`[WARN]`/`[INFO]` lines with ruleId, file (when available), message, and suggestion (when available), outputting domain headers (e.g., `━━━ ARCH ━━━━━━`), and exit-blocking summary line (`N error(s)  N warning(s)  N info(s)`); empty results produce clean confirmation message — `scripts/policy-engine/reporters/console.ts`
- [x] T019 [P] [US6] Implement `json.ts` — export `class JsonReporter implements Reporter { report(results: PolicyResult[]): void }` outputting `JSON.stringify(results, null, 2)` to stdout; no timestamps, no random IDs, no non-deterministic fields; empty results produce `"[]"` — `scripts/policy-engine/reporters/json.ts`
- [x] T020 [US1] Implement `cli.ts` — entry point for `bun run policy:check`; (1) parse `Bun.argv`: `--full` → `mode='full', timeout=30_000`; `--changed` → `mode='changed', timeout=2_000` (default); `--reporter=json|console` → `reporter` (default `console`); (2) static side-effect imports of all 8 rule files to trigger registration; (3) instantiate `PolicyEngine`; (4) `const { context, warnings } = await loadContext(mode, timeout)`; (5) `const results = await engine.check(context, warnings)`; (6) dispatch to selected reporter; (7) `process.exit(results.some(r => r.severity === 'error') ? 1 : 0)` — `scripts/policy-engine/cli.ts`
- [x] T021 [US1] Add `"policy:check": "bun scripts/policy-engine/cli.ts"` to `scripts` field of root `package.json`; no removals or modifications to any existing script entries — `package.json`

**Checkpoint D**: `bun run policy:check --full` runs end-to-end and exits 0 on clean repo; exits 1 when a known violation exists. `bun run policy:check --changed` completes in under 2s on a typical commit set.

---

## Phase E: Tests & Gates

**Purpose**: Validate all implementation, confirm gate invariants, wire Husky and CI. All test-file writing tasks (T022–T050) are parallel to each other (different files, no write dependencies). Gate run tasks (T051–T054) are sequential and must execute after all test files are written.

**Goal**: All four gates pass. CI workflow active. Husky hook updated to use `policy:check`.

### Unit Tests (17 files — all parallel after Phase D)

- [x] T022 [P] Write `registry.test.ts` — `registerRule()` uniqueness enforcement; `getRules()` returns frozen copy; `getRegistryStats()` domain counts are correct; duplicate ID registration throws synchronously — `tests/unit/policy-engine/registry.test.ts`
- [x] T023 [P] [US1] Write `engine.test.ts` — `check()` runs parallel rules via `Promise.all`; sequential rules execute after parallel batch; timeout fires ENGINE-001 and exits; `safeEvaluate()` catches thrown rule → emits error result without halting others; results sorted error→warning→info; loaderWarnings prepended as ENGINE-002/ENGINE-003 results — `tests/unit/policy-engine/engine.test.ts`
- [x] T024 [P] [US1] Write `loader.test.ts` — `changedFiles` populated from git stdout; git non-zero exit → `changedFiles=[]` + GIT_UNAVAILABLE warning; GitNexus file absent → `dependencyGraph=null` + GITNEXUS_MISSING warning; `analyzedAt` older than `GITNEXUS_MAX_AGE_HOURS` → GITNEXUS_STALE warning; `GITNEXUS_MAX_AGE_HOURS` env override respected; `tmp/trivy-report.json` absent → `vulnerabilities=undefined`, no error — `tests/unit/policy-engine/context/loader.test.ts`
- [x] T025 [P] [US4] Write `ARCH-001.test.ts` — `evaluate()` delegates to adapter mock; passes context.mode to adapter; returns adapter results unchanged; empty adapter results → empty PolicyResult[] — `tests/unit/policy-engine/rules/ARCH-001.test.ts`
- [x] T026 [P] [US5] Write `SCRIPTS-001.test.ts` — valid `<domain>:<action>` patterns pass; single-segment names flagged; names with uppercase flagged; empty `context.scripts` → no violations; suggestion field populated with expected format — `tests/unit/policy-engine/rules/SCRIPTS-001.test.ts`
- [x] T027 [P] [US5] Write `SCRIPTS-002.test.ts` — two scripts with identical normalized command value → duplicate warning; unique command values → no violations; empty `context.scripts` → no violations — `tests/unit/policy-engine/rules/SCRIPTS-002.test.ts`
- [x] T028 [P] [US5] Write `SCRIPTS-003.test.ts` — script referencing `bun scripts/foo.ts` not in `existingScriptPaths` → error violation; existing path → no violation; non-`scripts/` path patterns ignored; `context.existingScriptPaths` undefined → no violations; no filesystem I/O in `evaluate()` — `tests/unit/policy-engine/rules/SCRIPTS-003.test.ts`
- [x] T029 [P] [US5] Write `SCRIPTS-004.test.ts` — script key absent from `documentedScriptNames` → warning; script key present in `documentedScriptNames` → no violation; `context.documentedScriptNames` undefined → no violations; no filesystem I/O in `evaluate()` — `tests/unit/policy-engine/rules/SCRIPTS-004.test.ts`
- [x] T030 [P] [US4] Write `TYPES-001.test.ts` — `evaluate()` delegates to adapter mock; `sequential: true` flag present on registered rule; returns adapter results unchanged — `tests/unit/policy-engine/rules/TYPES-001.test.ts`
- [x] T031 [P] [US1] Write `AI-001.test.ts` — fresh `analyzedAt` within `GITNEXUS_MAX_AGE_HOURS` → no violations; `analyzedAt` older than threshold → warning result; `context.dependencyGraph === null` → no violations (no-op); `GITNEXUS_MAX_AGE_HOURS` env var respected — `tests/unit/policy-engine/rules/AI-001.test.ts`
- [x] T032 [P] [US4] Write `SECURITY-001.test.ts` — `evaluate()` delegates to Trivy adapter mock; HIGH/CRITICAL findings surface as error results; mock returning `[]` → no violations — `tests/unit/policy-engine/rules/SECURITY-001.test.ts`
- [x] T033 [P] [US1] Write `console.test.ts` — output grouped by `domain`; `[ERROR]`/`[WARN]`/`[INFO]` prefixes correct; summary counts accurate; empty results → clean confirmation message; `file` field included when present; `suggestion` included when present — `tests/unit/policy-engine/reporters/console.test.ts`
- [x] T034 [P] [US6] Write `json.test.ts` — output is valid JSON (`JSON.parse` succeeds); empty results → `[]`; sort order is stable (error before warning before info); no extraneous fields (no timestamps, no random IDs) — `tests/unit/policy-engine/reporters/json.test.ts`
- [x] T035 [P] [US4] Write `architecture-guard.adapter.test.ts` — spawns `bun run arch:guard --json` in full mode and `arch:guard:changed --json` in changed mode; maps JSON output items to `PolicyResult[]` with correct fields; non-zero exit code → single error result with stderr excerpt; spawn exception → single error result; AbortSignal cancellation → error result; never throws — `tests/unit/policy-engine/adapters/architecture-guard.adapter.test.ts`
- [x] T036 [P] [US4] Write `type-safety.adapter.test.ts` — spawns `bun typecheck`; parses tsc stderr diagnostic regex correctly; also spawns `bun arch:type-safety-guard --json`; merges both result arrays; non-zero exit with no parseable output → single error result with stderr excerpt — `tests/unit/policy-engine/adapters/type-safety.adapter.test.ts`
- [x] T037 [P] [US4] Write `script-governance.adapter.test.ts` — `--json` flag passed; violation type `naming-violation` → `SCRIPTS-001`; `duplicate-script` → `SCRIPTS-002`; `broken-reference` → `SCRIPTS-003`; `missing-docs` → `SCRIPTS-004`; non-zero exit → single error result — `tests/unit/policy-engine/adapters/script-governance.adapter.test.ts`
- [x] T038 [P] [US4] Write `trivy.adapter.test.ts` — reads `tmp/trivy-report.json`; filters to HIGH and CRITICAL only; maps correctly to `PolicyResult[]` with CVE in message and fixedVersion in suggestion; absent file → `[]`; malformed JSON → single error result — `tests/unit/policy-engine/adapters/trivy.adapter.test.ts`

### Integration Tests (4 files — all parallel after Phase D)

- [x] T039 [P] [US1] Write `cli-exit-codes.test.ts` — CLI exits 0 when all rules return `[]`; exits 1 when any rule returns error-severity result; exits 0 when only warning-severity results present; exit code is the sole non-zero signal — `tests/integration/policy-engine/cli-exit-codes.test.ts`
- [x] T040 [P] [US2] Write `cli-changed-mode.test.ts` — `--changed` with staged file → only rules applicable to that file evaluate; `--changed` with no changed files → all rules skip, exit 0 immediately; `--changed` when git unavailable → ENGINE-002 warning emitted, full mode activated — `tests/integration/policy-engine/cli-changed-mode.test.ts`
- [x] T041 [P] [US1] Write `cli-full-mode.test.ts` — `--full` evaluates all five domains (ARCH, SCRIPTS, TYPES, AI, SECURITY); `--reporter=console` produces grouped domain output; `--reporter=json` produces valid JSON — `tests/integration/policy-engine/cli-full-mode.test.ts`
- [x] T042 [P] [US6] Write `cli-reporter.test.ts` — `--reporter=json` stdout is parseable JSON conforming to `PolicyResult[]` schema; `--reporter=console` stdout is human-readable with domain headers and summary line — `tests/integration/policy-engine/cli-reporter.test.ts`

### Gate Validation Test Files (6 files — all parallel after Phase D)

- [x] T043 [P] [US4] Write `arch-guard-parity.test.ts` (Gate 1) — invoke `bun run arch:guard` and `runArchitectureGuard()` on same repo state; assert identical set of violation messages and file paths; zero tolerance for divergence — `tests/unit/policy-engine/parity/arch-guard-parity.test.ts`
- [x] T044 [P] [US4] Write `type-safety-parity.test.ts` (Gate 1) — invoke `bun run validate:types` and `runTypeSafety()` on same repo state; assert identical violation sets — `tests/unit/policy-engine/parity/type-safety-parity.test.ts`
- [x] T045 [P] [US4] Write `script-governance-parity.test.ts` (Gate 1) — invoke `bun run validate:scripts:all` and `runScriptGovernance()` on same repo state; assert identical violation sets — `tests/unit/policy-engine/parity/script-governance-parity.test.ts`
- [x] T046 [P] Write `determinism.test.ts` (Gate 2) — call `engine.check(context)` twice sequentially with identical `PolicyContext`; assert `JSON.stringify(run1) === JSON.stringify(run2)`; byte-identical output required — `tests/unit/policy-engine/determinism.test.ts`
- [x] T047 [P] Write `registry-coverage.test.ts` (Gate 3) — after side-effect-importing all 8 rule files, call `getRegistryStats()`; assert `domainCounts[d] >= 1` for each of `['ARCH', 'SCRIPTS', 'TYPES', 'AI', 'SECURITY']` — `tests/unit/policy-engine/registry-coverage.test.ts`
- [x] T048 [P] Write `no-direct-governance-calls.test.ts` (Gate 4) — file-system grep asserts that no file outside `scripts/policy-engine/adapters/` directly invokes `arch:guard`, `type-safety-guard`, `validate:scripts:runtime`, or Trivy CLI (except within `scripts/policy-engine/adapters/`); grep includes `.husky/` and CI YAML files — `tests/static/policy-engine/no-direct-governance-calls.test.ts`

### Infrastructure (sequential — wait for T020–T021 to be complete)

- [x] T049 [US2] Update `.husky/pre-commit` — replace existing `arch:guard:changed` / `governance:gate:changed` invocations with single command `bun run policy:check --changed`; remove any other direct governance tool invocations from this hook file (FR-040) — `.husky/pre-commit`
- [x] T050 [US1] Add CI workflow `policy-check.yml` — job: `policy-check`, triggers: `[push, pull_request]`, steps: `actions/checkout@v4`, `oven-sh/setup-bun@v1`, `bun run policy:check --full --reporter=json`; this job is a required gate (FR-035) — `.github/workflows/policy-check.yml`

### Gate Validation Runs (sequential — execute after T043–T050 are complete)

- [x] T051 Run Gate 1 (parity) — execute `bun vitest run tests/unit/policy-engine/parity/`; all three parity tests must pass; adapter output must be identical to legacy tool output on the same repo state
- [x] T052 Run Gate 2 (determinism) — execute `bun vitest run tests/unit/policy-engine/determinism.test.ts`; two sequential `engine.check()` calls on identical context must produce byte-identical JSON
- [x] T053 Run Gate 3 (registry coverage) — execute `bun vitest run tests/unit/policy-engine/registry-coverage.test.ts`; all five active domains (ARCH, SCRIPTS, TYPES, AI, SECURITY) must have at least one registered rule
- [x] T054 Run Gate 4 (static analysis) — execute `bun vitest run tests/static/policy-engine/`; no direct governance tool invocations outside `scripts/policy-engine/adapters/` must exist in Husky hooks, CI YAML, or orchestrator files

**Checkpoint E**: All four gates pass. Full validation pipeline `bun scripts/ai-guard.ts && bun scripts/infra-audit.ts && bun run lint && bun run typecheck && bun run test` completes without errors.

---

## Dependencies

**Phase ordering (hard-sequential)**:

```
Phase A → Phase B → Phase C → Phase D → Phase E (test writing) → Phase E (gate runs)
```

**Within-phase parallelism**:

| Phase | Parallel tasks         | Sequential tasks                                             |
| ----- | ---------------------- | ------------------------------------------------------------ |
| A     | None                   | T001 → T002 → T003 → T004 → T005                             |
| B     | T006, T007, T008, T009 | None                                                         |
| C     | T010–T017 (all)        | None (TYPES-001 is sequential at rule level, not task level) |
| D     | T018, T019             | T020 (after T018+T019+all Phase C) → T021                    |
| E     | T022–T050 (all writes) | T051 → T052 → T053 → T054 (gate runs)                        |

**Story completion order** (for independent delivery):

1. US1 (P1) — requires Phase A + Phase D complete
2. US2 (P1) — requires T020, T021 (policy:check script) before T049 (Husky)
3. US4 (P2) — requires Phase B (adapters) + T010, T015, T017 (rules)
4. US5 (P2) — requires Phase A (loader with existingScriptPaths/documentedScriptNames) + T011–T014 (rules)
5. US6 (P3) — requires T019 (json reporter) + T020 (cli.ts)
6. US3 (P2) — orchestrator consumes the public engine API from Section 5.4 of plan.md; no engine-side tasks required; the orchestrator team must update their stage-closure gate and precommit-diagnostics to call `policyEngine.check(context)` per FR-041–FR-043

---

## Suggested MVP Scope

Implement US1 with a single in-process rule (no adapters) to validate the full execution pipeline first:

1. Complete Phase A (T001–T005)
2. Implement SCRIPTS-001 rule (T011) — pure in-process rule, no adapter dependency
3. Implement console reporter (T018) and cli.ts (T020)
4. Add package.json entry (T021)
5. Run `bun run policy:check --full` against the repo — must exit 1 if any script name conventions are violated, 0 if clean

This proves the complete pipeline (loader → engine → rule → reporter → exit code) without requiring any adapter to be complete.

---

## Summary

| Phase               | Tasks     | Count  |
| ------------------- | --------- | ------ |
| A — Foundation      | T001–T005 | 5      |
| B — Adapters        | T006–T009 | 4      |
| C — Rules           | T010–T017 | 8      |
| D — CLI & Reporters | T018–T021 | 4      |
| E — Tests & Gates   | T022–T054 | 33     |
| **Total**           |           | **54** |

**Phase E breakdown**:

| E sub-group           | Tasks     | Count  |
| --------------------- | --------- | ------ |
| Unit tests            | T022–T038 | 17     |
| Integration tests     | T039–T042 | 4      |
| Gate test files (1–4) | T043–T048 | 6      |
| Infrastructure        | T049–T050 | 2      |
| Gate validation runs  | T051–T054 | 4      |
| **Phase E total**     |           | **33** |
