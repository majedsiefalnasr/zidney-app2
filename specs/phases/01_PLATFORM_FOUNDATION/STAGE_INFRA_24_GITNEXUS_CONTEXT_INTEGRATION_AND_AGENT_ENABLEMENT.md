# STAGE_INFRA_24_GITNEXUS_CONTEXT_INTEGRATION_AND_AGENT_ENABLEMENT

## Stage Status

Status: DRAFT
Step: clarify
Risk Level: LOW
Last Updated: 2026-03-18T00:02:00.000Z

Scope Defined:

- 12 FRs + 6 NFRs captured
- GitNexus installed as `devDependency` via `bun add -D gitnexus`
- `scripts/gitnexus-context.ts`: full replacement (not extension)
- Structured output written to `docs/ai/context/gitnexus-context.json`
- `riskIndicators` field shape defined: module, riskScore (0-100), reason, affectedBy
- CI fail criteria: non-zero exit, schema violation, or script error (empty arrays pass)

Deferred Scope:

- Full-repo beyond 4-domain scope
- GitNexus MCP configuration
- `riskScore` exact range specification (implementation detail)

Constitutional Compliance:

- Clarifications resolved — planning authorized

Notes:
All specification ambiguities resolved. 5 clarification Q&As encoded in spec.md. Ready for technical planning.

---

## Purpose

Integrate **GitNexus** as a first-class intelligence layer inside Zidney to provide:

- repository-aware context
- change-aware reasoning
- architecture-aware decision support

This stage enables AI agents (especially the orchestrator) to operate with **deterministic, structured, and contextual awareness** instead of blind reasoning.

---

## Scope

This stage covers:

- GitNexus installation and configuration
- Wrapper script standardization
- Integration with Zidney orchestrator agent
- Context generation for:
  - changed files
  - architecture graph
  - dependency graph
  - git history
- Structured output for agent consumption
- Validation and deterministic testing

---

## Non-Goals

- Replacing AI-context system (this complements it)
- Replacing architecture guard or audits
- Full repo indexing beyond defined scope

---

## Success Criteria

- GitNexus runs locally and via scripts
- Context output is structured (JSON)
- Orchestrator consumes GitNexus output
- Decisions improve with contextual awareness
- Deterministic test cases pass

---

## Tasks

### T001 – Install GitNexus

Install GitNexus globally or locally:

```
bun add -g gitnexus
```

or project-local:

```
bun add gitnexus
```

Verify:

```
gitnexus --help
```

---

### T002 – Define Wrapper Script

Standardize access via:

```
scripts/gitnexus-context.ts
```

Responsibilities:

- Execute GitNexus commands
- Scope to:
  - changed files
  - dependency graph
  - architecture map
  - git history
- Normalize output into structured JSON

Output example:

```json
{
  "changedFiles": [],
  "dependencies": {},
  "architecture": {},
  "history": []
}
```

---

### T003 – Context Scope Definition

GitNexus MUST analyze:

- changed files (primary scope)
- dependency graph
- architecture map (via existing artifacts)
- git history (recent commits + diffs)

This ensures:

- minimal noise
- high-signal context

---

### T004 – Structured Output Contract

Define strict schema:

```
docs/ai/gitnexus-context.schema.json
```

Fields:

- changedFiles
- impactedModules
- dependencyGraph
- architectureLayerMap
- recentCommits
- riskIndicators

All outputs MUST conform to this schema.

---

### T005 – Orchestrator Integration (CRITICAL)

Update `zidney-orchestrator.agent.md`:

Add step:

```
Load GitNexus Context

- Execute: scripts/gitnexus-context.ts
- Parse structured output
- Use context to:
  - understand change scope
  - identify impacted modules
  - guide execution decisions
```

This step must occur:

- before planning
- during execution (on demand)
- before closure (validation)

---

### T006 – Execution Integration

Agents must use GitNexus for:

- impact analysis
- dependency reasoning
- change validation
- risk detection

Prohibit:

- blind reasoning without context
- ignoring GitNexus when available

---

### T007 – Deterministic Test Harness

Create:

```
tests/gitnexus-context.test.ts
```

Test cases:

1. Changed files detection
2. Dependency mapping accuracy
3. Architecture mapping correctness
4. Git history extraction
5. Stable output format

Failure = stage failure

---

### T008 – Validation Script

Create:

```
scripts/validate-gitnexus.ts
```

Responsibilities:

- run GitNexus
- validate schema
- verify required fields
- ensure no empty critical fields

---

### T009 – CI Integration

Add:

```
bun run validate-gitnexus
```

CI must fail if:

- GitNexus fails
- schema invalid
- output incomplete

---

### T010 – Closure Gate Integration

Add to orchestrator:

```
Before closure:

- MUST run GitNexus context generation
- MUST validate output
- MUST confirm context used in decisions
```

Failure → BLOCK closure

---

### T011 – Documentation

Create:

```
docs/ai/gitnexus.md
```

Include:

- what GitNexus is
- how Zidney uses it
- how to run
- output structure
- troubleshooting

---

### T012 – Governance Rule

Add to AGENTS.md:

```
AI agents MUST use GitNexus context when:
- evaluating changes
- performing impact analysis
- making architecture decisions
```

---

## Guard Guarantees

After this stage:

- AI agents are context-aware
- decisions are grounded in repo state
- change impact is deterministic
- blind reasoning is eliminated

---

## Risks

| Risk                 | Mitigation                           |
| -------------------- | ------------------------------------ |
| Incorrect context    | schema validation                    |
| Performance overhead | scoped analysis (changed files only) |
| Agent misuse         | orchestrator enforcement             |
| Drift from schema    | CI validation                        |

---

## Final Outcome

This stage upgrades Zidney from:

> AI-assisted system

to:

> **context-aware intelligent system powered by GitNexus**

where every decision is backed by:

- real repository state
- dependency understanding
- architectural awareness
