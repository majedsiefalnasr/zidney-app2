# Repository Hygiene Report

> **Generated:** 2026-03-16T15:39:30.455Z
> **Overall Verdict:** ⚑ ATTENTION REQUIRED

---

## Summary Table

| Check                             | Status | Summary                                                                      |
| --------------------------------- | ------ | ---------------------------------------------------------------------------- |
| ✅ Routing Authority Verification | `PASS` | All 3 routing surfaces have valid authoritative roots                        |
| ⚑ Template System Consolidation   | `FLAG` | 38 legacy consumer(s) and 2 parity gap(s) found                              |
| ⚑ Dead Script Detection           | `FLAG` | 168 scripts scanned: 168 active, 16 duplicate-root-stubs, 0 potentially dead |
| ⚑ Dependency Hygiene              | `FLAG` | 77 unused and 15 version-conflict(s) found across 15 workspaces (advisory)   |
| ⚑ Workspace Package Validation    | `FLAG` | 1 orphaned package(s) found: @zidney/config                                  |
| ⚑ Skill Surface Validation        | `FLAG` | 23 skill surface issue(s) found                                              |
| ⚑ CI Workflow Hygiene             | `FLAG` | 5 duplicate run: command(s) and 2 step label overlap(s) across 5 workflows   |
| ✅ AI Context Freshness           | `PASS` | AI context artifacts are current                                             |
| ✅ Architecture Guard             | `PASS` | Architecture checks passed: arch:guard ✓, arch:health ✓                      |

---

## Detailed Results

### ✅ Routing Authority Verification `[PASS]`

**Summary:** All 3 routing surfaces have valid authoritative roots

---

### ⚑ Template System Consolidation `[FLAG]`

**Summary:** 38 legacy consumer(s) and 2 parity gap(s) found

**Findings:**

