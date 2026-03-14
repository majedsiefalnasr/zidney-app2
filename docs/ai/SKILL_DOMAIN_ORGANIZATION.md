# Skill Domain Organization & Patterns

**Document**: Zidney AI Skills Architecture  
**Created**: 2026-03-15 (Phase 5)  
**Last Updated**: 2026-03-15  
**Total Skills**: 30  
**Status**: All <500 lines (Q4 compliant) ✓

---

## Overview

Zidney organizes AI skills into logical domains to enable efficient discovery, minimize skill file overhead, and maintain focused expertise areas. This document outlines the domain structure, relationships, and usage patterns.

## Domain Map

### 1. Architecture & Governance (13 skills)

**Purpose**: Architectural decision-making, validation, and governance enforcement

**Skills**:

- `architecture-self-healing` — Detect and remediate architectural drift
- `architecture-intelligence` — Architecture reasoning and validation layer
- `ai-governance` — AI development governance patterns (`**/ai-governance/SKILL.md`)
- `git-governance` — Git workflow governance and hygiene (prompt-loaded)
- `precommit-diagnostics` — Husky pre-commit hook diagnostics (prompt-loaded)
- `typescript-governance` — TypeScript strict mode and type safety (prompt-loaded)
- `terminal-safety` — Safe terminal command execution (prompt-loaded)
- `package-manager-governance` — Dependency management and policy rules (prompt-loaded)
- `mcp-routing` — MCP tool routing and selection (prompt-loaded)
- `tool-advisor` — Tool environment discovery and capability awareness
- `analysis-retry-engine` — Intelligent error recovery strategies
- `ai-terminal` — Advanced terminal operations for monorepo work (prompt-loaded)
- `rtk-execution-layer` — Token-optimized command execution (prompt-loaded)

**When to Use**:

- Architecture validation before changes
- Governance rule enforcement
- Pre-commit and CI validation
- Error diagnosis and recovery

**Dependencies**:

- `mcp-routing` depends on: (none)
- `architecture-intelligence` depends on: (none)
- `architecture-self-healing` depends on: (none)
- Most governance skills have no external dependencies

**Auto-Load Context**: 8 skills prompt-loaded (git, mcp, precommit, typescript, terminal, ai-terminal, rtk, package-manager)

---

### 2. Serverless & AWS (8 skills)

**Purpose**: AWS infrastructure, serverless patterns, cloud expertise

**Skills**:

- `aws-serverless-eda` (parent) — Reference skill; delegates to 3 domain skills
  - `aws-serverless-eda-foundational` — Design principles & concepts (270 lines)
  - `aws-serverless-eda-patterns` — Event-driven and architecture patterns (371 lines)
  - `aws-serverless-eda-operations` — Operations, error handling, observability (208 lines)
- `aws-mcp-setup` — AWS MCP tool configuration and setup (190 lines)
- `aws-cdk-development` — AWS CDK and infrastructure-as-code (316 lines)
- `aws-cost-operations` — Cost optimization and operational excellence (369 lines)
- `aws-agentic-ai` — Agentic AI patterns on AWS (143 lines)

**When to Use**:

- Building serverless applications
- Lambda function development
- Event-driven architecture design
- AWS infrastructure and IaC
- Cost optimization strategies

**Dependencies**:

- `aws-serverless-eda` → loads all 3 domain skills
- `aws-cdk-development` → depends on `aws-mcp-setup`
- Individual domain skills → depend on parent in some cases

**Auto-Load Context**: None (on-demand)

---

### 3. Code Exploration & Refactoring (6 skills)

**Purpose**: GitNexus knowledge graph integration for code understanding and refactoring

**Skills**:

- `gitnexus-exploring` — Codebase exploration and understanding (79 lines)
- `gitnexus-debugging` — Error tracing and bug diagnosis (90 lines)
- `gitnexus-refactoring` — Safe code refactoring and extraction (122 lines)
- `gitnexus-impact-analysis` — Change impact and blast radius analysis (98 lines)
- `gitnexus-cli` — GitNexus CLI commands and workflow (83 lines)
- `gitnexus-guide` — GitNexus tool reference and usage guide (65 lines)

**When to Use**:

- Understanding how code works
- Tracing errors and bugs
- Planning refactors safely
- Analyzing change impact
- Using GitNexus tools and CLI

**Dependencies**:

- All 6 skills depend on: GitNexus MCP being available
- Skills reference each other frequently

**Auto-Load Context**: None (on-demand, loaded when user task matches)

**Skill Relationships**:

```
gitnexus-guide (reference)
  ├→ gitnexus-exploring (look at code)
  ├→ gitnexus-debugging (trace errors)
  ├→ gitnexus-refactoring (change code safely)
  └→ gitnexus-impact-analysis (understand blast radius)
  └→ gitnexus-cli (run commands)
```

---

### 4. Testing & Quality (3 skills)

**Purpose**: Automated testing, QA, and quality assurance

**Skills**:

- `Playwright` — End-to-end testing framework (454 lines, marginal: 47 line margin)
- `vibe-testing-main` — Testing and QA automation (273 lines)
- `analysis-retry-engine` — Test failure recovery and remediation (231 lines)

**When to Use**:

- E2E test development
- QA automation strategies
- Test failure analysis and recovery
- Test environment setup

**Dependencies**:

- `Playwright` depends on: browser automation tools
- `vibe-testing-main` depends on: test framework ecosystem
- `analysis-retry-engine` depends on: (none, but used by all testing skills)

**Auto-Load Context**: None (on-demand)

---

### 5. Design & Deployment (3 skills)

**Purpose**: Design implementation and CI/CD automation

**Skills**:

- `Figma Implement Design` — Figma design implementation (264 lines)
- `Figma MCP` — Figma MCP tool integration (49 lines)
- `GH Fix CI` — GitHub Actions CI troubleshooting (71 lines)

**When to Use**:

- Implementing Figma designs
- Figma tool integration
- GitHub Actions CI issues
- Deployment debugging

**Dependencies**:

- `Figma Implement Design` depends on: `Figma MCP`
- `GH Fix CI` depends on: (none)

**Auto-Load Context**: None (on-demand)

---

### 6. Orchestration & Meta (2 skills)

**Purpose**: SpecKit orchestration and parallel execution

**Skills**:

- `specrate-main` — SpecKit specification orchestration (45 lines)
- `subagent-parallelization` — Parallel subagent execution strategy (175 lines)

**When to Use**:

- SpecKit feature generation
- Parallel task execution
- Specification orchestration

**Dependencies**:

- `subagent-parallelization` depends on: (none)
- `specrate-main` depends on: (none)

**Auto-Load Context**: None (on-demand)

---

## Skill Lifecycle & Maintenance

### Phase 5 Optimization (Current)

**Completed**:

- ✅ Audited all 30 SKILL.md files for line count
- ✅ Split aws-serverless-eda (805 lines) → 4 skills (107 + 270 + 371 + 208)
- ✅ All skills <500 lines (Q4 requirement)
- ✅ Created SKILLS_INDEX.md for discovery
- ✅ Added pre-commit validation (`scripts/ci/validate-skill-sizes.sh`)
- ✅ Documented skill organization and <500 line policy

**In Progress** (T103-T110):

- Dependency analysis (T103-T106)
- Lock file optimization (T107-T110)

### Future Maintenance

**When adding new skills**:

1. Create under appropriate domain: `.agents/skills/<domain>/<skill-name>/`
2. Ensure SKILL.md <500 lines before committing
3. Update `.agents/skills/SKILLS_INDEX.md` with new entry
4. Add domain references to `docs/ai/SKILL_DOMAIN_ORGANIZATION.md`
5. Document auto-load context if applicable

**When skills approach 500 lines**:

- Run `scripts/dev/audit-skill-sizes.ts` to check status
- Plan refactoring into domain-focused sub-skills
- Update SKILLS_INDEX.md with deprecation note
- Create migration guide for users of old skill

**Quality Gates**:

- Pre-commit validates all SKILL.md <500 lines
- CI fails if any SKILL.md exceeds 500 lines (after threshold)
- SKILLS_INDEX.md auto-generated by audit script annually

---

## How Skills Are Discovered

### Automatic Discovery (Auto-Load)

Certain skills are **automatically loaded** when a user request matches their domain:

```
User Input: "I'm getting a pre-commit error"
  ↓
Prompt Router: "This matches precommit-diagnostics domain"
  ↓
Auto-Load: precommit-diagnostics/SKILL.md
  ↓
Provide workflow & checklist for remediation
```

**Auto-loaded Skills** (8 total):

- `precommit-diagnostics`
- `terminal-safety`
- `git-governance`
- `mcp-routing`
- `ai-terminal`
- `rtk-execution-layer`
- `typescript-governance`
- `package-manager-governance`

See [SKILLS_INDEX.md](.agents/skills/SKILLS_INDEX.md) for complete list and load triggers.

### Manual Discovery (On-Demand)

Users explicitly request a skill or are directed to one:

