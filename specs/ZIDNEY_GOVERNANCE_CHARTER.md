# ZIDNEY GOVERNANCE CHARTER

Version: 1.0.0  
Authority: Zidney Constitution v1.2.0  
Scope: Entire Zidney Platform (All Phases, All Stages, All UI Layers)

---

# 1. PURPOSE

This Governance Charter defines the binding architectural, execution, and validation rules for the Zidney platform.

It exists to:

- Prevent architectural drift
- Enforce tenant isolation
- Standardize stage lifecycle
- Control execution order
- Govern AI-assisted development
- Protect constitutional invariants

This document overrides informal practices.

All contributors (human or AI) must comply.

---

# 2. GOVERNANCE HIERARCHY

The authoritative order of control is:

1. Zidney Constitution v1.2.0
2. ZIDNEY_GOVERNANCE_CHARTER.md
3. MASTER_EXECUTION_ROADMAP.md
4. Phase documents (PHASE_X_OVERVIEW / IMPLEMENTATION)
5. Stage documents (STAGE*XX*\*.md)

Lower-level artifacts may not contradict higher-level authority.

---

# 3. STAGE LIFECYCLE MODEL

Every stage must contain a:

```
## Stage Status
```

Allowed statuses:

- DRAFT – Specification only. Implementation forbidden.
- IN PROGRESS – Implementation active.
- BACKEND CLOSED – Backend complete and frozen.
- VALIDATED – Validation stage passed.
- PRODUCTION READY – Staging validation complete.
- DEPRECATED – Replaced by newer stage.

Rules:

- Status block is mandatory.
- Missing block = governance violation.
- Skipping lifecycle states is forbidden.

Promotion sequence:

DRAFT → IN PROGRESS → BACKEND CLOSED → VALIDATED → PRODUCTION READY

---

# 4. HARD MODE ENFORCEMENT

Before any stage may close:

1. Drift analysis must PASS.
2. All tasks marked [X].
3. Migration immutability verified.
4. No unresolved contradictions.
5. Validation stage defined.

Closure is forbidden if any condition fails.

---

# 5. NUMERIC STAGE DISCIPLINE

Stage numbers are phase-bound.

| Phase | Stage Range |
| ----- | ----------- |
| 01    | 01–08       |
| 02    | 09–16       |
| 03    | 17–52       |
| 04    | 53–58       |
| 05    | 59–67       |
| 06    | UI-00–UI-09 |

Rules:

- No stage may use a number outside its phase range.
- Adding new stage numbers requires updating MASTER_EXECUTION_ROADMAP.
- Reusing numbers is forbidden.

---

# 6. TENANT ISOLATION GUARANTEE

The following are absolute invariants:

- No cross-tenant data access.
- No master_db access from tenant runtime.
- All tenant access via resolver middleware.
- No client-trusted filtering.

Violation = CRITICAL BLOCKER.

---

# 7. UI GOVERNANCE RULES

UI layers must:

- Consume API only.
- Never embed business logic.
- Never bypass middleware.
- Never perform security enforcement locally.
- Mirror backend access states only.

All UI phases require validation stage before promotion.

---

# 8. MIGRATION DISCIPLINE

Rules:

- Migrations are forward-only.
- Migration files immutable after commit.
- Hash validation required in CI.
- Reverse migration documented for staging only.

Production rollback must be explicit and controlled.

---

# 9. VALIDATION REQUIREMENT

Each phase must include a:

```
STAGE_TEST_01_*.md
```

A phase cannot be PRODUCTION READY without:

- E2E tests passing
- Isolation verified
- Security validation executed
- Performance targets met

BACKEND CLOSED ≠ PRODUCTION READY.

---

# 10. AI DEVELOPMENT PROTOCOL

When using AI agents:

- AI must validate against Constitution before output.
- AI must not invent architectural changes.
- AI must respect Stage Status.
- AI must not modify frozen stages.

All AI-generated code is subject to drift audit.

---

# 11. VIOLATION RESPONSE MODEL

If governance violation detected:

1. STOP implementation immediately.
2. Create remediation task.
3. Run drift analysis.
4. Document resolution.

Repeated violations require ADR.

---

# 12. PRODUCTION READINESS MODEL

A phase is PRODUCTION READY only when:

- All stages BACKEND CLOSED.
- Validation stage PASSED.
- No open drift findings.
- Observability active.
- Monitoring configured.

Otherwise, status remains VALIDATED or BACKEND CLOSED.

---

# 13. ESCALATION & CHANGE CONTROL

Changes to this Charter require:

- Explicit version bump
- Governance review
- Roadmap update (if stage ranges change)
- Commit message referencing Charter update

---

# 14. FINAL AUTHORITY STATEMENT

This Charter is binding across:

- Backend
- UI
- Runtime
- Validation
- CI/CD
- AI orchestration

No informal deviation permitted.

Constitutional Compliance Required  
Zidney Constitution v1.2.0

---
