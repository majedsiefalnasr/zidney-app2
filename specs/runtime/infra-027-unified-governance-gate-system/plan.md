# Plan: Unified Governance Gate System

**Stage:** INFRA-27
**Phase:** 01_PLATFORM_FOUNDATION
**Branch:** `spec/infra-027-unified-governance-gate-system`
**Date:** 2026-03-25

---

## Phase 0 — Research

All unknowns resolved. See `research.md` for full findings. Summary:

- All 5 upstream guards confirmed reachable via canonical names in `package.json`
- `ai-context:validate` alias does not exist — must be created, chaining `validate:ai-context-fresh && validate:ai-context-schemas`
- `governance:*` scripts: none exist — all 4 must be created
- `core/governance-validator.ts` is a domain utility for type-safety/brain validation; NOT used by gate scripts
- `docs/governance/governance-report.md` is absent from `.gitignore` — required deliverable
- Bun `$` API available via `import { $ } from 'bun'`; `.nothrow()` used for exit-code capture in report-all logic
- `governance` domain added as the 10th canonical domain in `script-system-governance/SKILL.md` (INFRA-27 deliverable — completed)
- `docs/governance/` directory does not exist — `report.ts` must create it
- CI workflow has 17 steps; new gate step goes after step 17
- Pre-commit: new gate call goes after Trivy secret scan, before the final success echo
- Orchestrator: Steps 6 and 7 require documentation edits to `.agents/agents/orchestrator.agent.md`

---

## Phase 1 — Design

### 1.1 — Script Architecture

Three new files in `scripts/governance/`:

---

#### `scripts/governance/gate.ts` — Full gate (report-all mode)

**Role:** Composes all 6 guards sequentially. Never short-circuits. Collects all exit codes,
reports all failures, exits `1` if any failed.

**Scheduling:** Called via `bun run governance:gate` (local full run, orchestrator Step 7).

**Design:**

```
main()
  guards = [arch:guard, validate:types, validate:scripts:runtime,
            validate:scripts:usage, infra:security:ci, ai-context:validate]
  results = []
  FOR each guard (sequential, no short-circuit):
    spawn: await $`bun run <script>`.nothrow()
    capture exitCode (default 1 on null)
    append to results
  PRINT summary table
  IF any exitCode !== 0 → process.exit(1)
  ELSE → process.exit(0)
```

**Key rule: `.nothrow()` required on every guard invocation.** Bun's `$` throws by default on
non-zero exit. `.nothrow()` returns the `ShellOutput` with `.exitCode` instead of throwing, enabling
report-all behavior.

**Key rule: stdout/stderr from sub-commands pass through.** Do NOT use `.quiet()` — developers must
see guard output. Bun's `$` passes through by default.

**Idempotency:** Fully idempotent. Delegates to deterministic guards. No mutable state.

**Exit codes:** `0` only if all guards pass. `1` if any guard produced a non-zero exit. No other exit
codes per FR-011.

---

#### `scripts/governance/gate-ci.ts` — CI variant

**Role:** Wraps `governance:gate` with CI-mode output annotations (GitHub Actions `::group::`). Exists
as a separate file to allow CI-specific formatting to evolve independently of the gate logic.

**Design:**

```
main()
  emit: console.log('::group::Unified Governance Gate')
  spawn: await $`bun run governance:gate`.nothrow()
  emit: console.log('::endgroup::')
  IF exitCode !== 0 → console.error('::error::Governance gate failed — see output above')
  process.exit(exitCode)
```

**Key rule:** Propagates the exit code from `governance:gate` unchanged (FR-002).

---

#### `scripts/governance/report.ts` — Report generator

**Role:** Runs health/context guards, produces `docs/governance/governance-report.md`.
Does NOT run the full gate — FR-004 specifies 3 guards: `arch:health`, `validate:ai-context-fresh`,
`validate:ai-context-schemas`. (These are the same guards as the `ai-context:validate` alias plus
`arch:health`.)

**Design:**

```
main()
  timestamp = new Date().toISOString()
  guards = [arch:health, validate:ai-context-fresh, validate:ai-context-schemas]
  results = []
  FOR each guard (sequential, capture output):
    proc = await $`bun run <script>`.nothrow()
    append { name, status: exitCode===0 ? 'PASS':'FAIL', exitCode }
  await mkdir('docs/governance', { recursive: true })
  build markdown report (see §1.5 for format)
  await writeFile('docs/governance/governance-report.md', report, 'utf8')
  console.log('✔ Report written to docs/governance/governance-report.md')
  process.exit(0)   ← report.ts always exits 0; it is an audit tool, not a gate
```

