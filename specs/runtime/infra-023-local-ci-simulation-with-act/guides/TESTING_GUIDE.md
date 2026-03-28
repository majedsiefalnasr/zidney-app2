# Local CI Simulation — Testing & QA Guide

**Stage:** INFRA-023: Local CI Simulation With Act  
**For:** QA Engineers, Backend Developers, Infrastructure Teams  
**Quick Start:** 5 minutes

---

## What This Stage Delivers

Local CI simulation allows developers to **run GitHub Actions workflows on their machine** before pushing to CI. This stage delivers:

- **`act` integration** (GitHub Actions runner)
- **7-step governance orchestrator** for validation
- **6 npm scripts** for common CI tasks
- **Developer documentation** in `docs/ci/local-ci.md`

---

## Quick Start (5 mins)

### Prerequisites

```bash
# Install act (if not already installed)
brew install act

# Verify versions
act --version          # Should show v0.2.84 or later
docker --version       # Should show 29.x or later
```

### Run Local CI

```bash
# List all workflows without running containers
bun run ci:local:list

# Run all CI workflows locally
bun run ci:local

# Run a specific workflow
bun run ci:local:workflow <workflow-name>

# Run the 7-step governance orchestrator
bun run ci:run-local
```

---

## Manual Testing Scenarios

### Scenario 1: Verify Local CI Discovers All Workflows

**Intent:** Confirm `act` finds all GitHub Actions workflows

**Steps:**

1. Run discovery:

   ```bash
   bun run ci:local:list
   ```

2. Verify output includes these workflows (or equivalent):

   ```
   CI / Type Check
   CI / Biome — Lint & Format
   CI / Repo Doctor — DX Health Checks
   CI / AI-Guard — Architecture Boundaries
   AI Context Layer Validation / AI Context Generation & Validation
   ```

3. ✅ **Pass if:** All `*.yml` files in `.github/workflows/` are listed

4. ❌ **Fail if:** Any workflow is missing from the list

---

### Scenario 2: Run Lint Check Before Push

**Intent:** Simulate CI lint validation locally

**Steps:**

1. Verify codebase:

   ```bash
   bun run lint
   ```

2. Expected output:

   ```
   Checked XXXX files in XXXms. No fixes applied.
   Found N warning(s).  [or "No errors found"]
   ```

3. ✅ **Pass if:** Exit code is 0 and no lint ERRORS (warnings OK)

4. ❌ **Fail if:** Exit code is 1 or lint errors are reported

---

### Scenario 3: Verify TypeScript Strict Mode

**Intent:** Confirm type safety before merging

**Steps:**

1. Run type-check:

   ```bash
   bun run typecheck
   ```

2. Verify output shows:

   ```
   $ tsc --noEmit
   $ tsc --noEmit -p tsconfig.test.json
   # (no errors printed = success)
   ```

3. ✅ **Pass if:** Exit code is 0 and no errors are reported

4. ❌ **Fail if:** TypeScript errors appear or exit code is non-zero

---

### Scenario 4: Test Governance Orchestrator

**Intent:** Verify the full 7-step validation pipeline

**Steps:**

1. Run the orchestrator:

   ```bash
   bun run ci:run-local
   ```

2. Observe the output:
   - Step 1: `validate-runtime-scripts` — all scripts resolve
   - Step 2: `validate:scripts:broken` — infrastructure scripts OK
   - Step 3: `generate-script-docs` — docs are current
   - Step 4: `arch:guard` — no boundary violations
   - Step 5: `type-safety-guard` — type safety enforced
   - Step 6: `lint` — code style valid
   - Step 7: `ci:local` — workflows validated

3. Expected result table:

   ```
   ┌─ Governance Pipeline Results
   │ Step │ Command         │ Status │ Exit Code
   ├──────┼─────────────────┼────────┼──────────
   │ 1    │ validate-runtime-scripts  │ 0
   │ 2    │ validate:scripts:broken    │ 0
   ...
   │ 7    │ ci:local        │ [0 or 1, see note]
   └─ Summary: N/7 steps passed
   ```

4. ✅ **Pass if:** Steps 1–6 show exit code 0; Step 7 notes missing GITHUB_TOKEN is OK

5. ❌ **Fail if:** Steps 1–6 fail with non-zero exit codes

---

### Scenario 5: Simulate a Lint Failure

**Intent:** Verify failure detection and reporting

**Steps:**

1. Introduce a lint violation:

   ```bash
   echo "var x = 1" > /tmp/bad.ts  # var keyword violates biome
   cp /tmp/bad.ts apps/api/src/test-lint-fail.ts
   ```

