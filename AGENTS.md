# Zidney – Root AI Behavioral Contract

---

## AI EXECUTION CHECKLIST

Before generating code:

1. Load AI_BOOTSTRAP.md
2. Load AI_CONTEXT_INDEX.md
3. Read PROJECT_CONTEXT_PRIMER.md
4. Check ARCHITECTURE_MAP.json
5. Verify ADR decisions
6. Query GitNexus context
7. Assume infra-audit.ts will validate changes
8. **If regenerating architecture, validate the brain with validate-architecture-brain.ts before
   committing**

---

## AI CONTEXT ENTRYPOINT (Mandatory)

AI agents must start reasoning by loading:

1. docs/ai/AI_BOOTSTRAP.md
2. docs/ai/AI_CONTEXT_INDEX.md
3. docs/PROJECT_CONTEXT_PRIMER.md
4. docs/ai/AI_ENGINEERING_RULES.md
5. docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json
6. docs/architecture/ADR/

AI_BOOTSTRAP.md defines the architecture‑first reasoning model and must always be loaded before any
other AI context files.

---

## Mandatory Context Initialization

Before performing architectural analysis, implementation, planning, or modification of any feature,
AI agents MUST read:

`docs/PROJECT_CONTEXT_PRIMER.md`

AI agents MUST also load the AI governance context:

`docs/ai/AI_CONTEXT_INDEX.md`

This file links the AI architecture contract, engineering rules, ADR references, and governance
pipeline.

AI tools must treat `AI_CONTEXT_INDEX.md` as the entry point for all AI-specific guidance before
generating code or proposing architectural changes.

This file defines:

- Platform identity
- Trust chain
- Multi-tenancy guarantees
- License enforcement model
- Attempt integrity model
- Versioning contract
- Isolation rules
- Deployment discipline

Failure to align with PROJECT_CONTEXT_PRIMER.md is considered architectural drift.

If this file changes, AGENTS.md must be reviewed and updated accordingly.

---

This file defines non-negotiable architectural rules for all AI agents and contributors.

Zidney is a stability-first, exam-centric, white-label SaaS platform.

If any generated code conflicts with this file, this file wins.

---

## Platform Identity

Zidney consists of:

- MMC (Platform control layer)
- Backoffice (Institution control panel)
- Frontoffice (Student runtime)
- API (Bun + Hono backend)
- Worker (Background job processor)

Trust chain:

Isolation → License → Authentication → Attempt → Runtime → Frontoffice

Breaking this chain is a platform failure.

---

## Multi-Tenancy Model (Hard Rule)

- Database-per-tenant
- One PostgreSQL instance
- One connection pool per tenant (in-memory map)
- Tenant resolved via slug (subdomain AND path supported)
- License validation middleware mandatory

Not allowed:

- Row-based multi-tenancy
- Shared student tables
- Shared attempt tables
- Cross-tenant joins
- Global DB singleton
- Workspace override from request body

All DB access must originate from tenant resolver context.

---

## Import Boundary Rules (MANDATORY)

Allowed:

apps/_ → packages/_ packages/_ → packages/_

Not allowed:

apps/_ → other apps/_ packages/_ → apps/_ UI → database schemas UI → backend logic

No cross-layer violations.

---

## Layering Model

UI Layer:

- Vue 3 + TypeScript
- shadcn-vue components
- Tailwind CSS v4 utilities
- No business logic
- No DB imports
- No environment variable access

API Layer:

- Handles routing
- Executes tenant resolver first
- Executes license middleware second
- Calls domain packages
- Never embeds business rules

Domain Packages:

- Contain business logic
- Pure functions
- No HTTP logic
- No framework dependencies

Worker:

- Executes background jobs
- Idempotent
- Uses retry strategy
- No direct UI communication

---

## UI System Rules

UI must use:

- shadcn-vue components first
- Tailwind v4 utilities for layout and spacing

Not allowed:

- Custom component system if shadcn equivalent exists
- Hardcoded brand colors
- Direct CSS overrides outside theme tokens

Theming model:

- Base theme = shadcn default
- Workspace overrides allowed only for:
  - Logo
  - Brand tokens
  - Favicon
  - Email branding
  - Certificate branding
  - SEO metadata

