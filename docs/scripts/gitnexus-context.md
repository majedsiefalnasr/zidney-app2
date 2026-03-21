# gitnexus-context

**Script:** `scripts/gitnexus-context.ts`  
**Domain:** gitnexus  
**Script key:** `gitnexus:context`  
**Mode:** CLI

## Description

Generates a structured `gitnexus-context.json` artifact from the current git state and the
AI architecture brain. The artifact provides AI orchestrators and CI gates with machine-readable
architecture context, including changed files, impacted modules, dependency graph, layer map,
recent commits, and per-module risk indicators.

## Usage

```bash
# Default: changed files since HEAD~1
bun run arch:gitnexus:context

# Full workspace scan
bun run arch:gitnexus:context -- --all

# Preview without writing to disk
bun run arch:gitnexus:context -- --dry-run

# Custom base comparison ref
bun run arch:gitnexus:context -- --base-ref HEAD~3

# Custom output path
bun run arch:gitnexus:context -- --output docs/ai/context/custom.json
```

## CLI Arguments

| Argument               | Type   | Default                                 | Description                                   |
| ---------------------- | ------ | --------------------------------------- | --------------------------------------------- |
| `--all`                | flag   | `false`                                 | Switch to full-scan mode; analyse all modules |
| `--dry-run`            | flag   | `false`                                 | Print JSON to stdout; do not write to disk    |
| `--base-ref`           | string | `HEAD~1`                                | Git ref to compare against for changed files  |
| `--output`             | string | `docs/ai/context/gitnexus-context.json` | Output file path                              |
| `--changed-files-only` | flag   | `false`                                 | Skip dep/arch analysis (future extension)     |

## Output

Writes a minified JSON artifact to `docs/ai/context/gitnexus-context.json`.

With `--dry-run`, pretty-printed JSON is sent to stdout instead.

Schema: `docs/ai/gitnexus-context.schema.json`

## Dependencies

- `docs/ai/context/ai-architecture-brain.json` — must exist; generate with `bun run arch:audit`
- `git` — must be available in PATH
- `gitnexus` CLI — optional; used only for health check (non-fatal if absent)

## Exported Functions (Testable)

All functions below are exported for unit testing:

| Function                                              | Description                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `detectChangedFiles(options)`                         | Get changed file paths from git; falls back to `git status` |
| `mapFilesToModules(files, brainModules)`              | Map file paths to their module prefixes                     |
| `buildDependencyGraph(modules, brain, full)`          | Build scoped or full dependency subgraph                    |
| `buildArchitectureLayerMap(modules, brain, full)`     | Map modules to their architecture layers                    |
| `extractGitHistory()`                                 | Get last 10 commits as structured objects                   |
| `computeRiskIndicators(modules, brain, changedFiles)` | Score per-module risk                                       |
| `checkGitNexusHealth()`                               | Check gitnexus CLI status                                   |
| `assembleContext(options)`                            | Orchestrate all functions → `GitNexusContext`               |

## Error Handling

| Failure                                     | Behavior                                                       |
| ------------------------------------------- | -------------------------------------------------------------- |
| `ai-architecture-brain.json` not found      | `console.error` + `process.exit(1)` — run `bun run arch:audit` |
| `ai-architecture-brain.json` not valid JSON | `console.error` + `process.exit(1)`                            |
| `git` not available                         | `console.error` + `process.exit(1)`                            |
| gitnexus CLI health check fails             | `console.error` warning only (non-fatal)                       |
| Output directory not writable               | `console.error` + `process.exit(1)`                            |

## Security

- `--base-ref` validated against `/^[a-zA-Z0-9._\-/^~]+$/` to prevent injection.
- `--output` path resolved and validated to stay within workspace root.
- All `git` invocations use `execFileSync` with argument arrays.
- No `console.log` usage; structured output via `process.stdout.write` / `console.error`.

## Related

- `scripts/validate/validate-gitnexus.ts` — validation gate for the artifact
- `docs/ai/gitnexus.md` — full integration guide
- `docs/ci/gitnexus-validation.md` — CI gate documentation
- `docs/ai/gitnexus-context.schema.json` — JSON Schema for the artifact
