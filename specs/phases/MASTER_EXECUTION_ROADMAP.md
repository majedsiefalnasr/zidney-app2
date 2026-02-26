# MASTER EXECUTION ROADMAP

---

⚖ Governance Authority:
This roadmap operates under the binding authority of:

- Zidney Constitution v1.2.0
- ZIDNEY_GOVERNANCE_CHARTER.md (specs/ZIDNEY_GOVERNANCE_CHARTER.md)

If any conflict exists between this roadmap and the Governance Charter, the Charter prevails.

---

## Zidney Full System Build Sequence

This document defines the global execution order for the entire Zidney platform.

It connects:

- All Phases
- All Backend Stages
- All UI Stages
- All Validation Stages

This roadmap prevents architectural drift and execution disorder.

---

# 🏗 GLOBAL PHASE ORDER

The platform must be built strictly in this order:

1️⃣ PHASE 01 – PLATFORM FOUNDATION  
2️⃣ PHASE 02 – PLATFORM MMC  
3️⃣ PHASE 03 – BACKOFFICE CORE  
4️⃣ PHASE 04 – ATTEMPT ENGINE RUNTIME  
5️⃣ PHASE 05 – FRONTOFFICE RUNTIME  
6️⃣ PHASE 06 – UI APPLICATION RUNTIME CORE

No phase may skip prerequisites.

---

# 🧱 PHASE 01 – PLATFORM FOUNDATION

Goal: Build the architectural backbone.

Includes:

- Monorepo setup
- Multi-tenancy architecture
- Master DB schema
- Tenant baseline schema
- Migration/versioning model
- Authentication system
- License engine
- Tenant provisioning
- Attempt engine foundation
- Observability baseline
- Rate limiting & security

Status Required Before Moving Forward:

- Tenant isolation guaranteed
- Provisioning deterministic
- License enforcement operational
- Attempt engine safe

---

# 🏢 PHASE 02 – PLATFORM MMC

Goal: Build the platform management layer.

Backend Stages:

- Products
- Licenses
- License lifecycle
- Provisioning trigger
- Affiliates
- MMC members
- MMC dashboard

UI Stages:

- MMC Shell Integration
- Products UI
- Affiliates UI
- Licenses UI
- MMC Dashboard UI
- MMC Members UI
- Provisioning Monitoring UI

Validation Stage:

- STAGE_TEST_01_MMC_SYSTEM_VALIDATION

Exit Condition:

- Platform-level administration fully operational
- No cross-tenant leakage
- Provisioning stable

---

# 🏫 PHASE 03 – BACKOFFICE CORE

Goal: Tenant academic & operational engine.

Backend Domains:

- Academic structure
- Content classification
- Exam configuration
- User management
- Commercial layer
- Media library
- Communication layer
- Backoffice dashboard

UI Domains:

- Backoffice shell
- Academic structure UI
- Exam management UI
- User management UI
- Commercial UI
- Media UI
- Communication UI
- Dashboard UI

Validation Stage:

- STAGE_TEST_01_BACKOFFICE_SYSTEM_VALIDATION

Exit Condition:

- Tenant-level operations stable
- Exam configuration deterministic
- User & permission system enforced

---

# 🧠 PHASE 04 – ATTEMPT ENGINE RUNTIME

Goal: Secure real-time attempt execution.

Includes:

- Attempt schema
- Attempt start flow
- Answer autosave
- Submission flow
- Reconnection logic
- Concurrency guards

Validation Stage:

- STAGE_TEST_01_RUNTIME_SYSTEM_VALIDATION

Exit Condition:

- Deterministic grading
- Snapshot immutability
- Concurrency safe
- No replay attacks

---

# 🎓 PHASE 05 – FRONTOFFICE RUNTIME

Goal: Student-facing runtime system.

Backend Stages:

- Frontoffice auth
- Subscription enforcement
- Visibility rules
- Dashboard aggregation
- Library runtime
- Live session runtime
- Notification system
- Ads runtime
- Results & certificates

UI Stages:

- Frontoffice shell
- Auth UI
- Dashboard UI
- Library UI
- Attempt runtime UI
- Results UI
- Subscription gates UI
- Notifications UI
- Live sessions UI
- Ads runtime UI

Validation Stage:

- STAGE_TEST_01_FRONTOFFICE_SYSTEM_VALIDATION

Exit Condition:

- Student runtime secure
- Subscription gating enforced
- Division filtering correct
- No cross-tenant access

---

# 🖥 PHASE 06 – UI APPLICATION RUNTIME CORE

Goal: Shared frontend infrastructure.

Includes:

- Runtime architecture
- Auth module
- API client layer
- Router & guards
- Global error handling
- Environment config
- State management
- Layout integration
- Notification integration
- Security & token handling

This phase supports Phases 02–05.

---

# 🔄 Cross-Phase Rules

1. No UI stage may implement business logic.
2. No frontend may bypass middleware.
3. All isolation enforced server-side.
4. Validation stage required before marking PRODUCTION READY.
5. BACKEND CLOSED ≠ PRODUCTION READY.

---

# 🚦 Production Readiness Model

Each phase transitions through:

- DRAFT
- IN PROGRESS
- BACKEND CLOSED
- VALIDATED
- PRODUCTION READY

Only after validation stage passes may phase move to PRODUCTION READY.

---

# 🛑 Hard Stops

Stop immediately if:

- Cross-tenant access detected
- Middleware bypass discovered
- Client-side business logic introduced
- Migration immutability broken
- Snapshot integrity compromised

---

# 📈 Recommended Execution Strategy

Single Developer Strategy:

1. Complete backend of phase
2. Implement UI layer
3. Execute validation stage
4. Move to next phase

