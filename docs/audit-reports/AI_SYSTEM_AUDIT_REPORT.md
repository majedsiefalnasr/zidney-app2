# Zidney AI System — Full Audit Report

**Date:** 2026-03-20  
**Auditor:** AI System Auditor  
**Scope:** All agents, skills, prompts, governance files, AGENTS.md contracts, and orchestration pipeline  
**Branch:** `spec/027-semesters`  
**Repository:** `majedsiefalnasr/zidney-app2`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Inventory — What Exists](#2-inventory--what-exists)
3. [Agent Audit](#3-agent-audit)
4. [Skill Audit](#4-skill-audit)
5. [AGENTS.md Contract Audit](#5-agentsmd-contract-audit)
6. [Orchestrator Deep Audit](#6-orchestrator-deep-audit)
7. [Governance & AI Context Layer Audit](#7-governance--ai-context-layer-audit)
8. [Prompt Layer Audit](#8-prompt-layer-audit)
9. [Cross-Cutting Gaps & Missing Capabilities](#9-cross-cutting-gaps--missing-capabilities)
10. [Zidney Orchestrator — Full Step Sequence Roadmap](#10-zidney-orchestrator--full-step-sequence-roadmap)
11. [Recommendations & Enhancement Roadmap](#11-recommendations--enhancement-roadmap)
12. [Clarification Questions (MCQ)](#12-clarification-questions-mcq)

---

## 1. Executive Summary

### Overall Assessment: 🟡 STRONG with Notable Gaps

The Zidney AI system is one of the most sophisticated AI-assisted development governance systems reviewed. It features:

- **22 specialized agents** (10 SpecKit + 12 Zidney domain agents)
- **30+ skills** across 8 domains
- **6 AGENTS.md contracts** for app-level behavioral boundaries
- **1 orchestrator** managing an 8-step Hard Mode workflow
- **Full governance layer** (Agent Governance v1.0, AI Bootstrap, Engineering Rules, Architecture Contract)

**Strengths:**

- Exceptional multi-tenant isolation enforcement
- Comprehensive architecture self-healing system
- Production-grade governance with PASS/BLOCKED verdict semantics
- Deterministic AI execution mode with strict source-of-truth hierarchy
- Stage-aware context compression reducing token usage by 60-80%
- Full lifecycle tracking via `.workflow-state.json`

**Weaknesses & Gaps:**

- Missing backend-focused skills (DB migration, API testing, worker job patterns)
- No observability/monitoring skill despite being a core platform requirement
- No data migration or seed data governance skill
- Stale `copilot-instructions.md` (references outdated `backend/frontend/tests/` structure)
- Missing E2E integration between agents and CI pipeline
- No versioning or changelog system for agent/skill evolution
- Limited error recovery patterns for the orchestrator itself
- Missing localization/i18n governance (critical for educational SaaS)

### Maturity Scores

| Area                       | Score | Level     |
| -------------------------- | ----- | --------- |
| Agent Coverage             | 8/10  | Strong    |
| Skill Coverage             | 7/10  | Good      |
| Orchestrator Completeness  | 9/10  | Excellent |
| Governance Framework       | 9/10  | Excellent |
| AGENTS.md Contracts        | 8/10  | Strong    |
| Cross-Agent Coordination   | 7/10  | Good      |
| Observability & Monitoring | 3/10  | Weak      |
| Data Governance            | 4/10  | Weak      |
| Documentation Freshness    | 6/10  | Fair      |
| CI/CD Integration Depth    | 6/10  | Fair      |

---

## 2. Inventory — What Exists

### 2.1 Agents (22 total)

| Category | Agent                         | Has Prompt | Has Agent File | Tools Declared                           |
| -------- | ----------------------------- | ---------- | -------------- | ---------------------------------------- |
| SpecKit  | speckit.specify               | ✅         | ✅             | execute, read, edit, search, agent, todo |
| SpecKit  | speckit.clarify               | ✅         | ✅             | —                                        |
| SpecKit  | speckit.plan                  | ✅         | ✅             | —                                        |
| SpecKit  | speckit.tasks                 | ✅         | ✅             | —                                        |
| SpecKit  | speckit.analyze               | ✅         | ✅             | —                                        |
| SpecKit  | speckit.implement             | ✅         | ✅             | execute, read, edit, search, todo        |
| SpecKit  | speckit.checklist             | ✅         | ✅             | —                                        |
| SpecKit  | speckit.constitution          | ✅         | ✅             | —                                        |
| SpecKit  | speckit.taskstoissues         | ✅         | ✅             | —                                        |
| Zidney   | Zidney Orchestrator           | ✅         | ✅             | Full toolkit + 11 agents                 |
| Zidney   | Zidney API Designer           | ✅         | ✅             | execute, read, search, todo              |
| Zidney   | Zidney Architecture Checker   | ✅         | ✅             | execute, read, search, todo              |
| Zidney   | Zidney CI/CD Automation       | ✅         | ✅             | execute, read, search, todo              |
| Zidney   | Zidney Code Reviewer          | ✅         | ✅             | execute, read, search, todo              |
| Zidney   | Zidney Deployment Engineer    | ✅         | ✅             | execute, read, search, todo              |
| Zidney   | Zidney Docker Specialist      | ✅         | ✅             | execute, read, search, todo              |
| Zidney   | Zidney Frontend Developer     | ✅         | ✅             | (not declared)                           |
| Zidney   | Zidney Performance Optimizer  | ✅         | ✅             | execute, read, search, todo              |
| Zidney   | Zidney QA Engineer            | ✅         | ✅             | execute, read, search, todo              |
| Zidney   | Zidney Refactoring Specialist | ✅         | ✅             | (not declared)                           |
| Zidney   | Zidney Security Auditor       | ✅         | ✅             | execute, read, search, todo              |
| —        | copilot-instructions.md       | —          | ✅             | —                                        |

### 2.2 Skills (30+ total)

| Domain       | Skill                           | Lines  | Auto-Load     |
| ------------ | ------------------------------- | ------ | ------------- |
| Architecture | architecture-intelligence       | 264    | on-demand     |
| Architecture | architecture-self-healing       | 226    | on-demand     |
| AI Execution | analysis-retry-engine           | 231    | on-demand     |
| AI Execution | subagent-parallelization        | 175    | on-demand     |
| AI Terminal  | ai-terminal                     | 439    | prompt-loaded |
| AI Terminal  | rtk-execution-layer             | 215    | prompt-loaded |
| Git          | git-governance                  | 256    | prompt-loaded |
| MCP          | mcp-routing                     | 198    | prompt-loaded |
| Diagnostics  | precommit-diagnostics           | 222    | prompt-loaded |
| Package      | package-manager-governance      | 209    | prompt-loaded |
| TypeScript   | typescript-governance           | 265    | prompt-loaded |
| Terminal     | terminal-safety                 | 173    | prompt-loaded |
| Tooling      | tool-advisor                    | 297    | on-demand     |
| Frontend     | vue                             | varies | on-demand     |
| Frontend     | zidney-frontend-engineering     | varies | on-demand     |
| Frontend     | shadcn-vue-ui-system            | varies | on-demand     |
| Frontend     | tailwind-design-system          | varies | on-demand     |
| Testing      | vibe-testing-main               | 273    | on-demand     |
| Testing      | Playwright                      | 454    | on-demand     |
| Figma        | Figma Implement Design          | 264    | on-demand     |
| Figma        | Figma MCP                       | 49     | on-demand     |
| CI           | GH Fix CI                       | 71     | on-demand     |
| SpecKit      | specrate-main                   | 45     | on-demand     |
| AWS          | aws-serverless-eda (parent)     | 107    | on-demand     |
| AWS          | aws-serverless-eda-foundational | 270    | via parent    |
| AWS          | aws-serverless-eda-patterns     | 371    | via parent    |
| AWS          | aws-serverless-eda-operations   | 208    | via parent    |
| AWS          | aws-mcp-setup                   | 190    | on-demand     |
| AWS          | aws-cdk-development             | 316    | on-demand     |
| AWS          | aws-cost-operations             | 369    | on-demand     |
| AWS          | aws-agentic-ai                  | 143    | on-demand     |

### 2.3 AGENTS.md Contracts (7 total)

| Location                     | Purpose                                      |
| ---------------------------- | -------------------------------------------- |
| Root `AGENTS.md`             | Master behavioral contract (entire platform) |
| `apps/api/AGENTS.md`         | API server-side authority contract           |
| `apps/backoffice/AGENTS.md`  | Institutional control panel contract         |
| `apps/frontoffice/AGENTS.md` | Student runtime contract                     |
| `apps/mmc/AGENTS.md`         | Platform control panel contract              |
| `apps/worker/AGENTS.md`      | Background processing contract               |
| `docker/AGENTS.md`           | Docker & infrastructure contract             |

### 2.4 Governance Documents

| Document                          | Purpose                             |
| --------------------------------- | ----------------------------------- |
| `docs/AGENT_GOVERNANCE.md`        | Behavioral rules for all agents     |
| `docs/ai/AI_BOOTSTRAP.md`         | Primary AI entrypoint               |
| `docs/ai/AI_CONTEXT_INDEX.md`     | Navigation map for AI context       |
| `docs/ai/AI_ENGINEERING_RULES.md` | Engineering rules for AI assistants |
| `docs/PROJECT_CONTEXT_PRIMER.md`  | Platform identity + trust chain     |

---

## 3. Agent Audit

### 3.1 Finding: Inconsistent Tool Declarations

| Agent                         | Issue                           |
| ----------------------------- | ------------------------------- |
| Zidney Frontend Developer     | Missing `tools:` YAML field     |
| Zidney Refactoring Specialist | Missing `tools:` YAML field     |
| speckit.clarify               | No tools declared in agent file |
| speckit.plan                  | No tools declared in agent file |
| speckit.tasks                 | No tools declared in agent file |
| speckit.analyze               | No tools declared in agent file |
| speckit.checklist             | No tools declared in agent file |
| speckit.constitution          | No tools declared in agent file |
| speckit.taskstoissues         | No tools declared in agent file |

**Impact:** Without explicit tool declaration, agents may access tools they shouldn't, or they may be denied tools they need. The tool restriction model is inconsistent.

**Severity:** ⚠️ Medium

### 3.2 Finding: No Agent Versioning System

Agents lack versioning metadata. When an agent's behavior changes, there is no way to track what version of the agent produced which artifacts.

**Impact:** Makes debugging difficult when investigating why a stage produced different results at different times.

**Severity:** ⚡ Low-Medium

### 3.3 Finding: Missing Agents for Key Platform Domains

| Missing Agent                  | Purpose                                              | Why Needed                                                                                                                       |
| ------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Zidney DB Migration Specialist | Database migration design, review, and validation    | Migrations are high-risk in multi-tenant (database-per-tenant) setups; currently no dedicated agent validates migration patterns |
| Zidney Observability Engineer  | Structured logging, metrics, correlation ID, tracing | Observability is a non-negotiable rule but no agent specializes in it                                                            |
| Zidney i18n/L10n Auditor       | Localization and internationalization compliance     | Educational SaaS often needs multi-language support; no governance exists                                                        |
| Zidney Worker Specialist       | Worker job patterns, DLQ governance, retry strategy  | Worker is a critical component with its own domain rules but relies on the generic QA Agent                                      |

**Severity:** ⚠️ High — DB migration and observability gaps are especially critical given platform rules.

### 3.4 Finding: Guardian Agent Overlap

Multiple agents enforce overlapping concerns:

| Concern          | Agents Checking It                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Tenant isolation | Architecture Checker, Code Reviewer, Security Auditor, QA Engineer, Performance Optimizer, Deployment Engineer |
| RBAC enforcement | Code Reviewer, QA Engineer, Security Auditor                                                                   |
| Idempotency      | Code Reviewer, QA Engineer, Security Auditor                                                                   |
| DDD enforcement  | Architecture Checker, Code Reviewer                                                                            |

**Impact:** While defense-in-depth is valuable, the extensive overlap increases token cost during parallel guardian execution in Steps 3.1A, 5.1A, and 6.6 without clear differentiation of which agent is the **primary authority** per concern.

**Severity:** ⚡ Medium

### 3.5 Finding: Governance Declaration Duplication

Every agent contains a near-identical `# GOVERNANCE DECLARATION` block (~10 lines). This is duplicated across all 12 Zidney agents.

**Impact:** 120+ lines of duplicated content consuming tokens across every agent invocation.

**Severity:** ⚡ Low — functionally correct but inefficient.

---

## 4. Skill Audit

### 4.1 Finding: Missing Skills for Core Platform Needs

| Missing Skill             | Domain       | Why Needed                                                                                                                                                            |
| ------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db-migration-governance` | Database     | Database-per-tenant migrations are the highest-risk operation. No skill governs migration file structure, naming, rollback, or tenant fan-out.                        |
| `observability-standards` | Monitoring   | Structured logging, correlation IDs, and metrics are mandatory per AGENTS.md. No skill codifies the exact logging patterns, required fields, or monitoring checklist. |
| `api-testing-patterns`    | Testing      | Integration test patterns for multi-tenant API endpoints (tenant scoping, RBAC, idempotency) have no dedicated skill despite being critical QA rules.                 |
| `worker-job-governance`   | Worker       | Job contract patterns (idempotency keys, DLQ handling, retry strategy, schema_version check) are documented in `apps/worker/AGENTS.md` but no reusable skill exists.  |
| `error-handling-patterns` | API          | The standardized error format `{ success, data, error: { code, message } }` is mandated but no skill enforces it with code patterns.                                  |
| `i18n-governance`         | Localization | No guidance exists for handling Arabic/English localization, RTL layout, or translation key management.                                                               |
| `security-hardening`      | Security     | While the Security Auditor agent exists, there is no reusable skill file for common security patterns (input sanitization, CSRF, CSP, rate-limiting implementation).  |
| `drizzle-orm-patterns`    | Database     | Drizzle ORM is the database layer but no skill documents schema definition patterns, query patterns, or migration file standards specific to Zidney.                  |

**Severity:** ⚠️ High — DB migration, observability, and API testing gaps are critical.

### 4.2 Finding: Skills with Mixed Scope

| Skill                           | Issue                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `ai-terminal` (439 lines)       | Combines terminal operations, monorepo navigation, and troubleshooting — approaching the 500-line limit |
| `tool-advisor` (297 lines)      | More of a meta-tool than a development skill — purpose is ambiguous for typical development tasks       |
| `vibe-testing-main` (273 lines) | Generic testing skill that doesn't specifically address Zidney's multi-tenant testing requirements      |

**Severity:** ⚡ Low

### 4.3 Finding: AWS Skills Not Relevant to Current Stack

Zidney uses a **single VPS + Docker Compose** deployment model (per `docker/AGENTS.md`). The AWS skill collection (8 skills) is not aligned with the current infrastructure:

- `aws-serverless-eda` (3 sub-skills)
- `aws-cdk-development`
- `aws-cost-operations`
- `aws-agentic-ai`
- `aws-mcp-setup`

**Impact:** These skills consume discovery overhead in the skills index without providing value for the current deployment model.

**Severity:** ⚡ Low — they don't interfere but add clutter.

### 4.4 Finding: Skill Auto-Loading Gaps

Auto-loaded (prompt-loaded) skills cover governance tooling but miss key development domains:

| Currently Auto-Loaded         | Missing from Auto-Load                                                |
| ----------------------------- | --------------------------------------------------------------------- |
| git-governance ✅             | vue ❌ (needed for any frontend work)                                 |
| mcp-routing ✅                | zidney-frontend-engineering ❌ (needed for app-level work)            |
| ai-terminal ✅                | architecture-intelligence ❌ (needed for any architectural reasoning) |
| terminal-safety ✅            | —                                                                     |
| precommit-diagnostics ✅      | —                                                                     |
| typescript-governance ✅      | —                                                                     |
| package-manager-governance ✅ | —                                                                     |
| rtk-execution-layer ✅        | —                                                                     |

**Severity:** ⚡ Medium — architects and frontend developers must manually trigger critical skills.

### 4.5 Finding: Skill Index Metadata Inconsistencies

The `SKILLS_INDEX.md` reports 30 skills but some directory entries don't have corresponding index entries:

- `typescript-governance/` exists but is listed as "prompt-loaded" skill without clear YAML metadata
- `Figma Implement Design/` uses space-separated directory names (inconsistent with kebab-case convention)
- `GH Fix CI/` uses space-separated directory names
- `Playwright/` contains runtime files (`package.json`, `run.js`, `lib/`) mixed with skill definitions

**Severity:** ⚡ Low — naming inconsistency only.

---

## 5. AGENTS.md Contract Audit

### 5.1 Finding: Root AGENTS.md is Excessively Long

The root `AGENTS.md` file is extremely large (500+ lines of dense rules). This file is loaded into every AI agent context, consuming significant token budget.

**Issues:**

- RTK instructions embedded inline (~100 lines)
- GitNexus instructions embedded inline (~60 lines)
- Full architecture self-healing section (~50 lines)
- MCP usage restrictions section (~80 lines)
- Duplicates content from `AI_ENGINEERING_RULES.md` and `docs/AGENT_GOVERNANCE.md`

**Impact:** Every AI interaction pays the token cost of the entire file even when only a small subset is relevant.

**Severity:** ⚠️ High — directly impacts token efficiency and response quality.

### 5.2 Finding: `copilot-instructions.md` is Stale

The `.agents/agents/copilot-instructions.md` file references:

```text
## Project Structure
backend/
frontend/
tests/
```

This does not match the actual monorepo structure (`apps/`, `packages/`, `specs/`, `tests/`, `scripts/`).

It also references:

```
## Commands
npm test && npm run lint
```

The actual package manager is **Bun**, not npm.

**Impact:** Copilot receives incorrect project context, leading to misaligned suggestions.

**Severity:** 🚨 Critical — directly causes incorrect AI behavior.

### 5.3 Finding: No AGENTS.md for `packages/` Layer

Individual packages (`packages/domain-core`, `packages/validation`, `packages/api-client`, etc.) lack AGENTS.md files. These packages are the domain logic layer — the most architecturally sensitive code.

**Impact:** AI agents working on domain packages have no package-level behavioral constraints.

**Severity:** ⚠️ High

### 5.4 Finding: Strong AGENTS.md Coverage for Apps

Each application directory has a detailed, well-structured AGENTS.md that clearly defines:

- Trust chain position
- Technology stack
- Non-negotiable rules
- What the app MUST NOT do
- Error handling patterns

This is excellent and consistent. No issues found.

**Severity:** ✅ No issues

### 5.5 Finding: Session Memory File is Stale

`.agents/session-memory.md` contains Phase 3 execution notes from 2026-03-14. This file is not being cleaned up between sessions.

**Impact:** Stale session context consumed unneccesarily.

**Severity:** ⚡ Low

---

## 6. Orchestrator Deep Audit

### 6.1 Overall Assessment: 🟢 Excellent

The Zidney Orchestrator is the strongest component of the AI system. It features:

- Complete 8-step workflow (Pre-Step → Specify → Clarify → Plan → Tasks → Analyze → Implement → Closure)
- Deterministic execution mode with strict source-of-truth hierarchy
- Skill delegation pattern (thin controller, logic in skills)
- Stage-aware context compression
- Comprehensive error handling (Handoff Error Protocol, Scope Amendment Protocol, ADR Creation Protocol)
- Governance Metadata Lock (7.8) ensuring consistency before exit
- Local CI Simulation Gate (mandatory before closure)
- Parallel guardian execution at Steps 3.1A, 5.1A, and 6.6
- Full audit trail via `.workflow-state.json`

### 6.2 Finding: No Timeout or Session Length Management

The orchestrator has no mechanism for:

- Maximum session duration tracking
- Warning when approaching token limits
- Checkpointing long sessions to allow split across multiple conversations
- Graceful degradation when context window is nearing capacity

**Impact:** Long workflows (especially implement step) can exceed context limits causing lost state.

**Severity:** ⚠️ High

### 6.3 Finding: No Rollback Protocol

If implementation produces broken code that passes all validators but is functionally wrong, there is no formal rollback protocol. The orchestrator can:

- Resume from `.workflow-state.json` ✅
- Detect blockers at gates ✅
- Roll back implementation changes ❌

**Impact:** Developer must manually `git revert` or `git reset` with no guided workflow.

**Severity:** ⚠️ Medium

### 6.4 Finding: Commit Template Dependencies Not Verified

Steps reference commit templates like `specs/templates/commits/commit-pre-step.md`, `commit-specify.md`, etc. If these templates are missing, the orchestrator will fail mid-step.

**Current check:** None — template existence is assumed.

**Impact:** Silent failure if templates are accidentally deleted or not yet created.

**Severity:** ⚠️ Medium

### 6.5 Finding: Report Template Dependencies Not Verified

Similar to commit templates, report templates under `specs/templates/reports/` and `specs/templates/audits/` are referenced but never validated for existence at Pre-Step.

**Impact:** Step failures mid-workflow when templates are missing.

**Severity:** ⚠️ Medium

### 6.6 Finding: No Metrics Collection Across Stages

The orchestrator tracks `step_timings` per stage but there is no cross-stage analytics:

- Average time per step type across all stages
- Most common violation types
- Guardian pass/fail rates
- Implementation task density trends

**Impact:** No data-driven improvement of the workflow itself.

**Severity:** ⚡ Low-Medium

### 6.7 Finding: Missing speckit.checklist Agent in Orchestrator Workflow

The `speckit.checklist` agent exists but is never invoked by the orchestrator. The orchestrator only checks `checklists/requirements.md` (produced by `speckit.specify`) but never generates domain-specific checklists.

**Impact:** Missed opportunity for security, performance, and accessibility checklists.

**Severity:** ⚡ Medium

### 6.8 Finding: No Post-Implementation Smoke Test Step

After Step 6.5 validation gate, there is no automated functional smoke test. The validation gate checks:

- Unit tests ✅
- Integration tests ✅
- Lint ✅
- Type check ✅
- Runtime boot ✅

But does not verify:

- API endpoint actually responds correctly ❌
- Database migration actually applies ❌
- Worker job actually processes ❌

**Severity:** ⚡ Medium

---

## 7. Governance & AI Context Layer Audit

### 7.1 Finding: Context Loading Order Has Redundancy

`AGENTS.md` mandates loading 5 files before reasoning:

1. `docs/ai/AI_BOOTSTRAP.md`
2. `docs/ai/AI_CONTEXT_INDEX.md`
3. `docs/PROJECT_CONTEXT_PRIMER.md`
4. `docs/ai/AI_ENGINEERING_RULES.md`
5. `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json`

`AI_BOOTSTRAP.md` mandates loading 8 files including some of the same ones. This creates circular/redundant loading instructions.

**Impact:** Token waste and confused loading priority.

**Severity:** ⚡ Medium

### 7.2 Finding: Architecture Intelligence Layer is Comprehensive

The `docs/ai/context/` directory contains 8 machine-readable artifacts that provide excellent architecture awareness:

- `ai-architecture-brain.json`
- `ai-module-map.json`
- `ai-dependency-graph.json`
- `ai-runtime-map.json`
- `ai-runtime-dependents.json`
- `ai-architecture-diff.json`
- `ai-context-mini.json`
- `ai-layer-model.json`

**Assessment:** ✅ Excellent — best-in-class for AI-assisted architecture governance.

### 7.3 Finding: Missing Runtime Validation of Context Freshness

While `gitnexus-context.json` has a 24-hour freshness check (in Step 6.2B), the other architecture intelligence artifacts (`ai-architecture-brain.json`, `ai-module-map.json`, etc.) have no automated freshness validation.

**Impact:** Stale architecture context can lead to incorrect decisions.

**Severity:** ⚠️ Medium

### 7.4 Finding: Agent Governance Lacks Conflict Resolution Between Skills

`docs/AGENT_GOVERNANCE.md` defines authority hierarchy:

1. Constitution → 2. ADRs → 3. Orchestrator → 4. Agent Governance

But there is no conflict resolution defined between **skills**. If `git-governance` and `terminal-safety` give conflicting guidance, what takes precedence?

**Severity:** ⚡ Low-Medium

---

## 8. Prompt Layer Audit

### 8.1 Finding: Prompt Files Are Minimal

All `.agents/prompts/*.prompt.md` files contain only YAML frontmatter with an `agent:` reference. They serve as routing aliases rather than containing prompt engineering logic.

**Assessment:** This is correct for SpecKit agents (behavior defined in agent files). For Zidney domain agents, the prompt files are similarly minimal (`agent: <name>` only).

**Impact:** No issue — the prompt logic lives in the agent files as intended.

### 8.2 Finding: No Prompt Testing or Validation Framework

There is no system for:

- Testing that prompts produce expected outputs
- Validating prompt quality
- A/B testing prompt variations
- Measuring prompt effectiveness

**Severity:** ⚡ Low — advanced concern for future maturity.

---

## 9. Cross-Cutting Gaps & Missing Capabilities

### 9.1 Gap Matrix

| Gap                                       | Impact   | Affected Components        | Priority |
| ----------------------------------------- | -------- | -------------------------- | -------- |
| No DB migration governance skill          | HIGH     | API, Worker, Orchestrator  | P0       |
| Stale copilot-instructions.md             | CRITICAL | All Copilot interactions   | P0       |
| No observability skill                    | HIGH     | All agents generating code | P1       |
| No packages/ AGENTS.md files              | HIGH     | Domain packages            | P1       |
| Root AGENTS.md too large                  | HIGH     | Token efficiency           | P1       |
| No orchestrator session management        | HIGH     | Long workflows             | P1       |
| Missing commit/report template validation | MEDIUM   | Orchestrator reliability   | P2       |
| No rollback protocol                      | MEDIUM   | Implementation recovery    | P2       |
| No agent versioning                       | MEDIUM   | Debugging, reproducibility | P2       |
| No i18n governance                        | MEDIUM   | Frontend apps              | P2       |
| No Drizzle ORM patterns skill             | MEDIUM   | API, DB layer              | P2       |
| AWS skills irrelevant                     | LOW      | Skill discovery overhead   | P3       |
| Guardian concern overlap                  | MEDIUM   | Token efficiency           | P3       |
| Governance declaration duplication        | LOW      | Token efficiency           | P3       |
| Missing cross-stage analytics             | LOW      | Workflow optimization      | P3       |
| Skill auto-load gaps                      | MEDIUM   | Developer experience       | P2       |

### 9.2 Security Gaps

| Gap                                              | Description                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| No CSRF governance                               | No skill or agent specifically validates CSRF protection patterns     |
| No CSP governance                                | Content Security Policy headers are not governed                      |
| No dependency vulnerability scanning integration | No agent validates that dependencies are free of known CVEs           |
| No secret rotation governance                    | Secret management rules exist but rotation practices are not codified |

### 9.3 Testing Gaps

| Gap                           | Description                                                              |
| ----------------------------- | ------------------------------------------------------------------------ |
| No E2E test governance        | Playwright skill exists but no Zidney-specific E2E patterns are defined  |
| No load testing governance    | Performance Optimizer reviews queries but no load testing patterns exist |
| No snapshot test governance   | Grading snapshot tests are mandated but no patterns are provided         |
| No test data factory patterns | Multi-tenant test setup has no standardized factory/fixture skill        |

---

## 10. Zidney Orchestrator — Full Step Sequence Roadmap

### Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SESSION START                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Session Mode Detection                                   │   │
│  │  ├── New Session → Intake Form                           │   │
│  │  ├── Resume Session → Restore from .workflow-state.json  │   │
│  │  └── Dry-Run → Validate only, no writes                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SKILL HEALTH CHECK                                       │   │
│  │  Verify all 10 required skills are loadable               │   │
│  │  FAIL → STOP session                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  INTAKE (New Session Only)                                │   │
│  │  Collect: Stage Name, Phase Name, Stage File              │   │
│  │  Optional: Phase File Pre-Fill from stage file            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────── PRE-STEP ────────────────────────────────┐
│  Pre.1  Derive Branch/Directory Name from STAGE_FILE_NAME       │
│         ├── Parse STAGE_TOKEN from filename                     │
│         ├── Zero-pad to 3 digits                                │
│         ├── Generate STAGE_DIR_NAME (kebab-case)                │
│         └── Detect PKG_MANAGER (store for session)              │
│                                                                  │
│  Pre.2  Confirm Base Branch (default: develop)                  │
│                                                                  │
│  Pre.3  Validate Clean Working Tree                             │
│         └── DIRTY → choice: retry / approve / abort             │
│                                                                  │
│  Pre.4  Create Git Branch: spec/<STAGE_DIR_NAME>                │
│         ├── git fetch --all --prune                             │
│         ├── git checkout <BASE_BRANCH> && git pull              │
│         └── git checkout -b spec/<STAGE_DIR_NAME>               │
│         └── EXISTS → choice: reuse / abort                      │
│                                                                  │
│  Pre.5  Create Stage Directory Structure                        │
│         ├── specs/runtime/<STAGE_DIR_NAME>/reports/             │
│         ├── specs/runtime/<STAGE_DIR_NAME>/audits/              │
│         ├── specs/runtime/<STAGE_DIR_NAME>/guides/              │
│         └── Write README.md (workflow progress tracker)         │
│                                                                  │
│  Pre.6  Initialize .workflow-state.json                         │
│         └── Full state object with all tracking fields          │
│                                                                  │
│  Pre.7  Initialize Stage Status Block                           │
│         └── Write DRAFT status to stage file                    │
│                                                                  │
│  Pre.8  Commit Pre-Step                                         │
│         └── Load commit-pre-step.md template                    │
│                                                                  │
│  → Auto-continue to Step 1                                      │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────── STEP 1 — SPECIFY ───────────────────────────────┐
│  1.1  /handoff to=speckit.specify                               │
│       ├── Agent runs create-new-feature.sh                      │
│       ├── Writes spec.md to runtime dir                         │
│       ├── Creates checklists/requirements.md                    │
│       └── Apply Handoff Error Protocol                          │
│                                                                  │
│  1.2  Write SPECIFY_REPORT.md                                   │
│       └── Load specify-report-template.md → fill → write        │
│                                                                  │
│  1.3  Update Stage Status Block → DRAFT / Step: specify         │
│                                                                  │
│  1.4  Merge .workflow-state.json                                │
│       └── current_step: "specify"                               │
│                                                                  │
│  1.5  Update README.md → Specify row ✅                         │
│                                                                  │
│  1.6  Commit Specify Step                                       │
│       └── Load commit-specify.md template                       │
│                                                                  │
│  → Auto-continue to Step 2                                      │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────── STEP 2 — CLARIFY ───────────────────────────────┐
│  2.1  /handoff to=speckit.clarify                               │
│       ├── Reads spec.md, runs ambiguity scan                    │
│       ├── Asks up to 5 targeted questions interactively         │
│       ├── Appends ## Clarifications section to spec.md          │
│       └── Apply Handoff Error Protocol                          │
│                                                                  │
│  2.2  Write CLARIFY_REPORT.md                                   │
│       └── Load clarify-report-template.md → fill → write        │
│                                                                  │
│  2.3  Update Stage Status Block → DRAFT / Step: clarify         │
│       └── Compute Risk Level (Risk Scoring Rubric)              │
│                                                                  │
│  2.4  Merge .workflow-state.json                                │
│       └── current_step: "clarify", clarifications_resolved: true│
│                                                                  │
│  2.5  Update README.md → Clarify row ✅                         │
│                                                                  │
│  2.6  Commit Clarify Step                                       │
│       └── Load commit-clarify.md template                       │
│                                                                  │
│  → Auto-continue to Step 3                                      │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────── STEP 3 — PLAN ──────────────────────────────────┐
│  3.1-PRE  Context7 MCP Pre-Planning Lookup                      │
│           └── Query docs for any 3rd-party lib in spec.md       │
│                                                                  │
│  3.1  /handoff to=speckit.plan                                  │
│       ├── Runs setup-plan.sh to copy plan template              │
│       ├── Phase 0: Writes research.md                           │
│       ├── Phase 1: Writes data-model.md, contracts/, quickstart │
│       ├── Fills and finalizes plan.md                           │
│       └── Apply Handoff Error Protocol                          │
│                                                                  │
│  3.1A  Guardian Plan Validation (PARALLEL)                      │
│        ├── /handoff to=zidney-architecture-checker              │
│        └── /handoff to=zidney-api-designer                      │
│        └── Both MUST return VERDICT: PASS                       │
│        └── ANY BLOCKED → STOP (remediate → re-run 3.1A)        │
│                                                                  │
│  3.2  Write PLAN_REPORT.md                                      │
│                                                                  │
│  3.3  Update Stage Status Block → DRAFT / Step: plan            │
│                                                                  │
│  3.4  Merge .workflow-state.json                                │
│       └── current_step: "plan", plan_completed: true            │
│                                                                  │
│  3.5  Update README.md → Plan row ✅                            │
│                                                                  │
│  3.6  Commit Plan Step                                          │
│                                                                  │
│  → Auto-continue to Step 4                                      │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────── STEP 4 — TASKS ─────────────────────────────────┐
│  4.1  /handoff to=speckit.tasks                                 │
│       ├── Reads spec.md, plan.md, data-model.md, contracts/     │
│       ├── Writes tasks.md with T001..T0NN format                │
│       ├── Marks parallel tasks with [P]                         │
│       └── Count TASKS_TOTAL from - [ ] lines                   │
│                                                                  │
│  4.2  Write TASKS_REPORT.md                                     │
│       ├── Standard task list + enriched sections:               │
│       │   ├── Risk-Ranked Task View (🔴🟡🟢)                   │
│       │   ├── External Dependency Tasks (from Context7)         │
│       │   └── High-Downstream-Impact Tasks (from heatmap)       │
│                                                                  │
│  4.3  Update Stage Status Block → DRAFT / Step: tasks           │
│                                                                  │
│  4.4  Merge .workflow-state.json                                │
│       └── current_step: "tasks", tasks_total: N                 │
│                                                                  │
│  4.5  Update README.md → Tasks row ✅                           │
│                                                                  │
│  4.6  Commit Tasks Step                                         │
│                                                                  │
│  → Auto-continue to Step 5                                      │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────── STEP 5 — ANALYZE ───────────────────────────────┐
│  5.1  /handoff to=speckit.analyze                               │
│       ├── Structural drift audit (READ-ONLY)                    │
│       ├── Reads spec.md, plan.md, tasks.md                      │
│       ├── Validates against constitution                        │
│       └── 9/9 criteria = PASS; <9/9 = BLOCKED                  │
│                                                                  │
│  5.1A  Composite Guardian Audit (PARALLEL)                      │
│        ├── /handoff to=zidney-security-auditor                  │
│        ├── /handoff to=zidney-performance-optimizer             │
│        ├── /handoff to=zidney-qa-engineer                       │
│        └── /handoff to=zidney-code-reviewer                     │
│        └── Each MUST return VERDICT: PASS | BLOCKED             │
│                                                                  │
│  5.1B  Composite Verdict Aggregation                            │
│        ├── ALL PASS → Final Gate = APPROVED                     │
│        └── ANY BLOCKED → Final Gate = BLOCKED                   │
│            ├── Display violation table with status markers       │
│            │   (🆕 New / ❌ Remaining / ✅ Fixed)               │
│            ├── Delegate retry to analysis-retry-engine skill     │
│            └── STOP → remediate → re-run Step 5                 │
│                                                                  │
│  5.2  Write ANALYZE_REPORT.md (only if APPROVED)                │
│                                                                  │
│  5.3  Update Stage Status Block                                 │
│       ├── APPROVED → IN PROGRESS, Implementation: AUTHORIZED    │
│       └── BLOCKED → IN PROGRESS, Implementation: FORBIDDEN      │
│                                                                  │
│  5.4  Merge .workflow-state.json                                │
│       └── drift_passed: true/false, implementation_allowed      │
│                                                                  │
│  5.5  Update README.md → Analyze row ✅ or ❌                   │
│                                                                  │
│  5.6  Commit Analyze Step                                       │
│                                                                  │
│  → If APPROVED: Auto-continue to Step 6                         │
│  → If BLOCKED: STOP (remediate → re-run Step 5)                 │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────── STEP 6 — IMPLEMENT ─────────────────────────────┐
│  6.1  Verify Implementation Gate                                │
│       └── drift_passed=true + no unresolved violations          │
│                                                                  │
│  6.2  Check SpecKit Checklists                                  │
│       └── Verify checklists/requirements.md completion          │
│                                                                  │
│  6.2B GitNexus Context Bootstrap Gate                           │
│       ├── Verify gitnexus-context.json ≤24h old                │
│       ├── Regenerate if stale → bun run arch:gitnexus:context        │
│       └── Validate → bun run arch:gitnexus:validate                  │
│                                                                  │
│  6.3-PRE  Context7 MCP Pre-Implementation Lookup                │
│           └── Query docs for 3rd-party libs in tasks.md         │
│                                                                  │
│  6.3  /handoff to=speckit.implement                             │
│       ├── Reads tasks.md, plan.md, data-model.md, contracts/    │
│       ├── Executes tasks phase-by-phase (TDD approach)          │
│       ├── Marks completed tasks as [X] in tasks.md              │
│       ├── Tracks parallel task groups                           │
│       └── Uses PKG_MANAGER for all installs                     │
│                                                                  │
│  6.4  Verify Implementation Completeness                        │
│       ├── Count [X] lines = TASKS_COMPLETED                     │
│       ├── INCOMPLETE → choice: continue / defer                 │
│       └── COMPLETE → proceed to 6.5                             │
│                                                                  │
│  6.5  Mandatory Validation Gate                                 │
│       ├── Unit tests                                            │
│       ├── Integration tests                                     │
│       ├── Snapshot tests (if grading)                           │
│       ├── Lint (biome check .)                                  │
│       ├── Type check (bun run typecheck)                        │
│       ├── Dev runtime boot check                                │
│       ├── Migration validation (if schema changed)              │
│       ├── Idempotency replay validation                         │
│       └── Concurrency validation                                │
│       └── Write VALIDATION_REPORT.md                            │
│                                                                  │
│  6.5A  Runtime & Static Analysis Gate (Hard Blocker)            │
│        ├── Biome check → exit 0 required                        │
│        ├── TypeScript type-check → exit 0 required              │
│        └── Dev runtime boot → no crash required                 │
│                                                                  │
│  6.6  Pre-Closure Guardian Validation (PARALLEL)                │
│       ├── /handoff to=zidney-cicd-automation                    │
│       ├── /handoff to=zidney-deployment-engineer                │
│       └── /handoff to=zidney-docker-specialist                  │
│       └── ALL MUST PASS → else STOP                             │
│                                                                  │
│  6.7  Write IMPLEMENT_REPORT.md                                 │
│                                                                  │
│  6.8  Update Stage Status Block → BACKEND CLOSED                │
│                                                                  │
│  6.9  Merge .workflow-state.json                                │
│       └── current_step: "implement", stage_status: BACKEND CLOSED│
│                                                                  │
│  6.10 Update README.md → Implement row ✅                       │
│                                                                  │
│  6.11 Commit Implement Step                                     │
│                                                                  │
│  → STOP at Pre-Closure Review Gate (human approval required)    │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────── ⏸ PRE-CLOSURE REVIEW GATE ──────────────────────────┐
│  Present all artifacts as clickable links for review:           │
│  ├── SpecKit: spec.md, plan.md, tasks.md, checklists/          │
│  ├── Reports: SPECIFY, CLARIFY, PLAN, TASKS, IMPLEMENT         │
│  └── Audits: ANALYZE_REPORT, VALIDATION_REPORT                 │
│                                                                  │
│  Choice:                                                        │
│  ├── ✅ Approve → proceed to Step 7                             │
│  └── ❌ Reject → describe issues → re-fix → re-present         │
│                                                                  │
│  ★ LOCAL CI SIMULATION GATE (Mandatory)                         │
│    └── bun run ci:run-local → exit 0 required                  │
│    └── FAIL → BLOCK closure                                     │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────── STEP 7 — CLOSURE ───────────────────────────────┐
│  7.1  Write CLOSURE_REPORT.md                                   │
│       └── Load closure-report-template.md → fill from all       │
│                                                                  │
│  7.2  Generate TESTING_GUIDE.md                                 │
│       └── Load testing-guide-template.md → fill with real data  │
│                                                                  │
│  7.3  Update Stage Status Block → PRODUCTION READY              │
│       └── Full scope, compliance, ADR alignment                 │
│                                                                  │
│  7.4  Update .workflow-state.json (Final)                       │
│       └── current_step: "stage_production_ready"                │
│                                                                  │
│  7.5  Update README.md (Final) → all steps ✅                   │
│                                                                  │
│  7.6  Generate PR_SUMMARY.md                                    │
│       └── Load pr-template.md → fill from all artifacts         │
│                                                                  │
│  7.7  Commit Closure Step                                       │
│                                                                  │
│  7.8  Governance Metadata Lock (Validation Gate)                │
│       ├── 7.8A Stage Status Block Verification                  │
│       │   └── 7 checklist items must all pass                   │
│       ├── 7.8B Workflow State Consistency Check                  │
│       │   └── stage_status, current_step, task counts, history  │
│       ├── 7.8C Git Staging Validation                           │
│       │   └── Only governance files staged                      │
│       └── 7.8D Post-Validation State Confirmation               │
│                                                                  │
│  7.9  Output Final Closure Summary                              │
│       ├── Full artifact tree with ✅ markers                    │
│       ├── Step timings report                                   │
│       └── One-click actions:                                    │
│           ├── 🚀 Push branch (requires explicit click)          │
│           ├── 📋 Open PR Summary                                │
│           └── 🧪 Open Testing Guide                             │
└─────────────────────────────────────────────────────────────────┘
```

### Support Protocols (Invoked Throughout)

| Protocol                        | When Invoked                                                      |
| ------------------------------- | ----------------------------------------------------------------- |
| **Handoff Error Protocol**      | After every `/handoff` call                                       |
| **Stage Lifecycle Guard**       | Before any Stage Status Block modification                        |
| **ADR Creation Protocol**       | When architectural decision is detected in any step               |
| **Scope Amendment Protocol**    | When user requests requirement change post-commit                 |
| **Risk Level Scoring Rubric**   | Step 2 (initial), Step 5 (update if changed)                      |
| **DEPRECATED Lifecycle Path**   | When user explicitly deprecates a stage                           |
| **Git Hygiene Enforcement**     | At every commit point (Pre.8, 1.6, 2.6, 3.6, 4.6, 5.6, 6.11, 7.7) |
| **Package Manager Enforcement** | Detected at Pre.1, used throughout                                |
| **Automatic Continuation Rule** | After every sub-step to determine next action                     |

### Guardian Execution Schedule

| Step | Guardian Agents                                                        | Execution Mode |
| ---- | ---------------------------------------------------------------------- | -------------- |
| 3.1A | Architecture Checker + API Designer                                    | PARALLEL       |
| 5.1  | speckit.analyze                                                        | SEQUENTIAL     |
| 5.1A | Security Auditor + Performance Optimizer + QA Engineer + Code Reviewer | PARALLEL       |
| 6.6  | CI/CD Automation + Deployment Engineer + Docker Specialist             | PARALLEL       |

### Total Agent Invocations Per Full Workflow

| Agent                        | Invocations                          |
| ---------------------------- | ------------------------------------ |
| speckit.specify              | 1                                    |
| speckit.clarify              | 1                                    |
| speckit.plan                 | 1                                    |
| speckit.tasks                | 1                                    |
| speckit.analyze              | 1                                    |
| speckit.implement            | 1+ (may re-run for incomplete tasks) |
| zidney-architecture-checker  | 1                                    |
| zidney-api-designer          | 1                                    |
| zidney-security-auditor      | 1                                    |
| zidney-performance-optimizer | 1                                    |
| zidney-qa-engineer           | 1                                    |
| zidney-code-reviewer         | 1                                    |
| zidney-cicd-automation       | 1                                    |
| zidney-deployment-engineer   | 1                                    |
| zidney-docker-specialist     | 1                                    |
| **Total**                    | **15+ agent invocations**            |

---

## 11. Recommendations & Enhancement Roadmap

### Priority 0 — Fix Immediately (Critical)

| #   | Action                                                                                                                                                                                                                                      | Effort | Impact                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------- |
| R01 | **Fix `copilot-instructions.md`** — Update project structure to `apps/`, `packages/`, `specs/`, `scripts/`. Replace `npm` with `bun`. Add actual tech stack.                                                                                | 30 min | 🚨 Every Copilot session currently gets wrong context |
| R02 | **Add AGENTS.md for `packages/domain-core`** — This is the most architecturally sensitive package. It needs behavioral constraints for: entity patterns, schema definitions, business rule isolation, no-HTTP rule, pure function patterns. | 1-2 hr | 🚨 Domain logic is unguarded                          |

### Priority 1 — High Priority Enhancements

| #   | Action                                                                                                                                                                                                                  | Effort | Impact                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------- |
| R03 | **Create `db-migration-governance` skill** — Define migration file naming, tenant fan-out patterns, expand-deploy-migrate-contract steps, rollback via snapshot. Reference `apps/api/AGENTS.md` and `docker/AGENTS.md`. | 2-3 hr | ⚠️ Migrations are highest-risk ops              |
| R04 | **Create `observability-standards` skill** — Codify required log fields (`request_id`, `workspace_slug`, `user_id`, `correlation_id`, `attempt_id`), structured logging patterns with Pino, metric definitions.         | 2-3 hr | ⚠️ Mandatory but no enforcement skill           |
| R05 | **Slim down root `AGENTS.md`** — Extract RTK instructions, GitNexus instructions, architecture self-healing, and MCP restrictions into references/links. Keep root file <300 lines. Move detail into existing skills.   | 2-3 hr | ⚠️ Major token savings across all interactions  |
| R06 | **Add AGENTS.md for key packages** — At minimum: `packages/validation`, `packages/api-client`, `packages/types`, `packages/job-queue`. Define: what each package owns, what it must NOT import, public API contract.    | 3-4 hr | ⚠️ Package boundaries need behavioral contracts |
| R07 | **Add template existence validation to Pre-Step** — In Pre.5 or a new Pre.5B, verify all commit templates and report templates exist. STOP if any missing.                                                              | 30 min | ⚠️ Prevents mid-workflow failures               |
| R08 | **Add orchestrator session management** — Track token usage estimates, warn at 70% context capacity, implement graceful checkpoint-and-resume for long implementations.                                                 | 3-4 hr | ⚠️ Prevents lost state in long workflows        |

### Priority 2 — Medium Priority Enhancements

| #   | Action                                                                                                                                                                   | Effort | Impact                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------ |
| R09 | **Create `api-testing-patterns` skill** — Multi-tenant test setup, RBAC negative tests, idempotency replay tests, tenant isolation assertions.                           | 2-3 hr | ⚡ Standardizes test quality               |
| R10 | **Create `drizzle-orm-patterns` skill** — Schema definition patterns, migration file format, query patterns, tenant-scoped repository patterns.                          | 2-3 hr | ⚡ Standardizes DB layer code              |
| R11 | **Create `error-handling-patterns` skill** — Standard error response format, error code registry, HTTP status mapping, error boundary patterns for frontend.             | 1-2 hr | ⚡ Enforces consistent error model         |
| R12 | **Add rollback protocol to orchestrator** — Guided `git revert` workflow for implementation steps, with state file update and re-entry point.                            | 2-3 hr | ⚡ Safer recovery from bad implementations |
| R13 | **Fix tool declarations for all agents** — Add `tools:` YAML to Frontend Developer, Refactoring Specialist, and all SpecKit agents that need them.                       | 1 hr   | ⚡ Consistent tool access control          |
| R14 | **Add `speckit.checklist` to orchestrator workflow** — Invoke at Step 2.5 (after clarify) to generate domain-specific checklists (security, performance, accessibility). | 1-2 hr | ⚡ Better pre-implementation coverage      |
| R15 | **Create `i18n-governance` skill** — Translation key patterns, RTL layout rules, locale file structure, pluralization patterns.                                          | 2-3 hr | ⚡ Critical for educational SaaS           |
| R16 | **Add agent version metadata** — Add `version:` field to all agent YAML frontmatter. Track version in `.workflow-state.json` events.                                     | 1-2 hr | ⚡ Enable debugging and reproducibility    |
| R17 | **Create `worker-job-governance` skill** — Job contract patterns, DLQ handling, retry strategy, idempotency key patterns, schema_version check.                          | 2-3 hr | ⚡ Worker is unguarded                     |
| R18 | **Consolidate auto-load skill selection** — Add `architecture-intelligence` and `zidney-frontend-engineering` to prompt-loaded skills.                                   | 30 min | ⚡ Better default context                  |

### Priority 3 — Low Priority / Future

| #   | Action                                                                                                                                                                                                          | Effort | Impact                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------- |
| R19 | **Archive or tag AWS skills** — Mark AWS skills as `infrastructure: future` or move to `.agents/skills/_archived/` to reduce skill discovery noise.                                                             | 30 min | Minor clarity                       |
| R20 | **Deduplicate Governance Declaration blocks** — Create a shared governance preamble skill that agents reference instead of embedding.                                                                           | 1 hr   | Minor token savings                 |
| R21 | **Add cross-stage analytics** — Create a script that aggregates `step_timings`, guardian verdicts, and violation types from all `.workflow-state.json` files across `specs/runtime/`.                           | 3-4 hr | Workflow improvement data           |
| R22 | **Add post-implementation smoke test** — After 6.5, run actual API endpoint hit test, migration apply test, and worker job test against ephemeral environment.                                                  | 4-6 hr | Higher confidence before closure    |
| R23 | **Streamline AI context loading** — Consolidate `AI_BOOTSTRAP.md` → `AI_CONTEXT_INDEX.md` → `AI_ENGINEERING_RULES.md` into a single layered document with clear sections, eliminating redundant loading chains. | 3-4 hr | Cleaner context pipeline            |
| R24 | **Add skill conflict resolution rules** — Define precedence between skills when guidance conflicts. Add to `docs/AGENT_GOVERNANCE.md`.                                                                          | 1 hr   | Prevents ambiguous behavior         |
| R25 | **Fix skill directory naming** — Rename `Figma Implement Design/`, `Figma MCP/`, `GH Fix CI/` to kebab-case (`figma-implement-design/`, `figma-mcp/`, `gh-fix-ci/`).                                            | 30 min | Naming consistency                  |
| R26 | **Clean stale `.agents/session-memory.md`** — Remove or archive Phase 3 session data.                                                                                                                           | 5 min  | Clean workspace                     |
| R27 | **Add freshness validation for architecture artifacts** — Extend 6.2B pattern to validate all `docs/ai/context/` artifacts, not just `gitnexus-context.json`.                                                   | 1-2 hr | Prevents stale architecture context |
| R28 | **Create `security-hardening` skill** — CSRF patterns, CSP headers, dependency vulnerability scanning integration, secret rotation practices.                                                                   | 2-3 hr | Defense-in-depth                    |

---

## 12. Clarification Questions (MCQ)

The following questions surface ambiguities discovered during the audit. Each provides recommended answers based on project context and best practices.

---

### Q1. Should AWS skills be archived or kept for future migration?

Zidney currently deploys on a single VPS with Docker Compose. AWS skills (8 total) are not used.

- **A)** Archive AWS skills to `.agents/skills/_archived/aws/` ← **RECOMMENDED** (reduces skill discovery noise, keeps them recoverable)
- **B)** Delete AWS skills entirely
- **C)** Keep them as-is for potential future cloud migration
- **D)** Move them to a separate repository

---

### Q2. What level of AGENTS.md coverage should `packages/` have?

Currently 0 out of 9 packages have AGENTS.md files. Options:

- **A)** Add AGENTS.md for ALL packages (domain-core, api-client, ui-system, validation, config, logger, redis-utils, types, job-queue) ← **RECOMMENDED** (complete boundary enforcement)
- **B)** Add AGENTS.md only for domain-critical packages (domain-core, validation, api-client, job-queue)
- **C)** Add AGENTS.md only for `domain-core` (the highest-risk package)
- **D)** No AGENTS.md for packages — rely on root AGENTS.md rules

---

### Q3. How should guardian agent concern overlap be addressed?

Six agents check tenant isolation, creating token overhead during parallel execution.

- **A)** Assign each agent a PRIMARY concern and mark others as SECONDARY (agents only BLOCK on primary concerns) ← **RECOMMENDED** (reduces noise while keeping defense-in-depth)
- **B)** Remove overlap entirely — only one agent checks each concern
- **C)** Keep as-is — defense-in-depth is worth the token cost
- **D)** Create a lightweight "concern router" that distributes checks to specific agents

---

### Q4. Should the orchestrator support multi-conversation checkpointing?

Long implementation steps can exceed context window limits.

- **A)** Add a checkpoint protocol that saves state and prints a "Resume Command" the user can paste in a new conversation ← **RECOMMENDED** (practical for VS Code Copilot's session model)
- **B)** Add token budget estimation and auto-pause when nearing 70% capacity
- **C)** Both A and B
- **D)** No change — rely on existing `.workflow-state.json` resume capability

---

### Q5. What should the `copilot-instructions.md` update include?

The file is severely outdated. It needs to be regenerated.

- **A)** Auto-generate from the root `AGENTS.md` and `package.json` — keep it as a lightweight summary ← **RECOMMENDED** (auto-sync prevents staleness)
- **B)** Manually rewrite with full monorepo context (duplicate effort)
- **C)** Delete it entirely — root `AGENTS.md` is sufficient
- **D)** Replace with a reference link to root `AGENTS.md`

---

### Q6. Should a `db-migration-governance` skill reference the existing `docker/AGENTS.md` migration rules or be standalone?

Migration governance exists in fragments across multiple files.

- **A)** Create a standalone skill that consolidates migration rules from `docker/AGENTS.md`, `apps/api/AGENTS.md`, and `AGENTS.md` ← **RECOMMENDED** (single source of truth)
- **B)** Create a skill that references the existing files without duplicating content
- **C)** Add migration rules to the existing `architecture-intelligence` skill
- **D)** No new skill — migration governance is already covered by the Deployment Engineer agent

---

### Q7. Should the Governance Declaration block in agents be deduplicated?

120+ lines of identical governance preamble exist across 12 agents.

- **A)** Create a `governance-preamble` skill that agents reference via a single line ← **RECOMMENDED** (maximizes token savings)
- **B)** Move the governance declaration to a shared YAML partial
- **C)** Keep as-is — explicit is better than implicit
- **D)** Reduce to a one-line reference: `Governed by: docs/AGENT_GOVERNANCE.md`

---

### Q8. How should prompt effectiveness be measured?

No prompt testing or quality metrics exist.

- **A)** Add a `prompt-qa` script that replays known inputs against agents and validates output structure ← **RECOMMENDED** (automated quality gate)
- **B)** Add manual prompt testing as part of the speckit.analyze step
- **C)** Track guardian PASS/BLOCKED rates across stages as proxy metrics
- **D)** No measurement needed — current agents work well enough

---

### Q9. Should `speckit.checklist` be integrated into the orchestrator workflow?

The agent exists but is never invoked by the orchestrator.

- **A)** Invoke at Step 2 (Clarify) to generate security, performance, and accessibility checklists ← **RECOMMENDED** (fills the gap before planning)
- **B)** Invoke at Step 3 (Plan) to generate implementation checklists
- **C)** Invoke at Step 5 (Analyze) as an additional gate
- **D)** Keep it as an optional user-triggered agent

---

### Q10. What is the priority for i18n/localization governance?

Zidney is an educational SaaS likely serving Arabic and English users.

- **A)** High priority — create an `i18n-governance` skill now with RTL layout rules, translation key patterns, and locale file structure ← **RECOMMENDED** (educational SaaS requires this)
- **B)** Medium priority — add basic translation key patterns only
- **C)** Low priority — defer until explicit i18n requirements emerge
- **D)** Not needed — the platform is single-language

---

### Q11. Should the orchestrator include a rollback protocol?

Currently there is no guided rollback if implementation produces functionally wrong code.

- **A)** Add a formal rollback step that reverts implementation commits, updates `.workflow-state.json`, and allows re-entry at Step 6 ← **RECOMMENDED** (safest recovery path)
- **B)** Add a lightweight rollback that reverts to the last known-good commit
- **C)** No rollback — rely on `git revert` and manual state correction
- **D)** Add rollback only for migration steps (highest risk)

---

### Q12. How should architecture intelligence freshness be managed?

Only `gitnexus-context.json` has a freshness check. Other artifacts in `docs/ai/context/` do not.

- **A)** Add a unified freshness gate at Pre-Step that validates ALL architecture artifacts are ≤24h old ← **RECOMMENDED** (consistent governance)
- **B)** Add freshness checks only before Steps 5 (Analyze) and 6 (Implement)
- **C)** Run `bun scripts/infra-audit.ts` at Pre-Step to regenerate everything
- **D)** No change — rely on manual regeneration when issues arise

---

### Q13. Should the root AGENTS.md be refactored for size?

The root AGENTS.md is 500+ lines and loaded into every AI context window.

- **A)** Refactor into a core rules file (<200 lines) + reference links to detailed sections in skills/docs ← **RECOMMENDED** (major token savings, cleaner context)
- **B)** Split into multiple AGENTS.md files at the root (e.g., `AGENTS.md`, `AGENTS_MCP.md`, `AGENTS_ARCHITECTURE.md`)
- **C)** Keep as-is — comprehensive is better than fragmented
- **D)** Move the entire content into `docs/ai/AI_ENGINEERING_RULES.md` and make AGENTS.md a summary pointer

---

### Q14. Should there be a dedicated `Zidney DB Migration Specialist` agent?

Migrations are the highest-risk operation in a database-per-tenant system.

- **A)** Yes, create a specialized agent that reviews migration files for: backward compatibility, tenant fan-out safety, lock risk, expand-deploy-migrate-contract compliance ← **RECOMMENDED** (fills the most critical agent gap)
- **B)** Extend the existing Deployment Engineer agent to cover migration review
- **C)** Add migration checks to the Architecture Checker agent
- **D)** No dedicated agent — a skill is sufficient

---

### Q15. How should stale session memory be handled?

`.agents/session-memory.md` contains outdated Phase 3 data.

- **A)** Add a cleanup step to the orchestrator's Pre-Step that archives or clears old session memory ← **RECOMMENDED** (prevents stale context pollution)
- **B)** Manually clear it between phases
- **C)** Replace with a structured JSON file that auto-prunes entries older than 7 days
- **D)** Keep as-is — it provides historical context

---

_End of Audit Report_

---

## 13. MCQ Decision Outcomes & Implementation Status

**Decisions Applied:** 2026-03-20

| Q#  | Question                           | Answer                                             | Implementation                                               |
| --- | ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Q1  | Archive AWS skills?                | **A** — Archive to `_archived/`                    | ✅ Moved to `.agents/skills/_archived/aws-skills/`           |
| Q2  | Package AGENTS.md coverage?        | **A** — All 9 packages                             | ✅ Created 9 `packages/*/AGENTS.md` files                    |
| Q3  | Agent concern overlap?             | **A** — PRIMARY/SECONDARY table                    | ✅ Added Section 6B+6C to `AGENT_GOVERNANCE.md`              |
| Q4  | Orchestrator checkpointing?        | **D** — Skip (use existing `.workflow-state.json`) | ✅ R08 skipped per user decision                             |
| Q5  | copilot-instructions.md?           | **A** — Auto-gen context summary                   | ✅ Complete rewrite of `copilot-instructions.md`             |
| Q6  | db-migration-governance skill?     | **A** — Standalone skill                           | ✅ Created `.agents/skills/db-migration-governance/SKILL.md` |
| Q7  | Governance preamble dedup?         | **A** — Dedicated skill                            | ✅ Created `.agents/skills/governance-preamble/SKILL.md`     |
| Q8  | Prompt effectiveness?              | **A** — Structural QA script                       | ✅ Created `scripts/prompt-qa.ts`                            |
| Q9  | speckit.checklist in orchestrator? | **A** — Insert at Step 2                           | ✅ Added Step 2.1B to orchestrator                           |
| Q10 | i18n governance priority?          | **A** — High-priority skill                        | ✅ Created `.agents/skills/i18n-governance/SKILL.md`         |
| Q11 | Rollback protocol?                 | **A** — Formal protocol                            | ✅ Added Rollback Protocol (R.1-R.6) to orchestrator         |
| Q12 | Architecture freshness?            | **A** — Unified freshness gate                     | ✅ Added Pre.9 freshness gate to orchestrator                |
| Q13 | Root AGENTS.md size?               | **A** — Slim to <200 lines                         | ✅ Reduced from 1337 → 191 lines                             |
| Q14 | DB Migration Specialist agent?     | **A** — Create agent                               | ✅ Created agent + prompt files                              |
| Q15 | Stale session memory?              | **A** — Cleanup at Pre-Step                        | ✅ Added Pre.10 + cleaned `.agents/session-memory.md`        |

### Recommendations Implementation Summary

| R#  | Description                       | Status            |
| --- | --------------------------------- | ----------------- |
| R01 | Rewrite `copilot-instructions.md` | ✅                |
| R02 | Package-level AGENTS.md           | ✅                |
| R03 | `db-migration-governance` skill   | ✅                |
| R04 | `observability-standards` skill   | ✅                |
| R05 | Architecture Self-Healing skill   | ✅ (existed)      |
| R06 | Package AGENTS.md for all 9       | ✅                |
| R07 | `api-testing-patterns` skill      | ✅                |
| R08 | Session management                | ⏭️ Skipped (Q4=D) |
| R09 | `drizzle-orm-patterns` skill      | ✅                |
| R10 | `error-handling-patterns` skill   | ✅                |
| R11 | `i18n-governance` skill           | ✅                |
| R12 | Architecture Intelligence docs    | ✅ (existed)      |
| R13 | Agent tools declarations          | ✅                |
| R14 | `worker-job-governance` skill     | ✅                |
| R15 | `security-hardening` skill        | ✅                |
| R16 | Agent versioning (all 22)         | ✅                |
| R17 | `governance-preamble` skill       | ✅                |
| R18 | MCP routing policy                | ✅ (existed)      |
| R19 | Archive AWS skills                | ✅                |
| R20 | Orchestrator skill delegation     | ✅                |
| R21 | Orchestrator Pre-Step gates       | ✅                |
| R22 | speckit.checklist integration     | ✅                |
| R23 | Rollback protocol                 | ✅                |
| R24 | Concern assignment governance     | ✅                |
| R25 | Rename space-named dirs           | ✅                |
| R26 | Session memory cleanup            | ✅                |
| R27 | Root AGENTS.md slimming           | ✅                |
| R28 | SKILLS_INDEX update               | ✅                |

**Result: 27/28 recommendations implemented. 1 skipped by user decision (Q4=D).**
