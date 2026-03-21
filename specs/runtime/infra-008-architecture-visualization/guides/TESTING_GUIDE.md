# Testing Guide — STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION

**Stage**: STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION  
**Phase**: 01_PLATFORM_FOUNDATION  
**Stage Directory**: infra-008-architecture-visualization  
**Generated On**: 2026-03-09

---

## Purpose

This guide explains how to validate the architecture visualization implementation end-to-end. The
stage introduces a new CLI tool (`arch:visualize`) that generates clean, human-readable Mermaid
diagrams from Zidney's analyzed codebase structure.

---

## Summary of Delivered Behavior

The architecture visualization pipeline reads raw architecture audit data (from
`scripts/infra-audit.ts`) and transforms it into three curated diagrams plus an explanatory README:

Key outcomes:

- **Module Dependency Graph** — complete import topology, deduplicated edges, top-level modules only
- **Layer Architecture Diagram** — 4-layer separation (Runtime, UI, Domain, Infrastructure)
- **System Overview Diagram** — 5 major services as independent components
- **Visualization README** — context, diagram descriptions, and interpretation guide

---

## Prerequisites

| Requirement                  | Validation Command / Check                                            |
| ---------------------------- | --------------------------------------------------------------------- |
| Node.js installed            | `node --version` (v20+)                                               |
| Bun installed                | `bun --version` (v1+)                                                 |
| Repository cloned            | `git status` (no errors)                                              |
| Correct branch checked out   | `git branch` should show `spec/infra-008-architecture-visualization`  |
| Dependencies installed       | `bun install` (if `node_modules` or `bun.lockb` missing)              |
| Biome and TypeScript working | `bun run lint` and `bun run typecheck` should complete without errors |

---

## Files in Scope

```text
scripts/architecture/visualize.ts
tests/unit/visualize/visualize.test.ts
tests/unit/visualize/fixtures/dependency-graph.fixture.json
tests/unit/visualize/fixtures/architecture-map.fixture.json
tests/static/06-architecture-visualization.test.ts
docs/architecture/visualization/ (output directory with 4 generated files)
package.json (arch:visualize script entry)
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Run the architecture audit and visualization in sequence
bun run arch:audit     # Generates raw graphs in docs/architecture/graphs/
bun run arch:visualize # Transforms raw graphs to curated diagrams in docs/architecture/visualization/

# Or run both together
bun run arch:audit && bun run arch:visualize
```

**Expected Output**:

```
[INFRA AUDIT] Starting...
...
[INFRA AUDIT] Complete
[VISUALIZE] Reading dependency graph from docs/architecture/graphs/dependency-graph.json
[VISUALIZE] Reading architecture map from docs/architecture/intelligence/ARCHITECTURE_MAP.json
[VISUALIZE] Generating module dependency graph...
[VISUALIZE] Generating layer architecture diagram...
[VISUALIZE] Generating system overview diagram...
[VISUALIZE] Generating README...
[VISUALIZE] Done — 3 diagrams written to docs/architecture/visualization/
```

---

## Automated Validation Commands

```bash
# Unit tests for visualization functions
bun run test run tests/unit/visualize/visualize.test.ts

# Static integration tests validating output files
bun run test run tests/static/06-architecture-visualization.test.ts

# Full suite
bun run test run tests/unit/visualize/ tests/static/06-*

# Coverage
bun run test run --coverage tests/unit/visualize/visualize.test.ts
```

**Expected outcome**: All 14 unit tests pass (Test 1–14 in visualize.test.ts) + 6 static tests pass
(6.1–6.6 in 06-\*.test.ts).

---

## Manual Test Scenarios

### Scenario 1 — Generate Visualization from Clean Audit

**Purpose**: Verify the visualization pipeline runs to completion and produces 4 output files.

1. Ensure branch is `spec/infra-008-architecture-visualization` (`git branch`)
2. Run `bun run arch:audit` (regenerate machine-readable audit graphs)
3. Run `bun run arch:visualize` (transform graphs to curated diagrams)
4. Verify output directory exists: `ls -la docs/architecture/visualization/`

**Expected**:

- Directory contains 4 files: `README.md`, `module-dependency-graph.mmd`,
  `layer-architecture-diagram.mmd`, `system-overview-diagram.mmd`
- All 4 files have non-zero sizes (README >2KB, .mmd files 1–2KB)
- Console output shows `[VISUALIZE] Done — 3 diagrams written to docs/architecture/visualization/`

**Troubleshooting**:

- If directory missing: run `mkdir -p docs/architecture/visualization/` manually first
- If audit fails: run `bun run arch:audit` with verbose output to check for graph generation errors
- If diagrams not written: check file permissions on `docs/architecture/visualization/` directory

### Scenario 2 — Verify Diagram Content Correctness

**Purpose**: Confirm diagrams contain expected Mermaid syntax and architecture elements.

1. Open `docs/architecture/visualization/module-dependency-graph.mmd` in a text editor
2. Verify it starts with `graph LR` or similar Mermaid syntax
3. Confirm it contains nodes like `apps/api`, `packages/domain-core`, `packages/logger`
4. Verify edges are present (e.g., `apps/api --> packages/domain-core`)
5. Repeat for `layer-architecture-diagram.mmd` and `system-overview-diagram.mmd`

