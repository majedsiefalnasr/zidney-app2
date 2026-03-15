# Plan — STAGE_INFRA_19_AI_AGENT_RUNTIME_ENVIRONMENT

**Prepared by:** speckit.plan  
**Date:** 2026-03-15  
**Stage:** INFRA_19  
**Phase:** 01_PLATFORM_FOUNDATION  
**Stage Status:** DRAFT

---

## Overview

This plan delivers the STAGE_INFRA_19 AI Agent Runtime Environment in **7 sequential tasks**. All
work is additive-only: one new script file, three package.json entries, and one CI step. No existing
governance scripts, packages, or apps are modified.

**Deliverables:**

| Artifact                                                          | Type          |
| ----------------------------------------------------------------- | ------------- |
| `scripts/ai-runtime/runtime-status.ts`                            | New file      |
| `package.json` — 3 new script entries                             | Modified file |
| `.github/workflows/ci.yml` — 1 new step in `arch-guard` job       | Modified file |
| `tests/unit/ai-runtime/runtime-status.test.ts`                    | New file      |
| `tests/integration/ai-runtime/runtime-status.integration.test.ts` | New file      |

---

## Section 1 — Script Implementation Design

### 1.1 File Location

```
scripts/ai-runtime/runtime-status.ts
```

### 1.2 Module Interface (Exported Functions)

The script exports **one pure check function per layer** so each can be unit-tested in isolation.
This mirrors the pattern in `scripts/ai-guard.ts` (which exports `detectModule`, `extractImports`,
etc.) and `scripts/dev/repo-status.ts` (which exports `checkAiContext`, `checkArchHealth`, etc.).

```typescript
// types
export type CheckStatus = "ok" | "warning" | "error";

export interface CheckResult {
  layer: string; // Layer name for display
  status: CheckStatus; // 'ok' | 'warning' | 'error'
  message: string; // Human-readable result message
  suggestion?: string; // Remediation command (required when status === 'error')
}

// Exported check functions (each takes the repo root path)
export function checkContextLoader(root: string): CheckResult;
export function checkSkillLoader(root: string): CheckResult;
export function checkArchitectureIntelligence(root: string): CheckResult;
export function checkMcpRouting(root: string): CheckResult;
export function checkDeterministicExecution(root: string): CheckResult;

// Entry point
export async function main(): Promise<void>;
```

### 1.3 Per-Check Logic

#### Check 1: Context Loader (`checkContextLoader`)

**Layer:** Context Loader (Layer 1)

**Required artifact list** (6 files — error-level if any are absent):

```
docs/ai/context/ai-context-mini.json
docs/ai/context/ai-architecture-brain.json
docs/ai/context/ai-module-map.json
docs/ai/context/ai-layer-model.json
docs/ai/context/ai-runtime-map.json
docs/ai/context/ai-dependency-graph.json
```

**Logic:**

```
1. For each artifact path: check existsSync(join(root, path))
2. Collect missing artifacts
3. If any missing → return { status: 'error', suggestion: 'bun ai-runtime:refresh' }
4. If all present → check freshness of ai-context-mini.json:
   - statSync(join(root, 'docs/ai/context/ai-context-mini.json')).mtimeMs
   - threshold: FRESHNESS_THRESHOLD_MS (default: 24 * 60 * 60 * 1000 = 86_400_000)
   - can be overridden by env: AI_RUNTIME_FRESHNESS_THRESHOLD_MS
   - If age > threshold → return { status: 'warning', suggestion: 'bun ai-runtime:refresh' }
5. All present and fresh → return { status: 'ok' }
```

**Implementation notes:**

- Use `existsSync` from `node:fs`
- Use `statSync` from `node:fs` for timestamp
- Use `Date.now()` for current time (not server-authoritative — this is dev tooling)
- Must not read file contents in this check; presence-only

---

#### Check 2: Skill Loader (`checkSkillLoader`)

**Layer:** Skill Loader (Layer 2)

**Required skill directories** (7 directories, each must contain `SKILL.md`):

```
.agents/skills/architecture-intelligence/SKILL.md
.agents/skills/architecture-self-healing/SKILL.md
.agents/skills/analysis-retry-engine/SKILL.md
.agents/skills/subagent-parallelization/SKILL.md
.agents/skills/terminal-safety/SKILL.md
.agents/skills/rtk-execution-layer/SKILL.md
.agents/skills/mcp-routing/SKILL.md
```

