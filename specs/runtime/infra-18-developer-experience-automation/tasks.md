# Tasks: Developer Experience Automation

**Stage:** INFRA_18
**Phase:** 01_PLATFORM_FOUNDATION
**Branch:** `spec/infra-18-developer-experience-automation`
**Plan:** `specs/runtime/infra-18-developer-experience-automation/plan.md`
**Status:** READY FOR IMPLEMENTATION

---

## Dependency Notes

- **T001** must complete before T002–T005 (formatter is imported by all four scripts).
- **T002–T005** are parallel — each script is independent once T001 exists.
- **T006–T009** are parallel — each test file targets its own script; all scripts (T002–T005) must exist first.
- **T010** follows tests — `package.json` registers the scripts that were validated by tests.
- **T011** follows T010 — CI job references the `bun repo:doctor` script entry added in T010.
- **T012** follows T010 — README documents the script entries added in T010.

---

## Implementation Constraints (from spec/plan)

- `process.stdout.write` only — `console.log` is **banned** in all script files.
- Imports: `packages/types` permitted; all other `packages/*` are **forbidden** (`logger`, `domain-core`, `api-client`, `job-queue`, `redis-utils`, `validation`, `ui-system`).
- Node built-ins (`node:child_process`, `node:fs`, `node:net`) are permitted.
- Exit codes: `process.exit(hasError ? 1 : 0)` in all scripts; `repo:status` always exits `0`.
- `repo:onboard` Step 1 reads `engines.bun` from root `package.json`; aborts with `process.exit(1)` if version below minimum.
- `.env` check: key existence only vs `.env.example` keys — values are **never** read, stored, compared, or emitted.
- Scripts are pure developer tooling — no tenant DB access, no license middleware, no business logic from packages.
- `repo:fix` and `repo:onboard` must **not** be added to CI.

---

## Tasks

- [x] T001 Create shared output formatter module with `line`, `section`, and `summary` helpers using `process.stdout.write` only — `scripts/dev/formatter.ts`

- [x] T002 [P] Create 7-check repository health diagnostic runner that spawns `arch:guard`, `arch:validate-brain`, `ai-context:validate`, `type-safety-guard` as subprocesses and checks dependencies, workspace links, and `.env` key existence — `scripts/dev/repo-doctor.ts`

- [x] T003 [P] Create 5-step automated repository repair runner (continue-on-error, idempotent) that runs `bun install`, `arch:generate`, `ai-context:refresh`, `pm prune`, and `dist`/`.nuxt` artifact cleanup — `scripts/dev/repo-fix.ts`

- [x] T004 [P] Create 7-step new developer onboarding runner with hard-abort on Bun version mismatch (Step 1), warn-only TCP checks for PostgreSQL and Redis (Steps 4–5), and sequential subprocess chain — `scripts/dev/repo-onboard.ts`

- [x] T005 [P] Create read-only repository health summary reporter that captures output from `arch:health`, `ai-context:validate`, and `type-safety-guard`; reads `.cache/ci-status.json` advisory; always exits `0` — `scripts/dev/repo-status.ts`

- [x] T006 [P] Create unit tests covering all 7 doctor check functions in isolation (pass, warn, error paths) with mocked subprocesses; assert `.env.example` absent → warn; `.env` absent → error; missing env key → error; values never captured; CI gate: inject one failing mock → assert exit 1 and no early bail-out — `tests/unit/dev-scripts/repo-doctor.test.ts`

- [x] T007 [P] Create unit tests covering all 5 fix steps with mocked subprocess and filesystem calls; assert all-pass → exit 0; step failure → continue and exit 1; idempotency: two sequential runs produce identical output with no accumulated side effects; Step 5 only removes `dist/` not source files — `tests/unit/dev-scripts/repo-fix.test.ts`

- [x] T008 [P] Create unit tests covering onboard step ordering; assert Step 1 version mismatch → abort exit 1 with steps 2–7 not executed; TCP unreachable → warn only exit 0; all steps pass → exit 0; environment mock: Bun below minimum → upgrade message present — `tests/unit/dev-scripts/repo-onboard.test.ts`

- [x] T009 [P] Create unit tests for status reporter covering subprocess output parsing, `.cache/ci-status.json` absent → `"Unknown (no cached state)"`, output format column alignment, and always-zero exit code — `tests/unit/dev-scripts/repo-status.test.ts`

- [x] T013 [P] Create integration smoke test that runs `bun repo:doctor` against the actual environment; assert exit 0 or at least 1 check result captured; inject a missing env key via fixture directory and verify `✗` appears in output; must not mutate real `.env` — `tests/integration/dev-scripts/repo-doctor.integration.test.ts`

- [x] T010 Add `engines.bun` field (`">=1.3.9"`) and four `repo:*` script entries (`repo:doctor`, `repo:fix`, `repo:onboard`, `repo:status`) in the `repo:*` group — `package.json`

- [x] T011 Add `repo-doctor` parallel job inside the `# GROUP 1: CODE QUALITY` section of the CI workflow; job runs `bun repo:doctor` with Bun setup and `node_modules` cache restore; no `needs:` dependency — `.github/workflows/ci.yml`

- [x] T012 Add **Developer Quick Commands** section documenting all four `repo:*` commands with purpose table and usage guidance — `README.md`

---

## Summary

| Category         | Count  |
| ---------------- | ------ |
| New script files | 5      |
| New test files   | 5      |
| Modified files   | 3      |
| **Total tasks**  | **13** |

**Parallel groups:**

- T002–T005 run in parallel (all depend on T001 only)
- T006–T009, T013 run in parallel (all depend on T002–T005 completing)

**Sequential tail:** T010 → T011 → T012

**No new packages. No migrations. No schema changes.**
