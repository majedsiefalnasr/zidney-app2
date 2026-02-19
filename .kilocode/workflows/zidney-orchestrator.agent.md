---
name: Zidney Orchestrator
description: Execute full SpecKit Hard Mode workflow sequentially with strict Zidney Constitution enforcement.
---

# GOVERNANCE DECLARATION

Governed by: Zidney Agent Governance v1.0  
Workflow Authority: Zidney Orchestrator  
Architectural Authority: Zidney Constitution v1.2.0  
Lifecycle Mutation: Forbidden  
Verdict Semantics (if enforcing): PASS | BLOCKED

This agent MUST comply with all binding rules defined in `docs/AGENT_GOVERNANCE.md`.

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

### Automatic Continuation Rule

After completing each sub-step, evaluate the following gate before proceeding:

- Are there unresolved [NEEDS CLARIFICATION] markers? → STOP and present them
- Are there constitutional violations? → STOP and list them
- Are there ambiguities that affect the next step? → STOP and ask
- Are there missing required inputs? → STOP and request them

If none of the above apply → **proceed automatically to the next sub-step or step.**

Hard STOPs only occur when something genuinely blocks progress or requires human judgment.

---

# Required Intake

Before executing any step, collect and confirm:

- `STAGE_NAME`
- `PHASE_NAME`
- `STAGE_FILE_NAME` (actual filename inside `specs/phases/<PHASE_NAME>/`, e.g. `STAGE_05_TENANT_PROVISIONING_SERVICE.md`)

Ask the user:

```
Stage:      <STAGE_NAME>
Phase:      <PHASE_NAME>
Stage File: <STAGE_FILE_NAME>
```

Do NOT proceed until all three are explicitly provided.  
Do NOT assume values.  
Replace all occurrences of `<STAGE_NAME>`, `<PHASE_NAME>`, `<STAGE_FILE_NAME>` throughout this workflow.

---

# Pre-Step — Branch & Directory Initialization

Execute once before Step 1. Do NOT skip.

## Pre.1 — Derive Branch/Directory Name

Extract the numeric prefix from `<STAGE_FILE_NAME>`:

- Take the leading digit segment before the first `_`.
- Examples:
  - `STAGE_05_TENANT_PROVISIONING_SERVICE.md` → prefix = `05`
  - `STAGE_06A_LICENSE_ENFORCEMENT.md` → prefix = `06A`
- Zero-pad the numeric part to 3 digits, preserve any trailing letter:
  - `05` → `005`
  - `06A` → `006A`
- Convert `<STAGE_NAME>` to kebab-case (lowercase, spaces/underscores → hyphens).
- Combine as: `<PADDED_PREFIX>-<kebab-stage-name>`
  - Example: `005-tenant-provisioning-service`

Store as `STAGE_DIR_NAME`.

## Pre.2 — Confirm Base Branch

Default base branch is `develop`. Ask the user to confirm or override:

```
Base branch for checkout [develop]:
```

Do NOT proceed until confirmed. Store as `BASE_BRANCH`.

## Pre.3 — Create Git Branch

```bash
git fetch --all --prune
git checkout <BASE_BRANCH>
git pull origin <BASE_BRANCH>
git checkout -b <STAGE_DIR_NAME>
```

If branch already exists → STOP. Ask the user whether to reuse it or abort.

## Pre.4 — Create Stage Directory Structure

```bash
mkdir -p specs/runtime/<STAGE_DIR_NAME>/reports
```

Create `specs/runtime/<STAGE_DIR_NAME>/README.md`:

```markdown
# <STAGE_NAME>

**Branch:** `<STAGE_DIR_NAME>`  
**Phase:** <PHASE_NAME>  
**Stage File:** `specs/phases/<PHASE_NAME>/<STAGE_FILE_NAME>`  
**Initiated:** <ISO_TIMESTAMP>

## Workflow Progress

| Step      | Status | Report                      |
| --------- | ------ | --------------------------- |
| Pre-Step  | ✅     | —                           |
| Specify   | ⬜     | reports/SPECIFY_REPORT.md   |
| Clarify   | ⬜     | reports/CLARIFY_REPORT.md   |
| Plan      | ⬜     | reports/PLAN_REPORT.md      |
| Tasks     | ⬜     | reports/TASKS_REPORT.md     |
| Analyze   | ⬜     | reports/ANALYZE_REPORT.md   |
| Implement | ⬜     | reports/IMPLEMENT_REPORT.md |
| Closure   | ⬜     | reports/CLOSURE_REPORT.md   |
```

## Pre.5 — Initialize .workflow-state.json

