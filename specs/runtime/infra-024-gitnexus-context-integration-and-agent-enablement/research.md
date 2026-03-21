# Research: GitNexus Context Integration and Agent Enablement

**Stage:** INFRA-024  
**Phase:** 01_PLATFORM_FOUNDATION  
**Resolved:** 2026-03-18  
**Status:** ALL UNKNOWNS RESOLVED

---

## Research Summary

All clarifications from Step 2 (spec.md Clarifications section) and pre-plan Context7 MCP lookups have been resolved. No open questions remain. This file documents the final decisions and rationale for each researched topic.

---

## RES-001 — GitNexus CLI Invocation Strategy

**Decision:** Use `bun x gitnexus` (devDependency execution) for all GitNexus CLI invocations within scripts. Install as `bun add -D gitnexus` in root `package.json`.

**Rationale:**

- Consistent with Zidney's `bun`-managed reproducibility model.
- Ensures every developer and CI runner operates against the exact pinned version.
- Avoids global installation drift — no `PATH`-based version conflicts.
- `bun x` resolves the binary from `node_modules/.bin/`, respecting the lockfile version.

**Alternatives considered:**

- Global `npm install -g gitnexus` — rejected: not reproducible across environments, violates Zidney's devDependency model.
- `npx gitnexus` — rejected: may pull a different version if not pinned, slower resolution than `bun x`.

**CLI commands confirmed available (via pre-plan research):**

```
bun x gitnexus analyze [path]   # index/re-index repository
bun x gitnexus status           # show index status (human-readable text)
bun x gitnexus list             # list all indexed repositories
bun x gitnexus --help           # verify installation (exit 0)
```

---

## RES-002 — GitNexus Intelligence Delivery Mechanism

**Decision:** GitNexus exposes its intelligence primarily through MCP tools (`gitnexus_context`, `gitnexus_impact`, `gitnexus_query`), **not** through structured CLI JSON output. The wrapper script must NOT attempt to parse GitNexus CLI output as the primary data source.

**Rationale:**
The `scripts/gitnexus-context.ts` script must assemble context from multiple authoritative sources:

| Data Domain            | Source                                                                 |
| ---------------------- | ---------------------------------------------------------------------- | --- | --- | ----- |
| `changedFiles`         | `git diff --name-only HEAD~1 HEAD` or `git status --porcelain`         |
| `impactedModules`      | Derived from changedFiles → brain module mappings                      |
| `dependencyGraph`      | `docs/ai/context/ai-architecture-brain.json` → `dependencies` field    |
| `architectureLayerMap` | `docs/ai/context/ai-architecture-brain.json` → `modules` + `layers`    |
| `recentCommits`        | `git log --oneline -10 --format="%H                                    | %s  | %an | %ai"` |
| `riskIndicators`       | Computed: modules with > 2 dependents = elevated risk                  |
| GitNexus health        | `bun x gitnexus status` (string, non-JSON; used for health check only) |

**Alternatives considered:**

- Parsing GitNexus CLI JSON output directly — rejected: GitNexus CLI does not emit structured JSON for these data domains.
- Using GitNexus MCP tools from within the script — rejected: MCP tools are designed for AI agent consumption, not script automation.

---

## RES-003 — Full Replacement of Existing `scripts/gitnexus-context.ts`

**Decision:** The existing `scripts/gitnexus-context.ts` is a FULL REPLACEMENT. The old brain-printing logic (human-readable text output) is not carried forward.

**Rationale:**

- The existing script prints human-readable text from `ai-architecture-brain.json` — purely for developer debugging. This functionality is redundant given `scripts/generate-ai-context.ts`.
- The new script has a fundamentally different purpose: produce a **machine-readable structured JSON** at `docs/ai/context/gitnexus-context.json` for AI agent and orchestrator consumption.
- Attempting to extend the old script would create a hybrid with unclear responsibility boundaries.
- The `arch:context` and `arch:refresh` script keys in `package.json` already exist and point to `scripts/gitnexus-context.ts` — they will be preserved but now invoke the new implementation.

**Brain-reading concern:** The dependency graph and architecture layer data is still read from `ai-architecture-brain.json`, but only as structured data for the JSON output — not for printing to console.

---

## RES-004 — Output File Location

**Decision:** Output written to `docs/ai/context/gitnexus-context.json`.

**Rationale:**

- Consistent with the existing Zidney pattern — `ai-architecture-brain.json`, `ai-dependency-graph.json`, and other AI context files all reside in `docs/ai/context/`.
- Sub-agents and the orchestrator reference the context by file path.
- Keeping context files co-located simplifies the architecture-intelligence skill and validates against the stage-aware compression context-selection hierarchy.

---

## RES-005 — `riskIndicators` Object Shape

**Decision:**

```typescript
{
  module: string;       // e.g., "packages/domain-core"
  riskScore: number;    // 0–100
  reason: string;       // human-readable explanation for AI agents
  affectedBy: string[]; // contributing dependency chain (module identifiers)
}
```

**Risk scoring heuristic for the wrapper script:**

