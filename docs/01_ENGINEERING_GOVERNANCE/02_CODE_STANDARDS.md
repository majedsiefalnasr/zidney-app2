# Code Standards

These standards are mandatory across Zidney. Violations are architectural defects.

---

## TypeScript Rules (Global)

- `strict` mode must be enabled.
- `noImplicitAny` must be enabled.
- `strictNullChecks` must be enabled.
- No `any` allowed (use `unknown` if required).
- All exported functions must declare explicit return types.
- No implicit return types on public APIs.
- No circular imports.
- No default exports in shared packages.

---

## Backend Standards (Bun + Hono)

### Layering

Strict separation required:

- routes → transport layer only
- services → business logic
- repositories → database access
- schemas → validation (Zod)

Routes must NOT:

- Contain business logic
- Access database directly
- Perform cross-tenant resolution

All tenant resolution must occur in middleware.

---

### Validation

- Zod validation required for ALL request inputs.
- No unvalidated input reaches service layer.
- DTOs must be explicit and version-safe.

---

### Database Access

- DB access only via repository layer.
- No raw SQL in route handlers.
- No dynamic schema switching.
- All DB access must use tenant context from middleware.

---

### Transactions

Required for:

- Attempt creation
- Submission flow
- Limit enforcement
- License state changes
- Migration execution

No multi-step mutation without transaction.

---

## Frontend Standards (Vue 3 + TypeScript)

### Architecture

- Composition API only.
- No Options API.
- Pinia for global state only.
- No direct API calls inside components.
- Use composables for API access.
- No business logic inside components.

---

### UI Framework

- Must use shadcn-vue components.
- Tailwind v4 utility classes only.
- No custom CSS unless absolutely required.
- Theming must use defined theme tokens.
- No inline styles.

---

### State Rules

- API data must be normalized in stores.
- No duplicated derived state.
- No cross-store circular references.

---

## Naming Conventions

| Type               | Convention  |
| ------------------ | ----------- |
| Files              | kebab-case  |
| Vue Components     | PascalCase  |
| Variables          | camelCase   |
| Types / Interfaces | PascalCase  |
| Enums              | PascalCase  |
| DB tables          | snake_case  |
| DB columns         | snake_case  |
| Environment vars   | UPPER_SNAKE |

Names must be descriptive and domain-aligned.

---

## Import Rules

Hard boundaries enforced:

- apps/_ may import from packages/_ only.
- apps/_ may NOT import from other apps/_.
- packages/_ may NOT import from apps/_.
- No deep relative imports across modules.
- Use path aliases only.

Violation is architectural failure.

---

## Logging

- No `console.log` in production code.
- Use structured logger (Pino).
- All logs must include workspace context.
- All errors must be logged before thrown.

---

## Error Handling

- Use standard error response format.
- No raw error leakage to client.
- Map internal errors to safe public messages.

---

## Testing Requirements

- Unit tests required for business logic.
- Integration tests required for critical flows.
- Snapshot tests required for grading logic.
- No feature merge without passing tests.

---

## Forbidden Practices

- Hidden side effects
- Global mutable state
- Implicit tenant context
- Runtime schema mutation
- Silent failure handling
- Bypassing middleware validation

---

## Enforcement

- ESLint must enforce import boundaries.
- Pre-commit hooks must run lint + typecheck.
- CI must block merge on failure.

These standards protect isolation, determinism, and institutional trust.