Write to repository root/specs/runtime:

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
  "tasks_total": null,
  "tasks_completed": null,
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

## Pre.6 — Initialize Stage Status Block

Open `specs/phases/<PHASE_NAME>/<STAGE_FILE_NAME>`.  
Add or replace the `## Stage Status` block:

```markdown
## Stage Status

Status: PENDING  
Risk Level: UNKNOWN  
Initiated: <ISO_TIMESTAMP>

Scope Open:

- Specification pending

Constitutional Compliance:

- Pending constitutional audit

Notes:
Stage initialized. Specification in progress.
```

Apply the automatic continuation rule before proceeding to Step 1.

---

# Step 1 — Specify

## 1.1 — Execute Specify

/handoff to=speckit.specify

```
Stage: <STAGE_NAME>
Phase: <PHASE_NAME>
```

Load and follow: `specs/templates/specify-template.md`

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

If ADR is required → STOP and request it before continuing.

## 1.2 — Write Specify Report

Load `specs/templates/reports/specify-report-template.md`.  
Fill from step output.  
Write to: `specs/runtime/<STAGE_DIR_NAME>/reports/SPECIFY_REPORT.md`

## 1.3 — Update Stage Status Block

Open `specs/phases/<PHASE_NAME>/<STAGE_FILE_NAME>`. Update `## Stage Status`:

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

## 1.4 — Update .workflow-state.json

Merge:

```json
{
  "current_step": "specify",
  "stage_status": "DRAFT",
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [..., { "event": "specify_complete", "timestamp": "<ISO_TIMESTAMP>" }]
}
```

## 1.5 — Update README.md

Mark Specify as `✅`.

Apply the automatic continuation rule before proceeding to Step 2.

---

# Step 2 — Clarify

## 2.1 — Execute Clarify

/handoff to=speckit.clarify

```
Stage: <STAGE_NAME>
```

Load and follow: `specs/templates/clarify-template.md`

Audit and resolve ambiguities in:

- Transactions
- Idempotency
- Concurrency
- Version enforcement
- Middleware enforcement
- Security validation
- Error contract
- Isolation boundaries

List all clarification questions explicitly.  
Do not assume answers.  
All ambiguities must be resolved before planning.

## 2.2 — Write Clarify Report

Load `specs/templates/reports/clarify-report-template.md`.  
Fill from step output.  
Write to: `specs/runtime/<STAGE_DIR_NAME>/reports/CLARIFY_REPORT.md`

## 2.3 — Update Stage Status Block

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

## 2.4 — Update .workflow-state.json

Merge:

```json
{
  "current_step": "clarify",
  "stage_status": "CLARIFIED",
  "clarifications_resolved": true,
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [..., { "event": "clarifications_locked", "timestamp": "<ISO_TIMESTAMP>" }]
}
```

## 2.5 — Update README.md

Mark Clarify as `✅`.

Apply the automatic continuation rule before proceeding to Step 3.

---

# Step 3 — Plan

## 3.1 — Execute Plan

/handoff to=speckit.plan

```
Stage: <STAGE_NAME>
```

Load and follow: `specs/templates/plan-template.md`

Plan must cover:

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
- Server-authoritative time only
- Version compatibility required

If plan modifies architecture → STOP. ADR required before proceeding.

## 3.1A — Guardian Plan Validation (Architecture + API)

Run in parallel:

/handoff to=zidney-architecture-checker
/handoff to=zidney-api-designer

Both guardians MUST return:

VERDICT: PASS

If any guardian returns BLOCKED:

- STOP immediately.
- List all violations grouped by severity.
- Do NOT write PLAN_REPORT.
- Do NOT update workflow state.
- Require remediation and re-validation.

Only proceed to 3.2 if all guardians return PASS.

## 3.2 — Write Plan Report

Load `specs/templates/reports/plan-report-template.md`.  
Fill from step output.  
Write to: `specs/runtime/<STAGE_DIR_NAME>/reports/PLAN_REPORT.md`

## 3.3 — Update Stage Status Block

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

## 3.4 — Update .workflow-state.json

Merge:

```json
{
  "current_step": "plan",
  "stage_status": "PLANNED",
  "plan_completed": true,
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [..., { "event": "plan_complete", "timestamp": "<ISO_TIMESTAMP>" }]
}
```

## 3.5 — Update README.md

Mark Plan as `✅`.

Apply the automatic continuation rule before proceeding to Step 4.

---

# Step 4 — Tasks

## 4.1 — Execute Tasks

/handoff to=speckit.tasks

