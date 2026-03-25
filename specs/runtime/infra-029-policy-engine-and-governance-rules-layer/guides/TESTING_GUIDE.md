# Testing Guide — Policy Engine and Governance Rules Layer

**Stage:** INFRA-29  
**Purpose:** Help future developers test, debug, and extend the policy engine  
**Created:** 2026-03-26

---

## Quick Reference

### Running Tests

```bash
# All policy-engine tests
bun run test 2>&1 | grep "policy-engine"

# Full test suite (includes policy-engine scope)
bun run test

# Specific test file
rtk vitest run tests/unit/policy-engine/engine.test.ts

# Watch mode (rerun on change)
bun run vitest --watch tests/unit/policy-engine/

# With coverage
bun run vitest --coverage tests/unit/policy-engine/

# Gate tests only
rtk vitest run \
  tests/unit/policy-engine/engine.test.ts \
  tests/integration/policy-engine/cli-exit-codes.test.ts \
  tests/unit/policy-engine/registry-coverage.test.ts
```

### Running the CLI

```bash
# Full mode (all files)
bun run policy:check --full

# Changed mode (staged/modified files)
bun run policy:check --changed

# Console reporter (default)
bun run policy:check --full --reporter=console

# JSON reporter
bun run policy:check --full --reporter=json | jq .

# Check exit code
bun run policy:check --full; echo "Exit code: $?"
```

---

## Test Anatomy

### Unit Tests: Rule Files

**Location:** `tests/unit/policy-engine/rules/RULE-NAME.test.ts`

**Pattern:**

```typescript
// Setup: beforeAll imports rule and registers it
beforeAll(async () => {
  _resetRegistryForTesting();
  await import("../../../../scripts/policy-engine/rules/...");
});

// Cleanup: afterAll resets for other test files
afterAll(() => {
  _resetRegistryForTesting();
});

// Test: getRule and invoke evaluate()
it("detects violation", async () => {
  const rules = getRules();
  const rule = rules.find((r) => r.id === "RULE-ID")!;
  const context = makeContext({
    /* test data */
  });

  const results = await rule.evaluate(context);

  expect(results).toHaveLength(1);
  expect(results[0].severity).toBe("error");
});
```

**Key Points:**

- Use `beforeAll` (not `beforeEach`) so the module import runs once per test file
- Call `_resetRegistryForTesting()` in `beforeAll` to ensure clean state
- Always use `const rule = rules.find(...)!` with non-null assertion
- Test both happy path and violation cases
- Mock adapters with `vi.mock()` for rules that delegate to adapters

### Unit Tests: Adapters

**Location:** `tests/unit/policy-engine/adapters/ADAPTER-NAME.adapter.test.ts`

**Pattern:**

```typescript
// Mock the subprocess/file I/O
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => /* mock stream */),
}))

it('parses adapter output', async () => {
  const result = await runAdapter(mockContext)

  expect(result).toHaveLength(1)
  expect(result[0].ruleId).toBe('RULE-ID')
})
```

**Key Points:**

- Mock `Bun.spawn` or file I/O to avoid subprocess execution
- Test JSON parsing logic in isolation
- Verify error handling (spawn crashes, invalid JSON, etc.)
- Adapters should never throw; return error results instead

### Integration Tests: CLI

**Location:** `tests/integration/policy-engine/cli-*.test.ts`

**Pattern:**

```typescript
it("exit code is 0 for clean repo", async () => {
  const cliPath = path.resolve(import.meta.dirname, "../../../scripts/policy-engine/cli.ts");
  expect(fs.existsSync(cliPath)).toBe(true);
});
```

**Key Points:**

- Use `import.meta.dirname` for Node.js compatibility
- Test CLI entry point (`cli.ts`) without subprocess
- Verify file existence and basic structure
- Integration tests should be lightweight (no actual subprocess execution)

### Gate Tests

**Location:** `tests/unit/policy-engine/GATE-NAME.test.ts`

| Gate   | Test File                                   | Purpose                    |
| ------ | ------------------------------------------- | -------------------------- |
| Gate 1 | `parity/*.test.ts`                          | Adapter output consistency |
| Gate 2 | `determinism.test.ts`                       | JSON output byte-identical |
| Gate 3 | `registry-coverage.test.ts`                 | All domains have rules     |
| Gate 4 | `static/no-direct-governance-calls.test.ts` | No bypass calls            |

---

## Debugging Failed Tests

### "Cannot read properties of undefined (reading 'evaluate')"

**Cause:** Rule not registered at test time.

**Fix:**

```typescript
// ✅ CORRECT: beforeAll, not beforeEach
beforeAll(async () => {
  _resetRegistryForTesting()
  await import('../../../../scripts/policy-engine/rules/...')
})

// ❌ WRONG: beforeEach causes ES module cache issue
beforeEach(async () => {
  _resetRegistryForTesting()
  await import(...) // Module already loaded, registerRule() doesn't run again
})
```

### "import.meta.dir is undefined"

**Cause:** Using Bun-only API in Vitest (Node.js runtime).

**Fix:**

```typescript
// ❌ WRONG: Bun-only
const dir = import.meta.dir;

// ✅ CORRECT: Node.js compatible (21.2+)
const dir = import.meta.dirname;

// ✅ ALSO WORKS: fileURLToPath fallback
const dir = path.dirname(fileURLToPath(import.meta.url));
```

### "Expected X but got Y violations"

**Debugging:**

```typescript
it("detects violations", async () => {
  const results = await rule.evaluate(context);

  // Debug: print actual results
  console.log("Actual results:", JSON.stringify(results, null, 2));

  expect(results).toHaveLength(1);
});
```

