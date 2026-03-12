# Alignment Verification Contract

This stage exposes internal automation contracts for maintainers and governance tooling. They are repository-internal interfaces, but they must stay stable enough to support repeatable baseline capture and closure verification.

## Contract 1: Baseline Capture

### Command Set

```bash
bun run arch:guard -- --output json
bun scripts/infra-audit.ts
bun scripts/type-safety-guard.ts --json
```

### Required Semantics

- Baseline scope is full repository coverage for governed modules.
- Output must be groupable by module, rule family, severity, and remediation priority.
- Findings from different tools must be mergeable into a single alignment inventory.

### Minimum Data Expected

| Field                  | Source                                             |
| ---------------------- | -------------------------------------------------- |
| `rule` / `rule_family` | architecture guard, infra audit, type-safety guard |
| `severity`             | architecture guard or normalized severity mapping  |
| `location`             | all tools                                          |
| `source_module`        | architecture guard or normalized from file path    |
| `remediation`          | architecture guard or plan-owned normalization     |
| `fallback_reason`      | architecture guard when applicable                 |

## Contract 2: Remediation Guardrails

### Non-Negotiable Invariants

- No change may weaken authentication, correlation, tenant resolution, or license middleware ordering on runtime paths.
- No change may introduce row-based multi-tenancy, cross-tenant joins, or tenant override from request data.
- No change may bypass centralized tenant and license middleware ordering.
- No change may move grading, timing, or finalization authority out of the worker/server-authoritative flow.
- No change may drift from the standard API response envelope `{ success, data, error }` on touched runtime endpoints.
- No change may add new architecture exceptions, cross-app imports, or package-to-app imports.

### Allowed Remediation Moves

- Move shared contracts to `packages/types`.
- Move validation logic to `packages/validation`.
- Refactor implementation inside existing approved modules.
- Retire or narrow legacy governance scripts when canonical coverage already exists.

## Contract 3: Architecture Intelligence Refresh

### Command Order

```bash
bun scripts/infra-audit.ts
bun scripts/generate-ai-context.ts --force
bun scripts/validate-architecture-brain.ts
```

### Required Artifacts

- `docs/ai/context/ai-architecture-summary.md`
- `docs/ai/context/ai-module-map.json`
- `docs/ai/context/ai-layer-model.json`
- `docs/ai/context/ai-dependency-graph.json`
- `docs/ai/context/ai-runtime-map.json`
- `docs/ai/context/ai-architecture-brain.json`
- `docs/ai/context/ai-context-mini.json`

### Validation Rule

- Refresh is not complete until the architecture brain validates successfully.

## Contract 4: Final Verification

### Canonical Closure Sequence

```bash
bun run lint
bun run typecheck
bun run validate:types
bun run arch:guard:ci
bun scripts/infra-audit.ts
```

### Additional Behavioral Verification

- Run targeted tests for touched modules and runtime paths affected by alignment work.
- Confirm authentication, tenant resolution, and license middleware coverage remain intact where runtime-adjacent code changes occurred.
- Confirm structured API error responses remain intact where runtime-adjacent code changes occurred.

### Exit Criteria

- Zero unresolved architecture-alignment violations in stage scope.
- No malformed or stale architecture intelligence artifacts.
- No regressions to trust-chain invariants.
