# Research: STAGE_INFRA_07_MODULE_BOUNDARIES

**Generated**: 2026-03-08  
**Status**: Complete — all NEEDS CLARIFICATION items resolved  
**Based on**: Direct file inspection of ai-guard.ts, infra-audit.ts, ARCHITECTURE_MAP.json, tsconfig.json, tsconfig.base.json, ci.yml

---

## 1. ai-guard.ts — Complete Validator Chain Analysis

### File Location

`scripts/ai-guard.ts`

### Imports (Current)

```typescript
import {execSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
```

**Gap**: `existsSync` is NOT currently imported. The new `loadTsAliases()` function requires it. The import line must be extended to:

```typescript
import {existsSync, readFileSync} from 'node:fs'
```

### Constants (Current)

```typescript
const CONTRACT_PATH = 'docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json'
const ARCH_MAP_PATH = 'docs/architecture/intelligence/ARCHITECTURE_MAP.json'
const AI_BRAIN_PATH = 'docs/ai/context/ai-architecture-brain.json'
```

All are relative paths, resolved from `process.cwd()` (repo root). Pattern is consistent — `BOUNDARIES_PATH` must follow the same convention.

### Types (Current)

```typescript
type ArchitectureContract = {
  dependencyRules?: {forbidden?: Record<string, string[]>}
  layerRules?: {forbidden?: Record<string, string[]>}
}

type ArchitectureMap = {
  modules?: Record<
    string,
    {
      layer?: string
      allowed_dependencies?: string[]
      forbidden_dependencies?: string[]
    }
  >
}

type ArchitectureBrain = {
  rules?: {
    dependencyRules?: {forbidden?: Record<string, string[]>}
    layerRules?: {forbidden?: Record<string, string[]>}
  }
  modules?: string[]
  edges?: {from: string; to: string}[]
}
```

### Loader Functions (Current)

| Function                  | Behavior on miss  | Behavior on malform |
| ------------------------- | ----------------- | ------------------- |
| `loadContract()`          | throws (uncaught) | throws (uncaught)   |
| `loadArchitectureMap()`   | returns `{}`      | returns `{}`        |
| `loadArchitectureBrain()` | returns `null`    | returns `null`      |

New `loadModuleBoundaries()` uses a mixed strategy: startup warning + graceful fallback if missing (NFR-003); hard `process.exit(1)` if malformed (FR-001 + clarification).

### File Scanning — `getChangedFiles()`

1. Attempts `git diff --cached --name-only` (staged files)
2. If staged list is empty, falls back to `git ls-files -- "*.ts" "*.tsx" "*.vue"` (all tracked)
3. Filters to `.ts`, `.tsx`, `.vue` extensions
4. Returns empty array on error

**Implication**: In CI, all tracked source files are scanned. `validateLayerBoundaries` will run against every file in the monorepo when no staged changes exist.

### Import Extraction — `extractImports(filePath)`

Regex: `/import\s+(?:[\w*\s{},]+)\s+from\s+['"]([^'"]+)['"]/g`  
Returns raw import specifiers as-is (e.g., `"@zidney/logger"`, `"../../utils"`).  
Does NOT resolve aliases.

### Module Detection Functions (Current)

```typescript
// From a raw import specifier → module short-name (e.g., "logger", "api")
detectModule(importPath)

// From a file path → module short-name
detectFileModule(file)

// From a raw specifier/path → full module path (e.g., "packages/logger", "apps/api")
// BUG: @zidney/ui/* → "packages/ui" (wrong - should be "packages/ui-system")
resolveModulePath(module)
```

### Existing Validator Functions (5 total — ALL PRESERVED)

