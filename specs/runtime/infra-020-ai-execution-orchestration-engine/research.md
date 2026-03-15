# Research: AI Execution Orchestration Engine

# Stage: INFRA-020

# Phase: 01_PLATFORM_FOUNDATION

# Resolved: 2026-03-15

This document records all technical decisions made during planning that required research or
disambiguation before implementation can begin. All items below are **RESOLVED** — no
NEEDS CLARIFICATION remains.

---

## Decision 1 — Execution ID Format

**Unknown**: The spec states execution ID is "timestamp + task hash" but specifies neither which
hash algorithm to use nor the exact format of the concatenated string.

**Decision**: `${Date.now()}-${sha256(taskDescription).slice(0, 8)}`

**Rationale**: `Date.now()` provides monotonic ordering and makes log files sort lexicographically
by time. An 8-character hex prefix of SHA-256 over the task description string provides per-task
disambiguation without significant collision risk within a single session. SHA-256 is available from
Node's `node:crypto` stdlib — no external dependency required (forbidden by spec).

**Example**: `1742040000000-a1b2c3d4`

**Alternatives considered**:

- UUID v4 — no temporal ordering, requires `uuid` package (forbidden).
- Timestamp only — collision risk if two tasks run within the same millisecond.
- ULID — superior ergonomics but requires an external dependency (forbidden).
- SHA-1 — weaker but sufficient; SHA-256 is trivially available and more future-proof.

---

## Decision 2 — @zidney/config Import Usage

**Unknown**: The spec permits imports from `packages/logger` and `packages/config`. However, the
`packages/config` package has no visible `src/` directory at the time of planning. Its `README.md`
states it validates `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` at startup — environment
variables that are unavailable in CI governance tooling contexts.

**Decision**: Do **not** import `@zidney/config` in `scripts/ai-engine/`. Read
`process.env.LOG_LEVEL`, `process.env.NODE_ENV`, and `process.env.CI` directly.

**Rationale**: Importing `@zidney/config` in a tooling script would trigger runtime validation of
server-side required env vars that CI governance jobs intentionally do not provide. This would cause
the orchestration scripts to fail at startup on any machine that does not have a full server env
configured — defeating the purpose of developer-local and CI tooling. The spec's "allowed" list
is a ceiling, not a requirement. Using `process.env` directly is idiomatic for Node/Bun CLI tools
and avoids the coupling.

**Alternatives considered**:

- Import `@zidney/config` — would fail on CI without DATABASE_URL/REDIS_URL/JWT_SECRET present.
- Create a new lightweight tooling config package — out of scope; no new packages permitted.

---

## Decision 3 — Skills Selection Algorithm

**Unknown**: FR-004 requires `ai:run` to activate "only the skills required for the given task"
without specifying how relevance is determined.

**Decision**: Keyword matching against `.agents/skills/` directory names (deterministic per task
description string).

**Algorithm**:

1. List all directory names under `.agents/skills/` using `node:fs`.
2. Apply a fixed keyword → skill-name mapping table (see Implementation Layers below).
3. Always include a governance baseline set: `architecture-intelligence`, `terminal-safety`,
   `mcp-routing`.
4. Return the union of baseline + matched skills. Sort alphabetically for determinism.

**Rationale**: FR-006 (plan determinism) and FR-012 (idempotent execution IDs) both require that
the same task description always produces the same set of skills. Reading SKILL.md files to derive
relevance would make the result sensitive to SKILL.md edits, breaking determinism. Directory-name
matching against a fixed mapping table is hermetic and reproducible.

**Alternatives considered**:

- Semantic matching via SKILL.md content — breaks FR-006 (content-sensitive).
- Load all skills always — fails FR-004 (only relevant skills may be activated).
- LLM-based relevance scoring — out of scope; scripts are deterministic controllers, not AI agents.

**Keyword mapping table** (built-in to `skill-selector.ts`):

| Keyword pattern (regex, case-insensitive) | Skill(s) activated                                    |
| ----------------------------------------- | ----------------------------------------------------- |
| `refactor\|rename\|extract\|split\|move`  | `gitnexus-refactoring`                                |
| `debug\|error\|fail\|bug\|trace`          | `gitnexus-debugging`                                  |
| `impact\|break\|depend\|blast`            | `gitnexus-impact-analysis`                            |
| `explore\|understand\|how.*work\|flow`    | `gitnexus-exploring`                                  |
| `test\|spec\|coverage\|vitest`            | (no extra skill; architecture-intelligence covers it) |
| `git\|commit\|branch\|pr\|push`           | `git-governance`                                      |
| `package\|dependency\|dep\|install`       | `package-manager-governance`                          |
| `precommit\|pre-commit\|husky`            | `precommit-diagnostics`                               |

