# Implementation Plan — Policy Engine and Governance Rules Layer

**Stage**: INFRA-29
**Phase**: 01_PLATFORM_FOUNDATION
**Feature Branch**: `spec/infra-029-policy-engine-and-governance-rules-layer`
**Spec**: `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/spec.md`
**Data Model**: `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/data-model.md`
**Risk Level**: MEDIUM
**Created**: 2026-03-25

---

## 1. Architecture Overview

The Policy Engine is a compile-time-registered, runtime-executed governance layer that unifies all authority checks in the Zidney monorepo under a single CLI entry point (`bun run policy:check`). It lives entirely under `scripts/policy-engine/` — no business logic, no framework dependencies, no `apps/*` imports.

```
┌──────────────────────────────────────────────────────────────┐
│  bun run policy:check [--full|--changed] [--reporter=...]    │
│                      cli.ts                                  │
└───────────────────────────┬──────────────────────────────────┘
                            │
                ┌───────────▼────────────┐
                │  context/loader.ts     │
                │  - changedFiles (git)  │
                │  - dependencyGraph     │
                │    (GitNexus / FS)     │
                │  - scripts (pkg.json)  │
                │  - vulnerabilities     │
                │    (tmp/trivy*.json)   │
                └───────────┬────────────┘
                            │ PolicyContext
                ┌───────────▼────────────┐
                │  engine.ts             │
                │  PolicyEngine.check()  │
                │  ┌──────────────────┐  │
                │  │ registy.ts       │  │
                │  │ parallel batch   │  │
                │  │ sequential queue │  │
                │  │ AbortController  │  │
                │  │ timeout guard    │  │
                │  └──────────────────┘  │
                └───────────┬────────────┘
                            │ PolicyResult[]
              ┌─────────────┴─────────────┐
              │                           │
   ┌──────────▼──────┐         ┌──────────▼──────┐
   │ reporters/       │         │ reporters/       │
   │ console.ts       │         │ json.ts          │
   └─────────────────┘         └─────────────────┘
```

**Adapter delegation model**:

Each domain rule delegates to an adapter that wraps an existing governance tool. Rules themselves are pure functions that call into adapters via the context data; adapters spawn legacy tools as subprocesses:

```
PolicyRule.evaluate(context)
    └─► Adapter.run(context)
            └─► Bun.spawn(['bun', 'run', 'arch:guard', ...]) / reads tmp/*.json
                    └─► parser → PolicyResult[]
```

**Migration rule**: All legacy scripts remain in place. Adapters wrap them. No removals in INFRA-29.

---

## 2. Directory Structure

```
scripts/
└── policy-engine/
    ├── cli.ts                          # Entry point: bun run policy:check
    ├── engine.ts                       # PolicyEngine class — orchestrates execution
    ├── registry.ts                     # PolicyRuleRegistry — compile-time registration
    ├── types.ts                        # All TypeScript interfaces (see data-model.md)
    │
    ├── context/
    │   └── loader.ts                   # Assembles PolicyContext from git + GitNexus + FS
    │
    ├── adapters/
    │   ├── architecture-guard.adapter.ts   # Wraps: bun run arch:guard
    │   ├── type-safety.adapter.ts          # Wraps: bun typecheck + arch:type-safety-guard
    │   ├── script-governance.adapter.ts    # Wraps: bun run validate:runtime:scripts
    │   └── trivy.adapter.ts                # Reads: tmp/trivy-report.json
    │
    ├── rules/
    │   ├── architecture/
    │   │   └── ARCH-001.rule.ts        # Import boundary violations (via arch:guard adapter)
    │   ├── scripts/
    │   │   ├── SCRIPTS-001.rule.ts     # Script naming convention violations
    │   │   ├── SCRIPTS-002.rule.ts     # Duplicate script detection
    │   │   ├── SCRIPTS-003.rule.ts     # Broken script path references
    │   │   └── SCRIPTS-004.rule.ts     # Missing documentation entries
    │   ├── types/
    │   │   └── TYPES-001.rule.ts       # TypeScript strict-mode + type-safety violations
    │   ├── ai/
    │   │   └── AI-001.rule.ts          # AI context freshness (stale > GITNEXUS_MAX_AGE_HOURS)
    │   └── security/
    │       └── SECURITY-001.rule.ts    # Trivy HIGH/CRITICAL CVE findings
    │
    └── reporters/
        ├── console.ts                  # Human-readable grouped output to stdout
        └── json.ts                     # PolicyResult[] JSON array to stdout
```

