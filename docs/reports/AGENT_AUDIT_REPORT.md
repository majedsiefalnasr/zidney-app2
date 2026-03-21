# Agent Audit Report & Restructuring Proposal

**Date**: 2026-03-21  
**Scope**: `.agents/agents/` (13 existing) + `.agents/new agents/` (8 new)  
**Goal**: Deduplicate, rename (remove `zidney-` prefix), merge overlapping agents, update orchestrator

---

## 1. Inventory Summary

### Existing Agents (`.agents/agents/`)

| #   | Current File                              | Name                           | Focus                                                          |
| --- | ----------------------------------------- | ------------------------------ | -------------------------------------------------------------- |
| 1   | `zidney-orchestrator.agent.md`            | Zidney Orchestrator            | Workflow controller, skill delegation, SpecKit sequencing      |
| 2   | `zidney-api-designer.agent.md`            | Zidney API Designer            | API contract design, versioning, pagination, idempotency       |
| 3   | `zidney-architecture-checker.agent.md`    | Zidney Architecture Checker    | DDD validation, modular boundaries, SOLID, event-driven        |
| 4   | `zidney-cicd-automation.agent.md`         | Zidney CI/CD Automation        | GitHub Actions pipelines, security scanning, deploy gates      |
| 5   | `zidney-code-reviewer.agent.md`           | Zidney Code Reviewer           | PR review, tenant safety, DDD integrity, observability         |
| 6   | `zidney-db-migration-specialist.agent.md` | Zidney DB Migration Specialist | Migration review, lock risk, tenant fan-out, Drizzle alignment |
| 7   | `zidney-deployment-engineer.agent.md`     | Zidney Deployment Engineer     | Zero-downtime deploy, blue/green, canary, rollback             |
| 8   | `zidney-docker-specialist.agent.md`       | Zidney Docker Specialist       | Multi-stage builds, hardened images, API/worker separation     |
| 9   | `zidney-frontend-developer.agent.md`      | Zidney Frontend Developer      | Tenant-aware UI, RBAC routing, exam engine UI, Vue 3           |
| 10  | `zidney-performance-optimizer.agent.md`   | Zidney Performance Optimizer   | SLO enforcement, concurrency modeling, query perf              |
| 11  | `zidney-qa-engineer.agent.md`             | Zidney QA Engineer             | Test strategy, tenant isolation tests, risk-based coverage     |
| 12  | `zidney-refactoring-specialist.agent.md`  | Zidney Refactoring Specialist  | Safe refactoring, behavior preservation, coupling reduction    |
| 13  | `zidney-security-auditor.agent.md`        | Zidney Security Auditor        | OWASP, tenant isolation, JWT hardening, replay protection      |

_(Plus 9 SpecKit agents, which are out of scope for this audit)_

### New Agents (`.agents/new agents/`)

| #   | File                           | Name                      | Focus                                                        |
| --- | ------------------------------ | ------------------------- | ------------------------------------------------------------ |
| N1  | `code-reviewer.md`             | Code Reviewer             | Generic code review (correctness, security, maintainability) |
| N2  | `database-optimizer.md`        | Database Optimizer        | Schema design, query optimization, indexing, N+1 prevention  |
| N3  | `devops-automator.md`          | DevOps Automator          | CI/CD pipelines, IaC (Terraform), monitoring, cloud ops      |
| N4  | `git-workflow-master.md`       | Git Workflow Master       | Git branching, conventional commits, rebase, worktrees       |
| N5  | `security-engineer.md`         | Security Engineer         | Threat modeling, STRIDE, OWASP, secure code review           |
| N6  | `software-architect.md`        | Software Architect        | System design, DDD, ADRs, trade-off analysis                 |
| N7  | `technical-writer.md`          | Technical Writer          | Developer docs, API refs, READMEs, tutorials                 |
| N8  | `threat-detection-engineer.md` | Threat Detection Engineer | SIEM rules, MITRE ATT&CK, threat hunting, detection-as-code  |

---

## 2. Overlap & Duplication Analysis

### HIGH OVERLAP (conflicting agents)

