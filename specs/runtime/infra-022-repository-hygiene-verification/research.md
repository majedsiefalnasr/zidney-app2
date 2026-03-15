# INFRA-022 — Phase 0 Research

Generated: 2026-03-16  
Branch: spec/infra-022-repository-hygiene-verification

---

## Resolved Unknowns

All NEEDS CLARIFICATION items from the Technical Context have been resolved below.

---

### R001 — Does `bun run ai-context:validate` exist?

**Decision**: Script exists.  
**Rationale**: `package.json` defines `"ai-context:validate": "bun scripts/generate-ai-context.ts --validate"`. The file `scripts/generate-ai-context.ts` exists at the root-level and accepts `--validate` as a CLI flag.  
**T008 treatment**: Run the command with `Bun.spawn`; distinguish ENOENT/missing-script exit from actual validation-error exit per spec clarifications.

---

### R002 — Do `bun run arch:guard` and `bun run arch:health` exist?

**Decision**: Both exist.  
**Rationale**:

- `"arch:guard": "bun scripts/architecture-guard/architecture-guard.ts"` — file exists.
- `"arch:health": "bun scripts/architecture-health/architecture-health.ts"` — file exists.

**T009 treatment**: Spawn both, capture stdout/stderr/exit. All violations are pre-existing (stage introduces no code changes); document only, do not block.

---

### R003 — What does ROUTING_AUTHORITY_REGISTRY.md declare?

**Decision**: Three surfaces, each with an authoritative and a legacy (compatibility) root.

| Surface   | Authoritative Root | Legacy Root           | Retirement Criteria                                    |
| --------- | ------------------ | --------------------- | ------------------------------------------------------ |
| agents    | `.agents/agents/`  | `.github/agents/`     | `update-agent-context.sh` no longer writes there       |
| prompts   | `.agents/prompts/` | `.github/prompts/`    | No downstream tooling loads `.github/prompts/`         |
| templates | `specs/templates/` | `.specify/templates/` | First-party scripts/guidance rewired to canonical root |

Both authoritative and legacy directories exist on disk. The legacy directories contain compatibility mirrors — they are retained intentionally per registry policy, not dead artifacts. T001 verification must confirm this alignment, not flag the legacy paths as errors.

---

### R004 — What workspace packages exist?

**Decision**: 9 packages in `packages/`, 5 apps in `apps/`.

| Workspace            | Name                |
| -------------------- | ------------------- |
| packages/api-client  | @zidney/api-client  |
| packages/config      | @zidney/config      |
| packages/domain-core | @zidney/domain-core |
| packages/job-queue   | @zidney/job-queue   |
| packages/logger      | @zidney/logger      |
| packages/redis-utils | @zidney/redis-utils |
| packages/types       | @zidney/types       |
| packages/ui-system   | @zidney/ui-system   |
| packages/validation  | @zidney/validation  |
| apps/api             | @zidney/api         |
| apps/backoffice      | @zidney/backoffice  |
| apps/frontoffice     | @zidney/frontoffice |
| apps/mmc             | @zidney/mmc         |
| apps/worker          | @zidney/worker      |

T004 scans root + all 14 workspaces independently. T005 checks each `packages/*` for at least one consumer in `apps/*`.

---

### R005 — Do existing scripts overlap with verification tasks?

**Decision**: Several existing scripts provide partial overlap; they should be invoked or adapted rather than duplicated.

| Existing Script                                      | Task Overlap                              | Plan Decision                                                                          |
| ---------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `scripts/dev/verify-dependency-usage.ts`             | T004                                      | Invoke via `Bun.spawn` as a sub-check; wrap output in hygiene report                   |
| `scripts/dev/analyze-dependencies.ts`                | T004                                      | Secondary reference for per-workspace analysis                                         |
| `scripts/dev/validate-script-duplication.ts`         | T003 (partial — duplicate detection only) | Used as input to dead script enumeration; T003 extends this with reference corpus scan |
| `scripts/architecture-guard/architecture-guard.ts`   | T009                                      | Invoke via `bun run arch:guard`                                                        |
| `scripts/architecture-health/architecture-health.ts` | T009                                      | Invoke via `bun run arch:health`                                                       |
| `scripts/generate-ai-context.ts --validate`          | T008                                      | Invoke via `bun run ai-context:validate`                                               |

No existing script covers T001, T002, T005, T006, T007, or T010 directly.

---

### R006 — Root-level vs. subdirectory script duplicates

**Decision**: 16 root-level scripts (scripts/_.ts, scripts/_.sh) have identical-name counterparts in subdirectories. This is relevant to T003.

Confirmed duplicates (root entry → subdir canonical):