---

## 3. Module Specifications

### `types.ts`

**Purpose**: Single source of truth for all TypeScript interfaces used by the engine.  
**Exports**: `PolicySeverity`, `PolicyDomain`, `PolicyRule`, `PolicyContext`, `PolicyResult`, `DependencyGraph`, `DependencyGraphModule`, `GitCommit`, `TrivyVulnerability`, `Reporter`, `ReporterType`, `PolicyEngineOptions`, `RegistryStats`  
**Dependencies**: None (no imports — pure type definitions)  
**Notes**: Full interface definitions in `data-model.md`. Must be strict TypeScript. The `PolicyDomain` union is the compile-time gate for new domains.

---

### `registry.ts`

**Purpose**: Central catalog of all registered `PolicyRule` instances. Populated at module initialization time (compile-time registration via import side effects).  
**Exports**:

```typescript
export function registerRule(rule: PolicyRule): void;
export function getRules(): readonly PolicyRule[];
export function getRegistryStats(): RegistryStats;
```

**Dependencies**: `types.ts`  
**Behavior**:

- `registerRule()` validates uniqueness of `rule.id` — throws `Error` synchronously on duplicate (caught during initialization, surfaces as process error before engine runs).
- `getRules()` returns a frozen copy of the registry.
- `getRegistryStats()` returns domain counts for Gate 3 coverage test.
- **No dynamic loading** (NFR-020). Registry is populated only by static imports.

**Self-registration pattern** (used in every rule file):

```typescript
// ARCH-001.rule.ts
import { registerRule } from "../../registry.ts";
registerRule({
  id: "ARCH-001",
  domain: "ARCH",
  // ...
});
```

The engine imports the registry after importing all rule files, ensuring all rules are registered before `check()` is called.

---

### `engine.ts`

**Purpose**: Runtime orchestrator — loads context, runs rules, enforces timeout, returns results.  
**Exports**:

```typescript
export class PolicyEngine {
  check(context: PolicyContext, loaderWarnings?: ContextWarning[]): Promise<PolicyResult[]>;
}
```

**Dependencies**: `types.ts`, `registry.ts`  
**Execution model**:

```
0. If loaderWarnings is non-empty: convert each ContextWarning to a
     warning-severity PolicyResult (ruleId ENGINE-002 or ENGINE-003)
     and collect into warningResults[]

1. Split rules from registry:
     parallel = rules where sequential !== true
     sequential = rules where sequential === true

2. Create AbortController from context.timeout; inject `abortController.signal` into `context.abortSignal`

3. const parallelResults = await Promise.race([
     Promise.all(parallel.map(r => safeEvaluate(r, context))),
     timeoutPromise(context.timeout)
   ])

4. If timeout fires → emit ENGINE-001 error result, exit 1 immediately

5. Flatten parallelResults

6. For each sequentialRule:
     results.push(...(await safeEvaluate(sequentialRule, context)))

8. Sort all results by severity (error → warning → info)

9. Return [...warningResults, ...sortedResults]
```

`safeEvaluate(rule, context)`:

```typescript
async function safeEvaluate(rule: PolicyRule, context: PolicyContext): Promise<PolicyResult[]> {
  try {
    return await rule.evaluate(context);
  } catch (err) {
    return [
      {
        ruleId: rule.id,
        domain: rule.domain,
        severity: "error",
        message: `Rule ${rule.id} threw an unhandled exception: ${String(err)}`,
      },
    ];
  }
}
```

**Timeout implementation**:

```typescript
function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new TimeoutError(ms)), ms));
}
```

On `TimeoutError`: engine catches it, kills any pending subprocess handles via AbortController signal (passed to adapters), emits `ENGINE-001`, exits 1.

**Notes**:

- Engine does NOT self-import rule files — the CLI (`cli.ts`) imports all rule files before instantiating the engine.
- After timeout, in-flight subprocess handles are terminated via `context.abortSignal` (populated in step 2 above; adapters pass this to `Bun.spawn({ signal: context.abortSignal })`). (Addresses CHK020 gap from clarify report.)

---

### `context/loader.ts`

**Purpose**: Assembles the `PolicyContext` object from controlled local sources.  
**Exports**:

```typescript
export async function loadContext(
  mode: "changed" | "full",
  timeout: number,
): Promise<ContextLoadResult>;
```

**Dependencies**: `types.ts`, Bun built-ins (`Bun.file`, `Bun.spawnSync`), `packages/logger`  
**Assembly steps** (in parallel where independent):

