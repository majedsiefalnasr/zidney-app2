# Data Model — Policy Engine and Governance Rules Layer

**Stage**: INFRA-29
**Phase**: 01_PLATFORM_FOUNDATION
**File**: `scripts/policy-engine/types.ts`

---

## TypeScript Interfaces

```typescript
// ─── Primitive Types ──────────────────────────────────────────────────────────

/**
 * The severity of a policy violation.
 * - 'error'   → causes exit code 1
 * - 'warning' → reported but does not fail the check
 * - 'info'    → informational only
 */
export type PolicySeverity = "error" | "warning" | "info";

/**
 * The governance domain owning this rule.
 * - 'ARCH'     → architecture boundary / dependency graph rules
 * - 'SCRIPTS'  → script naming, coverage, and documentation rules
 * - 'TYPES'    → TypeScript type-safety and strict-mode rules
 * - 'AI'       → AI context freshness, prompt governance rules
 * - 'SECURITY' → Trivy CVE findings, secret-scanning rules
 * - 'ENGINE'   → reserved for internal engine-generated results (e.g., ENGINE-001 timeout)
 */
export type PolicyDomain = "ARCH" | "SCRIPTS" | "TYPES" | "AI" | "SECURITY" | "ENGINE";

// ─── Core Interfaces ──────────────────────────────────────────────────────────

/**
 * A governance rule registered in the PolicyRuleRegistry.
 *
 * Rule IDs MUST follow the format <DOMAIN>-<NNN> (e.g., ARCH-001, SCRIPTS-003).
 * All rules are parallelizable by default. Declare `sequential: true` to opt out.
 */
export interface PolicyRule {
  /** Unique rule identifier. Format: <DOMAIN>-<NNN>. Duplicate IDs rejected at registration. */
  id: string;
  /** Domain this rule belongs to. Must be a member of PolicyDomain union. */
  domain: PolicyDomain;
  /** Human-readable description of what this rule validates and why. */
  description: string;
  /** Default severity when the rule produces a violation. */
  severity: PolicySeverity;
  /**
   * When true, this rule runs after all parallel rules complete.
   * Absence (or false) means the rule is safe to execute in parallel.
   * Default: false (parallelizable).
   */
  sequential?: boolean;
  /**
   * Evaluate the rule against the provided context.
   * MUST be a pure function: no external I/O, no side effects.
   * MUST NOT throw — return an empty array for a clean result.
   */
  evaluate(context: PolicyContext): Promise<PolicyResult[]>;
}

/**
 * Input data object passed to every rule's evaluate() function.
 * Assembled once by the context loader before rule execution begins.
 *
 * Security: MUST NOT contain secrets, credentials, or env-specific tokens.
 */
export interface PolicyContext {
  /**
   * Paths of files changed since the last git commit.
   * Empty array when running in --full mode or when git state is unavailable
   * (in which case the engine falls back to --full).
   */
  changedFiles: string[];
  /**
   * Dependency graph sourced from the GitNexus index.
   * null when GitNexus is unavailable or stale (see FR-016).
   * Rules receiving null MUST gracefully degrade or skip graph-dependent checks.
   */
  dependencyGraph: DependencyGraph | null;
  /** Git commit history, when available. Optional. */
  gitHistory?: GitCommit[];
  /**
   * Scripts map from the root package.json `scripts` field.
   * Populated by the context loader for SCRIPTS domain rules.
   */
  scripts?: Record<string, string>;
  /**
   * Trivy vulnerability findings, pre-loaded from tmp/trivy-report.json.
   * Populated only when the Trivy report file exists. No network calls.
   */
  vulnerabilities?: TrivyVulnerability[];
  /**
   * Pre-fetched list of file paths that exist under scripts/ (relative to repo root).
   * Populated by the context loader via filesystem scan.
   * Used by SCRIPTS-003 to check broken script path references without I/O in evaluate().
   */
  existingScriptPaths?: string[];
  /**
   * Pre-fetched list of documented script names sourced from docs/scripts/ .md files.
   * Populated by the context loader via filesystem scan.
   * Used by SCRIPTS-004 to check undocumented scripts without I/O in evaluate().
   */
  documentedScriptNames?: string[];
  /**
   * AbortSignal from the engine's AbortController.
   * Injected by the engine before passing context to rules.
   * Adapters MUST pass this to Bun.spawn({ signal: context.abortSignal }) to enable
   * subprocess cancellation on engine timeout (NFR-021, CHK020 resolution).
   */
  abortSignal?: AbortSignal;
  /**
   * Execution mode. Determines which rules scope to changedFiles vs full repo.
   * - 'changed' → rules scope to changedFiles only; 2,000ms timeout
   * - 'full'    → rules evaluate across the entire repository; 30,000ms timeout
   */
  mode: "changed" | "full";
  /**
   * Timeout in milliseconds for the entire engine invocation.
   * - 2,000ms for --changed mode
   * - 30,000ms for --full mode
   */
  timeout: number;
}

/**
 * The output of a single rule evaluation.
 * One PolicyResult represents one discrete violation or finding.
 * A rule MUST return an empty array for a passing check.
 */
export interface PolicyResult {
  /** ruleId of the rule that produced this result. */
  ruleId: string;
  /** Domain that produced this result — enables reporter grouping and orchestrator filtering. */
  domain: PolicyDomain;
  /** Severity of this specific result. May differ from the rule's default severity. */
  severity: PolicySeverity;
  /** Human-readable description of the violation or finding. */
  message: string;
  /** Relative file path where the violation was detected, if applicable. */
  file?: string;
  /** Suggested remediation action. Optional. */
  suggestion?: string;
}

// ─── Dependency Graph ─────────────────────────────────────────────────────────

/**
 * A snapshot of the repository's module dependency graph.
 * Sourced from the GitNexus local index. Used by ARCH domain rules.
 */
export interface DependencyGraph {
  /** Timestamp of the last GitNexus analysis (ISO 8601 string). */
  analyzedAt: string;
  /** Module entries keyed by module path (e.g., "packages/types"). */
  modules: Record<string, DependencyGraphModule>;
}

export interface DependencyGraphModule {
  /** Module path relative to repo root. */
  path: string;
  /** Declared allowed import targets. */
  allowedDependencies: string[];
  /** Declared forbidden import targets. */
  forbiddenDependencies: string[];
  /** Actual resolved imports detected by GitNexus. */
  actualImports: string[];
}

// ─── Context Warning ───────────────────────────────────────────────

/**
 * A non-fatal warning emitted by the context loader when external data sources
 * (git, GitNexus) are unavailable or stale. These are synthetic signals returned
 * alongside the PolicyContext — they are NOT PolicyResults from rules.
 * The engine prepends them to the result set as warning-severity PolicyResults
 * with ruleId 'ENGINE-002' (git unavailable) or 'ENGINE-003' (GitNexus issues).
 */
export interface ContextWarning {
  code: "GIT_UNAVAILABLE" | "GITNEXUS_STALE" | "GITNEXUS_MISSING";
  message: string;
}

/**
 * Return type of `loadContext()` in `context/loader.ts`.
 * Separates the assembled PolicyContext from any loader-level warnings
 * so that neither type is mutated.
 */
export interface ContextLoadResult {
  context: PolicyContext;
  warnings: ContextWarning[];
}

// ─── Git History ──────────────────────────────────────────────────────────────

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  changedFiles: string[];
}

// ─── Trivy Vulnerability ─────────────────────────────────────────────────────

/**
 * A single CVE finding from a Trivy vulnerability report.
 * Sourced from tmp/trivy-report.json (pre-generated; no network calls).
 */
export interface TrivyVulnerability {
  /** CVE identifier (e.g., "CVE-2024-12345"). */
  vulnerabilityId: string;
  /** Affected package name. */
  packageName: string;
  /** Installed version of the affected package. */
  installedVersion: string;
  /** Fixed version, if available. */
  fixedVersion?: string;
  /** CVSS severity level. */
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  /** Human-readable vulnerability description. */
  description?: string;
  /** Source file or image layer where the vulnerability was found. */
  target?: string;
}

// ─── Reporter ─────────────────────────────────────────────────────────────────

export type ReporterType = "console" | "json";

export interface Reporter {
  report(results: PolicyResult[]): void;
}

// ─── Engine Options ───────────────────────────────────────────────────────────

export interface PolicyEngineOptions {
  mode: "changed" | "full";
  reporter: ReporterType;
}

// ─── Rule Registry ────────────────────────────────────────────────────────────

/**
 * Metadata returned by getRules() for registry introspection in tests.
 * Allows Gate 3 coverage test to verify all 5 active domains are represented.
 */
export interface RegistryStats {
  totalRules: number;
  domainCounts: Partial<Record<PolicyDomain, number>>;
}
```

