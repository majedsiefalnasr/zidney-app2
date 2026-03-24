# STAGE_FIX_02_POLICY_ENGINE_BOOTSTRAP_MINIMAL

## Stage Type

Infrastructure Fix Stage

## Status

DRAFT

---

## Objective

Bootstrap a **minimal Policy Engine** that enables execution of rule-based governance for Zidney.

This stage provides just enough infrastructure to:

- Execute rules
- Aggregate results
- Fail on errors

It is a **prerequisite** for:

```
STAGE_FIX_03_BUILD_TEST_AND_REPOSITORY_CLEANLINESS_ENFORCEMENT
```

---

## Scope (Strict)

### MUST Implement

1. `policy:check` command
2. Minimal rule interface
3. Rule registry
4. Basic runner
5. CLI modes (`--full`, `--changed`)

---

### MUST NOT Implement

- Scoring system
- Rule grouping / categories
- GitNexus integration
- CI integration
- Advanced reporting
- Caching
- Rule dependency graphs

This stage must remain **minimal and focused**.

---

## Architecture

### Directory Structure

```
scripts/policy-engine/
├── runner.ts
├── registry.ts
├── types.ts
```

---

## Core Interfaces

### types.ts

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

---

## Rule Registry

### registry.ts

```ts
import type { PolicyRule } from "./types";

export const rules: PolicyRule[] = [];
```

---

## Runner

### runner.ts

Responsibilities:

- Load rules from registry
- Execute sequentially
- Collect results
- Exit based on severity

```ts
import { rules } from "./registry";
import type { PolicyContext } from "./types";

async function run(mode: "full" | "changed") {
  const context: PolicyContext = { mode };

  const results = [];

  for (const rule of rules) {
    const result = await rule.run(context);
    results.push(result);
  }

  const hasError = results.some((r) => !r.success && r.severity === "error");

  if (hasError) {
    console.error("Policy check failed");
    process.exit(1);
  }

  console.log("Policy check passed");
}

const mode = process.argv.includes("--changed") ? "changed" : "full";

run(mode);
```

---

## CLI Command

### package.json

Add:

```json
"policy:check": "bun run scripts/policy-engine/runner.ts"
```

Usage:

```
bun run policy:check --full
bun run policy:check --changed
```

---

## Execution Behavior

- Rules run sequentially
- No parallel execution
- No dependency resolution
- No optimization

---

## Success Criteria

- `policy:check` executes without crashing
- Supports `--full` and `--changed`
- Can execute at least one dummy rule
- Proper exit codes:
  - `0` → success or warnings
  - `1` → any error rule fails

---

## Validation

Manual test:

```
bun run policy:check
```

Expected:

- Runs without errors
- Outputs result
- Exits correctly

---

## Constraints

- Total implementation should remain simple (< 200 LOC recommended)
- No external dependencies required
- Must be easy to extend in next stages

---

## Next Stage

```
STAGE_FIX_03_BUILD_TEST_AND_REPOSITORY_CLEANLINESS_ENFORCEMENT
```

This stage will:

- Implement real rules
- Enforce build/test/cleanliness
- Use this engine as execution core

---

## Notes

- This is NOT full INFRA-29 implementation
- This is a bootstrap layer only
- System will evolve in later stages

---

## Outcome

After completion:

- Zidney has a working policy execution engine
- Ready to enforce real governance rules
- Foundation for unified governance system

---