| Old Agent                                                                             | New Agent                   | Overlap Areas                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Code Reviewer** (#5)                                                                | **Code Reviewer** (N1)      | Both review code for correctness, security, maintainability. Old one is Zidney-specific (tenant, DDD, idempotency). New one is generic (priority markers, educational tone).                          |
| **Security Auditor** (#13)                                                            | **Security Engineer** (N5)  | Both cover OWASP Top 10, auth/authz, input validation, CI security scanning. Old is Zidney-specific (tenant isolation, exam replay). New adds STRIDE threat modeling, CSP headers, generic hardening. |
| **Architecture Checker** (#3)                                                         | **Software Architect** (N6) | Both validate DDD, module boundaries, SOLID. Old enforces Zidney rules. New adds ADR authoring, trade-off analysis, architecture selection guidance.                                                  |
| **CI/CD Automation** (#4) + **Deployment Engineer** (#7) + **Docker Specialist** (#8) | **DevOps Automator** (N3)   | Massive overlap. Old agents split into 3 narrowly scoped files. New one covers all 3 (CI/CD + deploy + Docker + IaC + monitoring) generically.                                                        |

### MODERATE OVERLAP

| Old Agent                        | New Agent                   | Overlap Areas                                                                                                                                                                              |
| -------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **DB Migration Specialist** (#6) | **Database Optimizer** (N2) | Both deal with PostgreSQL. Old focuses on migration safety/governance. New focuses on query performance/indexing/schema design. Complementary but overlapping on migration best practices. |

### NO OVERLAP (unique new agents)

| New Agent                          | Unique Value                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Git Workflow Master** (N4)       | Git branching strategies, conventional commits, rebase workflows. Currently delegated to `git-governance` skill — no agent for it.         |
| **Technical Writer** (N7)          | Documentation, README standards, tutorials. No existing agent covers this.                                                                 |
| **Threat Detection Engineer** (N8) | SIEM rule writing, MITRE ATT&CK, threat hunting. Very specialized SOC content — may not be needed for Zidney (a SaaS platform, not a SOC). |

---

## 3. Redundancy with Skills

Several existing agents duplicate logic that already exists in skills:

| Agent                        | Overlapping Skill(s)                              | Issue                                                          |
| ---------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| DB Migration Specialist (#6) | `db-migration-governance`, `drizzle-orm-patterns` | Agent repeats ~80% of skill rules                              |
| Security Auditor (#13)       | `security-hardening`                              | Agent repeats OWASP/tenant rules also in skill                 |
| Code Reviewer (#5)           | `api-testing-patterns`, `error-handling-patterns` | Agent partially duplicates error contract and testing patterns |
| Git Workflow Master (N4)     | `git-governance`                                  | New agent duplicates existing skill almost entirely            |

---

## 4. Structural Issues in Existing Agents

1. **Repeated governance boilerplate** — Every agent has ~15 lines of identical GOVERNANCE DECLARATION and Routing Authority. Should reference `governance-preamble` skill instead.
2. **Repeated Zidney context** — Every agent repeats "multi-tenant B2B2C Educational SaaS" identity block. Should be inherited from orchestrator context.
3. **Repeated non-negotiable rules** — Tenant isolation, RBAC, idempotency, observability rules are copy-pasted across 10+ agents. These belong in skills.
4. **New agents are generic** — None of the 8 new agents reference Zidney, tenant isolation, exam engine, or the governance framework. They need to be adapted.

---

## 5. MCQ Decisions (Your Choices Needed)

Please answer each question by providing the letter of your chosen option.

---

### Q1: Code Reviewer — Merge Strategy

The old `zidney-code-reviewer` is Zidney-domain-specific (tenant, DDD, idempotency). The new `code-reviewer` is generic but has a better educational tone and priority system (blocker/suggestion/nit).

- **A) MERGE both into one `code-reviewer.agent.md`** — Combine the Zidney-specific rules with the new agent's tone/format. Single agent for all code review. _(Recommended)_
- **B) KEEP old only** — Discard the new generic one. Keep Zidney-specific code reviewer.
- **C) KEEP both** — Have a generic code reviewer and a Zidney-specific one (more agents to maintain).

---

### Q2: Security — Merge or Split?

Old: `zidney-security-auditor` (Zidney tenant/exam-specific). New: `security-engineer` (generic STRIDE/OWASP). New: `threat-detection-engineer` (SIEM/MITRE ATT&CK).

- **A) MERGE security-auditor + security-engineer into one `security-auditor.agent.md`**. Drop `threat-detection-engineer` entirely (SOC tooling is out of scope for a SaaS dev team). _(Recommended)_
- **B) MERGE all three** into one large security agent.
- **C) KEEP security-auditor + security-engineer as separate agents**. Drop threat-detection-engineer.
- **D) KEEP all three** as separate agents.

---

### Q3: DevOps — Consolidate CI/CD + Deployment + Docker?

Currently 3 separate old agents: `cicd-automation`, `deployment-engineer`, `docker-specialist`. New agent `devops-automator` covers all three generically.

- **A) CONSOLIDATE all into one `devops-engineer.agent.md`** — Merge the Zidney-specific rules from all 3 old agents + new agent into a single DevOps agent. _(Recommended)_
- **B) CONSOLIDATE into 2**: `cicd-engineer.agent.md` (pipelines + deploy) and `docker-specialist.agent.md` (containers only).
- **C) KEEP all 3 old agents** + discard new one.
- **D) KEEP all 4** — Maximum granularity.

