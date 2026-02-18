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

Before executing any step, you MUST collect and confirm:

- STAGE_NAME
- PHASE_NAME
- STAGE_FILE_NAME (the actual filename inside `specs/phases/`, e.g. `STAGE_05_TENANT_PROVISIONING_SERVICE.md`)

Ask the user to provide:

```
Stage:      <STAGE_NAME>
Phase:      <PHASE_NAME>
Stage File: <STAGE_FILE_NAME>
```

Do NOT proceed until all three values are explicitly provided.  
Do NOT assume values.

After confirmation, replace all occurrences of:

- `<STAGE_NAME>`
- `<PHASE_NAME>`
- `<STAGE_FILE_NAME>`

with the confirmed values for the remainder of the workflow.

---

# Pre-Step — Branch & Directory Initialization

Execute this block ONCE before Step 1. Do NOT skip.

## 1. Derive Branch/Directory Name

From `<STAGE_FILE_NAME>`, extract the numeric prefix:

- Strip the leading number segment (everything before the first `_` after the digits).
- Examples:
  - `STAGE_05_TENANT_PROVISIONING_SERVICE.md` → prefix = `05`
  - `STAGE_06A_LICENSE_ENFORCEMENT.md` → prefix = `06A`
- Zero-pad the numeric part to 3 digits; preserve any trailing letter:
  - `05` → `005`
  - `06A` → `006A`
- Convert `<STAGE_NAME>` to kebab-case (lowercase, spaces/underscores → hyphens).
- Combine: `<PADDED_PREFIX>-<kebab-stage-name>`
  - Example: `005-tenant-provisioning-service`

Store as `STAGE_DIR_NAME`.

## 2. Confirm Base Branch

Default base branch is `develop`. Ask the user to confirm or override:

```
Base branch for checkout: develop  ← confirm or provide alternative
```

Do NOT proceed until confirmed.

## 3. Create Git Branch

```bash
git fetch --all --prune
git checkout <BASE_BRANCH>
git pull origin <BASE_BRANCH>
git checkout -b <STAGE_DIR_NAME>
```

If branch already exists, stop and ask the user whether to reuse it or abort.

## 4. Create Stage Directory Structure

```bash
mkdir -p specs/runtime/<STAGE_DIR_NAME>/reports
```

Create a `README.md` stub inside the stage directory:

```markdown
# <STAGE_NAME>

**Branch:** `<STAGE_DIR_NAME>`  
**Phase:** <PHASE_NAME>  
**Stage File:** `specs/phases/<PHASE_NAME>/<STAGE_FILE_NAME>`  
**Initiated:** <ISO_TIMESTAMP>

## Workflow Progress

| Step      | Status  | Report                      |
| --------- | ------- | --------------------------- |
| Specify   | Pending | reports/SPECIFY_REPORT.md   |
| Clarify   | Pending | reports/CLARIFY_REPORT.md   |
| Plan      | Pending | reports/PLAN_REPORT.md      |
| Tasks     | Pending | reports/TASKS_REPORT.md     |
| Analyze   | Pending | reports/ANALYZE_REPORT.md   |
| Implement | Pending | reports/IMPLEMENT_REPORT.md |
| Closure   | Pending | reports/CLOSURE_REPORT.md   |
```

## 5. Initialize workflow-state.json

Write `.workflow-state.json` in the repository root:

```json
{
  "stage": "<STAGE_NAME>",
  "phase": "<PHASE_NAME>",
  "stage_dir": "specs/runtime/<STAGE_DIR_NAME>",
  "stage_file": "specs/phases/<PHASE_NAME>/<STAGE_FILE_NAME>",
  "branch": "<STAGE_DIR_NAME>",
  "base_branch": "<BASE_BRANCH>",
  "current_step": "pre_step",
  "stage_status": "PENDING",
  "clarifications_resolved": false,
  "drift_passed": false,
  "implementation_allowed": false,
  "plan_completed": false,
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [
    {
      "event": "branch_created",
      "branch": "<STAGE_DIR_NAME>",
      "timestamp": "<ISO_TIMESTAMP>"
    }
  ]
}
```

## 6. Update Stage Status Block

Open `specs/phases/<PHASE_NAME>/<STAGE_FILE_NAME>`.  
Add or replace the `## Stage Status` block with:

```markdown
## Stage Status

Status: DRAFT  
Risk Level: UNKNOWN  
Initiated: <ISO_TIMESTAMP>

Scope Open:

- Specification pending

Constitutional Compliance:

- Pending constitutional audit

Notes:
Stage initialized. Specification in progress.
```