2. Run lint:

   ```bash
   bun run lint
   ```

3. Expected output: Lint error reported for `test-lint-fail.ts`

4. Run the orchestrator:

   ```bash
   bun run ci:run-local
   ```

5. Expected output: Step 6 (`lint`) shows `FAIL` in the results table

6. Clean up:

   ```bash
   rm apps/api/src/test-lint-fail.ts
   bun run lint  # Verify clean
   ```

7. ✅ **Pass if:** Failures are detected and clearly reported

8. ❌ **Fail if:** Failures are silently ignored

---

### Scenario 6: Verify .act.secrets Gitignoring

**Intent:** Confirm sensitive credentials are not committed

**Steps:**

1. Check `.gitignore`:

   ```bash
   grep -A2 "^# act" .gitignore
   ```

2. Expected output:

   ```
   # act (local GitHub Actions runner)
   .act.secrets
   ```

3. Verify file is not tracked:

   ```bash
   git ls-files | grep -i ".act.secrets"
   # (empty output = success)
   ```

4. ✅ **Pass if:** `.act.secrets` is in `.gitignore` and not in git history

5. ❌ **Fail if:** `.act.secrets` is tracked in git

---

### Scenario 7: Validate Script Registration

**Intent:** Ensure all `ci:*` scripts are registered in `package.json`

**Steps:**

1. List available scripts:

   ```bash
   bun run  # Shows all registered scripts, filter to ci:*
   ```

2. Verify these keys exist:

   ```
   ci:local
   ci:local:full
   ci:local:workflow
   ci:local:list
   validate:scripts:broken
   ci:run-local
   ```

3. ✅ **Pass if:** All 6 scripts are listed and callable via `bun run`

4. ❌ **Fail if:** Any script is missing or non-functional

---

## Troubleshooting

### Issue: `GITHUB_TOKEN authentication required`

**Cause:** External GitHub Actions (e.g., `setup-bun`) need authentication when cloning via `act`

**Solution:**

1. Create `.act.secrets` file:

   ```bash
   echo "GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx" > .act.secrets
   # (Replace with a real token from https://github.com/settings/tokens)
   ```

2. Verify it's gitignored:

   ```bash
   git check-ignore .act.secrets  # Should return the path (means it's ignored)
   ```

3. Re-run:
   ```bash
   bun run ci:local
   ```

---

### Issue: Docker daemon not running

**Cause:** `act` requires Docker to execute workflows

**Solution:**

```bash
# Start Docker
open /Applications/Docker.app

# Verify connectivity
docker info  # Should show system info, not an error
```

---

### Issue: `act: command not found`

**Cause:** `act` not installed or not in PATH

**Solution:**

```bash
# Install
brew install act

# Verify
act --version
which act  # Should show /usr/local/bin/act (or similar)
```

---

## Integration with CI/CD

**Local CI is NOT a replacement for GitHub CI.**

It's a **fast feedback loop for developers before pushing.**

| Stage                    | Tool                      | Speed  | Scope                                      |
| ------------------------ | ------------------------- | ------ | ------------------------------------------ |
| **Local (your machine)** | `bun run ci:local`        | 30–60s | All workflows, limited concurrency         |
| **GitHub CI**            | `.github/workflows/*.yml` | 2–5m   | Matrix jobs, full orchestration, artifacts |

**Best Practice:**

1. Run `bun run ci:local` before `git push`
2. Fix issues locally
3. Push clean commits to GitHub CI

---

## Script Reference

| Script                    | Command                           | Purpose                        |
| ------------------------- | --------------------------------- | ------------------------------ |
| `ci:local`                | `act --pull=false`                | Run all workflows locally      |
| `ci:local:full`           | `act` (with pull)                 | Run with image updates         |
| `ci:local:workflow`       | `act -j <job>`                    | Run single workflow            |
| `ci:local:list`           | `act -l`                          | List workflows without running |
| `validate:scripts:broken` | `bun scripts/validate-scripts...` | Check script registration      |
| `ci:run-local`            | `bun scripts/run-local-ci.ts`     | 7-step orchestrator pipeline   |

---

## For CI/CD Teams

If you're integrating this into your pipeline:

1. **Local CI is optional** for developers
2. **GitHub CI remains authoritative** for merge gates
3. **No changes to `.github/workflows/`** are required
4. **Documentation** is available in `docs/ci/local-ci.md`

---

## Questions?

See `docs/ci/local-ci.md` for:

- Installation details
- Configuration reference
- Developer workflow patterns
- CI parity contract
- Troubleshooting (detailed)
