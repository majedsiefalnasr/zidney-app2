# GitNexus Integration Guide

GitNexus is the authoritative internal code-context system for Zidney. It indexes the repository's
symbol graph, execution flows, and module relationships and exposes them to AI agents via MCP,
context artifacts, and CLI queries.

---

## Quick Reference

| Command                          | Purpose                                           |
| -------------------------------- | ------------------------------------------------- |
| `bun run arch:gitnexus:context`  | Generate `docs/ai/context/gitnexus-context.json`  |
| `bun run arch:gitnexus:validate` | Validate the artifact against the schema          |
| `npx gitnexus analyze`           | Re-index the repository (run when index is stale) |
| `gitnexus status`                | Check CLI health and index freshness              |

---

## Context Artifact

The `gitnexus-context.json` artifact at `docs/ai/context/gitnexus-context.json` is the primary
machine-readable output of this integration.

**Schema:** `docs/ai/gitnexus-context.schema.json` (JSON Schema Draft-07)

**Required fields:**

| Field                  | Type                         | Description                               |
| ---------------------- | ---------------------------- | ----------------------------------------- |
| `schemaVersion`        | string                       | Artifact format version                   |
| `generatedAt`          | string (ISO 8601)            | When the artifact was generated           |
| `analysisMode`         | `"changed-only"` \| `"full"` | Scope of analysis                         |
| `changedFiles`         | string[]                     | Files changed since base ref (sorted)     |
| `impactedModules`      | string[]                     | Modules containing changed files (sorted) |
| `dependencyGraph`      | object                       | Module → dependencies map                 |
| `architectureLayerMap` | object                       | Module → layer name map                   |
| `recentCommits`        | RecentCommit[]               | Last 10 commits (newest first)            |
| `riskIndicators`       | RiskIndicator[]              | Per-module risk scores (sorted desc)      |

---

## Generator Script

**File:** `scripts/gitnexus-context.ts`  
**Script key:** `gitnexus:context`

```bash
bun run arch:gitnexus:context                     # changed files only (default)
bun run arch:gitnexus:context -- --all            # full workspace scan
bun run arch:gitnexus:context -- --dry-run        # preview JSON without writing
bun run arch:gitnexus:context -- --base-ref HEAD~3  # custom comparison base
```

The generator:

1. Reads `docs/ai/context/ai-architecture-brain.json` for module/layer/dependency topology.
2. Calls `git diff --name-only <base-ref> HEAD` to detect changed files.
3. Maps changed files to their parent modules using prefix matching.
4. Builds a scoped dependency graph and architecture layer map.
5. Extracts recent commit history (`git log --format=%H|%s|%an|%aI -10`).
6. Computes per-module risk indicators based on hotspot scores and file churn.
7. Writes the assembled JSON artifact to `docs/ai/context/gitnexus-context.json`.

**Security notes:**

- `--base-ref` is validated against `/^[a-zA-Z0-9._\-/^~]+$/` before passing to git.
- `--output` path is resolved and validated to remain within the workspace root.
- All `git` invocations use `execFileSync` with argument arrays (no shell interpolation).

---

## Validator Script

**File:** `scripts/validate/validate-gitnexus.ts`  
**Script key:** `gitnexus:validate`

Runs a 5-step validation pipeline and exits with code 0 (pass) or 1 (fail).

See `docs/ci/gitnexus-validation.md` for full pipeline documentation.

---

## Freshness Policy

The artifact is considered **stale** if older than 24 hours.

`bun run arch:gitnexus:validate` will fail with a `freshness` error for stale artifacts.

Regenerate before:

- Starting `speckit.implement` (Step 6 in Hard Mode workflow)
- Running CI gates
- Any AI agent task requiring impact analysis

---

## AI Agent Integration

AI agents operating inside Zidney MUST:

1. Check `docs/ai/context/gitnexus-context.json` before impact analysis.
2. Use `impactedModules` to scope blast-radius reasoning.
3. Use `dependencyGraph` to identify transitive dependencies.
4. Use `riskIndicators` to prioritize review focus.
5. Treat `recentCommits` as supporting context for change attribution.

If the artifact is missing or stale, agents MUST regenerate before consuming it.

---

## Background: Architecture Brain

The generator depends on `docs/ai/context/ai-architecture-brain.json`, produced by `infra-audit.ts`.

If modules or layers appear incorrect in the context artifact, regenerate the brain first:

```bash
bun run arch:audit   # regenerates ai-architecture-brain.json
bun run arch:gitnexus:context  # then regenerate context artifact
```

---

## Troubleshooting

| Symptom                                | Cause                                 | Fix                                            |
| -------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| `ai-architecture-brain.json not found` | Brain not generated                   | `bun run arch:audit`                           |
| `All impactedModules = []`             | No files changed vs base ref          | Use `--all` or commit changes first            |
| `riskScore` always 0                   | No hotspots in brain                  | Re-run `bun run arch:audit` to update hotspots |
| `gitnexus CLI health check failed`     | GitNexus not installed or not indexed | `npx gitnexus analyze`                         |
| Validation `freshness` error           | Artifact >24h old                     | `bun run arch:gitnexus:context`                |
