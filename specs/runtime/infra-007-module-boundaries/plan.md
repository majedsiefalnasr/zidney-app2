# Implementation Plan: STAGE_INFRA_07_MODULE_BOUNDARIES

**Feature Branch**: `spec/infra-007-module-boundaries`  
**Stage**: `STAGE_INFRA_07_MODULE_BOUNDARIES`  
**Phase**: `01_PLATFORM_FOUNDATION`  
**Plan Generated**: 2026-03-08  
**Status**: Draft — ready for implementation gate review

---

## Architecture Overview

This stage enforces module dependency boundaries by introducing a layer-first JSON boundary map
(`docs/architecture/module-boundaries.json`) and extending `scripts/ai-guard.ts` with three new
constructs:

1. **`BOUNDARIES_PATH` constant** — locates the boundary map file
2. **`loadModuleBoundaries()` function** — loads and validates the boundary map at startup
3. **`validateLayerBoundaries()` function** — enforces the layer dependency matrix and cross-cutting
   rules for each scanned file

### Integration Model

```
Startup:
  loadModuleBoundaries()  ← PRIMARY authority for layers + allowed/forbidden matrix
  loadArchitectureMap()   ← SUPPLEMENTARY per-module forbidden_dependencies overrides
  loadArchitectureBrain() ← TERTIARY contract-level rule supplements
  loadTsAliases()         ← alias map from tsconfig.json + tsconfig.base.json (both)

Per-file scan loop (runGuard):
  extractImports(file)           → rawImports (alias-unresolved)
  [brain override if available]
  validateArchitectureMap(...)   → ARCH_MAP per-module overrides  [EXISTING, unchanged]
  validateCrossAppImports(...)   → raw apps/* → apps/* check      [EXISTING, unchanged]
  validateRelativeLeaks(...)     → relative path leaks            [EXISTING, unchanged]
  validateRules('Dependency')    → contract dependency rules      [EXISTING, unchanged]
  validateRules('Layer')         → contract layer rules           [EXISTING, unchanged]
  validateLayerBoundaries(...)   → layer matrix + cross_cutting   [NEW]
```

### Dependency Load Precedence

For layer classification of any given module, `module-boundaries.json` is authoritative. The two
mismatches corrected by this stage:

| Module                | ARCHITECTURE_MAP.json | module-boundaries.json |
| --------------------- | --------------------- | ---------------------- |
| `packages/types`      | `domain`              | **`infrastructure`**   |
| `packages/api-client` | `infrastructure`      | **`ui`**               |

`ARCHITECTURE_MAP.json` is **not modified** by this stage (NFR-003). Both files co-exist;
`ai-guard.ts` loads `module-boundaries.json` first so its layer assignments override
`ARCHITECTURE_MAP.json` for all layer-based checks.

---

## Data Model — `module-boundaries.json` Schema

### Full File Content

> **File location**: `docs/architecture/module-boundaries.json`  
> **This is the complete, production-ready content for that file.**

```json
{
  "version": "1.0",
  "description": "Authoritative module boundary map for Zidney monorepo. Loaded by scripts/ai-guard.ts as the primary layer classification and dependency matrix source. Complements docs/architecture/intelligence/ARCHITECTURE_MAP.json which retains per-module metadata.",
  "layers": {
    "infrastructure": [
      "packages/logger",
      "packages/config",
      "packages/types",
      "packages/redis-utils"
    ],
    "domain": ["packages/domain-core", "packages/validation"],
    "runtime": ["apps/api", "apps/worker"],
    "ui": [
      "apps/mmc",
      "apps/backoffice",
      "apps/frontoffice",
      "packages/ui-system",
      "packages/api-client"
    ]
  },
  "allowed_dependencies": {
    "infrastructure": [],
    "domain": ["infrastructure"],
    "runtime": ["domain", "infrastructure"],
    "ui": ["ui", "infrastructure"]
  },
  "forbidden_dependencies": {
    "infrastructure": ["domain", "runtime", "ui"],
    "domain": ["runtime", "ui"],
    "runtime": ["ui"],
    "ui": ["runtime"]
  },
  "cross_cutting_rules": [
    {
      "rule": "packages_no_apps",
      "description": "Packages must not import from apps",
      "source_pattern": "packages/*",
      "target_pattern": "apps/*",
      "action": "FORBIDDEN"
    },
    {
      "rule": "no_cross_app_imports",
      "description": "Apps must not import from other apps",
      "source_pattern": "apps/*",
      "target_pattern": "apps/*",
      "action": "FORBIDDEN"
    },
    {
      "rule": "runtime_no_ui_system",
      "description": "Runtime services must not import Vue component packages",
      "source": ["apps/api", "apps/worker"],
      "target": ["packages/ui-system"],
      "action": "FORBIDDEN"
    },
    {
      "rule": "ui_no_domain_packages",
      "description": "UI modules must not import domain logic directly",
      "source_layer": "ui",
      "target": ["packages/domain-core", "packages/validation"],
      "action": "FORBIDDEN"
    }
  ]
}
```

