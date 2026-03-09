---
name: mcp-routing
description: MCP tool routing and selection policy for Zidney AI agents
metadata:
  category: tooling
  scope: ai-tools
  capabilities:
    - mcp tool selection
    - knowledge graph queries
    - repository context loading
    - architecture-aware analysis
---

# MCP Routing Skill

This skill defines how AI agents should **select and route requests to MCP tools** when working inside the Zidney monorepo.

The goal is to ensure that the AI uses the **correct external context providers** instead of relying on incomplete training data.

This prevents hallucinations and ensures that decisions are based on the **actual repository state**.

---

# Supported MCP Tools

The Zidney environment may expose several MCP tools.

Typical MCP tools include:

GitNexus MCP

Provides repository knowledge graph analysis.

Use for:

• dependency analysis
• call graph inspection
• impact analysis
• architectural reasoning

Example:

```
gitnexus query tenant
```

or

```
gitnexus impact <symbol>
```

---

Filesystem MCP

Provides direct access to repository files and directory structure.

Use for:

• reading files
• listing directories
• inspecting configuration files

This should be used instead of guessing file contents.

---

GitHub MCP

Provides GitHub repository context.

Use for:

• pull request information
• commit history
• workflow status

---

Database MCP (if configured)

Provides runtime database inspection.

Use for:

• schema inspection
• migration validation
• database debugging

---

# Routing Strategy

When solving a task the AI should select MCP tools according to the problem type.

Architecture analysis:

```
GitNexus MCP
```

Repository file inspection:

```
Filesystem MCP
```

Pull request or workflow investigation:

```
GitHub MCP
```

Database investigation:

```
Database MCP
```

This routing policy ensures that the AI uses the **most authoritative source of information**.

---

# GitNexus Priority Rule

When architectural reasoning is required the AI should prefer GitNexus.

Examples:

Before refactoring a module:

```
gitnexus impact <symbol>
```

Before modifying cross-module dependencies:

```
gitnexus query <module>
```

GitNexus provides a **knowledge graph of the repository**, which is more reliable than static text search.

---

# Avoiding Training Data Assumptions

AI agents must avoid relying on assumptions about:

• repository structure
• dependency relationships
• module ownership

Instead the AI should retrieve real information using MCP tools.

Example:

Bad approach:

```
Assume where a module is located
```

Correct approach:

```
Use filesystem MCP to inspect the directory
```

---

# Integration With Other Skills

This skill works together with:

```
ai-terminal
architecture-intelligence
rtk-execution-layer
```

MCP routing ensures these skills operate using **accurate repository intelligence**.

---

# Expected AI Behavior

When working inside the Zidney repository the AI should:

1. Prefer MCP tools over assumptions
2. Use GitNexus for architectural reasoning
3. Use filesystem MCP for file inspection
4. Use GitHub MCP for repository metadata
5. Combine MCP results with architecture rules

This ensures decisions remain **data-driven and architecture-aware**.
