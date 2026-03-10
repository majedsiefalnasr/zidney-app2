# Research: STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION

**Stage**: `STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION`  
**Phase**: `01_PLATFORM_FOUNDATION`  
**Research Completed**: 2026-03-09

---

## Summary

This file resolves all technical unknowns identified during the planning phase. All NEEDS
CLARIFICATION items are fully resolved based on direct inspection of the codebase.

---

## R-001 — Actual `dependency-graph.json` Schema

**Status**: RESOLVED

**Decision**: The file at `docs/architecture/graphs/dependency-graph.json` has the following schema:

```typescript
interface DependencyGraph {
  nodes: string[];
  edges: { from: string; to: string }[];
}
```

**Actual data observed**:

- `nodes` is a flat `string[]` containing a mix of:
  - Top-level module paths: `"packages/types"`, `"apps/mmc"`, `"apps/api"`, etc.
  - Deep submodule paths: `"./apps/mmc/src/core/auth/token-manager"`,
    `"./apps/mmc/srcvue/test-utils"`, etc.
  - Artifact-like entries: `"packages/app"`, `"packages/ui"` (not in ARCHITECTURE_MAP.json)
- `edges` is `{ from: string; to: string }[]` where both `from` and `to` can be any node string
- Duplicate edges are present (e.g., `packages/redis-utils → packages/logger` appears 3 times)
- No additional fields (no `metadata`, no `version`, no `generatedAt`)

**Filtering rule confirmed**: Top-level modules are identified by matching `^(apps|packages)/[^/]+$`
— exactly two slash-separated segments with the first being `apps` or `packages`. Paths starting
with `./` are always deep submodule paths and must be excluded.

**Unregistered top-level nodes observed**: `packages/app` and `packages/ui` appear in `nodes` but
are absent from `ARCHITECTURE_MAP.json` and the FR-007 heuristic table. Per spec Clarification Q2,
these must be classified as "unknown" and placed in an `Unknown` subgraph with a warning emitted.

---

## R-002 — Actual `ARCHITECTURE_MAP.json` Schema

**Status**: RESOLVED

**Decision**: The file at `docs/architecture/intelligence/ARCHITECTURE_MAP.json` has the following
schema:

```typescript
interface ArchitectureMap {
  system: string;
  architecture_model: string;
  version: string;
  layers: string[];
  modules: Record<
    string,
    {
      layer: string;
      description: string;
      criticality: string;
      allowed_dependencies: string[];
      forbidden_dependencies: (string | "apps/*")[];
    }
  >;
}
```

**13 registered modules observed**:

| Module                 | Layer            |
| ---------------------- | ---------------- |
| `packages/types`       | `domain`         |
| `packages/logger`      | `infrastructure` |
| `packages/config`      | `infrastructure` |
| `packages/redis-utils` | `infrastructure` |
| `packages/ui-system`   | `ui`             |
| `packages/api-client`  | `infrastructure` |
| `packages/domain-core` | `domain`         |
| `packages/validation`  | `domain`         |
| `apps/mmc`             | `ui`             |
| `apps/frontoffice`     | `ui`             |
| `apps/backoffice`      | `ui`             |
| `apps/api`             | `runtime`        |
| `apps/worker`          | `runtime`        |

**Layer classification source**: `modules[modulePath].layer` — a plain string value (`"domain"`,
`"infrastructure"`, `"runtime"`, `"ui"`).

**Note**: `ARCHITECTURE_MAP.json` classifies `packages/types` as `domain`, while
`module-boundaries.json` (introduced in INFRA-07) classifies it as `infrastructure`. The
visualization script reads from `ARCHITECTURE_MAP.json` only — it does not read
`module-boundaries.json`. The layer values in the visualization diagrams will reflect
`ARCHITECTURE_MAP.json` classifications.

---

## R-003 — Existing `scripts/architecture/` Script Patterns

**Status**: RESOLVED

**Scripts examined**:

1. `scripts/architecture/generate-architecture-map.ts` — 120 lines
2. `scripts/architecture/add-module.ts` — 45 lines

**Patterns to follow**:

- Both scripts use `import { ... } from 'node:fs'` and `import { ... } from 'node:path'`
- Both use `const ROOT = process.cwd()` for repository root resolution
- Both use `join(ROOT, ...)` for all file paths
- Both use `existsSync()` before reading optional files
- Both use `readFileSync(path, 'utf-8')` + `JSON.parse()` for JSON loading
- Both use `writeFileSync()` for output (synchronous)
- No TypeScript type annotations on function return values (inferred) — but we will use explicit
  types for exported functions (required by strict mode and unit testability)
- No `// CLI utility — exempt from service-layer logging standards.` comment observed in existing
  scripts, but spec FR-001 requires it for `visualize.ts`
- No `export` statements in existing scripts (all are CLI-only). Our script differs: it must export
  named functions for unit testing.

**No existing `visualize.ts`** — confirmed the file does not yet exist.

---

## R-004 — Bun File APIs

**Status**: RESOLVED

**Decision**: Use Node.js built-in `node:fs` APIs exclusively (`readFileSync`, `writeFileSync`,
`existsSync`, `mkdirSync`) — NOT `Bun.file()` / `Bun.write()`.

