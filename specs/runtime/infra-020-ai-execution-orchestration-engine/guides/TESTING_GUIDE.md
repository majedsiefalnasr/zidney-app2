# Testing Guide — AI Execution Orchestration Engine

**Stage**: AI Execution Orchestration Engine  
**Phase**: 01_PLATFORM_FOUNDATION  
**Branch**: `spec/infra-020-ai-execution-orchestration-engine`  
**Prepared for**: QA engineers and reviewing developers

---

## Prerequisites

Before running any tests, ensure:

1. Repository is on branch `spec/infra-020-ai-execution-orchestration-engine`
2. Dependencies are installed: `bun install`
3. Architecture intelligence is fresh: `bun scripts/infra-audit.ts` (generates `docs/ai/context/ai-architecture-brain.json`)

---

## 1. Unit Tests

Run the full `ai-engine` test suite:

```bash
bun vitest run --project ai-engine
```

Expected result: **64 tests pass, 0 fail**

Run a single test file:

```bash
bun vitest run scripts/ai-engine/__tests__/run-task.test.ts
```

Test files and what they cover:

| File                         | Module Tested           | Key Scenarios                                       |
| ---------------------------- | ----------------------- | --------------------------------------------------- |
| `execution-id.test.ts`       | `execution-id.ts`       | ID format, uniqueness, determinism of deriveTaskId  |
| `log-writer.test.ts`         | `log-writer.ts`         | Atomic write (tmp→rename), directory creation       |
| `monorepo-guard.test.ts`     | `monorepo-guard.ts`     | Root detection, stderr JSON on failure, exit 3      |
| `stale-check.test.ts`        | `stale-check.ts`        | absent/stale/present_fresh status transitions       |
| `context-loader.test.ts`     | `context-loader.ts`     | Load success, throws when absent                    |
| `skill-selector.test.ts`     | `skill-selector.ts`     | Baseline skills, keyword matching, dir filtering    |
| `process-runner.test.ts`     | `process-runner.ts`     | Success, failure, timeout (SIGTERM), stdout capture |
| `run-task.test.ts`           | `run-task.ts`           | Exit 0/1/2/3/4, dry-run, log write                  |
| `plan-task.test.ts`          | `plan-task.ts`          | Plan generation, overwrite semantics, clarification |
| `validate-execution.test.ts` | `validate-execution.ts` | Tool orchestration, CI detection, exit codes        |

---

## 2. Integration Test

The integration test spawns a real `bun ai:validate` subprocess. It requires the governance
toolchain (`arch:guard`, `type-safety-guard`, `arch:health`) to be available.

```bash
bun vitest run tests/integration/ai-engine/validate-execution.integration.test.ts
```

> **Note**: This test is designed for CI where the governance toolchain is available. It may
> time out locally if the tools are not installed. This is expected and not a failure.

---

## 3. Manual CLI Testing

### 3a. `bun ai:run` — Run a governance task

**Happy path** (brain is fresh, skills and context exist):

```bash
# Generate fresh brain first
bun scripts/infra-audit.ts

# Run a task
bun run ai:run --task "validate tenant isolation in packages/domain-core"
```

Expected: exits 0, writes a log file to `docs/architecture/health/ai-execution-logs/`

**Stale brain** (brain last modified before any .ts file in packages/ or apps/):

```bash
# Touch a source file to make brain "stale"
touch packages/logger/src/index.ts

# Run (brain was not regenerated)
bun run ai:run --task "any task"
```

Expected: exits 4, stderr JSON: `{"error":"STALE_BRAIN","brainPath":"...","detail":"..."}`

**Missing brain** (brain file absent):

```bash
rm docs/ai/context/ai-architecture-brain.json
bun run ai:run --task "any task"
```

Expected: exits 3, stderr JSON: `{"error":"BRAIN_ABSENT","brainPath":"..."}`

Restore brain: `bun scripts/infra-audit.ts`

**Dry run** (no actual tool calls):

```bash
bun run ai:run --task "test task" --dry-run
```

Expected: exits 0, log file written with `dry_run: true`, no subprocess spawned

---

### 3b. `bun ai:plan` — Generate an execution plan

**Happy path**:

```bash
bun run ai:plan --task "refactor tenant resolver in apps/api/src/middleware"
```

