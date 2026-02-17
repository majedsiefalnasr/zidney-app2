---
name: Zidney Orchestrator
description: Generates atomic implementation tasks for the Zidney tenant baseline schema.
tools: ['read', 'search', 'agent']
agents: ['speckit.tasks']
---

## Execution Context

**Stage:** $ARGUMENTS (extracted from user request)  
**Current Phase:** Task Generation (Step 4: Post-Planning, Pre-Analysis)
**Authority:** Zidney Constitution v1.2.0

---

## Pre-Task-Generation Gate Validation

### Step 1: Verify Required Artifacts

**Expected Locations:**

- `specs/runtime/{STAGE_NAME}/spec.md` - Specification ✓
- `specs/runtime/{STAGE_NAME}/clarify.md` - All clarifications resolved ✓
- `specs/runtime/{STAGE_NAME}/plan.md` - Implementation plan ✓
- `specs/runtime/{STAGE_NAME}/data-model.md` - ER diagrams ✓

**Gate Checks:**

- [ ] All 4 artifacts present ✓
- [ ] Specification complete and validated ✓
- [ ] All clarifications marked with resolution status ✓
- [ ] Plan complete with code patterns ✓

**STOP If:** Any artifact missing or incomplete

### Step 2: Validate Plan Completeness

**Confirm Plan Covers:**

- Database migrations (DDL scripts)
- API routes (HTTP contracts)
- Middleware stack (order and dependencies)
- Domain functions (business logic patterns)
- Frontend components (store, UI, routing)
- Observability (logging, metrics)
- Testing strategy (all test tiers)
- Error contract mapping (HTTP codes)
- Transaction patterns (isolation levels, locks)
- Security hardening (rate limiting, hashing, RBAC)
- Version enforcement (schema + product version)
- Concurrency guards (race condition prevention)

**STOP If:** Plan missing any section or lacks implementation patterns

---

## Task Generation Gate

**IF** all pre-task-generation checks pass **THEN:**

### Invoke Speckit Tasks Orchestrator

Use @speckit.tasks with:

```
Stage: $ARGUMENTS
Specification: specs/runtime/{STAGE_NAME}/spec.md
Clarifications: specs/runtime/{STAGE_NAME}/clarify.md (all resolved)
Plan: specs/runtime/{STAGE_NAME}/plan.md
DataModel: specs/runtime/{STAGE_NAME}/data-model.md

Template: specs/templates/tasks-template.md

Task Generation Requirements:

1. Task Categorization (8 categories):
   - Infrastructure (DDL migrations, schema, versions, seeds)
   - Domain (Business logic, crypto, RBAC, types)
   - API (Routes, middleware, validation, error handling)
   - Frontend (Store, interceptor, pages, router guards)
   - Observability (Logging, metrics, correlation IDs)
   - Testing (Unit, integration, concurrency, isolation, security)
   - Security (Hardening, checks, validation)
   - Deployment (Pre-production, runbooks, verification)

2. Task Atomicity:
   - Each task modifies ONE logical unit
   - File path EXACTLY specified
   - Layer clearly identified (Infrastructure/API/Frontend/etc.)
   - Dependencies explicitly declared

3. Task Specification:
   Each task MUST declare:
   - File path (absolute)
   - Layer (from 8 categories)
   - Transactional requirement (YES/NO + type)
   - Idempotency requirement (YES/NO + strategy)
   - Version enforcement (YES/NO + which versions)
   - License middleware (YES/NO)
   - Acceptance criteria (checklist)

4. Task Sequencing (Dependency Order):
   Infrastructure → Domain → API + Frontend
                              ↓
                        Observability
                              ↓
                            Testing
                              ↓
                           Security
                              ↓
                         Deployment

5. Hard Enforcement Rules:
   - NO vague tasks
   - NO write without transaction task
   - NO middleware bypass possible
   - NO frontend business logic
   - NO grading in auth layer
   - NO cross-tenant queries
   - NO console.log in tasks
   - NO TODOs in pseudo-code

Compliance Authority:
- PRIMARY: Zidney Constitution v1.2.0
- SECONDARY: All resolved clarifications from clarify.md (applied to every task)
- TERTIARY: ADR-0001, 0006, 0007, 0008
```

---

## Quality Gates

✅ **Atomicity** - Each task is single, indivisible unit  
✅ **Specificity** - No vague tasks, exact file paths  
✅ **Completeness** - All requirements from plan implemented  
✅ **Sequencing** - Dependency order respected  
✅ **Testability** - Acceptance criteria clear and verifiable  
✅ **Compliance** - All constraints enforced, all clarifications applied

---

## Execution Flow

```
Verify spec.md, clarify.md, plan.md → Verify plan completeness
             ↓
   IF all gates pass & no blockers
             ↓
Invoke @speckit.tasks → Generate tasks.md
             ↓
Verify task atomicity → Check constraint compliance
             ↓
Count tasks → Verify sequencing → Check acceptance criteria
             ↓
      ✅ Ready for Analysis Phase
```

---

**Authority:** Zidney Constitution v1.2.0  
**Specification Reference:** specs/runtime/{STAGE_NAME}/spec.md  
**Plan Reference:** specs/runtime/{STAGE_NAME}/plan.md  
**Output:** specs/runtime/{STAGE_NAME}/tasks.md  
**Estimated Task Count:** 40-60 atomic tasks  
**Status:** Ready for conditional execution (plan-validated)