```
Stage: <STAGE_NAME>
```

Load and follow: `specs/templates/tasks-template.md`

Each task must:

- Be scoped to one layer
- Declare transactional status
- Declare idempotency requirements
- Declare middleware dependency
- Not modify unrelated files
- Preserve isolation guarantees

After task generation, count and record the total number of atomic tasks as `TASKS_TOTAL`.

## 4.2 — Write Tasks Report

Load `specs/templates/reports/tasks-report-template.md`.  
Fill from step output.  
Write to: `specs/runtime/<STAGE_DIR_NAME>/reports/TASKS_REPORT.md`

## 4.3 — Update Stage Status Block

```markdown
## Stage Status

Status: TASKS READY  
Risk Level: <LOW / MEDIUM / HIGH>  
Last Updated: <ISO_TIMESTAMP>

Tasks Generated:

- Total: <TASKS_TOTAL> atomic tasks
- [Key task categories and counts]

Deferred Scope:

- [Out of scope items]

Constitutional Compliance:

- Task set compliant — drift analysis required before implementation

Notes:
Atomic task set generated. Drift analysis gate pending.
```

## 4.4 — Update .workflow-state.json

Merge:

```json
{
  "current_step": "tasks",
  "stage_status": "TASKS READY",
  "tasks_total": <TASKS_TOTAL>,
  "tasks_completed": 0,
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [..., { "event": "tasks_complete", "tasks_total": <TASKS_TOTAL>, "timestamp": "<ISO_TIMESTAMP>" }]
}
```

## 4.5 — Update README.md

Mark Tasks as `✅`.

Apply the automatic continuation rule before proceeding to Step 5.

---

# Step 5 — Analyze (Drift Detector)

## 5.1 — Execute Analyze

/handoff to=speckit.analyze

```
Stage: <STAGE_NAME>
```

Load and follow: `specs/templates/analyze-template.md`

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

### Strict Pass Rule

`drift_passed = true` ONLY IF **all** audit criteria pass with no exceptions.  
A single FAILED criterion = `BLOCKED`.  
Partial passage is NOT acceptable and must never be treated as APPROVED.  
8/9 is BLOCKED. 9/9 is APPROVED.

If any violation is found → STOP. List every violation explicitly with its severity.  
Do NOT proceed to implementation until all violations are resolved and a full clean re-audit passes.

## 5.1A — Composite Guardian Audit (Parallel)

Run in parallel:

/handoff to=zidney-security-auditor
/handoff to=zidney-performance-optimizer
/handoff to=zidney-qa-engineer
/handoff to=zidney-code-reviewer

Each guardian MUST return:

VERDICT: PASS | BLOCKED

Collect all guardian findings.

Group issues by severity across all guardians:

- 🚨 Critical
- ⚠️ High
- ⚡ Medium
- ℹ️ Low

## 5.1B — Composite Verdict Aggregation

Composite verdict rules:

If:

- Structural Drift Audit (5.1) = BLOCKED
  OR
- Any guardian = BLOCKED

Then:

- Final Gate = BLOCKED
- Implementation = FORBIDDEN

Else:

- Final Gate = APPROVED
- Implementation = AUTHORIZED

Do NOT proceed to 5.2 until aggregation is complete.

## 5.2 — Write Analyze Report

Load `specs/templates/reports/analyze-report-template.md`.  
Fill from step output.  
Write to: `specs/runtime/<STAGE_DIR_NAME>/reports/ANALYZE_REPORT.md`

## 5.3 — Update Stage Status Block

If APPROVED (all criteria pass):

```markdown
## Stage Status

Status: IN PROGRESS  
Risk Level: <LOW / MEDIUM / HIGH>  
Last Updated: <ISO_TIMESTAMP>

Drift Analysis: PASSED (all criteria)  
Implementation: AUTHORIZED

Scope Authorized:

- [Authorized implementation scope]

Constitutional Compliance:

- All drift criteria passed — implementation authorized

Notes:
Full drift analysis passed. Implementation gate open.
```

If BLOCKED:

```markdown
## Stage Status

Status: BLOCKED  
Risk Level: CRITICAL  
Last Updated: <ISO_TIMESTAMP>

Drift Analysis: FAILED  
Implementation: FORBIDDEN

Violations:

- [List every violation with severity]

Notes:
Implementation blocked. All violations must be resolved and a full
re-audit must pass before implementation is authorized.
```

## 5.4 — Update .workflow-state.json

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

## 5.5 — Update README.md

Mark Analyze as `✅ Passed` or `❌ Blocked`.