Expected: exits 0, writes a markdown plan to `docs/architecture/health/ai-plans/` with 4 required
sections: `# Execution Plan`, `## Skills Required`, `## Architecture Constraints`, `## Execution Steps`

**Ambiguous task** (no verb, no subject):

```bash
bun run ai:plan --task "auth"
```

Expected: exits 0, plan markdown contains `## Clarification Required` section

**Overwrite semantics** — same task → same plan file (deterministic):

```bash
bun run ai:plan --task "same task description"
bun run ai:plan --task "same task description"
```

Expected: second invocation overwrites the first; no duplicate file; same filename derived from
`deriveTaskId("same task description")`

---

### 3c. `bun ai:validate` — Run governance validation

**Happy path**:

```bash
bun run ai:validate
```

Expected: exits 0, writes a validation log to `docs/architecture/health/ai-execution-logs/`  
Log contains `skills_activated: []` (validate never activates skills by design)  
Log contains `tools_executed: ["arch:guard", "type-safety-guard", "arch:health"]`

**CI mode**: (longer timeout — 120s instead of 90s):

```bash
bun run ai:validate --ci
```

Expected: same as above but with CI-extended timeout

---

## 4. Exit Code Contract Verification

For each command, the exit codes must behave as follows:

| Exit Code | Meaning      | When                                               |
| --------- | ------------ | -------------------------------------------------- |
| 0         | Success      | All checks pass, log written                       |
| 1         | Failure      | Tool failure or unexpected error (outer catch)     |
| 2         | Timeout      | Budget exceeded (outer catch)                      |
| 3         | Missing file | Brain absent, context absent, or skill dir missing |
| 4         | Stale brain  | Brain older than newest .ts source file            |

Verify exit code from the shell:

```bash
bun run ai:run --task "test"
echo "Exit code: $?"
```

---

## 5. Log Output Verification

After any successful `ai:run` or `ai:validate` invocation, inspect the log:

```bash
ls -lt docs/architecture/health/ai-execution-logs/
cat docs/architecture/health/ai-execution-logs/<latest>.json | jq .
```

Expected log fields:

```json
{
  "execution_id": "1773600000000-abc12345",
  "task_description": "...",
  "timestamp_start": "2026-03-15T00:00:00.000Z",
  "timestamp_end": "2026-03-15T00:00:01.000Z",
  "duration_ms": 1234,
  "skills_activated": ["architecture-intelligence", "terminal-safety"],
  "tools_executed": [...],
  "outcome": "success",
  "exit_code": 0,
  "dry_run": false
}
```

> **Note**: Log files are gitignored (`docs/architecture/health/ai-execution-logs/*.json`).
> They are only created at runtime and uploaded as CI artifacts.

---

## 6. CI Pipeline Verification

After the PR is merged to `develop`, verify the following in the GitHub Actions run for
`architecture-governance.yml`:

| Step | Name                                    | Expected                                             |
| ---- | --------------------------------------- | ---------------------------------------------------- |
| 11   | Run AI Execution Validation             | Exit 0, green ✅                                     |
| 12   | Upload AI Execution Validation Artifact | Artifact `ai-execution-validation-artifact` uploaded |
| 13   | Publish AI Execution Summary            | Markdown summary in GitHub Step Summary              |

Steps 12 and 13 use `if: always()` — they run even if step 11 fails, ensuring the diagnostic
log is always available.

---

## 7. What NOT to Test in This Stage

The following are explicitly out of scope per `spec.md`:

- LLM inference or model response quality
- Persistent external log storage (S3, Postgres, etc.)
- Tenant-facing API endpoints or UI
- Worker queue interactions
- Attempt engine behavior

---

## Troubleshooting

| Symptom                        | Cause                            | Fix                                       |
| ------------------------------ | -------------------------------- | ----------------------------------------- |
| Exit 3 — brain absent          | `infra-audit.ts` not run         | `bun scripts/infra-audit.ts`              |
| Exit 4 — stale brain           | Source files newer than brain    | `bun scripts/infra-audit.ts`              |
| Exit 3 — context absent        | `ai-context-mini.json` not found | `bun scripts/generate-ai-context.ts`      |
| Exit 3 — skill dir missing     | `.agents/skills/` not present    | Check that AGENTS skills are committed    |
| Tests fail — filesystem errors | Test isolation issue             | Run tests individually; check tmp cleanup |
| Integration test timeout       | Governance tools not available   | Expected locally; runs in CI only         |