**Logic:**

```
1. For each skill: check existsSync(join(root, '.agents/skills', skill, 'SKILL.md'))
2. Collect missing entries (either directory absent or SKILL.md absent)
3. Count present = SKILLS.length - missing.length
4. If any missing → return { status: 'error', message: `Core skills present (${present}/7)`,
                              suggestion: 'Restore missing skill directories under .agents/skills/' }
5. All present → return { status: 'ok', message: 'Core skills present (7/7)' }
```

---

#### Check 3: Architecture Intelligence (`checkArchitectureIntelligence`)

**Layer:** Architecture Intelligence Layer (Layer 3)

**Sub-checks (run in order; first error wins for aggregated status, but both always run):**

**3a. Architecture brain parseable:**

```
1. brainPath = join(root, 'docs/ai/context/ai-architecture-brain.json')
2. If not existsSync(brainPath) → mark brain as error (can't proceed to parse)
3. Else: attempt JSON.parse(readFileSync(brainPath, 'utf-8'))
   - If throws → brain error: unparseable; suggestion: 'bun arch:audit'
   - If null or empty object → brain error; suggestion: 'bun arch:audit'
   - Else → brain parsed OK; proceed to edge check
4. Edge validity check (warning level):
   - If parsed.dependencyGraph?.edges is an array:
     - Sample the first 200 edges
     - Count violations: edges where from or to starts with './' or contains 'src/' not at root
     - If violations > 0 → warning; suggestion: 'bun arch:validate-brain'
```

**3b. Architecture map exists:**

```
1. mapPath = join(root, 'docs/architecture/intelligence/ARCHITECTURE_MAP.json')
2. If not existsSync(mapPath) → error; suggestion: 'bun arch:generate'
```

**Aggregated result:**

```
- If brain error OR map error → status: 'error'
- If brain warning → status: 'warning', message includes violation count
- If both ok → status: 'ok', message: 'Brain valid, ARCHITECTURE_MAP.json present'
```

---

#### Check 4: MCP Routing (`checkMcpRouting`)

**Layer:** MCP Routing Layer (Layer 4)

**Logic:**

```
1. matrixPath = join(root, 'docs/ai/MCP_ACTIVATION_MATRIX.md')
2. If not existsSync(matrixPath) → return { status: 'warning',
                                             message: 'MCP activation matrix absent',
                                             suggestion: 'Restore docs/ai/MCP_ACTIVATION_MATRIX.md' }
3. Present → return { status: 'ok', message: 'MCP activation matrix present' }
```

Note: Per spec, MCP activation matrix absence is warning-level, not error-level.

---

#### Check 5: Deterministic Execution (`checkDeterministicExecution`)

**Layer:** Deterministic Execution Layer (Layer 5)

**Required governance scripts** (5 paths):

```
scripts/ai-guard.ts
scripts/infra-audit.ts
scripts/governance/validate-architecture-brain.ts
scripts/architecture-guard/architecture-guard.ts
scripts/type-safety-guard.ts
```

**Logic:**

```
1. For each script path: check existsSync(join(root, path))
2. Collect missing scripts
3. If any missing → return { status: 'error',
                              message: `Missing: ${missing.join(', ')}`,
                              suggestion: 'Restore missing governance scripts' }
4. All present → return { status: 'ok', message: 'Runtime governance scripts present' }
```

---

### 1.4 Output Format

Use `process.stdout.write` exclusively — `console.log` is banned.

```
AI Runtime Status
─────────────────
[✔] Context Loader:              AI context artifacts present and fresh
[✔] Skill Loader:                Core skills present (7/7)
[✔] Architecture Intelligence:   Brain valid, ARCHITECTURE_MAP.json present
[✔] MCP Routing:                 MCP activation matrix present
[✔] Deterministic Execution:     Runtime governance scripts present

AI runtime environment: HEALTHY
```

When errors exist:

```
AI Runtime Status
─────────────────
[✗] Context Loader:              6 artifacts absent → run: bun ai-runtime:refresh
[✔] Skill Loader:                Core skills present (7/7)
[✗] Architecture Intelligence:   Brain unparseable → run: bun arch:audit
[⚠] MCP Routing:                 MCP activation matrix absent
[✔] Deterministic Execution:     Runtime governance scripts present

AI runtime environment: UNHEALTHY (2 errors, 1 warning)
```

**Formatting constants:**