White-label is visual only.

---

## License Enforcement

License middleware must validate on every workspace request:

- Status
- Schema compatibility
- Product version compatibility

SOFT_LOCKED → 423 ARCHIVED → 403 NOT FOUND → 404

Limit enforcement must be transactional.

---

## Attempt Engine Integrity Rules

- Attempt must snapshot configuration at start
- Snapshot question list and order
- Snapshot grading configuration
- No live exam configuration references
- Submission must be idempotent
- Worker finalizes attempt
- Server time is authoritative

---

## Error Handling Standard

All API responses must follow:

{ success: boolean, data: object | null, error: { code: string, message: string } | null }

No unstructured error responses.

---

## Logging Rules

All services must use structured logging.

Required fields:

- timestamp
- level
- service
- workspace_slug
- workspace_id
- user_id (if available)
- correlation_id
- attempt_id (if applicable)

console.log is forbidden.

---

## Migration Rules

- One migration per feature
- Never modify old migration files
- Forward-only migrations
- Production upgrade requires snapshot backup
- Rollback = restore snapshot only

---

## Testing Requirements

Mandatory per feature:

- Unit tests (business logic)
- Integration tests (API flow)
- Snapshot tests (grading)

No merge without tests.

---

## Rate Limiting

- Login: 5 attempts/minute per IP
- Submission: idempotent, one per attempt
- WebSocket: 1 connection per user per attempt
- Public endpoints rate limited

---

## Secrets Management

- No secrets in code
- Production uses Docker secrets
- .env allowed locally only
- No secret exposed to frontend

---

## AI Behavioral Enforcement (Strict Contract)

### AI Context Loading Requirement

Before any reasoning, planning, code generation, or architectural analysis, AI must load the
following files in this order:

1. `docs/ai/AI_BOOTSTRAP.md`
2. `docs/ai/AI_CONTEXT_INDEX.md`
3. `docs/PROJECT_CONTEXT_PRIMER.md`
4. `docs/ai/AI_ENGINEERING_RULES.md`
5. `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json`

`AI_BOOTSTRAP.md` establishes the AI reasoning model and governance pipeline and must always be
loaded before any other AI context documents.

These files together define the behavioral contract, architecture boundaries, and governance
pipeline for AI-driven development inside Zidney.

If any conflict exists between these files, resolution order is:

ADR > Specs > AI_CONTEXT_INDEX > AI_ENGINEERING_RULES > AGENTS.md > Implementation

This section defines mandatory behavioral constraints for all AI agents (Copilot, MCP-enabled
agents, Claude, GLM, etc.) operating inside Zidney.

Violation of these rules is considered architectural failure.

### Architecture Authority

AI must treat:

- `docs/architecture/adr/adr-*` as binding architectural decisions.
- `specs/phases/` as the feature behavior authority.
- `docs/01_ENGINEERING_GOVERNANCE/` as enforcement authority.

Conflict resolution order:

ADR > Specs > This file > Implementation

AI must never invent or modify architecture without explicit approval.

---

### Tenant Isolation Protection (Critical)

AI must not:

- Implement row-based multi-tenancy.
- Share tenant tables.
- Instantiate database connections outside tenant resolver.
- Hardcode workspace identifiers.
- Allow tenant override from request body.
- Create cross-tenant joins.

All tenant database access must originate from resolver context.

No global database singleton allowed.

---

### Migration Discipline

AI must not:

- Execute schema-altering SQL directly via MCP.
- Modify schema outside migration files.
- Alter existing migration files retroactively.

All schema changes must be implemented through:

apps/api/src/db/master/migrations  
apps/api/src/db/tenant/migrations

Each migration must:

- Be forward-only.
- Increment schema_version.
- Be reversible only via snapshot restore.
- Align with semantic versioning (ADR-0008).

---

### License & Version Enforcement

AI must not:

- Access tenant DB before license middleware.
- Ignore schema_version compatibility.
- Ignore product_version compatibility.
- Skip soft-lock validation.

License validation middleware is mandatory for all workspace-bound routes.

---

### Attempt Engine Protection

AI must:

- Snapshot configuration at attempt start.
- Snapshot question list and order.
- Snapshot grading configuration.
- Use server-authoritative time (ADR-0006).
- Ensure submission is idempotent.
- Finalize attempts via Worker.

AI must not:

- Trust client timers.
- Trust client grading.
- Reference live exam configuration during grading.

---

### Runtime Safety Rules

AI must not:

- Disable rate limiting.
- Remove correlation ID propagation.
- Log sensitive data.
- Expose secrets.
- Log passwords or tokens.

All logs must be structured and include:

- correlation_id
- workspace_slug (if tenant-bound)
- service name

---

### Import Boundary Enforcement

apps/_ may import from packages/_  
packages/_ may import from packages/_

apps/_ may not import from other apps/_  
packages/_ may not import from apps/_

UI must not access database schemas or backend logic.

---

### Architecture Governance Tooling (Mandatory)

Zidney architecture is enforced automatically using governance scripts.

AI agents must run or reason against these tools before proposing structural changes.

Key tools:

scripts/infra-audit.ts Validates:

- architecture boundaries
- dependency graph
- layer violations
- undeclared modules
- architecture drift

scripts/ai-guard.ts Pre-commit enforcement:

- forbidden imports
- layer violations
- architecture map compliance

scripts/architecture/architecture-diff.ts Detects architectural drift between commits.

docs/architecture/intelligence/ARCHITECTURE_MAP.json Defines the authoritative module dependency
contract.

AI must treat these tools as **architecture validators**.

If a change affects module structure or dependencies, AI must assume `infra-audit.ts` will validate
the change.

If a change would break the audit, AI must refuse to generate it.

AI must assume the following validation workflow exists locally and in CI:

```
bun scripts/infra-audit.ts
bun run lint
bun run type-check
bun run test
```

Before proposing architectural refactors or module moves, AI should reason as if `infra-audit.ts`
will immediately validate:

- ARCHITECTURE_MAP.json compliance
- layer boundaries
- forbidden dependencies
- undeclared modules

If a new module is introduced under `packages/` or `apps/`, AI must also propose registering it
using:

```
bun run arch:add-module <module-path>
```

---

### UI System Enforcement

AI must:

- Use shadcn-vue components first.
- Use Tailwind v4 utilities for layout.
- Use theme tokens only.
- Respect white-label visual constraints.

AI must not:

- Introduce a new component system.
- Hardcode brand colors.
- Override theme structure outside allowed tokens.

White-label customization is visual only.

---

### MCP Usage Restrictions & Auto-Trigger Rules

AI must evaluate available MCPs before responding to any technical task. AI must prefer MCP-sourced
context over training knowledge for all code, documentation, and architecture tasks.

---

#### Context7 MCP — Auto-Trigger (no explicit prompt required)

AI must automatically invoke Context7 MCP when:

- Looking up documentation for any third-party library or framework (Hono, Bun, Vue 3, shadcn-vue,
  Drizzle ORM, Tailwind CSS, Vite, etc.).
- Generating code that imports or uses a third-party package.
- Answering setup, installation, or configuration questions for external tools.
- Resolving API references, method signatures, or option interfaces for any non-Zidney dependency.

Context7 must not be used for Zidney internal packages. Use GitNexus MCP for internal codebase
context.

---

#### GitNexus MCP — Auto-Trigger (no explicit prompt required)

AI must automatically invoke GitNexus MCP when:

- Understanding how a Zidney feature, module, or service works.
- Assessing the blast radius of a proposed change.
- Tracing the cause of a bug or unexpected behavior.
- Performing or planning a refactor, rename, extraction, or split.

AI must always read `gitnexus://repo/{name}/context` first to verify index freshness before any
GitNexus query.

If the index is stale, AI must prompt the user to run `npx gitnexus analyze` before proceeding.

GitNexus must be preferred over static reasoning when:

- locating modules
- discovering dependency chains
- evaluating refactor safety
- identifying affected services

If GitNexus provides repository context, AI must treat that context as authoritative over training
knowledge.

---

#### Postgres/DB MCP — Auto-Trigger (no explicit prompt required)

AI must automatically invoke Postgres/DB MCP when:

- Inspecting the current schema before writing a migration.
- Validating a query for correctness or performance.
- Debugging a database-level error or unexpected query result.

