# Tasks: AI Execution Orchestration Engine

**Stage**: INFRA-020  
**Phase**: 01_PLATFORM_FOUNDATION  
**Branch**: `spec/infra-020-ai-execution-orchestration-engine`  
**Plan**: `specs/runtime/infra-020-ai-execution-orchestration-engine/plan.md`  
**Spec**: `specs/runtime/infra-020-ai-execution-orchestration-engine/spec.md`  
**ADR**: None required — no architectural exceptions; tooling-only stage  
**Generated**: 2026-03-15

---

## Stage Alignment

| Rule                                                                                 | Status                                 |
| ------------------------------------------------------------------------------------ | -------------------------------------- |
| Tooling layer only — no routes, no DB, no queues, no UI                              | ✅ Confirmed                           |
| Import boundary: `@zidney/logger` + Node/Bun stdlib only — no `@zidney/config`       | ✅ Enforced (Research Decision 2)      |
| Exit codes: 0=pass, 1=fail, 2=timeout, 3=missing file, 4=stale brain                 | ✅ Mandatory per spec                  |
| Atomic writes: tmp-then-rename for all execution log artifacts                       | ✅ FR-010, SC-012                      |
| Server-authoritative time: `new Date(Date.now()).toISOString()` in all timestamps    | ✅ FR-020                              |
| Exit codes 3 and 4: direct `process.exit()` inside try block — NOT thrown exceptions | ✅ Critical constraint                 |
| Exit code 2: `isTimeout ? process.exit(2) : process.exit(1)` in catch handler only   | ✅ Critical constraint                 |
| Constitution compliance                                                              | ✅ Plan verified compliant with v1.2.0 |

---

## Phase 1 — Setup

**Goal**: Initialize file system structure and Vitest project registration. All four tasks unblock
subsequent implementation phases.

- [ ] T001 Create `scripts/ai-engine/` directory and `scripts/ai-engine/__tests__/` subdirectory
- [ ] T002 [P] Add `docs/architecture/health/ai-execution-logs/` directory with `.gitkeep` (directory is created at runtime by scripts per FR-023; `.gitkeep` ensures the path is tracked in git before first execution)
- [ ] T003 [P] Add `docs/architecture/health/ai-plans/` directory with `.gitkeep` (plan documents written here by `plan-task.ts`; `.gitkeep` tracks the path before first `ai:plan` invocation)
- [ ] T004 Register `scripts/ai-engine` as the `'ai-engine'` Vitest test project in `vitest.workspace.ts` with `include: ['scripts/ai-engine/__tests__/**/*.test.ts']` and `environment: 'node'`

---

## Phase 2 — Foundational: Type Definitions & Shared Utilities

**Goal**: Establish all type contracts and the four cross-cutting utility modules imported by every
entry point. These tasks have no user story label because they are blocking prerequisites for all
three user story phases.

**Independent Test Criteria**: Running `bun test --project ai-engine` after this phase completes
executes the four utility test suites (`execution-id`, `log-writer`, `monorepo-guard`,
`stale-check`) with zero failures.

### Type Definitions (blocks all modules)

- [ ] T005 Implement `scripts/ai-engine/types.ts` with all interface and type definitions exactly as specified in plan.md §Type Definitions: `ExecutionLog`, `SubCommandResult`, `BrainStatus` (`"present_fresh" | "stale" | "absent"`), `ValidationReport`, `ExecutionPlan`, `PlanStep`, `BaseCliArgs`, `RunTaskArgs`, `PlanTaskArgs`, `ValidateArgs` — field signatures must match plan exactly; no `console.log`; no imports beyond TypeScript's own type system

### Utility Modules (parallel after T005)