Do NOT proceed to Step 6 if `drift_passed = false`.

---

# Step 6 — Implement

## 6.1 — Verify Implementation Gate

Before generating any code, confirm:

- `drift_passed = true` in `.workflow-state.json`
- No unresolved constitutional violations from Step 5
- No unresolved ambiguities from any prior step

If any check fails → STOP. Implementation is forbidden until resolved.

## 6.2 — Execute Implement

/handoff to=speckit.implement

```
Stage: <STAGE_NAME>
Tasks Total: <TASKS_TOTAL>
```

Load and follow: `specs/templates/implement-template.md`

Rules:

- Modify only files within stage scope
- Use tenant resolver only
- No direct DB instantiation
- All writes transactional
- Idempotency enforced
- Structured logging required
- Correlation ID required
- No business logic in frontend
- No stack traces to client

Track `TASKS_COMPLETED` as implementation proceeds.

If conflict with Constitution at any point → STOP immediately and explain before continuing.

## 6.3 — Verify Implementation Completeness

Before writing the implement report, verify:

```
Tasks completed: <TASKS_COMPLETED> / <TASKS_TOTAL>
```

**If `TASKS_COMPLETED < TASKS_TOTAL`:**

→ STOP. Do NOT write the report or proceed to closure.

Present to user:

```
⚠️ Implementation Incomplete

Completed: <TASKS_COMPLETED> / <TASKS_TOTAL> tasks

Remaining tasks:
- [List each incomplete task with its layer and description]

Options:
  A) Continue implementation now — list which tasks to tackle next
  B) Formally defer remaining tasks — provide written justification
     for each deferred task

Closure is FORBIDDEN until all tasks are complete or all remaining
tasks are formally deferred with written justification approved by you.
```

Wait for user decision. Do not proceed until explicitly instructed.  
If deferral is approved → document each deferred task and justification before continuing.

**If `TASKS_COMPLETED = TASKS_TOTAL` (or all remaining tasks formally deferred):**

→ Proceed to step 6.4.

## 6.4 — Write Implement Report

Load `specs/templates/reports/implement-report-template.md`.  
Fill from step output, including final task completion count and any formally deferred tasks.  
Write to: `specs/runtime/<STAGE_DIR_NAME>/reports/IMPLEMENT_REPORT.md`

## 6.5 — Update Stage Status Block

```markdown
## Stage Status

Status: BACKEND CLOSED  
Risk Level: <LOW / MEDIUM / HIGH>  
Last Updated: <ISO_TIMESTAMP>

Implementation: COMPLETE  
Tasks: <TASKS_COMPLETED> / <TASKS_TOTAL> completed

Scope Closed:

- [List all implemented items]

Deferred Scope:

- [Formally deferred tasks with justification, or "None"]

Constitutional Compliance:

- ADR alignment verified
- Implementation compliant with Zidney Constitution v1.2.0

Notes:
Backend implementation complete. No structural backend modifications allowed.
```

## 6.6 — Update .workflow-state.json

Merge:

```json
{
  "current_step": "implement",
  "stage_status": "BACKEND CLOSED",
  "tasks_completed": <TASKS_COMPLETED>,
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [..., {
    "event": "stage_backend_closed",
    "tasks_completed": <TASKS_COMPLETED>,
    "tasks_total": <TASKS_TOTAL>,
    "timestamp": "<ISO_TIMESTAMP>"
  }]
}
```

## 6.7 — Update README.md

Mark Implement as `✅`.

---

## 6.8 — Pre-Closure Guardian Validation (Deployment Layer)

Run in parallel:

/handoff to=zidney-cicd-automation
/handoff to=zidney-deployment-engineer
/handoff to=zidney-docker-specialist

Each guardian MUST return:

VERDICT: PASS | BLOCKED

If any guardian returns BLOCKED:

- STOP immediately.
- List all violations grouped by severity.
- Do NOT present the Pre-Closure Review Gate.
- Require remediation and re-validation.

Only proceed to the Pre-Closure Review Gate if all guardians return PASS.

## ⏸ Mandatory Pre-Closure Review Gate

**This is a hard STOP. Do NOT proceed to Step 7 under any circumstance without explicit user approval.**

Present to the user:

```
⏸ Pre-Closure Review Gate

All implementation steps are complete. Please review all reports
before closure is executed.

Closure will:
  - Mark stage as PRODUCTION READY in the stage file
  - Finalize .workflow-state.json
  - Generate the git commit message
  - Generate the PR summary

Reports to review:
  specs/runtime/<STAGE_DIR_NAME>/reports/SPECIFY_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/CLARIFY_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/PLAN_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/TASKS_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/ANALYZE_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/IMPLEMENT_REPORT.md

Tasks completed: <TASKS_COMPLETED> / <TASKS_TOTAL>

Respond with:
  ✅ "Approved — proceed to closure"
  ❌ "Issues found — [describe what needs fixing]"
```

