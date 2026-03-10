# PHASE 6 — UI APPLICATION RUNTIME

## Phase Type

Cross-Application Frontend Foundation

## Scope

This phase defines the shared runtime architecture for all Zidney frontend applications:

- MMC (Platform Admin)
- Backoffice (Tenant Admin)
- Frontoffice (Student Runtime)

This phase does NOT implement business features. It establishes the architectural runtime layer
required before any UI feature stages begin.

---

# 🎯 Objective

Create a stable, secure, and constitution-aligned SPA runtime foundation that:

- Enforces authentication boundaries
- Centralizes API communication
- Standardizes routing and guards
- Provides consistent state management
- Handles global error boundaries
- Ensures token security and refresh flows
- Integrates the shared UI system properly
- Prevents architectural drift across apps

This phase must be completed before any UI feature stage is implemented.

---

# 🧱 Architectural Positioning

Phase 06 sits ABOVE backend phases and BELOW UI feature stages.

```
Backend Phases (01–05)
        ↓
Phase 06 — UI Application Runtime
        ↓
UI Feature Stages (MMC / Backoffice / Frontoffice)
```

It is the frontend equivalent of:

- STAGE_01_MONOREPO_SETUP
- STAGE_02_MULTI_TENANCY_ARCHITECTURE
- STAGE_03_AUTHENTICATION_SYSTEM

But for SPA runtime architecture.

---

# 🔒 Constitutional Alignment

This phase must respect Zidney Constitution v1.2.0:

- No business logic in frontend
- No license enforcement in frontend
- No grading logic in frontend
- No direct DB communication
- All API calls pass through centralized client
- Token handling must not expose secrets
- Isolation enforced via backend, not assumed in UI

Frontend is presentation + orchestration only.

---

# 📦 Deliverables

This phase must produce:

- Unified SPA runtime blueprint
- Auth module (token handling + refresh flow)
- Central API client abstraction
- Router configuration + guards system
- Global error handler
- Environment configuration layer
- State management strategy
- Notification and feedback system integration
- Secure storage strategy (no unsafe token exposure)

---

# 🧩 Sub-Stages in This Phase

The following stages belong to Phase 06:

- STAGE_UI_00_RUNTIME_ARCHITECTURE.md
- STAGE_UI_01_AUTH_MODULE.md
- STAGE_UI_02_API_CLIENT_LAYER.md
- STAGE_UI_03_ROUTER_AND_GUARDS.md
- STAGE_UI_04_GLOBAL_ERROR_HANDLING.md
- STAGE_UI_05_ENV_CONFIGURATION.md
- STAGE_UI_06_STATE_MANAGEMENT.md
- STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION.md
- STAGE_UI_08_NOTIFICATION_AND_FEEDBACK.md
- STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING.md

Each stage must pass drift analysis before closure.

---

# 🚦 Completion Criteria

Phase 06 is considered complete when:

- All sub-stages are implemented
- All frontend apps (MMC, Backoffice, Frontoffice) share runtime foundation
- No app duplicates runtime logic
- Auth flows are verified
- API client is centralized and typed
- Router guards enforce role and access boundaries
- Token lifecycle is secure and tested
- No TODO placeholders remain
- CI passes without lint or type errors

Only then may UI feature stages begin.

---

# 🔄 Relationship With Other Phases

This phase does not replace backend stages. It consumes backend APIs defined in:

- 01_PLATFORM_FOUNDATION
- 02_PLATFORM_MMC
- 03_BACKOFFICE_CORE
- 04_RUNTIME
- 05_FRONTOFFICE_RUNTIME

It does not modify backend contracts.

---

# 📌 Governance Rule

No UI feature stage may be implemented before Phase 06 reaches:

STATUS: BACKEND CLOSED (UI Foundation Stable)

Feature UI work before runtime stabilization is forbidden.

---

# Status

## Stage Status

DRAFT – Implementation forbidden
