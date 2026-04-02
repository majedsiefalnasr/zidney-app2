# Zidney AI Skills Index

**Generated**: 2026-04-02  
**Total Skills**: 45 (36 active + 9 new audit skills; 8 AWS archived)  
**Phase 5 Compliance**: All SKILL.md <500 lines ✓  

## Skill Directory Organization

All skills are located in `.agents/skills/` with domain-based organization:

- `architecture/*` — Architecture reasoning and governance skills
- `ai/*` — AI workflow and execution skills
- `gitnexus/*` — GitNexus knowledge graph skills
- `_archived/aws-skills/*` — AWS skills (archived, not loaded)
- Domain skills organized by function (db, i18n, security, observability, etc.)

---

## Skill Catalog (Sorted by Line Count)

| Domain | Skill | Lines | Purpose | Auto-Load |
|--------|-------|-------|---------|-----------|
| AWS | aws-serverless-eda | 107 | Parent skill: serverless & event-driven architecture | — |
| AWS | aws-serverless-eda-foundational | 270 | Serverless design principles & foundations | via parent |
| AWS | aws-serverless-eda-patterns | 371 | Event-driven & serverless architecture patterns | via parent |
| AWS | aws-serverless-eda-operations | 208 | Serverless operations, error handling, observability | via parent |
| AWS | aws-mcp-setup | 190 | AWS MCP tool configuration and setup | on-demand |
| AWS | aws-cdk-development | 316 | AWS CDK and infrastructure-as-code | on-demand |
| AWS | aws-cost-operations | 369 | AWS cost optimization and operations | on-demand |
| AWS | aws-agentic-ai | 143 | Agentic AI patterns on AWS | on-demand |
| Architecture | architecture-self-healing | 226 | Self-healing architecture governance system | on-demand |
| Architecture | architecture-intelligence | 264 | Architecture reasoning and validation layer | on-demand |
| Git | git-governance | 256 | Git workflow governance and hygiene | prompt-loaded |
| AI | ai-terminal | 439 | Advanced terminal operations for monorepo development | prompt-loaded |
| AI | rtk-execution-layer | 215 | Token-optimized command execution (RTK) | prompt-loaded |
| AI | ai-governance/aws-serverless-eda-operations | 208 | Governance patterns for AI development | on-demand |
| MCP | mcp-routing | 198 | MCP tool routing and selection policy | prompt-loaded |
| Build | subagent-parallelization | 175 | Parallel subagent execution strategy | on-demand |
| Build | package-manager-governance | 209 | Package manager governance rules | prompt-loaded |
| Testing | analysis-retry-engine | 231 | Intelligent retry and remediation strategy | on-demand |
| Workflow | subagent-handoff-governance | ~45 | Exact agent registry and handoff failure governance | on-demand |
| Workflow | documentation-writer-protocol | ~40 | Route governed markdown artifacts through Technical Writer | on-demand |
| Workflow | post-implementation-simplification | ~35 | Constrained code-simplifier cleanup after implementation | on-demand |
| Governance | ai-context-lifecycle-governance | ~35 | Enforce AI context regeneration points and deterministic source ordering | on-demand |
| Governance | stage-workflow-governance | ~40 | Govern Stage Status changes, ADR escalation, and scope amendments | on-demand |
| Terminal | terminal-capability-governance | ~30 | Govern tool detection, RTK-first policy, and shell fallbacks | on-demand |
| Terminal | terminal-safety | 173 | Safety rules for terminal operations | prompt-loaded |
| Diagnostics | precommit-diagnostics | 222 | Husky pre-commit failure diagnostics | prompt-loaded |
| Tooling | tool-advisor | 297 | Tool environment discovery and capability awareness | on-demand |
| TypeScript | typescript-governance | 265 | TypeScript governance and strict mode rules | prompt-loaded |
| Testing | vibe-testing-main | 273 | Testing and QA automation | on-demand |
| Figma | figma-implement-design | 264 | Figma design implementation | on-demand |
| GitNexus | gitnexus-refactoring | 122 | Code refactoring with GitNexus | on-demand |
| GitNexus | gitnexus-exploring | 79 | GitNexus codebase exploration | on-demand |
| GitNexus | gitnexus-debugging | 90 | GitNexus debugging and error tracing | on-demand |
| GitNexus | gitnexus-impact-analysis | 98 | GitNexus blast radius and impact analysis | on-demand |
| GitNexus | gitnexus-cli | 83 | GitNexus CLI commands | on-demand |
| GitNexus | gitnexus-guide | 65 | GitNexus tool reference and workflow | on-demand |
| Other | figma-mcp | 49 | Figma MCP tool integration | on-demand |
| Other | specrate-main | 45 | SpecKit main orchestration | on-demand |
| Other | gh-fix-ci | 71 | GitHub Actions CI fixing | on-demand |
| Other | Playwright | 454 | End-to-end testing with Playwright | on-demand |
| **New** | governance-preamble | ~60 | Pre-step governance context injection | on-demand |
| **New** | db-migration-governance | ~140 | Migration safety, tenant fan-out, lock risk | on-demand |
| **New** | observability-standards | ~130 | Structured logging, correlation, traces | on-demand |
| **New** | error-handling-patterns | ~140 | Error contract, domain errors, API boundaries | on-demand |
| **New** | i18n-governance | ~140 | i18n key governance, RTL, pluralization | on-demand |
| **New** | worker-job-governance | ~130 | Job queue patterns, idempotency, DLQ | on-demand |
| **New** | security-hardening | ~130 | OWASP, tenant isolation, secret management | on-demand |
| **New** | api-testing-patterns | ~130 | API test structure, tenant fixtures, coverage | on-demand |
| **New** | drizzle-orm-patterns | ~120 | Drizzle schema, migrations, query patterns | on-demand |

