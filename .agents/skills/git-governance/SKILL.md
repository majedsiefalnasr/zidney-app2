---
name: git-governance
description: Git workflow governance and hygiene rules for the Zidney monorepo
metadata:
  category: development
  scope: monorepo
  capabilities:
    - branch governance
    - commit hygiene
    - staged file validation
    - commit message enforcement
    - spec branch workflow
---

# Git Governance Skill

This skill defines **Git workflow rules and hygiene standards** for the Zidney repository.

Its goal is to ensure that all commits, branches, and staged files follow the governance model required by the Zidney Hard Mode development workflow.

This skill prevents:

• cross-stage file modifications
• accidental staging of unrelated files
• invalid branch names
• invalid commit messages
• architecture-breaking changes

---

# Branch Governance

Zidney uses a **stage-based branching model**.

Specification and implementation branches must follow the format:

```
spec/<stage-branch>
```

Examples:

```
spec/020-status-workflow-engine
spec/infra-004-biome
spec/ui-02-api-client-layer
```

Branches are associated with a runtime stage directory:

```
specs/runtime/<stage-branch>
```

The branch name must match the `.workflow-state.json` file inside the stage directory.

---

# Branch Validation Rules

Branches must follow this pattern:

```
([a-z]+-)?[0-9]{2,3}[A-Z]?-[a-z0-9-]+
```

Examples:

Valid:

```
020-status-workflow-engine
infra-004-biome
ui-02-api-client-layer
```

Invalid:

```
feature/new-ui
fix-bug
random-branch
```

The Hard Mode Guard workflow validates this automatically.

---

# Staging Rules

Only files **belonging to the current stage** should be staged.

Allowed locations:

```
specs/runtime/<stage>/
apps/
packages/
scripts/
docs/
```

Disallowed behavior:

• staging files from unrelated stages
• staging generated files unintentionally
• staging temporary or debug files

Before committing, verify staged files:

```
git status
```

or

```
git diff --staged
```

---

# Commit Message Rules

Commit messages must follow the Zidney convention:

```
type(stage): description
```

Examples:

```
feat(020-status-workflow-engine): implement workflow state validation
fix(infra-004-biome): correct formatter configuration
chore(ui-02-api-client-layer): update API client integration
```

Allowed types:

```
feat
fix
chore
refactor
test
docs
infra
```

Commit messages should:

• describe the intent of the change
• reference the stage
• remain concise

---

# Git Hygiene Enforcement

Before each commit the following checks should be performed:

1. Verify staged files belong to the correct stage

```
git diff --staged
```

2. Ensure no unrelated files are staged

3. Confirm commit message format

4. Ensure architecture guard passes

```
bun run ai:guard
```

5. Ensure infrastructure audit passes if architecture files changed

```
bun run arch:audit
```

---

# Interaction With Husky Hooks

Git governance integrates with Husky hooks.

Hooks include:

```
pre-commit
pre-push
```

Typical validations executed by hooks:

• lint-staged
• biome formatting
• architecture guard
• staged file validation

These hooks ensure that invalid commits never reach the repository.

---

# Hard Mode Integration

This skill works together with the Hard Mode workflow.

The GitHub Action:

```
.github/workflows/hard-mode-guard.yml
```

validates:

• branch naming
• workflow state consistency
• stage progression
• required stage artifacts

If these checks fail the pull request is blocked.

---

# Expected AI Behavior

When modifying the repository the AI should:

1. Stage only relevant files
2. Verify commit scope
3. Follow commit message conventions
4. Avoid modifying unrelated stages
5. Ensure architecture guards pass before committing

The AI should treat Git governance rules as **mandatory constraints**, not optional guidelines.

---

# Relationship to Other Skills

This skill works together with:

```
ai-terminal
architecture-intelligence
rtk-execution-layer
precommit-diagnostics
```

Git governance ensures that changes remain **safe, traceable, and compliant** with Zidney's development workflow.
