---
name: package-manager-governance
description: Package manager governance rules for dependency management in the Zidney monorepo
metadata:
  category: development
  scope: monorepo
  capabilities:
    - package manager detection
    - dependency governance
    - lockfile validation
    - installation policy
    - dependency safety
---

# Package Manager Governance Skill

This skill defines **dependency management rules** for the Zidney repository.

Its purpose is to ensure that all dependency installations and package operations follow a **consistent and reproducible package management strategy**.

The Zidney monorepo uses **Bun as the primary package manager**.

---

# Primary Package Manager

Zidney uses:

```
bun
```

for:

• dependency installation
• running scripts
• test execution
• monorepo package linking

All dependency operations should prefer Bun commands.

Examples:

Install dependencies:

```
bun install
```

Add dependency:

```
bun add <package>
```

Add dev dependency:

```
bun add -d <package>
```

Run scripts:

```
bun run <script>
```

---

# Forbidden Package Managers

The following package managers should **not** be used inside the repository:

```
npm
yarn
pnpm
```

Using multiple package managers can create inconsistent lockfiles and dependency trees.

---

# Lockfile Policy

The repository uses the Bun lockfile:

```
bun.lockb
```

Rules:

• The lockfile must always be committed
• The lockfile must be updated when dependencies change
• Manual edits to the lockfile are not allowed

When dependencies change, run:

```
bun install
```

---

# Dependency Installation Rules

When adding dependencies the AI should:

1. Determine the correct workspace package
2. Install the dependency only in that package
3. Avoid installing dependencies at the repository root unless required

Example:

Bad:

```
bun add axios
```

Better:

```
cd packages/api-client
bun add axios
```

---

# Monorepo Workspace Awareness

Zidney uses a **workspace-based monorepo structure**.

Relevant directories include:

```
apps/
packages/
```

Dependencies should be installed at the **correct workspace level**.

Shared utilities should live in `packages/` rather than being duplicated in apps.

---

# Dependency Safety

Before adding a new dependency the AI should verify:

1. Whether the functionality already exists in the repository
2. Whether an internal package provides the same capability
3. Whether the dependency is lightweight and maintained

Avoid introducing dependencies that:

• duplicate internal functionality
• add unnecessary runtime weight
• create security risks

---

# Script Execution Policy

All repository scripts should be executed using Bun.

Example:

```
bun run test
bun run lint
bun run build
```

Avoid using:

```
npm run
```

---

# Integration With Other Skills

This skill works together with:

```
ai-terminal
git-governance
architecture-intelligence
```

These skills ensure that dependency operations remain **safe, reproducible, and architecture-compliant**.

---

# Expected AI Behavior

When managing dependencies the AI should:

1. Use Bun as the package manager
2. Install dependencies in the correct workspace
3. Keep the lockfile consistent
4. Avoid unnecessary dependencies
5. Prefer internal packages over external ones

Dependency management must remain **predictable and reproducible across all environments**.
