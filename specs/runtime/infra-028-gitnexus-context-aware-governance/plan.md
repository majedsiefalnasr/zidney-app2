# Implementation Plan: INFRA-28 — GitNexus Context-Aware Governance

**Stage:** INFRA-28
**Phase:** 01_PLATFORM_FOUNDATION
**Spec:** `specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md`
**Branch:** `spec/infra-028-gitnexus-context-aware-governance`
**Risk Level:** LOW (score 1)
**Date:** 2026-03-25

---

## Stage Alignment

- **Phase:** 01_PLATFORM_FOUNDATION
- **Stage:** INFRA-28 — GitNexus Context-Aware Governance
- **Related Spec File:** `specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md`
- **Related ADR:** None required — pure tooling stage, no architecture boundary changes, no new packages

Plan must not introduce architecture outside defined Stage scope.

---

## Architectural Scope Confirmation

| Check | Status | Notes |
|-------|--------|-------|
| No cross-tenant data access | ✅ CONFIRMED | Scripts operate at workspace level only |
| No middleware bypass | ✅ N/A | No HTTP layer touched |
| No direct DB instantiation | ✅ N/A | No database — pure filesystem + git |
| No grading logic outside Worker | ✅ N/A | No attempt/grading concern |
| No weakening of snapshot integrity | ✅ N/A | Not applicable |
| No weakening of version enforcement | ✅ N/A | Not applicable |
| No layer boundary violation | ✅ CONFIRMED | `scripts/context/` is a pure scripting layer — no `apps/*` imports |

**No ADR required.** This is a pure tooling stage (scripts + CI config + git hooks).

---

## Architecture Overview

### Component Map

```
scripts/
  context/
    build.ts           <- wraps assembleContext() + atomic write
    changed.ts         <- git diff --cached -> context-changed.json (< 5min cache)
    impact.ts          <- reads context artifacts -> synthesizes context-impact.json
    validate.ts        <- validates gitnexus-context.json against schema
    validate.test.ts   <- unit tests for validate (8 cases)
  gitnexus-context.ts  (UNCHANGED -- existing script)
  governance/
    gate.ts            (MODIFIED -- prepend 2 new guards)

docs/ai/context/
  gitnexus-context.json    (written by context:build / arch:gitnexus:context)
  context-changed.json     (written by context:changed)
  context-impact.json      (written by context:impact)
docs/ai/gitnexus-context.schema.json  (READ-ONLY -- source of truth for validate)

.husky/pre-commit          (MODIFIED -- insert context:changed + context:validate)
.github/workflows/architecture-governance.yml  (MODIFIED -- insert build+validate step)
package.json               (MODIFIED -- add 4 scripts + update governance:gate:changed)
docs/scripts/              (NEW -- 4 registry entries)
```

### Data Flow

```
Pre-commit hook:
  staged detection
  -> lint-staged
  -> TS incremental check
  -> context:changed -> context-changed.json (< 5min cache)  [NEW]
  -> context:validate -> validates gitnexus-context.json     [NEW]
  -> arch:guard:changed
  -> arch brain validation
  -> Trivy dep scan
  -> Trivy secret scan

governance:gate (full chain):
  context:build -> gitnexus-context.json (atomic write)    [NEW guard 0]
  context:validate -> validates artifact                   [NEW guard 1]
  arch:guard -> [existing 6 guards unchanged]

governance:gate:changed:
  context:changed -> context-changed.json
  -> arch:guard:changed

CI (architecture-governance.yml):
  bun install
  context:build && context:validate   [NEW STEP]
  -> existing steps unchanged
```

---

## Implementation Layers

### API Layer

**Not applicable.** No API routes, middleware, or endpoints are introduced.

### Worker Layer

**Not applicable.** No queue, async jobs, or background processing.

### Frontend Layer

**Not applicable.** No UI components or pages.

### Infrastructure/Tooling Layer (primary scope)

All work is confined to:

1. `scripts/context/` — 4 new TypeScript script files + 1 test file
2. `scripts/governance/gate.ts` — prepend 2 guards to GUARDS array
3. `.husky/pre-commit` — insert `context:changed` + `context:validate` invocations
4. `.github/workflows/architecture-governance.yml` — insert 1 new step
5. `package.json` — add 4 scripts + update 1 existing script
6. `docs/scripts/` — register 4 new scripts

---

## Database Impact

