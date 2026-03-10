# Developer Quickstart: Incremental Architecture Guard

**Stage:** STAGE_INFRA_11_INCREMENTAL_ARCHITECTURE_GUARD

---

## What Changed for You

**Nothing about your workflow changes.** You still commit code normally. Pre-commit validation still runs automatically. Architecture violations still block commits.

The difference: validation now completes in **<200ms** instead of 800–1000ms.

### Before vs. After

| Scenario                                  | Before                          | After                                     |
| ----------------------------------------- | ------------------------------- | ----------------------------------------- |
| Commit 1 file in `apps/mmc`               | ~900ms (all 13 modules scanned) | ~100ms (1–2 modules scanned)              |
| Commit changes to `packages/logger`       | ~900ms                          | ~200ms (logger + all dependents)          |
| Commit changes to `ARCHITECTURE_MAP.json` | ~900ms                          | ~900ms (full fallback — correct behavior) |
| No code files staged                      | ~900ms                          | 0ms (exits immediately)                   |

The pre-commit hook now passes staged files to the guard, which figures out what actually needs validating.

---

## Pre-Commit Integration (Automatic)

The `.husky/pre-commit` hook now calls:

```sh
STAGED_FILES="$STAGED_FILES" bun scripts/ai-guard.ts --incremental
```

This is completely automatic. You do not need to change anything.

**What happens step by step:**

1. Hook reads your staged files via `git diff --cached --name-only --diff-filter=ACM`
2. Guard maps those files to architecture modules (e.g. `apps/mmc/src/foo.vue` → `apps/mmc`)
3. Guard loads the cached dependency graph and finds all modules that depend on the changed ones
4. Guard validates only that expanded scope
5. If a violation is found → commit blocked with a clear error message
6. If everything is fine → commit proceeds

---

## Pre-Push Integration (Automatic)

The `.husky/pre-push` hook runs:

```sh
bun scripts/ai-guard.ts --full
```

This is a **full scan** — every module, every rule. This is intentional: before code leaves your machine, it gets the same comprehensive validation that CI runs. Pre-push is slower (<1000ms) but runs only once before push, not on every commit.

---

## How to Refresh the Dependency Graph

The incremental guard uses a cached graph to trace which modules depend on which. This cache lives at `docs/ai/context/ai-dependency-graph.json`.

**When does it refresh automatically?**

| Trigger                        | What happens                       |
| ------------------------------ | ---------------------------------- |
| Cache file missing             | Auto-regenerates before validation |
| Cache older than 24 hours      | Auto-regenerates before validation |
| `ARCHITECTURE_MAP.json` staged | Full fallback + auto-regenerates   |
| Schema version mismatch        | Auto-regenerates before validation |

**To refresh manually:**

```bash
bun scripts/infra-audit.ts --generate-graph
```

This is fast (<500ms). Use it after:

- Adding a new module to `ARCHITECTURE_MAP.json`
- Making significant changes to import structure across many modules
- Noticing that impact reports seem to miss expected dependents

---

## How to Force a Full Scan

```bash
bun scripts/ai-guard.ts --full
```

Scans all 13 modules. Same behavior as before this feature existed. Use when:

- You want to double-check after a major refactor
- The impact report shows an unexpected result and you want to confirm
- CI-equivalent validation locally

---

## How to Configure Cache TTL

The dependency graph is considered stale after 24 hours by default. To change this:

```bash
# Validate with a longer cache TTL (7 days)
ARCH_GRAPH_MAX_AGE_HOURS=168 bun scripts/ai-guard.ts --incremental

# Always force fresh graph (0 = always stale)
ARCH_GRAPH_MAX_AGE_HOURS=0 bun scripts/ai-guard.ts --incremental

# Set for current shell session
export ARCH_GRAPH_MAX_AGE_HOURS=48
```

Setting `ARCH_GRAPH_MAX_AGE_HOURS=0` causes the graph to regenerate on every incremental run — useful in CI-like environments where you want to guarantee freshness. Note: this adds ~500ms to every run.