```
validateArchitectureMap(filePath, fileModule, imports, archMap)
  → checks per-module allowed_dependencies / forbidden_dependencies from ARCHITECTURE_MAP.json
  → returns violations prefixed: "ARCH_MAP forbidden dependency:" / "ARCH_MAP dependency not allowed:"

validateRules(ruleType, fileModule, imports, rules)
  → generic rule checker against ARCHITECTURE_CONTRACT.json or brain.rules
  → returns violations prefixed: "${ruleType} violation:"

validateCrossAppImports(fileModule, filePath, imports)
  → detects apps/* → apps/* imports using raw import path (imp.startsWith('apps/'))
  → Only fires when filePath.startsWith('apps/')
  → returns violations prefixed: "Cross-app violation:"

validateRelativeLeaks(_filePath, imports)
  → detects relative imports containing 'apps/' or 'packages/' segments
  → returns violations prefixed: "Relative architecture leak:"

validateBranchNaming(changedFiles)
  → validates spec/* branch names match stage files (only for spec-driven work)
  → calls process.exit(1) directly if mismatch
```

### Brain Integration — `getModuleDepsFromBrain(modulePath, brain)`

When `ai-architecture-brain.json` is available AND the brain's `edges` include the current module, the imports list is replaced by the brain's edge graph. This means `validateLayerBoundaries` must also support brain-sourced module paths (which are already in `packages/xxx` format, not raw import strings).

**Critical observation**: When brain is used, imports are already resolved to module paths like `"packages/logger"`. The raw `extractImports` result is only used for `validateRelativeLeaks`. This affects how `validateLayerBoundaries` must call `resolveImportToModule()`:

- Brain-sourced deps: already in `packages/xxx` or `apps/xxx` format → `resolveImportToModule` should pass through directly
- Raw source imports: may be `@zidney/xxx` or relative → need alias resolution

### runGuard() Orchestration (Current)

```typescript
function runGuard() {
  getChangedFiles()
  validateBranchNaming(changedFiles)
  loadArchitectureBrain() → loadContract() or brain.rules
  loadArchitectureMap()

  for (file of changedFiles) {
    detectFileModule(file)
    extractImports(file)  → rawImports
    // If brain available: replace imports with brain deps
    validateArchitectureMap(...)
    validateCrossAppImports(...)
    validateRelativeLeaks(...)  ← always uses rawImports
    validateRules('Dependency', ...)
    validateRules('Layer', ...)
    collect violations
  }

  if violations → print + exit(1)
  else → exit(0)
}
```

### Hook Points for New Functions

1. **After constants** (line ~80): Insert `BOUNDARIES_PATH` constant
2. **After `ArchitectureBrain` type** (line ~70): Insert `TsAliasMap` interface + `ModuleBoundaries` type
3. **After `loadArchitectureBrain()`** (line ~100): Insert `loadModuleBoundaries()` + `loadTsAliases()`
4. **After `validateRelativeLeaks()`** (line ~280): Insert `getLayerForModule()`, `resolveImportToModule()`, `matchesGlobPattern()`, `ruleMatchesSource()`, `ruleMatchesTarget()`, `validateLayerBoundaries()`
5. **Inside `runGuard()`** — after `loadArchitectureMap()`: Insert `loadModuleBoundaries()` + `loadTsAliases()` calls
6. **Inside `runGuard()` file loop** — after `archMapViolations` collected: Insert `validateLayerBoundaries` call

---

## 2. `loadTsAliases()` Function Analysis — infra-audit.ts

### Signature

```typescript
interface TsAliasMap {
  alias: string // Cleaned alias key with /* stripped, e.g., "@zidney/logger"
  target: string // First target entry with /* stripped, e.g., "packages/logger/src/index.ts"
}

function loadTsAliases(): TsAliasMap[]
```

### Current Behavior in infra-audit.ts