```typescript
const LABEL_WIDTH = 32; // left-justified label column
const SYMBOL_OK = "[✔]";
const SYMBOL_WARNING = "[⚠]";
const SYMBOL_ERROR = "[✗]";
```

**Summary line logic:**

```typescript
const errors = results.filter((r) => r.status === "error").length;
const warnings = results.filter((r) => r.status === "warning").length;
const healthy = errors === 0;

const summaryLabel = healthy ? "HEALTHY" : "UNHEALTHY";
const summaryDetail = healthy
  ? ""
  : ` (${errors} error${errors !== 1 ? "s" : ""}, ${warnings} warning${warnings !== 1 ? "s" : ""})`;
```

---

### 1.5 Exit Code Logic

```typescript
const hasErrors = results.some((r) => r.status === "error");
process.exit(hasErrors ? 1 : 0);
```

- Exit code `0` → all checks pass or only warnings
- Exit code `1` → at least one error-level check failed

---

### 1.6 Allowed Imports

```typescript
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
// Optional: types from packages/types — compile-time only, zero runtime deps
```

**Forbidden imports:**

- `packages/logger` — backend-scoped with service dependencies
- `packages/domain-core`, `packages/api-client`, `packages/job-queue`, `packages/redis-utils`
- `packages/ui-system`, `packages/validation`
- Any `apps/*` import
- Any external npm package
- `console.log` (output method is `process.stdout.write`)

---

### 1.7 Error Safety

Each check function wraps its logic in a `try/catch`. If a check throws unexpectedly, it returns:

```typescript
{ layer: '...', status: 'error', message: 'Check failed with exception', suggestion: '...' }
```

This ensures all 5 checks always complete and report, even if one has an unexpected runtime error.

---

### 1.8 Freshness Threshold Environment Variable

```typescript
const DEFAULT_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

function getFreshnessThreshold(): number {
  const envVal = process.env.AI_RUNTIME_FRESHNESS_THRESHOLD_MS;
  if (envVal) {
    const parsed = Number(envVal);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_THRESHOLD_MS;
}
```

The env variable allows CI to override the threshold without code changes.

---

## Section 2 — `package.json` Script Registration

### 2.1 Exact Lines to Add

These 3 lines are added to the `"scripts"` object in `package.json`, placed after the existing
`ai-context:*` group and before `repo:*`:

```json
"ai-runtime:status":   "bun scripts/ai-runtime/runtime-status.ts",
"ai-runtime:refresh":  "bun ai-context:refresh",
"ai-runtime:validate": "bun arch:validate-brain"
```

### 2.2 Delegation Targets Verification

| New Script            | Delegates To              | Delegates Target Exists?    |
| --------------------- | ------------------------- | --------------------------- |
| `ai-runtime:status`   | new script (direct)       | ✓ (after T002)              |
| `ai-runtime:refresh`  | `bun ai-context:refresh`  | ✓ (already in package.json) |
| `ai-runtime:validate` | `bun arch:validate-brain` | ✓ (already in package.json) |

### 2.3 Placement Rationale

These scripts are grouped with related AI/architecture tooling. In the existing `package.json`,
scripts are in this order:

1. `typecheck:*`, `lint:*`, `format:*`, `validate:*`, `check:*`
2. `test:*`
3. `build`, `dev:*`
4. `prepare`
5. `arch:*`
6. `type-safety-guard`, `validate:types`
7. **`ai-context:*`** ← insert `ai-runtime:*` here
8. `repo:*`

This keeps all AI tooling scripts co-located.

---

## Section 3 — CI Integration

### 3.1 Target File

`.github/workflows/ci.yml`

### 3.2 Target Job

`arch-guard` (Job 3, Group 1, "AI-Guard — Architecture Boundaries")

### 3.3 Exact Step Placement

The new step is inserted **after** the `module-boundary-validation` step and **before** the
`Save ai-context artifacts cache (T087)` step:

**Before (existing steps 6–7):**

```yaml
- name: module-boundary-validation
  run: bun run arch:guard

- name: Save ai-context artifacts cache (T087)
  if: steps.cache-ai-context.outputs.cache-hit != 'true'
  uses: actions/cache/save@v4
  with:
    path: docs/ai/context/
    key: ai-context-${{ hashFiles('package.json', 'bun.lock', 'scripts/ai-context/**/*') }}
```

**After (with two new steps inserted):**