Team Strategy:

- Backend & UI parallel only after contracts locked
- Validation owned by independent reviewer

---

# 🏁 Final System Completion

Zidney is considered COMPLETE when:

- All phases marked PRODUCTION READY
- All validation stages passed
- No unresolved architectural drift
- No isolation vulnerabilities
- Observability & monitoring active

---

This roadmap is the single source of truth for execution order.

---

# 🔐 GOVERNANCE REFERENCE

For full governance rules including:

- Stage lifecycle enforcement
- Hard Mode closure model
- Numeric stage discipline
- Migration immutability rules
- AI development protocol
- Production readiness model

Refer to:

specs/ZIDNEY_GOVERNANCE_CHARTER.md

This document is subordinate to the Governance Charter.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0

---

# 🔗 VISUAL DEPENDENCY MATRIX (PHASE‑TO‑PHASE CONTRACT MAP)

This matrix defines what each phase PROVIDES and what the next phase CONSUMES.

It prevents hidden coupling and enforces architectural contracts.

---

## Phase 01 ➜ Phase 02

Phase 01 PROVIDES:

- Multi‑tenancy resolver
- License engine
- Provisioning engine
- Master & tenant schema
- Authentication base

Phase 02 CONSUMES:

- License lifecycle
- Tenant provisioning trigger
- Workspace isolation guarantees

❌ Phase 02 must NOT redefine tenant logic.

---

## Phase 02 ➜ Phase 03

Phase 02 PROVIDES:

- Tenant provisioning
- Product & license management
- Tenant activation states

Phase 03 CONSUMES:

- Active tenant database
- License enforcement middleware

❌ Phase 03 must NOT access master DB directly.

---

## Phase 03 ➜ Phase 04

Phase 03 PROVIDES:

- Academic structure
- Exam configuration
- Question models
- User & role system

Phase 04 CONSUMES:

- Exam definitions (read‑only)
- User identity (student/staff)

❌ Phase 04 must NOT mutate exam configuration.

---

## Phase 04 ➜ Phase 05

Phase 04 PROVIDES:

- Deterministic attempt runtime
- Grading engine
- Snapshot immutability

Phase 05 CONSUMES:

- Attempt execution API
- Result retrieval API

❌ Phase 05 must NOT re‑implement grading logic.

---

## Phase 06 ➜ Phases 02–05

Phase 06 PROVIDES:

- Router & guards
- API client layer
- Token management
- Error boundaries
- Layout system

All UI Phases CONSUME:

- Runtime contracts
- Auth module
- State management

❌ Phase 06 must NOT embed business rules.

---

# 🔢 PHASE‑TO‑STAGE NUMERIC DEPENDENCY TABLE

This table defines the official numeric stage ranges per phase.
It prevents stage misalignment and enforces execution boundaries.

| Phase | Name                        | Stage Range | Depends On Phase | Notes                               |
| ----- | --------------------------- | ----------- | ---------------- | ----------------------------------- |
| 01    | PLATFORM FOUNDATION         | 01–08       | —                | Architectural backbone              |
| 02    | PLATFORM MMC                | 09–16       | 01               | Consumes tenant + license core      |
| 03    | BACKOFFICE CORE             | 17–52       | 01–02            | Tenant academic & operational layer |
| 04    | ATTEMPT ENGINE RUNTIME      | 53–58       | 03               | Consumes exam configuration only    |
| 05    | FRONTOFFICE RUNTIME         | 59–67       | 03–04            | Student-facing runtime              |
| 06    | UI APPLICATION RUNTIME CORE | UI‑00–UI‑09 | 01               | Shared frontend infrastructure      |

---

## Execution Rules

1. A phase may not execute any stage outside its numeric range.
2. A phase may not consume a later phase.
3. UI stages (UI‑XX) must reference an existing backend stage.
4. Validation stages (STAGE_TEST_XX) are tied to their owning phase.
5. New stage numbers require governance update in this table.

This table is the authoritative numeric contract for Zidney execution order.

# 🛡 GOVERNANCE ENFORCEMENT APPENDIX

This appendix formalizes Hard Mode and Stage Status governance.

---

## Hard Mode Enforcement Model

Before any stage is marked complete:

1. Drift analysis must PASS.
2. All tasks must be marked [X].
3. Validation stage must execute.
4. No unresolved architectural contradictions.
5. Migration immutability verified.

If any condition fails → Stage remains IN PROGRESS.

---

## Stage Status Model (Formal Definition)

Each stage must contain a "## Stage Status" block with one of:

- DRAFT – Specification only. Implementation forbidden.
- IN PROGRESS – Implementation active.
- BACKEND CLOSED – Backend locked; no structural changes allowed.
- VALIDATED – Validation stage passed.
- PRODUCTION READY – Staging validation complete.
- DEPRECATED – Replaced by newer stage.

Missing Stage Status block = GOVERNANCE FAILURE.

---

## Promotion Rules

A stage may transition:

DRAFT ➜ IN PROGRESS  
IN PROGRESS ➜ BACKEND CLOSED  
BACKEND CLOSED ➜ VALIDATED  
VALIDATED ➜ PRODUCTION READY

Skipping states is forbidden.

---

## UI Governance Rules

- UI stages may NEVER introduce business rules.
- UI must consume API contracts only.
- UI validation stage mandatory before promotion.
- Client‑side filtering does NOT replace server filtering.

---

## Closure Requirements

A phase may only be marked PRODUCTION READY when:

- All backend stages are BACKEND CLOSED.
- All UI stages implemented.
- Validation stage passed.
- No open drift findings.

---

This appendix is binding across all phases.

Violations require new stage + ADR.

---
