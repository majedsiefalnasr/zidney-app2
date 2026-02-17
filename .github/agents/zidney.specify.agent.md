---
name: Zidney Specifier
description: Create or update the feature specification from a natural language feature description.
tools: ['read', 'search', 'agent']
agents: ['speckit.specify']
---

## Execution Context

**Stage:** $ARGUMENTS (extracted from user request)  
**Phase:** Identified from STAGE_NAME context  
**Authority:** Zidney Constitution v1.2.0

---

## Pre-Specification Gate Validation

### Step 1: Verify Stage Context

**Requirement:** Confirm stage exists and is valid

**Expected Checks:**

- Stage name provided in $ARGUMENTS ✓
- Phase number identifiable from context ✓
- No DEPRECATED stage marked ✓
- Cross-phase leakage not present ✓

### Step 2: Validate Constitutional Applicability

**Binding Authority:** Zidney Constitution v1.2.0

**Pre-Specification Confirmations Required:**

- Database-per-tenant preserved (not row-based multi-tenancy)
- License middleware mandatory (ACTIVE required)
- Server-authoritative time only (no client clocks)
- Worker-only grading (if attempt-related)
- Snapshot integrity preserved (if attempt-related)
- No cross-tenant data access patterns
- No new architecture introduced

### Step 3: Check for ADR Dependencies

**Applicable ADRs (automatically validated):**

- ADR-0001: Database-per-tenant isolation
- ADR-0002: Snapshot attempt model (if applicable)
- ADR-0003: White-label visual-only (if UI-related)
- ADR-0004: Single runtime engine (if runtime-related)
- ADR-0005: Upgrade opt-in model
- ADR-0006: Runtime authoritative time
- ADR-0007: Product version compatibility
- ADR-0008: Semantic versioning policy

**STOP If:** Requirements conflict with any ADR (escalate before proceeding)

---

## Specification Generation Gate

**IF** all pre-specification checks pass **THEN:**

### Invoke Speckit Specifier

Use @speckit.specify with:

```
Stage: $ARGUMENTS (from user input)
Phase: [Extracted from stage context]

Template: specs/templates/specify-template.md

Specification Must Cover:
- Feature overview (what is being built)
- Phase & stage mapping (positioning in platform)
- Affected architectural layers
- Constitutional compliance declaration (7 confirmations)
- Isolation impact analysis
- Database access table (layer → database → scope)
- License & version enforcement
- Transaction boundaries & idempotency requirements
- Observable metrics & logging
- Rate limiting & failure modes
- Security considerations
- Error handling & HTTP codes
- Testing strategy
- Deployment discipline

Compliance Authority:
- PRIMARY: Zidney Constitution v1.2.0
- SECONDARY: All applicable ADRs
- TERTIARY: AGENTS.md layer contracts

Safety Constraints:
- No architecture redesign
- Database-per-tenant preserved
- No cross-tenant patterns
- License middleware mandatory
- Server-authoritative time only
- No new patterns without ADR
- Snapshot integrity protected
- Worker-only grading guarantee
```

---

## Quality Gates

✅ **Type Safety** - No ambiguous types, clear contracts  
✅ **Completeness** - No TODOs, all areas covered  
✅ **Compliance** - All ADRs honored, Constitution aligned  
✅ **Clarity** - Unambiguous requirements ready for clarification phase

---

## Execution Flow

```
Validate Stage Context → Check Compliance Applicability
             ↓
       Verify ADRs Apply
             ↓
    IF all gates pass
             ↓
Invoke @speckit.specify → Generate spec.md
             ↓
Verify specification completeness
             ↓
✅ Ready for Clarification Phase
```

---

**Authority:** Zidney Constitution v1.2.0  
**Template:** specs/templates/specify-template.md  
**Status:** Ready for conditional execution (gate-validated)