```yaml
- name: module-boundary-validation
  run: bun run arch:guard

- name: Generate ai-context on cache miss
  if: steps.cache-ai-context.outputs.cache-hit != 'true'
  run: bun run ai-context:refresh

- name: AI Agent Runtime Status Check
  run: bun ai-runtime:status

- name: Save ai-context artifacts cache (T087)
  if: steps.cache-ai-context.outputs.cache-hit != 'true'
  uses: actions/cache/save@v4
  with:
    path: docs/ai/context/
    key: ai-context-${{ hashFiles('package.json', 'bun.lock', 'scripts/ai-context/**/*') }}
```

> **Cache-miss safety:** The conditional `Generate ai-context on cache miss` step ensures that
> `docs/ai/context/` artifacts are present before `bun ai-runtime:status` runs. Without this
> step, a cold cache would cause `checkContextLoader` to report 2 missing artifacts (exit 1),
> blocking all downstream Group 2 tests as a false positive. This guard ensures the status
> check only fails on genuine runtime environment problems, not on CI infrastructure state.

### 3.4 Why This Placement

- The `docs/ai/context/` artifacts cache is restored in step 5 (`Restore ai-context artifacts
cache`) — available to `bun ai-runtime:status` when it runs in step 7
- `bun install` is complete in step 4 — Bun runtime is available
- Placed after `arch:guard` so architectural boundary violations fail first (faster feedback)
- Does not block the `Save ai-context artifacts cache` step from completing

### 3.5 CI Behavior Contract

- Exit code non-zero → CI pipeline fails at `arch-guard` job → Group 2 tests do not run
- Warnings only → exit code 0 → CI continues
- `ai-runtime:refresh` and `ai-runtime:validate` are NOT run in CI (status only)
- No sensitive output ever printed by `bun ai-runtime:status`

---

## Section 4 — Test Plan

### 4.1 Unit Tests

**File:** `tests/unit/ai-runtime/runtime-status.test.ts`

**Pattern:** Follows `tests/unit/ai-guard/ai-guard-validation.test.ts` and
`tests/unit/dev-scripts/repo-status.test.ts`.

Mock `node:fs` at module level:

```typescript
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    readFileSync: vi.fn(actual.readFileSync),
    statSync: vi.fn(actual.statSync),
  };
});
import { existsSync, readFileSync, statSync } from "node:fs";
import {
  checkContextLoader,
  checkSkillLoader,
  checkArchitectureIntelligence,
  checkMcpRouting,
  checkDeterministicExecution,
} from "../../../scripts/ai-runtime/runtime-status";
```

**Test cases per function:**

#### `checkContextLoader`

| Test Name                                                 | Setup                                            | Expected                                     |
| --------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------- |
| returns ok when all 6 artifacts present and fresh         | existsSync → true; statSync returns recent mtime | `status: 'ok'`                               |
| returns warning when artifacts present but stale          | existsSync → true; statSync returns old mtime    | `status: 'warning'`                          |
| returns error when any artifact absent                    | existsSync → false for one artifact              | `status: 'error'`                            |
| error result includes suggestion 'bun ai-runtime:refresh' | existsSync → false                               | suggestion contains `bun ai-runtime:refresh` |
| missing artifacts listed in message                       | existsSync → false for 2 artifacts               | message lists missing artifact paths         |

#### `checkSkillLoader`

| Test Name                                          | Setup                       | Expected                                               |
| -------------------------------------------------- | --------------------------- | ------------------------------------------------------ |
| returns ok when all 7 skill SKILL.md files present | existsSync → true for all 7 | `status: 'ok'`, `message: 'Core skills present (7/7)'` |
| returns error when one skill SKILL.md absent       | existsSync → false for one  | `status: 'error'`                                      |
| returns error when skill directory itself absent   | existsSync → false for dir  | `status: 'error'`                                      |
| count is correct in message when 5 of 7 present    | existsSync → false for 2    | message contains `(5/7)`                               |

#### `checkArchitectureIntelligence`