- [ ] T006 [P] Implement `scripts/ai-engine/execution-id.ts`: export `generateExecutionId(taskDescription: string): string` → produces `${Date.now()}-${sha256(task).slice(0,8)}` using `node:crypto` `createHash('sha256')`; export `deriveTaskId(taskDescription: string): string` → returns 16-char hex prefix of SHA-256; no external dependencies; no `console.log`
- [ ] T007 [P] Implement `scripts/ai-engine/log-writer.ts`: export `writeExecutionLog(log: ExecutionLog): Promise<void>`; set `LOG_DIR = 'docs/architecture/health/ai-execution-logs'`; call `mkdir(LOG_DIR, {recursive:true})` first (FR-023); write to `{id}.tmp.json` via `writeFile`; rename to `{id}.json` via `rename` (atomic, FR-010 SC-012); no `console.log`; imports: `node:fs/promises`, `node:path`, `./types`
- [ ] T008 [P] Implement `scripts/ai-engine/monorepo-guard.ts`: export `assertMonorepoRoot(): void`; check `['package.json', 'docs/ai/context']` via `existsSync`; on any missing: write structured JSON error to `process.stderr` using `process.stderr.write(JSON.stringify({error:'MONOREPO_ROOT_NOT_FOUND', missing, message:'...'}) + '\n')` then call `process.exit(3)` — this is the ONLY file in `scripts/ai-engine/` permitted to write to `process.stderr` directly
- [ ] T009 [P] Implement `scripts/ai-engine/stale-check.ts`: export `checkBrainStatus(): {status: BrainStatus, brainPath: string, detail?: string}`; `BRAIN_PATH = 'docs/ai/context/ai-architecture-brain.json'`; `SOURCE_DIRS = ['packages', 'apps']`; walk both dirs recursively via `readdirSync` + `statSync` collecting `.ts`/`.tsx` mtimes (skip `node_modules`); if brain absent return `{status:'absent', ...}` with actionable detail; if any source mtime > brain mtime return `{status:'stale', ...}` with detail `"Source files newer than brain artifact by {delta}ms. Run: bun arch:audit"`; otherwise `{status:'present_fresh', ...}`; no `console.log`

### Unit Tests for Utility Modules (parallel after respective implementations)

- [ ] T010 [P] Write `scripts/ai-engine/__tests__/execution-id.test.ts`: test `generateExecutionId` — format matches `^\d+-[0-9a-f]{8}$`, hash suffix is deterministic for same input, different tasks produce different suffixes, different `Date.now()` values produce different prefixes; test `deriveTaskId` — returns 16-char hex string, same input always returns same ID, different inputs return different IDs; use `vi.useFakeTimers()` for timestamp tests
- [ ] T011 [P] Write `scripts/ai-engine/__tests__/log-writer.test.ts`: use real temp directory (created `beforeEach`, removed `afterEach`); assert log directory auto-created if absent (FR-023); assert valid JSON written to `{execution_id}.json`; assert `.tmp.json` does not exist after successful write (atomic rename verified); assert idempotent re-run with same `execution_id` overwrites same file; assert all nine SC-003 mandatory fields present in written JSON (`execution_id`, `task_id`, `timestamp`, `command`, `skills_activated`, `files_modified`, `architecture_violations`, `validation_result`, `execution_duration_ms`)
- [ ] T012 [P] Write `scripts/ai-engine/__tests__/monorepo-guard.test.ts`: mock `existsSync` via `vi.mock('node:fs')`; assert `process.exit(3)` called when `package.json` missing; assert `process.exit(3)` called when `docs/ai/context` missing; assert no `process.exit` called when both markers present; assert `process.stderr.write` called with valid JSON when exiting
- [ ] T013 [P] Write `scripts/ai-engine/__tests__/stale-check.test.ts`: use real temp directories to control actual mtime values; assert absent brain returns `{status:'absent'}` with detail message containing `'does not exist'`; assert stale brain (`.ts` source file touched after brain write) returns `{status:'stale'}` with detail containing `'Run: bun arch:audit'`; assert fresh brain (brain written after source files) returns `{status:'present_fresh'}`; assert `detail` field contains actionable message on both stale and absent cases

---

## Phase 3 — US1: Run a Governed AI Task End-to-End

**User Story**: As a platform engineer using AI-assisted development, I need a single `bun ai:run`
entry point that bootstraps repository context, activates the correct skills, executes the task,
and validates results, so AI-driven work follows predictable rules.

