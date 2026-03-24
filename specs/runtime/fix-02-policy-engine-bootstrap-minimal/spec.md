# Spec: Policy Engine Bootstrap Minimal

## Stage

fix-02-policy-engine-bootstrap-minimal

## Phase

0X_FIXES

## Objective

Bootstrap a minimal, self-contained Policy Engine within the `scripts/` directory that can load a registry of typed rules, execute them sequentially, and exit with the appropriate status code. This stage provides the foundational infrastructure required by subsequent fix stages to enforce governance rules programmatically.

## Background

Zidney's governance pipeline currently lacks a mechanism to run rule-based checks programmatically and fail CI or local validation when violations are detected. Several upcoming fix stages (beginning with `STAGE_FIX_03`) depend on being able to define, register, and run policy rules. This stage bootstraps that capability with the minimum viable implementation — no scoring, no categories, no external dependencies — so that the runner and interfaces exist and are stable before any rules are authored.

## Scope

### In Scope

- `policy:check` script entry in the root `package.json`
- `scripts/policy-engine/types.ts` — `PolicyContext`, `PolicyResult`, and `PolicyRule` TypeScript interfaces
- `scripts/policy-engine/registry.ts` — exported `rules: PolicyRule[]` array (initially empty or containing one dummy rule)
- `scripts/policy-engine/runner.ts` — sequential rule executor that reads CLI args, runs all registered rules, and exits with the correct code
- CLI mode support: `--full` (default) and `--changed`
- At least one dummy rule to verify execution end-to-end
- Console output: "Policy check passed" on success, "Policy check failed" on error

### Out of Scope

- Scoring or weighted rule evaluation
- Rule grouping or category tagging
- GitNexus MCP integration
- CI pipeline integration
- Advanced or machine-readable reporting (JSON output, structured logs)
- Result caching or incremental execution
- Rule dependency graphs or ordering constraints
- Parallel rule execution
- Any new npm/pnpm workspace packages
- Database schema changes
- Any modification to tenant isolation or license middleware logic

## Functional Requirements

1. The root `package.json` must define a `policy:check` script that invokes `bun run scripts/policy-engine/runner.ts`.
2. `scripts/policy-engine/types.ts` must export the `PolicyContext`, `PolicyResult`, and `PolicyRule` interfaces with the exact shape defined in the Technical Design section.
3. `scripts/policy-engine/registry.ts` must export a `rules` array typed as `PolicyRule[]`.
4. `scripts/policy-engine/registry.ts` must contain at least one dummy rule so initial execution has a rule to process.
5. `scripts/policy-engine/runner.ts` must parse the CLI argument `--changed`; if present, `context.mode` is `"changed"`, otherwise `"full"`.
6. `runner.ts` must execute all rules in the registry sequentially (one at a time, awaited).
7. `runner.ts` must collect all `PolicyResult` objects from executed rules.
8. `runner.ts` must exit with code `1` if any result has `success: false` and `severity: "error"`.
9. `runner.ts` must exit with code `0` if all results succeed or if failures are `severity: "warning"` only.
10. `runner.ts` must print `"Policy check passed"` to stdout on exit code `0`.
11. `runner.ts` must print `"Policy check failed"` to stderr on exit code `1`.
12. The dummy rule must return `{ ruleId: "dummy", success: true, severity: "warning" }` so that a clean registry always exits `0`.

## Non-Functional Requirements

- Total implementation across all three files must not exceed 200 lines of code.
- No external package dependencies may be added (no new entries in any `package.json` `dependencies` or `devDependencies`).
- All code must be TypeScript-strict–compatible (no implicit `any`, no type assertions without justification).
- The implementation must be easy to extend: adding a new rule requires only creating a rule object and pushing it into the `rules` array in `registry.ts`.
- Sequential execution is mandatory; no concurrency mechanisms.
- The runner must not import from `apps/*` or `packages/*`.

## Technical Design

### Directory Structure

```
scripts/policy-engine/
├── types.ts       # Shared TypeScript interfaces
├── registry.ts    # Rule registry (source of rules for the runner)
└── runner.ts      # CLI entry point and execution engine
```

### Interfaces

**`scripts/policy-engine/types.ts`**

```ts
export interface PolicyContext {
  mode: "full" | "changed";
}

export interface PolicyResult {
  ruleId: string;
  success: boolean;
  severity: "error" | "warning";
  message?: string;
}

export interface PolicyRule {
  id: string;
  run(context: PolicyContext): Promise<PolicyResult>;
}
```

### Implementation Notes

**`scripts/policy-engine/registry.ts`**

- Imports `PolicyRule` type from `./types`.
- Exports a mutable `rules: PolicyRule[]` array.
- Must contain at least one rule (the dummy rule) at initial implementation.

```ts
import type { PolicyRule } from "./types";

const dummyRule: PolicyRule = {
  id: "dummy",
  async run(_ctx) {
    return { ruleId: "dummy", success: true, severity: "warning" };
  },
};

export const rules: PolicyRule[] = [dummyRule];
```

**`scripts/policy-engine/runner.ts`**

- Imports `rules` from `./registry` and `PolicyContext` type from `./types`.
- Parses `process.argv` for `--changed` to set mode.
- Runs all rules sequentially using `for...of` with `await`.
- Determines exit code from collected results.
- Prints outcome message before calling `process.exit`.

Key behaviors:

- Execution is sequential, not concurrent (`Promise.all` is forbidden here).
- A single `error`-severity failure triggers exit code `1`; warnings are non-fatal.
- No rule result is swallowed silently — all results are collected before evaluating the exit condition.

## Package.json Integration

Add to the root `package.json` `scripts` section:

```json
"policy:check": "bun run scripts/policy-engine/runner.ts"
```

Usage:

```sh
# Full mode (default)
bun run policy:check
bun run policy:check --full

# Changed-files mode
bun run policy:check --changed
```

## Success Criteria

1. `bun run policy:check` executes without crashing and exits with code `0`.
2. `bun run policy:check --changed` executes without crashing and exits with code `0`.
3. Console output includes `"Policy check passed"` on successful runs.
4. A rule that returns `{ success: false, severity: "error" }` causes exit code `1` and prints `"Policy check failed"`.
5. A rule that returns `{ success: false, severity: "warning" }` allows exit code `0`.
6. Removing all rules from the registry still allows the runner to execute (empty loop, exits `0`).
7. Total LOC across all three files does not exceed 200.

## Constraints

- **LOC limit:** Total implementation ≤ 200 lines across `types.ts`, `registry.ts`, and `runner.ts`.
- **No new dependencies:** Zero new entries in any workspace `package.json`.
- **No import boundary violations:** `scripts/policy-engine/` must not import from `apps/*` or `packages/*`.
- **No workspace additions:** This stage does not create new pnpm workspace packages.
- **No DB or tenant changes:** No migrations, no tenant isolation modifications.
- **Scope freeze:** Features listed in Out of Scope may not be partially implemented as "preparation" — they must not exist in this stage's diff.

## Dependencies

### This stage depends on

- Bun runtime available in the repository (already established).
- Root `package.json` accessible for script addition.

### Blocked by this stage (must complete first)

- `STAGE_FIX_03_BUILD_TEST_AND_REPOSITORY_CLEANLINESS_ENFORCEMENT` — requires `policy:check` to be runnable before it can register cleanliness rules.