```typescript
const paths = [join(ROOT, 'tsconfig.json'), join(ROOT, 'tsconfig.base.json')]

for (const p of paths) {
  if (!existsSync(p)) continue
  try {
    const json = JSON.parse(readFileSync(p, 'utf-8'))
    const pathsConfig = json?.compilerOptions?.paths
    if (!pathsConfig) continue

    const aliases: TsAliasMap[] = []
    for (const key of Object.keys(pathsConfig)) {
      const cleanKey = key.replace('/*', '') // "@zidney/ui/*"  → "@zidney/ui"
      const target = pathsConfig[key][0]?.replace('/*', '') // "packages/ui-system/src/*" → "packages/ui-system/src"
      if (target) aliases.push({alias: cleanKey, target})
    }
    return aliases // Returns FIRST successful parse (tsconfig.json wins)
  } catch {}
}
return []
```

### Known Gap with Current Implementation

`infra-audit.ts` returns aliases from the FIRST successfully-parsed tsconfig only (tsconfig.json). This means `@zidney/api-client` (defined only in `tsconfig.base.json`) is NOT in the alias map.

Since `ai-guard.ts` must resolve `@zidney/api-client` to detect violations when a `ui` module is wrongly imported by a `runtime` module, the implementation in `ai-guard.ts` must read **both** tsconfig files and merge them (tsconfig.json entries take precedence for conflicts).

### Corrected Pattern for ai-guard.ts

```typescript
function loadTsAliases(): TsAliasMap[] {
  const configs = ['tsconfig.json', 'tsconfig.base.json']
  const result: TsAliasMap[] = []
  const seen = new Set<string>()

  for (const configFile of configs) {
    try {
      if (!existsSync(configFile)) continue
      const json = JSON.parse(readFileSync(configFile, 'utf-8'))
      const pathsConfig = json?.compilerOptions?.paths
      if (!pathsConfig) continue

      for (const key of Object.keys(pathsConfig)) {
        const cleanKey = key.replace('/*', '')
        if (seen.has(cleanKey)) continue // tsconfig.json takes precedence
        const rawTarget = pathsConfig[key][0]
        if (!rawTarget) continue
        const cleanTarget = rawTarget.replace('/*', '')
        seen.add(cleanKey)
        result.push({alias: cleanKey, target: cleanTarget})
      }
    } catch {
      // Ignore parse errors
    }
  }
  return result
}
```

### Alias → Module Path Normalization

The `target` field after stripping contains paths like:

- `packages/logger/src/index.ts` → normalize to `packages/logger`
- `packages/ui-system/src` → normalize to `packages/ui-system`
- `apps/mmc/src` → normalize to `apps/mmc`
- `./apps/mmc/src` → normalize to `apps/mmc` (strip leading `./`)

The normalizer in `resolveImportToModule()` must split on `/` and take the first two segments where `[0]` is `packages` or `apps`.

### Complete Alias Table (After Merging Both Configs)

| Alias (cleaned)                       | Target (cleaned)                              | Normalized Module                     |
| ------------------------------------- | --------------------------------------------- | ------------------------------------- |
| `@/*`                                 | `./apps/*/src`                                | SKIP (multi-target, ambiguous)        |
| `@zidney/app/*`                       | `./apps/*/src`                                | SKIP (wildcard app)                   |
| `@zidney/package/*`                   | `./packages/*/src`                            | SKIP (wildcard package)               |
| `@zidney/ui`                          | `packages/ui-system/src/index.ts`             | `packages/ui-system`                  |
| `@zidney/ui/*`                        | `packages/ui-system/src`                      | `packages/ui-system`                  |
| `@zidney/domain-core`                 | `packages/domain-core/src/index.ts`           | `packages/domain-core`                |
| `@zidney/domain-core/*`               | `packages/domain-core/src`                    | `packages/domain-core`                |
| `@zidney/domain-core/mmc-dashboard`   | `packages/domain-core/mmc-dashboard/index.ts` | `packages/domain-core`                |
| `@zidney/domain-core/mmc-dashboard/*` | `packages/domain-core/mmc-dashboard`          | `packages/domain-core`                |
| `@zidney/logger`                      | `packages/logger/src/index.ts`                | `packages/logger`                     |
| `@zidney/logger/*`                    | `packages/logger/src`                         | `packages/logger`                     |
| `@zidney/types`                       | `packages/types/src/index.ts`                 | `packages/types`                      |
| `@zidney/types/*`                     | `packages/types/src`                          | `packages/types`                      |
| `@zidney/validation`                  | `packages/validation/src/index.ts`            | `packages/validation`                 |
| `@zidney/validation/*`                | `packages/validation/src`                     | `packages/validation`                 |
| `@zidney/redis-utils`                 | `packages/redis-utils/src/index.ts`           | `packages/redis-utils`                |
| `@zidney/redis-utils/*`               | `packages/redis-utils/src`                    | `packages/redis-utils`                |
| `@zidney/config`                      | `packages/config/src/index.ts`                | `packages/config`                     |
| `@zidney/config/*`                    | `packages/config/src`                         | `packages/config`                     |
| `@zidney/api-client`                  | `packages/api-client/src/index.ts`            | `packages/api-client` (**base only**) |
| `@zidney/api-client/*`                | `packages/api-client/src`                     | `packages/api-client` (**base only**) |