### Schema Field Reference

| Field                    | Type                       | Description                                                                                        |
| ------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `version`                | `string`                   | Semantic version of the schema format                                                              |
| `description`            | `string`                   | Human description (not machine-evaluated)                                                          |
| `layers`                 | `Record<string, string[]>` | Layer name → list of module paths belonging to that layer                                          |
| `allowed_dependencies`   | `Record<string, string[]>` | Layer name → list of layer names this layer may depend on. Empty array = no internal deps allowed  |
| `forbidden_dependencies` | `Record<string, string[]>` | Layer name → list of layer names explicitly forbidden (belt-and-suspenders alongside allowed list) |
| `cross_cutting_rules`    | `Rule[]`                   | Structured rules evaluated independently of the layer matrix                                       |

### Cross-Cutting Rule Discriminated Union

Each rule object has an `action: "FORBIDDEN"` field and exactly ONE source selector and ONE target
selector:

| Source Selector                | Target Selector                         | Example Rule            |
| ------------------------------ | --------------------------------------- | ----------------------- |
| `source_pattern: "apps/*"`     | `target_pattern: "apps/*"`              | `no_cross_app_imports`  |
| `source_pattern: "packages/*"` | `target_pattern: "apps/*"`              | `packages_no_apps`      |
| `source: ["apps/api", ...]`    | `target: ["packages/ui-system"]`        | `runtime_no_ui_system`  |
| `source_layer: "ui"`           | `target: ["packages/domain-core", ...]` | `ui_no_domain_packages` |

---

## Implementation Design

### File 1 — CREATE: `docs/architecture/module-boundaries.json`

**Action**: Create new file  
**Content**: Exactly as shown in the Data Model section above  
**Validation**: Must parse with `JSON.parse()` without error; must contain exactly 13 modules across
all 4 layer arrays

---

### File 2 — MODIFY: `scripts/ai-guard.ts`

#### 2a. Update Imports

**Location**: Top of file, line 1–2  
**Change**: Add `existsSync` to `node:fs` named imports

```typescript
// BEFORE
import { readFileSync } from "node:fs";

// AFTER
import { existsSync, readFileSync } from "node:fs";
```

#### 2b. Add `BOUNDARIES_PATH` Constant

**Location**: After existing `AI_BRAIN_PATH` constant (line ~84)  
**Insert**:

```typescript
const BOUNDARIES_PATH = "docs/architecture/module-boundaries.json";
```

#### 2c. Add `ModuleBoundaries` Type and `TsAliasMap` Interface

**Location**: After `ArchitectureBrain` type definition (line ~70)  
**Insert**:

```typescript
interface TsAliasMap {
  alias: string;
  target: string;
}

type CrossCuttingRule = {
  rule: string;
  description?: string;
  action: "FORBIDDEN";
  source_pattern?: string;
  target_pattern?: string;
  source?: string[];
  target?: string[];
  source_layer?: string;
};

type ModuleBoundaries = {
  version: string;
  description?: string;
  layers: Record<string, string[]>;
  allowed_dependencies: Record<string, string[]>;
  forbidden_dependencies: Record<string, string[]>;
  cross_cutting_rules?: CrossCuttingRule[];
};
```

#### 2d. Add `loadModuleBoundaries()` Function

**Location**: After `loadArchitectureBrain()` function  
**Behavior**:

- File missing → startup `console.warn` + return `null` (graceful fallback per NFR-003)
- File present but malformed JSON → `console.error` + `process.exit(1)` (hard failure per FR-001)
- File present and valid → parse and return

> **Architectural Decision — NFR-003 governs the missing-file case**:  
> FR-001 states "MUST fail with a clear error if the file is missing or malformed." NFR-003 states
> "must continue to work correctly if module-boundaries.json does not yet exist."  
> These requirements conflict for the missing-file case only. NFR-003 takes precedence for this
> infra-rollout stage: module-boundaries.json is a new file being introduced progressively, so
> ai-guard.ts must not break existing installations that do not yet have it.  
> FR-001's "fail" requirement is interpreted to govern **malformed/invalid** JSON only. Missing file
> = warn + fallback. Malformed/invalid file = process.exit(1).

