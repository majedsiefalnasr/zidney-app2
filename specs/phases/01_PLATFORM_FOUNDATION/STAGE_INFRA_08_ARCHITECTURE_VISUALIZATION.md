# STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION

## Purpose

Introduce automated **architecture visualization and documentation generation** for the Zidney monorepo. This stage converts the dependency graph produced by `infra-audit.ts` into visual architecture artifacts that help developers, reviewers, and AI agents understand the system structure.

Visualization ensures that architecture is not only enforced but also **observable and explainable**.

---

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: LOW
Last Updated: 2026-03-09T00:00:00.000Z

Tasks Generated:

- Total: 18 atomic tasks
- Test Fixtures: 2 (T001–T002, parallel)
- Script Implementation: 8 (T003–T010: scaffold + 5 pure functions + system overview + CLI main)
- Unit Tests: 4 (T011–T014: 12 test cases)
- Static Tests: 2 (T015–T016: 6 integration tests)
- Config: 2 (T017–T018: package.json + output README)

Deferred Scope:

- SVG/PNG rendering, CI pipeline modification, HTTP serving

Constitutional Compliance:

- Task set compliant — drift analysis required before implementation
- Architecture Checker VERDICT: PASS (from Plan step)
- API Designer: N/A (no API routes)

Notes:
Atomic task set generated. Drift analysis gate pending.

---

# Goals

1. Generate architecture diagrams automatically from the repository.
2. Visualize module dependencies across apps and packages.
3. Provide a clear layer map (UI / Runtime / Domain / Infrastructure).
4. Help AI tools understand the system architecture.
5. Detect structural complexity or risky coupling.

---

# Data Source

Architecture diagrams are generated from:

```
scripts/infra-audit.ts
```

The audit script produces:

```
infra-audit-report.json
infra-dependency-graph.json
```

These files contain:

- module nodes
- dependency edges
- layer classifications

---

# Visualization Outputs

Generated diagrams should be stored in:

```
docs/architecture/visualization/
```

Artifacts include:

```
module-dependency-graph.svg
layer-architecture-diagram.svg
system-overview-diagram.svg
```

These diagrams help developers quickly understand how Zidney is structured.

---

# Layer Visualization

The layer diagram illustrates the core architecture model:

```
UI
↓
Runtime
↓
Domain
↓
Infrastructure
```

Example mapping:

```
UI
  apps/mmc
  apps/backoffice
  apps/frontoffice

Runtime
  apps/api
  apps/worker

Domain
  packages/domain-core
  packages/validation

Infrastructure
  packages/logger
  packages/types
  packages/config
  packages/redis-utils
```

---

# Dependency Graph Visualization

The dependency graph visualizes module relationships.

Example:

```
apps/mmc → packages/api-client
apps/mmc → packages/ui-system
apps/api → packages/domain-core
apps/api → packages/logger
```

This graph helps detect:

```
cyclic dependencies
layer violations
high coupling
```

---

# Tooling

Recommended tools for visualization:

```
Graphviz
Mermaid
D3-based graph rendering
```

Mermaid is recommended for documentation since it integrates well with Markdown.

Example Mermaid graph:

```
flowchart TD

UI[UI Applications]
Runtime[Runtime Services]
Domain[Domain Logic]
Infra[Infrastructure]

UI --> Runtime
Runtime --> Domain
Domain --> Infra
```

---

# Automated Diagram Generation

A script should convert the dependency graph into diagrams.

Example command:

```
bun run architecture:visualize
```

The script will:

1. read `infra-dependency-graph.json`
2. classify modules by layer
3. generate diagram files
4. save them under `docs/architecture/visualization`

---

# CI Integration

Visualization generation can run in CI to keep diagrams up to date.

Recommended pipeline step:

```
bun run infra-audit
bun run architecture:visualize
```

Generated artifacts may be committed or uploaded as CI artifacts.

---

# AI Development Benefits

AI agents benefit from visual architecture context.

Visualization helps AI understand:

```
system structure
module boundaries
allowed dependencies
architecture layers
```

This improves AI-generated code quality.

---

# Developer Usage

Developers can view architecture diagrams directly in the repository.

Location:

```
docs/architecture/visualization/
```

These diagrams should be updated whenever major structural changes occur.

---

# Success Criteria

This stage is complete when:

- architecture diagrams generate automatically
- dependency graph visualized
- layer diagram documented
- diagrams stored in repository

---

# Dependencies

This stage depends on:

```
STAGE_INFRA_03_ALIGNMENT
STAGE_INFRA_06_ARCHITECTURE_GUARD
STAGE_INFRA_07_MODULE_BOUNDARIES
```

These stages provide the architecture metadata required for visualization.

---

# Result

After this stage:

- Zidney architecture becomes visually documented
- developers understand system structure faster
- AI tools gain architecture awareness
- architecture drift becomes easier to detect

This stage completes the **architecture observability layer** of the Zidney platform.