STOP. Confirm Pre-Step completion before proceeding to Step 1.

---

# Step 1 — Specify

/handoff to=speckit.specify

```
Stage: <STAGE_NAME>
Phase: <PHASE_NAME>
```

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

## After Specify Completes

### Write SPECIFY_REPORT.md

Create `specs/runtime/<STAGE_DIR_NAME>/reports/SPECIFY_REPORT.md`:

Load specs/templates/reports/specify-report-template.md
Fill from step output and write to specs/runtime/<STAGE_DIR_NAME>/reports/SPECIFY_REPORT.md

### Update Stage Status Block

Open `specs/phases/<PHASE_NAME>/<STAGE_FILE_NAME>` and update `## Stage Status`:

```markdown
## Stage Status

Status: DRAFT  
Risk Level: UNKNOWN  
Last Updated: <ISO_TIMESTAMP>

Scope Defined:

- [Key scope items from spec]

Deferred Scope:

- [Anything explicitly excluded]

Constitutional Compliance:

- Specification drafted — constitutional audit pending

Notes:
Specification complete. Clarification step pending.
```

### Update .workflow-state.json

```json
{
  "current_step": "specify",
  "stage_status": "DRAFT",
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [..., { "event": "specify_complete", "timestamp": "<ISO_TIMESTAMP>" }]
}
```

### Update README.md Progress Table

Mark Specify as `✅ Complete`.

STOP after specify completes.  
Wait for explicit confirmation before continuing.

---

# Step 2 — Clarify (Mandatory)

/handoff to=speckit.clarify

```
Stage: <STAGE_NAME>
```

Clarify specification for ambiguities in:

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

## After Clarify Completes

### Write CLARIFY_REPORT.md

Create `specs/runtime/<STAGE_DIR_NAME>/reports/CLARIFY_REPORT.md`:

Load specs/templates/reports/clarify-report-template.md
Fill from step output and write to specs/runtime/<STAGE_DIR_NAME>/reports/CLARIFY_REPORT.md

### Update Stage Status Block

```markdown
## Stage Status

Status: CLARIFIED  
Risk Level: <LOW / MEDIUM / HIGH>  
Last Updated: <ISO_TIMESTAMP>

Scope Defined:

- [Updated scope after clarifications]

Deferred Scope:

- [Items confirmed out of scope]

Constitutional Compliance:

- Clarifications resolved — planning authorized

Notes:
All specification ambiguities resolved. Ready for technical planning.
```

### Update .workflow-state.json

```json
{
  "current_step": "clarify",
  "stage_status": "CLARIFIED",
  "clarifications_resolved": true,
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [..., { "event": "clarifications_locked", "timestamp": "<ISO_TIMESTAMP>" }]
}
```

### Update README.md Progress Table

Mark Clarify as `✅ Complete`.

STOP until clarifications are resolved.

---

# Step 3 — Plan

/handoff to=speckit.plan

```
Stage: <STAGE_NAME>
```

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

## After Plan Completes

### Write PLAN_REPORT.md

Create `specs/runtime/<STAGE_DIR_NAME>/reports/PLAN_REPORT.md`:

Load specs/templates/reports/plan-report-template.md
Fill from step output and write to specs/runtime/<STAGE_DIR_NAME>/reports/PLAN_REPORT.md

### Update Stage Status Block

```markdown
## Stage Status

Status: PLANNED  
Risk Level: <LOW / MEDIUM / HIGH>  
Last Updated: <ISO_TIMESTAMP>

Scope Planned:

- [Key planned items]

Deferred Scope:

- [Out of scope items]

Constitutional Compliance:

- Technical plan compliant — task generation authorized

Notes:
Technical plan complete. Task breakdown in progress.
```

### Update .workflow-state.json

```json
{
  "current_step": "plan",
  "stage_status": "PLANNED",
  "plan_completed": true,
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [..., { "event": "plan_complete", "timestamp": "<ISO_TIMESTAMP>" }]
}
```

### Update README.md Progress Table

Mark Plan as `✅ Complete`.

STOP after plan completes.

---

# Step 4 — Tasks

/handoff to=speckit.tasks

Generate atomic tasks for:

```
Stage: <STAGE_NAME>
```

Use Zidney Tasks Template `specs/templates/tasks-template.md`

Each task must:

- Be scoped to one layer
- Declare transactional status
- Declare idempotency requirements
- Declare middleware dependency
- Not modify unrelated files
- Preserve isolation guarantees