---

### Q4: Architecture — Merge Strategy

Old: `zidney-architecture-checker` (validation/enforcement). New: `software-architect` (design guidance, ADRs, trade-offs).

- **A) MERGE into one `architecture-guardian.agent.md`** — Combine enforcement + design guidance. Single architecture authority. _(Recommended)_
- **B) KEEP both** as `architecture-checker.agent.md` (enforcement) and `software-architect.agent.md` (design).
- **C) KEEP old only** — Architecture Checker is sufficient; design guidance is orchestrator's job.

---

### Q5: Database — Merge or Keep Separate?

Old: `db-migration-specialist` (migration governance). New: `database-optimizer` (performance, indexing, queries).

- **A) MERGE into one `database-engineer.agent.md`** — Combined migration governance + perf optimization. _(Recommended)_
- **B) KEEP both** as `db-migration-specialist.agent.md` and `database-optimizer.agent.md` — Different concerns.
- **C) KEEP old only** — Migration specialist is sufficient; perf is handled by `performance-optimizer`.

---

### Q6: Git Workflow Master — Absorb into Skill or Keep?

New `git-workflow-master` overlaps heavily with existing `git-governance` skill. No agent currently exists for git workflows.

- **A) DROP the new agent** — The `git-governance` skill already covers this. No separate agent needed. _(Recommended)_
- **B) KEEP as `git-workflow-master.agent.md`** — Useful for teams that want to ask specifically about Git strategy.
- **C) MERGE into orchestrator** — Add git workflow guidance to orchestrator.

---

### Q7: Technical Writer — Keep?

No existing agent or skill covers documentation. The new `technical-writer` would be unique.

- **A) KEEP as `technical-writer.agent.md`** — Useful for README, API docs, tutorials. _(Recommended)_
- **B) DROP** — Documentation is the developer's job; an agent isn't needed.
- **C) CONVERT to a skill** instead of an agent (lighter footprint).

---

### Q8: Frontend Developer — Keep or Consolidate?

Old `zidney-frontend-developer` covers tenant-aware UI, RBAC routing, exam engine safeguards, performance budgets.

- **A) KEEP as `frontend-developer.agent.md`** (renamed, no `zidney-` prefix). No new agent competes with it. _(Recommended)_
- **B) MERGE with Refactoring Specialist** — Frontend + refactoring are related for UI work.

---

### Q9: Performance Optimizer — Keep or Consolidate?

Old `zidney-performance-optimizer` covers SLO enforcement, concurrency modeling, worker/queue perf.

- **A) KEEP as `performance-optimizer.agent.md`** (renamed). Unique enough to standalone. _(Recommended)_
- **B) MERGE into QA Engineer** — Performance testing is a subset of QA.
- **C) MERGE into Database Engineer** — Most perf issues are DB-related.

---

### Q10: QA Engineer — Keep or Consolidate?

Old `zidney-qa-engineer` covers risk-based coverage, tenant isolation tests, exam engine testing, migration regression.

- **A) KEEP as `qa-engineer.agent.md`** (renamed). Unique enough to standalone. _(Recommended)_
- **B) MERGE with Code Reviewer** — Review and testing are closely related.

