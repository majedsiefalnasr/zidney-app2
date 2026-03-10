# Clarify Report — Hybrid Lint Format Pipeline

**Stage:** STAGE_INFRA_10_HYBRID_LINT_FORMAT_PIPELINE
**Phase:** 01_PLATFORM_FOUNDATION
**Branch:** `spec/infra-010-hybrid-lint-format-pipeline`
**Step:** 2 — Clarify
**Generated:** 2026-03-10T00:00:00.000Z
**Status:** ✅ Complete — All Ambiguities Resolved

---

## Session: 2026-03-10

### Clarifications Resolved (8 total)

| ID   | Ambiguity                                       | Decision                                                                        | Severity         |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| Q-01 | lint-staged config location                     | `lint-staged.config.mjs` (not inline in package.json)                           | ⚠️ CRITICAL      |
| Q-02 | Biome invocation — two commands vs single       | Single `bun biome check --write` covers format + lint fixes atomically          | ⚠️ CRITICAL      |
| Q-03 | Biome glob — include `*.mjs` and `*.json`?      | Yes — `*.{ts,tsx,js,jsx,mjs,vue,json}` — existing config + Biome v2.4.6 support | Moderate         |
| Q-04 | Pre-push biome command — bare vs npm script     | `bun run lint` — uses defined npm script, PATH-resilient                        | ⚠️ CRITICAL      |
| Q-05 | actionlint scope — staged-only or full on push? | Both — lint-staged for commits; `actionlint .github/workflows/` on push also    | ⚠️ CRITICAL      |
| Q-06 | Biome Vue handling — `<script>` only or full?   | Script blocks only — confirmed by existing `biome.json`                         | ✅ Already Clear |
| Q-07 | yamllint — system tool vs npm package?          | System tool — confirmed, no `package.json` entry required                       | ✅ Already Clear |
| Q-08 | Biome installation — root only or per-package?  | Root only — `@biomejs/biome: ^2.4.6` in root devDependencies                    | ✅ Already Clear |

### Evidence Sources

| File                     | Informed         |
| ------------------------ | ---------------- |
| `biome.json`             | Q-02, Q-06, Q-08 |
| `lint-staged.config.mjs` | Q-01, Q-03       |
| `package.json`           | Q-04, Q-07, Q-08 |

---

## Spec Sections Updated

- `## Assumptions` — lint-staged config location clarified to `lint-staged.config.mjs`
- `## NFR-03` — configuration table corrected
- `## FR-06` — ESM config block written with correct command and glob
- `## FR-07` — Pre-push pipeline updated to 4 commands including actionlint
- `## Clarifications / ### Session 2026-03-10` — appended to spec.md

---

## Remaining Unresolved Ambiguities

None.

---

## Implementation Status

✅ **Unblocked.** All critical clarifications resolved with direct workspace evidence. Spec is consistent and ready for Plan step.
