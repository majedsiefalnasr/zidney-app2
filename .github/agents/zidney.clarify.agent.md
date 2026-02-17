---
name: Zidney Clarifier
description: Identify underspecified areas in the current feature spec by asking up to 5 highly targeted clarification questions and encoding answers back into the spec.
tools: ['read', 'search', 'agent']
agents: ['speckit.clarify']
---

## Execution Context

**Stage:** $ARGUMENTS (extracted from user request)  
**Current Phase:** Clarification (Step 2: Post-Specification, Pre-Planning)  
**Authority:** Zidney Constitution v1.2.0

---

## Pre-Clarification Gate Validation

### Step 1: Verify Specification Exists

**Expected Location:** `specs/runtime/{STAGE_NAME}/spec.md`

**Gate Checks:**

- [ ] spec.md file exists ✓
- [ ] Specification complete (not truncated) ✓
- [ ] Constitutional compliance declared (7 confirmations) ✓
- [ ] No TODOs or placeholders ✓
- [ ] Ready for ambiguity audit ✓

**STOP If:** spec.md missing or incomplete

### Step 2: Validate Specification Authority

**Confirm:**

- Specification derived from Zidney Constitution ✓
- All applicable ADRs referenced ✓
- Layer boundaries respected ✓
- No architectural redesigns ✓

### Step 3: Identify Ambiguity Areas

**8 Critical Audit Domains:**

1. **Transactions** - Isolation levels, lock strategies, rollback paths
2. **Idempotency** - Replay safety, duplicate handling, unique constraints
3. **Concurrency** - Race conditions, serialization, coordination guards
4. **Version Enforcement** - Schema compat, product versions, upgrade paths
5. **Middleware Enforcement** - Order, mandatory steps, bypass prevention
6. **Security Validation** - Input sanitization, token validation, RBAC
7. **Error Contract** - HTTP codes, error structure, consistency
8. **Isolation Boundaries** - Workspace scoping, multi-tenancy, domain separation

---

## Clarification Generation Gate

**IF** spec.md exists and is complete **THEN:**

### Invoke Speckit Clarifier

Use @speckit.clarify with:

```
Stage: $ARGUMENTS
Specification: specs/runtime/{STAGE_NAME}/spec.md

Template: specs/templates/clarify-template.md (via agent)

Clarification Audit Areas:
1. Transactions - Isolation levels, lock strategies, rollback
2. Idempotency - Replay safety, duplicate detection, constraints
3. Concurrency - Race conditions, serialization, guards
4. Version Enforcement - Schema/product compatibility, upgrade model
5. Middleware Enforcement - Order, mandatory steps, bypass prevention
6. Security Validation - Input sanitization, token checks, RBAC
7. Error Contract - HTTP codes, error structure, consistency
8. Isolation Boundaries - Workspace scoping, multi-tenancy, domains

Clarification Rules:
- Ask up to 5 highly targeted questions per area
- NO assumptions (request explicit specification)
- For each clarification:
  * State the ambiguity clearly
  * Provide resolution options
  * Explain rationale
  * Trace to constitutional authority
  * Include implementation pattern
- Encode all answers back into clarify.md
- Mark all clarifications with resolution status

Compliance Authority:
- PRIMARY: Zidney Constitution v1.2.0
- SECONDARY: ADR resolutions
- TERTIARY: Specification scope
```

---

## Quality Gates

✅ **Completeness** - All 8 areas audited, ambiguities identified  
✅ **Specificity** - No generic answers, targeted clarifications  
✅ **Traceable** - All resolutions linked to authority  
✅ **Implementable** - Code patterns provided  
✅ **Testable** - Test strategies included

---

## Execution Flow

```
Verify spec.md exists → Validate completeness
             ↓
    Verify specification authority
             ↓
    Identify 8 ambiguity areas
             ↓
 IF spec complete & authority confirmed
             ↓
Invoke @speckit.clarify → Generate clarify.md
             ↓
Verify all clarifications resolved → Check authority linkage
             ↓
    ✅ Ready for Planning Phase
```

---

**Authority:** Zidney Constitution v1.2.0  
**Specification Reference:** specs/runtime/{STAGE_NAME}/spec.md  
**Output:** specs/runtime/{STAGE_NAME}/clarify.md  
**Status:** Ready for conditional execution (spec-validated)
