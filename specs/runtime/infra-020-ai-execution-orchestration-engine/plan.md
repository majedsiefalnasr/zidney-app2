# Implementation Plan: AI Execution Orchestration Engine

**Stage**: INFRA-020  
**Phase**: 01_PLATFORM_FOUNDATION  
**Spec**: `specs/runtime/infra-020-ai-execution-orchestration-engine/spec.md`  
**Research**: `specs/runtime/infra-020-ai-execution-orchestration-engine/research.md`  
**Branch**: `spec/infra-020-ai-execution-orchestration-engine`  
**Plan Date**: 2026-03-15  
**Risk Level**: LOW

---

## Stage Alignment

| Field             | Value                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| Phase             | 01_PLATFORM_FOUNDATION                                                           |
| Stage             | INFRA-020 AI Execution Orchestration Engine                                      |
| Related Spec File | `specs/runtime/infra-020-ai-execution-orchestration-engine/spec.md`              |
| Related ADR       | None required (no architectural exceptions; see Constitutional Compliance below) |

This plan does not introduce architecture beyond the Stage scope. No new packages, routes,
database tables, or tenant-facing behavior are created.

---

## Architectural Scope Confirmation

| Rule                                | Status                                                          |
| ----------------------------------- | --------------------------------------------------------------- |
| No cross-tenant data access         | ✅ Confirmed — no database access of any kind                   |
| No middleware bypass                | ✅ Confirmed — no Hono routes introduced                        |
| No direct DB instantiation          | ✅ Confirmed — no DB connections created                        |
| No grading logic outside Worker     | ✅ Confirmed — not applicable                                   |
| No weakening of snapshot integrity  | ✅ Confirmed — attempt snapshots not touched                    |
| No weakening of version enforcement | ✅ Confirmed — `ai:validate` confirms existing tooling passes   |
| No layer boundary violation         | ✅ Confirmed — imports restricted to `packages/logger` + stdlib |

No ADR exceptions required. Stage is tooling-only.

---

## Implementation Layers

This stage introduces one layer only: **Orchestration Tooling** (`scripts/ai-engine/`).

### Tooling Layer

No API, Worker, Frontend, MMC, or Backoffice concerns are touched.

| Concern            | Treatment                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Routes introduced  | None                                                                                                           |
| Middleware used    | None — no HTTP request lifecycle                                                                               |
| Business logic     | None — deterministic orchestration controller only                                                             |
| Database access    | None                                                                                                           |
| Queue consumers    | None                                                                                                           |
| Environment access | `process.env.LOG_LEVEL`, `process.env.NODE_ENV`, `process.env.CI` (direct reads only; see Research Decision 2) |

---

## Database Impact

**Not applicable.** This stage introduces no database access, no tables, no migrations,
no schema_version change, and no product_version change.

| Field                 | Value |
| --------------------- | ----- |
| Master DB touched     | No    |
| Tenant DB touched     | No    |
| Migration required    | No    |
| Version bump required | No    |

---

## Transaction Design

**Not applicable.** All writes are local filesystem log artifacts. Atomicity is achieved via
temp-file-then-rename (see Atomic Write Pattern section). No database transactions are involved.

---

## Idempotency Plan

| Guard                           | Applied | Method                                                                   |
| ------------------------------- | ------- | ------------------------------------------------------------------------ |
| Execution ID uniqueness         | Yes     | `${Date.now()}-${sha256(task).slice(0,8)}` — unique per run              |
| Same execution_id → same result | Yes     | Re-running with same ID overwrites same file                             |
| `ai:plan` determinism           | Yes     | Same task description → same task_id → overwrites same plan file         |
| `ai:validate` per-run artifact  | Yes     | Each validation run has its own execution_id.json                        |
| No duplicate log files          | Yes     | Unique execution_id per run; re-run same task produces same execution_id |
| Double-submission guard         | Yes     | Overwrite semantics on log files keyed by execution_id                   |

---

## Version Enforcement Strategy

Not applicable to this stage. The `ai:validate` script confirms that the existing version
enforcement tooling (`bun arch:guard`, `bun type-safety-guard`, `bun arch:health`) passes — it
does not modify enforcement logic.

---

## Authoritative Time Handling

All execution log timestamps MUST use `new Date(Date.now()).toISOString()` (server process time).
Client time is never accepted as input. The execution_id prefix is also derived from `Date.now()`.

No expiration, deadline, or soft-lock logic exists in this stage.

---

## File Structure

### New files under `scripts/ai-engine/`

```
scripts/
└── ai-engine/
    ├── types.ts                  # Core type definitions for all three scripts
    ├── execution-id.ts           # Execution ID generation (timestamp + task hash)
    ├── log-writer.ts             # Atomic log artifact writer (tmp-then-rename)
    ├── context-loader.ts         # Loads docs/ai/context/ai-context-mini.json
    ├── skill-selector.ts         # Keyword-based skill activation from .agents/skills/
    ├── process-runner.ts         # Child process spawner with timeout enforcement
    ├── stale-check.ts            # ai-architecture-brain.json staleness detection
    ├── monorepo-guard.ts         # Monorepo root detection (exits non-zero if outside)
    ├── run-task.ts               # Entry point for `bun ai:run`
    ├── plan-task.ts              # Entry point for `bun ai:plan`
    ├── validate-execution.ts     # Entry point for `bun ai:validate`
    └── __tests__/
        ├── execution-id.test.ts
        ├── log-writer.test.ts
        ├── stale-check.test.ts
        ├── monorepo-guard.test.ts
        ├── context-loader.test.ts
        ├── skill-selector.test.ts
        ├── process-runner.test.ts
        ├── run-task.test.ts
        ├── plan-task.test.ts
        └── validate-execution.test.ts
```

