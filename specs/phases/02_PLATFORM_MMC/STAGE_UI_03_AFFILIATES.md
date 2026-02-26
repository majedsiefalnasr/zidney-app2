# STAGE_UI_03_AFFILIATES

## Stage Type

Platform MMC — UI Feature Stage (Affiliates Management UI)

Depends On:

- Phase 06 UI Application Runtime (complete)
- STAGE_UI_01_MMC_SHELL_INTEGRATION
- STAGE_13_AFFILIATES (Backend API + Domain)
- STAGE_16_SHARED_UI_SYSTEM

---

## Stage Status

Status: DRAFT

---

## Purpose

Implement the MMC Affiliates Management user interface.

This stage delivers:

- Affiliates listing page
- Create affiliate flow
- Edit affiliate details
- Activate / deactivate affiliate
- View affiliate performance summary (read-only metrics)
- Associate promo code (if backend supports)

This stage consumes STAGE_13_AFFILIATES backend APIs.
It does NOT implement payout logic or financial disbursement.

---

## Functional Scope

The Affiliates UI must support:

1. List affiliates (paginated)
2. Filter by status (ACTIVE / INACTIVE / SUSPENDED if supported)
3. Search by affiliate name or code
4. Create new affiliate
5. Edit affiliate profile
6. Activate / deactivate affiliate
7. View summary metrics:
   - Total referrals
   - Total conversions
   - Commission earned (read-only)
8. View associated promo code (if applicable)

No payout management in this stage.

---

## Routing

Routes must follow:

```
/affiliates
/affiliates/create
/affiliates/:id
/affiliates/:id/edit
```

Routes must:

- Be protected by auth guard
- Render inside AppLayout
- Not bypass runtime security
- Not decode JWT for permission decisions

Route definitions live in:

```
core/router/mmc.routes.ts
```

---

## UI Structure

Folder structure inside MMC:

```
modules/affiliates/
 ├── components/
 │   ├── AffiliatesTable.vue
 │   ├── AffiliateForm.vue
 │   ├── AffiliateStatusBadge.vue
 │   ├── AffiliateMetricsPanel.vue
 │   └── AffiliateFilters.vue
 ├── affiliates.store.ts
 ├── affiliates.api.ts
 ├── types.ts
```

No affiliate logic outside this module.

---

## API Integration

All API calls must go through:

```
core/api/client
```

affiliates.api.ts must define:

- getAffiliates(params)
- getAffiliateById(id)
- createAffiliate(payload)
- updateAffiliate(id, payload)
- toggleAffiliateStatus(id)
- getAffiliateMetrics(id)

No direct HTTP calls in components.

---

## State Management

affiliates.store.ts must manage:

State:

- affiliates: Affiliate[]
- pagination
- filters
- loading
- error
- selectedAffiliate
- metrics (optional)

Actions:

- fetchAffiliates
- fetchAffiliateById
- createAffiliate
- updateAffiliate
- toggleStatus
- fetchMetrics

Store must:

- Normalize API errors
- Trigger notification.store for success/error
- Avoid financial calculations (backend authoritative)
- Avoid persisting sensitive data

---

## Affiliate Form Behavior

Fields (based on backend model):

- name
- email (if supported)
- commission_rate
- status
- optional promo_code
- notes (if backend supports)

Validation:

- Zod-based client validation
- commission_rate numeric & within backend constraints
- promo_code uppercase pattern if defined

On success:

- Show success notification
- Redirect to /affiliates
- Refresh list

On error:

- Display normalized error
- Preserve input

---

## Affiliates Table

Table must:

- Use shared DataTable component
- Support pagination
- Support filtering by status
- Display:
  - Name
  - Status
  - Commission rate
  - Referrals count
  - Conversions count
- Provide row actions:
  - Edit
  - Activate / Deactivate
  - View details

No business logic in table.

---

## Metrics Panel

If backend provides metrics endpoint:

Affiliate detail view must show:

- Total referrals
- Total conversions
- Total commission earned
- Conversion rate (computed locally from backend values only)

UI must not:

- Recalculate commission independently
- Override backend totals
- Persist metrics locally

---

## Status Handling

Possible statuses:

- ACTIVE
- INACTIVE
- SUSPENDED (if backend supports)

UI must:

- Confirm before deactivation
- Handle 409 conflicts
- Show clear status badge
- Reflect backend response only after success

No optimistic mutation without confirmation.

---

## Security Considerations

UI must:

- Not log promo codes in plaintext
- Not expose commission data in console logs
- Not decode JWT for affiliate permissions
- Rely entirely on backend authorization

If backend returns:

401 → redirect to login  
403 → show permission denied notification  
409 → show conflict message

---

## Test Requirements

Must include:

- Unit tests for affiliates.store
- Commission rate validation test
- Toggle status test
- Metrics rendering test
- Error handling tests (401, 403, 409, 500)
- Pagination state test

Manual validation:

- Create affiliate
- Edit affiliate
- Activate/deactivate affiliate
- View metrics
- Hard refresh on detail route
- Direct URL navigation

---

## Explicit Non-Goals

This stage does NOT:

- Implement payout disbursement
- Implement invoice generation
- Implement revenue analytics dashboard
- Implement affiliate hierarchy
- Implement payment provider integration

Only Affiliates Management UI.

---

## Completion Criteria

Stage complete when:

- /affiliates route functional
- Create/edit flows working
- Status toggle working
- Metrics panel renders correctly
- Filters + pagination working
- All API calls centralized
- No API calls inside components
- No TypeScript errors
- No ESLint errors
- Unit tests passing
- Manual smoke test complete

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