```typescript
export function loadModuleBoundaries(): ModuleBoundaries | null {
  if (!existsSync(BOUNDARIES_PATH)) {
    console.warn(
      "[ai-guard] WARNING: module-boundaries.json not found — falling back to ARCHITECTURE_MAP.json only",
    );
    return null;
  }
  try {
    const raw = readFileSync(BOUNDARIES_PATH, "utf-8");
    const parsed = JSON.parse(raw) as ModuleBoundaries;
    if (
      !parsed.layers ||
      typeof parsed.layers !== "object" ||
      Array.isArray(parsed.layers) ||
      !parsed.allowed_dependencies ||
      typeof parsed.allowed_dependencies !== "object" ||
      Array.isArray(parsed.allowed_dependencies) ||
      !parsed.forbidden_dependencies ||
      typeof parsed.forbidden_dependencies !== "object" ||
      Array.isArray(parsed.forbidden_dependencies)
    ) {
      console.error(
        "[ai-guard] ERROR: module-boundaries.json is structurally invalid — missing required fields (layers, allowed_dependencies, forbidden_dependencies)",
      );
      process.exit(1);
    }
    return parsed;
  } catch {
    console.error(
      "[ai-guard] ERROR: module-boundaries.json is malformed — cannot validate boundaries",
    );
    process.exit(1);
  }
}
```

#### 2e. Add `loadTsAliases()` Function

**Location**: After `loadModuleBoundaries()`  
**Key differences from infra-audit.ts version**: Reads BOTH tsconfig.json AND tsconfig.base.json
(merged), to capture `@zidney/api-client` which is only in `tsconfig.base.json`. Uses same
strip-`/*` pattern. `tsconfig.json` entries take precedence for conflicts.

```typescript
export function loadTsAliases(): TsAliasMap[] {
  const configs = ["tsconfig.json", "tsconfig.base.json"];
  const result: TsAliasMap[] = [];
  const seen = new Set<string>();

  for (const configFile of configs) {
    try {
      if (!existsSync(configFile)) continue;
      const json = JSON.parse(readFileSync(configFile, "utf-8"));
      const pathsConfig = json?.compilerOptions?.paths as Record<string, string[]> | undefined;
      if (!pathsConfig) continue;

      for (const key of Object.keys(pathsConfig)) {
        const cleanKey = key.replace("/*", "");
        if (seen.has(cleanKey)) continue;
        const rawTarget = pathsConfig[key]?.[0];
        if (!rawTarget) continue;
        const cleanTarget = rawTarget.replace("/*", "");
        seen.add(cleanKey);
        result.push({ alias: cleanKey, target: cleanTarget });
      }
    } catch (err) {
      console.warn(
        `[ai-guard] WARNING: failed to load aliases from ${configFile} — alias-based boundary checks may be incomplete`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return result;
}
```

#### 2f. Add Helper Functions for Layer Boundary Validation

**Location**: After `validateRelativeLeaks()` (before `getModuleDepsFromBrain()`)  
**Functions**:

```typescript
function getLayerForModule(modulePath: string, boundaries: ModuleBoundaries): string | null {
  for (const [layer, modules] of Object.entries(boundaries.layers)) {
    if (modules.includes(modulePath)) return layer;
  }
  return null;
}

export function resolveImportToModule(importPath: string, aliases: TsAliasMap[]): string | null {
  // 1. Try alias resolution — longest matching alias wins
  let bestMatch: TsAliasMap | null = null;
  for (const entry of aliases) {
    const { alias } = entry;
    if (importPath === alias || importPath.startsWith(`${alias}/`)) {
      if (!bestMatch || alias.length > bestMatch.alias.length) {
        bestMatch = entry;
      }
    }
  }

  if (bestMatch) {
    // Normalize target like "packages/ui-system/src/index.ts" → "packages/ui-system"
    // Also handle leading "./" (e.g., "./packages/logger/src")
    const cleanTarget = bestMatch.target.replace(/^\.\//, "");
    const parts = cleanTarget.split("/");
    if (parts.length >= 2 && (parts[0] === "packages" || parts[0] === "apps")) {
      return `${parts[0]}/${parts[1]}`;
    }
  }

  // 2. Direct monorepo path (no alias needed)
  if (importPath.startsWith("packages/") || importPath.startsWith("apps/")) {
    return importPath.split("/").slice(0, 2).join("/");
  }

  // 3. External npm package — not a monorepo module
  return null;
}

export function matchesGlobPattern(modulePath: string, pattern: string): boolean {
  if (pattern.endsWith("/*")) {
    // "apps/*" matches "apps/mmc", "apps/api", etc. but NOT "apps" itself
    return modulePath.startsWith(pattern.slice(0, -1));
  }
  return modulePath === pattern;
}

function ruleSourceMatches(
  rule: CrossCuttingRule,
  sourceModule: string,
  sourceLayer: string,
): boolean {
  if (rule.source_pattern !== undefined)
    return matchesGlobPattern(sourceModule, rule.source_pattern);
  if (rule.source !== undefined) return rule.source.includes(sourceModule);
  if (rule.source_layer !== undefined) return sourceLayer === rule.source_layer;
  return false;
}

function ruleTargetMatches(rule: CrossCuttingRule, targetModule: string): boolean {
  if (rule.target_pattern !== undefined)
    return matchesGlobPattern(targetModule, rule.target_pattern);
  if (rule.target !== undefined) return rule.target.includes(targetModule);
  return false;
}
```

