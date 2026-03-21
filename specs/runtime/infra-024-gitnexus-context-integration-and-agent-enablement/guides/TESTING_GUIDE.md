# Testing Guide — GitNexus Context Integration and Agent Enablement

**Stage:** GitNexus Context Integration and Agent Enablement  
**Phase:** 01_PLATFORM_FOUNDATION  
**Stage Directory:** infra-024-gitnexus-context-integration-and-agent-enablement  
**Generated On:** 2026-03-19T01:00:00.000Z

---

## Purpose

This guide explains how to validate the INFRA-024 implementation end-to-end. It covers automated
test runs, manual CLI scenarios, negative/error cases, and CI gate verification.

---

## Summary of Delivered Behavior

INFRA-024 delivers a machine-readable architecture state artifact (`docs/ai/context/gitnexus-context.json`)
and the tooling pipeline to generate and validate it. AI agents and CI pipelines use this artifact
to understand changed modules, dependency graphs, risk indicators, and architecture health without
having to reason from raw source code.

Key outcomes:

- Running `bun run gitnexus:context` generates `docs/ai/context/gitnexus-context.json` from live
  git state and the architecture brain.
- Running `bun run gitnexus:validate` validates the artifact in 5 steps; exits 0 = valid, 1 = invalid.
- Running `bun run gitnexus:validate` (via `ts-node`/bun) produces a human-readable CI report.
- 15 unit tests covering all 8 exported functions and CLI flag parsing pass in < 2s.
- The orchestrator includes a bootstrap block to auto-invoke GitNexus context before implementation.

---

## Prerequisites

| Requirement               | Validation Command / Check                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| Bun installed             | `bun --version` (v1.3+ expected)                                                                 |
| On the correct branch     | `git branch --show-current` → `spec/infra-024-gitnexus-context-integration-and-agent-enablement` |
| Architecture brain exists | `ls docs/ai/context/ai-architecture-brain.json`                                                  |
| Dependencies installed    | `bun install` (gitnexus@1.4.6 should be present in devDeps)                                      |
| Git history available     | `git log --oneline -5` (non-empty)                                                               |

---

## Files in Scope

```text
scripts/gitnexus-context.ts
scripts/validate/validate-gitnexus.ts
docs/ai/gitnexus-context.schema.json
docs/ai/gitnexus.md
docs/ci/gitnexus-validation.md
docs/scripts/gitnexus-context.md
docs/scripts/validate-gitnexus.md
tests/fixtures/gitnexus/mock-brain.json
tests/fixtures/gitnexus/mock-git-changed.txt
tests/fixtures/gitnexus/mock-git-log.txt
tests/gitnexus-context.test.ts
package.json  (added gitnexus:context, gitnexus:validate, validate-gitnexus scripts)
AGENTS.md  (added GitNexus Context Usage Policy)
.agents/agents/zidney-orchestrator.agent.md  (added Bootstrap section)
```

---

## Local Run Commands

```bash
# Install dependencies (if not already done)
bun install

# Verify gitnexus devDep is present
cat package.json | grep gitnexus

# Generate the gitnexus-context.json artifact
bun run gitnexus:context

# Validate the generated artifact
bun run gitnexus:validate

# Run with --dry-run (no file write)
bun run scripts/gitnexus-context.ts --dry-run

# Run with --all flag (include all modules regardless of change detection)
bun run scripts/gitnexus-context.ts --all
```

---

## Automated Validation Commands

```bash
# Run only the INFRA-024 unit tests
bun run vitest run tests/gitnexus-context.test.ts

# Run full workspace tests
bun run vitest run

# Check lint (Biome)
bunx biome check scripts/gitnexus-context.ts scripts/validate/validate-gitnexus.ts tests/gitnexus-context.test.ts

# Type-check
bunx tsc --noEmit
```

Expected outcomes:

- `vitest run tests/gitnexus-context.test.ts` → 15/15 tests pass
- `vitest run` → 76/76 tests pass (1 known transient timeout in `process-runner.test.ts` is pre-existing)
- `biome check` → 0 errors in INFRA-024 files
- `tsc --noEmit` → exit code 0

---

## Manual Test Scenarios

### Scenario 1 — Generate artifact from live git state

**Purpose:** Verify the CLI generates a valid `gitnexus-context.json` from actual repository state.

1. Ensure you are on the INFRA-024 branch: `git branch --show-current`
2. Run: `bun run gitnexus:context`
3. Check the output file exists: `ls -la docs/ai/context/gitnexus-context.json`
4. Inspect structure: `cat docs/ai/context/gitnexus-context.json | head -40`

**Expected:**

- File is written to `docs/ai/context/gitnexus-context.json`
- JSON is valid and contains fields: `generatedAt`, `schemaVersion`, `repositoryName`, `changedModules`, `dependencyGraph`, `architectureLayers`, `recentCommits`, `riskIndicators`, `gitNexusHealth`
- `generatedAt` is a recent ISO timestamp
- `changedModules` is an array (may be empty if no recent changes detected against HEAD~1)

**Troubleshooting:** If `gitnexus` binary is not found, the health field will show `available: false`.
That is expected in environments without the global binary. The artefact is still generated.

---

### Scenario 2 — Validate the generated artifact