1. **`changedFiles`**: Run `git diff --name-only HEAD` via `Bun.spawnSync(['git', 'diff', '--name-only', 'HEAD'])`.
   - On non-zero exit or non-git directory → set `changedFiles = []`, set internal `gitUnavailable = true`.
   - If `mode === 'changed'` and `gitUnavailable` → emit a `warning`-severity synthetic result (see below), switch to `mode = 'full'` behavior.

2. **`dependencyGraph`**: Read the GitNexus context file at `docs/ai/context/gitnexus-context.json`.
   - Check `analyzedAt` field — if older than `GITNEXUS_MAX_AGE_HOURS` env var (default: 24h) → treat as stale.
   - Stale or missing file → `dependencyGraph = null` + emit a `warning`-severity synthetic result.
   - Parse into `DependencyGraph` type.

3. **`scripts`**: Read root `package.json` and extract the `scripts` field. On parse failure → `scripts = {}`.

4. **`vulnerabilities`**: Read `tmp/trivy-report.json` if it exists. Map to `TrivyVulnerability[]`. If absent → `vulnerabilities = undefined` (no error — Trivy is optional in dev).

5. **`existingScriptPaths`**: Collect all files under `scripts/` recursively (via `Bun.Glob` or equivalent). Used by SCRIPTS-003 to avoid filesystem I/O in evaluate().

6. **`documentedScriptNames`**: List all `.md` files in `docs/scripts/`. Extract script names (filename without extension). Used by SCRIPTS-004 to avoid filesystem I/O in evaluate().

**Security note**: `changedFiles` paths are sanitized — they are file paths only (no shell interpolation). They are passed as data, not as shell argument fragments.

**Synthetic warnings** from loader are returned via `ContextLoadResult.warnings` — NOT embedded in `PolicyContext`. The engine reads the `warnings` array and converts them to `warning`-severity `PolicyResult` entries with `domain: 'ENGINE'`, `ruleId: 'ENGINE-002'` (GIT_UNAVAILABLE) or `ENGINE-003` (GITNEXUS_STALE/GITNEXUS_MISSING), prepended before all rule results.

`ContextWarning` and `ContextLoadResult` types are declared in `types.ts`; `data-model.md` is authoritative.

---

### `adapters/architecture-guard.adapter.ts`

**Purpose**: Wraps `bun run arch:guard` (or `arch:guard:changed`) and parses its output into `PolicyResult[]`.  
**Exports**:

```typescript
export async function runArchitectureGuard(context: PolicyContext): Promise<PolicyResult[]>;
```

**Behavior**:

- Spawns: `Bun.spawn(['bun', 'run', mode === 'changed' ? 'arch:guard:changed' : 'arch:guard', '--json'], { signal: context.abortSignal })`
- Reads stdout, parses JSON (guard output format: array of violation objects).
- Maps each violation to `{ ruleId: 'ARCH-001', domain: 'ARCH', severity: 'error', message: ..., file: ... }`.
- On non-zero exit: returns `[{ ruleId: 'ARCH-001', domain: 'ARCH', severity: 'error', message: 'arch:guard exited with code N: <stderr excerpt>' }]`.
- On spawn crash / AbortSignal: returns `[{ ruleId: 'ARCH-001', domain: 'ARCH', severity: 'error', message: 'arch:guard adapter failed: <error>' }]`.
- **Never throws.**

---

### `adapters/type-safety.adapter.ts`

**Purpose**: Wraps `bun typecheck` (tsc) and `bun arch:type-safety-guard` and parses errors into `PolicyResult[]`.  
**Exports**:

```typescript
export async function runTypeSafety(context: PolicyContext): Promise<PolicyResult[]>;
```

**Behavior**:

- Spawns `bun typecheck` via `Bun.spawn([...], { signal: context.abortSignal })`; captures stderr (tsc writes errors there).
- Parses tsc diagnostic lines with regex: `/^(.+\.ts)\((\d+),(\d+)\): error (TS\d+): (.+)$/`
- Maps each diagnostic to `{ ruleId: 'TYPES-001', domain: 'TYPES', severity: 'error', file: ..., message: 'TS<code>: <msg>' }`.
- Also spawns `bun arch:type-safety-guard --json` and merges its JSON results.
- On non-zero exit and no parseable output: emits single error result with stderr excerpt.
- **Never throws.**

---

### `adapters/script-governance.adapter.ts`

