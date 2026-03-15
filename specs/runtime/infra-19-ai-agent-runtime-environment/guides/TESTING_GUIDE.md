# Testing Guide — STAGE_INFRA_19_AI_AGENT_RUNTIME_ENVIRONMENT

**Stage:** STAGE_INFRA_19_AI_AGENT_RUNTIME_ENVIRONMENT  
**Phase:** 01_PLATFORM_FOUNDATION  
**Stage Directory:** infra-19-ai-agent-runtime-environment  
**Generated On:** 2026-03-15

---

## Purpose

This guide explains how to validate the AI runtime environment diagnostic script and ensure it correctly integrates with the CI pipeline.

---

## Summary of Delivered Behavior

The Zidney AI runtime environment diagnostic tool (`bun ai-runtime:status`) performs five independent health checks on the repository to ensure AI agent execution prerequisites are satisfied:

1. **Context Loader** — Validates that `docs/ai/AI_CONTEXT_INDEX.md` exists and contains required sections
2. **Skill Loader** — Confirms `.agents/skills/` directory structure and skill discovery
3. **Architecture Intelligence** — Verifies `docs/ai/context/ai-architecture-brain.json` is valid, dependency graph edges are well-formed, and no malformed module paths exist (tests edge cases like `./` prefix, `/src/` segments, `srcvue/test-utils` concatenations)
4. **MCP Routing** — Checks `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` exists and is parseable
5. **Deterministic Execution** — Ensures `docs/ai/AI_BOOTSTRAP.md` and `docs/ai/AI_CONTEXT_INDEX.md` exist and are readable

Key outcomes:

- Read-only diagnostic script exits cleanly (code 0 = HEALTHY, code 1 = degraded)
- 29 unit tests cover all 5 checks, edge cases, and error scenarios
- 6 integration tests validate healthy local repo state
- CI integration via two new steps in `.github/workflows/ci.yml` `arch-guard` job
- Script uses discriminated union types for type-safe result handling
- Independent try/catch per sub-check ensures all checks attempt execution even if one fails

---

## Prerequisites

| Requirement                | Validation Command / Check                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Node.js installed          | `node --version` (v20+)                                                                    |
| Bun installed              | `bun --version` (v1+)                                                                      |
| Git branch                 | `git branch` should show `spec/infra-19-ai-agent-runtime-environment` or merged to develop |
| Working directory clean    | `git status --porcelain` should show no unstaged changes (except test files)               |
| Correct branch checked out | Should be on `develop` (or merged PR)                                                      |

---

## Files in Scope

```
scripts/ai-runtime/
  └── runtime-status.ts                  (Main diagnostic script, 450 LOC)

tests/unit/ai-runtime/
  └── runtime-status.test.ts             (29 unit tests)

tests/integration/ai-runtime/
  └── runtime-status.integration.test.ts (6 integration tests)

.github/workflows/ci.yml                 (2 new steps in arch-guard job)

package.json                             (3 new ai-runtime:* scripts)
```

---

## Local Run Commands

```bash
# Install dependencies (if needed)
bun install

# Run the diagnostic script manually
bun ai-runtime:status

# Expected output:
# ┌─────────────────────────────────────────────┐
# │         AI Runtime Environment              │
# │─────────────────────────────────────────────│
# │ ✔ Context Loader                            │
# │ ✔ Skill Loader                              │
# │ ✔ Architecture Intelligence                 │
# │ ✔ MCP Routing                               │
# │ ✔ Deterministic Execution                   │
# └─────────────────────────────────────────────┘
# Status: HEALTHY (5/5 checks pass)
# Exit code: 0
```

---

## Automated Validation Commands

```bash
# Run all unit tests
bun vitest run tests/unit/ai-runtime/

# Expected: 29/29 pass
# Exit code: 0

# Run all integration tests
bun vitest run tests/integration/ai-runtime/

# Expected: 6/6 pass
# Exit code: 0

# Run lint on new files
bun lint scripts/ai-runtime/ tests/unit/ai-runtime/ tests/integration/ai-runtime/

# Expected: 0 violations
# Exit code: 0

# TypeScript type-check
bun typecheck

# Expected: 0 errors
# Exit code: 0
```

---

## Manual Test Scenarios

### Scenario 1 — Successful Diagnostic Run

**Purpose:** Verify the diagnostic script executes and reports HEALTHY status when all checks pass.

1. Ensure you're on the merged branch (or `develop` after PR merge)
2. Run `bun ai-runtime:status`
3. Observe formatted table output showing all 5 checks with ✔ marks
4. Confirm exit code is 0 (run `echo $?` after the command)

**Expected:**

- Table displays all 5 checks with ✔ marks
- "Status: HEALTHY (5/5 checks pass)" message appears
- Script exits with code 0

