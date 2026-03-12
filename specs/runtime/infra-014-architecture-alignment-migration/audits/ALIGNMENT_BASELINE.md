# Alignment Baseline

Captured: 2026-03-12T17:25:53Z
Status: clean

## Canonical Commands

```bash
bun run arch:guard -- --output json
bun scripts/type-safety-guard.ts --json
bun scripts/infra-audit.ts
```

## Results

| Tool               | Verdict | Summary                                                                          |
| ------------------ | ------- | -------------------------------------------------------------------------------- |
| Architecture Guard | PASS    | 0 violations, no contract error, 14 modules validated                            |
| Type-Safety Guard  | PASS    | 0 violations                                                                     |
| Infra Audit        | PASS    | 0 dependency, cycle, layer, map, or drift violations; architecture score 100/100 |

## Classification

| Rule Family         | Count | Priority | Notes                                           |
| ------------------- | ----- | -------- | ----------------------------------------------- |
| dependency-boundary | 0     | none     | No in-scope violations reported                 |
| circular-dependency | 0     | none     | No in-scope violations reported                 |
| unsafe-type         | 0     | none     | No in-scope violations reported                 |
| validation-gap      | 0     | none     | No runtime mutations authorized                 |
| export-typing       | 0     | none     | No in-scope violations reported                 |
| script-overlap      | 0     | none     | No toolchain changes required                   |
| artifact-drift      | 0     | none     | Canonical refresh still required before closure |

## Clean-State Decision

- The current canonical baseline reports zero in-scope architecture-alignment violations.
- Repository code remediation under `apps/`, `packages/`, `scripts/`, and `tests/` is not required for this stage instance.
- This stage proceeds on the docs-only evidence path unless a future rerun of the baseline reports non-zero findings.