**Purpose**: Wraps `bun run validate:runtime:scripts` and maps output to `PolicyResult[]`.  
**Exports**:

```typescript
export async function runScriptGovernance(context: PolicyContext): Promise<PolicyResult[]>;
```

**Behavior**:

- Spawns `Bun.spawn(['bun', 'run', 'validate:runtime:scripts', '--json'], { signal: context.abortSignal })`.
- Parses JSON output into script violation objects.
- Maps each to a `SCRIPTS-*` domain `PolicyResult` using violation type:
  - naming-violation → `SCRIPTS-001`
  - duplicate-script → `SCRIPTS-002`
  - broken-reference → `SCRIPTS-003`
  - missing-docs → `SCRIPTS-004`
- On non-zero exit: returns single error result with diagnostic.
- **Never throws.**
- **Note**: Also used as a fallback data source for the SCRIPTS-\* rules that evaluate in-process against `context.scripts`.

---

### `adapters/trivy.adapter.ts`

**Purpose**: Reads `tmp/trivy-report.json` (pre-generated, no network) and maps CVE findings to `PolicyResult[]`.  
**Exports**:

```typescript
export async function runTrivy(context: PolicyContext): Promise<PolicyResult[]>;
```

**Behavior**:

- Reads `tmp/trivy-report.json` using `Bun.file(path).json()`.
- Filters to HIGH and CRITICAL severity findings.
- Maps each to `{ ruleId: 'SECURITY-001', domain: 'SECURITY', severity: 'error', message: '<CVE>: <pkg>@<version> - <description>', suggestion: 'Fix: upgrade to <fixedVersion>' }`.
- If file absent: returns `[]` (no error — Trivy report is optional in dev, required in CI via separate job).
- If JSON parse fails: returns `[{ ruleId: 'SECURITY-001', domain: 'SECURITY', severity: 'error', message: 'Trivy report parse failed: <err>' }]`.
- Does not spawn any subprocess. Does not make network calls (NFR-018).
- **Never throws.**

---

### `rules/architecture/ARCH-001.rule.ts`

**Purpose**: Detects module import boundary violations by delegating to the architecture-guard adapter.  
**Rule ID**: `ARCH-001`  
**Severity**: `error`  
**Sequential**: `false` (parallelizable)  
**evaluate()**: Delegates to `runArchitectureGuard(context)` and returns its results. In `--changed` mode, scopes to `context.changedFiles` by passing them to the adapter.

---

### `rules/scripts/SCRIPTS-001.rule.ts`

**Purpose**: Detects scripts in `package.json` that do not follow `<domain>:<action>[:scope]` naming convention (FR-028).  
**Rule ID**: `SCRIPTS-001`  
**Severity**: `warning`  
**evaluate()**: Iterates `context.scripts`. Tests each key against `/^[a-z][a-z0-9]*:[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/`. Reports violations with `suggestion` providing the expected format.

---

### `rules/scripts/SCRIPTS-002.rule.ts`

**Purpose**: Detects duplicate scripts — multiple keys with identical or near-identical command values (FR-029).  
**Rule ID**: `SCRIPTS-002`  
**Severity**: `warning`  
**evaluate()**: Groups scripts by normalized command value (trimmed, lowercased). Entries whose values hash to the same string emit a duplicate warning per duplicate pair.

---

### `rules/scripts/SCRIPTS-003.rule.ts`

**Purpose**: Detects script command values that reference a file path under `scripts/` that does not exist (FR-030).  
**Rule ID**: `SCRIPTS-003`  
**Severity**: `error`  
**evaluate()**: Uses `context.existingScriptPaths` (pre-fetched by the context loader). Parses `context.scripts` command values for `bun scripts/...` or `bun run scripts/...` patterns. For each detected path, checks whether it is present in `context.existingScriptPaths`. Reports missing files. **No filesystem I/O in evaluate().**

### `rules/scripts/SCRIPTS-004.rule.ts`

**Purpose**: Detects scripts lacking a documentation entry in `docs/scripts/` (FR-031).  
**Rule ID**: `SCRIPTS-004`  
**Severity**: `warning`  
**evaluate()**: Uses `context.documentedScriptNames` (pre-fetched list of documented script names from `docs/scripts/*.md` files, extracted by the context loader). Compares against `context.scripts` keys. Reports undocumented scripts. **No filesystem I/O in evaluate().**

### `rules/types/TYPES-001.rule.ts`