Aliases prefixed with `@zidney/app/`, `@zidney/package/`, and `@/` are wildcard multi-targets and are skipped during module resolution (canot determine a single canonical module path from them).

---

## 3. Full `module-boundaries.json` Content Derivation

### Source of Classification

Module classifications are derived from the spec (FR-002: "13 modules and their required layer assignments") and the spec's Architecture Decisions, which make two corrections to `ARCHITECTURE_MAP.json`:

| Module                 | ARCHITECTURE_MAP.json (current) | module-boundaries.json (authoritative) | Change                 |
| ---------------------- | ------------------------------- | -------------------------------------- | ---------------------- |
| `packages/logger`      | `infrastructure`                | `infrastructure`                       | —                      |
| `packages/config`      | `infrastructure`                | `infrastructure`                       | —                      |
| `packages/types`       | `domain`                        | **`infrastructure`**                   | Corrected (Decision 2) |
| `packages/redis-utils` | `infrastructure`                | `infrastructure`                       | —                      |
| `packages/domain-core` | `domain`                        | `domain`                               | —                      |
| `packages/validation`  | `domain`                        | `domain`                               | —                      |
| `packages/ui-system`   | `ui`                            | `ui`                                   | —                      |
| `packages/api-client`  | `infrastructure`                | **`ui`**                               | Corrected (Decision 3) |
| `apps/api`             | `runtime`                       | `runtime`                              | —                      |
| `apps/worker`          | `runtime`                       | `runtime`                              | —                      |
| `apps/mmc`             | `ui`                            | `ui`                                   | —                      |
| `apps/backoffice`      | `ui`                            | `ui`                                   | —                      |
| `apps/frontoffice`     | `ui`                            | `ui`                                   | —                      |

`ARCHITECTURE_MAP.json` is NOT modified by this stage. The two classification mismatches are resolved by `module-boundaries.json` being the authoritative source (loaded first by `ai-guard.ts`).

### Layer Dependency Matrix (from spec FR-003)

```
infrastructure → (nothing internal, only external npm)
domain         → infrastructure
runtime        → domain, infrastructure
ui             → ui, infrastructure
```

**Observation on `ui → ui`**: `ui` modules may import from other `ui` modules (e.g., `apps/mmc` may import from `packages/ui-system` or `packages/api-client`). This enables the frontend apps to use the shared component and API client packages.

**Why `domain` is not in `ui.allowed_dependencies`**: The cross_cutting_rule `ui_no_domain_packages` explicitly blocks `ui` → `packages/domain-core` and `ui` → `packages/validation`. Since `domain` is absent from `ui.allowed_dependencies`, all domain packages are implicitly forbidden for UI modules. The cross_cutting_rule is belt-and-suspenders for human readability.

### Cross-Cutting Rules (from spec)

