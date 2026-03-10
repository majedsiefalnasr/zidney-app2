# Clarify Report — STAGE_INFRA_04_BIOME

**Step:** 2 — Clarify **Stage:** STAGE_INFRA_04_BIOME **Phase:** 01_PLATFORM_FOUNDATION **Branch:**
spec/infra-004-biome **Generated:** 2026-03-06T00:00:00.000Z

---

## Summary

5 ambiguities identified and resolved via the clarification session. All decisions are now encoded
in `spec.md` under `## Clarifications / Session 2026-03-06`. No unresolved markers remain.

**Outcome:** PASS — clarifications locked, planning authorized.

---

## Ambiguities Identified and Resolved

| #     | Topic                                 | Resolution Summary                                                                                   |
| ----- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| CL-01 | CI Workflow Scope                     | Biome gates added to `ci.yml` ONLY — governance workflows untouched                                  |
| CL-02 | `noConsole` / `packages/logger`       | Override `noConsole: "off"` for logger package; all other packages migrate to `@zidney/logger` first |
| CL-03 | Biome version pinning                 | Install without pin (`bun add -D @biomejs/biome`); version recorded in `$schema` URL of `biome.json` |
| CL-04 | lint-staged integration               | Replace ESLint/Prettier entries with `bun biome check --apply-unsafe` for `.ts/.js/.tsx/.jsx/.json`  |
| CL-05 | Line width 100 vs current Prettier 80 | Intentional change; full reformat pass expected; document large initial diff in PR                   |

---

## Clarification Detail

### CL-01 — CI Workflow Scope

**Question:** The repository has 3 CI workflow files (`ci.yml`, `architecture-governance.yml`,
`hard-mode-guard.yml`). Which files should receive the Biome blocking gates?

**Resolution:** `ci.yml` only. The architecture-governance and hard-mode-guard workflows operate on
architecture/spec governance concerns and must not be modified to include code-style enforcement.
Separation of concerns: code quality → `ci.yml`, architecture governance →
`architecture-governance.yml`, spec lifecycle → `hard-mode-guard.yml`.

**Impact on spec:** FR-06 and FR-07 clarified to reference `ci.yml` only.

---

### CL-02 — `noConsole` Exception for `packages/logger`

**Question:** `packages/logger/src/logger.ts` uses `console.log` as a transport internally. Will
`noConsole: "warn"` break this?

**Resolution:** Yes it would. A `biome.json` override is required:

```json
{
  "overrides": [
    {
      "include": ["packages/logger/**/*.ts"],
      "linter": {
        "rules": {
          "suspicious": { "noConsole": "off" }
        }
      }
    }
  ]
}
```

All non-logger packages must migrate `console.log` usages to `@zidney/logger` before `biome check`
can pass.

**Impact on spec:** FR-04 updated to document the logger exception. Migration strategy updated.

---

### CL-03 — Biome Version Pinning

**Question:** The spec referenced "e.g. 1.7.x" — should Biome be version-pinned?

**Resolution:** No explicit pin. Install `@biomejs/biome` without version via
`bun add -D @biomejs/biome`. The resolved version is captured in the `$schema` URL inside
`biome.json`. This follows Zidney's package manager discipline (no manual package.json edits with
stale versions).

**Impact on spec:** Installation instruction clarified; assumption ASM-05 updated.

---

### CL-04 — lint-staged Integration

**Question:** What is the exact `lint-staged.config.mjs` pattern for Biome?

**Resolution:**

```js
// lint-staged.config.mjs
export default {
  "*.{ts,js,tsx,jsx,json}": ["bun biome check --apply-unsafe"],
};
```

All ESLint and Prettier entries in lint-staged are removed entirely.

**Impact on spec:** FR-04 and migration strategy updated with explicit lint-staged command.

---

### CL-05 — Line Width 100 vs Current Prettier 80

**Question:** Current Prettier config uses line width 80. Will switching to 100 cause an
unexpectedly large diff?

**Resolution:** Yes, this will produce a large but intentional diff. The line width change to 100 is
specified in the stage specification. A full reformat pass is executed as part of the migration
(`bun biome format --write .`). This diff is expected, acceptable, and must be documented in the PR
description so reviewers understand the large line-change count is tooling-related.

**Impact on spec:** SC-05 exit condition confirmed. PR description guidance added to migration
strategy.

---

## Checklist Post-Clarification

| Category                           | Status                   |
| ---------------------------------- | ------------------------ |
| No unresolved ambiguities          | ✅ PASS                  |
| No [NEEDS CLARIFICATION] markers   | ✅ PASS                  |
| Constitutional alignment unchanged | ✅ PASS                  |
| Scope boundaries unchanged         | ✅ PASS                  |
| Risk level assessment              | LOW (tooling-only stage) |

---

## Artifacts Updated

| File                                  | Change                                        |
| ------------------------------------- | --------------------------------------------- |
| specs/runtime/infra-004-biome/spec.md | ## Clarifications section appended (in-place) |

---

**Next Step:** Proceed to Step 3 (Plan) — all clarifications resolved.