### New directories

```
docs/architecture/health/ai-execution-logs/   # Created at runtime by scripts if absent (FR-023)
docs/architecture/health/ai-plans/            # Plan documents written by plan-task.ts
```

### Integration tests

```
tests/
└── integration/
    └── ai-engine/
        └── validate-execution.integration.test.ts   # End-to-end smoke test: run-task → plan-task → validate-execution entry points
```

### No modifications to

- `apps/*` — zero changes
- `packages/*` — zero changes
- Any existing script outside `scripts/ai-engine/`
- Any migration file
- Any ADR or architecture contract

---

## Type Definitions (`scripts/ai-engine/types.ts`)

```typescript
/**
 * Execution log artifact written to docs/architecture/health/ai-execution-logs/{execution_id}.json
 * All mandatory fields defined in spec FR-009 and Observability Requirements.
 */
export interface ExecutionLog {
  execution_id: string;
  task_id: string;
  timestamp: string; // ISO 8601 — server process time (Date.now())
  command: "ai:run" | "ai:plan" | "ai:validate";
  skills_activated: string[]; // Skill directory names; empty for ai:validate
  files_modified: string[]; // Relative paths; empty for ai:plan and ai:validate
  architecture_violations: number;
  validation_result: "pass" | "fail";
  execution_duration_ms: number;
  error: string | null; // Present only on failure; null on success
}

/** Sub-command result from a governance tool invocation */
export interface SubCommandResult {
  command: string;
  exit_code: number;
  duration_ms: number;
  timed_out: boolean;
}

/** Brain status enumeration */
export type BrainStatus = "present_fresh" | "stale" | "absent";

/** Full validation report embedded in execution log for ai:validate */
export interface ValidationReport {
  brain_status: BrainStatus;
  brain_path: string;
  arch_guard: SubCommandResult;
  type_safety_guard: SubCommandResult;
  arch_health: SubCommandResult;
  architecture_violations: number; // Aggregate count across all tools
  overall: "pass" | "fail";
}

/** Execution plan document written by plan-task.ts */
export interface ExecutionPlan {
  execution_id: string;
  task_id: string;
  timestamp: string;
  task_description: string;
  skills_required: string[];
  steps: PlanStep[];
  architecture_constraints: string[];
  risk_level: "low" | "medium" | "high";
  output_path: string;
}

export interface PlanStep {
  step: number;
  description: string;
  action: string;
  validation: string;
  risk: "low" | "medium" | "high";
}

/** CLI arguments shared across all three scripts */
export interface BaseCliArgs {
  taskDescription: string;
  taskId: string; // Derived from taskDescription if not explicitly provided
  executionId: string; // Always generated fresh per run
  ci: boolean; // true when --ci flag is present or process.env.CI is set
}

export interface RunTaskArgs extends BaseCliArgs {
  dryRun: boolean;
}

export interface PlanTaskArgs extends BaseCliArgs {
  outputPath: string; // Defaults to docs/architecture/health/ai-plans/{task_id}.md
}

export interface ValidateArgs extends BaseCliArgs {
  // No additional fields beyond BaseCliArgs; --ci affects timeout budget
}
```

---

## Module Responsibilities

### `execution-id.ts`

Generates a unique, deterministic execution ID.

```typescript
import { createHash } from "node:crypto";

/**
 * Generate execution ID: `{timestamp_ms}-{sha256(task).slice(0, 8)}`
 * Deterministic per (timestamp, taskDescription) pair.
 */
export function generateExecutionId(taskDescription: string): string {
  const ts = Date.now();
  const hash = createHash("sha256").update(taskDescription).digest("hex").slice(0, 8);
  return `${ts}-${hash}`;
}

/**
 * Derive a stable task_id from task description.
 * Used as the filename for plan documents (deterministic across runs).
 */
export function deriveTaskId(taskDescription: string): string {
  return createHash("sha256").update(taskDescription).digest("hex").slice(0, 16);
}
```

### `log-writer.ts`

Atomic log writer using temp-file-then-rename (FR-010, FR-012, SC-012).

```typescript
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExecutionLog } from "./types";

const LOG_DIR = "docs/architecture/health/ai-execution-logs";

/** Write execution log atomically. Creates log directory if absent (FR-023). */
export async function writeExecutionLog(log: ExecutionLog): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true });
  const tmp = join(LOG_DIR, `${log.execution_id}.tmp.json`);
  const final = join(LOG_DIR, `${log.execution_id}.json`);
  await writeFile(tmp, JSON.stringify(log, null, 2), "utf8");
  await rename(tmp, final);
}
```

### `context-loader.ts`

Loads the AI context mini artifact (FR-003).

```typescript
import { existsSync, readFileSync } from "node:fs";

const CONTEXT_PATH = "docs/ai/context/ai-context-mini.json";

export interface AiContextMini {
  version: string;
  modules: unknown[];
  layer_model: unknown;
  [key: string]: unknown;
}

/** Load ai-context-mini.json. Throws if absent (caller handles exit). */
export function loadAiContextMini(): AiContextMini {
  if (!existsSync(CONTEXT_PATH)) {
    throw new Error(`AI context artifact not found: ${CONTEXT_PATH}. Run: bun ai-context:generate`);
  }
  return JSON.parse(readFileSync(CONTEXT_PATH, "utf8")) as AiContextMini;
}
```

### `skill-selector.ts`

Deterministic skill activation based on task description keywords (Research Decision 3).

