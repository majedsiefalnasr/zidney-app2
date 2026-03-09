# Orchestrator Refactor: Remaining Tasks

## Status Summary

✅ **COMPLETED:**

1. Skill Delegation Layer added
2. RTK duplication fixed (Deterministic Command Execution)
3. Large architecture sections partially simplified
4. MCP routing delegated
5. Git governance delegated
6. Package manager governance delegated
7. Pre-commit diagnostics delegated

## REMAINING WORK

The following sections still need to be streamlined or removed to get orchestrator under 2000 lines (currently ~4500):

### 1. Stage-Aware Architecture Guard (Lines ~120-210)

**Issue:** Still contains full validation logic that should be in architecture-self-healing skill

**Current:** ~90 lines of detailed rules, examples, enforcement strategy

**Should be:** 3-4 lines delegating to skill

```markdown
## Stage‑Aware Architecture Guard

**Delegated to:** `.agents/skills/architecture-self-healing`

- Architecture changes only permitted in **INFRA stages** (`STAGE_INFRA_*`)
- Feature/backend/UI/runtime stages: architecture is **read‑only**
- Violations cause workflow STOP requiring explicit review
```

### 2. Architecture Sanity Check (Lines ~220-320)

**Issue:** Deep architecture validation logic belongs in architecture-intelligence skill

**Current:** ~200 lines of detailed checks, file paths, validation protocol

**Should be:** 3-4 lines delegating to skill

```markdown
## Architecture Sanity Check

**Delegated to:** `.agents/skills/architecture-intelligence`

The skill verifies architecture context is synchronized before each workflow step:

- Brain/contract/map files exist and are current
- GitNexus index status
- Architecture drift detection
- Branch naming validation
```

### 3. Autonomous Architecture Drift Prevention (Lines ~320-420)

**Issue:** Belongs in architecture-self-healing skill

**Current:** ~100 lines on early drift detection, remediation, timing

**Should be:** 2-3 lines

```markdown
## Autonomous Architecture Drift Prevention

**Delegated to:** `.agents/skills/architecture-self-healing`

Early drift checks run before Plan and Implement steps prevent BLOCKED verdicts in Analyze.
```

### 4. Architecture Brain Auto-Refresh (Lines ~420-470)

**Issue:** Maintenance task belongs in architecture-intelligence skill

**Current:** ~50 lines on refresh rules

**Should be:** 2 lines

```markdown
## Architecture Brain Auto-Refresh

**Delegated to:** `.agents/skills/architecture-intelligence`

Automatic refresh on app/packages/scripts/docs/architecture changes.
```

### 5. Architecture Self-Healing Enforcement (Lines ~470-570)

**Issue:** Already has a dedicated skill, this full protocol is redundant

**Current:** ~100 lines of detailed protocol, triggers, repair strategies

**Should be:** 5-6 lines

```markdown
## Architecture Self-Healing Enforcement

**Delegated to:** `.agents/skills/architecture-self-healing`

When validation fails, the skill:

- Diagnoses violations
- Determines repair strategy
- Re-validates after repair
- Escalates if violations persist

The orchestrator MUST NOT disable validators or bypass pre-commit hooks.
```

### 6. Git Command References

Multiple places still embed git commands like:

- `git status --porcelain`
- `git add <files>`
- `git diff --name-only --cached`
- `git commit`

**Should:** Reference git-governance skill instead

```
**Implementation:** `.agents/skills/git-governance`
```

## Total Potential Reduction

Current: ~4500 lines  
After cleanup: ~2000 lines  
Token reduction: ~55%

## Implementation Notes

- Each removed section gets replaced with 2-4 line skill delegation
- Architecture logic moves to: `architecture-intelligence`, `architecture-self-healing`
- Git logic moves to: `git-governance`
- Context selection moves to: `architecture-intelligence`
- All retained sections focus on: workflow control, state management, step sequencing
