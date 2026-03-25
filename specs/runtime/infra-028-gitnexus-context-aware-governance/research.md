# Research — GitNexus Context-Aware Governance (INFRA-28)

**Generated:** 2026-03-25T00:15:00Z

---

## 1. Existing `gitnexus-context.ts` Exports

File: `scripts/gitnexus-context.ts`

### Exported Types

```typescript
export interface RecentCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface RiskIndicator {
  module: string;
  riskScore: number;
  reason: string;
  affectedBy: string[];
}

export interface GitNexusContext {
  schemaVersion: string; // "1.0.0"
  generatedAt: string; // ISO 8601
  analysisMode: "changed-only" | "full";
  changedFiles: string[];
  impactedModules: string[];
  dependencyGraph: Record<string, string[]>;
  architectureLayerMap: Record<string, string>;
  recentCommits: RecentCommit[];
  riskIndicators: RiskIndicator[];
}

export interface AssembleOptions {
  changedFilesOnly: boolean;
  dryRun: boolean;
  output: string;
  all: boolean;
  baseRef: string;
}
```

### Exported Functions

```typescript
export function assembleContext(options: AssembleOptions): GitNexusContext;
export function detectChangedFiles(options: { baseRef: string; all: boolean }): string[];
export function mapFilesToModules(files: string[], brainModules: string[]): string[];
export function buildDependencyGraph(modules, brain, full): Record<string, string[]>;
export function buildArchitectureLayerMap(modules, brain, full): Record<string, string>;
export function extractGitHistory(): RecentCommit[];
export function computeRiskIndicators(modules, brain, changedFiles): RiskIndicator[];
export function checkGitNexusHealth(): { healthy: boolean; status: string };
```

### Internal Constants (NOT exported)

```typescript
const BRAIN_PATH = resolve(process.cwd(), "docs/ai/context/ai-architecture-brain.json");
const DEFAULT_OUTPUT = resolve(process.cwd(), "docs/ai/context/gitnexus-context.json");
const SCHEMA_VERSION = "1.0.0"; // ← const, NOT export const — arch:context:validate MUST read from schema file
```

---

## 2. Schema File: `docs/ai/gitnexus-context.schema.json`

Top-level `version` field: `"1.0.0"` — this is what `context:validate` compares against
`artifact.schemaVersion`.

Required fields (from `required` array):

```json
[
  "schemaVersion",
  "generatedAt",
  "analysisMode",
  "changedFiles",
  "impactedModules",
  "dependencyGraph",
  "architectureLayerMap",
  "recentCommits",
  "riskIndicators"
]
```

---

## 3. Current `governance:gate` Chain

File: `scripts/governance/gate.ts`

```typescript
const GUARDS = [
  { name: "Architecture Guard", script: "arch:guard" },
  { name: "Type Safety", script: "validate:types" },
  { name: "Runtime Scripts", script: "validate:runtime:scripts" },
  { name: "Script Usage", script: "validate:script:usage" },
  { name: "Security CI", script: "infra:security:ci" },
  { name: "AI Context Validate", script: "ai:context:validate" },
];
```

**Plan:** Prepend `context:build` and `context:validate` as GUARDS[0] and GUARDS[1] before
the existing chain.

---

## 4. Current `governance:gate:changed`

`package.json` line 95:

```json
"governance:gate:changed": "bun run arch:guard:changed"
```

**Plan:** Change to:

```json
"governance:gate:changed": "bun run arch:context:changed && bun run arch:guard:changed"
```

---

## 5. Current `.husky/pre-commit` Structure

1. Detect staged files
2. If none → exit early
3. lint-staged (Biome)
4. TypeScript incremental validation (TS files only)
5. Architecture Guard (`bun scripts/ai-guard.ts`, code files only)
6. Architecture Brain validation (brain JSON files only)
7. Trivy dependency scan
8. Trivy staged secret scan
9. `arch:guard:changed` (unified governance gate, changed scope)

**Plan:** Insert between step 4 (TS validation) and step 5 (arch guard):

```sh
echo "Running GitNexus context resolution…"
bun run arch:context:changed
bun run arch:context:validate
```

---

## 6. Current `.github/workflows/architecture-governance.yml` Steps

1. Checkout
2. Setup Bun
3. Install dependencies
4. Verify AI Bootstrap Exists
5. Run Zidney AI Guard
6. Run Infrastructure Audit
7. Run Architecture Diff
8. Run Architecture Health
9. Upload Architecture Health Artifacts
10. Publish Architecture Summary
11. Run AI Execution Validation
12. Upload AI Execution Validation Artifact

**Plan:** Insert new step after step 3 (Install dependencies) and before step 4 (AI Bootstrap):

```yaml
- name: Build and Validate GitNexus Context
  run: bun run arch:context:build && bun run arch:context:validate
```

---

## 7. `detectChangedFiles` for `context:changed`

`context:changed` needs staged files (pre-commit context), not committed diffs.
Use `git diff --cached --name-only --diff-filter=ACM` to get staged files.
This is different from `assembleContext`'s `detectChangedFiles` which uses `git diff HEAD`.
Cache result at `docs/ai/context/context-changed.json` with `generatedAt` timestamp.

---

## 8. Atomic Write Pattern (Confirmed)

`gitnexus-context.ts` uses `writeFileSync` directly (no atomic write currently).
`context:build` adds the atomic write improvement:

1. Write to `<output>.tmp`
2. Rename `<output>.tmp` → `<output>` (atomic on POSIX)

Use `renameSync` from `node:fs`.