**Troubleshooting:**

- If context loader fails, verify `docs/ai/AI_CONTEXT_INDEX.md` exists
- If skill loader fails, check `.agents/skills/` directory structure
- If architecture intelligence fails, run `bun run ai-context:refresh` to regenerate the brain

---

### Scenario 2 — CI Integration

**Purpose:** Verify that the diagnostic script is automatically run during CI and integration steps.

1. Push the PR branch to GitHub
2. Navigate to the PR and view the "Checks" tab
3. Find the `arch-guard` job in the CI workflow
4. Expand the job and look for "AI Agent Runtime Status Check" step
5. Observe the step runs `bun run ai-runtime:status` and shows output

**Expected:**

- "AI Agent Runtime Status Check" step exists in `arch-guard` job
- Step shows clear execution output (HEALTHY status or specific check failures)
- Step exits with code 0 (success) for a healthy repo
- Cache-miss regeneration step (preceding step) only runs if ai-context cache is not fresh

**Troubleshooting:**

- If the step fails in CI, check the CI logs for which check failed
- Common cause: `docs/ai/context/ai-architecture-brain.json` is stale — run `bun run ai-context:refresh`

---

### Scenario 3 — Edge Case: Malformed Module Path Detection

**Purpose:** Verify the script detects and reports malformed module paths in the architecture brain.

1. Manually edit `docs/ai/context/ai-architecture-brain.json` to introduce a malformed edge, e.g.:
   ```json
   "dependencies": {
     "packages/mymodule": ["srcvue/test-utils"]  // malformed target
   }
   ```
2. Run `bun ai-runtime:status`
3. Observe that the script reports a WARN or ERROR for the Architecture Intelligence check
4. The error message should identify the malformed path

**Expected:**

- Script detects the malformed path `srcvue/test-utils` (fails positive-pattern regex `^(packages|apps)\/[^/]+$`)
- Reports WARN or ERROR with a suggestion to fix the brain
- Exit code is 1 (degraded status)

**Troubleshooting:**

- Revert the manual edit after testing: `git checkout docs/ai/context/ai-architecture-brain.json`
- Or regenerate: `bun run ai-context:refresh`

---

### Scenario 4 — Empty Brain Detection (Unit Test Validation)

**Purpose:** Verify the script detects an empty or corrupt architecture brain file.

This scenario is primarily validated by unit tests, but you can simulate it manually:

1. Temporarily rename `docs/ai/context/ai-architecture-brain.json`:
   ```bash
   mv docs/ai/context/ai-architecture-brain.json docs/ai/context/ai-architecture-brain.json.bak
   ```
2. Run `bun ai-runtime:status`
3. Observe the script reports a WARN for Architecture Intelligence (file not found)
4. Restore the file:
   ```bash
   mv docs/ai/context/ai-architecture-brain.json.bak docs/ai/context/ai-architecture-brain.json
   ```

**Expected:**

- Script gracefully handles missing brain file
- Reports WARN for Architecture Intelligence check with suggestion to regenerate
- Exit code is 1 (degraded but not fatal)

**Troubleshooting:**

- Do NOT commit with the brain file deleted — always restore it

---

## QA Sign-Off

- [ ] Ran `bun ai-runtime:status` locally — all 5 checks HEALTHY
- [ ] Ran unit tests — 29/29 pass
- [ ] Ran integration tests — 6/6 pass
- [ ] Verified CI step executes correctly (if PR merged)
- [ ] Confirmed lint and typecheck pass
- [ ] Validated edge case detection (malformed paths)

**Ready for Production:** ✅ Yes (after all checks above complete)

---

## Support & Troubleshooting

**Q: What does "Context Loader" check?**  
A: Verifies `docs/ai/AI_CONTEXT_INDEX.md` exists and contains required sections. This file is the entry point for AI agent context loading.

**Q: How do I regenerate the architecture brain if it's stale?**  
A: Run `bun run ai-context:refresh` (or `bun ai-context:refresh`). This re-indexes the repository and updates `docs/ai/context/ai-architecture-brain.json`.

**Q: Why does the script use `independent try/catch per sub-check`?**  
A: Each check (especially Architecture Intelligence) has multiple internal validations. Independent try/catch ensures that if one sub-check fails (e.g., empty brain), the script continues to attempt the other sub-checks and reports all findings.

**Q: Can I disable the AI runtime status check in CI?**  
A: Not recommended. The check is designed to catch stale or corrupt architecture context before AI agents are invoked. If you need to skip it temporarily, discuss with the architecture team.

**Q: What's the difference between the `ai-runtime:status` and `ai-context:refresh` commands?**  
A: `ai-runtime:status` runs the diagnostic (read-only). `ai-context:refresh` regenerates the AI context intelligence files (write operation).