**Independent Test Criteria**: Running `bun ai:run --task "implement login feature" --dry-run`
exits 0 and produces a valid execution log artifact in
`docs/architecture/health/ai-execution-logs/` containing all mandatory SC-003 fields with
`validation_result: 'pass'`.

**Story Goal**: Implement `context-loader.ts`, `skill-selector.ts`, and `process-runner.ts` as
prerequisite modules (can run in parallel), then implement `run-task.ts` entry point. All tasks
carry `[US1]`.

### Prerequisite Modules for US1 (parallel after Phase 2 completes)

- [ ] T014 [P] [US1] Implement `scripts/ai-engine/context-loader.ts`: export `loadAiContextMini(): AiContextMini`; `CONTEXT_PATH = 'docs/ai/context/ai-context-mini.json'`; check via `existsSync` first; if absent throw `Error` with message `"AI context artifact not found: ${CONTEXT_PATH}. Run: bun ai-context:generate"` (caller converts thrown error to exit 3 via top-level catch); if present return `JSON.parse(readFileSync(CONTEXT_PATH, 'utf8'))` as `AiContextMini`; import `@zidney/logger` for secondary observability only; no `console.log`
- [ ] T015 [P] [US1] Implement `scripts/ai-engine/skill-selector.ts`: export `selectSkills(taskDescription: string): string[]`; `SKILLS_DIR = '.agents/skills'`; `BASELINE_SKILLS = ['architecture-intelligence', 'terminal-safety', 'mcp-routing']`; implement `KEYWORD_MAP` (7 regex patterns per research Decision 3: refactor|rename|extract|split|move → gitnexus-refactoring; debug|error|fail|bug|trace → gitnexus-debugging; impact|break|depend|blast → gitnexus-impact-analysis; explore|understand|how.\*work|flow → gitnexus-exploring; git|commit|branch|pr|push → git-governance; package|dependency|dep|install → package-manager-governance; precommit|pre-commit|husky → precommit-diagnostics); read existing skill directory names via `readdirSync` with `withFileTypes:true`; return sorted union of baseline + matched skills filtered to only those that exist; no `console.log`
- [ ] T016 [P] [US1] Implement `scripts/ai-engine/process-runner.ts`: export `runGovernanceTool(opts: RunOptions): Promise<SubCommandResult & {stdout: string}>`; `BUN = process.execPath`; spawn via `spawn(BUN, ['run', opts.command, ...opts.args], {stdio:['ignore','pipe','pipe']})`; collect stdout via `proc.stdout.on('data')`; set `setTimeout(() => { timedOut = true; proc.kill('SIGTERM'); }, opts.timeoutMs)` and clear on close; resolve with `{command, exit_code: timedOut ? 124 : code ?? 1, duration_ms: Date.now()-start, timed_out: timedOut, stdout}`; zero stdout/stderr leaked to parent process (FR-011); no `console.log`

### Entry Point: run-task.ts

- [ ] T017 [US1] Implement `scripts/ai-engine/run-task.ts` — entry point for `bun ai:run` with 300s timeout budget: implement private `withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label: string): Promise<T>` helper using `Promise` + `setTimeout` + `reject(new Error("TIMEOUT_EXCEEDED: {label} budget {ms}ms exhausted"))`; parse `--task`, `--task-id`, `--dry-run` from `process.argv`; wrap entire execution in `withTimeout(main, 300_000, 'ai:run')`; main flow: `assertMonorepoRoot()` → `generateExecutionId(taskDescription)` → `loadAiContextMini()` → `selectSkills(taskDescription)` → verify all selected skill dirs exist under `.agents/skills/` (exit 1 + log if missing) → `checkBrainStatus()` (`'absent'`: write log with `error:'BRAIN_ABSENT'` then call `process.exit(3)` DIRECTLY inside try — NOT thrown; `'stale'`: write log with `error:'BRAIN_STALE'` then call `process.exit(4)` DIRECTLY inside try — NOT thrown) → if `--dry-run` skip to log write → run validation → capture `architecture_violations` → `writeExecutionLog(...)` → `process.exit(validationResult === 'pass' ? 0 : 1)`; catch handler: `const isTimeout = err.message.startsWith('TIMEOUT_EXCEEDED'); await writeExecutionLog({...failureLog}); process.exit(isTimeout ? 2 : 1)`; all timestamps use `new Date(Date.now()).toISOString()`; use `@zidney/logger` for secondary observability; no `console.log`