- `.specify/scripts/bash/setup-plan.sh:41` — Legacy template consumer: "LEGACY_TEMPLATE="$REPO_ROOT/.specify/templates/plan-template.md""
- `.specify/scripts/bash/update-agent-context.sh:82` — Legacy template consumer: "LEGACY_TEMPLATE_FILE="$REPO_ROOT/.specify/templates/agent-file-template.md""
- `.specify/scripts/bash/create-new-feature.sh:284` — Legacy template consumer: "LEGACY_TEMPLATE="$REPO_ROOT/.specify/templates/spec-template.md""
- `docs/SPEC_KIT_HARD_MODE_WORKFLOW.md:17` — Legacy template consumer: "`.github/*`, `.specify/templates/*`, or `specs/templates/*`."
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:98` — Legacy template consumer: "- Legacy Compatibility Surfaces: `.specify/templates/`"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:101` — Legacy template consumer: "`.specify/templates/` as a compatibility surface until all remaining consumers are retired"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:105` — Legacy template consumer: "- no contributor or automation surface relies on `.specify/templates/` without explicit fallback"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:118` — Legacy template consumer: "| `.specify/scripts/bash/create-new-feature.sh` | `.specify/templates/spec-template.md` | `s"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:119` — Legacy template consumer: "| `.specify/scripts/bash/setup-plan.sh` | `.specify/templates/plan-template.md` | `s"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:120` — Legacy template consumer: "| `.specify/scripts/bash/update-agent-context.sh` | `.specify/templates/agent-file-template.md` | `s"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:121` — Legacy template consumer: "| `.agents/agents/speckit.specify.agent.md` | `.specify/templates/spec-template.md` | `s"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:122` — Legacy template consumer: "| `.github/agents/speckit.specify.agent.md` | `.specify/templates/spec-template.md` | `s"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:123` — Legacy template consumer: "| `.agents/agents/speckit.tasks.agent.md` | `.specify/templates/tasks-template.md` | `s"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:124` — Legacy template consumer: "| `.github/agents/speckit.tasks.agent.md` | `.specify/templates/tasks-template.md` | `s"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:125` — Legacy template consumer: "| `.agents/agents/speckit.checklist.agent.md` | `.specify/templates/checklist-template.md` | `s"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:126` — Legacy template consumer: "| `.github/agents/speckit.checklist.agent.md` | `.specify/templates/checklist-template.md` | `s"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:127` — Legacy template consumer: "| `.agents/agents/speckit.constitution.agent.md` | `.specify/templates/{constitution,plan,spec,tasks}-template.md` | `s"
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:128` — Legacy template consumer: "| `.github/agents/speckit.constitution.agent.md` | `.specify/templates/{constitution,plan,spec,tasks}-template.md` | `s"
- `docs/reports/REPOSITORY_HYGIENE_REPORT.md:38` — Legacy template consumer: "- `.specify/scripts/bash/setup-plan.sh:41` — Legacy template consumer: "LEGACY_TEMPLATE="$REPO_ROOT/.specify/templates/p"
- `docs/reports/REPOSITORY_HYGIENE_REPORT.md:39` — Legacy template consumer: "- `.specify/scripts/bash/update-agent-context.sh:82` — Legacy template consumer: "LEGACY_TEMPLATE_FILE="$REPO_ROOT/.spec"
- `docs/reports/REPOSITORY_HYGIENE_REPORT.md:40` — Legacy template consumer: "- `.specify/scripts/bash/create-new-feature.sh:284` — Legacy template consumer: "LEGACY_TEMPLATE="$REPO_ROOT/.specify/te"
- `docs/reports/REPOSITORY_HYGIENE_REPORT.md:41` — Legacy template consumer: "- `docs/SPEC_KIT_HARD_MODE_WORKFLOW.md:17` — Legacy template consumer: "`.github/*`, `.specify/templates/*`, or `specs/t"
- `docs/reports/REPOSITORY_HYGIENE_REPORT.md:42` — Legacy template consumer: "- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:98` — Legacy template consumer: "- Legacy Compatibility "
- `docs/reports/REPOSITORY_HYGIENE_REPORT.md:43` — Legacy template consumer: "- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:101` — Legacy template consumer: "`.specify/templates/` "
- `docs/reports/REPOSITORY_HYGIENE_REPORT.md:44` — Legacy template consumer: "- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:105` — Legacy template consumer: "- no contributor or au"
- `docs/reports/REPOSITORY_HYGIENE_REPORT.md:45` — Legacy template consumer: "- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:118` — Legacy template consumer: "| `.specify/scripts/ba"
- `docs/reports/REPOSITORY_HYGIENE_REPORT.md:46` — Legacy template consumer: "- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:119` — Legacy template consumer: "| `.specify/scripts/ba"
- `docs/reports/REPOSITORY_HYGIENE_REPORT.md:47` — Legacy template consumer: "- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:120` — Legacy template consumer: "| `.specify/scripts/ba"
- `docs/reports/REPOSITORY_HYGIENE_REPORT.md:48` — Legacy template consumer: "- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:121` — Legacy template consumer: "| `.agents/agents/spec"
- `docs/reports/REPOSITORY_HYGIENE_REPORT.md:49` — Legacy template consumer: "- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md:122` — Legacy template consumer: "| `.github/agents/spec"
- _…and 10 more_

---

### ⚑ Dead Script Detection `[FLAG]`

**Summary:** 168 scripts scanned: 168 active, 16 duplicate-root-stubs, 0 potentially dead

**Findings:**

- `scripts/init-test-db.sh` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/build/init-test-db.sh (flagged for human review)
- `scripts/infra-audit.ts` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/architecture/infra-audit.ts (flagged for human review)
- `scripts/run-all-tests.sh` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/ci/run-all-tests.sh (flagged for human review)
- `scripts/cleanup-test-env.sh` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/build/cleanup-test-env.sh (flagged for human review)
- `scripts/type-safety-guard.ts` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/governance/type-safety-guard.ts (flagged for human review)
- `scripts/deploy-staging.sh` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/ci/deploy-staging.sh (flagged for human review)
- `scripts/ai-guard.ts` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/architecture/ai-guard.ts (flagged for human review)
- `scripts/verify-test-env.sh` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/build/verify-test-env.sh (flagged for human review)
- `scripts/validate/check-tsconfig-strict.sh` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/build/check-tsconfig-strict.sh (flagged for human review)
- `scripts/reset-test-redis.sh` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/build/reset-test-redis.sh (flagged for human review)
- `scripts/deploy-production.sh` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/ci/deploy-production.sh (flagged for human review)
- `scripts/seed-dashboard-test-data.ts` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/dev/seed-dashboard-test-data.ts (flagged for human review)
- `scripts/architecture-diff.ts` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/architecture/architecture-diff.ts (flagged for human review)
- `scripts/run-staging-smoke-tests.sh` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/ci/run-staging-smoke-tests.sh (flagged for human review)
- `scripts/generate-ai-context.ts` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/dev/generate-ai-context.ts (flagged for human review)
- `scripts/check-store-cycles.ts` — DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/dev/check-store-cycles.ts (flagged for human review)

<details><summary>Raw output</summary>

```
Active: 168
Duplicate Root Stubs: 16
Potentially Dead: 0
```

</details>

---

### ⚑ Dependency Hygiene `[FLAG]`

**Summary:** 77 unused and 15 version-conflict(s) found across 15 workspaces (advisory)

**Findings:**

- `root: @types/bun` — UNUSED — no import found in source files for @types/bun (advisory: verify before removal)
- `root: @biomejs/biome` — UNUSED — no import found in source files for @biomejs/biome (advisory: verify before removal)
- `root: @types/node` — UNUSED — no import found in source files for @types/node (advisory: verify before removal)
- `root: @types/pg` — UNUSED — no import found in source files for @types/pg (advisory: verify before removal)
- `root: @vitest/coverage-v8` — UNUSED — no import found in source files for @vitest/coverage-v8 (advisory: verify before removal)
- `root: concurrently` — UNUSED — no import found in source files for concurrently (advisory: verify before removal)
- `root: husky` — UNUSED — no import found in source files for husky (advisory: verify before removal)
- `root: jsdom` — UNUSED — no import found in source files for jsdom (advisory: verify before removal)
- `root: lint-staged` — UNUSED — no import found in source files for lint-staged (advisory: verify before removal)
- `root: prettier` — UNUSED — no import found in source files for prettier (advisory: verify before removal)
- `root: typescript` — UNUSED — no import found in source files for typescript (advisory: verify before removal)
- `root: wait-on` — UNUSED — no import found in source files for wait-on (advisory: verify before removal)
- `root: yaml-lint` — UNUSED — no import found in source files for yaml-lint (advisory: verify before removal)
- `packages/job-queue: @types/uuid` — UNUSED — no import found in source files for @types/uuid (advisory: verify before removal)
- `packages/job-queue: @zidney/types` — UNUSED — no import found in source files for @zidney/types (advisory: verify before removal)
- `packages/job-queue: typescript` — UNUSED — no import found in source files for typescript (advisory: verify before removal)
- `packages/job-queue: vitest` — UNUSED — no import found in source files for vitest (advisory: verify before removal)
- `packages/types: typescript` — UNUSED — no import found in source files for typescript (advisory: verify before removal)
- `packages/logger: @types/node` — UNUSED — no import found in source files for @types/node (advisory: verify before removal)
- `packages/logger: typescript` — UNUSED — no import found in source files for typescript (advisory: verify before removal)
- `packages/config: typescript` — UNUSED — no import found in source files for typescript (advisory: verify before removal)
- `packages/redis-utils: typescript` — UNUSED — no import found in source files for typescript (advisory: verify before removal)
- `packages/ui-system: lucide-vue-next` — UNUSED — no import found in source files for lucide-vue-next (advisory: verify before removal)
- `packages/ui-system: tw-animate-css` — UNUSED — no import found in source files for tw-animate-css (advisory: verify before removal)
- `packages/ui-system: @tailwindcss/postcss` — UNUSED — no import found in source files for @tailwindcss/postcss (advisory: verify before removal)
- `packages/ui-system: @types/node` — UNUSED — no import found in source files for @types/node (advisory: verify before removal)
- `packages/ui-system: @vitest/ui` — UNUSED — no import found in source files for @vitest/ui (advisory: verify before removal)
- `packages/ui-system: @vue/test-utils` — UNUSED — no import found in source files for @vue/test-utils (advisory: verify before removal)
- `packages/ui-system: autoprefixer` — UNUSED — no import found in source files for autoprefixer (advisory: verify before removal)
- `packages/ui-system: postcss` — UNUSED — no import found in source files for postcss (advisory: verify before removal)
- _…and 62 more_

---

### ⚑ Workspace Package Validation `[FLAG]`

**Summary:** 1 orphaned package(s) found: @zidney/config

**Findings:**

- `@zidney/config` — ORPHANED — no import or dependency entry found in any apps/ workspace

---

### ⚑ Skill Surface Validation `[FLAG]`

**Summary:** 23 skill surface issue(s) found

**Findings:**

- `.agents/skills/zidney-frontend-engineering` — Skill directory not referenced in SKILLS_INDEX.md or any AGENTS.md
- `.agents/skills/shadcn-vue-ui-system` — Skill directory not referenced in SKILLS_INDEX.md or any AGENTS.md
- `.agents/skills/tailwind-design-system` — Skill directory not referenced in SKILLS_INDEX.md or any AGENTS.md
- `--------` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/--------
- `-------` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/-------
- `-----------` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/-----------
- `aws-serverless-eda` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/aws-serverless-eda
- `aws-serverless-eda-foundational` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/aws-serverless-eda-foundational
- `aws-serverless-eda-patterns` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/aws-serverless-eda-patterns
- `aws-serverless-eda-operations` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/aws-serverless-eda-operations
- `aws-mcp-setup` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/aws-mcp-setup
- `on-demand` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/on-demand
- `aws-cdk-development` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/aws-cdk-development
- `aws-cost-operations` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/aws-cost-operations
- `aws-agentic-ai` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/aws-agentic-ai
- `prompt-loaded` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/prompt-loaded
- `gitnexus-refactoring` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/gitnexus-refactoring
- `gitnexus-exploring` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/gitnexus-exploring
- `gitnexus-debugging` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/gitnexus-debugging
- `gitnexus-impact-analysis` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/gitnexus-impact-analysis
- `gitnexus-cli` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/gitnexus-cli
- `gitnexus-guide` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/gitnexus-guide
- `----------` — STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/----------

---

### ⚑ CI Workflow Hygiene `[FLAG]`

**Summary:** 5 duplicate run: command(s) and 2 step label overlap(s) across 5 workflows

**Findings:**

- `bun install` — Duplicate run: command found in 2 workflows: .github/workflows/architecture-governance.yml, .github/workflows/ai-context-validation.yml — consolidation candidate
- `bun install --frozen-lockfile` — Duplicate run: command found in 2 workflows: .github/workflows/ci-type-safety.yml, .github/workflows/ci.yml — consolidation candidate
- `bun run typecheck:src` — Duplicate run: command found in 2 workflows: .github/workflows/ci-type-safety.yml, .github/workflows/ci.yml — consolidation candidate
- `bun run typecheck:tests` — Duplicate run: command found in 2 workflows: .github/workflows/ci-type-safety.yml, .github/workflows/ci.yml — consolidation candidate
- `bun run lint` — Duplicate run: command found in 2 workflows: .github/workflows/ci-type-safety.yml, .github/workflows/ci.yml — consolidation candidate
- `Step: "install dependencies"` — Duplicate step label in 4 workflows: .github/workflows/architecture-governance.yml, .github/workflows/ci-type-safety.yml, .github/workflows/ai-context-validation.yml, .github/workflows/ci.yml — semantic overlap candidate
- `Step: "run biome lint + format check"` — Duplicate step label in 2 workflows: .github/workflows/ci-type-safety.yml, .github/workflows/ci.yml — semantic overlap candidate

---

### ✅ AI Context Freshness `[PASS]`

**Summary:** AI context artifacts are current

<details><summary>Raw output</summary>

```
📊 Generation Results:
   Status: ✓ SUCCESS
   Artifacts: 7
   Duration: 8ms
   Modules: 14
   Violations: 0

$ bun run ai:context:generate --validate
```

</details>

---

### ✅ Architecture Guard `[PASS]`

**Summary:** Architecture checks passed: arch:guard ✓, arch:health ✓

---

_Generated by `scripts/dev/hygiene-report-generator.ts`_