#### 2g. Add `validateLayerBoundaries()` Exported Function

**Location**: After the helper functions above  
**Exported** (for unit testing, consistent with existing exported validators)

```typescript
export function validateLayerBoundaries(
  filePath: string,
  imports: string[],
  boundaries: ModuleBoundaries,
  aliases: TsAliasMap[],
): string[] {
  const violations: string[] = [];

  // Determine source module full path (e.g., "apps/mmc", "packages/ui-system")
  const pathParts = filePath.split("/");
  if (pathParts[0] !== "apps" && pathParts[0] !== "packages") return violations;
  const sourceModule = `${pathParts[0]}/${pathParts[1]}`;

  const sourceLayer = getLayerForModule(sourceModule, boundaries);
  if (!sourceLayer) return violations; // Undeclared module — infra-audit will warn

  const allowedLayers = boundaries.allowed_dependencies[sourceLayer] ?? [];
  const crossCuttingRules = boundaries.cross_cutting_rules ?? [];

  for (const imp of imports) {
    const targetModule = resolveImportToModule(imp, aliases);
    if (!targetModule) continue;
    if (targetModule === sourceModule) continue;

    const targetLayer = getLayerForModule(targetModule, boundaries);
    if (!targetLayer) continue; // Undeclared target module — skip

    // Layer matrix check: target layer must be in source's allowed_dependencies
    if (!allowedLayers.includes(targetLayer)) {
      violations.push(
        `ARCHITECTURE VIOLATION — layer violation: ${sourceLayer} → ${targetLayer}: ` +
          `${sourceModule} may not import ${targetModule}`,
      );
      // Continue to also check cross-cutting rules — we want all violations reported
    }

    // Cross-cutting rules (evaluated independently of layer matrix)
    for (const rule of crossCuttingRules) {
      if (
        ruleSourceMatches(rule, sourceModule, sourceLayer) &&
        ruleTargetMatches(rule, targetModule)
      ) {
        violations.push(
          `ARCHITECTURE VIOLATION — cross-cutting rule [${rule.rule}]: ` +
            `${sourceModule} → ${targetModule} is forbidden`,
        );
      }
    }
  }

  return violations;
}
```

#### 2h. Update `runGuard()` — Load Boundaries + Aliases at Startup

**Location**: Inside `runGuard()`, after `const archMap = loadArchitectureMap()`  
**Insert**:

```typescript
const boundaries = loadModuleBoundaries();
const aliases = loadTsAliases();

if (boundaries) {
  console.log("AI Guard: module-boundaries.json loaded — layer boundary validation enabled.");
}
```

#### 2i. Update `runGuard()` — Call `validateLayerBoundaries` in File Loop

**Location**: Inside the `for (const file of changedFiles)` loop, after `archMapViolations`
collected  
**Insert**:

```typescript
const layerBoundaryViolations = boundaries
  ? validateLayerBoundaries(file, imports, boundaries, aliases)
  : [];
```

**And add to the `violations.push(...)` block**:

```typescript
violations.push(
  ...dependencyViolations.map((v) => `${file}: ${v}`),
  ...layerViolations.map((v) => `${file}: ${v}`),
  ...crossAppViolations.map((v) => `${file}: ${v}`),
  ...relativeLeakViolations.map((v) => `${file}: ${v}`),
  ...archMapViolations.map((v) => `${file}: ${v}`),
  ...layerBoundaryViolations.map((v) => `${file}: ${v}`), // NEW
);
```