**Rationale**: All existing scripts in `scripts/architecture/` use `node:fs` imports. The
`vitest.workspace.ts` test configuration runs tests via Vitest (not Bun test runner), meaning test
files must import the script and call its exports — which works identically with Node.js built-ins.
Using `Bun.file()`/`Bun.write()` would introduce a Bun-only API that cannot be mocked in Vitest
tests without additional shimming. Node.js built-ins are universally mockable via
`vi.mock('node:fs')` as used in `tests/unit/ai-guard/ai-guard-boundaries.test.ts`.

**`node:child_process` for git SHA**: Use
`execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()` — wrapped in try/catch to gracefully
fall back to `'unknown'` if not in a git repository.

---

## R-005 — Package.json `arch:` Script Family

**Status**: RESOLVED

**Current `arch:` scripts** (from `package.json`):

```json
"arch:add-module": "bun scripts/architecture/add-module.ts",
"arch:generate": "bun scripts/architecture/generate-architecture-map.ts",
"arch:audit": "bun scripts/infra-audit.ts",
"arch:context": "bun scripts/gitnexus-context.ts",
"arch:refresh": "bun scripts/infra-audit.ts && bun scripts/gitnexus-context.ts",
"arch:fix": "bun scripts/infra-audit.ts --fix-map",
"arch:guard": "bun scripts/ai-guard.ts"
```

**New entry to add** (per spec FR-009):

```json
"arch:visualize": "bun scripts/architecture/visualize.ts"
```

**Placement**: After `arch:guard` (alphabetical within the `arch:` group). The `arch:refresh` script
is **not modified** (confirmed by spec Clarification Q1).

---

## R-006 — Static Test Numbering

**Status**: RESOLVED

**Existing numbered static tests**:

- `04-migration-discipline.test.ts`
- `05-architecture-guard.test.ts`
- `module-boundaries.test.ts` (unnumbered)

**New file**: `tests/static/06-architecture-visualization.test.ts` — confirmed sequence number 06
per spec Clarification Q3.

---

## R-007 — TypeScript Configuration for Scripts

**Status**: RESOLVED

**From `tsconfig.base.json`**: Strict mode is enabled (`"strict": true`). Scripts must comply.

**Script compilation**: Scripts are run directly via `bun` (JIT compilation) — no separate `tsc`
compilation step for scripts. Type checking for scripts is included in `typecheck:src`
(`tsc --noEmit`).

**Export pattern for unit testing**: Functions must use `export function` at the module level,
consistent with how `ai-guard.ts` and `infra-audit.ts` export their testable functions.

---

## R-008 — Mermaid Output Format

**Status**: RESOLVED

**Decision**: Use `flowchart TD` (not `graph TD`) — both are valid Mermaid syntax and produce the
same result. The spec uses both terms ("Mermaid `graph TD` diagram" in FRs, "Mermaid `flowchart TD`"
in AGENTS.md Important Notes). We use `flowchart TD` as specified in Important Notes.

**Node ID sanitization rule**: Replace `/` and `-` with `_`.

- `apps/api` → `apps_api`
- `packages/domain-core` → `packages_domain_core`
- `packages/redis-utils` → `packages_redis_utils`

**Node label format**: `nodeId["display/path"]` — e.g., `apps_api["apps/api"]`

**Subgraph format**:

```mermaid
subgraph UI["UI Layer"]
  apps_mmc["apps/mmc"]
end
```

**Edge format**: `apps_mmc["apps/mmc"] --> packages_api_client["packages/api-client"]`

---

## R-009 — System Overview Diagram — Hardcoded Content

**Status**: RESOLVED

**Decision**: The `generateSystemOverview()` function returns a fully hardcoded Mermaid string. It
takes no parameters. The content reflects the Zidney trust chain model:

Trust chain: MMC → API, Backoffice → API, Frontoffice → API, API → Worker.

Foundation subgraph: `domain-core`, `logger`, `types`, `config`, `redis-utils`.

Additional connections: API → Foundation, Worker → Foundation.

This is confirmed by spec Clarification Q4 and FR-006.

---

## R-010 — Git SHA Retrieval for README

**Status**: RESOLVED

**Implementation pattern**:

```typescript
import { execSync } from "node:child_process";

function getGitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}
```

This is consistent with the zero-external-dependency requirement (FR-010) and uses
`node:child_process` which is a Node.js built-in.

---

## R-011 — Edge Cases from Spec

**Status**: RESOLVED

| Edge Case                                             | Resolution                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Zero edges in dependency-graph.json                   | Produce valid Mermaid with only node declarations, no edge lines                                                  |
| Module in graph but absent from ARCHITECTURE_MAP.json | Place in `Unknown` subgraph, emit `[VISUALIZE] WARNING: No layer found for module <path> — classified as Unknown` |
| `docs/architecture/visualization/` does not exist     | Create with `mkdirSync(path, { recursive: true })` before any writes                                              |
| Files already exist from previous run                 | Silently overwrite — same input always produces same output (FR-011)                                              |
| Deep submodule paths alongside top-level paths        | Filter using `^(apps                                                                                              | packages)/[^/]+$` regex — keep only exactly-two-segment paths |

---

## All NEEDS CLARIFICATION items resolved

No outstanding unknowns remain. Implementation planning may proceed.
