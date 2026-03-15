# Research Report — STAGE_INFRA_19_AI_AGENT_RUNTIME_ENVIRONMENT

**Prepared by:** speckit.plan  
**Date:** 2026-03-15  
**Stage:** INFRA_19  
**Phase:** 01_PLATFORM_FOUNDATION

---

## 1. Spec Summary

`spec.md` defines a **developer tooling stage** introducing a 5-layer AI Agent Runtime Environment.
The deliverable is:

- `scripts/ai-runtime/runtime-status.ts` — new diagnostics script
- 3 new `package.json` script entries (`ai-runtime:status`, `ai-runtime:refresh`, `ai-runtime:validate`)
- One additional CI step in the `arch-guard` job of `.github/workflows/ci.yml`

All five clarification questions from the 2026-03-15 `speckit.clarify` scan are self-resolved and
recorded in `spec.md § Clarifications`. No human escalation is required.

---

## 2. Existing Script Patterns

### `scripts/generate-ai-context.ts`

- Entry point delegates to sub-module helpers in `scripts/ai-context/`
- Uses `import.meta.main` guard for CLI entry
- Exports `main()` for testability
- Uses `console.log` (acceptable in `generate-ai-context.ts` per its own context)
- Defines `REPO_ROOT = process.cwd()`
- Uses `join` from `node:path`

### `scripts/ai-guard.ts`

- Imports `existsSync`, `readdirSync`, `readFileSync` from `node:fs`
- Exports individual pure validation functions (e.g. `detectModule`, `extractImports`,
  `validateArchitectureMap`) — this is the **key testability pattern** to replicate
- Uses `import.meta.main` guard
- Does NOT use `console.log` directly for primary output (uses structured formatter functions)

### `scripts/infra-audit.ts` (first 80 lines)

- Imports from `node:fs`: `existsSync`, `mkdirSync`, `readdirSync`, `readFileSync`, `statSync`,
  `writeFileSync`
- Imports `basename`, `join`, `relative` from `node:path`
- Defines constants: `ROOT = process.cwd()`, path constants using `join(ROOT, ...)`
- QUICK_MODE flag from `process.argv`
- Loads architecture map via `loadArchitectureMap()` helper using `existsSync` + `JSON.parse`

### `scripts/dev/repo-status.ts`

- Output mechanism: **`process.stdout.write` only** — `console.log` is banned
- Uses `section()` formatter from sibling `./formatter` module
- Uses `Bun.spawnSync()` for subprocess execution
- Exports each check function (`checkAiContext`, `checkArchHealth`, `checkTypeScript`,
  `readCiStatus`, `safeStatus`) for unit testability
- Uses `COL_WIDTH = 23` for padded column alignment
- Status symbols: `'✔'` and `'✗'`

---

## 3. `package.json` — Existing Script Names (relevant)

```
"arch:validate-brain": "bun scripts/governance/validate-architecture-brain.ts"
"ai-context:refresh":  "bun scripts/generate-ai-context.ts --force"
"arch:guard":          "bun scripts/architecture-guard/architecture-guard.ts"
"arch:guard:ci":       "bun scripts/architecture-guard/architecture-guard.ts --ci"
"repo:status":         "bun scripts/dev/repo-status.ts"
```

There are **no existing `ai-runtime:*` script entries** — the 3 new entries are additive-only.

Delegation targets already confirmed present in `package.json`:

- `ai-runtime:refresh` → delegates to `bun ai-context:refresh` ✓
- `ai-runtime:validate` → delegates to `bun arch:validate-brain` ✓
- `ai-runtime:status` → `bun scripts/ai-runtime/runtime-status.ts` (new file)

---

## 4. CI Workflow — `arch-guard` Job Structure

File: `.github/workflows/ci.yml`

The `arch-guard` job (Job 3, Group 1) has the following step sequence:

```
1. Checkout
2. Setup Bun
3. Restore node_modules from cache
4. Install dependencies
5. Restore ai-context artifacts cache (T086)
6. module-boundary-validation          ← bun run arch:guard
7. Save ai-context artifacts cache (T087)
```

Per clarification Q2 (self-resolved), the new `AI Runtime Validation` step is placed between step 6
(`module-boundary-validation`) and step 7 (`Save ai-context artifacts cache`). This reuses the
already-restored `docs/ai/context/` artifact cache without duplicating cache actions or job setup.

The `arch-guard` job runs in **Group 1 (parallel, 0–5 min)** alongside `lint`, `typecheck`, and
`repo-doctor`. The `unit-tests` and `integration-tests` jobs in Group 2 depend on `lint` and
`typecheck` — not on `arch-guard` — so adding this step does not extend the Group 2 critical path.

---

## 5. Confirmed Existing AI Context Artifacts

All artifacts in `docs/ai/context/` confirmed present on 2026-03-15:

| Artifact                     | Status    | Required for error-level check? |
| ---------------------------- | --------- | ------------------------------- |
| `ai-context-mini.json`       | ✔ present | YES (+ freshness warning check) |
| `ai-architecture-brain.json` | ✔ present | YES                             |
| `ai-module-map.json`         | ✔ present | YES                             |
| `ai-layer-model.json`        | ✔ present | YES                             |
| `ai-runtime-map.json`        | ✔ present | YES                             |
| `ai-dependency-graph.json`   | ✔ present | YES                             |
| `ai-architecture-diff.json`  | ✔ present | NO (supplementary)              |
| `ai-runtime-dependents.json` | ✔ present | NO (supplementary)              |
| `ai-architecture-summary.md` | ✔ present | NO (supplementary)              |

Per clarification Q3: Only the 6-item list is error-level. The 3 supplementary artifacts are
intentionally excluded from error gating.

---

## 6. `ai-architecture-brain.json` Structure

Top-level keys (from first 30 lines):

```json
{
  "schema_version": "1.0.0",
  "generated_at": "...",
  "metadata": {
    "total_modules": 14,
    "total_violations": 0,
    "generation_time_ms": 0,
    "source_hash": "...",
    "source_timestamp": "...",
    "generator_version": "..."
  },
  "layers": [ ... ]
}
```

Parsability check: `JSON.parse(readFileSync(..., 'utf-8'))` — must not throw, result must be
non-null object with at least one key.

Edge validity check: brain may contain a `dependencyGraph.edges` array (from full brain contents).
Sample the edges for relative-path entries (starting with `./` or containing `src/` beyond module
root) — report as warning if any violations found.

---

## 7. Confirmed Existing Governance Scripts

All 5 scripts required by the Deterministic Execution check confirmed present:

| Script                                              | Status    |
| --------------------------------------------------- | --------- |
| `scripts/ai-guard.ts`                               | ✔ present |
| `scripts/infra-audit.ts`                            | ✔ present |
| `scripts/governance/validate-architecture-brain.ts` | ✔ present |
| `scripts/architecture-guard/architecture-guard.ts`  | ✔ present |
| `scripts/type-safety-guard.ts`                      | ✔ present |

---

## 8. Confirmed Existing Skill Directories

All 7 core skill directories under `.agents/skills/` confirmed present:

| Skill Directory              | Status    |
| ---------------------------- | --------- |
| `architecture-intelligence/` | ✔ present |
| `architecture-self-healing/` | ✔ present |
| `analysis-retry-engine/`     | ✔ present |
| `subagent-parallelization/`  | ✔ present |
| `terminal-safety/`           | ✔ present |
| `rtk-execution-layer/`       | ✔ present |
| `mcp-routing/`               | ✔ present |

Each skill directory must contain a `SKILL.md` file — confirmed by spec and existing knowledge.

---

## 9. Docs Artifacts

| File                               | Status    |
| ---------------------------------- | --------- |
| `docs/ai/AI_BOOTSTRAP.md`          | ✔ present |
| `docs/ai/AI_CONTEXT_INDEX.md`      | ✔ present |
| `docs/ai/MCP_ACTIVATION_MATRIX.md` | ✔ present |

---

## 10. Existing Test Patterns

### Unit Test Pattern (`tests/unit/ai-guard/ai-guard-validation.test.ts`)

```typescript
import { describe, expect, it } from "vitest";
import {} from /* exported pure functions */ "../../../scripts/...";
```

- Mocks `node:fs` via `vi.mock('node:fs', async () => {...})`
- Tests each exported function in isolation (no process spawning)
- Uses fixture files in `tests/unit/<domain>/fixtures/`

### Integration Test Pattern (`tests/integration/ai-context-integration.test.ts`)

```typescript
import { beforeAll, describe, expect, it } from "vitest";
import { generateAllArtifacts } from "../../scripts/ai-context/artifact-generator";
```

- Calls actual script functions against real filesystem
- Uses `beforeAll` for setup/cleanup
- Asserts outcomes (exit codes, file existence, content structure)

### Dev Script Unit Tests (`tests/unit/dev-scripts/repo-status.test.ts`)

- Mocks `node:fs` selectively via `vi.mock`
- Exports individual check functions from the script for isolated testing
- Mocks `Bun.spawnSync` via a helper `makeBunMock()`
- Captures `process.stdout.write` output to validate formatting

---

## 11. `scripts/ai-runtime/` Directory

**Status: NOT EXISTS** — to be created as part of T001.

---

## 12. Architecture Impact (Confirmed Low Risk)

- No `packages/` modifications
- No `apps/` modifications
- No existing governance scripts modified
- Only additive changes: new file + 3 script entries + 1 CI step
- Risk Level: **LOW** per spec's own assessment

---

## 13. Clarifications Summary (All Self-Resolved)

| Q   | Topic                            | Resolution                                                   |
| --- | -------------------------------- | ------------------------------------------------------------ |
| Q1  | Which CI workflow file?          | `ci.yml` — runs on all branches                              |
| Q2  | New job or step in arch-guard?   | Step within `arch-guard` after `arch:guard`                  |
| Q3  | 6 vs 8 artifact check list?      | 6-item list is error-level; 3 are supplementary              |
| Q4  | `arch:validate-brain` CI prereq? | No — conceptual ordering only; not a dep                     |
| Q5  | Test file locations?             | `tests/unit/ai-runtime/` and `tests/integration/ai-runtime/` |