#### Summary of ai-guard.ts Changes

| Element                                    | Type                   | Where Added                        |
| ------------------------------------------ | ---------------------- | ---------------------------------- |
| `existsSync` import                        | Import update          | Top of file                        |
| `BOUNDARIES_PATH` constant                 | Constant               | After `AI_BRAIN_PATH`              |
| `TsAliasMap` interface                     | Type                   | After `ArchitectureBrain` type     |
| `CrossCuttingRule` type                    | Type                   | After `TsAliasMap`                 |
| `ModuleBoundaries` type                    | Type                   | After `CrossCuttingRule`           |
| `loadModuleBoundaries()`                   | Exported function      | After `loadArchitectureBrain()`    |
| `loadTsAliases()`                          | Exported function      | After `loadModuleBoundaries()`     |
| `getLayerForModule()`                      | Helper                 | After `validateRelativeLeaks()`    |
| `resolveImportToModule()`                  | Helper                 | After `getLayerForModule()`        |
| `matchesGlobPattern()`                     | Helper                 | After `resolveImportToModule()`    |
| `ruleSourceMatches()`                      | Helper                 | After `matchesGlobPattern()`       |
| `ruleTargetMatches()`                      | Helper                 | After `ruleSourceMatches()`        |
| `validateLayerBoundaries()`                | Exported validator     | After `ruleTargetMatches()`        |
| `boundaries` + `aliases` load              | runGuard() update      | After `loadArchitectureMap()` call |
| `layerBoundaryViolations` collection       | runGuard() loop update | After `archMapViolations`          |
| `...layerBoundaryViolations.map(...)` push | runGuard() loop update | In violations.push block           |

**Backward compatibility**: All 5 existing validator functions (`validateArchitectureMap`,
`validateRules`, `validateCrossAppImports`, `validateRelativeLeaks`, `validateBranchNaming`) and all
3 existing loaders (`loadContract`, `loadArchitectureMap`, `loadArchitectureBrain`) remain
unchanged.

---

### File 3 — MODIFY: `package.json`

**Location**: `scripts` object in root `package.json`  
**Change**: Add `"ai-guard"` entry. Existing `"arch:guard"` preserved.

```json
// BEFORE (relevant section)
"arch:guard": "bun scripts/ai-guard.ts"

// AFTER (add new entry alongside existing)
"ai-guard":   "bun scripts/ai-guard.ts",
"arch:guard": "bun scripts/ai-guard.ts"
```

**Placement**: Insert `"ai-guard"` alphabetically before `"arch:add-module"` in the scripts object
(or at end of the arch: group — either is acceptable).

---

### File 4 — MODIFY: `.github/workflows/ci.yml`

**Location**: Inside `arch-guard` job, the step named `"Run AI-Guard architecture check"`  
**Change**: Rename the step; update `run:` to use the new package.json script.

```yaml
# BEFORE
- name: Run AI-Guard architecture check
  run: bun scripts/ai-guard.ts

# AFTER
- name: module-boundary-validation
  run: bun run ai-guard
```

**Rationale for `bun run ai-guard`**: FR-010 requires `bun run ai-guard` to work from repo root.
Using the package.json script in CI ensures CI and local developers use exactly the same invocation.
This is a minor improvement aligned with the spec.

**Job placement**: No change to job graph needed. `arch-guard` already runs after `lint` +
`typecheck` and before `unit-tests`, satisfying FR-009.

---

## Integration Contract

### How ai-guard.ts Merges module-boundaries.json with ARCHITECTURE_MAP.json

The two files serve different validation purposes and both validators run independently in the same
file loop. There is deliberate overlap (defense in depth):

| Validator                 | Source File                           | What It Catches                                        |
| ------------------------- | ------------------------------------- | ------------------------------------------------------ |
| `validateLayerBoundaries` | `module-boundaries.json`              | Layer matrix violations + cross-cutting rules (new)    |
| `validateArchitectureMap` | `ARCHITECTURE_MAP.json`               | Per-module forbidden_dependencies overrides (existing) |
| `validateCrossAppImports` | (none — logic in code)                | apps/_ → apps/_ via raw import string (existing)       |
| `validateRules`           | `ARCHITECTURE_CONTRACT.json` or brain | Contract-level dependency/layer rules (existing)       |

Overlaps are acceptable: `no_cross_app_imports` cross_cutting_rule and `validateCrossAppImports`
both detect cross-app imports. This means a developer sees duplicate violations, but never misses
one. No false negatives is more important than no duplicate messages.

### Conflict Resolution for Layer Classification

