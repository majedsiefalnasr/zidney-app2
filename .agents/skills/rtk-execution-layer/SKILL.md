---
name: rtk-execution-layer
description: Token-optimized command execution layer using RTK (Rust Token Killer)
metadata:
  category: development
  scope: terminal
  capabilities:
    - token optimization
    - command rewriting
    - large file summarization
    - AI context reduction
    - terminal execution policy
---

# RTK Execution Layer Skill

This skill defines how terminal commands should be executed in the Zidney repository when **RTK (Rust Token Killer)** is available.

The goal is to reduce token usage when interacting with large files or large outputs inside the monorepo.

RTK enables AI agents to inspect code without flooding the context window.

---

# Purpose

Large monorepos can generate extremely large outputs when using commands like:

```
cat
rg
ls -R
```

These outputs can exceed the AI context window.

RTK solves this problem by providing token-efficient summaries and structured outputs.

This skill ensures that RTK is used whenever appropriate.

---

# RTK Installation

RTK can be installed using one of the following methods.

Homebrew (recommended):

```
brew install rtk
```

Quick install (Linux/macOS):

```
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
```

Cargo:

```
cargo install --git https://github.com/rtk-ai/rtk
```

Verify installation:

```
rtk --version
rtk gain
```

---

# Command Preference Hierarchy

When inspecting repository files the following tool preference should be used.

Search:

```
rg > grep
```

File discovery:

```
fd > find
```

Large file inspection:

```
rtk summarize > cat
```

JSON inspection:

```
jq > cat
```

Code transformation:

```
ast-grep > sed
```

Formatting:

```
biome > prettier
```

These preferences keep terminal interactions **token-efficient and structured**.

---

# RTK Usage Rules

RTK should be used when:

• inspecting large files
• summarizing code for AI reasoning
• extracting structured context
• reducing terminal output

Example:

Bad:

```
cat apps/api/src/server.ts
```

Better:

```
rtk summarize apps/api/src/server.ts
```

---

# Output Reduction Strategy

RTK commands should be used before producing large outputs.

Examples:

Summarize a file:

```
rtk summarize <file>
```

Trim output:

```
rtk trim <file>
```

Measure token savings:

```
rtk gain
```

---

# Fallback Behavior

If RTK is not installed, the system should fall back to standard commands.

Example:

Preferred:

```
rtk summarize <file>
```

Fallback:

```
cat <file>
```

This ensures the workflow remains functional even without RTK.

---

# Integration With Other Skills

This skill works together with:

```
ai-terminal
architecture-intelligence
git-governance
```

RTK improves the efficiency of these skills by reducing the amount of context required for AI reasoning.

---

# Expected AI Behavior

When interacting with the terminal the AI should:

1. Prefer RTK commands when inspecting files
2. Avoid producing large unstructured outputs
3. Use structured tools like `jq` and `ast-grep`
4. Keep terminal outputs concise and token-efficient

The AI should treat RTK as the **default inspection tool for large files** inside the Zidney monorepo.