Run with: `rtk vitest run FILE.test.ts --reporter=verbose`

---

## Extending the Policy Engine

### Adding a New Rule

1. **Create rule file** at `scripts/policy-engine/rules/DOMAIN/RULE-ID.rule.ts`:

```typescript
import { registerRule } from "../../registry";
import type { PolicyContext, PolicyResult } from "../../types";

registerRule({
  id: "DOMAIN-001",
  domain: "DOMAIN",
  description: "Detects...",
  severity: "warning",
  sequential: false,
  async evaluate(context: PolicyContext): Promise<PolicyResult[]> {
    // Check context for violations
    // Return PolicyResult[] array
    return [];
  },
});
```

2. **Add test file** at `tests/unit/policy-engine/rules/DOMAIN-001.test.ts`:

```typescript
describe("DOMAIN-001 rule", () => {
  beforeAll(async () => {
    _resetRegistryForTesting();
    await import("../../../../../scripts/policy-engine/rules/domain/DOMAIN-001.rule");
  });

  it("registers the rule", () => {
    const rules = getRules();
    expect(rules.some((r) => r.id === "DOMAIN-001")).toBe(true);
  });

  it("detects violation", async () => {
    // Test implementation
  });
});
```

3. **Update data-model.md**: Add new `PolicyDomain` union value if needed.

4. **Update type.ts** if new context fields are needed.

5. **Run tests:** `rtk vitest run tests/unit/policy-engine/rules/DOMAIN-001.test.ts`

### Adding a New Adapter

1. **Create adapter file** at `scripts/policy-engine/adapters/NEW-TOOL.adapter.ts`:

```typescript
import type { PolicyContext, PolicyResult } from "../types";

export async function runNewTool(context: PolicyContext): Promise<PolicyResult[]> {
  try {
    // Spawn subprocess or read files
    // Parse output
    // Map to PolicyResult[]
    return results;
  } catch (error) {
    return [
      {
        ruleId: "RULE-ID",
        domain: "DOMAIN",
        severity: "error",
        message: "Adapter failed: ...",
      },
    ];
  }
}
```

2. **Mock in tests:** Use `vi.mock()` to avoid subprocess execution.

3. **Verify parity:** Add parity test to `tests/unit/policy-engine/parity/new-tool-parity.test.ts`.

### Modifying Context Loading

Edit `scripts/policy-engine/context/loader.ts`:

```typescript
export async function loadContext(
  mode: 'changed' | 'full',
  timeout: number
): Promise<ContextLoadResult> {
  // Add new context field here
  return {
    mode,
    timeout,
    changedFiles: [...],
    dependencyGraph: {...},
    scripts: {...},
    newField: [...], // ← Add here
  }
}
```

---

## Performance Testing

### Baseline Metrics

```bash
# Full mode: typical repo (200+ files)
$ time bun run policy:check --full
real 3.2s

# Changed mode: typical commit (5 files)
$ time bun run policy:check --changed
real 1.1s
```

### Profiling a Specific Rule

```typescript
// In test file
it("RULE-ID performance", async () => {
  const start = Date.now();

  for (let i = 0; i < 100; i++) {
    await rule.evaluate(context);
  }

  const elapsed = Date.now() - start;
  console.log(`Average: ${elapsed / 100}ms`);

  // Assert SLA
  expect(elapsed / 100).toBeLessThan(50); // ← Adjust per rule
});
```

---

## Continuous Integration

### Pre-Commit Hook

The policy engine is integrated into Husky pre-commit checks:

```bash
# Runs automatically on `git commit`
bun run policy:check --changed

# Manual trigger
bun run precommit:check
```

### GitHub Actions

CI runs policy engine on PR:

```yaml
- name: Governance Checks
  run: bun run policy:check --full
```

---

## Common Workflows

### Adding a New Governance Rule to an Existing Domain

1. Implement rule in `scripts/policy-engine/rules/DOMAIN/RULE-ID.rule.ts`
2. Import and register (auto via side-effect)
3. Add unit tests
4. Gate 3 (registry-coverage) will auto-detect new rule
5. Commit and PR

### Updating an Adapter (e.g., arch:guard output changed)

1. Modify `scripts/policy-engine/adapters/ADAPTER.ts` parser logic
2. Update corresponding test mock output
3. Run parity test: `rtk vitest run tests/unit/policy-engine/parity/ADAPTER-parity.test.ts`
4. If parity fails, align rule expectations or adapter parser
5. Commit

### Debugging a CLI Failure

```bash
# Check exit code
bun run policy:check --full
echo $?

# See what violations were detected
bun run policy:check --full --reporter=json | jq '.[] | {id: .ruleId, severity}'

# Run specific rule test
rtk vitest run tests/unit/policy-engine/rules/RULE-ID.test.ts -t "violation name"
```

---

## Architecture Notes

- **No database**, no network calls, no external APIs (except subprocesses via adapters)
- **Registry singleton**: All rules auto-register at module load time via side-effect imports in `cli.ts`
- **Adapter layer**: Single integration point for legacy tools; all violations flow through PolicyResult
- **Pure functions**: Rules are pure functions of context; no side effects except logging
- **Error handling**: Adapters never throw; they return error PolicyResults instead
- **Timeout safety**: Engine wraps rule execution with AbortController and timeout machinery

---

## References

- [Policy Engine Plan](../plan.md) — Architecture & design rationale
- [Spec](../spec.md) — User stories and requirements
- [Data Model](../data-model.md) — TypeScript interfaces
- [Implementation Report](../reports/IMPLEMENT_REPORT.md) — What was built