---

## Rule ID Reference Table

Rule IDs follow the `<DOMAIN>-<NNN>` format (NFR-016). Reserved ranges:

| Domain     | Reserved Range   | Notes                                |
| ---------- | ---------------- | ------------------------------------ |
| `ARCH`     | ARCH-001–099     | Architecture boundary rules          |
| `SCRIPTS`  | SCRIPTS-001–099  | Script naming, coverage, docs rules  |
| `TYPES`    | TYPES-001–099    | TypeScript strict-mode rules         |
| `AI`       | AI-001–099       | AI governance and context rules      |
| `SECURITY` | SECURITY-001–099 | Trivy CVE and secret-scan rules      |
| `ENGINE`   | ENGINE-001–009   | Reserved for engine-internal results |

**ENGINE-001**: Emitted when engine invocation exceeds mode timeout (NFR-021).
**ENGINE-002**: Emitted when git is unavailable and `--changed` mode falls back to `--full` (from `ContextWarning.code = 'GIT_UNAVAILABLE'`).
**ENGINE-003**: Emitted when the GitNexus context file is stale or missing (from `ContextWarning.code = 'GITNEXUS_STALE'` or `'GITNEXUS_MISSING'`).

---

## Invariants

1. `PolicyRule.id` must be globally unique across all registered rules (FR-012).
2. `PolicyRule.evaluate()` must never throw — engine catches thrown exceptions and emits `ENGINE-001` (FR-007).
3. `PolicyContext` must never contain secrets or credentials (Security considerations).
4. `PolicyResult[]` from a passing rule must be an empty array `[]`.
5. The `domain` field on both `PolicyRule` and `PolicyResult` must be a member of the `PolicyDomain` union — the TypeScript compiler enforces this at compile time (Architecture Constraint 4).
