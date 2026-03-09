---
name: subagent-parallelization
description: Parallel subagent execution strategy for Zidney AI workflows
metadata:
  category: ai-execution
  scope: orchestration
  capabilities:
    - parallel task decomposition
    - concurrent analysis
    - subagent coordination
    - result synchronization
    - performance optimization
---

# Subagent Parallelization Skill

This skill defines how AI agents should **execute independent tasks in parallel using multiple subagents** during Zidney workflows.

The purpose of this skill is to **reduce execution time and improve reasoning throughput** by allowing multiple analysis steps to run concurrently when dependencies allow it.

This capability is particularly important for large monorepos like Zidney where architecture analysis, code inspection, and validation may involve many files and modules.

---

# Purpose

Complex AI workflows often contain tasks that do not depend on each other.

Instead of executing them sequentially, this skill allows the AI to:

• decompose work into independent units
• assign each unit to a subagent
• run them concurrently
• merge the results

This significantly improves performance during stages such as:

- specification analysis
- repository inspection
- architecture validation
- code review

---

# Parallel Execution Model

The Zidney system supports a **fan-out / fan-in model**.

Fan-out phase:

A task is decomposed into independent sub-tasks.

Example:

```
Analyze repository architecture
 ├─ subagent A → scan packages/
 ├─ subagent B → scan apps/
 └─ subagent C → scan scripts/
```

Fan-in phase:

Results from all subagents are collected and merged.

Example:

```
Combine analysis results
 → produce architecture report
```

---

# Suitable Parallel Tasks

Parallel execution should only be used when tasks are independent.

Examples of safe parallel tasks:

• scanning different directories
• analyzing multiple modules
• running separate static analyses
• evaluating independent test groups

Examples that should remain sequential:

• stage transitions
• git operations
• dependency installations
• architecture mutation operations

---

# Subagent Responsibilities

Each subagent should:

1. Receive a clearly scoped task
2. Operate only within its assigned boundary
3. Avoid modifying shared state
4. Produce structured results

Subagent output should typically include:

• findings
• detected issues
• suggested fixes

---

# Synchronization Strategy

After parallel execution completes, results must be synchronized.

The orchestrator should:

1. collect all subagent outputs
2. merge compatible results
3. detect conflicts
4. produce a unified conclusion

If subagents produce conflicting results, the orchestrator should resolve them before continuing.

---

# Failure Handling

If a subagent fails:

1. identify the failing task
2. retry if the failure is transient
3. continue with partial results when safe

Critical tasks should trigger a full workflow halt.

---

# Performance Benefits

Parallel subagent execution can reduce total analysis time significantly.

Typical improvements:

• large repository scans: 3–5× faster
• architecture analysis: 2–3× faster
• static validation tasks: 2–4× faster

---

# Integration With Other Skills

This skill works together with:

```
architecture-intelligence
mcp-routing
ai-terminal
```

These skills provide the context and tooling required for each subagent to perform its assigned task.

---

# Expected AI Behavior

When performing complex analysis tasks the AI should:

1. identify independent work units
2. spawn subagents for those units
3. run them concurrently
4. merge the results

The AI should only parallelize tasks when it **does not introduce race conditions or inconsistent results**.
