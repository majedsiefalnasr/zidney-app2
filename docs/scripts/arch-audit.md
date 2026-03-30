# arch:audit

## Command

```sh
bun run arch:audit
```

## Purpose

Monorepo governance scanner — audits Vitest, ESLint, Playwright, import boundaries, and outputs infra-audit-report.json.

## Why It Exists

This runner is currently classified as critical. Not safe to remove directly. Other root scripts depend on it: arch:refresh, arch:fix, arch:audit:check. Its implementation lives in scripts/infra-audit.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run arch:audit`
- Implementation: scripts/infra-audit.ts
- Metadata-backed script file: `scripts/infra-audit.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: `arch:refresh`, `arch:fix`, `arch:audit:check`

## Audit Notes

- Observed in isolated worktree run: docs/ai/context/ai-architecture-brain.json, docs/ai/context/ai-architecture-summary.md, docs/ai/context/ai-context-mini.json, docs/ai/context/ai-dependency-graph.json, docs/ai/context/ai-layer-model.json, docs/ai/context/ai-module-map.json, docs/ai/context/ai-runtime-map.json, docs/architecture/ARCHITECTURE_DIAGRAMS.md, docs/architecture/graphs/architecture-graph.html, docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json, docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json, docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md, docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md, docs/reports/infra-audit-report.json, docs/architecture/audits/history/audit-1774722803158.json.
