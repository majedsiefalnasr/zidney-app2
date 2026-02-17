---
name: Zidney Planner
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
tools: ['read', 'search', 'agent']
agents: ['speckit.plan']
---

## Execution Context

**Stage:** $ARGUMENTS (extracted from user request)  
**Current Phase:** Planning (Step 3: Post-Clarification, Pre-Task-Generation)  
**Authority:** Zidney Constitution v1.2.0

---

## Pre-Planning Gate Validation

### Step 1: Verify Required Artifacts

**Expected Locations:**

- `specs/runtime/{STAGE_NAME}/spec.md` - Specification exists ✓
- `specs/runtime/{STAGE_NAME}/clarify.md` - All clarifications resolved ✓
- `specs/runtime/{STAGE_NAME}/data-model.md` - ER diagrams defined ✓

**Gate Checks:**

- [ ] All 3 artifacts present ✓
- [ ] Specification complete and validated ✓
- [ ] All clarifications marked with resolution status ✓
- [ ] Data model with table schemas defined ✓
- [ ] No unresolved ambiguities ✓

**STOP If:** Any artifact missing or incomplete

### Step 2: Validate Clarification Authority

**Confirm:**

- All clarifications marked with resolution status ✓
- Resolutions traced to ADRs and Constitution ✓
- Implementation patterns provided ✓
- No open questions remain ✓

**STOP If:** Unresolved clarifications exist

---

## Planning Generation Gate

**IF** all pre-planning checks pass **THEN:**

### Invoke Speckit Planner

Use @speckit.plan with:

```
Stage: $ARGUMENTS
Specification: specs/runtime/{STAGE_NAME}/spec.md
Clarifications: specs/runtime/{STAGE_NAME}/clarify.md (all resolved)
DataModel: specs/runtime/{STAGE_NAME}/data-model.md

Template: specs/templates/plan-template.md

Plan Must Cover:

1. Database Layer
   - Complete table schemas (columns, constraints, indexes)
   - Migrations (forward-only, version bumps)
   - Seeds (default data, idempotent)
   - Connection pooling strategy

2. API Layer
   - Route definitions (HTTP method, path, scope)
   - Middleware stack (order, mandatory steps)
   - Transaction wrappers (isolation level, lock strategy)
   - Error handling (HTTP codes, error contract)
   - Input validation (schemas, sanitization)

3. Domain Layer
   - Business logic functions (pure functions only)
   - Shared validation logic
   - Type definitions

4. Frontend Layer
   - Store management (Pinia state)
   - API client/interceptor
   - Page components (no business logic)
   - Router guards (authentication)

5. Observability Layer
   - Structured logging (Pino format)
   - Metrics (Prometheus)
   - Correlation ID propagation
   - Error tracking

6. Testing Strategy
   - Unit tests (domain layer)
   - Integration tests (API layer)
   - Concurrency tests (race conditions)
   - Isolation tests (workspace boundaries)
   - Security tests (input validation, auth)

7. Error Contract Mapping
   - HTTP 401, 403, 423, 426, 429 codes
   - Standard error structure

Compliance Authority:
- PRIMARY: Zidney Constitution v1.2.0
- SECONDARY: All resolved clarifications from clarify.md
- TERTIARY: ADR-0001, 0006, 0007, 0008

Constraint Enforcement:
- No cross-tenant data access
- No direct DB instantiation
- All writes transactional
- Server-authoritative time only
- Version enforcement active
- License middleware mandatory
```

---

## Quality Gates

✅ **Completeness** - All 7 sections covered with code patterns  
✅ **Clarity** - Pseudocode and examples for all patterns  
✅ **Compliance** - All constraints enforced, all clarifications applied  
✅ **Traceability** - All decisions linked to authority  
✅ **Implementability** - Code patterns ready for atomization into tasks

---

## Execution Flow

```
Verify spec.md exists → Verify clarify.md complete (all resolved)
             ↓
    Verify data-model.md defined
             ↓
   Confirm all pre-planning gates
             ↓
  IF all gates pass & no blockers
             ↓
Invoke @speckit.plan → Generate plan.md
             ↓
Verify plan completeness → Check constraint compliance
             ↓
   ✅ Ready for Task Generation Phase
```

---

**Authority:** Zidney Constitution v1.2.0  
**Specification Reference:** specs/runtime/{STAGE_NAME}/spec.md  
**Clarifications Reference:** specs/runtime/{STAGE_NAME}/clarify.md  
**Output:** specs/runtime/{STAGE_NAME}/plan.md  
**Status:** Ready for conditional execution (clarification-validated)