**None.** This stage introduces no schema changes, no migrations, and touches no database.

- Master DB: No tables touched. No migration required.
- Tenant DB: No tables touched. No migration required.

---

## Transaction Design

**Not applicable.** This stage performs no mutating database operations.

All state written by scripts is filesystem-only. Atomic write pattern used throughout:

```typescript
writeFileSync(tmpPath, JSON.stringify(artifact, null, 2), 'utf8')
renameSync(tmpPath, outputPath)  // atomic on POSIX -- no partial artifact
```

---

## Idempotency Plan

| Script | Idempotency Mechanism |
|--------|----------------------|
| `context:build` | `--force` bypasses freshness; default re-generates if >24h old. Atomic write prevents partial state. |
| `context:changed` | Freshness check: return cached if `context-changed.json` < 5 min old (exit 0). |
| `context:impact` | Deterministic from inputs — re-run safe. |
| `context:validate` | Pure read — no writes. Inherently idempotent. |

No endpoint idempotency applies (no HTTP layer).

---

## Version Enforcement Strategy

**Not applicable to HTTP requests.**

Exception: `context:validate` enforces `schemaVersion` consistency:
- Reads `schema.version` from `docs/ai/gitnexus-context.schema.json`
- Compares against `artifact.schemaVersion`
- On mismatch: `[context:validate] FAIL: schemaVersion mismatch — artifact='<x>', expected='<y>'` → exit 1

---

## Authoritative Time Handling

`context:changed` and `context:build` use `new Date().toISOString()` for `generatedAt` timestamps.
Freshness checks are developer-machine/CI context. No user-facing time authority. No client clock used.

---

## Observability & Logging

All scripts emit named diagnostic logs to stdout:

```
[context:build]    OK Written: docs/ai/context/gitnexus-context.json
[context:changed]  OK 3 staged files resolved and cached
[context:impact]   OK 2 impacted modules found
[context:validate] OK artifact valid (schemaVersion=1.0.0, age=4m)
```

Error format (named diagnostics — no stack traces):

```
[context:validate] FAIL: missing required field 'changedFiles'
[context:build]    FAIL: assembleContext failed — ai-architecture-brain.json not found
```

---

## Rate Limiting

**Not applicable.** No network requests. No HTTP endpoints introduced.

---

## Failure Modes

| Failure Mode | Script | Behavior |
|---|---|---|
| `gitnexus-context.json` not found | `context:validate`, `context:impact` | Named diagnostic + exit 1 |
| Artifact stale (>24h) | `context:validate` | `FAIL: artifact is stale (<N>h old) — run context:build to refresh` + exit 1 |
| Schema version mismatch | `context:validate` | `FAIL: schemaVersion mismatch` + exit 1 |
| Required field missing | `context:validate` | `FAIL: missing required field 'x'` + exit 1 |
| `assembleContext()` throws | `context:build` | `FAIL: assembleContext failed — <message>` + exit 1 |
| git command unavailable | `context:changed` | `FAIL: git is unavailable — <error>` + exit 1 |
| Atomic write fails | `context:build`, `context:changed` | `FAIL: atomic write failed — <error>` + exit 1 |
| Clean tree (0 staged files) | `context:changed` | Write `changedFiles: []`, exit 0 (not an error) |
| Missing schema file | `context:validate` | `FAIL: schema file not found` + exit 1 |

---

## Security Review

| Check | Status | Notes |
|-------|--------|-------|
| RBAC enforcement server-side | N/A | Scripts run in CI/CLI — no RBAC |
| No role checks in frontend | N/A | No frontend |
| No secrets exposed | CONFIRMED | No env vars, tokens, or credentials in scripts |
| JWT workspace scope enforced | N/A | No HTTP |
| No sensitive data in logs | CONFIRMED | Logs contain only file paths + artifact metadata |
| No shell injection | CONFIRMED | `execFileSync` with arg arrays — no string interpolation |
| No arbitrary file read | CONFIRMED | Scripts read only declared fixed paths |

`context:changed` uses `execFileSync('git', ['diff', '--cached', ...], { encoding: 'utf8' })` — NOT `exec()`. No shell injection vector.

---

## New Files — Detailed Design

### 1. `scripts/context/build.ts`

File header:

```typescript
/**
 * @script context:build
 * @domain context
 * @category governance
 * @description Generates docs/ai/context/gitnexus-context.json via assembleContext().
 *   Atomic write (tmp -> rename). Supports --dry-run, --all, --force.
 * @usage bun run context:build [-- --dry-run] [-- --all] [-- --force]
 */
```