| Test Name                                                          | Setup                                                             | Expected                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------- |
| returns ok when brain valid and ARCHITECTURE_MAP.json present      | existsSync → true; readFileSync → valid JSON                      | `status: 'ok'`                                    |
| returns error when brain absent                                    | existsSync → false for brain path                                 | `status: 'error'`, suggestion `bun arch:audit`    |
| returns error when brain JSON is unparseable                       | readFileSync → throws SyntaxError                                 | `status: 'error'`, suggestion `bun arch:audit`    |
| returns error when brain is empty object {}                        | readFileSync → `'{}'`                                             | `status: 'error'`, suggestion `bun arch:audit`    |
| returns warning when brain edges contain relative paths            | readFileSync → JSON with edges `[{from:'./pkg',...}]`             | `status: 'warning'`                               |
| returns warning when brain edges contain segment-beyond-root paths | readFileSync → JSON with edges `[{from:'srcvue/test-utils',...}]` | `status: 'warning'`                               |
| returns error when ARCHITECTURE_MAP.json absent                    | existsSync → true for brain, false for map                        | `status: 'error'`, suggestion `bun arch:generate` |

#### `checkMcpRouting`

| Test Name                                            | Setup              | Expected            |
| ---------------------------------------------------- | ------------------ | ------------------- |
| returns ok when MCP_ACTIVATION_MATRIX.md present     | existsSync → true  | `status: 'ok'`      |
| returns warning when MCP_ACTIVATION_MATRIX.md absent | existsSync → false | `status: 'warning'` |

#### `checkDeterministicExecution`

| Test Name                                        | Setup                            | Expected                    |
| ------------------------------------------------ | -------------------------------- | --------------------------- |
| returns ok when all 5 governance scripts present | existsSync → true for all 5      | `status: 'ok'`              |
| returns error when one script absent             | existsSync → false for one       | `status: 'error'`           |
| missing script names included in message         | existsSync → false for 2 scripts | message lists missing paths |

#### Exit Code Behavior (test via `main()` mocking process.exit)

| Test Name                                  | Setup                     | Expected              |
| ------------------------------------------ | ------------------------- | --------------------- |
| exits 0 when all checks pass               | all checks return ok      | process.exit(0)       |
| exits 0 when only warnings exist           | one check returns warning | process.exit(0)       |
| exits 1 when any error-level check fails   | one check returns error   | process.exit(1)       |
| all checks run even when first check fails | first check returns error | all 5 checks complete |

---

### 4.2 Integration Tests

**File:** `tests/integration/ai-runtime/runtime-status.integration.test.ts`

**Pattern:** Follows `tests/integration/ai-context-integration.test.ts`. Uses real filesystem. Runs
against the actual local Zidney repo in a healthy state.

```typescript
import { describe, expect, it } from "vitest";
import {
  checkContextLoader,
  checkSkillLoader,
  checkArchitectureIntelligence,
  checkMcpRouting,
  checkDeterministicExecution,
} from "../../../scripts/ai-runtime/runtime-status";
```

**Test cases:**

| Test Name                                                                         | Expected                           |
| --------------------------------------------------------------------------------- | ---------------------------------- |
| checkContextLoader returns ok or warning in healthy repo (no error)               | `status !== 'error'`               |
| checkSkillLoader returns ok in healthy repo — all 7 skills present                | `status: 'ok'`, `(7/7)` in message |
| checkArchitectureIntelligence returns ok or warning — brain parses and map exists | `status !== 'error'`               |
| checkMcpRouting returns ok — MCP_ACTIVATION_MATRIX.md present                     | `status: 'ok'`                     |
| checkDeterministicExecution returns ok — all governance scripts present           | `status: 'ok'`                     |
| Full status command exits 0 in healthy local environment                          | Combined `process.exitCode` = 0    |

**Notes:**

- Integration tests must not modify any files
- Integration tests use `process.cwd()` as `root` (assumed to be repo root when run via `vitest run`)
- If context artifacts are absent on CI, the `checkContextLoader` test checks only that it does NOT
  throw (exit code contract is unit-tested via mocks)

---

## Section 5 — Architecture Impact Analysis

### 5.1 New Files

| File                                                              | Purpose                       |
| ----------------------------------------------------------------- | ----------------------------- |
| `scripts/ai-runtime/runtime-status.ts`                            | AI runtime diagnostics script |
| `tests/unit/ai-runtime/runtime-status.test.ts`                    | Unit tests                    |
| `tests/integration/ai-runtime/runtime-status.integration.test.ts` | Integration tests             |

### 5.2 Modified Files

| File                       | Change                               |
| -------------------------- | ------------------------------------ |
| `package.json`             | 3 new script entries added           |
| `.github/workflows/ci.yml` | 1 new step added to `arch-guard` job |

### 5.3 No Module Changes

- No new entries in `docs/architecture/intelligence/ARCHITECTURE_MAP.json` — scripts remain outside
  the module boundary system (`scripts/` is not a declared module)
