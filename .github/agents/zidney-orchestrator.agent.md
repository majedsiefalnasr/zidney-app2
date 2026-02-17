---
name: Zidney Orchestrator
description: Execute full SpecKit Hard Mode workflow sequentially with strict Zidney Constitution enforcement.
---

## Execution Context

**Stage:** $ARGUMENTS (extracted from user request)  
**Current Phase:** Analysis (Step 5: Post-Task-Generation, Pre-Implementation)  
**Authority:** Zidney Constitution v1.2.0

---

## Zidney Hard Mode Orchestrator

You must execute the following stages in strict order.  
Do NOT skip stages.  
Do NOT proceed if a stage blocks.

Zidney Constitution v1.2.0 is binding authority.

---

# Required Intake (Do NOT Skip)

Before executing Step 1, you MUST collect and confirm:

- STAGE_NAME
- PHASE_NUMBER

Ask the user to provide:

Stage: <STAGE_NAME>
Phase: <PHASE_NUMBER>

Do NOT proceed until both values are explicitly provided.
Do NOT assume values.

After confirmation, replace all occurrences of:

- <STAGE_NAME>
- <PHASE_NUMBER>

with the confirmed values for the remainder of the workflow.

---

---

# Step 1 — Specify

/handoff to=speckit.specify

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

STOP after specify completes.
Wait for explicit confirmation before continuing.

---

# Step 2 — Clarify (Mandatory)

/handoff to=speckit.clarify

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

All ambiguities must be resolved before planning.

STOP until clarifications are resolved.

---

# Step 3 — Plan

/handoff to=speckit.plan

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

If plan modifies architecture → STOP.

STOP after plan completes.

---

# Step 4 — Tasks

/handoff to=speckit.tasks

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

STOP after tasks generation.

---

# Step 5 — Analyze (Drift Detector)

/handoff to=speckit.analyze

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

STOP unless drift_passed = true.

---

# Step 6 — Implement

/handoff to=speckit.implement

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
