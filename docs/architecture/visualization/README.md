# Architecture Visualization

> **Auto-generated** — do not edit manually. Re-run `bun run arch:visualize` to refresh after
> running `bun run arch:audit`.

Generated: 2026-03-09T11:48:26.018Z Git SHA: ae16d28ed3e42f512a9ca42c3a794bfee9be99c3

---

## Diagrams

### [module-dependency-graph.mmd](./module-dependency-graph.mmd)

Top-level module dependency graph with layer subgraph annotations. Shows all registered `apps/*` and
`packages/*` modules and their deduplicated dependency edges, grouped by architectural layer (UI,
Runtime, Domain, Infrastructure).

### [layer-architecture-diagram.mmd](./layer-architecture-diagram.mmd)

Layer hierarchy diagram showing modules grouped by their assigned architectural layer. Cross-layer
dependency edges are rendered after subgraph declarations — any edge pointing against the
`UI → Runtime → Domain → Infrastructure` direction indicates a potential architectural violation.

### [system-overview-diagram.mmd](./system-overview-diagram.mmd)

Static Zidney platform trust chain and service topology. Shows the five named services (MMC,
Backoffice, Frontoffice, API, Worker) and the Foundation package group. Reflects the trust chain
model defined in `AGENTS.md`.

---

## How to View

- **GitHub**: `.mmd` files render automatically as Mermaid diagrams in the GitHub UI.
- **VS Code**: Install the
  [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid)
  extension.
- **Online**: Paste the `.mmd` file content into [mermaid.live](https://mermaid.live).

---

## Data Sources

| File                                                   | Role                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `docs/architecture/graphs/dependency-graph.json`       | Primary data source (required). Produced by `bun run arch:audit`.            |
| `docs/architecture/intelligence/ARCHITECTURE_MAP.json` | Layer classification source (optional). Produced by `bun run arch:generate`. |

---

## Governance Reference

See `AGENTS.md` for the authoritative Zidney trust chain, platform identity, and multi-tenancy rules
that govern the architecture shown in these diagrams.

See `docs/PROJECT_CONTEXT_PRIMER.md` for the full platform context.