- No `bun run arch:add-module` needed — `scripts/ai-runtime/` is not a `packages/` or `apps/` module
- `bun arch:guard` and `bun scripts/ai-guard.ts` will not flag this script (it is in `scripts/`,
  which is outside the app/package boundary rules)
- Zero new npm/bun package dependencies

### 5.4 Import Boundary Compliance

`runtime-status.ts` imports only:

```typescript
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
```

These are Node.js builtins available in Bun. No `packages/*` or `apps/*` imports. Passes
`bun arch:guard` unchanged.

### 5.5 Risk Assessment

**Risk Level: LOW**

| Dimension        | Assessment                                                        |
| ---------------- | ----------------------------------------------------------------- |
| Breaking changes | None — no existing APIs altered                                   |
| Tenant safety    | Unaffected — no database access                                   |
| Security surface | No new inbound attack surface; script never prints secrets        |
| CI pipeline      | Additive step only; fail = fast feedback, not false positive risk |
| Reversibility    | Fully reversible: delete the 3 files + revert 4 lines in 2 files  |

---

## Section 6 — Implementation Order

Tasks must be executed in this order. T001–T004 are implementation tasks; T005–T006 are test tasks;
T007 is validation.

---

### T001 — Create `scripts/ai-runtime/` Directory

**Action:** Create directory `scripts/ai-runtime/`

**Command:**

```bash
mkdir -p scripts/ai-runtime
```

**Verification:** `ls scripts/ai-runtime/` → empty directory exists

---

### T002 — Implement `scripts/ai-runtime/runtime-status.ts`

**Action:** Create `scripts/ai-runtime/runtime-status.ts` with the full implementation.

**File structure:**

```
File header comment (stage reference, usage)
│
├── Imports: node:fs (existsSync, readFileSync, statSync), node:path (join)
│
├── Constants:
│   REPO_ROOT, FRESHNESS_THRESHOLD_MS, getFreshnessThreshold()
│   LABEL_WIDTH, SYMBOL_OK, SYMBOL_WARNING, SYMBOL_ERROR
│   REQUIRED_ARTIFACTS (6 paths)
│   REQUIRED_SKILLS (7 skill names)
│   REQUIRED_SCRIPTS (5 paths)
│
├── Types: CheckStatus, CheckResult
│
├── Formatter helpers:
│   formatSymbol(status: CheckStatus): string
│   formatLine(result: CheckResult): string
│
├── Exported check functions:
│   checkContextLoader(root: string): CheckResult
│   checkSkillLoader(root: string): CheckResult
│   checkArchitectureIntelligence(root: string): CheckResult
│   checkMcpRouting(root: string): CheckResult
│   checkDeterministicExecution(root: string): CheckResult
│
└── main():
    1. Collect all 5 check results
    2. Print header "AI Runtime Status\n─────────────────\n"
    3. For each result: process.stdout.write(formatLine(result) + '\n')
    4. Print summary line
    5. process.exit(hasErrors ? 1 : 0)
│
└── if (import.meta.main) { main() }
```

**Safety rules for implementation:**

- No `console.log` anywhere in the file
- Wrap each check's logic in try/catch — no check should allow an exception to propagate to main
- Never read string contents that could contain secrets (read file sizes/timestamps only where
  possible; read JSON only for the brain integrity check)
- `process.stdout.write` for all output

---

### T003 — Add 3 Scripts to `package.json`

**Action:** Add the following 3 entries to the `"scripts"` section of `package.json`, placed after
the `ai-context:*` group (after `"ai-context:validate"`) and before the `repo:*` group:

```json
"ai-runtime:status":   "bun scripts/ai-runtime/runtime-status.ts",
"ai-runtime:refresh":  "bun ai-context:refresh",
"ai-runtime:validate": "bun arch:validate-brain"
```

**Exact 3 script lines proposed:**

```
"ai-runtime:status":   "bun scripts/ai-runtime/runtime-status.ts",
"ai-runtime:refresh":  "bun ai-context:refresh",
"ai-runtime:validate": "bun arch:validate-brain"
```

**Verification:** `bun ai-runtime:status` invocable (T007 will confirm exit code = 0)

---

### T004 — Add CI Step to `.github/workflows/ci.yml`

**Action:** Insert one new step into the `arch-guard` job in `.github/workflows/ci.yml`, placed
after `module-boundary-validation` and before `Save ai-context artifacts cache (T087)`.

