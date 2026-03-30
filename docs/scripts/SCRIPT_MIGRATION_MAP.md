# Script Migration Map

> Canonical reference for all 33 script renames and removals in root `package.json`.
> Applied by `bun run dev:refactor:scripts`.
> Generated: 2026-03-21

---

## Type A — Wrong action/scope structure (3 entries)

| Old Name               | Type | Violation                                                      | New Name               |
| ---------------------- | ---- | -------------------------------------------------------------- | ---------------------- |
| `db:pool-status`       | A    | action `pool-status` should split to `status:pool`             | `db:status:pool`       |
| `db:validate-licenses` | A    | action `validate-licenses` should split to `validate:licenses` | `db:validate:licenses` |
| `arch:validate-brain`  | A    | action `validate-brain` should split to `validate:brain`       | `arch:validate:brain`  |

## Type B — Domain segment contains hyphen (7 entries)

| Old Name              | Type | Violation                    | New Name              |
| --------------------- | ---- | ---------------------------- | --------------------- |
| `ai-context:generate` | B    | `ai-context` domain uses `-` | `ai:context:generate` |
| `ai-context:refresh`  | B    | `ai-context` domain uses `-` | `ai:context:refresh`  |
| `ai-context:validate` | B    | `ai-context` domain uses `-` | `ai:context:validate` |
| `ai-context:status`   | B    | `ai-context` domain uses `-` | `ai:context:status`   |
| `ai-runtime:status`   | B    | `ai-runtime` domain uses `-` | `ai:runtime:status`   |
| `ai-runtime:refresh`  | B    | `ai-runtime` domain uses `-` | `ai:runtime:refresh`  |
| `ai-runtime:validate` | B    | `ai-runtime` domain uses `-` | `ai:runtime:validate` |

## Type C — No domain prefix (6 entries)

| Old Name                   | Type | Violation                     | New Name                       |
| -------------------------- | ---- | ----------------------------- | ------------------------------ |
| `validate-runtime-scripts` | C    | no domain, uses `-` separator | `validate:scripts:runtime`     |
| `ai-guard`                 | C    | no domain                     | `ai:guard`                     |
| `type-safety-guard`        | C    | no domain                     | `arch:type-safety-guard`       |
| `generate-script-docs`     | C    | no domain, uses `-`           | `dev:generate:script-docs`     |
| `seed-dashboard-test-data` | C    | no domain, uses `-`           | `dev:seed:dashboard-test-data` |
| `run-staging-smoke-tests`  | C    | no domain, uses `-`           | `ci:smoke:staging`             |

## Type D — Non-allowed domain (12 entries)

| Old Name                  | Type | Violation                                                        | New Name                  |
| ------------------------- | ---- | ---------------------------------------------------------------- | ------------------------- |
| `context:build`           | D    | `context` not in domain map                                      | `arch:context:build`      |
| `context:changed`         | D    | `context` not in domain map                                      | `arch:context:changed`    |
| `context:impact`          | D    | `context` not in domain map                                      | `arch:context:impact`     |
| `context:validate`        | D    | `context` not in domain map                                      | `arch:context:validate`   |
| `gitnexus:context`        | D    | `gitnexus` not in domain map                                     | `arch:gitnexus:context`   |
| `gitnexus:validate`       | D    | `gitnexus` not in domain map                                     | `arch:gitnexus:validate`  |
| `hygiene:report`          | D    | `hygiene` not in domain map                                      | `dev:hygiene:report`      |
| `maintenance:cache-clean` | D    | `maintenance` not in domain map                                  | `infra:cache:clean`       |
| `check:tsconfig`          | D    | `check` not in domain map                                        | `validate:tsconfig`       |
| `check:store-cycles`      | D    | `check` not in domain map                                        | `arch:check:store-cycles` |
| `infra-audit:check`       | D    | `infra-audit` hyphen in domain                                   | `arch:audit:check`        |
| `generate:ai-context`     | D    | `generate` not in domain map; duplicate of `ai-context:generate` | `ai:context:generate`     |

## Type E — Redundant aliases to remove (9 entries)

