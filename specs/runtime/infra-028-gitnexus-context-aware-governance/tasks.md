# Tasks: INFRA-28 — GitNexus Context-Aware Governance

**Stage:** GitNexus Context-Aware Governance
**Phase:** 01_PLATFORM_FOUNDATION
**Total Tasks:** 13
**Generated:** 2026-03-25T00:25:00Z

---

## Task List

- [ ] T001 Create `scripts/context/validate.ts` — reads artifact from `docs/ai/context/gitnexus-context.json`, reads schema from `docs/ai/gitnexus-context.schema.json`, validates existence, JSON parse, required fields, schemaVersion match, and <24h freshness; exits 0 on pass, exits 1 with named diagnostic on any failure; no external libraries
- [ ] T002 Create `scripts/context/build.ts` — wraps `assembleContext(AssembleOptions)` from `scripts/gitnexus-context.ts`; parses CLI args (`--dry-run`, `--all`, `--force`); writes output atomically via `writeFileSync` to `docs/ai/context/gitnexus-context.json.tmp` then `renameSync`; logs `[context:build] OK Written: ...` on success; exits 1 with named diagnostic on failure
- [ ] T003 Create `scripts/context/changed.ts` — runs `execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'])` to get staged files; checks `docs/ai/context/context-changed.json` freshness (< 5 min → exit 0 cache hit); writes `ContextChangedArtifact` (`generatedAt`, `changedFiles`) atomically; handles clean tree as `changedFiles: []` (not an error)
- [ ] T004 Create `scripts/context/impact.ts` — reads `docs/ai/context/gitnexus-context.json`; reads `docs/ai/context/context-changed.json` (fallback to artifact's own `changedFiles`); filters `riskIndicators` whose `affectedBy` intersects `changedFiles`; writes `ContextImpactArtifact` atomically to `docs/ai/context/context-impact.json`; supports `--json` flag (print array to stdout)
- [ ] T005 Create `scripts/context/validate.test.ts` — 8 unit tests using vitest for `validate.ts`: (1) valid fresh artifact exits 0, (2) missing artifact file exits 1, (3) invalid JSON exits 1, (4-12) each of 9 required fields missing exits 1, (13) schemaVersion mismatch exits 1, (14) artifact >24h old exits 1, (15) artifact exactly 23h59m old exits 0, (16) artifact exactly 24h1m old exits 1
- [ ] T006 Modify `package.json` — add 4 scripts: `"context:build": "bun scripts/context/build.ts"`, `"context:changed": "bun scripts/context/changed.ts"`, `"context:impact": "bun scripts/context/impact.ts"`, `"context:validate": "bun scripts/context/validate.ts"`; update `"governance:gate:changed"` to `"bun run context:changed && bun run arch:guard:changed"`
- [ ] T007 Modify `scripts/governance/gate.ts` — prepend 2 entries to the GUARDS array before all existing guards: `{ name: 'Context Build', script: 'context:build' }` and `{ name: 'Context Validate', script: 'context:validate' }`
- [ ] T008 Modify `.husky/pre-commit` — insert block after the TypeScript incremental check step and before the `arch:guard:changed` step: run `bun run context:changed` and `bun run context:validate`; add named diagnostic output for each; fail hook on non-zero exit
- [ ] T009 Modify `.github/workflows/architecture-governance.yml` — insert new step "Build and Validate GitNexus Context" immediately after the "Install dependencies" step and before the "Verify AI Bootstrap Exists" step; step runs `bun run context:build && bun run context:validate`
- [ ] T010 [P] Create `docs/scripts/context-build.md` — script registry entry with: name, description, usage, arguments (--dry-run/--all/--force), outputs, named diagnostics, related scripts
- [ ] T011 [P] Create `docs/scripts/context-changed.md` — script registry entry with: name, description, usage, outputs, cache behavior (5 min), named diagnostics, related scripts
- [ ] T012 [P] Create `docs/scripts/context-impact.md` — script registry entry with: name, description, usage, arguments (--json), outputs, named diagnostics, related scripts
- [ ] T013 [P] Create `docs/scripts/context-validate.md` — script registry entry with: name, description, usage, validation checks, named diagnostics, related scripts