When `module-boundaries.json` and `ARCHITECTURE_MAP.json` disagree on a module's layer (as they do
for `packages/types` and `packages/api-client`):

- `validateLayerBoundaries` uses `module-boundaries.json` → corrected classification
- `validateArchitectureMap` uses `ARCHITECTURE_MAP.json` → legacy classification

Both validators run. A module like `packages/types` (infrastructure in boundaries, domain in
archmap) will be checked against both rulesets. This is safe because:

- `packages/types` has `allowed_dependencies: []` (infrastructure) in boundaries → strictest
  possible rule
- `packages/types` in ARCHITECTURE_MAP has `forbidden_dependencies: ["apps/*"]` → less strict
- Both fire for violations; boundaries validator is the authoritative one

### Missing module-boundaries.json (NFR-003 Fallback)

If `module-boundaries.json` does not exist (e.g., on a developer machine before the stage is
merged):

1. `loadModuleBoundaries()` prints:
   `[ai-guard] WARNING: module-boundaries.json not found — falling back to ARCHITECTURE_MAP.json only`
2. `boundaries` is `null`
3. `validateLayerBoundaries` is skipped in the file loop
4. All 5 existing validators continue running normally
5. Exit code behavior is unchanged from today

---

## Testing Plan — FR Coverage

For each Functional Requirement, the validation method and test artifact:

### FR-001 — Boundary Map File Exists

**Test method**: Run `bun run ai-guard` on a clean branch → verify file exists + is valid JSON.  
**Negative test**: Temporarily rename `module-boundaries.json` → verify ai-guard prints the
`WARNING: module-boundaries.json not found` message and continues with ARCHITECTURE_MAP.json only
(exit 0 if no other violations).

### FR-002 — All 13 Modules Classified

**Test method**: Count modules in `module-boundaries.json` layers array. Count must total
exactly 13.  
**Automated check**: Add static test in `tests/static/` to parse `module-boundaries.json` and
assert:

- `layers.infrastructure.length === 4`
- `layers.domain.length === 2`
- `layers.runtime.length === 2`
- `layers.ui.length === 5`
- Total = 13

### FR-003 — Layer Dependency Matrix Enforced

**Test fixtures** (add to `tests/unit/` or as test fixtures):

- Fixture A: A file claiming to be in `packages/ui-system` importing from `packages/domain-core` →
  should produce layer violation: `ui → domain`
- Fixture B: A file in `packages/domain-core` importing from `apps/api` → should produce layer
  violation: `domain → runtime`
- Fixture C: A file in `packages/config` importing from `packages/validation` → should produce layer
  violation: `infrastructure → domain`

**Verified using unit tests against `validateLayerBoundaries()` directly**, similar to existing unit
tests for `validateCrossAppImports` and `validateArchitectureMap`.

### FR-004 — Cross-App Import Prohibition

**Covered by** both existing `validateCrossAppImports()` (uses raw `apps/` prefix check) AND the new
`no_cross_app_imports` cross_cutting_rule in `validateLayerBoundaries()`.  
**Test**: Call `validateLayerBoundaries` with `filePath = 'apps/mmc/src/foo.ts'` and
`imports = ['apps/api/src/handler']` → verify violation with prefix
`ARCHITECTURE VIOLATION — cross-cutting rule [no_cross_app_imports]`.

### FR-005 — Packages Must Not Import Apps

**Covered by** the `packages_no_apps` cross_cutting_rule in `validateLayerBoundaries()`.  
**Test**: Call `validateLayerBoundaries` with `filePath = 'packages/ui-system/src/Button.vue'` and
imports containing `'apps/api/src/something'` → verify violation with prefix
`ARCHITECTURE VIOLATION — cross-cutting rule [packages_no_apps]`.

### FR-006 — TypeScript Alias Resolution

**Test**: Call `validateLayerBoundaries` with `filePath = 'apps/api/src/route.ts'` and imports
containing `'@zidney/ui'` (which resolves to `packages/ui-system`, a `ui`-layer module, forbidden
for `runtime`).  
**Expected**: Violation:
`ARCHITECTURE VIOLATION — layer violation: runtime → ui: apps/api may not import packages/ui-system`  
**Also
test**: `@zidney/api-client` (only in tsconfig.base.json) resolves to `packages/api-client`.

### FR-007 — AI-Guard Reads module-boundaries.json

**Test**: In integration, confirm `loadModuleBoundaries()` returns a non-null object. Confirm
`validateLayerBoundaries` is invoked in `runGuard()` when boundaries is non-null.  
**Unit test** `loadModuleBoundaries()` directly: test file-present case + return type + malformed
JSON → process.exit(1) spy.