```typescript
import { existsSync, readdirSync } from "node:fs";

const SKILLS_DIR = ".agents/skills";

const BASELINE_SKILLS = ["architecture-intelligence", "terminal-safety", "mcp-routing"];

const KEYWORD_MAP: Array<{ pattern: RegExp; skills: string[] }> = [
  { pattern: /refactor|rename|extract|split|move/i, skills: ["gitnexus-refactoring"] },
  { pattern: /debug|error|fail|bug|trace/i, skills: ["gitnexus-debugging"] },
  { pattern: /impact|break|depend|blast/i, skills: ["gitnexus-impact-analysis"] },
  { pattern: /explore|understand|how.*work|flow/i, skills: ["gitnexus-exploring"] },
  { pattern: /git|commit|branch|pr|push/i, skills: ["git-governance"] },
  { pattern: /package|dependency|dep|install/i, skills: ["package-manager-governance"] },
  { pattern: /precommit|pre-commit|husky/i, skills: ["precommit-diagnostics"] },
];

/** Select skills for the given task description (deterministic). */
export function selectSkills(taskDescription: string): string[] {
  const available = existsSync(SKILLS_DIR)
    ? new Set(
        readdirSync(SKILLS_DIR, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name),
      )
    : new Set<string>();

  const matched = new Set<string>(BASELINE_SKILLS);
  for (const { pattern, skills } of KEYWORD_MAP) {
    if (pattern.test(taskDescription)) {
      for (const s of skills) matched.add(s);
    }
  }
  // Only include skills that actually exist in the registry
  return [...matched].filter((s) => available.has(s)).sort();
}
```

### `process-runner.ts`

Spawns governance sub-commands with timeout enforcement. Matches pattern from
`scripts/architecture-health/source-runner.ts` (Research Decision 6).

```typescript
import { spawn } from "node:child_process";
import type { SubCommandResult } from "./types";

const BUN = process.execPath;

export interface RunOptions {
  command: string;
  args: string[];
  timeoutMs: number;
}

/**
 * Run a governance sub-command with timeout.
 * stdio: 'pipe' — zero stdout/stderr leaks to orchestrator (FR-011).
 * Returns SubCommandResult regardless of exit code — caller decides on failure action.
 */
export async function runGovernanceTool(
  opts: RunOptions,
): Promise<SubCommandResult & { stdout: string }> {
  const start = Date.now();
  return new Promise((resolve) => {
    let timedOut = false;
    let stdout = "";

    const proc = spawn(BUN, ["run", opts.command, ...opts.args], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, opts.timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        command: [opts.command, ...opts.args].join(" "),
        exit_code: timedOut ? 124 : (code ?? 1),
        duration_ms: Date.now() - start,
        timed_out: timedOut,
        stdout,
      });
    });
  });
}
```

### `stale-check.ts`

Staleness detection against `ai-architecture-brain.json` (FR-008, SC-006).

```typescript
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { BrainStatus } from "./types";

const BRAIN_PATH = "docs/ai/context/ai-architecture-brain.json";
const SOURCE_DIRS = ["packages", "apps"];

/** Returns the mtime (ms) of the most recently modified .ts/.tsx file under SOURCE_DIRS. */
function getMostRecentTsMtime(): number {
  let latest = 0;
  function walk(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // skip unreadable directories
    }
    for (const entry of entries) {
      if (entry.name === "node_modules") continue; // never traverse installed deps
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        const mtime = statSync(full).mtimeMs;
        if (mtime > latest) latest = mtime;
      }
    }
  }
  for (const d of SOURCE_DIRS) {
    if (existsSync(d)) walk(d);
  }
  return latest;
}

/** Check brain artifact status. Returns 'absent', 'stale', or 'present_fresh'. */
export function checkBrainStatus(): { status: BrainStatus; brainPath: string; detail?: string } {
  if (!existsSync(BRAIN_PATH)) {
    return { status: "absent", brainPath: BRAIN_PATH, detail: "File does not exist" };
  }
  const brainMtime = statSync(BRAIN_PATH).mtimeMs;
  const latestSrc = getMostRecentTsMtime();
  if (latestSrc > brainMtime) {
    return {
      status: "stale",
      brainPath: BRAIN_PATH,
      detail: `Source files newer than brain artifact by ${latestSrc - brainMtime}ms. Run: bun arch:audit`,
    };
  }
  return { status: "present_fresh", brainPath: BRAIN_PATH };
}
```

### `monorepo-guard.ts`

Verifies script is run from the monorepo root (edge case from spec).

```typescript
import { existsSync } from "node:fs";

const MARKERS = ["package.json", "docs/ai/context"];

/** Exit non-zero with diagnostic if invoked outside monorepo root. */
export function assertMonorepoRoot(): void {
  const missing = MARKERS.filter((m) => !existsSync(m));
  if (missing.length > 0) {
    process.stderr.write(
      JSON.stringify({
        error: "MONOREPO_ROOT_NOT_FOUND",
        missing,
        message: "Scripts must be run from the monorepo root directory.",
      }) + "\n",
    );
    process.exit(3);
  }
}
```

> **Note on stdout**: `monorepo-guard.ts` is the only module permitted to write to `process.stderr`
> because it must communicate the failure before any logger or log file can be established.
> All other diagnostic output goes exclusively to execution log files.

---

## API Design: CLI Entry Points

### `run-task.ts` — `bun ai:run`

**Purpose**: Bootstraps context, activates skills, executes task, validates architecture, writes log.

**CLI arguments**:

```
bun ai:run --task "<description>" [--task-id <id>] [--dry-run]

Options:
  --task <description>   Required. Task description string used for skill selection and execution ID.
  --task-id <id>         Optional. Override derived task_id (defaults to sha256 of description).
  --dry-run              Optional. Bootstrap and plan only; skip execution and validation.
```

**Exit codes**:

| Code | Meaning                                                                           |
| ---- | --------------------------------------------------------------------------------- |
| 0    | Task executed and architecture validated; zero violations                         |
| 1    | Task failed or architecture violation detected                                    |
| 2    | Timeout exceeded (ai:run budget: 300 s)                                           |
| 3    | Missing required file (brain absent, context file absent, required skill missing) |
| 4    | Brain stale — run `bun arch:audit` first                                          |

**Execution flow**:

1. `assertMonorepoRoot()` — exit 3 if not in monorepo root.
2. Parse `--task`, `--task-id`, `--dry-run` from `process.argv`.
3. `generateExecutionId(taskDescription)` → `execution_id`.
4. `loadAiContextMini()` — load governance context; exit 3 with log if absent.
5. `selectSkills(taskDescription)` → `skills_activated`.
6. Verify each selected skill directory exists under `.agents/skills/`; if any missing: write log with `error:'SKILL_DIR_ABSENT'` then call `process.exit(3)` DIRECTLY inside try block (NOT re-thrown to outer catch).
7. Record `start = Date.now()`.
8. If `--dry-run`: skip to step 11 with `validation_result: 'pass'`, `files_modified: []`.
9. Invoke `validate-execution.ts` logic (shared module, not shell re-invoke) to run governance tools.
   - When called as shared module, `validate-execution.ts` logic MUST NOT write its own execution log.
   - If brain status is `'stale'` → exit 4 with log. If `'absent'` → exit 3 with log.
10. Capture `architecture_violations` count and `validation_result`.
11. Write `ExecutionLog` via `writeExecutionLog()`.
12. `process.exit(validationResult === 'pass' ? 0 : exitCodeForReason(validationReason))` using the shared `exitCodeForReason` helper (same as `validate-execution.ts`).

**Enforcement of 300 s timeout**: A top-level `AbortController` / `setTimeout` wraps the entire
execution. On expiry, the log is written with `error: 'TIMEOUT_EXCEEDED'` and process exits 2.

---

### `plan-task.ts` — `bun ai:plan`

**Purpose**: Decomposes task into a deterministic, human-readable plan. No source file modifications.

**CLI arguments**:

```
bun ai:plan --task "<description>" [--task-id <id>] [--output <path>]

Options:
  --task <description>   Required. Task description.
  --task-id <id>         Optional. Override derived task_id.
  --output <path>        Optional. Override output path (default: docs/architecture/health/ai-plans/{task_id}.md).
```

**Exit codes**:

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| 0    | Plan produced and written                |
| 1    | Failed to write plan                     |
| 2    | Timeout exceeded (ai:plan budget: 120 s) |
| 3    | Missing required file (context artifact) |

**Execution flow**:

1. `assertMonorepoRoot()`.
2. Parse CLI arguments. Derive `task_id = deriveTaskId(taskDescription)`.
3. `generateExecutionId(taskDescription)` → `execution_id` (for log artifact only).
4. `loadAiContextMini()` — wrap in inline try/catch; on catch write log with `error:'CONTEXT_ABSENT'` then call `process.exit(3)` DIRECTLY inside inline catch (NOT propagated to outer catch).
5. `selectSkills(taskDescription)` → `skills_required`.
6. Parse architecture constraints from `docs/ai/context/ai-context-mini.json` (module count, layer rules).
7. Compose `ExecutionPlan` object deterministically (no random values).
8. Write plan document to `docs/architecture/health/ai-plans/{task_id}.md` (overwrite if exists → FR-006).
9. Write `ExecutionLog` with `files_modified: [outputPath]`, `architecture_violations: 0`,
   `validation_result: 'pass'` (plan generation does not invoke guards).
10. `process.exit(0)`.

**Determinism guarantee** (FR-006): All plan fields are derived solely from:

- `taskDescription` (input)
- `ai-context-mini.json` content (stable between runs unless regenerated)
- Hard-coded KEYWORD_MAP (code, never changes at runtime)

No timestamps, random values, or wall-clock data appear in the plan document itself (only in the
accompanying execution log artifact). The `**Generated**` field is intentionally omitted from the
plan document template to preserve FR-006 determinism (the accompanying `ExecutionLog` carries the
timestamp).

**Plan document format** (`docs/architecture/health/ai-plans/{task_id}.md`):

```markdown
# Execution Plan: {task_description}

**Task ID**: {task_id}
**Risk Level**: {risk_level}

## Skills Required

- {skill_1}
- {skill_2}

## Architecture Constraints

- Database-per-tenant isolation
- License middleware mandatory for workspace routes
- Import boundary: scripts/ai-engine/ → packages/logger, stdlib only
- ...

## Execution Steps

### Step 1 — {description}

**Action**: {action}
**Validation**: {validation}
**Risk**: {risk}

...
```

**Enforcement of 120 s timeout**: Same pattern as `run-task.ts`.

---

### `validate-execution.ts` — `bun ai:validate`

**Purpose**: Runs all governance tools, checks brain status, writes validation artifact.

**CLI arguments**:

```
bun ai:validate [--ci] [--task "<description>"] [--execution-id <id>]

Options:
  --ci                   Apply CI timeout budget (120 s). Default timeout: 90 s.
  --task <description>   Optional. Defaults to "validate" for task_id derivation.
  --execution-id <id>    Optional. Use a specific execution ID (useful when called by run-task.ts).
```