**Expected**:

- All three `.mmd` files contain valid Mermaid `graph` syntax
- No deep submodule paths (e.g., `packages/foo/src/bar`) — only top-level module names
- No duplicate edges in module-dependency-graph.mmd (deduplication should have removed them)
- Layer diagram contains exactly 4 subgraphs: Runtime, UI, Domain, Infrastructure

**Troubleshooting**:

- If Mermaid syntax is invalid: regenerate diagrams with `bun run arch:visualize`
- If deep paths appear: check test for `filterTopLevelNodes` (should strip them)
- If duplicates present: check `deduplicateEdges` test coverage and re-run audit

### Scenario 3 — Verify README Context (Edge Case)

**Purpose**: Ensure the generated README contains interpretable context for the diagrams.

1. Open `docs/architecture/visualization/README.md` in a text editor
2. Check for a timestamp (ISO 8601 format) at the top
3. Verify it contains 3 references to the .mmd files (as markdown links)
4. Confirm it includes a commit SHA reference (short or full)

**Expected**:

- Timestamp present (e.g., `Generated on 2026-03-09T14:00:00.000Z`)
- Links to all 3 diagrams in markdown format
- Short commit SHA or reference to generation context
- Diagrams are described in plain language

---

## Negative Cases

| Scenario                                 | Trigger                                                                                 | Expected Response                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Missing dependency-graph.json            | Delete `docs/architecture/graphs/dependency-graph.json` before running `arch:visualize` | Error message: `Cannot find dependency-graph.json`          |
| Corrupted JSON in dependency graph       | Edit `docs/architecture/graphs/dependency-graph.json` to remove closing `}`             | Error message: `SyntaxError: Unexpected end of JSON input`  |
| Missing nodes or edges array             | Edit fixture to have `{"nodes": []}` but no `edges` property                            | Error message: `edges is not an array`                      |
| Circular module reference (hypothetical) | Manually inject a cycle in dependency-graph.json                                        | Handler: deduplicate edges detects and removes circular ref |
| Empty dependency graph                   | Manually set `nodes: []`, `edges: []` in fixture                                        | Diagrams still generated; empty subgraphs or single node    |

**Error Response Format**:

```
[VISUALIZE] Error: <error message>
Process exits with code 1
```

---

## Integration with Existing Tools

### Relationship to `infra-audit.ts`

`arch:visualize` reads the output of `arch:audit` (run these together):

```bash
bun run arch:audit && bun run arch:visualize
```

- `infra-audit.ts` → generates `docs/architecture/graphs/dependency-graph.json` (machine-readable,
  unfiltered)
- `arch:visualize` → reads that file and generates `docs/architecture/visualization/*.mmd`
  (human-readable, curated)

### Relationship to `ai-guard.ts`

`arch:visualize` does **not** use `ai-guard.ts`. However, both tools read from
`ARCHITECTURE_MAP.json`:

- `ai-guard.ts` → validates code against architecture rules
- `arch:visualize` → uses architecture map to classify modules by layer in diagrams

---

## Performance Notes

- Full visualization generation (~20ms on modern hardware)
- Deduplication handles 600+ edges efficiently
- Output files are deterministic (same input = same output)
- Idempotent—safe to run multiple times without side effects

---

## Success Criteria

All scenarios pass when:

✅ All 14 unit tests pass  
✅ All 6 static integration tests pass  
✅ `arch:visualize` completes without error  
✅ 4 output files exist and contain valid Mermaid syntax  
✅ Mermaid diagrams render without syntax errors  
✅ No deep submodule paths visible in outputs  
✅ Layer diagram contains exactly 4 layers  
✅ README includes timestamp, SHA, and 3 file references

---

## Viewing the Diagrams

The generated `.mmd` files can be viewed in:

- **GitHub**: Commit `.mmd` files to the repo; GitHub renders them automatically
- **Mermaid Live Editor**: https://mermaid.live — copy/paste `.mmd` content
- **Local Mermaid CLI**: `npm install -g mermaid-cli && mmdc -i diagram.mmd -o diagram.svg`
- **VS Code**: Install Markdown Preview Mermaid Support extension

---

## Debugging Tips

If tests fail:

1. **Fixture issues**: Re-run from fixtures in `tests/unit/visualize/fixtures/`
2. **Graph generation**: Check `infra-audit.ts` output in `docs/architecture/graphs/`
3. **Mermaid syntax**: Paste diagram into https://mermaid.live for real-time error feedback
4. **Layer classification**: Review `classifyLayerHeuristic` test and module name patterns
5. **Deduplication**: Enable debug logging in `deduplicateEdges` to trace edge processing

---

## Next Steps After Testing

1. Share visualizations with team documentation
2. Add diagrams to ADR documentation (if needed)
3. Use as architecture communication tool in design reviews
4. Regenerate diagrams when ARCHITECTURE_MAP.json changes

---