### FR-008 — Undeclared Module Detection

**Covered by existing `infra-audit.ts`** after this stage updates its undeclared-module logic to
compare discovered modules against `module-boundaries.json`.  
**Test**: Create a temp directory `packages/fake-module` → run `bun run arch:audit` → verify output
contains `undeclared module: packages/fake-module`.

**Note**: The spec places FR-008 under `infra-audit.ts`, which is in scope for implementation but
only requires comparing `packages/*` and `apps/*` directory scan against `module-boundaries.json`
layers entries.

### FR-009 — CI Pipeline Integration

**Verified by**: Inspect `.github/workflows/ci.yml` and confirm:

- `arch-guard` job has step named `module-boundary-validation`
- Step runs `bun run ai-guard`
- Job `needs: [lint, typecheck]`
- `unit-tests` job `needs: [..., arch-guard]`

### FR-010 — Developer Local Check

**Test**: Run `bun run ai-guard` from repo root → verify exit code 0 on clean monorepo.  
**Also verify**: `package.json` contains `"ai-guard": "bun scripts/ai-guard.ts"`.

### FR-011 — New Module Registration Workflow

**Documented** in stage file as developer workflow steps (no code change).  
**Test**: Create `packages/test-unregistered` directory → run `bun run arch:audit` → verify
undeclared-module warning.

### FR-012 — Violation Error Format

**Violations from `validateLayerBoundaries` must include**:

- `ARCHITECTURE VIOLATION` prefix ✓ (all violation strings start with this)
- Source module path ✓ (e.g., `apps/mmc`)
- Target module path ✓ (e.g., `packages/domain-core`)
- Rule violated ✓ (e.g., `layer violation: ui → domain` or
  `cross-cutting rule [no_cross_app_imports]`)
- File path: provided by `runGuard()` via `${file}: ${v}` prefix ✓

**Unit test**: Assert violation string from `validateLayerBoundaries` matches the expected prefix
pattern.

---

## Implementation Order

The following sequence minimizes risk (each step is testable before the next proceeds):

### Step 1 — Create `docs/architecture/module-boundaries.json`

**Pre-condition**: None  
**Action**: Create the file with full content from the Data Model section  
**Verification**: `JSON.parse(readFileSync('docs/architecture/module-boundaries.json', 'utf-8'))`
succeeds. Count 13 modules across layers.

### Step 2 — Update `scripts/ai-guard.ts` — Types and Loaders

**Pre-condition**: Step 1 complete  
**Actions**:

- Update `node:fs` import to include `existsSync`
- Add `BOUNDARIES_PATH` constant
- Add `TsAliasMap`, `CrossCuttingRule`, `ModuleBoundaries` types
- Add `loadModuleBoundaries()` function
- Add `loadTsAliases()` function

**Verification**: Run `bun scripts/ai-guard.ts` → should still exit 0 (no behavior changes yet, new
functions not called yet).

### Step 3 — Add Helper Functions and `validateLayerBoundaries()`

**Pre-condition**: Step 2 complete  
**Actions**:

- Add `getLayerForModule()`, `resolveImportToModule()`, `matchesGlobPattern()`,
  `ruleSourceMatches()`, `ruleTargetMatches()`
- Add exported `validateLayerBoundaries()`

**Verification**: TypeScript type-check passes. Unit tests for `validateLayerBoundaries` pass.

### Step 4 — Integrate into `runGuard()`

**Pre-condition**: Step 3 complete  
**Actions**:

- Load `boundaries` and `aliases` in `runGuard()` after `loadArchitectureMap()`
- Call `validateLayerBoundaries` in file loop
- Add `layerBoundaryViolations` to violations push

**Verification**: Run `bun run arch:guard` against full monorepo → must exit 0 (SC-010: no
violations in current codebase). If violations are found, fix the source code causing them before
proceeding.

### Step 5 — Update `package.json`

**Pre-condition**: Step 4 verified (exit 0)  
**Action**: Add `"ai-guard": "bun scripts/ai-guard.ts"` to scripts  
**Verification**: `bun run ai-guard` → exit 0

### Step 6 — Update `.github/workflows/ci.yml`

**Pre-condition**: Step 5 complete  
**Action**: Rename step `"Run AI-Guard architecture check"` → `"module-boundary-validation"`, update
`run:` to `bun run ai-guard`  
**Verification**: Inspect YAML manually; check no YAML syntax errors.

