# PHASE 5 – FRONTOFFICE RUNTIME IMPLEMENTATION

## 🎯 Phase Mission

Phase 5 delivers the complete Student Runtime layer.

This phase turns the platform into a real usable product for students.

It connects:

- Authentication
- Subscription control
- Visibility rules
- Attempt engine
- Live sessions
- Notifications
- Ads
- Results & Certificates

This phase does **NOT** introduce new domain models. It strictly consumes:

- Phase 3 (Backoffice data)
- Phase 4 (Attempt Engine runtime)

This is a runtime enforcement phase.

---

# 🧱 Execution Order (Strict & Sequential)

Backend stages must be completed in this exact order:

1. STAGE_59_FRONTOFFICE_AUTH
2. STAGE_60_SUBSCRIPTION_ENFORCEMENT
3. STAGE_61_CONTENT_VISIBILITY_RULES
4. STAGE_62_DASHBOARD_AGGREGATION
5. STAGE_63_LIBRARY_RUNTIME
6. STAGE_64_LIVE_SESSION_RUNTIME
7. STAGE_65_NOTIFICATION_SYSTEM
8. STAGE_66_ADS_RUNTIME
9. STAGE_67_RESULTS_AND_CERTIFICATES

Then execute:

10. STAGE_UI_01 → STAGE_UI_10 (Frontoffice UI)
11. STAGE_TEST_01_FRONTOFFICE_SYSTEM_VALIDATION

Order must not change.

---

# 🔐 Stage 59 – Student Authentication

Goal: Secure workspace-bound student login.

Must implement:

- Workspace-scoped login endpoint
- JWT issuance (student role only)
- workspace_id validation
- division_id binding
- subscription_status in token

Token must include:

- workspace_id
- user_id
- division_id
- subscription_status
- role = STUDENT

❌ No staff login in this phase.

Validation:

- Cross-workspace token rejected
- Expired token rejected

---

# 💳 Stage 60 – Subscription Enforcement

Goal: Enforce subscription rules centrally.

Middleware must block when expired:

- Dashboard access
- Attempt start
- Library access
- Live join

Allowed when expired:

- Profile
- Certificate download
- Payment/renewal

Subscription evaluation must be:

- Server-side only
- Token-based + DB-verified

---

# 👁 Stage 61 – Content Visibility Enforcement

Goal: Enforce strict visibility filtering.

All queries must filter by:

- workspace_id
- division_id (mandatory)
- department_id (optional)
- group_id (optional)
- scheduled window (when applicable)

❌ No client-side filtering trusted.

Filtering must occur in SQL layer.

---

# 📊 Stage 62 – Dashboard Aggregation

Goal: Provide a consolidated student dashboard.

Dashboard includes:

- Upcoming exams
- Upcoming live sessions
- Certificates
- Performance summary
- Notification preview

Constraints:

- Strict workspace scope
- Strict division scope
- No heavy analytics

---

# 📚 Stage 63 – Library Runtime

Goal: Secure content browsing.

Must enforce:

- Visibility rules
- Subscription rules
- File access authorization
- File access logging

❌ No file download without visibility validation.

---

# 🎥 Stage 64 – Live Session Runtime

Goal: Secure live session participation.

Must validate:

- Division eligibility
- Subscription status
- Scheduled window

Must track:

- Join timestamps
- Attendance logs

❌ No direct provider URL exposure without backend validation.

---

# 🔔 Stage 65 – Notification System

Goal: Real-time student updates.

Implementation:

- WebSocket delivery
- JWT validation at handshake
- Workspace-scoped channel

Events include:

- Exam reminder
- Live reminder
- Result published
- System announcement

---

# 📢 Stage 66 – Ads Runtime

Goal: Controlled advertisement rendering.

Ads filtered by:

- Division
- Department
- Group
- Placement location

Ads must:

- Never bypass visibility
- Never block runtime
- Respect subscription suppression

---

# 🏆 Stage 67 – Results & Certificates

Goal: Safe result and certificate access.

Must:

- Retrieve results read-only
- Respect exam configuration flags
- Respect show/hide rules
- Serve versioned certificates

❌ No recalculation of historical attempts.

---

# 🖥 UI Implementation Layer

After backend stages 59–67:

Implement:

- Frontoffice Shell
- Student Auth UI
- Dashboard UI
- Library UI
- Attempt UI
- Results UI
- Live Sessions UI
- Ads UI
- Subscription gating UI
- Notifications UI

UI must:

- Never duplicate business logic
- Consume API only
- Respect backend access states

---

# 🧪 System Validation Stage

Execute STAGE_TEST_01_FRONTOFFICE_SYSTEM_VALIDATION.

Must validate:

- E2E student flow
- Isolation guarantees
- Subscription enforcement
- Attempt integrity
- Security checks (JWT tampering, injection)
- Performance targets

Phase cannot be marked PRODUCTION READY without this stage passing.

---

# 🚫 Hard Constraints

Frontoffice must NEVER:

- Access master_db
- Bypass tenant resolver
- Trust client-provided IDs
- Perform business logic client-side

All enforcement lives in backend.

---

# ✅ Phase Completion Criteria

Phase is complete when:

- Student login stable
- Subscription gating enforced
- Division filtering correct
- Scheduled windows respected
- Live attendance tracked
- Notifications delivered
- Ads controlled
- Results respect configuration
- Certificates immutable
- No isolation leakage

---

# 🏁 Exit Condition

Phase 5 is considered stable when:

- No cross-division access possible
- No subscription bypass possible
- No archived workspace accessible
- No attempt replay possible
- All runtime modules enforce workspace isolation

Only then may optimization and scaling begin.

---
