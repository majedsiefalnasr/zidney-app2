# Plan: Policy Engine Bootstrap Minimal

## Stage

fix-02-policy-engine-bootstrap-minimal

## Phase

0X_FIXES

---

## 1. Overview

This stage bootstraps a minimal, self-contained Policy Engine under `scripts/policy-engine/`. It provides the typed interfaces, rule registry, and sequential runner that subsequent fix stages (starting with `STAGE_FIX_03`) will depend on to register and enforce governance rules programmatically.

The implementation is intentionally minimal: no scoring, no categories, no external dependencies, no CI wiring. The sole goal is to have a stable, runnable `bun run policy:check` that:

- Loads a typed list of rules from a registry
- Executes them sequentially
- Exits `0` on pass, `1` on any `error`-severity failure
- Prints per-rule and summary feedback to stdout/stderr

---

## 2. Files Changed

| File                                | Action     | Notes                                       |
| ----------------------------------- | ---------- | ------------------------------------------- |
| `scripts/policy-engine/types.ts`    | **CREATE** | Shared TypeScript interfaces                |
| `scripts/policy-engine/registry.ts` | **CREATE** | Rule registry with one dummy rule           |
| `scripts/policy-engine/runner.ts`   | **CREATE** | CLI entry point and sequential executor     |
| `package.json` (root)               | **MODIFY** | Add `"policy:check"` script — additive only |

No other files are created or modified.

---

## 3. Implementation Design

### 3.1 `scripts/policy-engine/types.ts`

Create with exactly the following content:

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

No imports. No runtime code. Pure interface declarations.

---

### 3.2 `scripts/policy-engine/registry.ts`

Create with exactly the following content:

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

The `rules` array is exported as a mutable `PolicyRule[]`. Future stages add rules by importing this array and pushing into it, or by adding new rule objects before the export.

---

### 3.3 `scripts/policy-engine/runner.ts`

Full design (pseudocode + behavioral spec):

```
import { rules } from "./registry"
import type { PolicyContext, PolicyResult } from "./types"

// 1. Parse CLI args
const mode = process.argv.includes("--changed") ? "changed" : "full"
const context: PolicyContext = { mode }

// 2. Handle empty registry early
if (rules.length === 0) {
  console.log("Policy check passed — no rules registered")
  process.exit(0)
}

// 3. Sequential execution — for...of with await (NO Promise.all)
const results: PolicyResult[] = []
for (const rule of rules) {
  const result = await rule.run(context)
  results.push(result)
  // Per-rule output
  if (result.success) {
    console.log(`[PASS] ${result.ruleId}`)
  } else {
    console.log(`[FAIL] ${result.ruleId}${result.message ? ": " + result.message : ""}`)
  }
}

// 4. Determine exit condition
const hasFatalFailure = results.some(r => !r.success && r.severity === "error")

if (hasFatalFailure) {
  console.error("Policy check failed")
  process.exit(1)
} else {
  console.log("Policy check passed")
  process.exit(0)
}
```

Behavioral rules:

- `--full` and no flag both produce `mode: "full"` — `--full` is accepted implicitly (no arg check needed since absence of `--changed` defaults to full).
- All results are collected before the exit condition is evaluated — no early abort mid-loop.
- `[FAIL]` lines print to stdout (not stderr) so output can be captured and piped; only the final failure summary goes to stderr.
- `process.exit` is called explicitly — do not rely on natural script termination.

---

### 3.4 Root `package.json` Change

In the `scripts` section, add one entry (additive, no existing scripts removed or modified):

```json
"policy:check": "bun run scripts/policy-engine/runner.ts"
```

The surrounding `scripts` block is otherwise unchanged.

---

## 4. Constraints Summary

| Constraint               | Requirement                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| New npm/bun dependencies | **Zero** — no new entries in any `dependencies` or `devDependencies`                                            |
| Import boundaries        | `scripts/policy-engine/` must NOT import from `apps/*` or `packages/*`                                          |
| Concurrency              | `Promise.all` is **forbidden** — sequential `for...of await` only                                               |
| TypeScript               | Strict-compatible: no implicit `any`, no unjustified type assertions                                            |
| LOC budget               | ≤ 200 lines total across `types.ts` + `registry.ts` + `runner.ts`                                               |
| Scope freeze             | No scoring, categories, CI wiring, JSON output, or GitNexus integration                                         |
| DB / tenant              | No migrations, no tenant isolation changes                                                                      |
| New workspace packages   | None                                                                                                            |
| tsconfig coverage        | `scripts/` is excluded from root tsconfig — bun transpiles natively; no separate `scripts/tsconfig.json` needed |

---

## 5. Testing Strategy

Manual verification steps after implementation:

| Test                     | Command                                                                                          | Expected                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Default run              | `bun run policy:check`                                                                           | Exit 0; prints `[PASS] dummy` then `Policy check passed`               |
| Changed mode             | `bun run policy:check --changed`                                                                 | Exit 0; same output                                                    |
| Full mode explicit       | `bun run policy:check --full`                                                                    | Exit 0; same output (treated as default)                               |
| Empty registry           | Remove `dummyRule` from `registry.ts`, run `bun run policy:check`                                | Exit 0; prints `Policy check passed — no rules registered`             |
| Error-severity failure   | Add rule returning `{ ruleId: "test", success: false, severity: "error", message: "boom" }`, run | Exit 1; prints `[FAIL] test: boom` and `Policy check failed` to stderr |
| Warning-severity failure | Add rule returning `{ ruleId: "test", success: false, severity: "warning" }`, run                | Exit 0; prints `[FAIL] test` and `Policy check passed`                 |
| LOC budget               | `wc -l scripts/policy-engine/*.ts`                                                               | Total ≤ 200 lines                                                      |

---

## 6. Risk Assessment

**Risk Level: LOW**

| Risk                              | Likelihood                    | Mitigation                                                                       |
| --------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| `package.json` merge conflict     | Very low                      | Change is additive; no existing `policy`-prefixed scripts                        |
| TypeScript type errors at runtime | Very low                      | All types are explicit; bun enforces strict transpilation                        |
| Import boundary violation         | None if instructions followed | `types` and `registry` have no external workspace imports                        |
| LOC budget exceeded               | Very low                      | Three files are each intentionally minimal; dummy pattern keeps registry trivial |
| Breaking existing scripts         | None                          | Root `package.json` change is purely additive                                    |

No migration risk. No DB risk. No auth risk. No multi-tenant logic involved.

---

## 7. Skipped Artifacts

The following optional plan artifacts were evaluated and intentionally skipped:

| Artifact        | Reason skipped                                                |
| --------------- | ------------------------------------------------------------- |
| `research.md`   | Spec is fully clarified — no open questions                   |
| `data-model.md` | No database schema changes                                    |
| `contracts/`    | No external API surface; this is a CLI script                 |
| `quickstart.md` | Single-script feature; usage documented in spec and this plan |