## After Tasks Completes

### Write TASKS_REPORT.md

Create `specs/runtime/<STAGE_DIR_NAME>/reports/TASKS_REPORT.md`:

Load specs/templates/reports/tasks-report-template.md
Fill from step output and write to specs/runtime/<STAGE_DIR_NAME>/reports/TASKS_REPORT.md

### Update Stage Status Block

```markdown
## Stage Status

Status: TASKS READY  
Risk Level: <LOW / MEDIUM / HIGH>  
Last Updated: <ISO_TIMESTAMP>

Tasks Generated:

- [Total task count]
- [Key task categories]

Deferred Scope:

- [Out of scope items]

Constitutional Compliance:

- Task set compliant — drift analysis required before implementation

Notes:
Atomic task set generated. Drift analysis gate pending.
```

### Update .workflow-state.json

```json
{
  "current_step": "tasks",
  "stage_status": "TASKS READY",
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [..., { "event": "tasks_complete", "timestamp": "<ISO_TIMESTAMP>" }]
}
```

### Update README.md Progress Table

Mark Tasks as `✅ Complete`.

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

STOP unless `drift_passed = true`.

## After Analyze Completes

### Write ANALYZE_REPORT.md

Create `specs/runtime/<STAGE_DIR_NAME>/reports/ANALYZE_REPORT.md`:

Load specs/templates/reports/analyze-report-template.md
Fill from step output and write to specs/runtime/<STAGE_DIR_NAME>/reports/ANALYZE_REPORT.md

### Update Stage Status Block

If APPROVED:

```markdown
## Stage Status

Status: IN PROGRESS  
Risk Level: <LOW / MEDIUM / HIGH>  
Last Updated: <ISO_TIMESTAMP>

Drift Analysis: PASSED  
Implementation: AUTHORIZED

Scope Authorized:

- [Authorized implementation scope]

Constitutional Compliance:

- Drift analysis passed — implementation authorized

Notes:
Architecture drift analysis complete. Implementation gate open.
```

If BLOCKED:

```markdown
## Stage Status

Status: BLOCKED  
Risk Level: <CRITICAL>  
Last Updated: <ISO_TIMESTAMP>

Drift Analysis: FAILED  
Implementation: FORBIDDEN

Violations:

- [List violations]

Notes:
Implementation blocked. Violations must be resolved before proceeding.
```

### Update .workflow-state.json

If APPROVED:

```json
{
  "current_step": "analyze",
  "stage_status": "IN PROGRESS",
  "drift_passed": true,
  "implementation_allowed": true,
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [..., { "event": "drift_analysis_passed", "timestamp": "<ISO_TIMESTAMP>" }]
}
```

If BLOCKED:

```json
{
  "current_step": "analyze",
  "stage_status": "BLOCKED",
  "drift_passed": false,
  "implementation_allowed": false,
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [..., { "event": "drift_analysis_blocked", "timestamp": "<ISO_TIMESTAMP>" }]
}
```

### Update README.md Progress Table

Mark Analyze as `✅ Complete` or `❌ Blocked`.

STOP unless `drift_passed = true`.

---

# Step 6 — Implement

/handoff to=speckit.implement

Use Zidney Implementation Template `specs/templates/implement-template.md`

```
Implement Stage: <STAGE_NAME>
```

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

## After Implement Completes

### Write IMPLEMENT_REPORT.md

Create `specs/runtime/<STAGE_DIR_NAME>/reports/IMPLEMENT_REPORT.md`:

Load specs/templates/reports/implement-report-template.md
Fill from step output and write to specs/runtime/<STAGE_DIR_NAME>/reports/IMPLEMENT_REPORT.md

### Update Stage Status Block

```markdown
## Stage Status

Status: BACKEND CLOSED  
Risk Level: <LOW / MEDIUM / HIGH>  
Last Updated: <ISO_TIMESTAMP>

Implementation: COMPLETE  
Scope Closed:

- [List implemented items]
- [Task count completed]

Deferred Scope:

- [Anything deferred]

Constitutional Compliance:

- ADR alignment verified
- Implementation compliant with Zidney Constitution v1.2.0

Notes:
Backend implementation complete. No structural backend modifications allowed.
```

### Update .workflow-state.json

```json
{
  "current_step": "implement",
  "stage_status": "BACKEND CLOSED",
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [..., { "event": "stage_backend_closed", "timestamp": "<ISO_TIMESTAMP>" }]
}
```

