---
name: terminal-safety
description: Safety rules and command governance for terminal operations executed by AI agents in the Zidney repository
metadata:
  category: safety
  scope: terminal
  capabilities:
    - dangerous command detection
    - architecture-safe operations
    - repository protection
    - command validation
---

# Terminal Safety Skill

This skill defines the **safety rules for terminal command execution** inside the Zidney repository.

AI agents frequently execute shell commands during development workflows. Without guardrails, these commands may accidentally:

• delete critical files
• corrupt the repository
• bypass architecture governance
• modify protected configuration

This skill ensures that terminal usage remains **safe, predictable, and architecture-compliant**.

---

# Core Principle

AI agents must follow a strict rule:

```
Never execute destructive or irreversible commands without explicit human confirmation.
```

Commands should always prefer **safe and reversible operations**.

---

# Dangerous Command Detection

The AI must avoid executing commands that may destroy repository data.

Examples of dangerous commands:

```
rm -rf /
rm -rf node_modules
rm -rf .git
sudo rm -rf *
```

Other potentially dangerous commands include:

```
git reset --hard
git clean -fd
docker system prune -a
```

If such commands appear necessary, the AI must:

1. explain why the command is needed
2. request explicit user confirmation
3. suggest a safer alternative when possible

---

# Repository Protection

The following paths are **protected** and should never be modified or deleted by automated commands:

```
.git/
docs/architecture/
specs/
ARCHITECTURE_MAP.json
```

These files define the **governance and architectural structure** of the Zidney system.

---

# Architecture Safety

Terminal commands must respect the architecture governance layer.

Before performing large refactors or file moves, the AI should ensure:

```
bun run ai:guard
```

passes successfully.

When new modules are introduced, the AI should regenerate architecture intelligence:

```
bun run arch:audit
```

This keeps architecture metadata synchronized with the repository.

---

# Safe Command Practices

Preferred command patterns:

```
bun install
bun run <script>
bun test
bun lint
```

Avoid global system mutations whenever possible.

Commands should be scoped to the repository directory.

---

# Git Safety

Git commands must preserve repository history and collaboration integrity.

Safe commands:

```
git status
git diff
git add
git commit
```

Commands requiring caution:

```
git rebase
git reset
git push --force
```

These operations should only be used when necessary and clearly explained.

---

# Integration With Other Skills

This skill works together with:

```
git-governance
precommit-diagnostics
architecture-intelligence
```

These skills ensure that terminal operations remain aligned with repository rules.

---

# Expected AI Behavior

When executing terminal commands the AI should:

1. verify that the command is safe
2. avoid destructive operations
3. prefer reversible actions
4. respect repository governance

The objective is to maintain **a stable and secure development environment** while allowing efficient AI-assisted workflows.