CLI args: `--dry-run`, `--all`, `--force`

Logic:
1. Parse CLI args from `process.argv`
2. Build `AssembleOptions` from flags
3. Call `assembleContext(options)` → `GitNexusContext`
4. If `--dry-run`: print JSON to stdout, exit 0
5. Write to `<OUTPUT>.tmp`, then `renameSync` to `OUTPUT_PATH`
6. Log `[context:build] OK Written: docs/ai/context/gitnexus-context.json`, exit 0

Output path: `docs/ai/context/gitnexus-context.json`

Imports:
- `node:fs`: `existsSync`, `renameSync`, `writeFileSync`
- `node:path`: `resolve`
- `../gitnexus-context.ts`: `assembleContext` (value), `AssembleOptions` (type-only)

---

### 2. `scripts/context/changed.ts`

File header:

```typescript
/**
 * @script context:changed
 * @domain context
 * @category governance
 * @description Resolves staged changed files (git diff --cached) and caches to
 *   docs/ai/context/context-changed.json with < 5-minute freshness.
 * @usage bun run context:changed
 */
```

Output schema:
```typescript
interface ContextChangedArtifact {
  generatedAt: string     // ISO 8601
  changedFiles: string[]  // stable-sorted relative paths
}
```

Logic:
1. Read existing artifact if present; if `generatedAt` < 5 min ago → log cache hit, exit 0
2. `execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], { encoding: 'utf8' })`
3. Split output by newline, trim, filter empty, sort
4. Write `ContextChangedArtifact` atomically (`.tmp` + `renameSync`)
5. Log `[context:changed] OK <N> staged files resolved and cached`, exit 0
6. Clean tree: `changedFiles: []` — write artifact, exit 0 (not an error)

Imports: `node:child_process`, `node:fs`, `node:path`

---

### 3. `scripts/context/impact.ts`

File header:

```typescript
/**
 * @script context:impact
 * @domain context
 * @category governance
 * @description Synthesizes risk indicators from gitnexus-context.json filtered
 *   by context-changed.json. Writes context-impact.json.
 * @usage bun run context:impact [-- --json]
 */
```

Output schema:
```typescript
interface ContextImpactArtifact {
  generatedAt: string
  riskIndicators: RiskIndicator[]
}
```

`--json` flag: print `riskIndicators` as JSON array to stdout.
Default: one module path per sorted line.

Logic:
1. Read `gitnexus-context.json` → `GitNexusContext` (exit 1 if missing — named diagnostic)
2. Read `context-changed.json` → fallback to `gitnexus-context.changedFiles` if missing
3. Filter `riskIndicators` whose `affectedBy` set intersects `changedFiles`
4. Write `ContextImpactArtifact` atomically
5. Write output based on flag, exit 0

Imports: `node:fs`, `node:path`, type imports from `../gitnexus-context.ts`

---

### 4. `scripts/context/validate.ts`

File header:

```typescript
/**
 * @script context:validate
 * @domain context
 * @category governance
 * @description Validates docs/ai/context/gitnexus-context.json against
 *   docs/ai/gitnexus-context.schema.json. No external schema library (NFR-005).
 * @usage bun run context:validate
 */
```

Logic (ordered — stops at first failure):
1. Check artifact exists (`docs/ai/context/gitnexus-context.json`) → exit 1 if missing
2. Parse JSON → exit 1 if invalid
3. Read schema (`docs/ai/gitnexus-context.schema.json`) → extract `schema.required` and `schema.version`
4. For each field in `schema.required`: check `artifact[field] !== undefined` → exit 1 with field name
5. Check `artifact.schemaVersion === schema.version` → exit 1 on mismatch
6. Parse `artifact.generatedAt` → compute age in hours → exit 1 if > 24
7. All pass → log success, exit 0

Imports: `node:fs` (`existsSync`, `readFileSync`), `node:path` (`resolve`)
No external libraries.

---

## Test Strategy

