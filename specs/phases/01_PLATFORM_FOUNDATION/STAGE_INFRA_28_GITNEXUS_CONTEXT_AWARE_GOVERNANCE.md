# STAGE_INFRA_28_GITNEXUS_CONTEXT_AWARE_GOVERNANCE

## Stage Status

Status: DRAFT
Step: plan
Risk Level: LOW
Last Updated: 2026-03-25T00:20:00Z

Scope Planned:

- `scripts/context/build.ts` — wraps `assembleContext()`, atomic write, --dry-run/--all/--force
- `scripts/context/changed.ts` — git diff --cached, 5-min freshness cache, writes context-changed.json
- `scripts/context/impact.ts` — filters riskIndicators from context artifact
- `scripts/context/validate.ts` — validates gitnexus-context.json (no external schema lib)
- `scripts/context/validate.test.ts` — 8 unit tests
- `package.json` — 4 new `context:*` scripts; `governance:gate:changed` updated
- `scripts/governance/gate.ts` — 2 guards prepended (context:build, context:validate)
- `.husky/pre-commit` — context:changed + context:validate inserted
- `.github/workflows/architecture-governance.yml` — build+validate CI step inserted
- `docs/scripts/context-*.md` — 4 registry entries

Deferred Scope:

- Full AI decision engine
- External context providers

Constitutional Compliance:

- Technical plan compliant — task generation authorized

Notes:
Technical plan complete. Risk Level = LOW. No migrations. No new dependencies. Task breakdown pending.

---

## Objective

Integrate **GitNexus** as a context intelligence layer into Zidney’s unified governance system to enable:

- Context-aware validation (changed files, dependency impact)
- Smarter orchestrator decisions
- Reduced false positives in governance checks
- Deterministic, explainable AI-assisted reasoning

This stage upgrades governance from **rule-based → context-aware enforcement**.

---

## Scope

### In Scope

- GitNexus installation and configuration
- Context extraction (changed files, dependency graph, git history)
- Integration with governance:gate
- Orchestrator integration
- Deterministic test validation
- Script-system alignment

### Out of Scope

- Full AI decision engine
- External context providers

---

## GitNexus Context Model

### Context Sources

| Source            | Purpose                 |
| ----------------- | ----------------------- |
| Changed Files     | Scope governance checks |
| Dependency Graph  | Impact analysis         |
| Git History       | Reasoning context       |
| Module Boundaries | Architecture alignment  |

---

## Command Surface

### Naming Convention

```
context:<action>
```

### Required Scripts

| Script             | Purpose                    |
| ------------------ | -------------------------- |
| `context:build`    | Generate GitNexus context  |
| `context:changed`  | Extract changed files      |
| `context:impact`   | Dependency impact analysis |
| `context:validate` | Validate context integrity |

---

## Script Implementation

### Location

```
scripts/context/
```

### Example

```ts
// scripts/context/build.ts
import { $ } from "bun";

await $`bun run gitnexus-context`;
```

---

## Package.json Integration

```json
{
  "scripts": {
    "context:build": "bun run scripts/context/build.ts",
    "context:changed": "bun run scripts/context/changed.ts",
    "context:impact": "bun run scripts/context/impact.ts",
    "context:validate": "bun run scripts/context/validate.ts"
  }
}
```

---

## Governance Integration

### Enhanced Gate Flow

```text
governance:gate
├── context:build
├── context:validate
├── arch:guard (scoped)
├── validate:runtime-scripts (scoped)
├── security:scan:ci (scoped)
└── ai-context:validate
```

### Behavior

- Scope checks based on changed files
- Expand scope using dependency impact
- Avoid full-repo scans when unnecessary

---

## Orchestrator Integration

### Step 5 — Analyze

The orchestrator MUST:

- Run `context:build`
- Use context for reasoning
- Pass context into skills

### Step 6 — Implement

- Use context-aware validation (`governance:gate:changed`)

### Step 7 — Closure

- Run full context-aware gate

---

## Deterministic Validation

### Required Guarantees

- Same input → same context output
- No randomness
- Stable dependency graph

### Test Command

```bash
bun run context:validate
```

---

## Pre-Commit Integration

Extend precommit-diagnostics:

```bash
bun run context:changed
bun run context:validate
```

---

## CI Integration

### Workflow Step

```yaml
- name: Build Context
  run: bun run context:build

- name: Validate Context
  run: bun run context:validate
```

---

## Reporting

### Output

```
docs/governance/context-report.md
```

### Includes

- Changed file set
- Impacted modules
- Dependency expansion
- Validation results

---

## Success Criteria

- Context correctly reflects changed files
- Dependency impact is accurate
- Governance uses scoped checks
- Orchestrator decisions improve
- Deterministic outputs verified

---

## Anti-Patterns (Forbidden)

❌ Running full governance without context
❌ Ignoring dependency impact
❌ Non-deterministic context generation
❌ Using context without validation

---

## Follow-Up

- Integrate context into AI decision scoring
- Add heatmap / risk scoring
- Extend to performance and cost analysis

---

## Notes

- Must integrate with STAGE_INFRA_27 governance gate
- Must align with script-system-governance
- Must remain deterministic and testable