AI must not use Postgres/DB MCP to:

- Execute destructive SQL (DROP, TRUNCATE, DELETE without WHERE, etc.).
- Modify schema outside of migration files.
- Apply ad-hoc schema patches.
- Modify production databases.

Postgres/DB MCP is read-first. Controlled writes are allowed in development only, via migration
system.

---

#### Filesystem MCP — Auto-Trigger (no explicit prompt required)

AI must automatically invoke Filesystem MCP when:

- Reading ADR files before making any architectural decision.
- Reading spec files before generating or modifying any feature.
- Verifying that a migration file, spec, or config file exists before referencing it.
- Confirming directory structure before generating new files.

AI must not use Filesystem MCP to:

- Write or overwrite manually curated spec files.
- Modify files in CLOSED or HARDENED stages.
- Bypass the SpecKit directory structure.

---

#### GitHub MCP — Auto-Trigger (no explicit prompt required)

AI must automatically invoke GitHub MCP when:

- Checking the status of an open PR before suggesting changes.
- Referencing a commit, diff, or change history for context.
- Verifying whether an issue or bug has already been reported or resolved.
- Checking branch state before proposing or generating code.

AI must not use GitHub MCP to:

- Merge PRs or push commits without explicit user instruction.
- Close or modify issues autonomously.

---

#### General MCP Enforcement Rule

AI must not rely solely on training knowledge when an MCP can provide current, project-specific, or
authoritative context.

MCP usage is not optional — it is a mandatory step in the reasoning pipeline for all technical
tasks.

For Zidney internal code reasoning:

GitNexus MCP must always be used before relying on training knowledge.

Examples:

- locating modules
- understanding dependencies
- tracing execution flows
- performing refactors

---

### Architecture Discovery Workflow

Before proposing architectural modifications, AI must inspect the following in order:

1. `docs/architecture/intelligence/ARCHITECTURE_MAP.json`
2. `docs/architecture/ADR/`
3. `scripts/infra-audit.ts`
4. `gitnexus://repo/{name}/context`

Then AI must evaluate:

- whether the change violates existing ADRs
- whether the change breaks ARCHITECTURE_MAP.json contracts
- whether the change introduces a new module requiring registration

If any uncertainty exists, AI must stop and request clarification.

---

### Module Registration Rule

All new modules must be registered in:

docs/architecture/intelligence/ARCHITECTURE_MAP.json

If AI proposes a new module under:

packages/_ apps/_

AI must also propose registering the module using:

bun run arch:add-module <module-path>

---

### Testing Requirement

No feature is complete unless:

- Unit tests added.
- Integration tests added (if API).
- Migration validated.
- Lint passes.
- Type check passes.

AI must not generate production code without tests.

---

### Escalation Rule

If AI detects:

- Ambiguous specification.
- Conflicting ADR.
- Migration risk.
- Tenant isolation risk.
- Version compatibility uncertainty.

AI must stop and request clarification.

Guessing is forbidden.

---

### Stage Lifecycle Enforcement (Automatic Validator Rule)

AI must validate stage status before generating, modifying, or implementing any specification.

Rules:

1. AI must locate the target stage file inside `specs/phases/`.
2. AI must check for the presence of a "## Stage Status" block.
3. If Stage Status is:
   - DRAFT → Implementation forbidden.
   - IN PROGRESS → Modification allowed within scope.
   - BACKEND CLOSED → No structural backend modifications allowed.
   - PRODUCTION READY → No structural changes; only documentation allowed.
   - PRODUCTION HARDENED → File is frozen; changes require new stage.
   - DEPRECATED → Must reference replacement stage.

4. AI must refuse to:
   - Modify CLOSED or HARDENED stages.
   - Rename or renumber stages.
   - Expand scope of a CLOSED stage.
   - Insert new tasks into a CLOSED stage.

5. If a change is required for a CLOSED stage:
   - AI must propose creating a new stage.
   - AI must reference the original stage.
   - AI must maintain backward compatibility.

6. SpecKit must not regenerate or overwrite any stage marked BACKEND CLOSED, PRODUCTION READY, or
   PRODUCTION HARDENED.

If Stage Status block is missing, AI must stop and request clarification before proceeding.

