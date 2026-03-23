# Zidney – Root AI Behavioral Contract

---

## AI Context Loading Order (Mandatory)

Before any reasoning, planning, or code generation, AI agents MUST load these in order:

1. `docs/ai/AI_BOOTSTRAP.md` — Architecture-first reasoning model
2. `docs/ai/AI_CONTEXT_INDEX.md` — AI governance pipeline entry point
3. `docs/PROJECT_CONTEXT_PRIMER.md` — Platform identity, trust chain, isolation rules
4. `docs/ai/AI_ENGINEERING_RULES.md` — Detailed engineering constraints
5. `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` — Architecture contract
6. `docs/architecture/ADR/` — Binding architectural decisions

Conflict resolution: **ADR > Specs > AI_CONTEXT_INDEX > AI_ENGINEERING_RULES > AGENTS.md > Implementation**

---

## Platform Identity

Zidney: stability-first, exam-centric, white-label SaaS platform.

Apps: **MMC** | **Backoffice** | **Frontoffice** | **API** (Bun + Hono) | **Worker**

Trust chain: **Isolation → License → Authentication → Attempt → Runtime → Frontoffice**

Breaking this chain is a platform failure.

---

## Non-Negotiable Rules

### Multi-Tenancy (Hard Rule)

- Database-per-tenant (one PostgreSQL instance, one pool per tenant)
- Tenant resolved via slug (subdomain AND path)
- License validation middleware mandatory on all workspace routes
- **Forbidden:** row-based multi-tenancy, shared tenant tables, cross-tenant joins, global DB singleton, workspace override from request body

### Import Boundaries

- `apps/*` → `packages/*` ✅ | `packages/*` → `packages/*` ✅
- `apps/*` → other `apps/*` ❌ | `packages/*` → `apps/*` ❌ | UI → DB schemas ❌

### Layering

- **UI:** Vue 3 + shadcn-vue + Tailwind v4. No business logic, no DB imports, no env vars.
- **API:** Routing → tenant resolver → license middleware → domain packages. No embedded business rules.
- **Domain Packages:** Pure functions. No HTTP, no framework dependencies.
- **Worker:** Background jobs. Idempotent, retry strategy, no direct UI communication.

### Attempt Engine

- Snapshot config, questions, grading at attempt start. No live references during grading.
- Server time authoritative. Submission idempotent. Worker finalizes.

### Error Contract

All API responses: `{ success: boolean, data: object | null, error: { code, message } | null }`

---

## AI Behavioral Rules

### Architecture Authority

- ADRs (`docs/architecture/ADR/`) are binding. AI must never invent architecture.
- New modules under `packages/` or `apps/` must be registered: `bun run arch:add-module <path>`

### Migration Discipline

- Forward-only migrations in `apps/api/src/db/{master,tenant}/migrations/`
- Never modify existing migration files. Never execute schema SQL via MCP.
- See skill: `.agents/skills/db-migration-governance/SKILL.md`

### Governance Tooling

AI must assume this validation pipeline runs locally and in CI:

```
bun scripts/ai-guard.ts && bun scripts/infra-audit.ts && bun run lint && bun run typecheck && bun run test
```

If a change would break the audit, AI must refuse to generate it.

### MCP Auto-Trigger Rules

- **Context7 MCP:** Auto-invoke for third-party library docs (Hono, Drizzle, Vue 3, etc.)
- **GitNexus MCP:** Auto-invoke for internal codebase context, blast radius, refactors
- **Postgres/DB MCP:** Auto-invoke for schema inspection, query validation (read-first, no destructive SQL)
- **GitHub MCP:** Auto-invoke for PR/issue/branch state checks
- MCP usage is mandatory. Training knowledge alone is insufficient for technical tasks.

### Stage Lifecycle

Validate stage status before modifying any spec. CLOSED/HARDENED stages are frozen.
See: `specs/STAGE_LIFECYCLE_POLICY.md`

### Testing

No feature is complete without: unit tests + integration tests (if API) + migration validated + lint + typecheck passes.

### Escalation

If AI detects ambiguous spec, conflicting ADR, migration risk, or tenant isolation risk → **STOP** and request clarification. Guessing is forbidden.

---

## Architecture Self-Healing