1. **`packages_no_apps`**: Any package importing from any app (source: `packages/*`, target: `apps/*`)
2. **`no_cross_app_imports`**: Any app importing from another app (source: `apps/*`, target: `apps/*`) — also covered by existing `validateCrossAppImports()`
3. **`runtime_no_ui_system`**: `apps/api` or `apps/worker` importing `packages/ui-system`
4. **`ui_no_domain_packages`**: Any `ui`-layer module importing `packages/domain-core` or `packages/validation`

---

## 4. ARCHITECTURE_MAP.json — Current State vs. module-boundaries.json

### What ARCHITECTURE_MAP.json Currently Has

- 13 modules, all present
- Fields per module: `layer`, `description`, `criticality`, `allowed_dependencies`, `forbidden_dependencies`
- `allowed_dependencies` is `[]` for ALL modules (positive allow-lists not used — enforcement is via `forbidden_dependencies` only)
- `forbidden_dependencies` is partially specified:
  - Most packages: `["apps/*"]` or `["apps/*", "packages/ui-system"]`
  - `packages/types`: `["apps/*"]`
  - `packages/api-client`: `["apps/*"]`
  - `apps/mmc`, `apps/frontoffice`, `apps/backoffice`: `["apps/*"]`
  - `apps/api`, `apps/worker`: `["apps/*", "packages/ui-system"]`
- Has rich per-module metadata: `description`, `criticality` — NOT replicated in `module-boundaries.json`

### What module-boundaries.json Adds/Corrects

- **Layer-first schema** (fundamentally different structure)
- **Corrected classifications** for `packages/types` and `packages/api-client`
- **Explicit full layer dependency matrix** (positive allow-lists + negative forbidden-lists per layer)
- **Structured cross_cutting_rules** array (machine-processable, not just per-module string lists)
- **13-module coverage** without the metadata noise (no `description`, `criticality`)

### Co-existence Contract

`ai-guard.ts` loading order:

1. Load `module-boundaries.json` → provides layer classification + layer rules (authoritative)
2. Load `ARCHITECTURE_MAP.json` → provides per-module `forbidden_dependencies` overrides (supplement)
3. Load `ARCHITECTURE_CONTRACT.json` / brain → provides contract-level rules (fallback)

For any module with a layer classification in `module-boundaries.json`, that classification wins over `ARCHITECTURE_MAP.json`. The `validateArchitectureMap()` validator (existing, unchanged) continues to run and enforces per-module `forbidden_dependencies` from `ARCHITECTURE_MAP.json` as an additional layer of defense.

---

## 5. CI Workflow Analysis

### `.github/workflows/ci.yml` — Relevant Section

```yaml
arch-guard:
  name: 'AI-Guard — Architecture Boundaries'
  runs-on: ubuntu-latest
  timeout-minutes: 5
  needs: [lint, typecheck]
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: ${{ env.BUN_VERSION }}
    - name: Install dependencies
      run: bun install --frozen-lockfile
    - name: Run AI-Guard architecture check # ← RENAME THIS
      run: bun scripts/ai-guard.ts
```

**Required change**: Rename step `"Run AI-Guard architecture check"` → `"module-boundary-validation"`. Also update `run:` from `bun scripts/ai-guard.ts` to `bun run ai-guard` to use the new package.json script.

**Job placement is already correct**: `arch-guard` job runs after `lint` and `typecheck`, and before `unit-tests` (which has `needs: [lint, typecheck, arch-guard]`). This satisfies FR-009 with zero structural changes to the job graph.

### `.github/workflows/architecture-governance.yml`

Has step `"Run Zidney AI Guard"` that runs `bun scripts/ai-guard.ts`. This step does not need renaming (the spec only specifies renaming in `ci.yml`'s `arch-guard` job).

---

## 6. package.json — Current Script State

Current scripts (relevant):

```json
"arch:guard": "bun scripts/ai-guard.ts"   ← EXISTS (preserved, not changed)
```

Missing (required by FR-010):

```json
"ai-guard": "bun scripts/ai-guard.ts"   ← MUST ADD
```

Both scripts will co-exist. No breaking changes to existing `arch:guard` consumers.