**Exit codes**:

| Code | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| 0    | All governance tools pass; brain is fresh                    |
| 1    | One or more governance tools report violations               |
| 2    | Timeout exceeded (ai:validate budget: 90 s local / 120 s CI) |
| 3    | Brain absent — run `bun arch:audit` first                    |
| 4    | Brain stale — run `bun arch:audit` first                     |

**Execution flow**:

1. `assertMonorepoRoot()`.
2. Parse CLI args; `timeoutMs = ci ? 120_000 : 90_000`.
3. Generate `execution_id` (or use `--execution-id` if provided).
4. `brainCheck = checkBrainStatus()` → if `'absent'` exit 3 with log; if `'stale'` exit 4 with log.
5. Spawn `bun arch:guard --ci` via `runGovernanceTool({ timeoutMs })`.
6. Spawn `bun type-safety-guard --json --no-exit-error` via `runGovernanceTool({ timeoutMs })`.
7. Spawn `bun arch:health --ci` via `runGovernanceTool({ timeoutMs })`.
8. Parse `architecture_violations` from arch:guard exit code and arch:health artifact:
   - Read `docs/architecture/health/architecture-health.json` if it exists after `bun arch:health`.
   - If `bun arch:health` exited 0 but the file is absent: set `architecture_violations` to `0` (sentinel: no violations detected, file output is optional for this tool).
   - If `bun arch:health` exited non-zero: set `architecture_violations` to `-1` (sentinel: unknown — tool failed).
   - Combine violation counts from all tools.
9. Determine `overall: pass | fail`:
   - Fail if any tool exit_code ≠ 0.
   - Fail if any tool timed_out.
   - Fail if brain_status ≠ 'present_fresh'.
10. Write `ExecutionLog` with `skills_activated: []` (validation does not activate skills).
11. `process.exit(overall === 'pass' ? 0 : exitCodeForReason)`.

**Sub-command invocation details**:

```
bun arch:guard      → bun run arch:guard (maps to scripts/architecture-guard/architecture-guard.ts)
bun type-safety-guard → bun run type-safety-guard (maps to scripts/type-safety-guard.ts)
bun arch:health     → bun run arch:health:ci (maps to scripts/architecture-health/architecture-health.ts --ci)
```

All three spawned with `stdio: 'pipe'` — zero output leaks (FR-011).

---

## Execution Log Schema

Each orchestration run writes exactly one file:
`docs/architecture/health/ai-execution-logs/{execution_id}.json`

**Full schema**:

```jsonc
{
  "execution_id": "1742040000000-a1b2c3d4",
  "task_id": "a1b2c3d4e5f6a7b8",
  "timestamp": "2026-03-15T10:00:00.000Z",
  "command": "ai:validate",
  "skills_activated": [],
  "files_modified": [],
  "architecture_violations": 0,
  "validation_result": "pass",
  "execution_duration_ms": 4200,
  "error": null,
}
```

**On failure**:

```jsonc
{
  "execution_id": "1742040000001-b2c3d4e5",
  "task_id": "b2c3d4e5f6a7b8c9",
  "timestamp": "2026-03-15T10:01:00.000Z",
  "command": "ai:validate",
  "skills_activated": [],
  "files_modified": [],
  "architecture_violations": 3,
  "validation_result": "fail",
  "execution_duration_ms": 5100,
  "error": "arch_guard exited with code 1: 3 layer violations detected",
}
```

**On timeout**:

```jsonc
{
  ...
  "validation_result": "fail",
  "execution_duration_ms": 90001,
  "error": "TIMEOUT_EXCEEDED: ai:validate budget 90000ms exhausted"
}
```

**Mandatory fields** (per FR-009, SC-003): All fields listed above are always present.
The `error` field is `null` on success and a non-empty string on any failure.

---

## Atomic Write Pattern

All execution log files MUST use temp-file-then-rename (FR-010, SC-012):

```
docs/architecture/health/ai-execution-logs/{execution_id}.tmp.json  [written]
docs/architecture/health/ai-execution-logs/{execution_id}.json       [renamed to]
```

The `.tmp.json` file is never observable after a successful write. On process crash between
write and rename, the `.tmp.json` orphan is left on disk but is not a valid log artifact. A
cleanup utility is NOT required by this stage — orphan detection is out of scope.

---

## Package.json Script Additions

Add the following entries to the `"scripts"` block in the root `package.json`:

```json
"ai:run":      "bun scripts/ai-engine/run-task.ts",
"ai:plan":     "bun scripts/ai-engine/plan-task.ts",
"ai:validate": "bun scripts/ai-engine/validate-execution.ts"
```

**Placement**: Insert after the `"ai-runtime:validate"` entry for logical grouping.

**Full additions** (showing context):

```json
// existing entries:
"ai-runtime:validate": "bun arch:validate-brain",

// new entries:
"ai:run":      "bun scripts/ai-engine/run-task.ts",
"ai:plan":     "bun scripts/ai-engine/plan-task.ts",
"ai:validate": "bun scripts/ai-engine/validate-execution.ts",

// existing entries continue:
"repo:doctor": "bun scripts/dev/repo-doctor.ts",
```

---

## CI Workflow Step Additions

**File**: `.github/workflows/architecture-governance.yml`
**Placement**: After Step 10 (Publish Architecture Summary), before end of `steps:`.

Add three steps:

### Step 11 — AI Execution Validation

```yaml
# ── 11. Run AI Execution Validation ───────────────────────────────
- name: Run AI Execution Validation
  run: bun ai:validate --ci
```