**Purpose:** Confirm the artifact passes all 5 validation steps.

1. Generate artifact first: `bun run gitnexus:context`
2. Run: `bun run gitnexus:validate`
3. Observe console output from the validation pipeline

**Expected:**

- Step 1 (File Existence): ✅ PASS
- Step 2 (JSON Parse): ✅ PASS
- Step 3 (Required Fields): ✅ PASS — all 9 required fields present
- Step 4 (Semantic Constraints): ✅ PASS — schemaVersion is a string, changedModules is an array, etc.
- Step 5 (Freshness): ✅ PASS — `generatedAt` within last 24 hours
- Final exit code: `echo $?` → `0`

**Troubleshooting:** If freshness fails (Step 5), regenerate the artifact and re-validate immediately.

---

### Scenario 3 — Dry-run mode (no file write)

**Purpose:** Verify `--dry-run` flag prints the artifact to stdout without touching the filesystem.

1. Note current file modified time: `ls -la docs/ai/context/gitnexus-context.json`
2. Run: `bun run scripts/gitnexus-context.ts --dry-run`
3. Observe stdout — full JSON should be printed
4. Re-check file modified time: `ls -la docs/ai/context/gitnexus-context.json`

**Expected:**

- JSON artifact is printed to stdout
- File modified time is UNCHANGED (no write happened)
- No error messages in stderr

---

### Scenario 4 — `--all` flag includes all modules

**Purpose:** Verify that `--all` bypasses change detection and includes the full module set.

1. Run without flag: `bun run gitnexus:context && cat docs/ai/context/gitnexus-context.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('changedModules:', len(d['changedModules']))"`
2. Run with flag: `bun run scripts/gitnexus-context.ts --all && cat docs/ai/context/gitnexus-context.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('changedModules:', len(d['changedModules']))"`

**Expected:**

- `--all` produces a `changedModules` count that is equal to or greater than without the flag
- Both runs produce valid JSON artifacts

---

### Scenario 5 — `--changed-files-only` flag (edge case)

**Purpose:** Verify that when no files have changed relative to base ref, `changedModules` is empty.

1. Run: `bun run scripts/gitnexus-context.ts --changed-files-only --base-ref HEAD`
2. Inspect: `cat docs/ai/context/gitnexus-context.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('changedModules:', d['changedModules'])"`

**Expected:**

- `changedModules: []` (no files changed relative to HEAD itself)
- JSON is otherwise fully valid

---

## Negative Cases

| Scenario                   | Trigger                                                                                | Expected Response                                               |
| -------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Stale artifact (>24h old)  | Manually set `generatedAt` to yesterday's ISO date, then `bun run gitnexus:validate`   | Step 5 FAIL → exit code 1 with "Artifact is stale" message      |
| Missing artifact file      | `rm docs/ai/context/gitnexus-context.json && bun run gitnexus:validate`                | Step 1 FAIL → exit code 1 with "File not found" message         |
| Corrupt JSON               | `echo "not-json" > docs/ai/context/gitnexus-context.json && bun run gitnexus:validate` | Step 2 FAIL → exit code 1 with "Invalid JSON" message           |
| Missing required field     | Remove `schemaVersion` from JSON manually, then validate                               | Step 3 FAIL → exit code 1 listing missing field                 |
| Invalid `--output` path    | `bun run scripts/gitnexus-context.ts --output /etc/forbidden.json`                     | Process exits with error: path outside workspace boundary       |
| Invalid `--base-ref` value | `bun run scripts/gitnexus-context.ts --base-ref "../../malicious"`                     | Process exits with error: ref failed `sanitizeRef()` validation |

---

## Multi-Tenant Isolation Verification

Not applicable — this stage introduces tooling scripts only. No database access, no tenant context,
no HTTP routes. The artifact is workspace-agnostic and contains architecture metadata only.

---

## Structured Log Verification

The `gitnexus-context.ts` script does not emit logs with correlation IDs (it is a CLI tool, not a
service). Errors are written to `stderr` via `console.error`. Success output goes to `stdout`.

To verify error output on failure:

```bash
bun run scripts/gitnexus-context.ts --base-ref "bad!ref" 2>&1 | head -5
```

Expected: error message on stderr, exit code 1.

---

## CI Integration Verification

To verify the CI gate script works as expected in CI:

```bash
# Simulate the CI validation step
bun run gitnexus:context
bun run gitnexus:validate
echo "Exit code: $?"
```

Expected: exit code 0 when artifact is fresh and valid.

The `docs/ci/gitnexus-validation.md` document describes how this gate integrates into the CI
pipeline for the `gitnexus:validate` GitHub Actions step.

---

## Known Limitations / Pre-existing Issues

- **`process-runner.test.ts` flaky timeout**: Pre-existing intermittent timeout in an unrelated
  workspace test file. Not introduced by INFRA-024. Re-run to confirm it is transient.
- **Pre-existing lint error in `apps/api/src/modules/translation/translation.context.ts`**: This
  Biome error exists in the repository prior to INFRA-024 and is out of scope.
- **Global `gitnexus` binary**: The `checkGitNexusHealth()` function executes the `gitnexus` CLI
  via `execFileSync`. In CI environments without a globally installed binary, health will report
  `available: false` — this is graceful degradation, not a failure.
