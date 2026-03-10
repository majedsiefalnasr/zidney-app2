# STAGE_UI_02_PRODUCTS

## Stage Type

Platform MMC — UI Feature Stage (Products Management UI)

Depends On:

- Phase 06 UI Application Runtime (complete)
- STAGE_UI_01_MMC_SHELL_INTEGRATION
- STAGE_09_PRODUCTS (Backend API + Domain)
- STAGE_16_SHARED_UI_SYSTEM

---

## Stage Status

Status: DRAFT

---

## Purpose

Implement the MMC Products Management user interface on top of the established shell and runtime
foundation.

This stage delivers:

- Products listing page
- Create product form
- Edit product form
- Activate / deactivate product actions
- Product detail view (optional read-only panel)

This stage consumes backend APIs defined in STAGE_09_PRODUCTS. It does NOT redefine backend
validation rules.

---

## Functional Scope

The Products UI must support:

1. List products (paginated)
2. Filter by status (ACTIVE / INACTIVE)
3. Search by product name
4. Create new product
5. Edit existing product
6. Activate / deactivate product
7. View product metadata (modules, limits, version)

No deletion flow unless backend explicitly supports it.

---

## Routing

Routes must follow:

```
/products
/products/create
/products/:id
/products/:id/edit
```

Route names must be declared in:

```
core/router/mmc.routes.ts
```

All routes must:

- Be protected by auth guard
- Render inside AppLayout
- Not bypass router-level security

---

## UI Structure

Folder structure inside MMC:

```
modules/products/
 ├── components/
 │   ├── ProductsTable.vue
 │   ├── ProductForm.vue
 │   ├── ProductStatusBadge.vue
 │   └── ProductFilters.vue
 ├── products.store.ts
 ├── products.api.ts
 ├── products.routes.ts (optional grouping)
 └── types.ts
```

No logic outside module folder.

---

## API Integration

All API calls must go through:

```
core/api/client
```

products.api.ts must define:

- getProducts(params)
- getProductById(id)
- createProduct(payload)
- updateProduct(id, payload)
- toggleProductStatus(id)

No fetch/axios inside components.

---

## State Management

products.store.ts must manage:

State:

- products: Product[]
- pagination
- filters
- loading
- error
- selectedProduct (optional)

Actions:

- fetchProducts
- fetchProductById
- createProduct
- updateProduct
- toggleStatus

Store must:

- Normalize API errors
- Trigger notifications via notification.store
- Not compute business rules
- Not persist sensitive data

---

## Product Form Behavior

Form must support:

Fields:

- name (multi-language structure if defined by backend)
- modules (enum list)
- limits (numeric fields)
- version (read-only if backend-controlled)
- status (if allowed during create)

Validation:

- Zod-based client validation
- Mirror backend constraints but do not replace them
- Disable submit while loading
- Show field-level validation messages

On success:

- Show success toast
- Redirect to /products
- Refresh list

On error:

- Display normalized error
- Preserve form input

---

## Products Table

Table must:

- Use shared DataTable from UI system
- Support pagination
- Support sorting (if backend supports)
- Show status badge
- Provide row actions:
  - Edit
  - Activate / Deactivate

Table must not:

- Contain business logic
- Mutate store state directly

---

## Status Handling

Status values from backend:

- ACTIVE
- INACTIVE

UI must:

- Render status badge with color
- Confirm before toggling status
- Handle 409 conflict gracefully

UI must not:

- Override backend response
- Optimistically change state without confirmation

---

## Security Considerations

UI must:

- Not expose internal IDs in logs
- Not decode JWT for permissions
- Rely on backend for authorization
- Handle 403 with notification

If backend returns:

401 → redirect to login  
403 → show permission denied toast  
409 → show conflict message

---

## Test Requirements

Must include:

- Unit tests for products.store
- Form validation test
- Table rendering test
- Toggle status test
- Error handling test (409, 500)
- Pagination state test

Manual validation:

- Create product flow
- Edit product flow
- Activate/deactivate flow
- Refresh page on /products
- Direct link to /products/:id/edit

---

## Explicit Non-Goals

This stage does NOT:

- Implement license linkage
- Implement affiliate linkage
- Implement billing logic
- Implement analytics
- Implement dashboard widgets

Only Products Management UI.

---

## Completion Criteria

Stage complete when:

- /products route functional
- Create/edit flows functional
- Toggle status works
- Pagination works
- Filters work
- All API calls centralized
- No direct API in components
- No TypeScript errors
- No ESLint errors
- Unit tests passing
- Manual smoke test complete

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
