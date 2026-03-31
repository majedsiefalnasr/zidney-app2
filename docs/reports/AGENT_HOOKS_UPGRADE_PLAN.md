# Agent & Hooks Upgrade Plan

**Generated:** 2025-07-22  
**Scope:** `.agents/agents/` (current) → `.agents/agents.new/` (proposed) + `.github/hooks/` (new)  
**Status:** PENDING APPROVAL — No changes made yet

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Inventory](#2-current-state-inventory)
3. [New Agents Inventory](#3-new-agents-inventory)
4. [GitHub Hooks Inventory](#4-github-hooks-inventory)
5. [Gap Analysis: Agent Mapping](#5-gap-analysis-agent-mapping)
6. [Detailed Upgrade Recommendations](#6-detailed-upgrade-recommendations)
7. [New Agents to Add](#7-new-agents-to-add)
8. [Agents to Keep Unchanged](#8-agents-to-keep-unchanged)
9. [Hooks Integration Plan](#9-hooks-integration-plan)
10. [Orchestrator Upgrade Plan](#10-orchestrator-upgrade-plan)
11. [Risk Assessment](#11-risk-assessment)
12. [Execution Order](#12-execution-order)

---

## 1. Executive Summary

### Scope

| Area                     | Current Count | New Count            | Action                                 |
| ------------------------ | ------------- | -------------------- | -------------------------------------- |
| Domain agents            | 13            | 30                   | Update 6, Add 17, Keep 7 unchanged     |
| SpecKit agents           | 9             | 0                    | Keep all 9 unchanged (no replacements) |
| Orchestrator             | 1             | 1 (gem-orchestrator) | Update with gem-orchestrator features  |
| GitHub hooks             | 0             | 6                    | Add all 6                              |
| **Total files affected** | **23**        | **36**               |                                        |

### Key Decisions Required

1. **GEM multi-agent system (11 agents):** These introduce a parallel orchestration paradigm with magic keywords (autopilot, deep-interview, critique, etc.). They are GENERIC — not Zidney-specific. Should they coexist with Zidney's existing specialized agents, or replace parts of the pipeline?
2. **SE specialist agents (7 agents):** High-quality domain specialists (security, architecture, UX, product management, etc.) that overlap with existing Zidney agents. Some are upgrades; others are new roles.
3. **GitHub hooks (6 hooks):** Production-grade security/governance hooks for Copilot coding agent sessions. All are new and recommended for adoption.

---

## 2. Current State Inventory

### `.agents/agents/` — 22 files

#### Core Orchestration (2 files)

| File                      | Description                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `orchestrator.agent.md`   | SpecKit Hard Mode workflow controller. ~1200 lines. Zidney-specific, deeply integrated with skills, ADRs, architecture intelligence. |
| `copilot-instructions.md` | General Copilot behavior configuration                                                                                               |

#### Domain Agents (11 files)

| File                              | Name                     | Zidney-Specific | Description                                                      |
| --------------------------------- | ------------------------ | --------------- | ---------------------------------------------------------------- |
| `api-designer.agent.md`           | API Designer             | ✅ Heavy        | Multi-tenant API architect. RBAC, idempotency, OpenAPI 3.0.      |
| `architecture-guardian.agent.md`  | Architecture Guardian    | ✅ Heavy        | DDD enforcement, C4 modeling, ADR authoring, trade-off analysis. |
| `code-reviewer.agent.md`          | Code Reviewer            | ✅ Heavy        | Tenant isolation, DDD integrity, security, observability review. |
| `database-engineer.agent.md`      | Database Engineer        | ✅ Heavy        | Migration governance + query performance. Database-per-tenant.   |
| `devops-engineer.agent.md`        | DevOps Engineer          | ✅ Heavy        | CI/CD, zero-downtime deploys, container hardening.               |
| `frontend-developer.agent.md`     | Frontend Developer       | ✅ Heavy        | Vue 3, tenant-aware UI, RBAC routing, exam engine safeguards.    |
| `performance-optimizer.agent.md`  | Performance Optimizer    | ✅ Heavy        | Tenant-aware indexing, exam concurrency, SLO compliance.         |
| `qa-engineer.agent.md`            | QA Engineer              | ✅ Heavy        | Tenant isolation tests, RBAC validation, exam integrity.         |
| `script-ux-ai-optimizer.agent.md` | Script UX + AI Optimizer | ✅ Medium       | Repository script enhancement & --ai flag support.               |
| `security-auditor.agent.md`       | Security Auditor         | ✅ Heavy        | OWASP, STRIDE, exam integrity, tenant isolation.                 |
| `technical-writer.agent.md`       | Technical Writer         | ✅ Heavy        | API docs, package READMEs, ADRs, migration guides.               |

#### SpecKit Pipeline Agents (9 files)

| File                             | Name                  | Description                         |
| -------------------------------- | --------------------- | ----------------------------------- |
| `speckit.analyze.agent.md`       | speckit.analyze       | Cross-artifact consistency analysis |
| `speckit.checklist.agent.md`     | speckit.checklist     | Custom feature checklist generation |
| `speckit.clarify.agent.md`       | speckit.clarify       | Spec clarification questions        |
| `speckit.constitution.agent.md`  | speckit.constitution  | Project constitution management     |
| `speckit.implement.agent.md`     | speckit.implement     | Task execution from tasks.md        |
| `speckit.plan.agent.md`          | speckit.plan          | Implementation planning             |
| `speckit.specify.agent.md`       | speckit.specify       | Feature specification creation      |
| `speckit.tasks.agent.md`         | speckit.tasks         | Actionable task generation          |
| `speckit.taskstoissues.agent.md` | speckit.taskstoissues | Tasks → GitHub issues conversion    |

---

## 3. New Agents Inventory

### `.agents/agents.new/` — 30 files

#### GEM Multi-Agent System (11 files)

| File                                | Role         | Generic?   | Key Features                                                                                                                                                                                                                       |
| ----------------------------------- | ------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gem-orchestrator.agent.md`         | Orchestrator | ✅ Generic | Magic keywords (autopilot, deep-interview, simplify, critique, debug, fast/parallel, review). Phase detection → Discuss → PRD → Research → Planning → Execution → Summary. Multi-plan selection. `disable-model-invocation: true`. |
| `gem-implementer.agent.md`          | Implementer  | ✅ Generic | TDD (Red-Green-Refactor). JSON input/output. Never reviews.                                                                                                                                                                        |
| `gem-planner.agent.md`              | Planner      | ✅ Generic | DAG-based execution plans. Wave scheduling. Pre-mortem risk analysis. Outputs `plan.yaml`.                                                                                                                                         |
| `gem-researcher.agent.md`           | Researcher   | ✅ Generic | Codebase exploration, pattern recognition, dependency mapping. YAML findings. Never implements.                                                                                                                                    |
| `gem-reviewer.agent.md`             | Reviewer     | ✅ Generic | Security auditing (OWASP), secret detection, PRD compliance. Plan/Wave/Task scopes. Never modifies.                                                                                                                                |
| `gem-debugger.agent.md`             | Debugger     | ✅ Generic | Root-cause analysis, stack trace diagnosis, regression bisection. Never implements fixes.                                                                                                                                          |
| `gem-critic.agent.md`               | Critic       | ✅ Generic | Challenges assumptions, finds edge cases, over-engineering detection. Blocking/warning/suggestion severity.                                                                                                                        |
| `gem-code-simplifier.agent.md`      | Simplifier   | ✅ Generic | Refactoring: dead code removal, complexity reduction, duplication consolidation. Never adds features.                                                                                                                              |
| `gem-designer.agent.md`             | Designer     | ✅ Generic | UI/UX. Layouts, themes, color schemes, design systems. Create/Validate modes.                                                                                                                                                      |
| `gem-devops.agent.md`               | DevOps       | ✅ Generic | Containers, CI/CD, infrastructure. Approval gates for production.                                                                                                                                                                  |
| `gem-documentation-writer.agent.md` | Doc Writer   | ✅ Generic | README, API docs, diagrams. Walkthrough/Documentation/Update task types.                                                                                                                                                           |

#### SE (Software Engineering) Specialist Agents (7 files)

| File                                       | Role                  | Generic?   | Model |
| ------------------------------------------ | --------------------- | ---------- | ----- |
| `se-gitops-ci-specialist.agent.md`         | GitOps/CI             | ✅ Generic | GPT-5 |
| `se-product-manager-advisor.agent.md`      | Product Manager       | ✅ Generic | GPT-5 |
| `se-responsible-ai-code.agent.md`          | Responsible AI        | ✅ Generic | GPT-5 |
| `se-security-reviewer.agent.md`            | Security Reviewer     | ✅ Generic | GPT-5 |
| `se-system-architecture-reviewer.agent.md` | Architecture Reviewer | ✅ Generic | GPT-5 |
| `se-technical-writer.agent.md`             | Technical Writer      | ✅ Generic | GPT-5 |
| `se-ux-ui-designer.agent.md`               | UX/UI Designer        | ✅ Generic | GPT-5 |

#### Domain-Specific Expert Agents (12 files)

| File                                        | Role                 | Generic?   | Model             |
| ------------------------------------------- | -------------------- | ---------- | ----------------- |
| `accessibility.agent.md`                    | Accessibility Expert | ✅ Generic | GPT-4.1           |
| `adr-generator.agent.md`                    | ADR Generator        | Partially  | —                 |
| `api-architect.agent.md`                    | API Architect        | ✅ Generic | —                 |
| `arch.agent.md`                             | Cloud Architect      | ✅ Generic | —                 |
| `context7.agent.md`                         | Library Docs Expert  | ✅ Generic | —                 |
| `debug.agent.md`                            | Debugger             | ✅ Generic | —                 |
| `devops-expert.agent.md`                    | DevOps Expert        | ✅ Generic | —                 |
| `github-actions-expert.agent.md`            | GitHub Actions       | ✅ Generic | —                 |
| `markdown-accessibility-assistant.agent.md` | Markdown a11y        | ✅ Generic | Claude Sonnet 4.6 |
| `terraform.agent.md`                        | Terraform IaC        | ✅ Generic | —                 |
| `typescript-mcp-expert.agent.md`            | TS MCP Server Dev    | ✅ Generic | GPT-4.1           |
| `vuejs-expert.agent.md`                     | Vue 3 Expert         | ✅ Generic | Claude Sonnet 4.5 |

---

## 4. GitHub Hooks Inventory

### `.github/hooks/` — 6 hook directories (ALL NEW)

| Hook                          | Trigger(s)                                          | Purpose                                                                                                      | Modes                                       |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `dependency-license-checker/` | `sessionEnd` (60s timeout)                          | Scans newly added deps for GPL/AGPL/SSPL license compliance                                                  | warn / block                                |
| `governance-audit/`           | `sessionStart`, `sessionEnd`, `userPromptSubmitted` | Real-time threat detection: data exfiltration, privilege escalation, prompt injection, credential exposure   | 4 levels: open / standard / strict / locked |
| `secrets-scanner/`            | `sessionEnd` (30s timeout)                          | 20+ pattern categories for leaked secrets (AWS, GCP, Azure, GitHub tokens, private keys, connection strings) | warn / block                                |
| `session-auto-commit/`        | `sessionEnd`                                        | Commits and pushes changes when Copilot session ends                                                         | auto                                        |
| `session-logger/`             | `sessionStart`, `sessionEnd`, `userPromptSubmitted` | Logs all Copilot session events to `.copilot/logs/`                                                          | always-on                                   |
| `tool-guardian/`              | tool invocation                                     | Guards/controls tool usage during sessions                                                                   | configurable                                |

---

## 5. Gap Analysis: Agent Mapping

### Category A: Direct Overlaps (New agent covers same domain as existing)

| Current Agent                     | New Agent(s)                                                                        | Overlap                                                                                      | Recommendation                                                                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-guardian.agent.md`  | `se-system-architecture-reviewer.agent.md`, `arch.agent.md`                         | **High** — all do architecture review                                                        | **KEEP CURRENT.** Current is deeply Zidney-specific (DDD, tenant isolation, C4, ADR authoring). New ones are generic. Add `arch.agent.md` as supplementary for cloud diagrams only.           |
| `security-auditor.agent.md`       | `se-security-reviewer.agent.md`, `gem-reviewer.agent.md`                            | **High** — all do security review                                                            | **KEEP CURRENT.** Current covers Zidney-specific STRIDE, tenant isolation, exam integrity. Add `se-security-reviewer.agent.md` for LLM Top 10 / Zero Trust gap coverage.                      |
| `code-reviewer.agent.md`          | `gem-reviewer.agent.md`, `gem-critic.agent.md`                                      | **Medium** — code review vs. assumptions critique                                            | **KEEP CURRENT.** Add `gem-critic.agent.md` as new role (no current equivalent for assumption-challenging).                                                                                   |
| `devops-engineer.agent.md`        | `gem-devops.agent.md`, `devops-expert.agent.md`, `se-gitops-ci-specialist.agent.md` | **High** — CI/CD, deployment, containers                                                     | **KEEP CURRENT.** Add `se-gitops-ci-specialist.agent.md` for GitOps-specific expertise. Add `github-actions-expert.agent.md` for GHA workflow authoring.                                      |
| `technical-writer.agent.md`       | `gem-documentation-writer.agent.md`, `se-technical-writer.agent.md`                 | **High** — all write docs                                                                    | **KEEP CURRENT.** Current is Zidney-specific (API refs, package READMEs, ADRs). Consider enriching with diagram generation from `gem-documentation-writer.agent.md`.                          |
| `frontend-developer.agent.md`     | `gem-designer.agent.md`, `se-ux-ui-designer.agent.md`, `vuejs-expert.agent.md`      | **Medium** — current does Vue 3 + tenant UI; new ones split into UX design vs. Vue expertise | **KEEP CURRENT.** Add `vuejs-expert.agent.md` for deep Vue 3 patterns. Add `se-ux-ui-designer.agent.md` for JTBD/UX research (new capability).                                                |
| `api-designer.agent.md`           | `api-architect.agent.md`                                                            | **Medium** — both design APIs                                                                | **KEEP CURRENT.** Current is Zidney-specific (tenant scoping, RBAC matrix, exam lifecycle). `api-architect.agent.md` adds 3-layer architecture pattern — merge useful concepts into existing. |
| `database-engineer.agent.md`      | (no equivalent)                                                                     | None                                                                                         | **KEEP CURRENT.** No new agent replaces this.                                                                                                                                                 |
| `performance-optimizer.agent.md`  | (no equivalent)                                                                     | None                                                                                         | **KEEP CURRENT.** No new agent replaces this.                                                                                                                                                 |
| `qa-engineer.agent.md`            | (no equivalent)                                                                     | None                                                                                         | **KEEP CURRENT.** No new agent replaces this.                                                                                                                                                 |
| `script-ux-ai-optimizer.agent.md` | (no equivalent)                                                                     | None                                                                                         | **KEEP CURRENT.** Unique to Zidney.                                                                                                                                                           |
| `orchestrator.agent.md`           | `gem-orchestrator.agent.md`                                                         | **High** — both orchestrate                                                                  | **UPDATE CURRENT.** Merge gem-orchestrator features (magic keywords, multi-plan, discuss phase) into the existing Zidney orchestrator while preserving SpecKit workflow. See Section 10.      |

### Category B: Entirely New Roles (No current equivalent)

| New Agent                                   | Gap Filled                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `gem-implementer.agent.md`                  | TDD-focused implementer (Red-Green-Refactor). Current `speckit.implement` handles task execution but lacks explicit TDD methodology. |
| `gem-planner.agent.md`                      | DAG-based execution plans with wave scheduling. Current `speckit.plan` is spec-driven, not DAG-based.                                |
| `gem-researcher.agent.md`                   | Dedicated codebase exploration agent. No current equivalent — research is done inline by orchestrator.                               |
| `gem-debugger.agent.md` / `debug.agent.md`  | Structured debugging process. No current debugging agent.                                                                            |
| `gem-code-simplifier.agent.md`              | Dedicated refactoring agent (dead code, complexity). No current equivalent.                                                          |
| `gem-critic.agent.md`                       | Assumption challenger, edge case finder. No current equivalent.                                                                      |
| `accessibility.agent.md`                    | WCAG 2.1/2.2 compliance expert. No current equivalent.                                                                               |
| `markdown-accessibility-assistant.agent.md` | GitHub markdown accessibility. No current equivalent.                                                                                |
| `adr-generator.agent.md`                    | Dedicated ADR generator (current Architecture Guardian handles ADRs inline).                                                         |
| `context7.agent.md`                         | Library documentation via Context7 MCP. No current equivalent.                                                                       |
| `terraform.agent.md`                        | Terraform IaC with HCP MCP. No current equivalent.                                                                                   |
| `typescript-mcp-expert.agent.md`            | TypeScript MCP server development. No current equivalent.                                                                            |
| `se-product-manager-advisor.agent.md`       | Product management, JTBD analysis. No current equivalent.                                                                            |
| `se-responsible-ai-code.agent.md`           | Responsible AI, bias prevention, ethics. No current equivalent.                                                                      |

### Category C: Agents to Keep Unchanged

All 9 SpecKit pipeline agents have **no replacements** in the new directory and are deeply integrated with the orchestrator workflow:

- `speckit.analyze.agent.md`
- `speckit.checklist.agent.md`
- `speckit.clarify.agent.md`
- `speckit.constitution.agent.md`
- `speckit.implement.agent.md`
- `speckit.plan.agent.md`
- `speckit.specify.agent.md`
- `speckit.tasks.agent.md`
- `speckit.taskstoissues.agent.md`

Also unchanged (no better replacement):

- `database-engineer.agent.md`
- `performance-optimizer.agent.md`
- `qa-engineer.agent.md`
- `script-ux-ai-optimizer.agent.md`
- `copilot-instructions.md`

---

## 6. Detailed Upgrade Recommendations

### 6.1 Enrich `api-designer.agent.md` with `api-architect.agent.md` concepts

**Action:** MERGE selectively  
**What to add:**

- 3-layer architecture pattern (service → manager → resilience layer)
- Interactive "generate" mode (wait for explicit user trigger)

**What NOT to add:**

- Do NOT remove Zidney-specific RBAC matrix, tenant scoping, exam lifecycle patterns
- Do NOT change the output format (keep OpenAPI 3.0 + API.md)

### 6.2 Enrich `technical-writer.agent.md` with diagram generation

**Action:** MERGE selectively  
**Source:** `gem-documentation-writer.agent.md`  
**What to add:**

- Mermaid diagram generation capability
- Walkthrough/Documentation/Update task type classification

**What NOT to add:**

- Do NOT replace Zidney-specific doc standards (package READMEs, ADR format, migration guides)

### 6.3 Enrich `security-auditor.agent.md` with LLM security

**Action:** MERGE selectively  
**Source:** `se-security-reviewer.agent.md`  
**What to add:**

- OWASP LLM Top 10 coverage (prompt injection, training data poisoning, model DoS)
- Zero Trust architecture validation patterns

**What NOT to add:**

- Do NOT replace Zidney-specific STRIDE model, tenant isolation checks, exam integrity patterns

### 6.4 Enrich `architecture-guardian.agent.md` with Well-Architected Framework

**Action:** MERGE selectively  
**Source:** `se-system-architecture-reviewer.agent.md`  
**What to add:**

- Well-Architected Framework lens (reliability, performance, security, cost, operational excellence)
- Scalability analysis patterns

**What NOT to add:**

- Do NOT replace Zidney-specific DDD enforcement, modular monolith rules, ADR workflow

### 6.5 Enrich `devops-engineer.agent.md` with GitOps patterns

**Action:** MERGE selectively  
**Source:** `se-gitops-ci-specialist.agent.md`  
**What to add:**

- GitOps workflow patterns (Flux/ArgoCD concepts)
- Pipeline debugging methodology

**What NOT to add:**

- Do NOT replace Zidney-specific tenant migration safety, active exam protection, container standards

### 6.6 Enrich `frontend-developer.agent.md` with UX research methods

**Action:** MERGE selectively  
**Source:** `se-ux-ui-designer.agent.md`  
**What to add:**

- Jobs-to-be-Done (JTBD) analysis framework
- User journey mapping methodology

**What NOT to add:**

- Do NOT replace tenant-aware UI patterns, RBAC routing, exam engine safeguards

---

## 7. New Agents to Add

### 7.1 Recommended for immediate adoption (High value, low risk)

| Agent                            | Why                                                                   | Notes      |
| -------------------------------- | --------------------------------------------------------------------- | ---------- |
| `context7.agent.md`              | Library doc lookup via MCP — already referenced in orchestrator tools | Copy as-is |
| `debug.agent.md`                 | Structured 4-phase debugging process — fills a clear gap              | Copy as-is |
| `accessibility.agent.md`         | WCAG compliance — important for platform accessibility                | Copy as-is |
| `vuejs-expert.agent.md`          | Deep Vue 3 Composition API patterns — complements frontend-developer  | Copy as-is |
| `gem-critic.agent.md`            | Assumption-challenging role — unique value, no overlap                | Copy as-is |
| `gem-code-simplifier.agent.md`   | Dedicated refactoring agent — complements code-reviewer               | Copy as-is |
| `gem-researcher.agent.md`        | Codebase exploration agent — useful for pre-planning research         | Copy as-is |
| `gem-debugger.agent.md`          | Root-cause analysis — complements debug.agent.md at different level   | Copy as-is |
| `terraform.agent.md`             | Terraform IaC — matches existing `terraform/` directory in repo       | Copy as-is |
| `github-actions-expert.agent.md` | GHA workflow authoring — valuable for CI/CD improvements              | Copy as-is |

### 7.2 Recommended for adoption with modifications

| Agent                      | Why                | Required Modifications                                                                                                          |
| -------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `gem-implementer.agent.md` | TDD methodology    | Add Zidney governance preamble reference. Ensure it defers to `speckit.implement` for task execution within Hard Mode workflow. |
| `gem-planner.agent.md`     | DAG-based planning | Add Zidney governance preamble reference. Ensure it defers to `speckit.plan` within Hard Mode workflow.                         |
| `adr-generator.agent.md`   | Dedicated ADR tool | Update output path to `docs/architecture/ADR/` (Zidney convention).                                                             |

### 7.3 Consider but defer (lower priority or significant overlap)

| Agent                                       | Why Defer                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `gem-orchestrator.agent.md`                 | Features should be merged INTO existing orchestrator (see Section 10), not added as separate agent |
| `gem-reviewer.agent.md`                     | Overlaps heavily with existing code-reviewer and security-auditor                                  |
| `gem-designer.agent.md`                     | Overlaps with frontend-developer; consider only if UI design work increases                        |
| `gem-devops.agent.md`                       | Overlaps with devops-engineer; current agent is more Zidney-specific                               |
| `gem-documentation-writer.agent.md`         | Overlaps with technical-writer; merge diagram features instead                                     |
| `devops-expert.agent.md`                    | Overlaps with devops-engineer + se-gitops-ci-specialist                                            |
| `se-gitops-ci-specialist.agent.md`          | Merge features into devops-engineer instead of adding separately                                   |
| `se-product-manager-advisor.agent.md`       | Useful but not critical for current workflow                                                       |
| `se-responsible-ai-code.agent.md`           | Valuable for future AI features; defer until needed                                                |
| `se-technical-writer.agent.md`              | Overlaps with existing technical-writer                                                            |
| `se-ux-ui-designer.agent.md`                | Merge UX research features into frontend-developer instead                                         |
| `se-system-architecture-reviewer.agent.md`  | Merge Well-Architected features into architecture-guardian instead                                 |
| `se-security-reviewer.agent.md`             | Merge LLM security features into security-auditor instead                                          |
| `api-architect.agent.md`                    | Merge 3-layer pattern into api-designer instead                                                    |
| `arch.agent.md`                             | Diagram-only architect — niche use case; keep if cloud architecture diagrams needed                |
| `markdown-accessibility-assistant.agent.md` | Very narrow scope (5 markdown best practices)                                                      |
| `typescript-mcp-expert.agent.md`            | Only needed if building custom MCP servers                                                         |

---

## 8. Agents to Keep Unchanged

| Agent                             | Reason                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| All 9 `speckit.*.agent.md` files  | No replacements exist. Core to SpecKit Hard Mode workflow.    |
| `database-engineer.agent.md`      | No equivalent in new set. Deeply Zidney-specific.             |
| `performance-optimizer.agent.md`  | No equivalent in new set. Deeply Zidney-specific.             |
| `qa-engineer.agent.md`            | No equivalent in new set. Deeply Zidney-specific.             |
| `script-ux-ai-optimizer.agent.md` | No equivalent in new set. Unique to Zidney.                   |
| `copilot-instructions.md`         | General copilot configuration. Not affected by agent changes. |

---

## 9. Hooks Integration Plan

### 9.1 All 6 hooks are recommended for adoption

None of these hooks exist in the current project. All are well-structured with `hooks.json` configuration, shell scripts, and README documentation.

### 9.2 Integration steps

1. **Verify `.github/hooks/` path is correct** — GitHub Copilot coding agent looks for hooks in `.github/hooks/`. The directory already exists with the correct structure.

2. **Make shell scripts executable:**

   ```bash
   chmod +x .github/hooks/*//*.sh
   ```

3. **Configuration review per hook:**

   | Hook                         | Default Config                 | Recommended Changes for Zidney                                                                                                                                                  |
   | ---------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `dependency-license-checker` | Blocks GPL, AGPL, SSPL         | Keep defaults. Align with Zidney's open-source policy if any.                                                                                                                   |
   | `governance-audit`           | Standard level                 | Start with `standard`, evaluate `strict` later.                                                                                                                                 |
   | `secrets-scanner`            | Warn mode, diff scope          | Consider setting to `block` mode for production branches.                                                                                                                       |
   | `session-auto-commit`        | Auto-commit on session end     | **⚠️ CAUTION:** This may conflict with Zidney's git-governance skill which requires conventional commits. Review `auto-commit.sh` to ensure commit messages follow conventions. |
   | `session-logger`             | Logs to `.copilot/logs/`       | Add `.copilot/logs/` to `.gitignore` if not already present.                                                                                                                    |
   | `tool-guardian`              | Configurable tool restrictions | Review and configure allowed/blocked tools per Zidney's MCP routing policy.                                                                                                     |

4. **Add `.copilot/logs/` to `.gitignore`** (for session-logger output)

5. **Test hooks locally:**
   ```bash
   # Verify hooks.json is valid JSON
   for f in .github/hooks/*/hooks.json; do jq . "$f" > /dev/null && echo "OK: $f" || echo "FAIL: $f"; done
   ```

### 9.3 Risk: `session-auto-commit` conflicts with git governance

The `session-auto-commit` hook automatically commits and pushes when a Copilot session ends. This may conflict with:

- Zidney's `git-governance` skill (conventional commit messages, branch naming)
- The orchestrator's strict workflow step sequencing
- The user's preference to review before committing

**Recommendation:** Either skip this hook, or modify `auto-commit.sh` to use conventional commit format and only commit to feature branches (never `main`/`develop`).

---

## 10. Orchestrator Upgrade Plan

### Current orchestrator: `orchestrator.agent.md` (~1200 lines)

The current orchestrator is deeply integrated with:

- SpecKit Hard Mode workflow (8-step pipeline)
- 20+ delegated skills
- Architecture intelligence, self-healing, deterministic execution
- Stage lifecycle, workflow state management
- Terminal tool capability layer (RTK, jq, rg, fd)
- Intake forms, resume detection, dry-run mode

### gem-orchestrator Features to Merge

| Feature                                                                                                        | Value                                                   | Integration Risk                                                   |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| **Magic keywords** (`autopilot`, `deep-interview`, `simplify`, `critique`, `debug`, `fast/parallel`, `review`) | HIGH — UX improvement, allows quick task-type detection | LOW — can be added as a "Quick Mode" layer before intake detection |
| **Discuss phase** (open-ended conversation before structured workflow)                                         | MEDIUM — useful for exploratory work                    | LOW — can be a "pre-intake" option                                 |
| **Multi-plan selection** (generate 2-3 plans, user picks)                                                      | MEDIUM — reduces over-commitment to single approach     | MEDIUM — requires changes to Plan step                             |
| **Pre-mortem risk analysis**                                                                                   | HIGH — already partially covered by Analyze step        | LOW — can be added to Plan step output                             |
| **Phase detection** (automatically detect if request is research, planning, or execution)                      | MEDIUM — useful for non-SpecKit requests                | LOW — can be a routing layer                                       |

### Features NOT to Merge

| Feature                                                     | Why Not                                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `disable-model-invocation: true`                            | Gem-orchestrator is routing-only; Zidney's orchestrator actively reasons and generates reports |
| Generic agent routing (gem-implementer, gem-reviewer, etc.) | Zidney already has specialized Zidney-aware agents for these roles                             |
| JSON input/output format between agents                     | Zidney uses markdown-based SpecKit artifacts                                                   |
| Plan.yaml output format                                     | Zidney uses tasks.md and plan.md                                                               |

### Proposed Orchestrator Changes

1. **Add "Quick Mode" keyword detection** at the top of the orchestrator, before intake:
   - If user says "autopilot" → auto-advance through all steps
   - If user says "critique" → route to `gem-critic` agent
   - If user says "debug" → route to `debug.agent.md`
   - If user says "simplify" → route to `gem-code-simplifier`
   - If user says "review" → route to `code-reviewer`
   - Otherwise → normal SpecKit intake flow

2. **Add "Discuss Mode"** as a new session mode option alongside "new", "resume", "dry-run":
   - Open conversation without structured workflow
   - Can transition into SpecKit workflow when ready

3. **Add multi-plan generation** to Plan step:
   - After `speckit.plan` generates a plan, optionally generate 1-2 alternatives
   - Present comparison table
   - User selects preferred approach
   - Selected plan becomes the active `plan.md`

4. **Add new agents to the orchestrator's `agents` array:**

   ```yaml
   agents:
     # ... existing agents ...
     - "gem-critic"
     - "gem-code-simplifier"
     - "gem-researcher"
     - "gem-debugger"
     - "gem-implementer"
     - "gem-planner"
   ```

5. **Update the tools array** to include any new MCP tools referenced by new agents.

---

## 11. Risk Assessment

### High Risk

| Risk                                                 | Mitigation                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| Orchestrator becomes too large (already ~1200 lines) | Keep new features minimal; delegate to skills where possible |
| GEM agents don't understand Zidney governance        | Add governance preamble reference to all GEM agents adopted  |
| `session-auto-commit` breaks git discipline          | Skip or heavily modify this hook                             |

### Medium Risk

| Risk                                         | Mitigation                                                          |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Agent name collisions                        | New agents use different naming (gem-_, se-_, etc.) — no collisions |
| GEM workflow conflicts with SpecKit workflow | GEM agents are SUPPLEMENTARY, not replacements for SpecKit pipeline |
| Token overhead from too many agents          | Only add agents that fill real gaps                                 |

### Low Risk

| Risk                                            | Mitigation                                                 |
| ----------------------------------------------- | ---------------------------------------------------------- |
| Hooks break on non-macOS                        | Scripts use POSIX sh — should be portable                  |
| New agents reference unavailable models (GPT-5) | Model field is advisory — Copilot will use available model |

---

## 12. Execution Order

### Phase 1: Hooks (Lowest risk, highest immediate value)

1. Make all hook shell scripts executable
2. Add `.copilot/logs/` to `.gitignore`
3. Review and configure `session-auto-commit` (or skip it)
4. Test all hooks locally

### Phase 2: Add New Agents (No changes to existing files)

1. Copy 10 recommended agents from `.agents/agents.new/` to `.agents/agents/`
2. Add Zidney governance preamble to GEM agents
3. Update `adr-generator` output path

### Phase 3: Enrich Existing Agents (Selective merges)

1. Enrich `security-auditor` with LLM security (from `se-security-reviewer`)
2. Enrich `architecture-guardian` with Well-Architected lens (from `se-system-architecture-reviewer`)
3. Enrich `api-designer` with 3-layer pattern (from `api-architect`)
4. Enrich `technical-writer` with diagram generation (from `gem-documentation-writer`)
5. Enrich `devops-engineer` with GitOps patterns (from `se-gitops-ci-specialist`)
6. Enrich `frontend-developer` with UX research (from `se-ux-ui-designer`)

### Phase 4: Orchestrator Update (Highest complexity)

1. Add Quick Mode keyword detection
2. Add Discuss Mode session option
3. Add multi-plan generation to Plan step
4. Register new agents in orchestrator's agents array
5. Test full workflow with updated orchestrator

### Phase 5: Cleanup

1. Remove or archive `.agents/agents.new/` directory (after all useful content extracted)
2. Update `docs/reports/AGENT_AUDIT_REPORT.md` with final state
3. Update `.agents/skills/SKILLS_INDEX.md` if any new skills were added

---

## Appendix: Files Summary

### Files to CREATE (new agents → `.agents/agents/`)

```
.agents/agents/context7.agent.md
.agents/agents/debug.agent.md
.agents/agents/accessibility.agent.md
.agents/agents/vuejs-expert.agent.md
.agents/agents/gem-critic.agent.md
.agents/agents/gem-code-simplifier.agent.md
.agents/agents/gem-researcher.agent.md
.agents/agents/gem-debugger.agent.md
.agents/agents/terraform.agent.md
.agents/agents/github-actions-expert.agent.md
.agents/agents/gem-implementer.agent.md (with modifications)
.agents/agents/gem-planner.agent.md (with modifications)
.agents/agents/adr-generator.agent.md (with modifications)
```

### Files to MODIFY (enrich existing agents)

```
.agents/agents/api-designer.agent.md
.agents/agents/architecture-guardian.agent.md
.agents/agents/security-auditor.agent.md
.agents/agents/technical-writer.agent.md
.agents/agents/devops-engineer.agent.md
.agents/agents/frontend-developer.agent.md
.agents/agents/orchestrator.agent.md
```

### Files to KEEP UNCHANGED

```
.agents/agents/code-reviewer.agent.md
.agents/agents/database-engineer.agent.md
.agents/agents/performance-optimizer.agent.md
.agents/agents/qa-engineer.agent.md
.agents/agents/script-ux-ai-optimizer.agent.md
.agents/agents/copilot-instructions.md
.agents/agents/speckit.analyze.agent.md
.agents/agents/speckit.checklist.agent.md
.agents/agents/speckit.clarify.agent.md
.agents/agents/speckit.constitution.agent.md
.agents/agents/speckit.implement.agent.md
.agents/agents/speckit.plan.agent.md
.agents/agents/speckit.specify.agent.md
.agents/agents/speckit.tasks.agent.md
.agents/agents/speckit.taskstoissues.agent.md
```

### Hook files to INTEGRATE

```
.github/hooks/dependency-license-checker/
.github/hooks/governance-audit/
.github/hooks/secrets-scanner/
.github/hooks/session-auto-commit/ (with caution)
.github/hooks/session-logger/
.github/hooks/tool-guardian/
```

---

_This report was generated from a deep analysis of all 52+ files across three directories. No changes have been made to the codebase. All recommendations are pending user approval._