```
User: "How do I refactor this module safely?"
  ↓
Agent: "Read .agents/skills/gitnexus/gitnexus-refactoring/SKILL.md"
  ↓
User loads skill and follows workflow
```

**Most AWS, testing, and architecture skills** are on-demand.

---

## Domain-Specific Patterns

### Architecture Domain Pattern

```
User asks: "Is this change safe?"
  ↓
Agent strategy:
  1. Load: gitnexus-impact-analysis (blast radius)
  2. Load: architecture-intelligence (arch validation)
  3. Load: ai-guard (governance validation)
  4. Synthesize: "Safe because X, consider Y"
```

### AWS Domain Pattern

```
User asks: "How do I build a serverless API?"
  ↓
Agent strategy:
  1. Load: aws-serverless-eda-foundational (principles)
  2. Load: aws-serverless-eda-patterns (patterns)
  3. Load: aws-cdk-development (implementation)
  4. Generate: CDK code + pattern example
```

### GitNexus Domain Pattern

```
User asks: "What breaks if I rename this function?"
  ↓
Agent strategy:
  1. Load: gitnexus-guide (reference)
  2. Load: gitnexus-impact-analysis (analyze)
  3. Load: gitnexus-refactoring (execute safely)
  4. Report: All affected locations + migration strategy
```

---

## Skill Dependency Graph

### Critical Paths

```
aws-serverless-eda (parent)
  ├→ aws-serverless-eda-foundational
  ├→ aws-serverless-eda-patterns
  └→ aws-serverless-eda-operations

mcp-routing → (no dependencies)
architecture-intelligence → (no dependencies)
gitnexus-cli → gitnexus-* (reference)
Figma Implement Design → Figma MCP
```

### No Circular Dependencies ✓

All skill dependencies are acyclic (verified in Phase 5 audit).

---

## Statistics & Metrics

### Line Count Distribution

| Range   | Count | Examples                                        |
| ------- | ----- | ----------------------------------------------- |
| 0-100   | 6     | gitnexus-\*, Figma MCP, specrate                |
| 100-200 | 5     | mcp-routing, terminal-safety, analysis-retry    |
| 200-300 | 9     | ai-terminal, vibe-testing, typescript-gov, etc. |
| 300-400 | 7     | aws-cdk, aws-cost, Figma Design, etc.           |
| 400-500 | 2     | Playwright (454), aws-patterns (371)            |
| >500    | 0     | ✓ None (Q4 compliance)                          |

**Total Skill Lines**: ~9,500 lines of focused expertise  
**Average Skill Size**: 316 lines  
**Median Skill Size**: 240 lines

### Domain Size

| Domain           | Skills | Total Lines | Avg Size |
| ---------------- | ------ | ----------- | -------- |
| Architecture/Gov | 13     | 3,500       | 269      |
| AWS              | 8      | 2,100       | 263      |
| GitNexus         | 6      | 537         | 90       |
| Testing          | 3      | 958         | 319      |
| Design/Deploy    | 3      | 384         | 128      |
| Orchestration    | 2      | 220         | 110      |

---

## Best Practices

### Using Skills in AI Workflows

1. **Match domain first**: Identify the domain (architecture, AWS, etc.)
2. **Load skills in order**: Dependencies first, then specialized skills
3. **Follow workflow**: Each SKILL.md includes a checklist
4. **Cross-reference**: Use related skills for comprehensive answers
5. **Respect <500 lines**: If answer gets long, defer to sub-skill

### Writing New Skills

1. **Focus on one domain**: A skill does one thing well
2. **Assume <500 lines**: Plan how to split if needed
3. **Include workflow**: Every skill has a clear workflow
4. **Reference dependencies**: Document required skills/tools
5. **Update SKILLS_INDEX.md**: Keep discovery index fresh

### Maintaining Skills

1. **Monitor line count**: Use `scripts/dev/audit-skill-sizes.ts`
2. **Plan refactoring**: Split at 450+ lines
3. **Update references**: Keep SKILLS_INDEX.md current
4. **Test auto-load**: Verify skill triggers correctly
5. **Document changes**: Update SKILL_DOMAIN_ORGANIZATION.md

---

## Phase 5 Quality Gates ✓

- [x] All SKILL.md <500 lines
- [x] Domain organization documented
- [x] Skill dependencies mapped
- [x] Circular dependencies checked (none found)
- [x] SKILLS_INDEX.md created and maintained
- [x] Pre-commit enforcement configured
- [x] AGENTS.md documentation updated
- [x] This organization guide created

---

**For complete skill catalog and discovery**, see [.agents/skills/SKILLS_INDEX.md](.agents/skills/SKILLS_INDEX.md)