| Root-level                          | Subdir canonical                          |
| ----------------------------------- | ----------------------------------------- |
| scripts/ai-guard.ts                 | scripts/architecture/ai-guard.ts          |
| scripts/architecture-diff.ts        | scripts/architecture/architecture-diff.ts |
| scripts/check-store-cycles.ts       | scripts/dev/check-store-cycles.ts         |
| scripts/check-tsconfig-strict.sh    | scripts/build/check-tsconfig-strict.sh    |
| scripts/cleanup-test-env.sh         | scripts/build/cleanup-test-env.sh         |
| scripts/deploy-production.sh        | scripts/ci/deploy-production.sh           |
| scripts/deploy-staging.sh           | scripts/ci/deploy-staging.sh              |
| scripts/generate-ai-context.ts      | scripts/dev/generate-ai-context.ts        |
| scripts/infra-audit.ts              | scripts/architecture/infra-audit.ts       |
| scripts/init-test-db.sh             | scripts/build/init-test-db.sh             |
| scripts/reset-test-redis.sh         | scripts/build/reset-test-redis.sh         |
| scripts/run-all-tests.sh            | scripts/ci/run-all-tests.sh               |
| scripts/run-staging-smoke-tests.sh  | scripts/ci/run-staging-smoke-tests.sh     |
| scripts/seed-dashboard-test-data.ts | scripts/dev/seed-dashboard-test-data.ts   |
| scripts/type-safety-guard.ts        | scripts/governance/type-safety-guard.ts   |
| scripts/verify-test-env.sh          | scripts/build/verify-test-env.sh          |

Root-level versions are the ones referenced by `package.json` scripts. The `scripts/dev/validate-script-duplication.ts` likely captures this pattern. T003 must flag these as "duplicate root stubs — review for consolidation" in the hygiene report.

Non-duplicated root-level scripts (only at root): `scripts/gitnexus-context.ts`.

---

### R007 — CI workflow overlap (T007)

**Decision**: Two confirmed overlaps exist between workflow files.

| Duplicate step                                         | Workflow A                    | Workflow B                                                 |
| ------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------- |
| TypeScript type checking (`bun run typecheck`)         | `ci.yml` (job: Type Check)    | `ci-type-safety.yml` (job: TypeScript — Strict Mode Check) |
| Architecture health (`bun run arch:health`)            | `architecture-governance.yml` | (indirectly via `arch:guard:ci` compound)                  |
| Type safety guard (`bun scripts/type-safety-guard.ts`) | `architecture-governance.yml` | `ci-type-safety.yml` (job: Type Safety Guard)              |

These are consolidation candidates for T007 output. No changes are made; these are documented findings only.

---

### R008 — Template system analysis (T002)

**Decision**: `specs/templates/` is the canonical root (14 files, per ROUTING_AUTHORITY_REGISTRY.md). `.specify/templates/` is the legacy root (7 files — subset, compatibility retained).

T002 must scan these reference surfaces for legacy-path consumers:

- `.specify/scripts/bash/*.sh` — shell scripts that drive spec generation
- `.github/workflows/*.yml` — CI steps that reference template paths
- `AGENTS.md`, app-level `AGENTS.md`, `docs/**` — documentation consumers

If `.specify/scripts/bash/` scripts reference `.specify/templates/` as the source path, that is a legacy consumer flagged under T002.

---

### R009 — Skill surface analysis (T006)

**Decision**: 20 top-level directories exist under `.agents/skills/`. All appear in `SKILLS_INDEX.md`. Two directories (`aws-skills/` and `gitnexus/`) have no root `SKILL.md` — this is expected; they are parent containers for sub-skill directories.

Skill directories present:
`Figma Implement Design`, `Figma MCP`, `GH Fix CI`, `Playwright`, `ai-terminal`, `analysis-retry-engine`, `architecture-intelligence`, `architecture-self-healing`, `aws-skills`, `git-governance`, `gitnexus`, `mcp-routing`, `package-manager-governance`, `precommit-diagnostics`, `rtk-execution-layer`, `specrate-main`, `subagent-parallelization`, `terminal-safety`, `tool-advisor`, `typescript-governance`, `vibe-testing-main`

T006 checks: (a) each directory is in SKILLS_INDEX.md, (b) AGENTS.md or a skill-loading instruction references it. Note: AWS skills and GitNexus skills are referenced externally via `~/.claude/skills/` path in the user-level AGENTS.md, not the in-repo index.

---

### R010 — AI context artifacts (T008)

**Decision**: All three spec-required artifacts exist under `docs/ai/context/`:

- `ai-dependency-graph.json` ✓
- `ai-module-map.json` ✓
- `ai-layer-model.json` ✓ (spec references "ai-layer-map.json" but actual file is `ai-layer-model.json`)

Note: The spec references "ai-layer-map.json" but the actual generated artifact is `ai-layer-model.json`. The validation script (`scripts/generate-ai-context.ts --validate`) validates the actual generated filenames — the verification check should defer to what the script validates, not hard-code the filename.

---

### R011 — Existing docs/reports directory

**Decision**: `docs/reports/` exists with 4 existing files. `REPOSITORY_HYGIENE_REPORT.md` is a new file — no prior version exists to overwrite.

---

## Alternatives Considered

| Decision                               | Alternative Rejected                 | Reason                                                        |
| -------------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Single orchestrator + per-task helpers | Monolithic script                    | Monolithic harder to test and hard to re-run individual tasks |
| Single orchestrator + per-task helpers | One script per task, no orchestrator | No single entry point for report generation                   |
| Invoke existing dependency scripts     | Write T004 from scratch              | Avoids duplication with verify-dependency-usage.ts            |
| Spawn subprocesses for T008/T009       | Direct import of guard modules       | Subprocess captures real CLI exit codes + output cleanly      |
| Text-regex reference scan for T003     | AST import analysis                  | Overkill; shell scripts and docs don't have AST               |
