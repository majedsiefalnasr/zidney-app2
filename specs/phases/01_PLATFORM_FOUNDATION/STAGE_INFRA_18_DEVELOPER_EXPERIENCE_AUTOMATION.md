# STAGE_INFRA_18_DEVELOPER_EXPERIENCE_AUTOMATION

## Stage Status

Status: DRAFT
Step: plan
Risk Level: LOW
Last Updated: 2026-03-15T00:00:00Z

Scope Planned:

- scripts/dev/repo-doctor.ts — 7-check diagnostic runner
- scripts/dev/repo-fix.ts — 5-step automated repair runner
- scripts/dev/repo-onboard.ts — 7-step onboarding automation
- scripts/dev/repo-status.ts — repository health summary reporter
- Root package.json: 4 script entries + engines.bun field
- .github/workflows/ci.yml: repo-doctor job in Group 1
- README.md: Developer Quick Commands section

Deferred Scope:

- JSON output mode for commands (deferred to future stage)

Constitutional Compliance:

- Technical plan compliant — task generation authorized
- Guardian validation: Architecture Checker PASS, API Designer PASS

Notes:
Technical plan complete. Task breakdown in progress.

---

## Purpose

This stage introduces a **Developer Experience (DX) automation layer** for the Zidney monorepo.

The goal is to make the repository **self-diagnosing, self-repairing, and easy to onboard**, while maintaining strict architecture governance.

This stage adds automated tools that help developers and AI agents:

- diagnose repository issues
- repair common problems automatically
- detect environment misconfiguration
- ensure architecture compliance
- speed up onboarding for new contributors

The result is a **developer-friendly monorepo that remains governance-safe**.

---

# DX Automation Capabilities

After this stage the repository gains a new command surface:

```
bun repo:doctor
bun repo:fix
bun repo:onboard
bun repo:status
```

These commands act as **high-level developer automation utilities**.

---

# Phase 1 — Repository Doctor

Create a repository diagnostic command:

```
bun repo:doctor
```

This command runs automated checks for:

- missing dependencies
- broken workspace links
- outdated architecture context
- invalid AI context artifacts
- missing environment configuration
- stale generated artifacts
- invalid TypeScript configuration

Internally this command executes:

```
bun arch:guard
bun arch:validate-brain
bun type-safety-guard
bun ai-context:validate
```

Output example:

```
✔ dependencies OK
✔ architecture guard OK
✔ AI context OK
⚠ environment variables missing
```

---

# Phase 2 — Automatic Fixer

Create a repository repair command:

```
bun repo:fix
```

This command attempts to automatically fix common issues such as:

- reinstalling dependencies
- regenerating architecture context
- refreshing architecture map
- removing stale build artifacts
- pruning unused dependencies

Typical fix flow:

```
bun install
bun arch:generate
bun ai-context:refresh
bun pm prune
```

This significantly reduces manual troubleshooting.

---

# Phase 3 — Developer Onboarding Automation

Create an onboarding command:

```
bun repo:onboard
```

This command prepares a new developer environment automatically.

Steps performed:

1. Verify Bun installation
2. Install dependencies
3. Setup Husky hooks
4. Verify PostgreSQL availability
5. Verify Redis availability
6. Generate AI context
7. Run architecture validation

Output example:

```
✔ bun detected
✔ dependencies installed
✔ husky hooks active
✔ architecture guard validated
```

This reduces onboarding time dramatically.

---

# Phase 4 — Repository Status Command

Create a repository status command:

```
bun repo:status
```

This command prints a summarized view of repository health.

Example output:

```
Repository Status
-----------------
Architecture Health: 98%
AI Context: Fresh
Type Safety: Strict
CI Pipelines: Passing
```

Internally this command uses:

```
bun arch:health
bun ai-context:validate
```

---

# Phase 5 — Environment Verification

Create a script that verifies required local services.

Required services:

```
PostgreSQL
Redis
Docker
```

If services are missing the tool prints actionable guidance.

Example:

```
Redis not detected
Run:

docker compose up redis
```

---

# Phase 6 — Script Entry Points

Add new scripts to root `package.json`:

```
"repo:doctor": "bun scripts/dev/repo-doctor.ts",
"repo:fix": "bun scripts/dev/repo-fix.ts",
"repo:onboard": "bun scripts/dev/repo-onboard.ts",
"repo:status": "bun scripts/dev/repo-status.ts"
```

These scripts live under:

```
scripts/dev/
  repo-doctor.ts
  repo-fix.ts
  repo-onboard.ts
  repo-status.ts
```

---

# Phase 7 — CI Integration

Integrate repository doctor into CI.

Example workflow step:

```
- name: Repository Doctor
  run: bun repo:doctor
```

This ensures broken environments are detected early.

---

# Phase 8 — Documentation Update

Update the root README with a developer quick-start section:

```
Developer Quick Commands
------------------------
bun repo:onboard
bun repo:doctor
bun repo:fix
bun repo:status
```

This ensures new contributors can immediately understand how to interact with the repository.

---

# Validation

After implementing this stage run:

```
bun repo:doctor
bun repo:status
```

Both commands must succeed without errors.

---

# Expected Result

After this stage:

- onboarding becomes automated
- environment issues are easy to diagnose
- architecture violations are detected early
- developers have clear automation tools

The Zidney monorepo becomes **developer-friendly without sacrificing architecture governance**.

---

# Completion Criteria

The stage is complete when:

- repository doctor command works
- repository fix command works
- onboarding automation works
- repository status command works
- CI integration succeeds