### Step 12 — Upload AI Execution Artifact

```yaml
# ── 12. Upload AI Execution Artifact ──────────────────────────────
- name: Upload AI Execution Validation Artifact
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: ai-execution-validation-artifact
    path: docs/architecture/health/ai-execution-logs/
```

### Step 13 — Publish AI Execution Summary

```yaml
# ── 13. Publish AI Execution Summary ──────────────────────────────
- name: Publish AI Execution Summary
  if: always()
  run: |
    {
      echo "## AI Execution Validation Report"
      echo ""
    } >> "$GITHUB_STEP_SUMMARY"

    LATEST=$(ls -t docs/architecture/health/ai-execution-logs/*.json 2>/dev/null | head -1)
    if [ -n "$LATEST" ]; then
      {
        echo "### Latest Execution Log"
        echo "~~~json"
        cat "$LATEST"
        echo "~~~"
      } >> "$GITHUB_STEP_SUMMARY"
    else
      echo "No AI execution log artifacts found." >> "$GITHUB_STEP_SUMMARY"
    fi
```

**Trigger alignment**: The existing `architecture-governance.yml` triggers on:

- `pull_request` to `main` / `develop`
- `push` to `main` / `develop`
- Nightly schedule (`cron: "0 2 * * *"`)

The new steps inherit these triggers without modification. No `paths:` filter is added so that
every governance run (including nightly) validates the orchestration engine.

---

## Import Design

### Allowed imports per FR-014

```typescript
// Allowed: packages/logger
import { createLogger } from "@zidney/logger";

// Allowed: Node/Bun stdlib
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

// NOT allowed: @zidney/config (see Research Decision 2)
// NOT allowed: @zidney/domain-core, @zidney/types, @zidney/validation, etc.
// NOT allowed: any import from apps/*
```

### Logger usage

```typescript
const logger = createLogger("ai-engine");
// Only used for module-level diagnostics written to the @zidney/logger transport.
// The execution log JSON artifact is written via log-writer.ts (separate from logger).
```

> **Note**: `@zidney/logger` writes to its configured transport (typically `json-file` in CI or
> `console` locally). This is the permitted secondary output channel. The primary artifact output
> is the execution log JSON file.

### Import boundary enforcement

`scripts/infra-audit.ts` and `scripts/ai-guard.ts` enforce import boundaries. The orchestration
scripts must not import from `apps/*` or from any `packages/*` other than `packages/logger`.
No new `import` statements require any package installation.

---

## Error Handling Patterns

### Top-level error wrapper (all three entry points)

```typescript
const logger = createLogger("ai-engine");

async function main(): Promise<void> {
  const start = Date.now();
  const executionId = generateExecutionId(taskDescription);

  try {
    assertMonorepoRoot();
    // ... execution logic
    await writeExecutionLog({ ...log, validation_result: "pass", error: null });
    process.exit(0);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("AI orchestration failed", {
      execution_id: executionId,
      error: errorMessage,
    });
    await writeExecutionLog({
      execution_id: executionId,
      task_id: taskId,
      timestamp: new Date(Date.now()).toISOString(),
      command,
      skills_activated: [],
      files_modified: [],
      architecture_violations: 0,
      validation_result: "fail",
      execution_duration_ms: Date.now() - start,
      error: errorMessage,
    }).catch(() => {
      // If log write itself fails, write to stderr as last resort
      process.stderr.write(
        JSON.stringify({ error: errorMessage, execution_id: executionId }) + "\n",
      );
    });
    // Discriminate timeout from other errors to emit correct exit code
    const isTimeout = errorMessage.startsWith("TIMEOUT_EXCEEDED");
    process.exit(isTimeout ? 2 : 1);
  }
}

main();
```

> **Stderr note**: Two paths write to `process.stderr`: (1) `monorepo-guard.ts` as its primary output channel, and (2) the last-resort log-write fallback in the top-level error handler above. Both are intentional and permitted.

> **Brain-condition exit constraint**: Brain-condition exits (3, 4) MUST be implemented as direct `process.exit(X)` calls with the execution log pre-written inside the `try` block, and MUST NOT be thrown as exceptions that propagate to the generic catch handler. The `isTimeout ? 2 : 1` catch handler does not handle exits 3 and 4.

### Timeout pattern (wraps main execution)

```typescript
async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT_EXCEEDED: ${label} budget ${timeoutMs}ms exhausted`));
    }, timeoutMs);
    fn()
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}
```

### Sub-command failure handling in `validate-execution.ts`

```typescript
const archGuard = await runGovernanceTool({
  command: "arch:guard",
  args: ["--ci"],
  timeoutMs,
});

