# ai:context:generate

## Command

```sh
bun run ai:context:generate
```

## Purpose

Generate AI context artifacts (architecture brain, module map, dependency graph). Supports incremental (default), forced, and validate-after-generation modes.

## Why It Exists

This runner is currently classified as critical. Not safe to remove directly. Other root scripts depend on it: dev:analyze:directory-sizes, dev:analyze:file-sizes, dev:benchmark:ci, dev:demo:logger, dev:deps:verify, dev:hygiene:report, dev:profile:scripts, dev:refactor:scripts, dev:report:baseline, dev:validate:script-duplication, dev:ai:archive-snapshots, dev:ai:context-artifacts, dev:pr:coderabbit, repo:doctor, repo:fix, repo:onboard, repo:status. Its implementation lives in scripts/generate-ai-context.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run ai:context:generate`
- Implementation: scripts/generate-ai-context.ts
- Metadata-backed script file: `scripts/generate-ai-context.ts`

## Flags

| Flag         | Type      | Description                                                 | Example                                     |
| ------------ | --------- | ----------------------------------------------------------- | ------------------------------------------- |
| `--force`    | `boolean` | Force execution even if checks fail or files already exist. | `bun run ai:context:generate -- --force`    |
| `--validate` | `boolean` | —                                                           | `bun run ai:context:generate -- --validate` |
| `--verbose`  | `boolean` | Enable verbose output.                                      | `bun run ai:context:generate -- --verbose`  |

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: `dev:analyze:directory-sizes`, `dev:analyze:file-sizes`, `dev:benchmark:ci`, `dev:demo:logger`, `dev:deps:verify`, `dev:hygiene:report`, `dev:profile:scripts`, `dev:refactor:scripts`, `dev:report:baseline`, `dev:validate:script-duplication`, `dev:ai:archive-snapshots`, `dev:ai:context-artifacts`, `dev:pr:coderabbit`, `repo:doctor`, `repo:fix`, `repo:onboard`, `repo:status`

## Audit Notes

- Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json.
