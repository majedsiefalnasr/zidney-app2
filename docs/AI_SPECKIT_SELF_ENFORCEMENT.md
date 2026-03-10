# AI Agent Self-Enforcement: SpecKit Artifact Validation

**Authority:** User request to prevent repeated architectural violations  
**Effective:** Immediately (all future SpecKit artifact generation)  
**Scope:** All AI agents operating under Zidney Orchestrator mode

---

## Mandatory Validation Gate (NON-NEGOTIABLE)

**EVERY TIME I generate or am about to create a SpecKit artifact** (plan.md, tasks.md, spec.md,
\*\_REPORT.md), I MUST:

### Step 1: Identify Artifact Type

- `plan.md` ← technical design from speckit.plan
- `tasks.md` ← task decomposition from speckit.tasks
- `spec.md` ← feature specification from speckit.specify
- `*_REPORT.md` ← step summary (SPECIFY, CLARIFY, PLAN, TASKS, ANALYZE, IMPLEMENT, CLOSURE)

### Step 2: Extract Workflow Context

From `.workflow-state.json`, retrieve:

- `stage_dir` → e.g., `"specs/runtime/016-shared-ui-system"`
- `STAGE_DIR_NAME` → e.g., `"016-shared-ui-system"`

**Must exist or Step 3 will fail.**

### Step 3: Construct Correct Path

**NO EXCEPTIONS. Use only these patterns:**

```
plan.md                    → specs/runtime/<STAGE_DIR_NAME>/plan.md
tasks.md                   → specs/runtime/<STAGE_DIR_NAME>/tasks.md
spec.md                    → specs/runtime/<STAGE_DIR_NAME>/spec.md
SPECIFY_REPORT.md          → specs/runtime/<STAGE_DIR_NAME>/reports/SPECIFY_REPORT.md
CLARIFY_REPORT.md          → specs/runtime/<STAGE_DIR_NAME>/reports/CLARIFY_REPORT.md
PLAN_REPORT.md             → specs/runtime/<STAGE_DIR_NAME>/reports/PLAN_REPORT.md
TASKS_REPORT.md            → specs/runtime/<STAGE_DIR_NAME>/reports/TASKS_REPORT.md
ANALYZE_REPORT.md          → specs/runtime/<STAGE_DIR_NAME>/reports/ANALYZE_REPORT.md
IMPLEMENT_REPORT.md        → specs/runtime/<STAGE_DIR_NAME>/reports/IMPLEMENT_REPORT.md
CLOSURE_REPORT.md          → specs/runtime/<STAGE_DIR_NAME>/reports/CLOSURE_REPORT.md
```

**Explicitly naming the wrong patterns (these WILL trigger the git hook):**

```
❌ specs/phases/<PHASE_NAME>/STAGE_16_PLAN.md
❌ specs/phases/<PHASE_NAME>/STAGE_16_TASKS.md
❌ specs/runtime/016-shared-ui-system/PLAN_REPORT.md (missing /reports/)
❌ specs/runtime/STAGE_16_PLAN.md (missing <STAGE_DIR_NAME>)
```

### Step 4: Verify Directory Exists

Before calling `create_file()` or `edit_file()`:

```
✅ Does specs/runtime/<STAGE_DIR_NAME>/ exist?
✅ Does specs/runtime/<STAGE_DIR_NAME>/reports/ exist? (if report)
```

If NO → Use `create_directory()` first. NEVER assume.

### Step 5: Announce Path Explicitly

When I write to the user, I MUST state:

```
Writing to: specs/runtime/016-shared-ui-system/plan.md
```

NOT:

```
"I'll create the plan document"  ← vague
"Creating STAGE_16_PLAN.md"       ← wrong filename
```

### Step 6: Call File Tool with Full Path

```python
create_file(
    filePath="/Users/.../zidney-app2/specs/runtime/016-shared-ui-system/plan.md",
    content="..."
)
```

Use **absolute path**, not relative.

---

## git Hook Enforcement (Automatic Blocker)

If I violate the path rules and attempt to git add/commit, `.git/hooks/pre-commit` will:

1. Detect the violation
2. Print error message with rules
3. Exit code 1 (blocking commit)
4. Require manual correction

**This is intentional. I should NEVER reach this state.**

---

## Self-Correction Protocol

**If I accidentally violate this rule:**

1. User points out the violation (or I self-detect it)
2. I immediately perform `git mv` to correct the path
3. Verify with `git status --short`
4. Commit the fix with message: "fix: move X to correct location per SpecKit governance"
5. Document the violation in VIOLATION_HISTORY section

---

## Reference Materials I Must Consult

**Before any SpecKit artifact creation, I will reference:**

1. `/specs/SPECKIT_ARTIFACT_VALIDATION.md` ← Detailed checklist
2. `.git/hooks/pre-commit` ← Automated enforcement rules
3. `/docs/AGENT_GOVERNANCE.md` → SpecKit Directory Structure Lock section
4. `/AGENTS.md` → modeInstructions → SpecKit Directory Structure (Locked)

---

## Violation Record

### Incident 1: STAGE_16_SHARED_UI_SYSTEM (Feb 19, 2026)

**What happened:**

- Generated `STAGE_16_PLAN.md` → placed in `specs/phases/02_PLATFORM_MMC/`
- Generated `STAGE_16_TASKS.md` → placed in `specs/phases/02_PLATFORM_MMC/`

**Why it violated:**

- Didn't validate path BEFORE calling create_file()
- Used generic stage-prefixed naming instead of standard `plan.md`, `tasks.md`
- Ignored existing pattern from 001-monorepo-setup, 002-multi-tenancy, etc.

**How it was fixed:**

- User identified the pattern violation
- Files moved with `git mv` to correct location
- Git hook installed to prevent recurrence
- This enforcement document created

**Root cause:** No explicit validation checkpoint in my execution. Fixed by:

1. ✅ Adding explicit validation checklist (SPECKIT_ARTIFACT_VALIDATION.md)
2. ✅ Adding git pre-commit hook
3. ✅ Adding this self-enforcement document
4. ✅ Committing all enforcement mechanisms to git

---

## Activation Status

- ✅ Git hook installed and executable
- ✅ Validation checklist created
- ✅ Self-enforcement protocol documented
- ✅ Reference materials linked
- ✅ Violation history recorded

**This enforcement is NOW ACTIVE and NON-NEGOTIABLE for all future work.**

---

## Who Created This & When

- **Author:** GitHub Copilot (AI Agent)
- **Date:** February 19, 2026
- **Reason:** User requested prevention mechanism after detecting SpecKit artifact location
  violation
- **Authority:** AGENTS.md > AI Behavioral Enforcement → "AI must not violate import/directory
  boundaries"

This document is binding and self-referential: I am documenting my own governance constraints.