If issues are reported → address them, regenerate the affected report(s), update
the relevant stage status and workflow state, then re-present this gate.  
Do NOT proceed to Step 7 until the user explicitly confirms approval.

---

# Step 7 — Closure

Only execute after explicit user approval at the Pre-Closure Review Gate.

## 7.1 — Write Closure Report

Load `specs/templates/reports/closure-report-template.md`.  
Fill from all prior step outputs and reports.  
Write to: `specs/runtime/<STAGE_DIR_NAME>/reports/CLOSURE_REPORT.md`

## 7.2 — Update Stage Status Block (Final)

Open `specs/phases/<PHASE_NAME>/<STAGE_FILE_NAME>`. Update `## Stage Status`:

```markdown
## Stage Status

Status: PRODUCTION READY  
Risk Level: <LOW / MEDIUM / HIGH>  
Closure Date: <ISO_DATE>

Scope Closed:

- [All delivered scope items]
- <TASKS_COMPLETED> / <TASKS_TOTAL> tasks completed

Deferred Scope:

- [Formally deferred tasks with justification, or "None"]

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
  "tasks_total": <TASKS_TOTAL>,
  "tasks_completed": <TASKS_COMPLETED>,
  "last_updated": "<ISO_TIMESTAMP>",
  "history": [
    { "event": "branch_created", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "specify_complete", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "clarifications_locked", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "plan_complete", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "tasks_complete", "tasks_total": <TASKS_TOTAL>, "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "drift_analysis_passed", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "stage_backend_closed", "tasks_completed": <TASKS_COMPLETED>, "tasks_total": <TASKS_TOTAL>, "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "pre_closure_review_approved", "timestamp": "<ISO_TIMESTAMP>" },
    { "event": "stage_production_ready", "timestamp": "<ISO_TIMESTAMP>" }
  ]
}
```

## 7.4 — Update README.md (Final)

Mark Closure as `✅` and all steps complete. Append:

```markdown
**Final Status:** 🟢 PRODUCTION READY — <ISO_DATE>  
**Tasks:** <TASKS_COMPLETED> / <TASKS_TOTAL> completed
```

## 7.5 — Generate Git Commit Message

Output for the user to apply:

```
feat(<STAGE_DIR_NAME>): complete <STAGE_NAME> implementation

Phase: <PHASE_NAME>
Stage: <STAGE_NAME>
Branch: <STAGE_DIR_NAME>
Status: PRODUCTION READY
Tasks: <TASKS_COMPLETED>/<TASKS_TOTAL> completed

Scope delivered:
- [Key scope item 1]
- [Key scope item 2]
- [Key scope item 3]

Constitutional compliance:
- Zidney Constitution v1.2.0 enforced throughout
- All drift criteria passed (analyze step)
- All writes transactional
- Idempotency enforced
- Structured logging present

Reports: specs/runtime/<STAGE_DIR_NAME>/reports/
Closes: <STAGE_FILE_NAME>
```

## 7.6 — Generate PR Summary

Load `specs/templates/PR_TEMPLATE.md`.  
Populate every section from workflow artifacts (all reports, stage file, task list, implementation output).  
Do not leave any placeholder unfilled.  
Output the completed PR summary to the user.

## 7.7 — Output Final Closure Summary

```
✅ Zidney Hard Mode Workflow — COMPLETE

Stage:    <STAGE_NAME>
Phase:    <PHASE_NAME>
Branch:   <STAGE_DIR_NAME>
Status:   PRODUCTION READY
Tasks:    <TASKS_COMPLETED> / <TASKS_TOTAL> completed

Reports generated:
  specs/runtime/<STAGE_DIR_NAME>/reports/SPECIFY_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/CLARIFY_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/PLAN_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/TASKS_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/ANALYZE_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/IMPLEMENT_REPORT.md
  specs/runtime/<STAGE_DIR_NAME>/reports/CLOSURE_REPORT.md

Stage file updated:
  specs/phases/<PHASE_NAME>/<STAGE_FILE_NAME> → PRODUCTION READY

Workflow state:
  .workflow-state.json → stage_production_ready

Next actions:
  1. Apply git commit message above
  2. git push origin <STAGE_DIR_NAME>
  3. Open PR using the generated PR summary above
```