**Exact YAML to insert:**

```yaml
- name: AI Runtime Validation
  run: bun ai-runtime:status
```

**Indentation:** 6 spaces (matches other steps in this job).

**Context in file after insertion:**

```yaml
- name: module-boundary-validation
  run: bun run arch:guard

- name: AI Runtime Validation
  run: bun ai-runtime:status

- name: Save ai-context artifacts cache (T087)
  if: steps.cache-ai-context.outputs.cache-hit != 'true'
  uses: actions/cache/save@v4
  with:
    path: docs/ai/context/
    key: ai-context-${{ hashFiles('package.json', 'bun.lock', 'scripts/ai-context/**/*') }}
```

**Verification:** `bun validate:workflows` passes (actionlint); `bun validate:yaml` passes

---

### T005 — Write Unit Tests

**Action:** Create `tests/unit/ai-runtime/runtime-status.test.ts`

**Coverage targets:**

- All 5 check functions (see Section 4.1 test tables)
- All exit code scenarios
- Check isolation: one check failing does not prevent others from running

**Pattern:** Matches `tests/unit/dev-scripts/repo-status.test.ts` — vi.mock for `node:fs`,
individual `describe` blocks per exported function.

**Verification:** `bun test:unit` passes (or `vitest run tests/unit/ai-runtime/`)

---

### T006 — Write Integration Tests

**Action:** Create `tests/integration/ai-runtime/runtime-status.integration.test.ts`

**Coverage targets:**

- All 5 check functions against real local filesystem
- Combined exit code behavior

**Pattern:** Matches `tests/integration/ai-context-integration.test.ts` — no mocking; real FS;
`describe`/`it`/`expect` from `vitest`.

**Verification:** `bun test:integration` passes (or `vitest run tests/integration/ai-runtime/`)

---

### T007 — Validate All Checks Pass

**Commands to run in sequence:**

```bash
# 1. Run AI runtime status — must exit 0
bun ai-runtime:status

# 2. Lint — must pass
bun run lint

# 3. Type check — must pass
bun run typecheck

# 4. Unit tests for new script
vitest run tests/unit/ai-runtime/

# 5. Integration tests for new script
vitest run tests/integration/ai-runtime/

# 6. Architecture guard — must pass unchanged
bun arch:guard
```

**All 6 commands must exit 0** before this stage is considered complete.

---

## Section 7 — Architectural Concerns

**None identified.**

Rationale:

1. **No module boundary violations** — `scripts/ai-runtime/` is outside the `packages/` and
   `apps/` system. `bun arch:guard` will not flag it.
2. **No new module registration required** — `bun arch:add-module` is for `packages/` and `apps/`
   modules only. Scripts are excluded from the architecture map.
3. **No governance script modifications** — `infra-audit.ts`, `ai-guard.ts`, and all other
   governance scripts are unchanged.
4. **No import boundary violations** — The script imports only `node:fs` and `node:path` builtins.
5. **Fully reversible** — Can be rolled back by deleting 3 files and reverting 4 lines across 2
   files.
6. **Constitutional compliance confirmed** — No tenant isolation, license enforcement, attempt
   engine, or worker systems are touched. Trust Chain unaffected.

---

## Appendix A — Exact 3 `package.json` Script Lines

```json
"ai-runtime:status":   "bun scripts/ai-runtime/runtime-status.ts",
"ai-runtime:refresh":  "bun ai-context:refresh",
"ai-runtime:validate": "bun arch:validate-brain"
```

---

## Appendix B — Full Check List vs. Spec Table Cross-Reference

| Spec Check                       | Covered By                      | Status Level |
| -------------------------------- | ------------------------------- | ------------ |
| AI context artifacts exist       | `checkContextLoader`            | error        |
| AI context freshness             | `checkContextLoader`            | warning      |
| Core skill directories exist     | `checkSkillLoader`              | error        |
| Core skills have SKILL.md        | `checkSkillLoader`              | error        |
| Architecture brain integrity     | `checkArchitectureIntelligence` | error        |
| Architecture brain edge validity | `checkArchitectureIntelligence` | warning      |
| Architecture map exists          | `checkArchitectureIntelligence` | error        |
| MCP routing matrix exists        | `checkMcpRouting`               | warning      |
| Runtime governance scripts exist | `checkDeterministicExecution`   | error        |

All 9 spec checks mapped. All 5 runtime layers covered. ✓
