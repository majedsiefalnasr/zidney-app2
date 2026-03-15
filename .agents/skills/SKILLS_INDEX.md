# Zidney AI Skills Index

**Generated**: 2026-03-15  
**Total Skills**: 30  
**Phase 5 Compliance**: All SKILL.md <500 lines ✓  

## Skill Directory Organization

All skills are located in `.agents/skills/` with domain-based organization:

- `architecture/*` - Architecture reasoning and governance skills
- `ai/*` - AI workflow and execution skills
- `gitnexus/*` - GitNexus knowledge graph skills
- `aws-skills/*` - AWS expertise skills
- Other domain skills organized by function

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
| Terminal | terminal-safety | 173 | Safety rules for terminal operations | prompt-loaded |
| Diagnostics | precommit-diagnostics | 222 | Husky pre-commit failure diagnostics | prompt-loaded |
| Tooling | tool-advisor | 297 | Tool environment discovery and capability awareness | on-demand |
| TypeScript | typescript-governance | 265 | TypeScript governance and strict mode rules | prompt-loaded |
| Testing | vibe-testing-main | 273 | Testing and QA automation | on-demand |
| Figma | Figma Implement Design | 264 | Figma design implementation | on-demand |
| GitNexus | gitnexus-refactoring | 122 | Code refactoring with GitNexus | on-demand |
| GitNexus | gitnexus-exploring | 79 | GitNexus codebase exploration | on-demand |
| GitNexus | gitnexus-debugging | 90 | GitNexus debugging and error tracing | on-demand |
| GitNexus | gitnexus-impact-analysis | 98 | GitNexus blast radius and impact analysis | on-demand |
| GitNexus | gitnexus-cli | 83 | GitNexus CLI commands | on-demand |
| GitNexus | gitnexus-guide | 65 | GitNexus tool reference and workflow | on-demand |
| Other | Figma MCP | 49 | Figma MCP tool integration | on-demand |
| Other | specrate-main | 45 | SpecKit main orchestration | on-demand |
| Other | GH Fix CI | 71 | GitHub Actions CI fixing | on-demand |
| Other | Playwright | 454 | End-to-end testing with Playwright | on-demand |

---

## Skill Domain Grouping

### Architecture & Governance (14 skills)
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

### Serverless & AWS (8 skills)
- `aws-serverless-eda-foundational` - Design principles
- `aws-serverless-eda-patterns` - Pattern implementations
- `aws-serverless-eda-operations` - Operations & observability
- `aws-mcp-setup` - MCP configuration
- `aws-cdk-development` - CDK and IaC
- `aws-cost-operations` - Cost optimization
- `aws-agentic-ai` - Agentic AI patterns

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
- `Figma Implement Design` - Design implementation
- `Figma MCP` - Figma MCP tool
- `GH Fix CI` - GitHub Actions CI

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

**Last Updated**: 2026-03-15 during Phase 5 Skill Cleanup  
**Next Review**: After new skills are added or existing skills exceed 400 lines