### Step 7 — Update `infra-audit.ts` — Undeclared Module Detection (FR-008)

**Pre-condition**: Step 1 complete  
**Action**: In `infra-audit.ts`, load `module-boundaries.json` and in the existing module-scan
section, compare discovered `packages/*` and `apps/*` directories against entries in
`boundaries.layers`. Report any directory present on disk but absent from all layers as
`undeclared module`.  
**Verification**: Create temp directory `packages/canary-test-unregistered` → run
`bun run arch:audit` → verify undeclared-module warning → delete temp directory.

### Step 8 — Write Static + Unit Tests

**Pre-condition**: Steps 1–7 complete  
**Actions**:

- Static test: assert 13 modules in `module-boundaries.json`
- Unit tests for `validateLayerBoundaries` covering each violation type
- Unit test for `loadModuleBoundaries` missing file + malformed file cases
- Unit test for `resolveImportToModule` alias resolution cases (especially `@zidney/ui`,
  `@zidney/api-client`)

**`process.exit` spy pattern** (mandatory for all tests that trigger `process.exit(1)`):

```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  exitSpy = vi.spyOn(process, "exit").mockImplementation((_code?: number) => {
    throw new Error(`process.exit called with code ${_code}`);
  });
});

afterEach(() => {
  exitSpy.mockRestore();
});
```

This prevents `process.exit(1)` from terminating the Vitest runner during malformed-JSON and
missing-field error-path tests.

**Verification**: `vitest run tests/unit/ai-guard/ai-guard-boundaries.test.ts` passes.
`bun run test:static` passes.

### Step 9 — Final Validation

**Pre-condition**: Steps 1–8 complete  
**Actions**:

- `bun run lint` → exit 0
- `bun run typecheck` → exit 0
- `bun run ai-guard` → exit 0
- `bun run arch:audit` → 0 undeclared modules
- `vitest run tests/unit/ai-guard/ai-guard-boundaries.test.ts` → all pass (note: `test:unit`
  enumerates named workspace projects and excludes the root project where this test lives — use
  `vitest run` directly)

> **NFR-004 Performance Budget**: `bun run ai-guard` must complete in under 30 seconds on a full
> monorepo scan. Validated by T024 (wall-clock measurement). The implementation performs a
> single-pass file scan with O(n × m) complexity where n = source files and m = import statements
> per file; no recursive disk traversal or network calls. Expected runtime is well under 30 s for a
> monorepo of ≤ 200 source files on any CI runner.

**On success**: Mark stage `IN PROGRESS → BACKEND CLOSED`.

---

## Files Changed Summary

| File                                       | Action | Reason                                                 |
| ------------------------------------------ | ------ | ------------------------------------------------------ |
| `docs/architecture/module-boundaries.json` | CREATE | FR-001, FR-002, FR-003, FR-007                         |
| `scripts/ai-guard.ts`                      | MODIFY | FR-003, FR-004, FR-005, FR-006, FR-007, FR-010, FR-012 |
| `package.json`                             | MODIFY | FR-010                                                 |
| `.github/workflows/ci.yml`                 | MODIFY | FR-009                                                 |
| `scripts/infra-audit.ts`                   | MODIFY | FR-008                                                 |

### Files Explicitly NOT Changed

- `docs/architecture/intelligence/ARCHITECTURE_MAP.json` — preserved unchanged (NFR-003)
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` — preserved unchanged
- Any file in `apps/*` or `packages/*` runtime code — NFR-001 (no runtime impact)
- Any migration files — out of scope
- Any test infrastructure files — additions only in `tests/static/` and `tests/unit/`

---

## Constitution Check

This stage is an INFRA stage. Checking against project constitution rules:

| Rule                              | Status                                                         |
| --------------------------------- | -------------------------------------------------------------- |
| No tenant isolation changes       | ✓ PASS — pure tooling/governance                               |
| No business logic changes         | ✓ PASS — only scripts and JSON                                 |
| No new npm packages               | ✓ PASS — uses only existing node built-ins                     |
| No migration files                | ✓ PASS — not applicable                                        |
| No cross-layer imports introduced | ✓ PASS — fixes cross-layer enforcement, adds none              |
| Backward compatibility (NFR-003)  | ✓ PASS — graceful fallback if `module-boundaries.json` missing |
| Existing validators preserved     | ✓ PASS — 5 existing functions unchanged                        |
| Tests required                    | ✓ PLANNED — unit + static tests in Step 8                      |
| Lint/typecheck must pass          | ✓ PLANNED — Step 9 validation                                  |