- A module with 0 dependents → `riskScore: 0`
- A module with 1–2 modules depending on it → `riskScore: 25`
- A module with 3–5 modules depending on it → `riskScore: 50`
- A module with 6+ modules depending on it → `riskScore: 75`
- A module listed in `brain.hotspots` → add 25 (capped at 100)

The `reason` field is constructed from the dependency count and hotspot status.

---

## RES-006 — CI Failure Conditions

**Decision:** `bun run gitnexus:validate` fails (non-zero exit) ONLY on:

1. Non-zero exit code from any CLI command invoked by the script.
2. JSON schema structure violation (invalid types, missing required keys).
3. Unhandled script execution error.

An empty but structurally valid output (e.g., `changedFiles: []`) is **always a passing condition** (exits 0).

**Rationale:** A clean git tree legitimately produces `changedFiles: []`. Treating this as a failure would cause spurious CI failures on branches with no changed files (e.g., documentation-only PRs or fresh branches).

---

## RES-007 — `ai-architecture-brain.json` Schema (Confirmed Structure)

From reading `docs/ai/context/ai-architecture-brain.json`:

```json
{
  "schema_version": "1.0.0",
  "generated_at": "ISO timestamp",
  "metadata": { "total_modules": number, ... },
  "layers": [{ "name": string, "description": string, "order": number }],
  "modules": ["apps/mmc", "packages/domain-core", ...],
  "rules": {},
  "dependencies": {
    "<module>": {
      "imports": ["<dep-module>", ...],
      "imported_by": ["<dep-module>", ...],
      "violations": []
    }
  }
}
```

The wrapper script uses:

- `brain.modules` → full module list for `impactedModules` filtering
- `brain.dependencies[module].imports` → `dependencyGraph` construction
- `brain.layers` → `architectureLayerMap` prefix matching
- `brain.hotspots` → `riskIndicators` scoring (field may be absent — guarded with `?.`)

---

## RES-008 — Existing `package.json` Script Conflicts

**Finding:** `package.json` already has two relevant scripts:

```json
"arch:context": "bun scripts/gitnexus-context.ts",
"arch:refresh": "bun scripts/infra-audit.ts && bun scripts/gitnexus-context.ts"
```

These must be preserved. Two **new** script keys are added:

```json
"gitnexus:context": "bun scripts/gitnexus-context.ts",
"gitnexus:validate": "bun scripts/validate/validate-gitnexus.ts"
```

The spec requires `gitnexus:context` (FR-002) and `gitnexus:validate` (FR-008) as the canonical script names. The existing `arch:context` and `arch:refresh` aliases remain and benefit from the script replacement.

---

## RES-009 — Test Strategy

**Decision:** Tests in `tests/gitnexus-context.test.ts` use mocks/fixtures to avoid git state dependency.

**Test fixture approach:**

- Create a mock `ai-architecture-brain.json` fixture in `tests/fixtures/gitnexus/`.
- Mock `execSync`/`spawnSync` for git commands to return deterministic output.
- Import the core logic from the script as functions (the script exports testable functions alongside `main()`).
- This requires the script to export: `detectChangedFiles()`, `buildDependencyGraph()`, `buildArchitectureLayerMap()`, `extractGitHistory()`, `computeRiskIndicators()`.

**Vitest** is the project test framework (confirmed from `package.json`).

---

## RES-010 — NFR Compliance Checklist

| NFR     | Requirement                       | Implementation approach                                                                     |
| ------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| NFR-001 | Script governance (JSDoc headers) | Both scripts include `@script`, `@domain`, `@description`, `@mode`, `@dependencies`         |
| NFR-002 | No `console.log`                  | Use `process.stdout.write(JSON.stringify(...))` for output; `console.error` for errors only |
| NFR-003 | Scoped analysis (< 30s)           | Default: changed files only via `git diff`; full-scan is `--all` flag                       |
| NFR-004 | No secrets                        | No tokens/credentials — git commands are local only                                         |
| NFR-005 | JSON determinism                  | Sort file paths alphabetically; commits chronologically                                     |
| NFR-006 | AGENTS.md backward compatibility  | Additive section insertion only — no existing rules removed                                 |

---

## RES-011 — Architecture Layer Assignment Strategy

**Decision:** Module-to-layer assignment is derived by matching the module path prefix against known layer membership.

From `ai-architecture-brain.json` `modules` + `layers`:

- `apps/mmc` → layer `ui` (Vite/Vue app)
- `apps/frontoffice` → layer `ui`
- `apps/backoffice` → layer `ui`
- `apps/api` → layer `runtime`
- `apps/worker` → layer `runtime`
- `packages/domain-core` → layer `domain`
- `packages/types` → layer `domain`
- `packages/validation` → layer `domain`
- `packages/logger` → layer `infrastructure`
- `packages/config` → layer `infrastructure`
- `packages/redis-utils` → layer `infrastructure`
- `packages/job-queue` → layer `infrastructure`
- `packages/ui-system` → layer `ui`
- `packages/api-client` → layer `domain`

Layer assignment logic: check `brain.layers` + derive from module prefix using ARCHITECTURE_MAP.json or a hardcoded fallback map in the script (with a comment noting it mirrors the architecture brain).

---

## Open Items

None. All research questions resolved. Implementation may proceed.