Stage lifecycle governance is mandatory.

---

### Project Context Primer Enforcement

AI must:

- Load `docs/PROJECT_CONTEXT_PRIMER.md` before architectural reasoning.
- Validate changes against the Trust Chain model.
- Validate changes against multi-tenancy isolation.
- Validate changes against version enforcement rules.
- Validate changes against Attempt Engine immutability.

If PROJECT_CONTEXT_PRIMER.md conflicts with implementation: AI must escalate before proceeding.

PROJECT_CONTEXT_PRIMER.md is mandatory context, not documentation.

---

## SpecKit Execution Contract

All feature development must follow the Hard Mode SpecKit workflow defined in:

docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md

This document defines:

- Mandatory execution order
- Enforcement templates
- Architecture drift detection
- Safety gates before implementation
- Spec-to-code alignment rules

AI agents must not begin implementation without passing:

1. Constitution alignment
2. Specification validation
3. Architecture consistency analysis
4. Safety gate confirmation

SpecKit workflow is mandatory for all new feature development.

---

## SpecKit Directory Structure (Locked)

SpecKit must operate strictly within the following directory structure:

specs/ ├── phases/ │ ├── 01_platform_foundation/ │ ├── 02_mmc/ │ ├── 03_backoffice/ │ ├──
04_runtime/ │ └── 05_frontoffice/ │ ├── templates/ │ ├── specify_template.md │ ├── plan_template.md
│ ├── tasks_template.md │ ├── analyze_template.md │ └── implement_gate_template.md │ └──
constitution.md

Hard Rules:

- SpecKit must not generate flat spec files in specs root.
- All new features must be created inside specs/runtime/<phase_name>/.
- No stage renumbering without architectural review.
- No moving phases between directories.
- No overwriting manually curated spec files.
- SpecKit must not auto-generate architecture changes.
- All generated files must align with ADR decisions.

If SpecKit generates content outside this structure, it must be rejected.

Spec directory structure is part of architectural governance.

---

## Context Anchor Prompt (Mandatory For New Threads)

When starting a new AI thread, the following context anchor must be pasted at the top:

---

ZIDNEY CONTEXT ANCHOR

You are operating inside Zidney — a stability-first, exam-centric, white-label SaaS platform.

Architecture Trust Chain: Isolation → License → Authentication → Attempt → Runtime → Frontoffice

Non-Negotiable Rules:

- Database-per-tenant only.
- License middleware required for all workspace routes.
- Schema and product version compatibility mandatory.
- Attempt configuration must be snapshotted at start.
- Server time is authoritative.
- No cross-tenant joins.
- No row-based multi-tenancy.
- No global DB singleton.
- All changes must align with ADRs.
- SpecKit Hard Mode workflow is mandatory.
- Stage lifecycle status must be validated before implementation.

If uncertain about architecture, stop and ask for clarification.

---

AI agents must refuse to continue if the trust chain is violated or if a stage lifecycle status
conflict exists.

---

## Architecture Self‑Healing System (Advanced AI Governance)

Zidney implements an **Architecture Self‑Healing mechanism** designed for AI‑assisted development
environments.

The purpose of this system is to ensure that when an AI agent introduces a change that violates
architectural constraints, the system can **automatically detect, diagnose, and suggest a compliant
repair strategy**.

This mechanism integrates the following components:

- `scripts/ai-guard.ts`
- `scripts/infra-audit.ts`
- `docs/architecture/intelligence/ARCHITECTURE_MAP.json`
- `docs/ai/context/ai-architecture-brain.json`
- GitNexus MCP knowledge graph

### Self‑Healing Workflow

When an architectural violation is detected:

1. `ai-guard.ts` identifies the rule violation.
2. The violation is compared against `ARCHITECTURE_MAP.json`.
3. `infra-audit.ts` analyzes the dependency graph and architecture layer rules.
4. The AI Architecture Brain (`ai-architecture-brain.json`) provides context about module
   relationships.
5. GitNexus MCP may be used to determine dependency flows and blast radius.

The AI agent must then **repair the architecture instead of bypassing the rule**.

### Examples of Self‑Healing Behavior

Example 1 — Illegal Import