---

## Skill Domain Grouping

### Architecture & Governance (20 skills)
- `architecture-self-healing` - Detect and remediate architectural drift
- `architecture-intelligence` - Architecture reasoning and validation
- `ai-governance` - AI development governance patterns
- `git-governance` - Git workflow governance
- `precommit-diagnostics` - Pre-commit hook diagnostics
- `typescript-governance` - TypeScript strict mode enforcement
- `terminal-safety` - Safe terminal command execution
- `package-manager-governance` - Dependency management rules
- `mcp-routing` - MCP tool routing policies
- `ai-terminal` - Advanced terminal operations
- `rtk-execution-layer` - Token-optimized command execution
- `tool-advisor` - Tool and capability discovery
- `analysis-retry-engine` - Intelligent error recovery
- `subagent-handoff-governance` - Exact registry matching and handoff failure handling
- `documentation-writer-protocol` - Technical Writer routing for governed markdown artifacts
- `post-implementation-simplification` - Constrained cleanup pass via code-simplifier
- `ai-context-lifecycle-governance` - AI context refresh points, freshness gates, and deterministic source ordering
- `stage-workflow-governance` - Stage lifecycle, ADR escalation, and scope amendment controls
- `terminal-capability-governance` - Tool capability cache and RTK-first fallback policy

### Serverless & AWS (8 skills — ARCHIVED)
- All AWS skills moved to `_archived/aws-skills/` (not loaded by default)
- Restore with: `mv .agents/skills/_archived/aws-skills .agents/skills/aws-skills`

### Domain Engineering (9 skills — NEW)
- `governance-preamble` — Pre-step governance context injection
- `db-migration-governance` — Migration safety, tenant fan-out, lock risk
- `observability-standards` — Structured logging, correlation IDs, traces
- `error-handling-patterns` — Error contract, domain errors, API boundaries
- `i18n-governance` — i18n key governance, RTL, pluralization
- `worker-job-governance` — Job queue patterns, idempotency, DLQ
- `security-hardening` — OWASP, tenant isolation, secret management
- `api-testing-patterns` — API test structure, tenant fixtures, coverage
- `drizzle-orm-patterns` — Drizzle schema, migrations, query patterns