When `ai-guard.ts` or `infra-audit.ts` detects violations, AI must: stop → diagnose → propose compliant fix → regenerate code.
Detail: `.agents/skills/architecture-self-healing/SKILL.md`

Architecture intelligence artifacts in `docs/ai/context/` are authoritative for module discovery. Regenerate with `bun scripts/infra-audit.ts`.

---

## Source of Truth Priority

**ADR (docs/architecture) > Specs > This file > Code**

This contract is authoritative.

---

## Reference Index

| Topic                     | Authoritative Source                                   |
| ------------------------- | ------------------------------------------------------ |
| Full engineering rules    | `docs/ai/AI_ENGINEERING_RULES.md`                      |
| Platform context          | `docs/PROJECT_CONTEXT_PRIMER.md`                       |
| Agent governance          | `docs/AGENT_GOVERNANCE.md`                             |
| SpecKit workflow          | `docs/SPEC_KIT_HARD_MODE_WORKFLOW.md`                  |
| Architecture map          | `docs/architecture/intelligence/ARCHITECTURE_MAP.json` |
| Architecture intelligence | `docs/ai/context/ai-architecture-summary.md`           |
| UI system rules           | `docs/AGENT_GOVERNANCE.md` (Rules 7.1–7.10)            |
| Skill index               | `.agents/skills/SKILLS_INDEX.md`                       |
| Orchestrator              | `.agents/agents/zidney-orchestrator.agent.md`          |

---

## UI Development

When building or modifying any Vue 3 UI, components, layouts, or design system elements:

- Load and apply the `ckm:ui-styling` skill (`.agents/skills/ui-styling/SKILL.md`)
- Use `pnpm dlx shadcn-vue@latest add [component]` to add shadcn-vue components
- Follow Vue SFC patterns (`<script setup lang="ts">` + `<template>`)
- Use vee-validate + `@vee-validate/zod` + zod for form validation
- Use `@vueuse/core` `useColorMode()` for dark mode
- Prefer Reka UI primitives for accessible, unstyled base components
- Use `class` (not `className`), `for` (not `htmlFor`), `as-child` (not `asChild`)

---

<!-- gitnexus:start -->

# GitNexus MCP

This project is indexed by GitNexus as **zidney-app2** (8072 symbols, 15794 relationships, 300 execution flows).

AI must use GitNexus for: understanding modules, impact analysis, dependency tracing, architectural discovery.

1. **Read `gitnexus://repo/{name}/context`** first to check index freshness
2. Match task to a skill in `.agents/skills/gitnexus/`
3. If index is stale → run `npx gitnexus analyze`

| Task                              | Skill                                                       |
| --------------------------------- | ----------------------------------------------------------- |
| Architecture / "How does X work?" | `.agents/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks?"     | `.agents/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Bug tracing                       | `.agents/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Refactoring                       | `.agents/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools & schema reference          | `.agents/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| CLI commands                      | `.agents/skills/gitnexus/gitnexus-cli/SKILL.md`             |

**Context artifact:** `docs/ai/context/gitnexus-context.json` — regenerate with `bun run arch:gitnexus:context`, validate with `bun run arch:validate:gitnexus`. Refresh if >24h old.

<!-- gitnexus:end -->

<!-- rtk-instructions v2 -->

# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. Safe passthrough if no dedicated filter exists.

```bash
# Always use rtk, even in chains:
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## Quick Reference

| Category | Commands                                               | Savings |
| -------- | ------------------------------------------------------ | ------- |
| Tests    | `rtk vitest run`, `rtk playwright test`                | 90-99%  |
| Build    | `rtk tsc`, `rtk lint`, `rtk prettier --check`          | 70-87%  |
| Git      | `rtk git status/log/diff/add/commit/push`              | 59-80%  |
| GitHub   | `rtk gh pr view/checks`, `rtk gh run list`             | 26-87%  |
| Packages | `rtk pnpm list/install/outdated`                       | 70-90%  |
| Files    | `rtk ls/read/grep/find`                                | 60-75%  |
| Infra    | `rtk docker ps/images/logs`                            | 85%     |
| Analysis | `rtk err <cmd>`, `rtk log <file>`, `rtk summary <cmd>` | 70-90%  |
| Meta     | `rtk gain`, `rtk discover`, `rtk proxy <cmd>`          | —       |

<!-- /rtk-instructions -->