Violation:

apps/api importing from apps/backoffice

Repair strategy:

Move shared logic into a new `packages/*` module and update imports.

Example 2 — Undeclared Module

Violation:

New module detected under `packages/` not declared in `ARCHITECTURE_MAP.json`.

Repair strategy:

AI must propose running:

```
bun run arch:add-module <module-path>
```

Example 3 — Layer Violation

Violation:

UI module importing domain logic incorrectly.

Repair strategy:

Refactor logic into a domain package and expose via API client.

### AI Repair Requirement

If `ai-guard.ts` or `infra-audit.ts` reports violations, AI agents must:

1. Stop code generation.
2. Diagnose the violation.
3. Propose an architecture‑compliant fix.
4. Regenerate code that satisfies governance rules.

AI agents **must never suppress or bypass architecture validation scripts**.

### Self‑Healing Audit Trigger

AI agents should assume the following validation pipeline exists locally and in CI:

```
bun scripts/ai-guard.ts
bun scripts/infra-audit.ts
bun scripts/governance/validate-architecture-brain.ts
```

If violations occur, AI must reason about the architecture graph and correct the structure before
proceeding.

This architecture self‑healing mechanism ensures Zidney remains **structurally stable even under
autonomous AI‑driven development workflows**.

### Architecture Brain Validation (Critical Safety Gate)

The ai-architecture-brain.json artifact is critical to AI Guard validation. **Corrupt brains lead to
false-positive violations**, making it impossible to push valid code.

**Prevention Rules:**

AI agents MUST validate the architecture brain whenever:

- Running `infra-audit.ts` (validates as part of audit)
- Committing architecture intelligence files
- Planning to push changes to the repository

Before committing implementation changes that involve architecture regeneration:

1. Run the full validation pipeline above.
2. Verify `ai-guard.ts` passes with **zero violations**.
3. Confirm `validate-architecture-brain.ts` returns valid brain (exit code 0).
4. Only commit if both pass.

**What to validate:**

- All dependency graph edges have valid source and target modules (format: `packages/<name>` or
  `apps/<name>`)
- No relative paths (`./ prefix`)
- No path segments beyond the module root (no `src/`, `dist/`, etc.)
- No malformed concatenations (like `srcvue/test-utils`)

**If validation fails:**

1. STOP all commits
2. Check the validation error output for which edges are malformed
3. Run `bun scripts/infra-audit.ts` to regenerate from source
4. Do NOT manually edit the brain JSON
5. Validate again before committing

The pre-commit hook automatically validates the brain if architecture context files change —
**commits with corrupt brains are automatically blocked**.

---

## Auto‑Generated AI Architecture Intelligence Layer

Zidney maintains an **AI‑readable architecture intelligence layer** to make automated reasoning
about the codebase deterministic.

This layer is generated from the repository structure and governance tools and must be treated as
**machine‑readable architecture context**.

Location:

```
docs/ai/context/
```

Generated artifacts:

```
docs/ai/context/
├── ai-layer-model.json
├── ai-module-map.json
├── ai-dependency-graph.json
├── ai-runtime-map.json
├── ai-runtime-dependents.json
├── ai-architecture-brain.json
├── ai-architecture-diff.json
├── ai-context-mini.json
└── ai-architecture-summary.md
```

Purpose of each artifact:

ai-layer-model.json Defines Zidney’s architectural layers and allowed dependency directions.

ai-module-map.json Maps every module under `packages/` and `apps/` to its architecture layer.

ai-dependency-graph.json Machine-readable graph of module dependencies used by:

- `infra-audit.ts`
- `ai-guard.ts`
- CI architecture validation

ai-runtime-map.json Defines runtime services and how they interact:

- API
- Worker
- MMC
- Backoffice
- Frontoffice

ai-architecture-summary.md Human-readable architecture overview automatically derived from the
repository.

ai-runtime-dependents.json Reverse dependency graph showing which services or modules depend on a
given module. Used for blast‑radius analysis and refactor safety.

ai-architecture-brain.json Machine‑readable architecture intelligence produced by `infra-audit.ts`.
Contains dependency graph, architecture score, hotspots, and rule sets. This file is consumed by:

- `scripts/ai-guard.ts`
- GitNexus MCP
- AI agents performing architectural reasoning

ai-architecture-diff.json Generated architecture diff between the current audit and the previous
snapshot. Used for detecting architectural drift in CI and PR validation.

ai-context-mini.json A lightweight architecture context designed for MCP tools and AI agents that
need fast bootstrap context without loading the full graph.

AI agents must prefer this intelligence layer when performing:

- architecture analysis
- refactor planning
- dependency tracing
- blast radius analysis

If these files exist, they are **authoritative for architecture discovery** and should be consulted
before reasoning about module relationships.

These files are generated automatically by the architecture governance system and must not be
manually edited.

If these files become outdated, regenerate the architecture intelligence layer:

```
bun scripts/infra-audit.ts
```

To automatically register newly detected modules in `ARCHITECTURE_MAP.json`, run the self‑healing
audit:

```
bun scripts/infra-audit.ts --fix-map
```

This updates the architecture map when new modules appear under `packages/` or `apps/`.

---

## Source of Truth Priority

ADR (docs/architecture) > Specs > This file > Code

This contract is authoritative.

<!-- gitnexus:start -->

# GitNexus MCP

This project is indexed by GitNexus as **zidney-app2** (8072 symbols, 15794 relationships, 300 execution flows).

AI must use GitNexus for:

- understanding existing modules
- impact analysis before refactors
- dependency tracing
- architectural discovery

GitNexus is the authoritative internal code context.

## Always Start Here

1. **Read `gitnexus://repo/{name}/context`** — codebase overview + check index freshness
2. **Match your task to a skill below** and **read that skill file**
3. **Follow the skill's workflow and checklist**

> If step 1 warns the index is stale, run `npx gitnexus analyze` in the terminal first.

## Skills

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.agents/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.agents/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.agents/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.agents/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.agents/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.agents/skills/gitnexus/gitnexus-cli/SKILL.md`             |

### Skill Organization & Discovery

**Skill Location**: All skills are in `.agents/skills/` organized by domain:

- `.agents/skills/architecture/` — Architecture reasoning and governance
- `.agents/skills/gitnexus/` — GitNexus knowledge graph specialized skills (6 skills)
- `.agents/skills/aws-skills/` — AWS serverless and cloud expertise
- `.agents/skills/` — Governance, testing, terminal, MCP routing skills

**Comprehensive Skill Index**: See [.agents/skills/SKILLS_INDEX.md](.agents/skills/SKILLS_INDEX.md) for:

- All 30+ available skills with descriptions
- Line counts and compliance status
- Auto-loading dependencies and relationships
- Skill domain grouping and discovery

**Quality Standards** (Phase 5 Optimization):

- ✅ All SKILL.md files enforce <500 line limit (Q4 requirement)
- ✅ Oversized skills split into domain-focused files
- ✅ Pre-commit validation enforces compliance (`scripts/ci/validate-skill-sizes.sh`)
- ✅ Skills designed for focused, single-purpose expertise

**How to Use Skills**:

1. For common tasks, match your request to the Skills table above
2. For specialized domains (AWS, refactoring, debugging), check SKILLS_INDEX.md
3. For auto-loaded context, see prompt-loaded skills in SKILLS_INDEX.md
4. Read the target SKILL.md file to understand workflow and requirements

<!-- gitnexus:end -->

<!-- rtk-instructions v2 -->

# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes
through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:

```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)

```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)

```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)

```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)

```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)

```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)

```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)

```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)

```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)

```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands

```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category         | Commands                       | Typical Savings |
| ---------------- | ------------------------------ | --------------- |
| Tests            | vitest, playwright, cargo test | 90-99%          |
| Build            | next, tsc, lint, prettier      | 70-87%          |
| Git              | status, log, diff, add, commit | 59-80%          |
| GitHub           | gh pr, gh run, gh issue        | 26-87%          |
| Package Managers | pnpm, npm, npx                 | 70-90%          |
| Files            | ls, read, grep, find           | 60-75%          |
| Infrastructure   | docker, kubectl                | 85%             |
| Network          | curl, wget                     | 65-70%          |

Overall average: **60-90% token reduction** on common development operations.

<!-- /rtk-instructions -->
