# STAGE_UI_05_MMC_DASHBOARD

## Stage Type

Platform MMC — UI Feature Stage (MMC Operational Dashboard)

Depends On:

- Phase 06 UI Application Runtime
- STAGE_UI_01_MMC_SHELL_INTEGRATION
- STAGE_UI_02_API_CLIENT_LAYER
- STAGE_UI_04_GLOBAL_ERROR_HANDLING
- STAGE_15_MMC_DASHBOARD (Backend Aggregation APIs)
- STAGE_16_SHARED_UI_SYSTEM

---

# 🎯 Purpose

Implement the MMC Dashboard user interface.

This dashboard provides high-level operational visibility for:

- Licenses
- Products
- Affiliates
- Provisioning health
- System health indicators (read-only)

The dashboard is strictly read-only.
It aggregates backend-provided metrics and must not perform business calculations.

---

# 🧱 Functional Scope

The MMC Dashboard must include:

1. KPI summary cards:
   - Total active licenses
   - Total soft-locked licenses
   - Total archived licenses
   - Total products
   - Total affiliates
2. Provisioning status summary:
   - In-progress
   - Failed
   - Completed (last 24h)
3. Recent activity panel:
   - Recent license creations
   - Recent lifecycle transitions
   - Recent provisioning failures
4. Alerts section:
   - Version mismatch warnings
   - High failure rate warning
5. Quick navigation links:
   - Go to Licenses
   - Go to Products
   - Go to Affiliates

No analytics forecasting.
No financial modeling.
No time-series charts unless backend explicitly provides aggregated endpoint.

---

# 🧭 Routing

Route:

```
/dashboard
```

Requirements:

- Must be default route after login
- Protected by MMC auth guard
- Rendered inside AppLayout
- No role-based branching in UI (backend authoritative)

Router file:

```
core/router/mmc.routes.ts
```

---

# 🗂 Module Structure

```
modules/dashboard/
 ├── components/
 │   ├── DashboardKpiCard.vue
 │   ├── DashboardProvisioningPanel.vue
 │   ├── DashboardRecentActivity.vue
 │   ├── DashboardAlerts.vue
 │   └── DashboardQuickLinks.vue
 ├── dashboard.store.ts
 ├── dashboard.api.ts
 ├── types.ts
```

No dashboard logic outside this module.

---

# 📡 API Integration

All API calls must go through:

```
core/api/client
```

dashboard.api.ts must define:

- getDashboardSummary()
- getProvisioningOverview()
- getRecentActivity()
- getDashboardAlerts()

No HTTP calls inside components.

No direct axios/fetch usage.

---

# 🔄 State Management

dashboard.store.ts must manage:

State:

- summary
- provisioningOverview
- recentActivity
- alerts
- loading
- error

Actions:

- fetchDashboard()
- refreshDashboard()

Behavior:

- Fetch on mount
- Optional auto-refresh (configurable interval)
- Cancel auto-refresh on unmount
- Normalize API errors
- Trigger notification store if critical errors

No business calculations in store.

---

# 📊 KPI Cards

Each KPI card must:

- Use shared UI Card component
- Display value from backend
- Display label
- Support loading skeleton state
- Handle empty state gracefully

UI must NOT:

- Derive values manually
- Compute counts locally
- Store KPI history

---

# 🛠 Provisioning Panel

Display:

- Total provisioning in-progress
- Failed provisioning count
- Success rate (if backend provides percentage)

If failure rate exceeds threshold (from backend flag):

- Show alert badge

No client-side failure rate computation unless backend provides raw counts.

---

# 📋 Recent Activity Panel

Display list items:

- License created
- License soft-locked
- License archived
- Provisioning failed
- Affiliate created

Each item shows:

- Event type
- Workspace slug
- Timestamp
- Actor (if provided)

Limit to last N events (backend-defined).

No infinite scroll unless backend supports pagination.

---

# ⚠ Alerts Panel

Alerts may include:

- Version mismatch detected
- Provisioning backlog high
- System rate limit warning

Alerts must:

- Render banner component
- Be dismissible (client-only state)
- Not persist dismissal across sessions unless backend supports it

---

# 🔗 Quick Links Panel

Provide:

- Navigate to Licenses
- Navigate to Products
- Navigate to Affiliates
- Navigate to Members (if exists)

Must use router push.
No hard page reload.

---

# 🔐 Security Requirements

UI must:

- Never log sensitive data
- Not expose raw audit payload
- Not trust client time for any metric
- Not override backend visibility rules
- Not cache sensitive dashboard data long-term

401 → redirect to login  
403 → permission denied  
500 → global error handler

---

# 🧪 Testing Requirements

Unit tests:

- Dashboard store fetch test
- KPI rendering test
- Provisioning panel render test
- Alerts rendering test
- Auto-refresh behavior test

Manual validation:

- Login → dashboard loads automatically
- Hard refresh /dashboard
- Simulate API error
- Verify alerts render
- Verify navigation links work

---

# 🚫 Explicit Non-Goals

This stage does NOT:

- Implement analytics engine
- Implement chart library integration (unless backend supports)
- Modify any entity state
- Perform lifecycle actions
- Provide export/report download
- Provide financial reporting

Dashboard is read-only aggregation only.

---

# 🏁 Completion Criteria

Stage complete when:

- /dashboard route functional
- Summary metrics load correctly
- Provisioning panel works
- Recent activity renders
- Alerts display correctly
- Quick links navigate correctly
- No direct HTTP in components
- No TypeScript errors
- No ESLint errors
- Unit tests passing
- Manual smoke test completed

---

# Status

## Stage Status

DRAFT – Implementation not started