if (archGuard.timed_out) {
  throw new Error(`TIMEOUT_EXCEEDED: arch:guard timed out after ${timeoutMs}ms`);
}
// Non-zero exit code is not thrown — it is recorded as a validation failure in the log.
```

---

## Observability & Logging

All structured log output goes to `docs/architecture/health/ai-execution-logs/{execution_id}.json`.

`@zidney/logger` is used for secondary observability (not the primary artifact) with required fields:

```typescript
logger.info("AI orchestration started", {
  execution_id,
  task_id,
  command: "ai:validate",
  correlation_id: execution_id, // execution_id used as correlation_id for tracing
});
```

**Mandatory logger context fields per script run**:

- `execution_id` (maps to `correlation_id`)
- `task_id`
- `command` (`ai:run` / `ai:plan` / `ai:validate`)

`workspace_slug` and `workspace_id` are NOT set — this stage has no tenant context (correct per
architecture rules: non-workspace-bound tooling).

**Forbidden**: `console.log`, `console.error`, `console.warn` in any file under `scripts/ai-engine/`.
The single exception is the `monorepo-guard.ts` `process.stderr.write` path for pre-logger failures.

---

## Rate Limiting

Not applicable. The orchestration scripts are developer-local and CI tools, not HTTP endpoints.

---

## Failure Modes

| Failure                               | Behavior                                                                                                  | Exit code |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------- |
| Architecture guard reports violations | `ai:validate` exits non-zero; CI step fails; violation count in log                                       | 1         |
| Log directory not found               | Directory created automatically before write (FR-023)                                                     | —         |
| Execution timeout exceeded            | Scripts write timeout error to log then terminate                                                         | 2         |
| Partial log write                     | Temp-file-then-rename ensures no partial artifacts                                                        | —         |
| `ai-architecture-brain.json` absent   | `ai:validate` exits 3 with named diagnostic in log                                                        | 3         |
| `ai-architecture-brain.json` stale    | `ai:validate` exits 4 with staleness detail in log                                                        | 4         |
| `ai-context-mini.json` absent         | Scripts exit 3 with diagnostic before any execution                                                       | 3         |
| Required skill not found              | `ai:run` exits 3 with skill path in log (`error:'SKILL_DIR_ABSENT'`, direct `process.exit(3)` inside try) | 3         |
| Scripts run outside monorepo root     | `monorepo-guard.ts` exits 3 before any writes                                                             | 3         |
| CI step failure                       | CI pipeline blocks merge; developer receives structured artifact                                          | —         |
| Log write permissions failure         | Caught in top-level error handler; stderr last-resort write; exit 1                                       | 1         |
| Sub-command timeout in validate       | Sub-command killed; timed_out=true recorded; overall=fail                                                 | 1         |

---

## Security Review

| Rule                         | Status                                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RBAC enforcement server-side | Not applicable — no HTTP endpoints                                                                                                                             |
| No role checks in frontend   | Not applicable — no UI                                                                                                                                         |
| No secrets exposed           | ✅ — scripts read no JWT secrets, DB credentials, or tokens                                                                                                    |
| JWT workspace scope enforced | Not applicable — no authentication context                                                                                                                     |
| No sensitive data in logs    | ✅ — logs contain only task descriptions, paths, counts                                                                                                        |
| No exec injection risk       | ✅ — all subprocess args are literals or values derived from code constants; task description appears only in hash computation, never in shell command strings |
| No path traversal            | ✅ — all paths are joined from known constants using `node:path`; no user-controlled path components are used in filesystem writes                             |

**Command injection note**: The `runGovernanceTool` function spawns with `spawn(BUN, [args])` — the
array-form spawn, not shell string interpolation. Task description strings never appear in the args
array passed to any subprocess. This eliminates all command injection risk.

---

## Test Strategy

### Testing framework

Vitest (matches project convention). Tests live under `scripts/ai-engine/__tests__/`.

### Unit tests per module

#### `execution-id.test.ts`

```typescript
describe("generateExecutionId", () => {
  it("returns format matching {timestamp}-{8hexchars}");
  it("is deterministic: same task at same ms produces same hash suffix");
  it("produces unique IDs for different tasks (different hash suffix)");
  it("produces different IDs for same task at different timestamps");
});