**Exit code:** `report.ts` always exits `0`. It is an informational audit tool. Failures are
reported in the generated markdown, not enforced via exit code. (This is consistent with FR-004
which says "generate a human-readable markdown report" — it does not say block on failure.)

---

### 1.2 — Package.json Script Registrations

Add the following entries to the `"scripts"` section of root `package.json`. Insert after the existing
`validate:ai-context-schemas` and `infra:security:ci` entries for logical grouping.

**New alias (prerequisite for `governance:gate`):**

```json
"ai-context:validate": "bun run validate:ai-context-fresh && bun run validate:ai-context-schemas",
```

**New governance scripts (add as a block, grouped together):**

```json
"governance:gate": "bun scripts/governance/gate.ts",
"governance:gate:ci": "bun scripts/governance/gate-ci.ts",
"governance:gate:changed": "bun run arch:guard:changed && bun run validate:scripts:all",
"governance:report": "bun scripts/governance/report.ts",
```

**Notes:**

- `governance:gate:changed` is a single-line shell composition (FR-005 permits this). It uses `&&`
  which short-circuits on first failure — acceptable per spec ("MAY be implemented as a single-line
  package.json script"). Exit code is still `1` on any failure.
- `governance` is the 10th canonical domain — registered in `script-system-governance/SKILL.md`
  as part of this stage (FR-006 and Technical Constraints). Not a tracked exception.

---

### 1.3 — Pre-Commit Integration

**Location:** `.husky/pre-commit`

**Insertion point:** After the Trivy secret scan block (which ends with its `|| { exit 1 }` wrapper),
immediately before the final `echo "✔ Pre-commit checks passed"` line.

**Exact lines to add:**

```bash
# ── Unified Governance Gate (changed-files scope) ─────────────────────────
echo "Running unified governance gate (changed-files scope)…"
bun run governance:gate:changed || {
  echo "❌ Unified governance gate blocked the commit."
  echo "   Run: bun run governance:gate:changed to see all violations."
  exit 1
}
```

**Design rationale:**

- Runs unconditionally — not gated on `$CODE_FILES` — because `arch:guard:changed` internally
  handles changed-file detection, and `validate:scripts:runtime` is also file-aware.
- The existing `bun scripts/ai-guard.ts` block (in the "Architecture Guard" section) uses the full
  guard without `--changed`. The new `governance:gate:changed` uses `arch:guard:changed` (`--changed`
  flag). While there is some conceptual overlap, FR-010 confirms the gate is an orchestration layer —
  it must not remove existing hooks.
- No new Trivy check is added here — Trivy is already covered in the pre-commit by `infra:security:deps`
  and `infra:security:secrets`. The `governance:gate:changed` scope is architecture + script governance.

---

### 1.4 — CI Workflow Integration

**File:** `.github/workflows/architecture-governance.yml`

**Insertion point:** After step 17 (`Verify Script Registry Generation`), as the new final step.

**Exact YAML block to append:**

```yaml
# ── 18. Unified Governance Gate ─────────────────────────────────────
- name: Unified Governance Gate
  run: bun run governance:gate:ci
```

**Notes:**

- No `if: always()` — this step must fail the workflow run on non-zero exit (FR-008).
- No `if: failure()` — it is a blocking gate, not a cleanup step.
- Positioned last so all individual guards have already run and produced their own step summaries
  before the unified gate aggregates.

---

### 1.5 — Report Structure

File: `docs/governance/governance-report.md` (generated by `governance:report`)

```markdown
# Governance Report

**Generated:** <ISO 8601 timestamp>

## Guard Summary

| Guard               | Status  |
| ------------------- | ------- |
| Architecture Health | ✅ PASS |
| AI Context Fresh    | ✅ PASS |
| AI Context Schemas  | ✅ PASS |

## Blocking Violations

_None_

## Warnings

_None_
```

When failures exist:

```markdown
## Blocking Violations

- **Architecture Health** (`arch:health`) exited with code 1

## Warnings

_None_
```

**Fields required by FR-004:**

- ✅ Run timestamp
- ✅ Pass/fail status per guard
- ✅ Blocking violations section
- ✅ Non-blocking warnings section

---

### 1.6 — `.gitignore` Update

**File:** `.gitignore`

**Section to append** (after the existing `docs/` entries block):

```gitignore
# Governance report (generated artifact — not for version control)
docs/governance/governance-report.md
```

**Confirmed not yet in `.gitignore`** (see research.md §8 and spec Q3 clarification).

---

### 1.7 — Script Metadata Headers

All three new `.ts` files use JSDoc-block format (matching codebase convention — see research.md §6):

**`gate.ts`:**

```typescript
/**
 * @script governance:gate
 * @domain governance
 * @category governance
 * @description Unified governance gate — composes all guards in sequence (report-all mode)
 *
 * @usage bun run governance:gate
 */
```

**`gate-ci.ts`:**

```typescript
/**
 * @script governance:gate:ci
 * @domain governance
 * @category governance
 * @description CI variant of the governance gate — runs gate.ts with GitHub Actions annotations
 *
 * @usage bun run governance:gate:ci
 */
```

**`report.ts`:**

```typescript
/**
 * @script governance:report
 * @domain governance
 * @category governance
 * @description Generates a consolidated governance health report at docs/governance/governance-report.md
 *
 * @usage bun run governance:report
 */
```

---

## Phase 2 — Implementation Sequence

Execute in this order. Each step is independently verifiable before proceeding.

**Step 1 — Add `ai-context:validate` alias to `package.json`**

- Insert: `"ai-context:validate": "bun run validate:ai-context-fresh && bun run validate:ai-context-schemas"`
- Verify: `bun run ai-context:validate` exits 0

**Step 2 — Add `governance:gate`, `governance:gate:ci`, `governance:gate:changed`, `governance:report` to `package.json`**

- Insert 4 script entries per §1.2
- Verify: `bun run --list | grep governance` shows all 4 new scripts

**Step 3 — Create `scripts/governance/gate.ts`**

- New file with shebang, metadata header (§1.7), `import { $ } from 'bun'`
- Implement sequential report-all runner per §1.1
- Verify: `bun scripts/governance/gate.ts` exits 0 on clean repo

**Step 4 — Create `scripts/governance/gate-ci.ts`**

- New file with shebang, metadata header (§1.7), wraps `governance:gate`
- Verify: `bun scripts/governance/gate-ci.ts` exits 0 on clean repo; emits `::group::` markers

**Step 5 — Create `scripts/governance/report.ts`**

- New file with shebang, metadata header (§1.7), imports `{ $ } from 'bun'` and `{ writeFile, mkdir } from 'node:fs/promises'`
- Implement report generator per §1.1 and §1.5
- Verify: `bun run governance:report` writes `docs/governance/governance-report.md` with correct structure

**Step 6 — Add `docs/governance/governance-report.md` to `.gitignore`**

- Append block per §1.6
- Verify: `git check-ignore -v docs/governance/governance-report.md` returns a match

**Step 7 — Extend `.husky/pre-commit`**

- Insert block per §1.3 (after Trivy secret scan, before final echo)
- Verify: `bash --norc .husky/pre-commit` runs without syntax errors

**Step 8 — Add step 18 to `.github/workflows/architecture-governance.yml`**

- Append YAML block per §1.4 after step 17
- Verify: `yamllint` or workflow validation passes; step appears in local dry-run

**Step 9 — Update orchestrator definition**

- File: `.agents/agents/orchestrator.agent.md`
- **Step 6.1 addition:** After the existing implementation gate checks, add:
  ```
  ## 6.1B — Governance Gate (Changed-Files)
  Run: bun run governance:gate:changed
  If exit code is 1 → STOP. Surface the gate output. Blocked until violations resolved.
  ```
- **Step 7 addition:** At the beginning of the closure flow, add:
  ```
  ## 7.0 — Final Governance Gate
  Run: bun run governance:gate
  If exit code is 1 → STOP. Surface the gate output. Stage cannot close with governance violations.
  ```
- Verify: Orchestrator instructions clearly reference both gate invocations

**Step 10 — Run full validation suite**

- See Phase 3 below

---

## Phase 3 — Validation Strategy

### V-1: Smoke Test — Clean State

```bash
bun run governance:gate
# Expected: exit 0, all 6 guards pass, summary table shows ✔ for all
```

### V-2: Report Generation

```bash
bun run governance:report
# Expected: docs/governance/governance-report.md created with timestamp,
#           3 guards in table, "None" for violations and warnings
cat docs/governance/governance-report.md
```

### V-3: Changed-Files Gate Performance

```bash
# Stage a .ts file, then time the changed gate
git add apps/api/src/index.ts  # or any existing .ts file
time bun run governance:gate:changed
# Expected: exit 0, completes in < 10 seconds
git restore --staged apps/api/src/index.ts
```

### V-4: Failure Propagation (Architecture Violation)

```bash
# Inject a known arch violation: add a direct cross-app import in a test file
echo "import { something } from '../../backoffice/src/index'" > /tmp/test-violation.ts
cp /tmp/test-violation.ts apps/api/src/__test_violation__.ts
git add apps/api/src/__test_violation__.ts
bun run governance:gate
# Expected: exit 1, arch:guard reports violation
git rm apps/api/src/__test_violation__.ts
git restore --staged apps/api/src/__test_violation__.ts
```

### V-5: Failure Propagation (Type Safety)

```bash
# Use an existing `any` injection to verify validate:types failure propagates
# (Verify against ALLOWED_ANY_EXCEPTIONS.json first to pick a non-excepted location)
bun run governance:gate
# After injecting violation: Expected exit 1, validate:types reports the any usage
```

### V-6: Report-All Verification

```bash
# Temporarily break two guards — verify gate reports BOTH failures (no short-circuit)
# Inject arch violation + type violation together
bun run governance:gate
# Expected: exit 1, summary table shows ✖ for at least 2 guards, not just the first
```

### V-7: CI Gate Variant

```bash
bun run governance:gate:ci
# Expected: exit 0, output includes ::group::Unified Governance Gate and ::endgroup::
```

### V-8: gitignore Protection

```bash
bun run governance:report
git status docs/governance/governance-report.md
# Expected: file is NOT shown in `git status` (ignored by .gitignore)
git check-ignore -v docs/governance/governance-report.md
# Expected: line from .gitignore confirms the rule
```

### V-9: Script Registry Compliance

```bash
bun run validate:scripts:infrastructure
# Expected: exit 0 — new scripts have valid 5-field headers and are registered
bun run validate:scripts:usage
# Expected: exit 0 — all governance:* script references are valid
```

### V-10: Pre-Commit Hook Smoke Test

```bash
# Stage any .ts file and attempt a commit in a test branch
git checkout -b test/governance-hook-smoke
touch test-smoke.ts && git add test-smoke.ts
git commit --no-verify  # bypass to confirm hook is wired but not double-running
git commit  # runs hook
# Expected: governance:gate:changed step appears in hook output, exits 0
git checkout -  # return to original branch
git branch -D test/governance-hook-smoke
```

---

## Appendix A — Composed Guard Reference

| Position | Guard Name          | Script                     | Canonical Command                                                                |
| -------- | ------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| 1        | Architecture Guard  | `arch:guard`               | `bun scripts/architecture-guard/architecture-guard.ts`                           |
| 2        | Type Safety         | `validate:types`           | `bun typecheck && bun arch:type-safety-guard --json`                             |
| 3        | Runtime Scripts     | `validate:scripts:runtime` | `bun run scripts/validate/runtime-scripts.ts`                                    |
| 4        | Script Usage        | `validate:scripts:usage`   | `bun scripts/validate/script-usage.ts`                                           |
| 5        | Security CI         | `infra:security:ci`        | `bun scripts/security/scan-ci.ts`                                                |
| 6        | AI Context Validate | `ai-context:validate`      | `validate:ai-context-fresh && validate:ai-context-schemas` (**alias to create**) |

**Changed-files gate subset (FR-003):**

| Position | Guard Name                   | Script                     |
| -------- | ---------------------------- | -------------------------- |
| 1        | Architecture Guard (changed) | `arch:guard:changed`       |
| 2        | Runtime Scripts              | `validate:scripts:runtime` |

**Report guards (FR-004):**

| Position | Guard Name          | Script                        |
| -------- | ------------------- | ----------------------------- |
| 1        | Architecture Health | `arch:health`                 |
| 2        | AI Context Fresh    | `validate:ai-context-fresh`   |
| 3        | AI Context Schemas  | `validate:ai-context-schemas` |

---

## Appendix B — Files to Create / Modify

| Action | File                                            | Purpose                                                         |
| ------ | ----------------------------------------------- | --------------------------------------------------------------- |
| CREATE | `scripts/governance/gate.ts`                    | Full governance gate                                            |
| CREATE | `scripts/governance/gate-ci.ts`                 | CI variant wrapper                                              |
| CREATE | `scripts/governance/report.ts`                  | Report generator                                                |
| MODIFY | `package.json`                                  | Add 5 script entries (`ai-context:validate` + 4 `governance:*`) |
| MODIFY | `.husky/pre-commit`                             | Add `governance:gate:changed` block before final echo           |
| MODIFY | `.github/workflows/architecture-governance.yml` | Add step 18 (Unified Governance Gate)                           |
| MODIFY | `.gitignore`                                    | Add `docs/governance/governance-report.md`                      |
| MODIFY | `.agents/agents/orchestrator.agent.md`          | Add gate calls to Step 6.1 and Step 7                           |

**DO NOT modify:**

- `scripts/governance/core/governance-validator.ts`
- `scripts/governance/type-safety-guard.ts`
- `scripts/governance/validate-architecture-brain.ts`
- Any upstream guard scripts (arch-guard, validate, security, ai-context)