**Purpose**: Detects TypeScript type-safety violations by delegating to the type-safety adapter.  
**Rule ID**: `TYPES-001`  
**Severity**: `error`  
**Sequential**: `true` (tsc is stateful; running multiple tsc invocations in parallel can cause port conflicts with language server)  
**evaluate()**: Delegates to `runTypeSafety(context)` and returns its results.

---

### `rules/ai/AI-001.rule.ts`

**Purpose**: Detects stale AI context artifacts (GitNexus index age exceeds `GITNEXUS_MAX_AGE_HOURS`).  
**Rule ID**: `AI-001`  
**Severity**: `warning`  
**evaluate()**: Checks `context.dependencyGraph` — if `null`, this rule is a no-op (context loader already emits a warning). If present, reads `analyzedAt` timestamp, calculates age, and emits a warning if stale.

---

### `rules/security/SECURITY-001.rule.ts`

**Purpose**: Surfaces HIGH and CRITICAL Trivy CVE findings by delegating to the Trivy adapter.  
**Rule ID**: `SECURITY-001`  
**Severity**: `error`  
**evaluate()**: Delegates to `runTrivy(context)` and returns its results.

---

### `reporters/console.ts`

**Purpose**: Formats `PolicyResult[]` as human-readable, grouped-by-domain output to stdout.  
**Exports**: `export class ConsoleReporter implements Reporter`  
**Output structure**:

```
━━━ ARCH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ERROR] ARCH-001  src/foo.ts
  Import boundary violation: packages/ui-system → apps/api forbidden
  Suggestion: Remove import from ui-system

━━━ SCRIPTS ━━━━━━━━━━━━━━━━━━━━━━━━━
[WARN]  SCRIPTS-001  (no file)
  Script "build-api" does not follow <domain>:<action>[:scope] convention
  Suggestion: Rename to build:api

────────────────────────────────────
  2 error(s)   1 warning(s)   0 info(s)
────────────────────────────────────
```

- Results grouped by `domain` then sorted by severity within group.
- Exit-blocking summary line indicates total error/warning/info counts.

---

### `reporters/json.ts`

**Purpose**: Outputs `PolicyResult[]` as a stable JSON array to stdout (FR-025, NFR-007).  
**Exports**: `export class JsonReporter implements Reporter`  
**Output**: `JSON.stringify(results, null, 2)` — deterministic because results are sorted by the engine before reaching the reporter. No timestamps, correlation IDs, or non-deterministic fields in the result objects.

---

### `cli.ts`

**Purpose**: Entry point for `bun run policy:check`. Parses arguments, wires up context, engine, and reporter, and drives the exit code.  
**Entry point**: `scripts/policy-engine/cli.ts`  
**Behavior**:

```typescript
// 1. Parse args: --full | --changed (default: --changed), --reporter=console|json
// 2. Import ALL rule files (side-effect imports trigger registerRule() calls)
// 3. Instantiate PolicyEngine
// 4. const { context, warnings } = await loadContext(mode, timeout)
// 5. Call engine.check(context, warnings)  — engine prepends warnings as PolicyResults
// 6. Pass results to selected reporter
// 7. process.exit(results.some(r => r.severity === 'error') ? 1 : 0)
```

**Argument parsing** (no external CLI library — native `Bun.argv`):

```
--full         → mode = 'full',    timeout = 30_000
--changed      → mode = 'changed', timeout = 2_000  (default)
--reporter=json    → reporter = 'json'
--reporter=console → reporter = 'console' (default)
```

**Rule import block** (explicit static imports to trigger registration):

```typescript
import "./rules/architecture/ARCH-001.rule.ts";
import "./rules/scripts/SCRIPTS-001.rule.ts";
import "./rules/scripts/SCRIPTS-002.rule.ts";
import "./rules/scripts/SCRIPTS-003.rule.ts";
import "./rules/scripts/SCRIPTS-004.rule.ts";
import "./rules/types/TYPES-001.rule.ts";
import "./rules/ai/AI-001.rule.ts";
import "./rules/security/SECURITY-001.rule.ts";
```

---

## 4. Data Model

See `specs/runtime/infra-029-policy-engine-and-governance-rules-layer/data-model.md` for the complete TypeScript interface definitions.

Key invariants:

- Rule IDs: `<DOMAIN>-<NNN>` format enforced by NFR-016.
- `ENGINE` domain is reserved for engine-internal results only.
- `PolicyContext` must never carry secrets or credentials.
- `PolicyResult[]` from a passing rule is always `[]`.