### Update README.md Progress Table

Mark Implement as `✅ Complete`.

STOP after implementation completes.  
Wait for explicit confirmation before proceeding to Closure.

---

# Step 7 — Closure

Execute all sub-steps below in sequence.

## 7.1 — Write CLOSURE_REPORT.md

Create `specs/runtime/<STAGE_DIR_NAME>/reports/CLOSURE_REPORT.md`:

Load specs/templates/reports/closure-report-template.md
Fill from step output and write to specs/runtime/<STAGE_DIR_NAME>/reports/CLOSURE_REPORT.md

---

## 7.2 — Update Stage Status Block (Final)

Open `specs/phases/<PHASE_NAME>/<STAGE_FILE_NAME>` and update `## Stage Status`:

```markdown
## Stage Status

Status: PRODUCTION READY  
Risk Level: <LOW / MEDIUM / HIGH>  
Closure Date: <ISO_DATE>

Scope Closed:

- [All delivered scope items, with task count if applicable]
- [e.g., X/Y tasks completed]
- [e.g., N merge gates passed]

Deferred Scope:

- [Deferred items, or "None"]

Constitutional Compliance:

- ADR-0001 Database-per-tenant isolation enforced
- ADR-0002 Snapshot immutability enforced (if applicable)
- ADR-0006 Server-authoritative time enforced
- ADR-0007 Version compatibility enforced
- ADR-0008 Semantic versioning enforced

Notes:
Stage is production ready. No structural backend modifications allowed.
Modifications require a new migration stage.
```

---

## 7.3 — Update .workflow-state.json (Final)

```json
{
  "stage": "<STAGE_NAME>",
  "phase": "<PHASE_NAME>",
  "stage_dir": "specs/runtime/<STAGE_DIR_NAME>",
  "stage_file": "specs/phases/<PHASE_NAME>/<STAGE_FILE_NAME>",
  "branch": "<STAGE_DIR_NAME>",
  "base_branch": "<BASE_BRANCH>",
  "current_step": "stage_production_ready",
  "stage_status": "PRODUCTION READY",
  "clarifications_resolved": true,
  "drift_passed": true,
  "implementation_allowed": true,
  "plan_completed": true,
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [
    { "event": "branch_created", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "specify_complete", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "clarifications_locked", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "plan_complete", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "tasks_complete", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "drift_analysis_passed", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "stage_backend_closed", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "stage_production_ready", "timestamp": "<ISO_TIMESTAMP>" }
  ]
}
```

---

## 7.4 — Update README.md Progress Table (Final)

Mark all steps as `✅ Complete` and add final status:

```markdown
**Final Status:** 🟢 PRODUCTION READY — <ISO_DATE>
```

---

## 7.5 — Generate Git Commit Message

Output the following commit message for the user to apply:

```
feat(<stage-dir-name>): complete <STAGE_NAME> implementation

Phase: <PHASE_NAME>
Stage: <STAGE_NAME>
Branch: <STAGE_DIR_NAME>
Status: PRODUCTION READY

Scope delivered:
- [Key scope item 1]
- [Key scope item 2]
- [Key scope item 3]

Constitutional compliance:
- Zidney Constitution v1.2.0 enforced throughout
- Drift analysis passed
- All writes transactional
- Idempotency enforced
- Structured logging present

Reports: specs/runtime/<STAGE_DIR_NAME>/reports/
Closes: <STAGE_FILE_NAME>
```

---

## 7.6 — Generate PR Summary

Load specs/templates/pr-template.md
Populate from workflow artifacts and output to user in a markdown code block to be easy to copy

Fill every section from the workflow artifacts (reports, stage file, tasks, implementation output).  
Do not leave placeholder text unfilled.

---

## Closure Complete

Output final summary to the user:

```
✅ Zidney Hard Mode Workflow — COMPLETE

Stage:    <STAGE_NAME>
Phase:    <PHASE_NAME>
Branch:   <STAGE_DIR_NAME>
Status:   PRODUCTION READY

Reports generated:
  specs/runtime/<STAGE_DIR_NAME>/reports/SPECIFY_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/CLARIFY_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/PLAN_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/TASKS_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/ANALYZE_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/IMPLEMENT_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/CLOSURE_REPORT.md

Stage file updated:
  specs/phases/<PHASE_NAME>/<STAGE_FILE_NAME>

Workflow state updated:
  .workflow-state.json → stage_production_ready

Next: Apply git commit message above, then open PR using the generated summary.
```