---

### Q11: Refactoring Specialist — Keep?

Old `zidney-refactoring-specialist` focuses on safe structural improvement. Overlaps with code reviewer (both check tenant safety, DDD, idempotency).

- **A) MERGE into Code Reviewer** — Refactoring is a subset of code review. _(Recommended)_
- **B) KEEP as `refactoring-specialist.agent.md`** — Refactoring needs its own specialized workflow.

---

### Q12: API Designer — Keep?

Old `zidney-api-designer` covers contract-first API design, versioning, pagination, error format, idempotency.

- **A) KEEP as `api-designer.agent.md`** (renamed). It's specialized enough. _(Recommended)_
- **B) MERGE with Architecture Guardian** — API design is part of architecture.

---

### Q13: Governance Boilerplate — How to Handle?

Every agent has ~15 lines of repeated governance declaration. Current approach: copy-paste everywhere.

- **A) REFERENCE governance-preamble skill** — Replace boilerplate with a single `See: .agents/skills/governance-preamble/SKILL.md` line. _(Recommended)_
- **B) KEEP as-is** — Redundancy ensures each agent is self-contained.

---

### Q14: Agent Naming Convention

Currently `zidney-{role}.agent.md`. Proposal is to remove the `zidney-` prefix.

- **A) `{role}.agent.md`** — e.g., `code-reviewer.agent.md`, `api-designer.agent.md`. _(Recommended)_
- **B) `zidney-{role}.agent.md`** — Keep the prefix for brand identity.

---

## 6. Proposed Final Agent Set (Based on Recommended Answers)

If all recommended answers are chosen, the final set would be:

| #   | File                             | Name                  | Sources                                                                                      |
| --- | -------------------------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| 1   | `orchestrator.agent.md`          | Orchestrator          | Restructured from `zidney-orchestrator`                                                      |
| 2   | `code-reviewer.agent.md`         | Code Reviewer         | Merged: old code-reviewer + new code-reviewer + old refactoring-specialist                   |
| 3   | `security-auditor.agent.md`      | Security Auditor      | Merged: old security-auditor + new security-engineer                                         |
| 4   | `devops-engineer.agent.md`       | DevOps Engineer       | Merged: old cicd-automation + deployment-engineer + docker-specialist + new devops-automator |
| 5   | `architecture-guardian.agent.md` | Architecture Guardian | Merged: old architecture-checker + new software-architect                                    |
| 6   | `database-engineer.agent.md`     | Database Engineer     | Merged: old db-migration-specialist + new database-optimizer                                 |
| 7   | `frontend-developer.agent.md`    | Frontend Developer    | Renamed from old frontend-developer                                                          |
| 8   | `performance-optimizer.agent.md` | Performance Optimizer | Renamed from old performance-optimizer                                                       |
| 9   | `qa-engineer.agent.md`           | QA Engineer           | Renamed from old qa-engineer                                                                 |
| 10  | `api-designer.agent.md`          | API Designer          | Renamed from old api-designer                                                                |
| 11  | `technical-writer.agent.md`      | Technical Writer      | New: adapted from new technical-writer                                                       |

**Total: 11 agents** (down from 13 old + 8 new = 21)

### Agents Removed/Absorbed

- `zidney-refactoring-specialist` → absorbed into `code-reviewer`
- `zidney-cicd-automation` → absorbed into `devops-engineer`
- `zidney-deployment-engineer` → absorbed into `devops-engineer`
- `zidney-docker-specialist` → absorbed into `devops-engineer`
- `git-workflow-master` → covered by `git-governance` skill
- `threat-detection-engineer` → dropped (SOC tooling, out of scope)
- `devops-automator` (new) → absorbed into `devops-engineer`
- `software-architect` (new) → absorbed into `architecture-guardian`
- `security-engineer` (new) → absorbed into `security-auditor`
- `code-reviewer` (new) → absorbed into `code-reviewer`
- `database-optimizer` (new) → absorbed into `database-engineer`

---

## 7. Next Steps

1. Reply with your letter choices for Q1–Q14
2. I will generate all agent files based on your decisions
3. Update `orchestrator.agent.md` with the new agent references
4. Delete removed/deprecated agent files
5. Remove the `.agents/new agents/` directory
