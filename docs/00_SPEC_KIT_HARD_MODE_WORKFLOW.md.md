# Zidney — SpecKit Hard Mode Workflow (Authoritative Guide)

Version: 1.0
Applies To: All Phases and Stages
Authority: Constitution v1.2.0

---

## Purpose

This document defines the mandatory SpecKit execution order for Zidney.

No stage may be implemented outside this workflow.
No shortcuts allowed.

---

## Execution Order (Hard Mode)

1. /speckit.specify
2. /speckit.clarify (mandatory)
3. /speckit.plan
4. /speckit.tasks
5. /speckit.analyze (mandatory drift check)
6. /speckit.implement
7. Manual validation checklist

Skipping any step is considered a governance violation.

---

## Step 1 — /speckit.specify

### Objective

Define WHAT must be built.

### Prompt Template

```
Stage: <STAGE_NAME>
Phase: <PHASE_NUMBER>

Use Zidney Constitution v1.2.0 as binding authority.
Use Zidney Specify Template `specs/templates/specify-template.md`

Define strict functional requirements.

Constraints:
- No architecture redesign
- Database-per-tenant preserved
- License middleware mandatory
- Server-authoritative time only
- Worker-only grading (if applicable)
- Snapshot integrity preserved (if attempt-related)
- All writes transactional
- Idempotency required for critical endpoints
- Version compatibility enforced

Do not introduce new patterns.
If ADR required, stop and request it.
```

---

## Step 2 — /speckit.clarify (Mandatory)

### Objective

Remove ambiguity before planning.

### Prompt Template

```
Clarify specification for:
Stage: <STAGE_NAME>

Audit ambiguities in:
- Transactions
- Idempotency
- Concurrency
- Version enforcement
- Middleware enforcement
- Security validation
- Error contract
- Isolation boundaries

List explicit clarification questions.
Do not assume.
```

All ambiguities must be resolved before planning.

---

## Step 3 — /speckit.plan

### Objective

Define HOW implementation works.

### Prompt Template

```
Stage: <STAGE_NAME>

Use Zidney Plan Template `specs/templates/plan-template.md`

Create technical implementation plan including:
- Tables / schema changes
- Migrations
- Endpoints
- Middleware layers
- Transaction boundaries
- Idempotency strategy
- Concurrency guard strategy
- Version enforcement logic
- Error code mapping
- Logging requirements
- Worker interaction (if applicable)

Constraints:
- No cross-tenant logic
- No direct DB instantiation
- All writes transactional
- Server authoritative time only
- Version compatibility required
```

If plan modifies architecture → STOP.

---

## Step 4 — /speckit.tasks

### Objective

Break plan into atomic implementation tasks.

### Prompt Template

```
Generate atomic tasks for:
Stage: <STAGE_NAME>

Use Zidney Tasks Template `specs/templates/tasks-template.md`

Each task must:
- Be scoped to one layer
- Declare transactional status
- Declare idempotency requirements
- Declare middleware dependency
- Not modify unrelated files
- Preserve isolation guarantees
```

---

## Step 5 — /speckit.analyze (Drift Detector)

### Objective

Prevent architectural violations.

### Prompt Template

```
Use Zidney Analyze Template `specs/templates/analyze-template.md`

Audit tasks and plan for:
- Isolation violations
- License middleware bypass
- Snapshot integrity break
- Missing transactions
- Missing idempotency
- Version enforcement gaps
- Authority violations (API vs Worker)
- Logging deficiencies
- Security violations

If violation found → BLOCK implementation.
```

---

## Step 6 — /speckit.implement

### Objective

Generate safe implementation.

### Prompt Template

```
Use Zidney Implementation Template `specs/templates/implement-template.md`

Implement Stage: <STAGE_NAME>

Rules:
- Modify only relevant files
- Use tenant resolver only
- No direct DB instantiation
- All writes transactional
- Idempotency enforced
- Structured logging required
- Correlation ID required
- No business logic in frontend
- No stack traces to client

If conflict with Constitution → STOP.
```

---

## Post-Implementation Validation

Mandatory manual checklist:

- TypeScript strict passes
- ESLint passes
- Migration version incremented
- schema_version updated
- License middleware verified
- Idempotency replay tested
- Concurrency tested
- 403 / 423 / 426 paths validated
- Logs structured
- No cross-tenant leakage

---

## Immediate Stop Conditions

Stop implementation if:

- Shared DB suggested
- Row-based tenancy suggested
- Grading moved to API
- Snapshot removed
- Client time trusted
- Transaction skipped
- Idempotency skipped
- License middleware bypassed
- Architecture modified without ADR

---

## Final Rule

Constitution > Specs > Plan > Tasks > Code

If code conflicts with Constitution,
code must change — not the Constitution.