### Unit Tests for US1 Modules (parallel after respective implementations)

- [ ] T018 [P] [US1] Write `scripts/ai-engine/__tests__/context-loader.test.ts`: mock `node:fs` via `vi.mock`; assert returns parsed JSON object when `ai-context-mini.json` present; assert throws `Error` with message containing `CONTEXT_PATH` and `'bun ai-context:generate'` when file absent; assert thrown error message is actionable (contains the full path)
- [ ] T019 [P] [US1] Write `scripts/ai-engine/__tests__/skill-selector.test.ts`: mock `.agents/skills/` directory listing to control available skills; assert all three baseline skills always present regardless of task; assert `gitnexus-refactoring` added for task containing `"refactor"`; assert `gitnexus-debugging` added for task containing `"debug"`; assert determinism — same task string returns same sorted list on two consecutive calls; assert only skills that exist as directories in `.agents/skills/` are returned; assert output array is sorted alphabetically
- [ ] T020 [P] [US1] Write `scripts/ai-engine/__tests__/process-runner.test.ts`: mock `node:child_process` via `vi.mock`; assert exit code 0 captured and returned in `SubCommandResult`; assert non-zero exit code returned without throwing; assert `timed_out: true` set and SIGTERM sent when `timeoutMs` exceeded (use `vi.useFakeTimers()`); assert stdout captured in result but not re-emitted to parent process; assert `duration_ms` is a positive number
- [ ] T021 [US1] Write `scripts/ai-engine/__tests__/run-task.test.ts`: mock all dependencies (`context-loader`, `skill-selector`, `process-runner`, `stale-check`, `log-writer`, `monorepo-guard`); assert exit 0 on compliant repository with valid task and fresh brain; assert exit 1 when validation returns `architecture_violations > 0`; assert exit 3 when `loadAiContextMini` throws (file absent) — must come from `process.exit(3)` directly, not catch; assert exit 1 when required skill directory missing; assert `--dry-run` flag skips execution subprocess and writes log with `validation_result: 'pass'` and `files_modified: []`; assert exit code 2 on 300s timeout using `vi.useFakeTimers()` — verifies `isTimeout ? process.exit(2) : process.exit(1)` catch branch; assert `ExecutionLog` written contains all nine SC-003 mandatory fields; assert exit 4 when brain stale (direct `process.exit(4)` call inside try block, not propagated exception)

---

## Phase 4 — US2: Plan an AI Task Before Execution

**User Story**: As a platform engineer, I need `bun ai:plan` to decompose a task into a
deterministic, human-readable execution plan without modifying any application source files.

**Independent Test Criteria**: Running `bun ai:plan --task "add login endpoint"` twice in
succession produces identical markdown content in
`docs/architecture/health/ai-plans/{task_id}.md` and exits 0 both times without touching any
file under `apps/`, `packages/`, or `scripts/` (except writing the plan doc itself).

- [ ] T022 [US2] Implement `scripts/ai-engine/plan-task.ts` — entry point for `bun ai:plan` with 120s timeout budget: parse `--task`, `--task-id`, `--output` from `process.argv`; derive `taskId = deriveTaskId(taskDescription)` for plan filename (same input → same name → overwrite semantics, FR-006); `outputPath` defaults to `docs/architecture/health/ai-plans/${taskId}.md`; `withTimeout(main, 120_000, 'ai:plan')`; main flow: `assertMonorepoRoot()` → `deriveTaskId()` + `generateExecutionId()` → `loadAiContextMini()` (throws → catch exits 3) → `selectSkills()` → compose `ExecutionPlan` object and markdown document deterministically (NO random values, NO wall-clock timestamps in plan doc content; timestamp goes only in the `ExecutionLog` artifact) → `mkdir({recursive:true})` for output dir → write plan markdown (overwrite if exists) → `writeExecutionLog({command:'ai:plan', files_modified:[outputPath], architecture_violations:0, validation_result:'pass', error:null})` → `process.exit(0)`; catch: `isTimeout ? process.exit(2) : process.exit(1)`; plan markdown MUST contain sections: `# Execution Plan: {desc}`, `## Skills Required`, `## Architecture Constraints`, `## Execution Steps`; ambiguous tasks MUST include `## Clarification Required` section; no `console.log`
- [ ] T023 [US2] Write `scripts/ai-engine/__tests__/plan-task.test.ts`: mock all module dependencies + filesystem; assert plan document written to `docs/architecture/health/ai-plans/{task_id}.md`; assert existing plan file overwritten on re-run for same task (FR-006 idempotent overwrite); assert no files under `apps/**` or `packages/**` modified during plan generation; assert two consecutive calls with same task description produce identical markdown content (determinism verification); assert plan markdown contains all four required sections; assert `ExecutionLog` written with `validation_result: 'pass'`, `files_modified: [outputPath]`, `architecture_violations: 0`; assert task with ambiguous scope produces plan containing clarification section; assert `process.exit(2)` on 120s timeout via `vi.useFakeTimers()`