| Old Name                | Type | Violation                             | New Name            |
| ----------------------- | ---- | ------------------------------------- | ------------------- |
| `infra-audit`           | E    | alias for `arch:audit`                | `arch:audit`        |
| `migrate`               | E    | alias for `db:migrate`                | `db:migrate`        |
| `validate:architecture` | E    | alias for `arch:audit`                | `arch:audit`        |
| `type-coverage`         | E    | alias for `validate:types`            | `validate:types`    |
| `cache-clean`           | E    | alias for `infra:cache:clean`         | `infra:cache:clean` |
| `biome`                 | E    | alias for `lint` (lifecycle)          | `lint`              |
| `tsc`                   | E    | alias for `typecheck:src` (lifecycle) | `typecheck:src`     |
| `vitest`                | E    | alias for `test` (lifecycle)          | `test`              |
| `worker`                | E    | alias for `dev:worker`                | `dev:worker`        |

---

## Summary

| Type                            | Count  |
| ------------------------------- | ------ |
| Type A — Wrong action structure | 3      |
| Type B — Hyphen in domain       | 7      |
| Type C — No domain prefix       | 6      |
| Type D — Non-allowed domain     | 12     |
| Type E — Aliases to remove      | 9      |
| **Total**                       | **37** |

---

## Refactor Engine Behavior

**Types A–D:** Script key is renamed in `package.json`. All `bun run <oldName>` references in
scope files are replaced with `bun run <newName>`.

**Type E:** Script key is **deleted** from `package.json`. All `bun run <alias>` references
in scope files are replaced with `bun run <canonicalTarget>`.

**Idempotency:** Running the engine twice on an already-migrated codebase produces zero replacements.

---

## v2.0 — Script System Full Refactor (2026-03-30)

> Applied by `bun run refactor-scripts`. Source of truth: `docs/scripts/migration-map.json`

### Format Layer Consolidation (5 entries)

| Old Name                | Type   | Violation                             | New Name       |
| ----------------------- | ------ | ------------------------------------- | -------------- |
| `format`                | rename | Renamed to `format:write` for clarity | `format:write` |
| `format:biome`          | merge  | Merged into unified `format:write`    | `format:write` |
| `format:prettier`       | merge  | Merged into unified `format:write`    | `format:write` |
| `format:check:biome`    | merge  | Merged into unified `format:check`    | `format:check` |
| `format:check:prettier` | merge  | Merged into unified `format:check`    | `format:check` |

### Architecture Layer Simplification (3 entries)

| Old Name           | Type   | Violation                                         | New Name              |
| ------------------ | ------ | ------------------------------------------------- | --------------------- |
| `arch:refresh`     | rename | Governance is the canonical audit + refresh entry | `arch:governance`     |
| `arch:audit:check` | merge  | Check-only mode merged into arch:governance       | `arch:governance`     |
| `arch:fix`         | rename | Fix mode under governance namespace               | `arch:governance:fix` |

### Validation Layer Consolidation (4 entries)

| Old Name                    | Type             | Violation                             | New Name               |
| --------------------------- | ---------------- | ------------------------------------- | ---------------------- |
| `validate:scripts:runtime`  | merge            | Merged into validate:scripts:all      | `validate:scripts:all` |
| `validate:scripts:broken`   | merge            | Merged into validate:scripts:all      | `validate:scripts:all` |
| `validate:scripts:registry` | merge            | Merged into validate:scripts:all      | `validate:scripts:all` |
| `validate:runtime:scripts`  | remove-duplicate | Duplicate of validate:scripts:runtime | `validate:scripts:all` |

### Removals (1 entry)

| Old Name          | Type   | Violation                                                 | New Name    |
| ----------------- | ------ | --------------------------------------------------------- | ----------- |
| `test:unit:debug` | remove | Redundant — use `bun run test:unit -- --reporter verbose` | _(removed)_ |

### v2.0 Summary

| Category             | Before | After | Net    |
| -------------------- | ------ | ----- | ------ |
| Format layer         | 6      | 2     | −4     |
| Architecture layer   | 3      | 2     | −1     |
| Validation layer     | 4      | 2     | −2     |
| Test (debug removal) | 1      | 0     | −1     |
| **Total**            | **14** | **6** | **−7** |
