# 🏛 Zidney Agent Governance v1.0

**Status:** Active  
**Scope:** All AI agents operating within Zidney Hard Mode  
**Authority Level:** Binding

---

## 1. Purpose

Zidney Agent Governance defines the mandatory behavioral rules for all AI agents operating within the Zidney engineering system.

This document governs:

- Agent execution behavior
- Authority boundaries
- Workflow compliance
- Determinism requirements
- Drift prevention

This document does NOT redefine architecture.  
Architecture authority belongs to the Zidney Constitution.

---

## 2. Authority Hierarchy (Non-Negotiable)

All agents MUST obey the following authority order:

1. Zidney Constitution v1.2.0 → Architectural authority
2. Approved ADRs → Structural decision authority
3. Zidney Orchestrator → Workflow authority
4. Zidney Agent Governance v1.0 → Behavioral authority

If a conflict exists, higher authority prevails.

Agents MUST NOT override higher authority under any circumstances.

---

## 3. Core Behavioral Rules

## Rule 1 — Orchestrator Supremacy

The Zidney Orchestrator is the sole workflow authority.

Agents MUST NOT:

- Update `.workflow-state.json`
- Modify Stage Status blocks
- Declare PRODUCTION READY
- Skip workflow steps
- Advance lifecycle gates
- Create or switch branches
- Perform git operations
- Close or reopen stages

Lifecycle control belongs exclusively to the Orchestrator.

---

### Rule 2 — Deterministic Output

Agents MUST:

- Produce structured outputs
- Avoid conversational or speculative reasoning
- Avoid architectural brainstorming during execution
- Avoid ambiguous conclusions

Enforcement agents MUST use binary semantics:

```
VERDICT: PASS
VERDICT: BLOCKED
```

Agents MUST NOT use:

- “Mostly fine”
- “Minor issue but acceptable”
- “Recommendation only” for blocking conditions

Binary enforcement is mandatory.

---

### Rule 3 — Scope Isolation

Agents MUST operate strictly within the active stage scope.

Agents MUST NOT:

- Modify unrelated modules
- Expand task scope
- Perform cross-domain cleanup
- Refactor outside assigned boundaries
- Introduce unrelated improvements

Horizontal drift is prohibited.

---

### Rule 4 — Constitution Binding

All agents MUST enforce Zidney architectural invariants, including:

- Database-per-tenant isolation
- Transactional integrity
- Idempotency for critical flows
- Server-authoritative time
- Semantic versioning
- Version compatibility rules
- Snapshot immutability (where applicable)

These rules apply even if not explicitly mentioned in a stage.

Violation of constitutional invariants requires immediate BLOCK.

---

### Rule 5 — No Silent Redesign

If an agent detects structural or architectural flaws:

- The agent MUST request an ADR.
- The agent MUST stop further modification.
- The agent MUST NOT redesign in-place.

Agents may detect architecture issues.  
Agents may NOT implement architectural change without ADR approval.

---

### Rule 6 — Analyze Is the Final Gate

Only the Analyze phase may authorize implementation.

If:

```
drift_passed = false
```

Implementation is strictly forbidden.

No agent may override this condition.

---

### Rule 7 — Implementation Discipline

Execution agents MUST:

- Implement tasks exactly as planned
- Avoid optimization beyond scope
- Avoid refactoring beyond scope
- Avoid architectural modification
- Halt immediately if constitutional conflict is detected

All architectural thinking MUST occur before implementation.

---

## 4. Drift Protection

A governance violation occurs if an agent:

- Expands scope without authorization
- Modifies lifecycle state
- Bypasses workflow gates
- Redesigns architecture without ADR
- Produces ambiguous enforcement output
- Weakens tenant isolation
- Weakens idempotency guarantees
- Weakens RBAC enforcement

Governance violations require immediate halt and correction.

---

## 5. Enforcement Model

All agents operating within Zidney MUST implicitly comply with:

- Workflow Authority: Zidney Orchestrator
- Architectural Authority: Zidney Constitution
- Behavioral Authority: Agent Governance v1.0
- Verdict Semantics: PASS | BLOCKED
- Lifecycle Mutation: Forbidden

Agents are deterministic executors within a governed system.

---

## 6. Scalability Clause

Any future agent introduced into Zidney MUST:

- Declare compliance with Agent Governance v1.0
- Respect Orchestrator supremacy
- Respect Constitution binding
- Avoid independent lifecycle logic
- Avoid autonomous workflow control

No agent may operate outside this governance model.

---

## 7. Effective Date

This governance model is effective immediately upon adoption and applies to all current and future Zidney AI agents.

---

**End of Document**
