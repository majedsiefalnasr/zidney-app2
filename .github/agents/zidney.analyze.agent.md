---
name: Zidney Auditor
description: Perform a non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md after task generation.
tools: ['read', 'search', 'agent']
agents: ['speckit.analyze']
---

## Execution Context

**Stage:** $ARGUMENTS (extracted from user request)  
**Current Phase:** Analysis (Step 5: Post-Task-Generation, Pre-Implementation)  
**Authority:** Zidney Constitution v1.2.0

---

## Pre-Analysis Gate Validation

### Step 1: Verify All Artifacts Exist

**Expected Locations:**

- `specs/runtime/{STAGE_NAME}/spec.md` - Specification ✓
- `specs/runtime/{STAGE_NAME}/clarify.md` - All clarifications resolved ✓
- `specs/runtime/{STAGE_NAME}/plan.md` - Implementation plan ✓
- `specs/runtime/{STAGE_NAME}/tasks.md` - Atomic tasks ✓
- `specs/runtime/{STAGE_NAME}/data-model.md` - ER diagrams ✓

**Gate Checks:**

- [ ] All 5 artifacts present ✓
- [ ] Each file non-empty and readable ✓
- [ ] No truncation or formatting errors ✓
- [ ] Ready for cross-artifact analysis ✓

**STOP If:** Any artifact missing

### Step 2: Validate Task Completeness

**Confirm tasks.md Contains:**

- Infrastructure tasks (DB migrations, seeds, versions)
- Domain tasks (business logic, types, validation)
- API tasks (routes, middleware, error handling)
- Frontend tasks (store, pages, components)
- Observability tasks (logging, metrics)
- Testing tasks (unit, integration, concurrency, isolation)
- Security tasks (hardening, validation)
- Deployment tasks (pre-production checklist)

**STOP If:** Critical task categories missing

---

## Analysis Generation Gate

**IF** all artifacts exist and complete **THEN:**

### Invoke Speckit Analyzer

Use @speckit.analyze with:

```
Stage: $ARGUMENTS
Specification: specs/runtime/{STAGE_NAME}/spec.md
Clarifications: specs/runtime/{STAGE_NAME}/clarify.md
Plan: specs/runtime/{STAGE_NAME}/plan.md
Tasks: specs/runtime/{STAGE_NAME}/tasks.md
DataModel: specs/runtime/{STAGE_NAME}/data-model.md

Template: specs/templates/analyze-template.md

Analysis Audit Domains (9 Areas):

1. Scope Validation
   ✓ Phase and stage correct
   ✓ No cross-phase leakage
   ✓ No architecture redesign
   ✓ No implicit feature creep

2. Isolation Audit
   ✓ No cross-tenant joins
   ✓ No shared student tables
   ✓ No direct DB instantiation
   ✓ Tenant resolver on all tenant routes
   ✓ workspace_id validation on every request
   ✓ License middleware present (all workspace APIs)

3. License Enforcement Audit
   ✓ License status validated before DB usage
   ✓ Version compatibility checks included
   ✓ 423/403/426 error handling defined
   ✓ No route bypassing license middleware

4. Transaction Safety Audit
   ✓ All writes wrapped
   ✓ Concurrency guard (FOR UPDATE locks)
   ✓ Rollback defined
   ✓ No race-condition risk

5. Idempotency Audit
   ✓ Idempotency strategy defined
   ✓ Unique constraints defined
   ✓ Replay protection defined
   ✓ Tests included

6. Snapshot Integrity Audit
   ✓ Snapshot frozen at start (if applicable)
   ✓ No grading using live config
   ✓ Worker-only grading

7. Versioning & Migration Audit
   ✓ Migration file defined
   ✓ schema_version bump defined
   ✓ Product version compatibility defined
   ✓ Incompatible requests return 426

8. Observability Audit
   ✓ Structured logging (Pino)
   ✓ correlation_id propagation
   ✓ workspace_slug logging
   ✓ No console.log

9. Security Audit
   ✓ RBAC enforced server-side
   ✓ JWT workspace scope validated
   ✓ Validation using shared package
   ✓ No frontend business logic
   ✓ Email enumeration protected
   ✓ SQL injection prevention (Drizzle)
   ✓ XSS protection (Vue escaping)
   ✓ CORS configured

Cross-Artifact Consistency Checks:

1. spec.md ↔ plan.md Alignment
   ✓ All spec requirements in plan
   ✓ No plan scope creep
   ✓ Plan respects spec boundaries

2. plan.md ↔ tasks.md Coverage
   ✓ All plan sections have tasks
   ✓ No plan items missing tasks
   ✓ Tasks match plan code patterns

3. clarify.md → tasks.md Application
   ✓ All clarifications applied to tasks
   ✓ Concurrency guards per clarification
   ✓ Transaction isolation per clarification
   ✓ Idempotency strategy per clarification

4. ADR Compliance
   ✓ ADR-0001 honored (tenant isolation)
   ✓ ADR-0006 honored (authoritative time)
   ✓ ADR-0007 honored (version compat)
   ✓ ADR-0008 honored (semantic versioning)

Violation Classification:

CRITICAL (BLOCK IMPLEMENTATION):
- Cross-tenant joins
- Direct DB instantiation
- Middleware bypass
- Missing transactions
- License enforcement gaps
- Isolation boundary compromise

HIGH (Escalate):
- Transaction without isolation level
- Idempotency not enforced
- Version enforcement missing
- Security gaps

Compliance Authority:
- PRIMARY: Zidney Constitution v1.2.0
- SECONDARY: All resolved clarifications from clarify.md
- TERTIARY: ADR-0001, 0006, 0007, 0008
```

---

## Quality Gates

✅ **Completeness** - All 9 audit areas covered  
✅ **Traceability** - All violations linked to authority  
✅ **Clarity** - Violations explicitly stated (no vague findings)  
✅ **Actionability** - Clear recommendation (APPROVED or BLOCKED)  
✅ **Compliance** - Artifact alignment verified

---

## Execution Flow

```
Verify all 5 artifacts exist → Validate task completeness
             ↓
Perform 9 audit domains
             ↓
Check spec ↔ plan ↔ tasks alignment
             ↓
Classify any violations (CRITICAL/HIGH/MEDIUM)
             ↓
   IF zero violations
      ↓
    ✅ APPROVED → Ready for Implementation

   ELSE IF violations found
      ↓
    ❌ BLOCKED → Halt, escalate
```

---

**Authority:** Zidney Constitution v1.2.0  
**Reference Artifacts:**

- specs/runtime/{STAGE_NAME}/spec.md
- specs/runtime/{STAGE_NAME}/clarify.md
- specs/runtime/{STAGE_NAME}/plan.md
- specs/runtime/{STAGE_NAME}/tasks.md
- specs/runtime/{STAGE_NAME}/data-model.md

**Output:** specs/runtime/{STAGE_NAME}/analyze.md  
**Critical Output:** **BLOCK IMPLEMENTATION** (if violations found)  
**Status:** Ready for conditional execution (tasks-validated)