---

## Phase 5 — US3: Validate Repository State After AI Execution

**User Story**: As a governance maintainer, I need `bun ai:validate` to confirm the repository
remains architecture-compliant after AI-driven changes, so regressions are caught before merge.

**Independent Test Criteria**: Running `bun ai:validate` on a compliant repository exits 0,
produces an execution log with all nine mandatory SC-003 fields where `validation_result: 'pass'`
and `architecture_violations: 0`. Running with a synthetic violation exits 1.

- [ ] T024 [US3] Implement `scripts/ai-engine/validate-execution.ts` — entry point for `bun ai:validate` with 90s (local) / 120s (CI) timeout budget: parse `--ci`, `--task`, `--execution-id` from `process.argv`; `timeoutMs = ci ? 120_000 : 90_000`; `withTimeout(main, timeoutMs, 'ai:validate')`; main flow: `assertMonorepoRoot()` → `generateExecutionId()` (or use `--execution-id` if provided) → `checkBrainStatus()` (`'absent'`: write log with `error:'BRAIN_ABSENT'` then `process.exit(3)` DIRECTLY inside try — NOT thrown; `'stale'`: write log with `error:'BRAIN_STALE'` then `process.exit(4)` DIRECTLY inside try — NOT thrown) → spawn `bun arch:guard --ci` via `runGovernanceTool({timeoutMs})` → spawn `bun type-safety-guard --json --no-exit-error` via `runGovernanceTool({timeoutMs})` → spawn `bun arch:health --ci` via `runGovernanceTool({timeoutMs})` → read `docs/architecture/health/architecture-health.json` if exists for violation count; if arch:health exits 0 but file absent set violations=0; if arch:health exits non-zero set violations=-1 sentinel → sub-command timeout: throw `Error('TIMEOUT_EXCEEDED: ...')` if `timed_out: true` → determine `overall:'pass'|'fail'` (fail if any exit_code≠0, any timed_out, or brain_status≠'present_fresh') → `writeExecutionLog({command:'ai:validate', skills_activated:[], ...})` → `process.exit(overall === 'pass' ? 0 : exitCodeForReason)`; all subprocess spawned with `stdio:'pipe'` (FR-011); no `console.log`
- [ ] T025 [US3] Write `scripts/ai-engine/__tests__/validate-execution.test.ts`: mock `runGovernanceTool`, `checkBrainStatus`, `log-writer`, `monorepo-guard`; assert exit 0 when all three tools return exit_code 0 and brain is fresh; assert exit 1 when `arch:guard` returns non-zero exit code; assert exit 1 when `type-safety-guard` returns violations in stdout; assert exit 3 when brain absent — must be direct `process.exit(3)` inside try block (verify mock is called before catch handler); assert exit 4 when brain stale — must be direct `process.exit(4)` inside try block; assert 90s timeout applied locally and 120s timeout applied with `--ci` flag (use `vi.useFakeTimers()`); assert `ExecutionLog` contains all nine SC-003 mandatory fields; assert `architecture_violations` is aggregate from all three tools; assert `validation_result: 'fail'` when any single tool fails; assert `skills_activated: []` always (validation does not activate skills)
- [ ] T026 [US3] Write `tests/integration/ai-engine/validate-execution.integration.test.ts` (create `tests/integration/ai-engine/` directory): spawn `bun ai:validate` as subprocess using `node:child_process` `spawnSync`; assert exit code is 0 on the current compliant repository; assert at least one `{execution_id}.json` file created in `docs/architecture/health/ai-execution-logs/` after run; read the newest log file and assert all nine mandatory fields present with correct types; assert `architecture_violations` field is a non-negative integer

