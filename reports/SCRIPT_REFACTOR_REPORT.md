# Script Refactor Report

> Generated: 2026-03-30T08:18:24.590Z
> Mode: LIVE
> Migration entries applied: 12

## Changes Made

### specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json

- `bun run format:biome` → `bun run format:write` (1x)
- `bun run format:prettier` → `bun run format:write` (1x)
- `bun run format:check:biome` → `bun run format:check` (1x)
- `bun run format:check:prettier` → `bun run format:check` (1x)

### specs/runtime/fix-01-runtime-script-recovery-and-validation/research.md

- `bun run format:biome` → `bun run format:write` (1x)

### specs/runtime/fix-01-runtime-script-recovery-and-validation/reports/SCRIPTS_RUNS.md

- `bun run format:biome` → `bun run format:write` (1x)
- `bun run format:check:biome` → `bun run format:check` (1x)

### docs/scripts/format-check-prettier.md

- `bun run format:check:prettier` → `bun run format:check` (2x)

### docs/scripts/format-prettier.md

- `bun run format:prettier` → `bun run format:write` (2x)

### docs/scripts/format-biome.md

- `bun run format:biome` → `bun run format:write` (2x)

### docs/scripts/format-check-biome.md

- `bun run format:check:biome` → `bun run format:check` (2x)

### docs/reports/script-refactor-report.json

- `bun run format` → `bun run format:write` (31x)
- `bun run arch:refresh` → `bun run arch:governance` (6x)
- `bun run arch:audit:check` → `bun run arch:governance` (5x)
- `bun run arch:fix` → `bun run arch:governance:fix` (8x)
- `bun arch:fix` → `bun arch:governance:fix` (1x)
- `bun run validate:scripts:runtime` → `bun run validate:scripts:all` (29x)
- `bun run validate:scripts:broken` → `bun run validate:scripts:all` (5x)
- `bun run validate:scripts:registry` → `bun run validate:scripts:all` (2x)
- `bun run validate:runtime:scripts` → `bun run validate:scripts:all` (2x)

### scripts/dev/refactor-scripts.ts

- `bun run format` → `bun run format:write` (1x)

### package.md

- `bun run format:biome` → `bun run format:write` (1x)
- `bun run format:prettier` → `bun run format:write` (1x)
- `bun run format:check:biome` → `bun run format:check` (2x)
- `bun run format:check:prettier` → `bun run format:check` (1x)

### reports/SCRIPT_REFACTOR_REPORT.md

- `bun run format` → `bun run format:write` (62x)
- `bun run arch:refresh` → `bun run arch:governance` (6x)
- `bun run arch:audit:check` → `bun run arch:governance` (5x)
- `bun run arch:fix` → `bun run arch:governance:fix` (8x)
- `bun arch:fix` → `bun arch:governance:fix` (1x)
- `bun run validate:scripts:runtime` → `bun run validate:scripts:all` (29x)
- `bun run validate:scripts:broken` → `bun run validate:scripts:all` (5x)
- `bun run validate:scripts:registry` → `bun run validate:scripts:all` (2x)
- `bun run validate:runtime:scripts` → `bun run validate:scripts:all` (2x)

## Unresolved References

✅ Unresolved references: 0