---

## 5. Integration Points

### 5.1 package.json script

Add to root `package.json` `scripts`:

```json
"policy:check": "bun scripts/policy-engine/cli.ts"
```

No changes to existing scripts. Existing `arch:guard`, `typecheck`, `validate:runtime:scripts` scripts remain and continue to work independently (adapter-first migration — no removal).

### 5.2 CI Integration (FR-035, FR-036)

Add a new CI job to `.github/workflows/` (e.g., `policy-check.yml`):

```yaml
name: Policy Check
on: [push, pull_request]
jobs:
  policy-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - name: Run policy check
        run: bun run policy:check --full --reporter=json
```

**Note**: After completing INFRA-29, remove direct `arch:guard`, `type-safety-guard`, etc. invocations from CI YAML (FR-036). Track this as a separate task in the migration path (T011).

### 5.3 Husky Pre-Commit Hook

Update `.husky/pre-commit`:

```sh
bun run policy:check --changed
```

Replace any existing direct invocations of `arch:guard:changed` or `governance:gate:changed` in the pre-commit hook with this single command.

### 5.4 Orchestrator Integration (FR-041–FR-043)

The orchestrator calls the engine programmatically:

```typescript
import { PolicyEngine } from "scripts/policy-engine/engine.ts";
import { loadContext } from "scripts/policy-engine/context/loader.ts";

const { context, warnings } = await loadContext("full", 30_000);
const engine = new PolicyEngine();
const results = await engine.check(context, warnings);

if (results.some((r) => r.severity === "error")) {
  // halt workflow step
}
```

The orchestrator's `precommit-diagnostics` and stage-closure gates delegate **entirely** to this call. Zero independent governance logic remains in the orchestrator (SC-005).

---

## 6. Transaction & Idempotency Strategy

The Policy Engine performs no database writes and no shared mutable state. Idempotency is guaranteed structurally:

| Property                  | Mechanism                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Deterministic context     | `PolicyContext` is assembled from file-system and git state at invocation time — identical for identical repo state |
| Deterministic rule output | Rules are pure functions (NFR-019): same context → same results                                                     |
| Deterministic JSON        | Results sorted by severity in engine before reporter; JSON.stringify produces stable output (NFR-007)               |
| Idempotent adapters       | Read-only subprocess calls; Trivy adapter reads a static file — no writes                                           |
| Gate 2 test               | Two sequential `--full` runs on unchanged repo produce byte-identical JSON output                                   |

No rollback strategy needed (no writes). If the engine crashes mid-run, it produces no partial state.

---

## 7. Testing Strategy

### 7.1 Unit Tests

Location: `tests/unit/policy-engine/`

| Test File                                     | Coverage                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `registry.test.ts`                            | registerRule() uniqueness enforcement; getRules() immutability; getRegistryStats() domain counts; duplicate ID rejection                                                       |
| `engine.test.ts`                              | check() parallel execution; sequential rule ordering; timeout enforcement (mock AbortController); safeEvaluate exception catching → ENGINE-001; result sorting by severity     |
| `context/loader.test.ts`                      | changedFiles from git output; git unavailable fallback to full; GitNexus stale detection; GITNEXUS_MAX_AGE_HOURS env var respected; trivy-report.json absent graceful handling |
| `rules/ARCH-001.test.ts`                      | evaluate() delegates to adapter mock; passes mode context; returns adapter results                                                                                             |
| `rules/SCRIPTS-001.test.ts`                   | naming pattern violations; valid patterns pass; edge cases (empty scripts, single-segment names)                                                                               |
| `rules/SCRIPTS-002.test.ts`                   | duplicate detection by normalized command value; unique scripts produce no violations                                                                                          |
| `rules/SCRIPTS-003.test.ts`                   | broken file reference detection; existing file passes; non-scripts/ paths ignored                                                                                              |
| `rules/SCRIPTS-004.test.ts`                   | undocumented scripts flagged; documented scripts pass                                                                                                                          |
| `rules/TYPES-001.test.ts`                     | evaluate() delegates to adapter mock; returns adapter results                                                                                                                  |
| `rules/AI-001.test.ts`                        | fresh index → no violations; stale index → warning; null dependencyGraph → no-op                                                                                               |
| `rules/SECURITY-001.test.ts`                  | evaluate() delegates to Trivy adapter mock; HIGH/CRITICAL findings surface as errors                                                                                           |
| `reporters/console.test.ts`                   | Output grouped by domain; severity counts in summary; empty results produce clean confirmation                                                                                 |
| `reporters/json.test.ts`                      | Valid JSON output; empty results produce `[]`; stable sort order                                                                                                               |
| `adapters/architecture-guard.adapter.test.ts` | Spawns correct command; maps JSON output to PolicyResult[]; non-zero exit → error result; exception → error result                                                             |
| `adapters/type-safety.adapter.test.ts`        | tsc stderr parsing; type-safety-guard JSON merge; non-zero exit handling                                                                                                       |
| `adapters/script-governance.adapter.test.ts`  | --json flag; violation type to ruleId mapping; non-zero exit handling                                                                                                          |
| `adapters/trivy.adapter.test.ts`              | Reads tmp/trivy-report.json; filters HIGH/CRITICAL; absent file → empty results; parse failure → error result                                                                  |