---

## Phase 6 — US4: CI Enforces Orchestration Validation

**User Story**: As a CI pipeline maintainer, I need an AI Execution Validation step in CI so any
branch that breaks orchestration governance is blocked from merging automatically.

**Independent Test Criteria**: A branch with a synthetic architecture violation triggers a non-zero
exit from the CI `bun ai:validate --ci` step and blocks the merge. A clean branch exits 0.

- [ ] T027 [US4] Add `"ai:run": "bun scripts/ai-engine/run-task.ts"`, `"ai:plan": "bun scripts/ai-engine/plan-task.ts"`, and `"ai:validate": "bun scripts/ai-engine/validate-execution.ts"` to the `"scripts"` block in root `package.json`; insert after the existing `"ai-runtime:validate"` entry for logical grouping per plan.md §Package.json Script Additions
- [ ] T028 [US4] Add Step 11 to `.github/workflows/architecture-governance.yml` after Step 10 (Publish Architecture Summary): name `"Run AI Execution Validation"`, run `bun ai:validate --ci`; no `continue-on-error` — step must block CI job on non-zero exit (FR-015); place comment `# ── 11. Run AI Execution Validation ───────────` before step
- [ ] T029 [US4] Add Step 12 to `.github/workflows/architecture-governance.yml` after Step 11: name `"Upload AI Execution Validation Artifact"`, `if: always()`, `uses: actions/upload-artifact@v4`, with `name: ai-execution-validation-artifact` and `path: docs/architecture/health/ai-execution-logs/` (FR-016, SC-009); place comment `# ── 12. Upload AI Execution Artifact ──────────` before step
- [ ] T030 [US4] Add Step 13 to `.github/workflows/architecture-governance.yml` after Step 12: name `"Publish AI Execution Summary"`, `if: always()`, bash script reads `$(ls -t docs/architecture/health/ai-execution-logs/*.json 2>/dev/null | head -1)`, appends `## AI Execution Validation Report` header then latest log JSON block to `$GITHUB_STEP_SUMMARY`; falls back to `"No AI execution log artifacts found."` if directory is empty; place comment `# ── 13. Publish AI Execution Summary ─────────` before step

---

## Phase 7 — Polish & Cross-Cutting Concerns

- [ ] T031 Audit `scripts/ai-engine/` for any `console.log`, `console.error`, or `console.warn` usage via `grep -r "console\." scripts/ai-engine/ --include="*.ts" --exclude-dir=__tests__`; the only permitted `process.stderr` usage is in `monorepo-guard.ts`; fix any violations before marking stage complete (FR-011)
- [ ] T032 Audit import boundaries in `scripts/ai-engine/` via `grep -r "from '@zidney/" scripts/ai-engine/ --include="*.ts"` and confirm no imports of `@zidney/config`, no imports from `apps/*`, no imports from `packages/*` other than `@zidney/logger`; run `bun scripts/ai-guard.ts` and confirm zero architecture violations (FR-014, SC-011)
- [ ] T033 Run `bun test --project ai-engine` and confirm all 10 unit test files pass with zero failures; run `tests/integration/ai-engine/validate-execution.integration.test.ts` in the local environment and confirm exit 0 with a valid log artifact produced
- [ ] T034 Run `bun lint && bun type-check` scoped to `scripts/ai-engine/` and confirm zero lint errors and zero TypeScript type errors before marking the stage implementation complete

---

## Dependencies

