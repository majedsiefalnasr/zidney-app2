---
name: analysis-retry-engine
description: Intelligent retry and remediation strategy for failed analysis, validation, and guardian checks in Zidney AI workflows
metadata:
  category: ai-execution
  scope: orchestration
  capabilities:
    - guardian retry logic
    - remediation loop management
    - failure classification
    - retry safety enforcement
    - deterministic recovery
---

# Analysis Retry Engine Skill

This skill defines the **intelligent retry mechanism** used by Zidney AI workflows when analysis, validation, or guardian checks fail.

Instead of blindly retrying operations, the system performs **structured remediation loops** that:

• classify the failure
• apply targeted fixes
• re-run the analysis
• stop safely when retries exceed limits

This prevents infinite retry loops and reduces AI hallucination paths.

---

# Purpose

Complex AI workflows frequently encounter failures during:

• architecture validation
• guardian checks
• static analysis
• test verification
• security audits

The retry engine ensures that these failures are handled in a **controlled, deterministic manner**.

---

# Retry Strategy

The retry model follows a **bounded remediation loop**.

General workflow:

```
analysis
   ↓
failure detected
   ↓
classify issue
   ↓
apply remediation
   ↓
re-run analysis
   ↓
repeat until resolved or limit reached
```

Maximum retry count is normally **3 attempts**.

---

# Failure Classification

Failures should first be categorized before remediation.

Typical categories include:

### Code defects

Examples:

• syntax errors
• incorrect imports
• missing types

Remediation:

• apply minimal code fix
• re-run analysis

---

### Architecture violations

Examples:

• forbidden module dependency
• layer boundary violation

Remediation:

• correct the import
• update architecture map when intentional

---

### Test failures

Examples:

• failing unit tests
• missing test coverage

Remediation:

• correct logic
• update or add tests

---

### Configuration errors

Examples:

• invalid JSON
• missing environment variables

Remediation:

• fix configuration
• regenerate artifacts

---

# Retry Limits

Retries are intentionally limited.

Typical limits:

```
MAX_RETRY_ATTEMPTS = 3
```

Behavior:

Attempt 1 → remediation

Attempt 2 → deeper fix

Attempt 3 → final verification

If attempt 3 fails, the system **halts and requires human intervention**.

---

# Hard Stop Condition

When the retry limit is reached:

```
HARD STOP — Maximum retry attempts exceeded
```

The AI must:

1. summarize all detected issues
2. list attempted remediations
3. provide a clear next action

No further automated modifications should be attempted.

---

# Deterministic Recovery

Each retry cycle must be **deterministic**.

This means:

• no random changes
• minimal targeted fixes
• predictable outcomes

This significantly reduces AI hallucination and architecture drift.

---

# Retry Reporting

Each retry attempt should produce structured output.

Example report structure:

```
Attempt: 2
Issue: architecture boundary violation
Fix applied: corrected import path
Result: guardian passed
```

This history allows developers to audit AI behavior.

---

# Integration With Zidney Workflows

This retry engine is used during stages such as:

• guardian validation
• architecture enforcement
• code analysis
• stage verification

It works alongside:

```
architecture-intelligence
subagent-parallelization
precommit-diagnostics
```

---

# Expected AI Behavior

When an analysis step fails the AI should:

1. classify the failure
2. attempt a targeted remediation
3. retry the operation
4. stop after the maximum retry limit

The AI must **never enter an infinite retry loop**.