### 7.2 Integration Tests

Location: `tests/integration/policy-engine/`

| Test                       | Description                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `cli-exit-codes.test.ts`   | CLI exits 0 when no error violations; exits 1 when error violation present; exits 0 on warning-only results |
| `cli-changed-mode.test.ts` | --changed with modified file → only relevant rules evaluated; --changed with no files → exits 0 immediately |
| `cli-full-mode.test.ts`    | --full evaluates all domains; console reporter produces grouped output; json reporter produces valid JSON   |
| `cli-reporter.test.ts`     | --reporter=json stdout is valid JSON; --reporter=console output is human-readable                           |

### 7.3 Parity Tests (Gate 1)

Location: `tests/unit/policy-engine/parity/`

For each adapter, run both the legacy tool and the adapter on the same repo state and assert identical violation sets:

| Parity Test                        | Legacy Tool                        | Adapter                  |
| ---------------------------------- | ---------------------------------- | ------------------------ |
| `arch-guard-parity.test.ts`        | `bun run arch:guard`               | `runArchitectureGuard()` |
| `type-safety-parity.test.ts`       | `bun run validate:types`           | `runTypeSafety()`        |
| `script-governance-parity.test.ts` | `bun run validate:runtime:scripts` | `runScriptGovernance()`  |

Trivy parity test not applicable (adapter reads the same file the legacy tool would read).

### 7.4 Determinism Test (Gate 2)

Location: `tests/unit/policy-engine/determinism.test.ts`

```typescript
it("produces byte-identical JSON output on two sequential full runs", async () => {
  const { context } = await loadContext("full", 30_000);
  const engine = new PolicyEngine();
  const run1 = JSON.stringify(await engine.check(context));
  const run2 = JSON.stringify(await engine.check(context));
  expect(run1).toBe(run2);
});
```

### 7.5 Registry Coverage Test (Gate 3)

Location: `tests/unit/policy-engine/registry-coverage.test.ts`

```typescript
it("all five active domains have at least one registered rule", () => {
  const stats = getRegistryStats();
  const requiredDomains: PolicyDomain[] = ["ARCH", "SCRIPTS", "TYPES", "AI", "SECURITY"];
  for (const domain of requiredDomains) {
    expect(stats.domainCounts[domain]).toBeGreaterThanOrEqual(1);
  }
});
```

### 7.6 Static Analysis Test (Gate 4)

Location: `tests/static/policy-engine/no-direct-governance-calls.test.ts`

Asserts that no file outside `scripts/policy-engine/` contains direct calls to governance tools that bypass the engine:

```typescript
// Uses file-system grep to verify no files import arch:guard, type-safety-guard, etc. directly
// except in scripts/policy-engine/adapters/
```

### 7.7 Performance Validation

Run `bun run policy:check --changed` against a set of 10 staged files and assert completion under 2,000ms. This is a manual gate during Gate 1 validation, not a vitest test (timing-sensitive tests are flaky in CI).

---

## 8. Migration Path