```
Phase 1 (T001–T004) must be complete before Phase 2 begins.

Phase 2 internal ordering:
  T005 (types.ts) → blocks T006, T007, T008, T009 (all import from ./types)
  T006, T007, T008, T009 [P] → run concurrently after T005
  T010, T011, T012, T013 [P] → run concurrently after respective module (T006, T007, T008, T009)

Phase 3 (US1):
  All of Phase 2 (T005–T013) must complete before Phase 3 begins
  T014, T015, T016 [P] → run concurrently (no inter-dependency)
  T017 → requires T014 + T015 + T016 complete
  T018, T019, T020 [P] → run concurrently after respective module (T014, T015, T016)
  T021 → requires T017 complete

Phase 4 (US2):
  T022 → requires T014 (context-loader) + T015 (skill-selector) + T006 (execution-id)
          + T007 (log-writer) + T008 (monorepo-guard) complete
  T023 → requires T022 complete

Phase 5 (US3):
  T024 → requires T008 (monorepo-guard) + T009 (stale-check) + T016 (process-runner)
          + T006 (execution-id) + T007 (log-writer) complete
  T025 → requires T024 complete
  T026 → requires T024 + T027 complete (spawns `bun ai:validate` subprocess)

Phase 6 (US4):
  T027 → requires T017 + T022 + T024 complete (all three entry points must exist)
  T028 → requires T027 complete (CI step invokes `bun ai:validate --ci`)
  T029 → requires T028 complete (same YAML file, sequential edits)
  T030 → requires T029 complete (same YAML file, sequential edits)

Phase 7 (Polish):
  T031, T032, T033, T034 → run after all Phase 1–6 tasks complete
```

---

## Parallel Execution Groups

| Group | Tasks                  | Condition                |
| ----- | ---------------------- | ------------------------ |
| A     | T002, T003             | After T001               |
| B     | T006, T007, T008, T009 | After T005               |
| C     | T010, T011, T012, T013 | After respective B tasks |
| D     | T014, T015, T016       | After all Phase 2 tasks  |
| E     | T018, T019, T020       | After respective D tasks |

---

## Implementation Strategy (MVP First, Incremental Delivery)

**MVP — Phase 1 + 2 + 3 (T001–T021)**  
Deliver a working `bun ai:run` command that bootstraps context, selects skills deterministically,
validates architecture, writes an atomic execution log, enforces the 300s timeout, and exits with
the correct code. All unit tests for US1 must pass. This constitutes an independently verifiable
governance improvement.

**Increment 2 — Phase 4 (T022–T023)**  
Add `bun ai:plan`. Planning step is a safety gate (P2 priority); requires no new modules beyond
what Phase 3 already provides.

**Increment 3 — Phase 5 (T024–T026)**  
Add standalone `bun ai:validate`. Closes the governance loop. Integration test verifies real
subprocess behavior against the actual monorepo.

**Increment 4 — Phase 6 (T027–T030)**  
Wire CI enforcement. Final gate before merge. All three entry points must be working before CI
wiring begins.

**Increment 5 — Phase 7 (T031–T034)**  
Polish and compliance verification. All import-boundary, console, lint, and type checks pass.

---

## Exit Code Contract Reference (Mandatory Enforcement)

All tasks that implement or test entry points must enforce this contract exactly:

| Code | Meaning                   | Implementation Rule                                                                  |
| ---- | ------------------------- | ------------------------------------------------------------------------------------ |
| 0    | Pass / success            | `process.exit(0)` at end of successful main                                          |
| 1    | Fail / violations found   | `process.exit(isTimeout ? 2 : 1)` in catch handler                                   |
| 2    | Timeout exceeded          | `process.exit(isTimeout ? 2 : 1)` in catch handler — NOT thrown exception propagated |
| 3    | Missing / unreadable file | Direct `process.exit(3)` INSIDE try block after writing log — NOT thrown             |
| 4    | Stale brain               | Direct `process.exit(4)` INSIDE try block after writing log — NOT thrown             |

Brain-condition exits (3 for absent, 4 for stale) MUST be implemented as direct `process.exit(X)`
calls with the execution log pre-written. They MUST NOT be thrown as exceptions. The catch handler's
`isTimeout ? 2 : 1` logic does NOT handle exits 3 and 4.
