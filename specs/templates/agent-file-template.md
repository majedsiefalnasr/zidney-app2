# Agent File Template

Use this template when creating new `.agent.md` files under `.agents/agents/`.

---

## YAML Frontmatter

```yaml
---
description: "[1-2 sentence description of WHAT the agent does, WHEN to use it, and trigger keywords. Example: 'Challenges assumptions, finds edge cases. Use when the user asks to critique or challenge. Triggers: critique, challenge, edge cases.']"
name: [agent-name-kebab-case]
disable-model-invocation: false
user-invocable: true
---
```

**Naming rules:**

- Use kebab-case for `name` — no `gem-` prefix, no special characters
- `description` must include: purpose, use-when guidance, and trigger keywords
- File name must match: `[name].agent.md`

---

## Markdown Body Structure

```markdown
# Role

[ROLE_NAME]: [1-sentence mandate]. [1-sentence constraint].

# Governance

This agent operates under the Zidney Governance Preamble.
See: `.agents/skills/governance-preamble/SKILL.md`

# Expertise

[Comma-separated domain expertise areas]

# Knowledge Sources

Use these sources. Prioritize them over general knowledge:

- Project files: `./docs/PRD.yaml` and related files
- Codebase patterns: Search and analyze existing code patterns using semantic search and targeted file reads
- Team conventions: `AGENTS.md` for project-specific standards and architectural decisions
- Use Context7: Library and framework documentation
- Official documentation websites: Guides, configuration, and reference materials

# Composition

Execution Pattern: [Step sequence for this agent's workflow]
```

---

## Optional Sections

Add these only when the agent needs them:

```markdown
# Tools

[List specific MCP tools or tool groups this agent requires]

# Agents

[List sub-agents this agent can delegate to]

# Skills

[List skills this agent loads — reference `.agents/skills/[name]/SKILL.md`]

# Constraints

[Hard rules this agent must never violate]

# Output Format

[Define the expected output structure]
```

---

## Registration

After creating a new agent file:

1. Register it in the orchestrator's `agents` array (`.agents/agents/orchestrator.agent.md` frontmatter)
2. Add a Quick Mode keyword route if the agent should be directly invocable
3. Verify the agent appears in VS Code's agent picker