| Step | Task                                                       | Scope                    |
| ---- | ---------------------------------------------------------- | ------------------------ |
| T001 | Create `scripts/policy-engine/` directory structure        | New files                |
| T002 | Implement `types.ts` (from data-model.md)                  | New file                 |
| T003 | Implement `registry.ts`                                    | New file                 |
| T004 | Implement `engine.ts`                                      | New file                 |
| T005 | Implement `context/loader.ts`                              | New file                 |
| T006 | Implement `adapters/architecture-guard.adapter.ts`         | New file                 |
| T007 | Implement `adapters/type-safety.adapter.ts`                | New file                 |
| T008 | Implement `adapters/script-governance.adapter.ts`          | New file                 |
| T009 | Implement `adapters/trivy.adapter.ts`                      | New file                 |
| T010 | Implement all 8 rule files (one per domain entry)          | New files                |
| T011 | Implement `reporters/console.ts` and `reporters/json.ts`   | New files                |
| T012 | Implement `cli.ts`                                         | New file                 |
| T013 | Add `"policy:check"` to root `package.json` scripts        | Edit `package.json`      |
| T014 | Write all unit tests (Table 7.1)                           | New test files           |
| T015 | Write integration tests (Table 7.2)                        | New test files           |
| T016 | Write Gate 1–4 validation tests                            | New test files           |
| T017 | Update `.husky/pre-commit` to use `policy:check --changed` | Edit `.husky/pre-commit` |
| T018 | Add CI job `policy-check.yml`                              | New workflow file        |
| T019 | Validate Gate 1 (parity tests pass)                        | Validation               |
| T020 | Validate Gate 2 (determinism test passes)                  | Validation               |
| T021 | Validate Gate 3 (registry coverage test passes)            | Validation               |
| T022 | Validate Gate 4 (static analysis test passes)              | Validation               |

**Deferred** (out of scope for INFRA-29):

- Removing legacy `arch:guard`, `type-safety-guard`, `validate:runtime:scripts` invocations from CI YAML (FR-036) — tracked as follow-up stage.
- Removing legacy script implementations from `scripts/` directory.

---

## 9. Implementation Order

Execute in the following sequential phases to maintain working state at each step.

### Phase A — Foundation (T001–T005)

Minimal runnable skeleton with no rules.

1. Create directory structure
2. `types.ts` — all interfaces
3. `registry.ts` — registration and retrieval
4. `engine.ts` — execution loop (empty registry runs cleanly)
5. `context/loader.ts` — git + GitNexus + package.json + Trivy file loading

**Checkpoint**: `bun scripts/policy-engine/cli.ts --full` runs with zero rules and exits 0.

### Phase B — Adapters (T006–T009)

Independently testable and deployable.

6. `architecture-guard.adapter.ts`
7. `type-safety.adapter.ts`
8. `script-governance.adapter.ts`
9. `trivy.adapter.ts`

**Checkpoint**: Each adapter can be invoked directly in a test and produces `PolicyResult[]`.

### Phase C — Rules (T010)

Wire rules to adapters. Self-registration via side-effect imports.

10. All 8 rule files

**Checkpoint**: `bun scripts/policy-engine/cli.ts --full` (once cli.ts is bootstrapped) evaluates all rules.

### Phase D — CLI & Reporters (T011–T013)

11. `reporters/console.ts`
12. `reporters/json.ts`
13. `cli.ts` — argument parsing + rule imports + wire engine + exit code
14. Add `"policy:check"` to `package.json`

**Checkpoint**: `bun run policy:check --full` runs end-to-end and exits with correct code.

### Phase E — Tests & Gates (T014–T022)

15. Unit tests for all modules
16. Integration tests
17. Gate 1–4 validation tests
18. Update Husky hook
19. Add CI workflow
20. Run all four gates; verify passing

**Final checkpoint**: All four gates pass; `bun run policy:check --full` exits 0 on clean repo; exits 1 when a known violation is introduced.

---

## 10. Open Questions

None. All ambiguities were resolved in Step 2 (Clarify). See `reports/CLARIFY_REPORT.md` for the 5 resolved clarifications:

1. Two-tier timeout (2,000ms / 30,000ms) — resolved → NFR-021
2. `--changed` git-unavailable fallback → full + warning — resolved → FR-003
3. Parallel-by-default with `sequential: true` opt-out — resolved → NFR-003, FR-011
4. Adapter subprocess failure → error PolicyResult, engine continues — resolved → Edge Cases
5. GitNexus stale threshold → `GITNEXUS_MAX_AGE_HOURS` (default: 24h) — resolved → FR-016

**Documented gaps** (not blocking, addressed during implementation):

- Orphaned subprocess handling after engine timeout → addressed in `engine.ts` AbortController design (Section 3, engine.ts).
- Structured logging / correlation ID inheritance → use `packages/logger` in `context/loader.ts` and `engine.ts`.
- Secrets detection formal definition → addressed during T-security tasks (SECURITY domain rule expansion).
- NFR-002 `SHOULD` asymmetry with NFR-001 `MUST` → intentional (CI flexibility vs pre-commit hard budget).