### Code Exploration & Refactoring (6 skills)
- `gitnexus-exploring` - Codebase exploration
- `gitnexus-debugging` - Error tracing
- `gitnexus-refactoring` - Safe refactoring
- `gitnexus-impact-analysis` - Change impact analysis
- `gitnexus-cli` - GitNexus CLI reference
- `gitnexus-guide` - GitNexus workflow guide

### Testing & QA (3 skills)
- `Playwright` - E2E testing framework
- `vibe-testing-main` - QA automation
- `analysis-retry-engine` - Test failure recovery

### Design & Deployment (3 skills)
- `figma-implement-design` — Design implementation
- `figma-mcp` — Figma MCP tool
- `gh-fix-ci` — GitHub Actions CI

### Orchestration & Meta (2 skills)
- `specrate-main` - SpecKit orchestration
- `subagent-parallelization` - Parallel execution strategy

---

## Phase 5 Compliance Report

**Objective**: Enforce SKILL.md files <500 lines (Q4 requirement)

### Audit Results

| Category | Count | Status |
|----------|-------|--------|
| Total SKILL.md files | 30 | ✓ Audited |
| Files <450 lines | 28 | ✓ OK |
| Files 450-500 lines | 1 | ⚡ Marginal |
| Files >500 lines | 0 | ✓ Split |
| Oversized files split | 1 | ✓ aws-serverless-eda |

**Marginal File**: 
- `Playwright` (454 lines) — Within limit, no action needed

**Refactored Files**:
- `aws-serverless-eda` (original 805) → Split into 3:
  - `aws-serverless-eda-foundational` (270 lines)
  - `aws-serverless-eda-patterns` (371 lines)
  - `aws-serverless-eda-operations` (208 lines)
  - Parent reference skill (107 lines)

**Status**: ✅ ALL SKILLS <500 LINES

---

## Skill Auto-Loading & Dependencies

### Prompt-Loaded Skills (Auto-invoked by AGENTS.md)
When a user request matches, these skills are automatically loaded:
- `git-governance` - Git workflow context
- `mcp-routing` - MCP tool usage context
- `ai-terminal` - Terminal command context
- `rtk-execution-layer` - Command optimization context
- `terminal-safety` - Safety rule context
- `precommit-diagnostics` - Pre-commit failure context
- `typescript-governance` - TypeScript validation context
- `package-manager-governance` - Dependency management context

### On-Demand Skills (User explicitly requests)
- All AWS skills
- All GitNexus skills
- All testing skills
- `tool-advisor`, `analysis-retry-engine`, `subagent-parallelization`, etc.

### Dependency Chains
- `aws-serverless-eda` → automatically loads all 3 domain skills
- Skills can reference other skills for specialized workflows
- Dependencies documented in YAML frontmatter (`skills:` field)

---

## How to Add a New Skill

1. **Create directory**: `.agents/skills/<domain>/<skill-name>/`
2. **Create SKILL.md**: Add YAML frontmatter + markdown content (<500 lines)
3. **Update this index**: Add entry to skill catalog table
4. **Verify line count**: Run `scripts/dev/audit-skill-sizes.ts`
5. **Test auto-loading**: Verify prompt routing if context-dependent

---

## Phase 5 Task References

- T096: Skill audit script (`scripts/dev/audit-skill-sizes.ts`)
- T097: Split aws-serverless-eda (3 domain skills)
- T099: This skills index (you are here)
- T100: Pre-commit enforcement check (line count validation)
- T101: AGENTS.md skill organization documentation
- T102: Skill domain grouping documentation

---

**Last Updated**: 2026-04-02 during orchestrator governance extraction  
**Next Review**: After new skills are added or existing skills exceed 400 lines