describe("deriveTaskId", () => {
  it("returns 16-char hex string");
  it("is deterministic: same task always returns same ID");
  it("returns different IDs for different tasks");
});
```

#### `log-writer.test.ts`

```typescript
describe("writeExecutionLog", () => {
  it("creates log directory if absent (FR-023)");
  it("writes valid JSON to {execution_id}.json");
  it("writes atomically: .tmp.json is renamed to .json");
  it("overwrites existing file on re-run with same execution_id (idempotent)");
  it("all mandatory fields present in output (SC-003)");
});
```

#### `stale-check.test.ts`

```typescript
describe("checkBrainStatus", () => {
  it("returns absent when brain file does not exist");
  it("returns stale when a .ts source file is newer than brain");
  it("returns present_fresh when brain is newer than all source files");
  it("includes actionable detail message when stale");
  it("includes actionable detail message when absent");
});
```

#### `context-loader.test.ts`

```typescript
describe("loadAiContextMini", () => {
  it("returns parsed JSON when file exists");
  it("throws with actionable message when file is absent");
});
```

#### `skill-selector.test.ts`

```typescript
describe("selectSkills", () => {
  it("always includes baseline skills (architecture-intelligence, terminal-safety, mcp-routing)");
  it('adds gitnexus-refactoring for task containing "refactor"');
  it('adds gitnexus-debugging for task containing "debug"');
  it("is deterministic: same task always returns same sorted list");
  it("only returns skills that exist in .agents/skills/ directory");
  it("returns sorted skill list for determinism");
});
```

#### `process-runner.test.ts`

```typescript
describe("runGovernanceTool", () => {
  it("captures exit code 0 for successful command");
  it("captures non-zero exit code without throwing");
  it("sets timed_out: true when timeout is exceeded");
  it("kills the subprocess on timeout (SIGTERM)");
  it("does not leak stdout/stderr to parent process");
  it("records accurate duration_ms");
});
```

#### `monorepo-guard.test.ts`

```typescript
describe("assertMonorepoRoot", () => {
  it("exits with code 3 when package.json is missing");
  it("exits with code 3 when docs/ai/context is missing");
  it("does not exit when all markers present");
});
```

#### `run-task.test.ts`

```typescript
describe("run-task CLI", () => {
  it("exits 0 on compliant repository with valid task");
  it("exits 1 when validation returns violations");
  it("exits 3 when ai-context-mini.json is absent");
  it("exits 3 when a required skill directory is not found");
  it("exits 4 when ai-architecture-brain.json is stale (direct process.exit(4) inside try block)");
  it("produces a valid ExecutionLog with all mandatory fields");
  it("handles --dry-run flag: skips execution, writes log with pass");
  it("enforces 300s timeout (unit: mock timer)");
});
```

#### `plan-task.test.ts`

```typescript
describe("plan-task CLI", () => {
  it("writes plan document to docs/architecture/health/ai-plans/{task_id}.md");
  it("overwrites existing plan file on re-run (deterministic, FR-006)");
  it("does not modify any application source files");
  it("produces identical plan for same task description (two consecutive runs)");
  it("includes all required plan sections");
  it("writes valid ExecutionLog with validation_result: pass");
  it("flags ambiguous tasks in plan output");
  it(
    "exits 3 when ai-context-mini.json is absent (direct process.exit(3) inside inline try block)",
  );
  it(
    "enforces 120s timeout: exits 2 on timeout (isTimeout ? process.exit(2) : process.exit(1)) via vi.useFakeTimers()",
  );
});
```

#### `validate-execution.test.ts`

```typescript
describe("validate-execution CLI", () => {
  it("exits 0 when all tools pass and brain is fresh");
  it("exits 1 when arch:guard returns non-zero");
  it("exits 1 when type-safety-guard returns violations");
  it("exits 3 when brain is absent");
  it("exits 4 when brain is stale");
  it("uses 90s timeout locally, 120s in CI (--ci flag)");
  it("writes validation artifact with all mandatory fields");
  it("aggregates architecture_violations across all three tools");
  it("sets validation_result: fail when any tool fails");
});
```

### Mock strategy

- **Filesystem mocking**: Use `tmp` directories created in `beforeEach` / cleaned in `afterEach`.
  Do not mock `node:fs` globally — use real temp dirs for reliable atomic write verification.
- **Child process mocking**: Use `vi.mock('node:child_process')` with a controllable `spawn` stub
  that simulates exit codes, stdout, and timeout behavior.
- **Clock mocking**: Use `vi.useFakeTimers()` for timeout enforcement tests.

### Vitest project registration

Add `scripts/ai-engine` as a test project in `vitest.workspace.ts`:

```typescript
{
  test: {
    name: 'ai-engine',
    include: ['scripts/ai-engine/__tests__/**/*.test.ts'],
    environment: 'node',
  },
}
```

### Integration test

Add one integration test under `tests/integration/ai-engine/validate-execution.integration.test.ts`
that runs `bun ai:validate` as a subprocess on the real repository and asserts:

1. Exit code 0 on a compliant repository.
2. Execution log file is created with all mandatory fields.
3. `architecture_violations` matches the count from `bun arch:guard` exit status.

---

## Rollback Strategy

This stage is pure tooling — no database migrations, no API routes, no tenant state.

**Rollback procedure**:

1. Remove `scripts/ai-engine/` directory.
2. Remove `ai:run`, `ai:plan`, `ai:validate` entries from root `package.json`.
3. Remove Steps 11–13 from `.github/workflows/architecture-governance.yml`.
4. The `docs/architecture/health/ai-execution-logs/` and `docs/architecture/health/ai-plans/`
   directories may be left in place (they contain historical log artifacts) or deleted at developer
   discretion — they have no runtime impact and do not affect tests.

No data migration is required. No rollback of database state is necessary.

---

## Non-Goals

Explicitly excluded from this stage:

- Implementing AI inference, LLM API calls, or any form of AI reasoning inside the scripts.
- Redesigning or modifying existing architecture governance rules or ADRs.
- Creating a new CI workflow file (new steps are added to `architecture-governance.yml`).
- Persistent storage of execution logs beyond the local filesystem.
- Network services, HTTP endpoints, queue consumers, or scheduled background jobs.
- UI, frontend surface, or student-facing behavior of any kind.
- Rate limiting (these are tooling scripts, not HTTP endpoints).
- New packages beyond `packages/logger` (zero new package introductions).
- Modifying any migration file, schema version, or product version.
- Log rotation, retention enforcement, or archival of execution log artifacts.
- Orphan `.tmp.json` cleanup — out of scope for this stage.
- Windows path compatibility (monorepo is Linux/macOS; CI uses `ubuntu-latest`).

---

## Final Compliance Statement

Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.

| Architectural Rule                       | Compliance                                            |
| ---------------------------------------- | ----------------------------------------------------- |
| Database-per-tenant isolation            | ✅ — No database access introduced                    |
| License middleware for workspace routes  | ✅ — No workspace-bound routes introduced             |
| Schema and product version compatibility | ✅ — Not modified; confirmed by ai:validate           |
| Server-authoritative time                | ✅ — All timestamps use `Date.now()` (server process) |
| Attempt snapshot immutability            | ✅ — Not touched                                      |
| Worker-finalized grading                 | ✅ — Not touched                                      |
| Import boundary (scripts/ai-engine/)     | ✅ — Only @zidney/logger + stdlib permitted and used  |
| No cross-tenant joins                    | ✅ — No database access of any kind                   |
| No row-based multi-tenancy               | ✅ — Confirmed                                        |
| No global DB singleton                   | ✅ — Confirmed                                        |
| Zero new HTTP endpoints                  | ✅ — Confirmed                                        |
| Zero new queue consumers                 | ✅ — Confirmed                                        |
| Zero new database tables                 | ✅ — Confirmed                                        |
