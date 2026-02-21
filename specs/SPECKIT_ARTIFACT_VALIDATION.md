# AI Agent SpecKit Artifact Validation Checklist

**Purpose:** Prevent architectural violations in artifact placement and naming.

**When to Use:** BEFORE ANY create_file() call for SpecKit artifacts (plan.md, tasks.md, spec.md, \*\_REPORT.md)

**MANDATORY: Complete this checklist before writing any file**

---

## Artifact Placement Validation

### For plan.md

- [ ] **Artifact Type:** Technical design document from speckit.plan subagent
- [ ] **Correct Location:** `specs/runtime/<STAGE_DIR_NAME>/plan.md`
- [ ] **Wrong Locations (Check these are NOT paths):**
  - ❌ `specs/phases/<PHASE_NAME>/STAGE_NN_PLAN.md`
  - ❌ `specs/phases/<PHASE_NAME>/plan.md`
  - ❌ `specs/runtime/plan.md` (must be inside stage-specific directory)
- [ ] **Correct Filename:** `plan.md` (NOT `STAGE_16_PLAN.md`, NOT `PLAN.md`)
- [ ] **Directory exists:** Verify `specs/runtime/<STAGE_DIR_NAME>/` has been created (Pre-Step)

### For tasks.md

- [ ] **Artifact Type:** Task decomposition document from speckit.tasks subagent
- [ ] **Correct Location:** `specs/runtime/<STAGE_DIR_NAME>/tasks.md`
- [ ] **Wrong Locations (Check these are NOT paths):**
  - ❌ `specs/phases/<PHASE_NAME>/STAGE_NN_TASKS.md`
  - ❌ `specs/phases/<PHASE_NAME>/tasks.md`
  - ❌ `specs/runtime/tasks.md` (must be inside stage-specific directory)
- [ ] **Correct Filename:** `tasks.md` (NOT `STAGE_16_TASKS.md`, NOT `TASKS.md`)
- [ ] **Directory exists:** Verify `specs/runtime/<STAGE_DIR_NAME>/` exists

### For spec.md

- [ ] **Artifact Type:** Feature specification from speckit.specify subagent
- [ ] **Correct Location:** `specs/runtime/<STAGE_DIR_NAME>/spec.md`
- [ ] **Wrong Locations (Check these are NOT paths):**
  - ❌ `specs/phases/<PHASE_NAME>/STAGE_NN_SPEC.md`
  - ❌ `specs/phases/<PHASE_NAME>/spec.md`
- [ ] **Correct Filename:** `spec.md` (NOT `STAGE_16_SPEC.md`)
- [ ] **Directory exists:** Verify `specs/runtime/<STAGE_DIR_NAME>/` exists

### For \*\_REPORT.md files

- [ ] **Artifact Type:** Step report (SPECIFY_REPORT, CLARIFY_REPORT, PLAN_REPORT, etc.)
- [ ] **Correct Location:** `specs/runtime/<STAGE_DIR_NAME>/reports/<REPORT_NAME>.md`
- [ ] **Wrong Locations (Check these are NOT paths):**
  - ❌ `specs/phases/<PHASE_NAME>/reports/*_REPORT.md`
  - ❌ `specs/runtime/016-shared-ui-system/*_REPORT.md` (must be in /reports/ subdirectory)
- [ ] **Correct Filename Pattern:** `SPECIFY_REPORT.md`, `CLARIFY_REPORT.md`, `PLAN_REPORT.md`, etc.
- [ ] **Directory exists:** Verify `specs/runtime/<STAGE_DIR_NAME>/reports/` exists (Pre-Step creates this)

---

## Stage Directory Structure Reference

**CORRECT structure (all files go here):**

```
specs/runtime/<STAGE_DIR_NAME>/
├── README.md                    ← Workflow progress tracker
├── spec.md                      ← Feature specification
├── plan.md                      ← Technical design
├── tasks.md                     ← Task decomposition
└── reports/
    ├── SPECIFY_REPORT.md
    ├── CLARIFY_REPORT.md
    ├── PLAN_REPORT.md
    ├── TASKS_REPORT.md
    ├── ANALYZE_REPORT.md
    ├── IMPLEMENT_REPORT.md
    └── CLOSURE_REPORT.md
```

**WRONG structure (anti-patterns to prevent):**

```
❌ specs/phases/<PHASE_NAME>/STAGE_16_PLAN.md
❌ specs/phases/<PHASE_NAME>/STAGE_16_TASKS.md
❌ specs/phases/<PHASE_NAME>/spec.md
❌ specs/runtime/016-shared-ui-system/PLAN_REPORT.md (should be in /reports/)
```

---

## Pre-File-Creation Validation Steps

**BEFORE calling create_file():**

1. **Extract STAGE_DIR_NAME** from workflow context
   - Pattern: `<PADDED_NUMERIC_PREFIX>-<kebab-case-stage-name>`
   - Example: `016-shared-ui-system`

2. **Construct full correct path** based on artifact type:
   - `plan.md` → `specs/runtime/<STAGE_DIR_NAME>/plan.md`
   - `tasks.md` → `specs/runtime/<STAGE_DIR_NAME>/tasks.md`
   - `*_REPORT.md` → `specs/runtime/<STAGE_DIR_NAME>/reports/<REPORT_NAME>.md`

3. **Verify directory exists:**
   - If directory doesn't exist → STOP and use mkdir/create_directory first
   - NEVER assume directory exists

4. **Check filename against pattern:**
   - ✅ `plan.md`, `tasks.md`, `spec.md`, `SPECIFY_REPORT.md`
   - ❌ `STAGE_16_PLAN.md`, `STAGE_16_TASKS.md`, `report.md`, `REPORT.md`

5. **Log the path explicitly** in any decision or explanation to user:
   - Example: "Writing to: `specs/runtime/016-shared-ui-system/plan.md`"

---

## Git Hook Enforcement

**Automated Prevention:** `.git/hooks/pre-commit` will block commits with:

- ❌ `specs/phases/.../plan.md`
- ❌ `specs/phases/.../tasks.md`
- ❌ `specs/phases/.../spec.md`
- ❌ Any `STAGE_NN_PLAN.md`, `STAGE_NN_TASKS.md` files
- ❌ Reports outside `specs/runtime/<STAGE_DIR>/reports/`

If hook blocks your commit, review this checklist and fix the artifact location.

---

## Violation History

**Past Violation (FIXED):**

- ❌ Created: `specs/phases/02_PLATFORM_MMC/STAGE_16_PLAN.md`
- ❌ Created: `specs/phases/02_PLATFORM_MMC/STAGE_16_TASKS.md`
- ✅ Fixed: Moved to `specs/runtime/016-shared-ui-system/plan.md` and `tasks.md`
- **Root Cause:** Didn't validate artifact path BEFORE calling create_file()
- **Prevention:** Added this checklist + git hook

---

## Reference Documents

- **SpecKit Directory Structure Lock:** [AGENTS.md > modeInstructions > SpecKit Directory Structure (Locked)](../AGENTS.md)
- **Git Hook Enforcement:** [.git/hooks/pre-commit](./.git/hooks/pre-commit)
- **Governance Authority:** [docs/AGENT_GOVERNANCE.md](docs/AGENT_GOVERNANCE.md)