---

## Debugging — Common Scenarios

### "Guard ran full scan even though I only changed one file"

This is expected in these situations:

1. **Graph was stale or missing** — First run after >24h, or after `git clean`. Graph auto-regenerates.
2. **`ARCHITECTURE_MAP.json` was staged** — Any change to the map triggers full validation (correct behavior).
3. **A new `apps/*` or `packages/*` directory was detected** — Module not registered in the map. Add it via `bun run arch:add-module <path>`.

Check the impact report to see the `fallback_reason`:

```bash
# Run an incremental check and look at the console output
bun scripts/ai-guard.ts --incremental

# Or check the stored report (if you ran in CI context)
cat docs/ai/context/architecture-impact-report.json | grep fallback_reason
```

### "Guard didn't catch a violation in a module I expected to be checked"

Verify the dependency graph includes the expected dependency:

```bash
cat docs/ai/context/ai-dependency-graph.json | grep -A5 '"reverse_dependencies"'
```

If the module is missing from `reverse_dependencies`, the graph is outdated. Regenerate:

```bash
bun scripts/infra-audit.ts --generate-graph
```

Then re-run the guard and check again.

### "I want to manually test the incremental guard against specific modules"

```bash
# Validate only apps/mmc and packages/ui-system
bun scripts/ai-guard.ts --incremental --modules apps/mmc,packages/ui-system
```

This bypasses staged-file detection and validates exactly the modules you specify.

### "How do I see the full impact report?"

Set `CI=true` to write the JSON report to disk:

```bash
CI=true STAGED_FILES="apps/mmc/src/foo.ts" bun scripts/ai-guard.ts --incremental
cat docs/ai/context/architecture-impact-report.json
```

### "I want to understand what the dependency graph looks like"

```bash
# Pretty-print the module list and edge count
bun -e "
const g = JSON.parse(require('fs').readFileSync('docs/ai/context/ai-dependency-graph.json', 'utf-8'));
console.log('Modules:', g.modules.length);
console.log('Edges:', g.edges.length);
console.log('Generated:', g.generated_at);
console.log('Reverse deps:', Object.entries(g.reverse_dependencies).map(([k,v]) => k + ' ← ' + v.join(', ')).join('\n'));
"
```

---

## Hook Behavior Summary

| Hook         | Command                                                  | Mode        | When it runs       |
| ------------ | -------------------------------------------------------- | ----------- | ------------------ |
| `pre-commit` | `STAGED_FILES=... bun scripts/ai-guard.ts --incremental` | Incremental | Every `git commit` |
| `pre-push`   | `bun scripts/ai-guard.ts --full`                         | Full        | Every `git push`   |
| CI           | `bun scripts/ai-guard.ts --full`                         | Full        | Every PR           |

---

## Invocation Reference

```bash
# Incremental — auto-detects staged files from STAGED_FILES env
STAGED_FILES="apps/mmc/src/foo.ts" bun scripts/ai-guard.ts --incremental

# Incremental — explicit module override (bypass staged-file detection)
bun scripts/ai-guard.ts --incremental --modules apps/mmc,packages/ui-system

# Full scan (explicit)
bun scripts/ai-guard.ts --full

# Full scan (legacy — no flags, backward compatible)
bun scripts/ai-guard.ts

# Generate/refresh dependency graph only
bun scripts/infra-audit.ts --generate-graph

# Run full infra audit (also regenerates graph as side effect)
bun scripts/infra-audit.ts
```

---

## Environment Variables

| Variable                   | Default   | Description                                                                                 |
| -------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| `STAGED_FILES`             | _(empty)_ | Newline-separated file paths. Set by the pre-commit hook. Empty = no staged files = exit 0. |
| `ARCH_GRAPH_MAX_AGE_HOURS` | `24`      | Hours before the dependency graph is considered stale.                                      |
| `CI`                       | _(unset)_ | Set to `"true"` in GitHub Actions. When set, impact report is written to disk.              |