### Unit Tests (`scripts/context/validate.test.ts`)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('context:validate', () => {
  it('exits 0 for a valid, fresh artifact matching all required fields')
  it('exits 1 when artifact file does not exist')
  it('exits 1 when artifact file contains invalid JSON')
  it.each(['schemaVersion','generatedAt','analysisMode','changedFiles',
           'impactedModules','dependencyGraph','architectureLayerMap',
           'recentCommits','riskIndicators'])(
    'exits 1 when required field "%s" is missing from artifact', (field) => { ... }
  )
  it('exits 1 when artifact.schemaVersion does not match schema.version')
  it('exits 1 when generatedAt is older than 24 hours')
  it('exits 0 when artifact is exactly 23h 59m old (boundary)')
  it('exits 1 when artifact is exactly 24h 1m old (boundary)')
})
```

### Cross-script Integration (manual)

```sh
# AC-01: build -> validate succeeds
bun run context:build && bun run context:validate   # expect exit 0

# AC-02: staged-file resolution
git add <file>
bun run context:changed   # expect exit 0, context-changed.json written

# AC-05: governance:gate passes with all 8 guards
bun run governance:gate   # expect all pass
```

---

## Script Registry

| Script | Docs file |
|--------|-----------|
| `context:build` | `docs/scripts/context-build.md` |
| `context:changed` | `docs/scripts/context-changed.md` |
| `context:impact` | `docs/scripts/context-impact.md` |
| `context:validate` | `docs/scripts/context-validate.md` |

---

## Implementation Order (Dependency-first)

1. `scripts/context/validate.ts` — no external deps; foundational validation logic
2. `scripts/context/build.ts` — depends on existing `assembleContext()` from `gitnexus-context.ts`
3. `scripts/context/changed.ts` — standalone; only `node:child_process` + `node:fs`
4. `scripts/context/impact.ts` — depends on outputs of `context:build` + `context:changed`
5. `scripts/context/validate.test.ts` — unit tests for validate
6. `package.json` — register 4 scripts; update `governance:gate:changed`
7. `scripts/governance/gate.ts` — prepend 2 guards to GUARDS array
8. `.husky/pre-commit` — insert `context:changed` + `context:validate`
9. `.github/workflows/architecture-governance.yml` — insert `context:build && context:validate` step
10. `docs/scripts/context-*.md` — 4 registry documentation files

---

## Files Created / Modified Summary

| File | Action | Notes |
|------|--------|-------|
| `scripts/context/build.ts` | CREATE | Wraps `assembleContext()`, atomic write, --dry-run |
| `scripts/context/changed.ts` | CREATE | git diff --cached -> context-changed.json, 5min cache |
| `scripts/context/impact.ts` | CREATE | Filters riskIndicators -> context-impact.json |
| `scripts/context/validate.ts` | CREATE | Schema + required field + freshness validation |
| `scripts/context/validate.test.ts` | CREATE | 8 unit tests covering all exit paths |
| `docs/scripts/context-build.md` | CREATE | Script registry entry |
| `docs/scripts/context-changed.md` | CREATE | Script registry entry |
| `docs/scripts/context-impact.md` | CREATE | Script registry entry |
| `docs/scripts/context-validate.md` | CREATE | Script registry entry |
| `package.json` | MODIFY | Add 4 `context:*` scripts; update `governance:gate:changed` |
| `scripts/governance/gate.ts` | MODIFY | Prepend 2 new guards to GUARDS array |
| `.husky/pre-commit` | MODIFY | Insert context:changed + context:validate before arch guard |
| `.github/workflows/architecture-governance.yml` | MODIFY | Insert build+validate step after install |

**Files NOT modified:**
- `scripts/gitnexus-context.ts` — left unchanged; existing `arch:gitnexus:context` also unchanged
- `docs/ai/gitnexus-context.schema.json` — read-only source of truth

---

## Rollback Strategy

All changes are purely additive:
- Delete `scripts/context/` directory → existing behavior fully restored
- Revert `governance:gate:changed` in `package.json` to `bun run arch:guard:changed`
- Remove 2 prepended entries from `gate.ts` GUARDS array
- Remove inserted block from `.husky/pre-commit`
- Remove inserted step from CI workflow

No migrations. No persistent data state. Zero data risk.

---

## Non-Goals

- Not replacing `arch:gitnexus:context` — `context:build` is a governance-scoped wrapper using the same `assembleContext()` call
- Not modifying `gitnexus-context.ts` — existing engine used as-is
- Not introducing new npm/bun packages — no new `package.json` dependencies (NFR-005)
- Not implementing BFS traversal from scratch — `context:impact` filters `assembleContext()`'s pre-computed `riskIndicators`

---

## Final Compliance Statement

Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.