---

## Decision 4 — Plan Document Output Location

**Unknown**: FR-005 says `ai:plan` produces a "human-readable execution plan without modifying any
application source files" but does not specify where the plan is written.

**Decision**: `docs/architecture/health/ai-plans/{task_id}.md`

**Rationale**: Using `task_id` as the filename (not `execution_id`) satisfies FR-006: re-running
`ai:plan` for the same task overwrites the same file, producing identical deterministic output
rather than accumulating multiple plan files. Placing under `docs/architecture/health/` keeps it
consistent with all other governance artifacts in the project and ensures it is trackable in git
without touching application source directories.

**Alternatives considered**:

- `tmp/ai-plans/` — not tracked in git; acceptable locally but loses plan history.
- `specs/runtime/{task_id}/plan.md` — conflicts with hand-authored SpecKit plans.
- Using `execution_id` as filename — creates a new file per run, breaking FR-006.

---

## Decision 5 — CI Workflow Placement

**Unknown**: The spec says the CI step should match `architecture-governance.yml` conventions but
does not state whether it should be added to that existing workflow or a new file.

**Decision**: Add the AI Execution Validation step to the existing
`.github/workflows/architecture-governance.yml` workflow.

**Rationale**: The spec explicitly says "matching the `architecture-governance.yml` pattern."
Adding to the same workflow avoids duplicating the Checkout + Setup Bun + Install dependencies
preamble, ensures the new step runs on the same trigger matrix (PR to `main`/`develop`, push,
nightly schedule), and keeps all architecture governance concerns in a single workflow file.

**Alternatives considered**:

- New `ai-execution-validation.yml` — would duplicate the preamble and fragment governance tooling.
- Adding to `ci.yml` — `ci.yml` is the general CI pipeline; governance tooling belongs in
  `architecture-governance.yml` per existing convention.

---

## Decision 6 — Timeout Implementation

**Unknown**: The spec defines timeout values but not the implementation mechanism.

**Decision**: `AbortSignal.timeout(ms)` passed to `child_process.spawnSync` / async
`child_process.spawn` + manual timer, matching the pattern already used by
`scripts/architecture-health/source-runner.ts`.

**Rationale**: The existing `source-runner.ts` uses `spawn` with explicit `timeout_ms` — this is
the project's established pattern. Replicating it in `scripts/ai-engine/process-runner.ts` keeps
implementations consistent. The `BUN = process.execPath` pattern is also re-used from
`source-runner.ts`.

```typescript
// Pattern from scripts/architecture-health/source-runner.ts (adapted)
const proc = spawn(BUN, ["run", command], { stdio: "pipe" });
const timer = setTimeout(() => {
  proc.kill("SIGTERM");
}, timeoutMs);
proc.on("close", (code) => {
  clearTimeout(timer);
  resolve(code);
});
```

---

## Decision 7 — Subprocess Output Handling

**Unknown**: FR-011 forbids stdout/stderr from the orchestration scripts, but the sub-processes
they invoke (`bun arch:guard`, `bun type-safety-guard`, `bun arch:health`) produce their own output.

**Decision**: Use `stdio: 'pipe'` for all spawned sub-processes. Capture stdout/stderr but do not
re-emit them. Parse artifact files written to disk by each sub-process to extract violation counts
and pass/fail status.

**Rationale**: `stdio: 'pipe'` ensures sub-process output never reaches the orchestrator's
stdout/stderr channels. Reading artifact files rather than parsing stdout is more robust because
the architecture tools already write structured JSON artifacts to known paths (e.g.,
`docs/architecture/health/architecture-health.json`).

**Artifact paths used for result extraction**:

| Sub-command                    | Artifact file read for result                                       |
| ------------------------------ | ------------------------------------------------------------------- |
| `bun arch:guard --ci`          | exit code only (guard exits 0/non-zero; no stable JSON output path) |
| `bun type-safety-guard --json` | exit code + stdout parsed as JSON (captured via pipe)               |
| `bun arch:health --ci`         | `docs/architecture/health/architecture-health.json`                 |

---

## Summary: All Unknowns Resolved

| #   | Unknown                                 | Status      |
| --- | --------------------------------------- | ----------- |
| 1   | Execution ID format                     | ✅ Resolved |
| 2   | @zidney/config usage in tooling context | ✅ Resolved |
| 3   | Skills selection algorithm              | ✅ Resolved |
| 4   | Plan document output location           | ✅ Resolved |
| 5   | CI workflow file placement              | ✅ Resolved |
| 6   | Timeout implementation mechanism        | ✅ Resolved |
| 7   | Subprocess output handling              | ✅ Resolved |
